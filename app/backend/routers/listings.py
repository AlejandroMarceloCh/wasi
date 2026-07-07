"""Listings publicados (oferta) y leads (demanda). Cierra el flywheel."""
import unicodedata
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from ratelimit import limiter
from wasi.features.geo_index import OutOfBoundsError, geo_lookup
from wasi.models.ml import ZONE_BAND_PCT, predict_fair_value
from wasi.models.venta_service import venta_service
from models import Favorite, Lead, Listing, User
from schemas import (FavoriteIn, InboxLeadOut, LeadIn, LeadOut, ListingIn,
                     ListingOut, ListingUpdateIn)

router = APIRouter(prefix="/api", tags=["listings"])

SELLER_ROLES = {"Propietario", "Agente inmobiliario"}
VALID_STATUS = {"activo", "pausado", "alquilado", "vendido"}
VALID_OPERACION = {"alquiler", "venta"}

VALID_SORT = {"ganga", "precio_asc", "precio_desc", "reciente"}
VALID_ZONE = {"Ganga", "Justo", "Inflado"}

DEFAULT_PAGE_SIZE = 60
MAX_PAGE_SIZE = 120

# Descuento máximo plausible para considerar un aviso "ganga" real. Por debajo
# de esto casi siempre es un error de data (precio mal escalado, $ en soles),
# no una oportunidad — no debe treparse al módulo de gangas del home.
MAX_GANGA_DISCOUNT = 0.45


def _strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s or "")
        if unicodedata.category(c) != "Mn")


def _ganga_score(l: Listing) -> float:
    """Qué tan ganga es el listing: (precio - referencia) / referencia.
    Más negativo = más ganga. Sin referencia válida, o con un descuento
    implausible (data sucia), va al final (+inf) para no ensuciar el ranking."""
    if not l.fair_value_ref or l.fair_value_ref <= 0:
        return float("inf")
    score = (l.price_usd - l.fair_value_ref) / l.fair_value_ref
    if score < -MAX_GANGA_DISCOUNT:
        return float("inf")
    return score


def _fair_value_ref_comparables(
    db: Session, district: str, area_m2: float, operacion: str = "alquiler",
) -> Optional[float]:
    """Fallback server-side cuando el modelo no puede estimar.

    Mediana de USD/m2 de listings activos del mismo distrito y misma operación
    por area del aviso. Menos precisa que el modelo, pero evita que Explorar
    quede sin referencia si el servicio ML no esta disponible.
    """
    rows = db.execute(
        select(Listing.price_usd, Listing.area_m2).where(
            Listing.district == district,
            Listing.operacion == operacion,
            Listing.status == "activo",
            Listing.area_m2 > 0,
            Listing.price_usd > 0,
        )
    ).all()
    ppm2 = sorted(p / a for p, a in rows)
    if not ppm2:
        return None
    n = len(ppm2)
    med = ppm2[n // 2] if n % 2 else (ppm2[n // 2 - 1] + ppm2[n // 2]) / 2
    return round(med * area_m2, 0)


def _fair_value_ref_server(db: Session, payload: ListingIn, district: str) -> Optional[float]:
    """Referencia de precio justo calculada server-side y no manipulable.

    Fuente primaria: el MISMO modelo que usa FairValue según la operación
    (alquiler → modelo v2; venta → venta_service), para que el veredicto de
    Explorar coincida con el preview de publicación. Fallback: comparables
    activos por distrito si el modelo no está disponible.
    """
    if payload.operacion == "venta":
        try:
            if venta_service.is_loaded():
                res = venta_service.predict({
                    "lat": payload.lat, "lng": payload.lng, "area": payload.area_m2,
                    "dormitorios": payload.dormitorios, "banos": payload.banos,
                    "cocheras": payload.cocheras,
                    "antiguedad_anios": payload.antiguedad_anios,
                    "precio": payload.price_usd,
                })
                return round(float(res["fair_value"]), 0)
        except (RuntimeError, KeyError, TypeError, ValueError, OutOfBoundsError):
            pass
        return _fair_value_ref_comparables(
            db, district, payload.area_m2, operacion="venta")

    form = {
        "lat": payload.lat, "lng": payload.lng, "area": payload.area_m2,
        "dormitorios": payload.dormitorios, "banos": payload.banos,
        "cocheras": payload.cocheras, "antiguedad_anios": payload.antiguedad_anios,
        "es_estudio": payload.es_estudio, "amenities": payload.amenities or [],
        "precio": payload.price_usd,
    }
    try:
        prediction = predict_fair_value(form)
        return round(float(prediction["fair_value"]), 0)
    except (RuntimeError, KeyError, TypeError, ValueError):
        return _fair_value_ref_comparables(db, district, payload.area_m2)


def _zone_from_price(price: float, fair_ref: Optional[float]) -> Optional[str]:
    """Veredicto Wasi del precio publicado vs la referencia del modelo.

    Usa el MISMO umbral (ZONE_BAND_PCT = 8%) y la MISMA lógica que
    ml.predict_fair_value, para que el veredicto del listing no diverja del
    veredicto del análisis para el mismo precio. None si no hay referencia.
    """
    if not fair_ref or fair_ref <= 0:
        return None
    diff_pct = (price - fair_ref) / fair_ref * 100
    if diff_pct < -ZONE_BAND_PCT:
        return "Ganga"
    if diff_pct > ZONE_BAND_PCT:
        return "Inflado"
    return "Justo"


def _district_from_pin(lat: float, lng: float) -> str:
    try:
        return str(geo_lookup(lat, lng)["distrito"])
    except OutOfBoundsError:
        raise HTTPException(
            status_code=400,
            detail="Por ahora solo cubrimos Lima Metropolitana. Mueve el pin a un punto dentro de Lima e intenta de nuevo.",
        )


def _same_district(a: str, b: str) -> bool:
    """Compara distritos ignorando mayúsculas Y tildes. Nominatim devuelve
    "Jesús María" (con tilde) y el dataset usa "Jesus Maria"; sin normalizar
    acentos, publicar por pin fallaba con 422 en esos distritos."""
    return _strip_accents(a).strip().casefold() == _strip_accents(b).strip().casefold()


def _to_out(l: Listing, include_contact: bool = False) -> ListingOut:
    """Serializa un Listing. include_contact=True solo para el dueño (mis
    propiedades / al crear): expone nombre, teléfono y correo de contacto. En el
    catálogo público van en None — el comprador contacta vía formulario de lead,
    no recibe la PII del propietario (nombre incluido)."""
    return ListingOut(
        id=l.id, operacion=getattr(l, "operacion", "alquiler") or "alquiler",
        district=l.district, address=l.address, lat=l.lat, lng=l.lng,
        area_m2=l.area_m2, dormitorios=l.dormitorios, banos=l.banos,
        cocheras=l.cocheras, antiguedad_anios=l.antiguedad_anios,
        es_estudio=l.es_estudio, price_usd=l.price_usd, fair_value_ref=l.fair_value_ref,
        description=l.description, image_url=l.image_url,
        amenities=[c for c in (l.amenities or "").split(",") if c],
        contact_name=l.contact_name if include_contact else None,
        contact_phone=l.contact_phone if include_contact else None,
        contact_email=l.contact_email if include_contact else None,
        status=l.status,
        zone=_zone_from_price(l.price_usd, l.fair_value_ref),
        created_at=l.created_at,
    )

@router.get("/listings", response_model=List[ListingOut])
def list_listings(
    response: Response,
    operacion: Optional[str] = None,
    district: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_area: Optional[float] = None,
    max_area: Optional[float] = None,
    dormitorios: Optional[int] = None,
    zone: Optional[str] = None,
    sort: Optional[str] = None,
    limit: Optional[int] = Query(default=None, ge=0, le=MAX_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Catálogo para el inquilino (autenticado). Filtros server-side opcionales;
    solo lista status='activo'. dormitorios = mínimo (>=), igual que el label de
    la UI; area filtra por rango [min_area, max_area].

    - operacion: 'alquiler' (default de facto) | 'venta'. Sin valor, no filtra.
    - zone: 'Ganga'|'Justo'|'Inflado'. El veredicto se DERIVA en Python
      (depende de fair_value_ref), así que se filtra después de la query.
    - sort: 'ganga' | 'precio_asc' | 'precio_desc' | 'reciente' (default).
    - limit/offset: paginación. El total de resultados va en el header
      `X-Total-Count` para que la UI arme el paginador sin descargar todo.
    """
    if operacion is not None and operacion not in VALID_OPERACION:
        raise HTTPException(
            status_code=422,
            detail=f"operacion inválida. Opciones: {', '.join(sorted(VALID_OPERACION))}")
    if zone is not None and zone not in VALID_ZONE:
        raise HTTPException(
            status_code=422,
            detail=f"zone inválido. Opciones: {', '.join(sorted(VALID_ZONE))}")
    if sort is not None and sort not in VALID_SORT:
        raise HTTPException(
            status_code=422,
            detail=f"sort inválido. Opciones: {', '.join(sorted(VALID_SORT))}")

    def _apply_filters(q):
        q = q.where(Listing.status == "activo")
        if operacion:
            q = q.where(Listing.operacion == operacion)
        if district:
            q = q.where(Listing.district == district)
        if min_price is not None:
            q = q.where(Listing.price_usd >= min_price)
        if max_price is not None:
            q = q.where(Listing.price_usd <= max_price)
        if min_area is not None:
            q = q.where(Listing.area_m2 >= min_area)
        if max_area is not None:
            q = q.where(Listing.area_m2 <= max_area)
        if dormitorios is not None:
            q = q.where(Listing.dormitorios >= dormitorios)
        return q

    page_size = limit if limit is not None else DEFAULT_PAGE_SIZE

    # `zone` y `sort=ganga` dependen de fair_value_ref (se derivan en Python),
    # así que en esos casos hay que traer todo, filtrar/ordenar y paginar en
    # memoria. En el camino común (sin zone, sort por precio/fecha) la
    # paginación baja a SQL y NO se descarga el catálogo entero.
    if zone is not None or sort == "ganga":
        rows = list(db.execute(_apply_filters(select(Listing))).scalars().all())
        if zone is not None:
            rows = [l for l in rows
                    if _zone_from_price(l.price_usd, l.fair_value_ref) == zone]
        if sort == "ganga":
            rows.sort(key=_ganga_score)
        elif sort == "precio_asc":
            rows.sort(key=lambda l: l.price_usd)
        elif sort == "precio_desc":
            rows.sort(key=lambda l: l.price_usd, reverse=True)
        else:
            rows.sort(key=lambda l: l.created_at, reverse=True)
        total = len(rows)
        rows = rows[offset:offset + page_size]
    else:
        total = db.execute(
            _apply_filters(select(func.count(Listing.id)))).scalar_one()
        q = _apply_filters(select(Listing))
        if sort == "precio_asc":
            q = q.order_by(Listing.price_usd.asc())
        elif sort == "precio_desc":
            q = q.order_by(Listing.price_usd.desc())
        else:
            q = q.order_by(Listing.created_at.desc())
        q = q.offset(offset).limit(page_size)
        rows = list(db.execute(q).scalars().all())

    response.headers["X-Total-Count"] = str(total)
    return [_to_out(l) for l in rows]

@router.get("/listings/mine", response_model=List[ListingOut])
def my_listings(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Inmuebles publicados por el propietario actual (cualquier status)."""
    rows = db.execute(
        select(Listing).where(Listing.owner_id == current.id)
        .order_by(Listing.created_at.desc())
    ).scalars().all()
    return [_to_out(l, include_contact=True) for l in rows]

@router.post("/listings", response_model=ListingOut, status_code=201)
@limiter.limit("20/minute")
def create_listing(
    request: Request,
    payload: ListingIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.role not in SELLER_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Solo propietarios o agentes pueden publicar inmuebles.")
    data = payload.model_dump()
    data["amenities"] = ",".join(data.get("amenities") or [])

    derived_district = _district_from_pin(payload.lat, payload.lng)
    if not _same_district(payload.district, derived_district):
        raise HTTPException(
            status_code=422,
            detail="district no coincide con la ubicación indicada por lat/lng",
        )
    data["district"] = derived_district
    data["fair_value_ref"] = _fair_value_ref_server(db, payload, derived_district)
    l = Listing(owner_id=current.id, **data)
    db.add(l)
    current.last_activity_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(l)
    return _to_out(l, include_contact=True)

@router.patch("/listings/{listing_id}", response_model=ListingOut)
def update_listing(
    listing_id: int,
    payload: ListingUpdateIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Edita un listing del propietario actual: precio, descripción, foto,
    comodidades, contacto y estado (activo/pausado/alquilado/vendido). Sin esto,
    corregir un typo obligaba a borrar y perder los leads acumulados.

    Solo el dueño. La ubicación no se edita acá (ver ListingUpdateIn). Si cambia
    el precio, se recalcula el veredicto (fair_value_ref es fijo; zone se deriva
    del precio nuevo)."""
    l = db.get(Listing, listing_id)
    if not l or l.owner_id != current.id:
        raise HTTPException(status_code=404, detail="Inmueble no encontrado")
    data = payload.model_dump(exclude_unset=True)
    if "amenities" in data and data["amenities"] is not None:
        data["amenities"] = ",".join(data["amenities"])
    for k, v in data.items():
        if v is not None:
            setattr(l, k, v)
    current.last_activity_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(l)
    return _to_out(l, include_contact=True)

@router.get("/listings/{listing_id}", response_model=ListingOut)
def get_listing(listing_id: int, db: Session = Depends(get_db),
                current: User = Depends(get_current_user)):
    l = db.get(Listing, listing_id)
    if not l:
        raise HTTPException(status_code=404, detail="Inmueble no encontrado")
    is_owner = l.owner_id == current.id
    if l.status != "activo" and not is_owner:
        raise HTTPException(status_code=404, detail="Inmueble no encontrado")
    # El dueño ve su propio contacto (coherente con /listings/mine); a terceros
    # se les oculta la PII (contactan por el formulario de lead).
    return _to_out(l, include_contact=is_owner)

@router.delete("/listings/{listing_id}", status_code=204)
def delete_listing(listing_id: int, db: Session = Depends(get_db),
                   current: User = Depends(get_current_user)):
    """Borra un inmueble del propietario actual (P-14, pedido literal "falta borrar").

    Solo el dueño puede borrarlo. El cascade del modelo limpia sus leads y
    favoritos asociados. 404 si no existe o no es del usuario (no revelar
    inmuebles ajenos).
    """
    l = db.get(Listing, listing_id)
    if not l or l.owner_id != current.id:
        raise HTTPException(status_code=404, detail="Inmueble no encontrado")
    db.delete(l)
    current.last_activity_at = datetime.now(timezone.utc)
    db.commit()
    return None

@router.post("/listings/{listing_id}/leads", response_model=LeadOut, status_code=201)
@limiter.limit("15/minute")
def create_lead(request: Request, listing_id: int, payload: LeadIn,
                db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Inquilino contacta al propietario. Materializa la Capa 2 (leads)."""
    l = db.get(Listing, listing_id)
    if not l:
        raise HTTPException(status_code=404, detail="Inmueble no encontrado")
    if l.status != "activo":
        raise HTTPException(status_code=409, detail="Inmueble no disponible")
    if l.owner_id == current.id:
        raise HTTPException(
            status_code=403,
            detail="No puedes enviarte una consulta a tu propio inmueble.")
    lead = Lead(listing_id=l.id, **payload.model_dump())
    db.add(lead)
    current.last_activity_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return LeadOut.model_validate(lead)

@router.get("/listings/{listing_id}/leads", response_model=List[LeadOut])
def list_leads(listing_id: int, db: Session = Depends(get_db),
               current: User = Depends(get_current_user)):
    """Leads de un listing, solo visibles para su dueño. 404 si no es tuyo
    (mismo patrón que get_analysis: mezcla no-existe + no-es-tuyo)."""
    l = db.get(Listing, listing_id)
    if not l or l.owner_id != current.id:
        raise HTTPException(status_code=404, detail="Inmueble no encontrado")
    rows = db.execute(
        select(Lead).where(Lead.listing_id == listing_id)
        .order_by(Lead.created_at.desc())
    ).scalars().all()
    return [LeadOut.model_validate(x) for x in rows]

@router.get("/leads", response_model=List[InboxLeadOut])
def inbox_leads(db: Session = Depends(get_db),
                current: User = Depends(get_current_user)):
    """Bandeja agregada: TODOS los leads de TODAS las propiedades del dueño,
    en un solo request (antes la UI hacía N+1: un fetch por propiedad)."""
    rows = db.execute(
        select(Lead, Listing)
        .join(Listing, Lead.listing_id == Listing.id)
        .where(Listing.owner_id == current.id)
        .order_by(Lead.created_at.desc())
    ).all()
    return [
        InboxLeadOut(
            id=lead.id, listing_id=lead.listing_id,
            listing_address=lst.address, listing_district=lst.district,
            listing_operacion=getattr(lst, "operacion", "alquiler") or "alquiler",
            name=lead.name, phone=lead.phone, email=lead.email,
            message=lead.message, created_at=lead.created_at,
        )
        for lead, lst in rows
    ]

@router.post("/favorites", response_model=ListingOut, status_code=201)
def add_favorite(
    payload: FavoriteIn,
    response: Response,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Guarda un inmueble en favoritos. Idempotente: si ya estaba guardado
    devuelve 200 (no duplica); si es nuevo, 201. 404 si el listing no existe."""
    l = db.get(Listing, payload.listing_id)
    if not l or l.status != "activo":
        raise HTTPException(status_code=404, detail="Inmueble no encontrado")

    existing = db.execute(
        select(Favorite).where(
            Favorite.user_id == current.id,
            Favorite.listing_id == payload.listing_id,
        )
    ).scalar_one_or_none()
    if existing:
        response.status_code = 200
        return _to_out(l)

    fav = Favorite(user_id=current.id, listing_id=payload.listing_id)
    db.add(fav)
    current.last_activity_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError:

        db.rollback()
        response.status_code = 200
    return _to_out(l)

@router.delete("/favorites/{listing_id}", status_code=204)
def remove_favorite(
    listing_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Quita un inmueble de favoritos. 204 siempre que el estado final sea
    'no está en favoritos' (idempotente: borrar algo no guardado también da 204)."""
    fav = db.execute(
        select(Favorite).where(
            Favorite.user_id == current.id,
            Favorite.listing_id == listing_id,
        )
    ).scalar_one_or_none()
    if fav:
        db.delete(fav)
        current.last_activity_at = datetime.now(timezone.utc)
        db.commit()
    return Response(status_code=204)

@router.get("/favorites", response_model=List[ListingOut])
def list_favorites(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Inmuebles guardados por el usuario actual, con su veredicto (zone).
    Orden: favorito más reciente primero."""
    rows = db.execute(
        select(Listing)
        .join(Favorite, Favorite.listing_id == Listing.id)
        .where(Favorite.user_id == current.id, Listing.status == "activo")
        .order_by(Favorite.created_at.desc())
    ).scalars().all()
    return [_to_out(l) for l in rows]

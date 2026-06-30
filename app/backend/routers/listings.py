"""Listings publicados (oferta) y leads (demanda). Cierra el flywheel."""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from wasi.models.ml import ZONE_BAND_PCT
from models import Favorite, Lead, Listing, User
from schemas import FavoriteIn, LeadIn, LeadOut, ListingIn, ListingOut

router = APIRouter(prefix="/api", tags=["listings"])

SELLER_ROLES = {"Propietario", "Agente inmobiliario"}
VALID_STATUS = {"activo", "pausado", "alquilado"}

VALID_SORT = {"ganga", "precio_asc", "precio_desc", "reciente"}
VALID_ZONE = {"Ganga", "Justo", "Inflado"}

def _ganga_score(l: Listing) -> float:
    """Qué tan ganga es el listing: (precio - referencia) / referencia.
    Más negativo = más ganga. Sin referencia válida va al final (+inf)."""
    if not l.fair_value_ref or l.fair_value_ref <= 0:
        return float("inf")
    return (l.price_usd - l.fair_value_ref) / l.fair_value_ref

def _fair_value_ref_server(db: Session, district: str, area_m2: float) -> Optional[float]:
    """Referencia de precio justo calculada SERVER-SIDE (no manipulable por el
    cliente). Mediana de USD/m² de los listings activos del mismo distrito ×
    área del aviso nuevo — mismo método que el seed masivo del catálogo. None si
    el distrito todavía no tiene avisos con datos válidos (el aviso queda sin
    veredicto hasta que haya base comparativa)."""
    rows = db.execute(
        select(Listing.price_usd, Listing.area_m2).where(
            Listing.district == district,
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

def _to_out(l: Listing, include_contact: bool = False) -> ListingOut:
    """Serializa un Listing. include_contact=True solo para el dueño (mis
    propiedades / al crear): expone teléfono y correo. En el catálogo público
    van en None — el comprador contacta vía formulario de lead, no recibe la PII."""
    return ListingOut(
        id=l.id, district=l.district, address=l.address, lat=l.lat, lng=l.lng,
        area_m2=l.area_m2, dormitorios=l.dormitorios, banos=l.banos,
        cocheras=l.cocheras, antiguedad_anios=l.antiguedad_anios,
        es_estudio=l.es_estudio, price_usd=l.price_usd, fair_value_ref=l.fair_value_ref,
        description=l.description, image_url=l.image_url,
        amenities=[c for c in (l.amenities or "").split(",") if c],
        contact_name=l.contact_name,
        contact_phone=l.contact_phone if include_contact else None,
        contact_email=l.contact_email if include_contact else None,
        status=l.status,
        zone=_zone_from_price(l.price_usd, l.fair_value_ref),
        created_at=l.created_at,
    )

@router.get("/listings", response_model=List[ListingOut])
def list_listings(
    district: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_area: Optional[float] = None,
    max_area: Optional[float] = None,
    dormitorios: Optional[int] = None,
    zone: Optional[str] = None,
    sort: Optional[str] = None,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Catálogo para el inquilino (autenticado). Filtros server-side opcionales;
    solo lista status='activo'. dormitorios = mínimo (>=), igual que el label de
    la UI; area filtra por rango [min_area, max_area].

    Parámetros nuevos:
    - zone: 'Ganga'|'Justo'|'Inflado'. El veredicto se DERIVA en Python
      (depende de fair_value_ref), así que se filtra después de la query.
    - sort: 'ganga' (más ganga primero), 'precio_asc', 'precio_desc',
      'reciente' (default = created_at desc).
    - limit: top N tras ordenar (para el Home: top gangas).
    """
    if zone is not None and zone not in VALID_ZONE:
        raise HTTPException(
            status_code=422,
            detail=f"zone inválido. Opciones: {', '.join(sorted(VALID_ZONE))}")
    if sort is not None and sort not in VALID_SORT:
        raise HTTPException(
            status_code=422,
            detail=f"sort inválido. Opciones: {', '.join(sorted(VALID_SORT))}")
    if limit is not None and limit < 0:
        raise HTTPException(status_code=422, detail="limit no puede ser negativo")

    q = select(Listing).where(Listing.status == "activo")
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

    if sort == "precio_asc":
        q = q.order_by(Listing.price_usd.asc())
    elif sort == "precio_desc":
        q = q.order_by(Listing.price_usd.desc())
    else:
        q = q.order_by(Listing.created_at.desc())

    rows = list(db.execute(q).scalars().all())

    if zone is not None:
        rows = [l for l in rows if _zone_from_price(l.price_usd, l.fair_value_ref) == zone]

    if sort == "ganga":
        rows.sort(key=_ganga_score)

    if limit is not None:
        rows = rows[:limit]

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
def create_listing(
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

    data["fair_value_ref"] = _fair_value_ref_server(db, payload.district, payload.area_m2)
    l = Listing(owner_id=current.id, **data)
    db.add(l)
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
    return _to_out(l)

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
def create_lead(listing_id: int, payload: LeadIn,
                db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """Inquilino contacta al propietario. Materializa la Capa 2 (leads)."""
    l = db.get(Listing, listing_id)
    if not l:
        raise HTTPException(status_code=404, detail="Inmueble no encontrado")
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
    if not l:
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
        .where(Favorite.user_id == current.id)
        .order_by(Favorite.created_at.desc())
    ).scalars().all()
    return [_to_out(l) for l in rows]

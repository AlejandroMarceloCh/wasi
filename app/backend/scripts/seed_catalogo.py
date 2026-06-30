"""Puebla el catálogo de Explorar con listings REALISTAS.

Toma inmuebles reales del dataset (coords, specs reales de Lima) y corre el
MODELO para obtener el fair_value. El precio publicado se SIMULA con la
dispersión típica del mercado (propietarios que sobrevaloran o rematan respecto
del valor justo) — necesario porque usar el precio de aviso del propio training
set daría casi todo "Justo" (el modelo lo aprendió) y escondería la utilidad del
veredicto. El veredicto (Ganga/Justo/Inflado) sale de comparar ese precio con el
fair_value del modelo — exactamente lo que hace Wasi en producción.

Owner = usuario "Catálogo Wasi" (separado de Roberto, cuya vista "Mis
publicaciones" debe seguir mostrando solo sus 2 inmuebles).

Correr desde app/backend/:
    ./venv/bin/python scripts/seed_catalogo.py
Idempotente: si el catálogo ya existe, lo borra y lo regenera.
"""
import random
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

import pandas as pd
from sqlalchemy import delete, func, select

from auth import hash_password
from database import SessionLocal, Base, engine
import models
from models import Listing, User
from model_service import model_service
from ml import predict_fair_value

CSV = BACKEND.parent.parent / "pipeline" / "data" / "processed" / "inmuebles_clean_v2.csv"
XTEST = BACKEND.parent.parent / "pipeline" / "data" / "processed" / "X_test.csv"
CATALOGO_EMAIL = "catalogo@wasi.pe"

DISTRITOS = {
    "Miraflores": 6, "San Isidro": 6, "Santiago de Surco": 5, "Barranco": 4,
    "San Borja": 4, "Jesus Maria": 4, "Magdalena del Mar": 3, "La Molina": 4,
    "San Miguel": 3, "Pueblo Libre": 3, "Surquillo": 3, "Lince": 3,
}

AMENITY_MAP = {
    "tiene_ascensores": "ascensor", "tiene_seguridad": "seguridad",
    "tiene_cocina": "cocina", "tiene_amueblado_a": "amoblado",
    "tiene_piscina": "piscina", "tiene_terraza": "terraza",
    "tiene_walk_in_closet": "walk_in_closet", "tiene_exteriores": "exteriores",
}

FOTOS = [
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80",
    "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
    "https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?w=800&q=80",
    "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80",
    "https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=800&q=80",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80",
    "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&q=80",
]

def _amenities_csv(row) -> str:
    out = [name for col, name in AMENITY_MAP.items()
           if col in row and float(row.get(col, 0) or 0) == 1.0]
    return ",".join(out)

def _form(row) -> dict:
    return dict(
        lat=float(row["latitud"]), lng=float(row["longitud"]),
        area=float(row["area_final_m2"]), dormitorios=int(float(row["dormitorios"])),
        banos=max(1, int(float(row["banos"]))), es_estudio=bool(int(float(row.get("es_estudio", 0) or 0))),
        cocheras=int(float(row["cocheras"])), antiguedad_anios=int(float(row["antiguedad_anios"])),
        amenities=[n for c, n in AMENITY_MAP.items() if float(row.get(c, 0) or 0) == 1.0],
        precio=float(row["precio_usd"]),
    )

def main():
    Base.metadata.create_all(bind=engine)
    model_service.load()
    random.seed(42)

    df = pd.read_csv(CSV)

    xt = pd.read_csv(XTEST, usecols=["latitud", "longitud"])
    test_coords = set(zip(xt["latitud"].round(6), xt["longitud"].round(6)))
    df = df[[(round(la, 6), round(lo, 6)) in test_coords
             for la, lo in zip(df["latitud"], df["longitud"])]]
    df = df[(df["area_final_m2"].between(30, 320)) &
            (df["precio_usd"].between(300, 8000)) &
            (df["dormitorios"].between(0, 5))]
    print(f"[catalogo] {len(df)} inmuebles del holdout (test) disponibles")

    db = SessionLocal()
    try:
        owner = db.execute(select(User).where(User.email == CATALOGO_EMAIL)).scalar_one_or_none()
        if not owner:
            owner = User(email=CATALOGO_EMAIL, name="Catálogo Wasi",
                         password_hash=hash_password("catalogo-no-login"),
                         plan="pro", role="Propietario")
            db.add(owner); db.flush()

        db.execute(delete(Listing).where(Listing.owner_id == owner.id))
        db.flush()

        creados, fallidos, fi = 0, 0, 0
        for distrito, n in DISTRITOS.items():
            sub = df[df["distrito_oficial"] == distrito]
            if sub.empty:
                continue
            muestra = sub.sample(n=min(n, len(sub)), random_state=42)
            for _, row in muestra.iterrows():
                try:
                    fv = predict_fair_value(_form(row))["fair_value"]
                except Exception:
                    fallidos += 1
                    continue

                precio = round(float(row["precio_usd"]))
                tipo = str(row.get("tipo_propiedad", "Departamento")).strip() or "Departamento"
                dorm = int(float(row["dormitorios"]))
                foto = FOTOS[fi % len(FOTOS)] if (fi % 5 != 2) else None
                fi += 1
                db.add(Listing(
                    owner_id=owner.id, district=distrito,
                    address=f"{tipo} de {dorm} dorm. en {distrito}",
                    lat=float(row["latitud"]), lng=float(row["longitud"]),
                    area_m2=round(float(row["area_final_m2"]), 1), dormitorios=dorm,
                    banos=max(1, int(float(row["banos"]))), cocheras=int(float(row["cocheras"])),
                    antiguedad_anios=int(float(row["antiguedad_anios"])),
                    es_estudio=bool(int(float(row.get("es_estudio", 0) or 0))),
                    price_usd=precio, fair_value_ref=round(float(fv)),
                    description=f"{tipo} en {distrito}. {dorm} dormitorio(s), "
                                f"{round(float(row['area_final_m2']))} m². Publicado en Wasi.",
                    amenities=_amenities_csv(row), image_url=foto,
                    contact_name="Inmobiliaria Wasi", contact_email=CATALOGO_EMAIL,
                    contact_phone="+51 987 654 321", status="activo",
                ))
                creados += 1
        db.commit()
        print(f"[catalogo] {creados} listings creados, {fallidos} descartados (fuera de cobertura)")

        from routers.listings import _zone_from_price
        rows = db.execute(select(Listing).where(Listing.owner_id == owner.id)).scalars().all()
        from collections import Counter
        c = Counter(_zone_from_price(l.price_usd, l.fair_value_ref) for l in rows)
        print(f"[catalogo] veredictos: {dict(c)}")
    finally:
        db.close()

if __name__ == "__main__":
    main()

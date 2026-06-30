"""Seed masivo de listings desde el dataset real de alquiler.

Puebla la tabla `listings` con los ~3.3k avisos limpios del pipeline para que la
pantalla Explorar tenga densidad estilo Zillow (mapa + grid por viewport).

- Owner: usuario "Catálogo Wasi" (lo crea seed.py), separado de los demo.
- fair_value_ref: se deriva de la MEDIANA USD/m² por distrito (del propio dataset)
  -> el veredicto Ganga/Justo/Inflado sale con dispersión realista, no monocromo.
- Idempotente por bandera: si ya hay > UMBRAL listings, no vuelve a insertar.
- Corre solo en el startup del backend; también se puede correr a mano:
    ./venv/bin/python seed_listings_bulk.py
"""
import pandas as pd
from sqlalchemy import func, select

from database import SessionLocal
from models import Listing, User
from wasi.paths import DATA_DIR

# Dataset incluido en el repo: el catálogo es reproducible desde un clone.
CSV = DATA_DIR / "inmuebles_alquiler_clean.csv"

# Los avisos del dataset pertenecen al usuario "catálogo", NO a Roberto: así el
# propietario demo conserva solo sus 2 listings reales (Mis Propiedades/Leads sanos).
CATALOG_EMAIL = "catalogo@wasi.pe"
UMBRAL_YA_POBLADO = 500   # si ya hay este nro de listings, asumimos seed hecho


def seed_bulk(db=None) -> None:
    propia = db is None
    if propia:
        db = SessionLocal()
    try:
        total = db.scalar(select(func.count(Listing.id)))
        if total and total >= UMBRAL_YA_POBLADO:
            print(f"[seed_bulk] ya hay {total} listings (>= {UMBRAL_YA_POBLADO}); skip")
            return

        catalogo = db.execute(
            select(User).where(User.email == CATALOG_EMAIL)).scalar_one_or_none()
        if not catalogo:
            print("[seed_bulk] falta el usuario catálogo; corre seed.py primero")
            return

        df = pd.read_csv(CSV)
        # Solo columnas que necesitamos, con tipos sanos.
        df = df[[
            "precio_usd", "area_final_m2", "dormitorios", "banos", "cocheras",
            "antiguedad_anios", "latitud", "longitud", "distrito_oficial",
            "tipo_propiedad", "url",
        ]].copy()
        df = df.dropna(subset=["precio_usd", "area_final_m2", "latitud", "longitud",
                               "distrito_oficial"])
        df = df[(df["precio_usd"] > 0) & (df["area_final_m2"] > 0)]
        # Coords dentro de Lima Metropolitana (descarta geocodings basura).
        df = df[df["latitud"].between(-12.45, -11.85)
                & df["longitud"].between(-77.20, -76.75)]

        # Mediana USD/m² por distrito -> referencia de precio justo.
        df["ppm2"] = df["precio_usd"] / df["area_final_m2"]
        med = df.groupby("distrito_oficial")["ppm2"].median()
        global_med = float(df["ppm2"].median())

        def as_int(v, default=0):
            try:
                return int(round(float(v)))
            except (TypeError, ValueError):
                return default

        n = 0
        objs = []
        for _, r in df.iterrows():
            dist = str(r["distrito_oficial"])
            area = float(r["area_final_m2"])
            ref_ppm2 = float(med.get(dist, global_med))
            fair = round(ref_ppm2 * area, 0)
            tipo = str(r.get("tipo_propiedad") or "Departamento")
            dorms = as_int(r["dormitorios"])
            objs.append(Listing(
                owner_id=catalogo.id,
                district=dist,
                address=f"{tipo} en {dist}",
                lat=float(r["latitud"]),
                lng=float(r["longitud"]),
                area_m2=area,
                dormitorios=dorms,
                banos=as_int(r["banos"], 1) or 1,
                cocheras=as_int(r["cocheras"]),
                antiguedad_anios=as_int(r["antiguedad_anios"]),
                price_usd=float(r["precio_usd"]),
                fair_value_ref=fair,
                description=f"{tipo} de {dorms} dorm. en {dist}. Aviso del dataset Wasi.",
                amenities="",
                contact_name="Catálogo Wasi",
                contact_email=CATALOG_EMAIL,
                contact_phone="+51 999 888 777",
                status="activo",
            ))
            n += 1

        db.add_all(objs)
        db.commit()
        print(f"[seed_bulk] {n} listings insertados desde el dataset de alquiler")
    finally:
        if propia:
            db.close()


if __name__ == "__main__":
    import models  # noqa: F401
    from database import Base, engine
    Base.metadata.create_all(bind=engine)
    seed_bulk()
    print("[seed_bulk] listo")

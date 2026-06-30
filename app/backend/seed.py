"""Seed inicial de la BD: distritos (desde el dataset) + usuario demo.

Idempotente: solo inserta lo que falta. Se ejecuta solo en el startup del
backend (ver main.py) y también puede correrse a mano:
    ./venv/bin/python seed.py
"""
import pandas as pd
from sqlalchemy import func, select

from auth import hash_password
from database import SessionLocal
from models import District, Lead, Listing, User
from wasi.paths import DATA_DIR

# Dataset incluido en el repo (mismo que usa seed_listings_bulk): el conteo de
# distritos es reproducible desde un clone, sin depender de pipeline/.
DATASET = DATA_DIR / "inmuebles_alquiler_clean.csv"

DEMO_EMAIL = "ana@wasi.pe"
DEMO_PASSWORD = "demo1234"
# Demo vendedor/propietario (vista Roberto). Mismo password, role explícito.
SELLER_EMAIL = "roberto@wasi.pe"
SELLER_PASSWORD = "demo1234"
# Usuario "catálogo": dueño de los ~3.3k avisos sembrados desde el dataset.
# Separar al catálogo de Roberto evita que "Mis Propiedades"/"Leads" del demo
# real se llenen con miles de listings (ver seed_listings_bulk.py).
CATALOG_EMAIL = "catalogo@wasi.pe"
CATALOG_PASSWORD = "demo1234"


def _coverage(n: int) -> str:
    if n >= 500:
        return "alta"
    if n >= 100:
        return "media"
    return "baja"


def seed_if_empty(db=None) -> None:
    """Inserta distritos y usuario demo si aún no existen."""
    propia = db is None
    if propia:
        db = SessionLocal()
    try:
        if db.scalar(select(func.count(District.id))) == 0:
            counts = (pd.read_csv(DATASET, usecols=["distrito_oficial"])
                      ["distrito_oficial"].value_counts())
            for nombre, n in counts.items():
                db.add(District(name=str(nombre), listings_count=int(n),
                                coverage_level=_coverage(int(n))))
            print(f"[seed] {len(counts)} distritos cargados desde el dataset")

        ya = db.scalar(select(func.count(User.id)).where(User.email == DEMO_EMAIL))
        if not ya:
            db.add(User(email=DEMO_EMAIL, name="Ana Demo",
                        password_hash=hash_password(DEMO_PASSWORD), plan="pro"))
            print(f"[seed] usuario demo (inquilino): {DEMO_EMAIL} / {DEMO_PASSWORD}")

        ya_seller = db.scalar(select(func.count(User.id)).where(User.email == SELLER_EMAIL))
        if not ya_seller:
            db.add(User(email=SELLER_EMAIL, name="Roberto Demo",
                        password_hash=hash_password(SELLER_PASSWORD),
                        plan="pro", role="Propietario"))
            print(f"[seed] usuario demo (propietario): {SELLER_EMAIL} / {SELLER_PASSWORD}")

        ya_catalog = db.scalar(select(func.count(User.id)).where(User.email == CATALOG_EMAIL))
        if not ya_catalog:
            db.add(User(email=CATALOG_EMAIL, name="Catálogo Wasi",
                        password_hash=hash_password(CATALOG_PASSWORD),
                        plan="pro", role="Propietario"))
            print(f"[seed] usuario catálogo: {CATALOG_EMAIL}")

        # Listings + lead demo de Roberto. Guarda INDEPENDIENTE del bloque de
        # usuarios: si Roberto existe pero aún no tiene listings, se siembran.
        # Así corre también en una BD ya poblada (no requiere borrar wasi.db).
        db.flush()  # garantiza el id de los usuarios recién añadidos (autoflush OFF)
        roberto = db.execute(
            select(User).where(User.email == SELLER_EMAIL)).scalar_one_or_none()
        if roberto and db.scalar(
                select(func.count(Listing.id)).where(Listing.owner_id == roberto.id)) == 0:
            demo = [
                dict(district="Miraflores", address="Av. Larco 345", lat=-12.1215, lng=-77.0305,
                     area_m2=85, dormitorios=2, banos=2, cocheras=1, antiguedad_anios=6,
                     price_usd=1250, fair_value_ref=1200, status="activo",   # +4.2% -> Justo
                     description="Departamento luminoso a pasos del Parque Kennedy.",
                     image_url="https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80",
                     amenities="ascensor,seguridad,cocina"),
                dict(district="San Isidro", address="Calle Las Begonias 210", lat=-12.0955, lng=-77.0270,
                     area_m2=120, dormitorios=3, banos=3, cocheras=2, antiguedad_anios=3,
                     price_usd=2100, fair_value_ref=2350, status="activo",   # -10.6% -> Ganga
                     description="Amplio y moderno en zona financiera.",
                     amenities="ascensor,seguridad,piscina,terraza"),
            ]
            for d in demo:
                db.add(Listing(owner_id=roberto.id, contact_name="Roberto Demo",
                               contact_email=SELLER_EMAIL, contact_phone="+51 999 888 777", **d))
            db.flush()
            primer = db.execute(
                select(Listing).where(Listing.owner_id == roberto.id)
                .order_by(Listing.id).limit(1)).scalar_one()
            db.add(Lead(listing_id=primer.id, name="Ana Demo", email=DEMO_EMAIL,
                        phone="+51 911 222 333", message="Hola, ¿el departamento sigue disponible?"))
            print("[seed] listings + lead demo (Roberto) cargados")

        db.commit()
    finally:
        if propia:
            db.close()


if __name__ == "__main__":
    import models  # noqa: F401 — registra tablas
    from database import Base, engine
    Base.metadata.create_all(bind=engine)
    seed_if_empty()
    print("[seed] listo")

"""Seed inicial de la BD: distritos (desde el dataset) + usuario demo.

Idempotente: solo inserta lo que falta. Se ejecuta solo en el startup del
backend (ver main.py) y también puede correrse a mano:
    ./venv/bin/python seed.py
"""
from pathlib import Path

import pandas as pd
from sqlalchemy import func, select

from auth import hash_password
from database import SessionLocal
from models import District, User

DATASET = (Path(__file__).resolve().parent.parent.parent
           / "pipeline" / "data" / "processed" / "inmuebles_clean_v1.csv")

DEMO_EMAIL = "ana@ubica.pe"
DEMO_PASSWORD = "demo1234"


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
            print(f"[seed] usuario demo: {DEMO_EMAIL} / {DEMO_PASSWORD}")

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

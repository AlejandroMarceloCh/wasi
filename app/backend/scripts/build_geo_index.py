"""
Construcción del índice espacial  ·  Fase 1 del PLAN.

Extrae de inmuebles_clean_v1.csv (3.348 listings) las columnas geográficas
que el backend interpola por IDW para un pin nuevo, y las guarda en
app/backend/data/geo_index.csv.

Uso:  ./venv/bin/python scripts/build_geo_index.py
"""
from pathlib import Path
import sys

import pandas as pd

BACKEND = Path(__file__).resolve().parent.parent
DATA_OUT = BACKEND / "data"
SRC = BACKEND.parent.parent / "pipeline" / "data" / "processed" / "inmuebles_clean_v1.csv"

POI_TYPES = ["supermercados", "farmacias", "colegios", "hospitales",
             "bancos", "universidades", "parqueos"]

# Columnas que el índice conserva: identidad + geo interpolable.
COLS_GEO = (
    ["latitud", "longitud", "distrito_oficial", "dist_mar_km", "cantidad_denuncias"]
    + [f"count_1km_{t}" for t in POI_TYPES]
    + [f"dist_nearest_m_{t}" for t in POI_TYPES]
)


def main() -> int:
    if not SRC.exists():
        raise SystemExit(f"ABORT: no existe {SRC}")
    df = pd.read_csv(SRC)
    print(f"Dataset fuente: {df.shape[0]} listings, {df.shape[1]} columnas")

    faltan = [c for c in COLS_GEO if c not in df.columns]
    if faltan:
        raise SystemExit(f"ABORT: faltan columnas en el dataset: {faltan}")

    geo = df[COLS_GEO].copy()
    # Sanidad: sin nulos en lat/lng (el KD-tree no los tolera).
    if geo[["latitud", "longitud"]].isnull().any().any():
        raise SystemExit("ABORT: hay nulos en latitud/longitud")

    DATA_OUT.mkdir(exist_ok=True)
    out = DATA_OUT / "geo_index.csv"
    geo.to_csv(out, index=False)
    print(f"Índice escrito: {out}  ({geo.shape[0]} filas, {geo.shape[1]} columnas)")
    print(f"  bbox lat: [{geo.latitud.min():.4f}, {geo.latitud.max():.4f}]")
    print(f"  bbox lng: [{geo.longitud.min():.4f}, {geo.longitud.max():.4f}]")
    print(f"  distritos: {geo.distrito_oficial.nunique()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

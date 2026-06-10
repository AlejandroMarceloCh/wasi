"""FASE 3 — Feature engineering para venta.

Reusa geo_lookup() del backend de alquiler: por cada coordenada reconstruye las
16 features geoespaciales (POIs, denuncias, dist_mar) y el distrito canónico —
mismas fuentes que el modelo de alquiler. Features finales = geo + del inmueble.
Entrada: data/clean_ventas.csv. Salida: data/ventas_features.csv.
"""
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "app" / "backend"))
from geo_index import IDW_COLS, geo_lookup  # noqa: E402

D = Path(__file__).resolve().parent / "data"
INMUEBLE_COLS = ["m2", "dormitorios", "banos", "cocheras", "antiguedad_anios"]


def main():
    df = pd.read_csv(D / "clean_ventas.csv")
    rows, descartados = [], 0
    for _, r in df.iterrows():
        try:
            geo = geo_lookup(float(r["lat"]), float(r["lng"]))
        except Exception:
            descartados += 1               # fuera del bbox/cobertura del indice
            continue
        feat = {c: geo[c] for c in IDW_COLS}
        feat["distrito"] = geo.get("distrito") or geo.get("distrito_oficial") or r.get("distrito", "")
        for c in INMUEBLE_COLS:
            feat[c] = r[c]
        feat["lat"], feat["lng"] = r["lat"], r["lng"]
        feat["price_usd"] = r["price_usd"]
        # clave de grupo espacial (~111 m) para GroupKFold sin leakage de edificio
        feat["coord_cell"] = f"{round(float(r['lat']), 3)}_{round(float(r['lng']), 3)}"
        rows.append(feat)

    out = pd.DataFrame(rows)
    out.to_csv(D / "ventas_features.csv", index=False)
    print(f"[features] {len(out)} filas con features ({descartados} descartadas fuera de cobertura)")
    print(f"[features] {len(IDW_COLS)} geo + {len(INMUEBLE_COLS)} inmueble = "
          f"{len(IDW_COLS)+len(INMUEBLE_COLS)} features + distrito")
    print(f"[features] celdas espaciales unicas: {out['coord_cell'].nunique()}")


if __name__ == "__main__":
    main()

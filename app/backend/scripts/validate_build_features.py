"""
Validación de build_features  ·  Fase 2 (preview del Gate 4).

Cruza X_test.csv con inmuebles_clean_v1.csv por (latitud, longitud), reconstruye
el `form` + `geo` crudos de cada listing, corre build_features y compara el
vector de 74 features contra la fila real de X_test.

Las features de amenities y OHE se comparan aparte: build_features aplica el
comportamiento de PRODUCCIÓN (solo 8 chips, defaults de submission), así que
para esas columnas se espera divergencia controlada, no igualdad.

Uso:  ./venv/bin/python scripts/validate_build_features.py
"""
from pathlib import Path
import sys

import numpy as np
import pandas as pd

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from geo_index import POI_TYPES          # noqa: E402
from ml import AMENITY_CHIPS, build_features  # noqa: E402
from model_service import model_service  # noqa: E402

PIPELINE_DATA = BACKEND.parent.parent / "pipeline" / "data" / "processed"

# Columnas cuya divergencia es ESPERADA (build_features usa modo producción):
#   - 29 amenities fuera de los 8 chips
#   - amenities_count y area_x_amenities (dependen de las amenities)
#   - OHE de fuente y mismatch (defaults de submission de usuario)
CHIP_FEATS = set(AMENITY_CHIPS.values())


def main() -> int:
    model_service.load()
    xtest = pd.read_csv(PIPELINE_DATA / "X_test.csv")
    raw = pd.read_csv(PIPELINE_DATA / "inmuebles_clean_v1.csv")

    # Join por (lat,lng) — PERO varios deptos del mismo edificio comparten
    # coordenadas. Solo se usan listings con coordenadas ÚNICAS en el dataset,
    # así el join identifica al listing correcto sin ambigüedad.
    coord = raw["latitud"].round(6).astype(str) + "," + raw["longitud"].round(6).astype(str)
    unicas = coord.value_counts()
    raw_unico = {coord[i]: raw.iloc[i]
                 for i in range(len(raw)) if unicas[coord[i]] == 1}
    print(f"Listings con coordenadas únicas: {len(raw_unico)} de {len(raw)}")

    feat_order = model_service.feature_order
    tiene_all = [f for f in feat_order if f.startswith("tiene_")]
    no_chip = [f for f in tiene_all if f not in CHIP_FEATS]
    # Excluidas del match exacto: amenities fuera de los 8 chips + columnas
    # que build_features fija con defaults de producción.
    excluidas = set(no_chip) | {"amenities_count", "area_x_amenities",
                                "fuente_properati", "fuente_urbania",
                                "mismatch_type_frontera", "mismatch_type_ninguno",
                                "cocheras_informadas", "tipo_propiedad_Departamento"}
    intrinsecas = [f for f in feat_order if f not in excluidas]

    rng = np.random.default_rng(7)
    muestra = rng.choice(len(xtest), len(xtest), replace=False)
    peor_dif = 0.0
    fallos = 0
    pred_difs = []

    for i in muestra:
        if len(pred_difs) >= 40:
            break
        fila_x = xtest.iloc[i]
        clave = f"{round(fila_x['latitud'], 6)},{round(fila_x['longitud'], 6)}"
        if clave not in raw_unico:
            continue
        r = raw_unico[clave]

        form = {
            "lat": r["latitud"], "lng": r["longitud"],
            "area": r["area_final_m2"], "dormitorios": r["dormitorios"],
            "banos": r["banos"], "cocheras": r["cocheras"],
            "antiguedad_anios": r["antiguedad_anios"],
            "es_estudio": bool(r["es_estudio"]),
            "amenities": [chip for chip, feat in AMENITY_CHIPS.items()
                          if r[feat] == 1],
            "precio": r["precio_usd"],
        }
        geo = {
            "distrito": r["distrito_oficial"],
            "dist_mar_km": r["dist_mar_km"],
            "cantidad_denuncias": r["cantidad_denuncias"],
            **{f"count_1km_{t}": r[f"count_1km_{t}"] for t in POI_TYPES},
            **{f"dist_nearest_m_{t}": r[f"dist_nearest_m_{t}"] for t in POI_TYPES},
        }
        X = build_features(form, geo)

        # comparar features intrínsecas
        for f in intrinsecas:
            pred, real = float(X[f].iloc[0]), float(fila_x[f])
            denom = abs(real) if abs(real) > 1e-9 else 1.0
            dif = abs(pred - real) / denom
            peor_dif = max(peor_dif, dif)
            if dif > 1e-4:
                fallos += 1
                if fallos <= 5:
                    print(f"  DIFF fila {i} · {f}: pred={pred:.6f} real={real:.6f} ({dif*100:.3f}%)")

        # predicción: build_features vs fila real de X_test
        p_build = model_service.predict(X)
        p_real = model_service.predict(xtest.iloc[[i]])
        pred_difs.append(abs(p_build - p_real) / p_real)

    pred_difs = np.array(pred_difs) * 100
    print(f"\nListings validados: {len(pred_difs)}")
    print(f"Features intrínsecas ({len(intrinsecas)}/74) — comparación exacta:")
    print(f"  peor diferencia relativa: {peor_dif*100:.5f}%   fallos (>0.01%): {fallos}")
    print(f"  → {'OK: build_features reproduce X_test' if fallos == 0 else 'REVISAR'}")
    print(f"\nPredicción build_features vs X_test real (incluye reducción a 8 chips):")
    print(f"  diferencia mediana: {np.median(pred_difs):.3f}%   p95: {np.percentile(pred_difs,95):.3f}%   max: {pred_difs.max():.3f}%")
    return 0 if fallos == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

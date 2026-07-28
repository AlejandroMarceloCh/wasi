"""Reconstruye el dataset v2 (101 features) desde fuentes versionadas.

## Por qué existe este script

El artefacto servido (`models/v2/modelo_final_v2.joblib`, 101 features) no tenía
script de entrenamiento en el repo: los notebooks 04/05 son v1 (split plano,
producen `modelo_final.joblib`) y el dataset v2 nunca se versionó. Resultado:
el modelo en producción no era reproducible y su MAPE real nunca se midió — el
16.4% de `ml.py` es una constante heredada, no un número derivado del artefacto.

Este script cierra la primera mitad del problema: deja el dataset de las 101
features reconstruido y versionado, a partir de fuentes que SÍ están commiteadas.

## De dónde sale cada bloque de features

| Bloque                        | Cant. | Fuente                                        |
|-------------------------------|-------|-----------------------------------------------|
| Estructurales + POIs + amenities | 58 | `data/inmuebles_alquiler_clean.csv` (directo) |
| OSM (500m/1km/dist + tiers)   |  23   | `data/external/*.json` vía `osm_lookup`       |
| NSE + categoría de distrito   |   4   | tabla en `distritos_lima_features.py`         |
| Comisarías + denuncias        |   3   | `data/external/*.csv` vía `distrito_features` |
| Derivadas y OHE               |  12   | aritmética sobre las anteriores               |
| `distrito_enc`                |   1   | NO se calcula acá (ver nota de leakage)       |

## Nota de leakage (decisión de diseño)

1. **`distrito_enc` queda fuera a propósito.** El target encoding del distrito
   se ajusta con el precio, así que calcularlo sobre el dataset completo filtra
   información del target hacia validación. Se computa **por fold** en el script
   de entrenamiento, usando solo el train de cada fold.

2. **No se usa `geo_lookup`.** El KD-tree de `geo_index` interpola features
   geográficas desde los avisos vecinos; para un aviso que ya está en el índice,
   él mismo es su vecino a distancia 0 y domina la interpolación. Eso no filtra
   el precio (`IDW_COLS` no contiene el target ni nada derivado de él), pero sí
   produce features más limpias que las que recibe un usuario nuevo. Como el CSV
   ya trae esas columnas medidas directamente, se leen de ahí y el KD-tree no
   participa de la reconstrucción.

Uso:
    PYTHONPATH=app/backend app/backend/venv/bin/python scripts/build_dataset_v2.py
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from wasi.features.distrito_features import get_distrito_features
from wasi.features.osm_lookup import get_osm
from wasi.models.ml_v2 import CATEGORIA_LEVELS

CSV_LIMPIO = ROOT / "data" / "inmuebles_alquiler_clean.csv"
FEATURE_NAMES = ROOT / "models" / "v2" / "feature_names_v2.joblib"
LOG_FEATURES = ROOT / "models" / "v2" / "features_log_transformed_v2.joblib"
OUT_DIR = ROOT / "data" / "processed" / "v2"

# `distrito_enc` se ajusta por fold en el entrenamiento (ver nota de leakage).
EXCLUIDAS = {"distrito_enc"}

POI_TYPES = ["supermercados", "farmacias", "colegios", "bancos",
             "universidades", "parqueos", "hospitales"]


def _derivadas(df: pd.DataFrame) -> pd.DataFrame:
    """Features calculadas, con las mismas fórmulas que `ml_v2.build_features_v2`.

    Cualquier divergencia acá es train/serving skew directo, así que las
    fórmulas se mantienen carácter por carácter iguales a las de serving.
    """
    area = df["area_final_m2"].astype(float)
    dorm = df["dormitorios"].astype(float)
    banos = df["banos"].astype(float)
    antiguedad = df["antiguedad_anios"].astype(float)
    amen = df["amenities_count"].astype(float)

    df["area_por_dormitorio"] = area / dorm.clip(lower=1.0)
    df["ratio_area_banos"] = area / (banos + 1.0)
    df["area_x_amenities"] = area * amen
    df["antiguedad_sq"] = antiguedad ** 2
    df["total_poi_1km"] = sum(df[f"count_1km_{t}"].astype(float) for t in POI_TYPES)

    # es_zona_premium: cerca del mar Y cerca del centro (idéntico a ml_v2:112).
    df["es_zona_premium"] = (
        (df["dist_mar_km"].astype(float) < 4)
        & (df["dist_centro_km"].astype(float) < 12)
    ).astype(float)

    # es_estudio no viene del scraping: se deriva igual que lo valida el schema
    # de la API (un aviso sin dormitorios ni baños declarados es un estudio).
    df["es_estudio"] = ((dorm == 0) | (banos == 0)).astype(float)
    # cocheras_informadas: el serving asume que el usuario siempre informa el
    # dato (ml_v2:62 lo fija en 1.0), así que el dataset replica ese supuesto.
    df["cocheras_informadas"] = 1.0

    # OHE de las categóricas del CSV.
    fuente = df["fuente"].astype(str).str.lower()
    df["fuente_properati"] = (fuente == "properati").astype(float)
    df["fuente_urbania"] = (fuente == "urbania").astype(float)

    tipo = df["tipo_propiedad"].astype(str).str.strip().str.lower()
    df["tipo_propiedad_Departamento"] = (tipo == "departamento").astype(float)

    mism = df["mismatch_type"].astype(str).str.strip().str.lower()
    df["mismatch_type_frontera"] = (mism == "frontera").astype(float)
    df["mismatch_type_ninguno"] = (mism.isin(["ninguno", "nan", ""])).astype(float)

    return df


def _features_osm(df: pd.DataFrame) -> pd.DataFrame:
    """27 features OSM por aviso, con el mismo índice que usa el serving."""
    osm = get_osm()
    filas = [osm.lookup(float(la), float(lo))
             for la, lo in zip(df["latitud"], df["longitud"])]
    return pd.DataFrame(filas, index=df.index)


def _features_distrito(df: pd.DataFrame) -> pd.DataFrame:
    """NSE, categoría de distrito, comisarías y denuncias por bucket.

    `categoria_distrito` llega como string; el OHE lo hace el serving
    (`ml_v2:98-100`), así que acá se replica con los mismos niveles.
    """
    dfeat = get_distrito_features()
    filas = [dfeat.lookup(str(d)) for d in df["distrito_oficial"]]
    out = pd.DataFrame(filas, index=df.index)

    cat = out.pop("categoria_distrito")
    for lvl in CATEGORIA_LEVELS:
        out[f"cat_dist_{lvl}"] = (cat == lvl).astype(float)

    # `distrito_oficial` ya viene del CSV; no se duplica.
    out = out.drop(columns=["distrito_oficial"], errors="ignore")
    return out


def main() -> int:
    if not CSV_LIMPIO.exists():
        print(f"ERROR: falta {CSV_LIMPIO}")
        return 1

    df = pd.read_csv(CSV_LIMPIO)
    df = df[(df["precio_usd"] > 0) & (df["area_final_m2"] > 0)].reset_index(drop=True)
    print(f"[1/5] CSV limpio: {len(df)} avisos, {len(df.columns)} columnas")

    orden = [str(f) for f in joblib.load(FEATURE_NAMES)]
    log_feats = {str(f) for f in joblib.load(LOG_FEATURES)}
    print(f"      orden canónico del artefacto servido: {len(orden)} features")

    osm_df = _features_osm(df)
    print(f"[2/5] OSM: {osm_df.shape[1]} features desde data/external/*.json")

    dist_df = _features_distrito(df)
    print(f"[3/5] Distrito: {dist_df.shape[1]} features (NSE, comisarías, denuncias)")

    # Las columnas del CSV mandan: si OSM o distrito repiten un nombre que ya
    # viene medido en el aviso, se conserva el del CSV.
    nuevas_osm = osm_df.columns.difference(df.columns)
    nuevas_dist = dist_df.columns.difference(df.columns)
    df = pd.concat([df, osm_df[nuevas_osm], dist_df[nuevas_dist]], axis=1)

    df = _derivadas(df)
    print(f"[4/5] Derivadas y OHE aplicadas")

    objetivo = [f for f in orden if f not in EXCLUIDAS]
    faltan = [f for f in objetivo if f not in df.columns]
    if faltan:
        print(f"\nERROR: no se pudieron reconstruir {len(faltan)} features:")
        for f in faltan:
            print(f"  - {f}")
        return 1

    X = df[objetivo].copy()

    # log1p a las mismas features que el artefacto declara transformadas. Se
    # aplica al final, igual que en serving (ml_v2 paso 7).
    aplicadas = [f for f in objetivo if f in log_feats]
    for f in aplicadas:
        X[f] = np.log1p(X[f].astype(float).clip(lower=0))

    # Los NaN se CONSERVAN a propósito. Imputarlos acá obligaría a usar
    # estadísticos del dataset completo (mediana, p95), que es justo la fuga que
    # el README dice haber evitado. La imputación ocurre por fold en
    # `train_model_v2.py`, con estadísticos calculados solo sobre su train.
    por_col = X.isna().sum()
    nulos = int(por_col.sum())
    con_nan = por_col[por_col > 0]
    amenities_nan = int(con_nan[[c for c in con_nan.index
                                 if c.startswith("tiene_")]].sum())
    print(f"      NaN conservados: {nulos} en {len(con_nan)} columnas "
          f"({amenities_nan} de amenities no reportadas, "
          f"{nulos - amenities_nan} de campos estructurales)")

    y = np.log1p(df["precio_usd"].astype(float))
    # Celda espacial ~111 m: agrupa avisos del mismo bloque para que el
    # GroupKFold no parta un edificio entre train y test.
    celda = (df["latitud"].round(3).astype(str) + "_"
             + df["longitud"].round(3).astype(str))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    salida = X.copy()
    salida["__y_log"] = y
    salida["__distrito"] = df["distrito_oficial"].fillna("__NA__")
    salida["__celda"] = celda
    salida["__precio_usd"] = df["precio_usd"].astype(float)
    ruta = OUT_DIR / "dataset_v2.csv"
    salida.to_csv(ruta, index=False)

    digest = hashlib.sha256(ruta.read_bytes()).hexdigest()
    manifest = {
        "filas": int(len(salida)),
        "features": int(len(objetivo)),
        "features_excluidas": sorted(EXCLUIDAS),
        "log1p_aplicado_a": sorted(aplicadas),
        "nan_conservados": nulos,
        "nan_por_columna": {c: int(v) for c, v in con_nan.items()},
        "nota_imputacion": ("los NaN se imputan por fold en train_model_v2.py "
                            "(mediana agrupada / p95 de train), nunca con "
                            "estadísticos del dataset completo"),
        "celdas_espaciales": int(celda.nunique()),
        "fuente": str(CSV_LIMPIO.relative_to(ROOT)),
        "sha256_dataset": digest,
        "orden_canonico": orden,
    }
    (OUT_DIR / "manifest_dataset_v2.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False))

    print(f"[5/5] Guardado: {ruta.relative_to(ROOT)}")
    print(f"      {len(salida)} filas × {len(objetivo)} features "
          f"(+{len(EXCLUIDAS)} por fold en entrenamiento)")
    print(f"      celdas espaciales: {celda.nunique()} "
          f"(~{len(salida)/celda.nunique():.2f} avisos/celda)")
    print(f"      sha256: {digest[:16]}…")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

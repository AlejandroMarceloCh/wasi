"""
ml.py — Servicio de fair value (precio de referencia de alquiler).

  build_features      form + contexto geo → las 74 features del modelo.
  predict_fair_value  orquesta: geo_lookup → build_features → model_service
                      → veredicto (zona, factores, rango, confianza).

El modelo predice un PRECIO DE REFERENCIA de mercado (sobre precios de avisos
publicados), no un precio de cierre real.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

from geo_index import POI_TYPES, geo_lookup
from model_service import model_service

# Umbrales de confianza calibrados (Fase 0.5 — backtest LOO).
# scripts/calibrate_confidence.py los regenera.
_CONF_PATH = Path(__file__).resolve().parent / "confidence_thresholds.json"
try:
    _conf = json.loads(_CONF_PATH.read_text())
    CONF_ALTA_MIN = int(_conf["alta_min_comparables"])
    CONF_MEDIA_MIN = int(_conf["media_min_comparables"])
except Exception:                       # sin el archivo → defaults razonables
    CONF_ALTA_MIN, CONF_MEDIA_MIN = 119, 27

# ── Gate 3 — set UX-8 de amenities: clave del form → feature del modelo ──────
AMENITY_CHIPS: dict[str, str] = {
    "ascensor":       "tiene_ascensores",
    "seguridad":      "tiene_seguridad",
    "cocina":         "tiene_cocina",
    "amoblado":       "tiene_amueblado_a",
    "piscina":        "tiene_piscina",
    "terraza":        "tiene_terraza",
    "walk_in_closet": "tiene_walk_in_closet",
    "exteriores":     "tiene_exteriores",
}

# Banda ± para el veredicto "Justo". Más angosto que el MAE del modelo
# (~16 %): un precio dentro del 8 % del valor de referencia se considera justo.
ZONE_BAND_PCT = 8.0

# Métricas del modelo en test (informativas, van en PredictOut).
# v1 (RandomForest) vs v2 (XGBoost re-entrenado con features socio-eco).
if model_service.mode == "v2":
    MODEL_R2      = 0.861
    MODEL_MAE_USD = 158.0
    MODEL_MAE_PCT = 15.74
else:
    MODEL_R2      = 0.785
    MODEL_MAE_USD = 173.0
    MODEL_MAE_PCT = 15.9


# ── construcción de features ────────────────────────────────────────────────
def build_features(form: dict, geo: dict) -> pd.DataFrame:
    """form (PredictIn) + geo (geo_lookup) → DataFrame 1×74 en orden canónico.

    Orden de operaciones (replica el feature engineering de Leo):
      1. valores estructurales y geo en CRUDO,
      2. features derivadas en crudo,
      3. distrito → distrito_enc (target encoder, ya en espacio log),
      4. log1p a las 18 features marcadas,
      5. ensamblar en el orden de feature_order.
    """
    feats: dict[str, float] = {name: 0.0 for name in model_service.feature_order}

    # 1 — estructurales (crudo)
    area       = float(form["area"])
    dorm       = float(form["dormitorios"])
    banos      = float(form["banos"])
    cocheras   = float(form["cocheras"])
    antiguedad = float(form["antiguedad_anios"])

    feats["area_final_m2"]      = area
    feats["dormitorios"]        = dorm
    feats["banos"]              = banos
    feats["cocheras"]           = cocheras
    feats["antiguedad_anios"]   = antiguedad
    feats["es_estudio"]         = 1.0 if form.get("es_estudio") else 0.0
    feats["cocheras_informadas"] = 1.0          # el form siempre informa cocheras
    feats["latitud"]            = float(form["lat"])
    feats["longitud"]           = float(form["lng"])

    # amenities — 8 chips del Gate 3; las otras 29 quedan en 0
    seleccion = set(form.get("amenities", []))
    for chip, feat_name in AMENITY_CHIPS.items():
        if chip in seleccion:
            feats[feat_name] = 1.0
    amenities_count = float(sum(1 for c in AMENITY_CHIPS if c in seleccion))
    feats["amenities_count"] = amenities_count

    # geo (crudo, desde geo_lookup)
    feats["dist_mar_km"]        = float(geo["dist_mar_km"])
    feats["cantidad_denuncias"] = float(geo["cantidad_denuncias"])
    for t in POI_TYPES:
        feats[f"count_1km_{t}"]      = float(geo[f"count_1km_{t}"])
        feats[f"dist_nearest_m_{t}"] = float(geo[f"dist_nearest_m_{t}"])

    # distrito → distrito_enc (target encoder; valores ya en espacio log)
    enc = model_service.target_encoder
    feats["distrito_enc"] = float(
        enc["map"].get(geo["distrito"], enc["global_mean"]))

    # 2 — derivadas (crudo)
    feats["area_por_dormitorio"] = area / max(dorm, 1.0)
    feats["ratio_area_banos"]    = area / (banos + 1.0)
    feats["area_x_amenities"]    = area * amenities_count
    feats["antiguedad_sq"]       = antiguedad ** 2
    feats["total_poi_1km"]       = float(
        sum(geo[f"count_1km_{t}"] for t in POI_TYPES))

    # 3 — defaults OHE (un inmueble cargado por el usuario, no por un portal)
    feats["tipo_propiedad_Departamento"] = 1.0   # el form es para departamentos
    feats["mismatch_type_ninguno"]       = 1.0   # sin distrito de portal → sin mismatch
    # fuente_properati, fuente_urbania, mismatch_type_frontera → quedan en 0

    # 4 — log1p a las 18 features marcadas (sobre el valor crudo)
    for f in model_service.log_features:
        feats[f] = float(np.log1p(feats[f]))

    # 5 — ensamblar en orden canónico
    orden = model_service.feature_order
    return pd.DataFrame([[feats[name] for name in orden]], columns=orden)


# ── factores explicativos (importancias globales del RF) ────────────────────
def _factores(form: dict, geo: dict) -> list[dict]:
    """5 factores legibles, derivados de las importancias del RF."""
    area = float(form["area"])
    antiguedad = float(form["antiguedad_anios"])
    factores = [
        {"label": f"Área: {area:.0f} m²",
         "score": int(min(95, 45 + area / 4)),
         "positive": area >= 60},
        {"label": f"Ubicación: {geo['distrito']}",
         "score": int(min(95, max(40, geo['n_comparables'] / 6 + 45))),
         "positive": geo["fallback_reason"] is None},
        {"label": f"Antigüedad: {antiguedad:.0f} años",
         "score": int(max(40, 90 - antiguedad * 2)),
         "positive": antiguedad <= 15},
        {"label": f"Baños: {int(float(form['banos']))}",
         "score": int(min(90, 50 + float(form["banos"]) * 12)),
         "positive": float(form["banos"]) >= 2},
        {"label": f"Cocheras: {int(float(form['cocheras']))}",
         "score": 75 if float(form["cocheras"]) >= 1 else 55,
         "positive": float(form["cocheras"]) >= 1},
    ]
    return factores


def _confianza(geo: dict) -> str:
    """Confianza calibrada por densidad de comparables (backtest LOO).

    Umbrales de `confidence_thresholds.json`: el backtest mostró que la zona
    muy escasa tiene error netamente peor (~17 %/p75 30 %) frente al resto
    (~11 %/p75 19 %). Un fallback geográfico fuerza siempre "Baja".
    """
    if geo["fallback_reason"] is not None:
        return "Baja"
    n = geo["n_comparables"]
    if n >= CONF_ALTA_MIN:
        return "Alta"
    if n >= CONF_MEDIA_MIN:
        return "Media"
    return "Baja"


# ── orquestación ────────────────────────────────────────────────────────────
def predict_fair_value(form: dict) -> dict:
    """Pipeline completo: form → precio de referencia + veredicto.

    `form` debe traer: lat, lng, area, dormitorios, banos, es_estudio,
    cocheras, antiguedad_anios, amenities[], precio.
    Puede lanzar OutOfBoundsError (pin fuera de Lima) → el router lo mapea a 400.
    """
    t0 = time.perf_counter()

    geo = geo_lookup(float(form["lat"]), float(form["lng"]))
    # Ruteo según el modo del model_service (cargado en startup):
    # - v1: build_features (74 features RF)
    # - v2: build_features_v2 (95 features XGBoost con NSE/OSM/seguridad)
    if model_service.mode == "v2":
        from ml_v2 import build_features_v2
        X = build_features_v2(form, geo)
    else:
        X = build_features(form, geo)
    fair_value = round(model_service.predict(X), 2)

    precio = float(form["precio"])
    diff = round(precio - fair_value, 2)
    diff_pct = round((diff / fair_value * 100) if fair_value else 0.0, 2)
    if diff_pct < -ZONE_BAND_PCT:
        zone = "Ganga"
    elif diff_pct > ZONE_BAND_PCT:
        zone = "Inflado"
    else:
        zone = "Justo"

    delta = fair_value * (MODEL_MAE_PCT / 100)

    return {
        "fair_value": fair_value,
        "announced_price": precio,
        "diff": diff,
        "diff_pct": diff_pct,
        "zone": zone,
        "confidence": _confianza(geo),
        "n_comparables": geo["n_comparables"],
        "coverage_radius_km": geo["coverage_radius_km"],
        "model_r2": MODEL_R2,
        "model_mae": MODEL_MAE_USD,
        "mae_pct": MODEL_MAE_PCT,
        "min": round(fair_value - delta, 2),
        "max": round(fair_value + delta, 2),
        "factors": _factores(form, geo),
        "predicted_in_seconds": round(time.perf_counter() - t0, 3),
        "warnings": list(geo["warnings"]),
        "fallback_reason": geo["fallback_reason"],
        "version": model_service.version,
        "distrito": geo["distrito"],
    }

"""
ml_v2.py — build_features para el modelo v2 (101 features XGBoost).

Reusa `geo_lookup()` (POIs/denuncias originales + distrito) y agrega:
  - 21 features OSM (osm_lookup): 7 cats × (count_500m, count_1km, dist_nearest_m)
  - estrato_nse (1-5) + categoria_distrito OHE (3 cols)
  - n_comisarias_distrito + denuncias_violentas/patrimoniales/otras_distrito
  - total_poi_osm_1km derivado

Se llama desde ml.predict_fair_value() cuando model_service.mode == 'v2'.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from geo_index import POI_TYPES, geo_lookup
from model_service import model_service
from osm_lookup import OSM_CATEGORIES, get_osm
from distrito_features import get_distrito_features

# Mismas claves de amenities que v1 (consistencia con el form del frontend).
AMENITY_CHIPS = {
    "ascensor":       "tiene_ascensores",
    "seguridad":      "tiene_seguridad",
    "cocina":         "tiene_cocina",
    "amoblado":       "tiene_amueblado_a",
    "piscina":        "tiene_piscina",
    "terraza":        "tiene_terraza",
    "walk_in_closet": "tiene_walk_in_closet",
    "exteriores":     "tiene_exteriores",
}

CATEGORIA_LEVELS = ("emergente", "establecido", "popular")  # orden OHE


def build_features_v2(form: dict, geo: dict) -> pd.DataFrame:
    """form + geo → DataFrame 1×N_v2 en el orden de feature_names_v2.

    Sigue exactamente las mismas transformaciones de notebooks/07-08:
      1. Estructurales (crudo)
      2. POIs originales (geo_lookup) + denuncias agregada
      3. POIs OSM (osm_lookup) en 500m / 1km / dist_nearest
      4. Estrato NSE + categoría distrito + comisarías + denuncias por tipo
      5. Derivadas (ratio_area_banos, area_x_amenities, total_poi_1km, etc.)
      6. OHE defaults (tipo_propiedad_Departamento=1, etc.)
      7. log1p a las features con skew > 1
      8. Ensamblar en orden canónico (rellenar faltantes con 0)
    """
    feats: dict[str, float] = {name: 0.0 for name in model_service.feature_order}

    # 1 — estructurales
    area       = float(form["area"])
    dorm       = float(form["dormitorios"])
    banos      = float(form["banos"])
    cocheras   = float(form["cocheras"])
    antiguedad = float(form["antiguedad_anios"])

    _set(feats, "area_final_m2", area)
    _set(feats, "dormitorios", dorm)
    _set(feats, "banos", banos)
    _set(feats, "cocheras", cocheras)
    _set(feats, "antiguedad_anios", antiguedad)
    _set(feats, "es_estudio", 1.0 if form.get("es_estudio") else 0.0)
    _set(feats, "cocheras_informadas", 1.0)
    _set(feats, "latitud", float(form["lat"]))
    _set(feats, "longitud", float(form["lng"]))

    # amenities chips
    seleccion = set(form.get("amenities", []))
    for chip, fname in AMENITY_CHIPS.items():
        if chip in seleccion:
            _set(feats, fname, 1.0)
    amenities_count = float(sum(1 for c in AMENITY_CHIPS if c in seleccion))
    _set(feats, "amenities_count", amenities_count)

    # 2 — geo originales (de geo_lookup)
    _set(feats, "dist_mar_km", float(geo["dist_mar_km"]))
    _set(feats, "dist_centro_km", float(geo.get("dist_centro_km", 0.0)))
    # cantidad_denuncias original quedó eliminada del modelo v2 (corr < 0.05),
    # pero la asignamos por si feature_order la incluye en algún reentrenamiento.
    _set(feats, "cantidad_denuncias", float(geo.get("cantidad_denuncias", 0.0)))
    for t in POI_TYPES:
        _set(feats, f"count_1km_{t}", float(geo[f"count_1km_{t}"]))
        _set(feats, f"dist_nearest_m_{t}", float(geo[f"dist_nearest_m_{t}"]))

    # distrito_enc (smoothed target encoder)
    enc = model_service.target_encoder
    distrito = geo["distrito"]
    if hasattr(enc["map"], "get"):
        de = enc["map"].get(distrito, enc["global_mean"])
    else:
        de = enc["map"].get(distrito, enc["global_mean"]) if isinstance(enc["map"], dict) else enc["global_mean"]
    _set(feats, "distrito_enc", float(de))

    # 3 — POIs OSM
    osm = get_osm().lookup(float(form["lat"]), float(form["lng"]))
    for k, v in osm.items():
        _set(feats, k, float(v))
    # total derivado
    total_poi_osm = sum(osm[f"count_1km_osm_{c}"] for c in OSM_CATEGORIES)
    _set(feats, "total_poi_osm_1km", float(total_poi_osm))

    # 4 — estrato + categoría + comisarías + denuncias por tipo (de tabla manual)
    df_feat = get_distrito_features().lookup(distrito)
    _set(feats, "estrato_nse", float(df_feat["estrato_nse"]))
    cat = df_feat["categoria_distrito"]
    for lvl in CATEGORIA_LEVELS:
        _set(feats, f"cat_dist_{lvl}", 1.0 if cat == lvl else 0.0)
    _set(feats, "n_comisarias_distrito", float(df_feat.get("n_comisarias_distrito", 0)))
    _set(feats, "denuncias_violentas_distrito", float(df_feat.get("denuncias_violentas_distrito", 0)))
    _set(feats, "denuncias_patrimoniales_distrito", float(df_feat.get("denuncias_patrimoniales_distrito", 0)))
    _set(feats, "denuncias_otras_distrito", float(df_feat.get("denuncias_otras_distrito", 0)))

    # 5 — derivadas
    _set(feats, "area_por_dormitorio", area / max(dorm, 1.0))
    _set(feats, "ratio_area_banos", area / (banos + 1.0))
    _set(feats, "area_x_amenities", area * amenities_count)
    _set(feats, "antiguedad_sq", antiguedad ** 2)
    _set(feats, "total_poi_1km", float(sum(geo[f"count_1km_{t}"] for t in POI_TYPES)))
    # es_zona_premium: heurística de NB08 (cuartiles dist_mar + dist_centro)
    # Para inferencia individual: aproximamos con umbrales fijos de Lima.
    _set(feats, "es_zona_premium",
         1.0 if (float(geo["dist_mar_km"]) < 4 and float(geo.get("dist_centro_km", 99)) < 12) else 0.0)

    # 6 — defaults OHE
    _set(feats, "tipo_propiedad_Departamento", 1.0)
    _set(feats, "mismatch_type_ninguno", 1.0)

    # 7 — log1p
    for f in model_service.log_features:
        feats[f] = float(np.log1p(max(feats[f], 0)))

    # 8 — ensamblar en orden canónico
    orden = model_service.feature_order
    return pd.DataFrame([[feats[name] for name in orden]], columns=orden)


def _set(d: dict, k: str, v: float) -> None:
    """Setter silencioso: si la feature no está en el feature_order, no truena."""
    if k in d:
        d[k] = v

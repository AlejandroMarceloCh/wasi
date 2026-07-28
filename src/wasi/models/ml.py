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

from wasi.features.geo_index import POI_TYPES, geo_lookup
from wasi.models.model_service import model_service
from wasi.paths import CONFIDENCE_THRESHOLDS

_CONF_PATH = CONFIDENCE_THRESHOLDS
try:
    _conf = json.loads(_CONF_PATH.read_text())
    CONF_ALTA_MIN = int(_conf["alta_min_comparables"])
    CONF_MEDIA_MIN = int(_conf["media_min_comparables"])
except Exception:
    CONF_ALTA_MIN, CONF_MEDIA_MIN = 119, 27

TRAIN_PROXIMITY_KM = 0.05
_LEAK_WARNING = ("Este aviso forma parte de los datos con los que se entrenó el "
                 "modelo; el veredicto es referencial, no una validación independiente.")

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

_AMENITY_LABELS: dict[str, str] = {
    "ascensor":       "ascensor",
    "seguridad":      "seguridad",
    "cocina":         "cocina equipada",
    "amoblado":       "amoblado",
    "piscina":        "piscina",
    "terraza":        "terraza",
    "walk_in_closet": "walk-in closet",
    "exteriores":     "áreas exteriores",
}

ZONE_BAND_PCT = 8.0

# Métricas del esquema v2 medidas con GroupKFold espacial (5 folds, celda de
# ~111 m), con target encoding e imputación ajustados por fold. Reproducibles:
#   python scripts/build_dataset_v2.py && python scripts/train_model_v2.py
# El detalle fold por fold queda en data/processed/v2/metricas_v2.json.
#
# Antes acá había {r2: 0.847, mae_usd: 159.0, mae_pct: 16.4}: constantes
# heredadas del pipeline v2 original, cuyo dataset y script no estaban
# versionados. Al reconstruirlos y medir, el MAPE resultó fiel (16.4 → 16.16,
# se reportaba conservador) pero R² y MAE estaban optimistas: ningún
# experimento espacial los había verificado nunca.
_METRICS_V2 = {"r2": 0.816, "mae_usd": 168.0, "mae_pct": 16.2}
_METRICS_V1 = {"r2": 0.785, "mae_usd": 173.0, "mae_pct": 15.9}

def _model_metrics() -> dict:
    """Devuelve métricas del modo activo, evaluado en runtime (no en import)."""
    return _METRICS_V2 if model_service.mode == "v2" else _METRICS_V1

class _LazyMetric:
    def __init__(self, key: str):
        self._key = key
    def __get__(self, instance, owner):
        return _model_metrics()[self._key]
    def __float__(self):
        return float(_model_metrics()[self._key])
    def __repr__(self):
        return str(_model_metrics()[self._key])

def _r2() -> float:        return _model_metrics()["r2"]
def _mae_usd() -> float:   return _model_metrics()["mae_usd"]
def _mae_pct() -> float:   return _model_metrics()["mae_pct"]

def __getattr__(name: str):
    if name == "MODEL_R2":      return _r2()
    if name == "MODEL_MAE_USD": return _mae_usd()
    if name == "MODEL_MAE_PCT": return _mae_pct()
    raise AttributeError(f"module 'ml' has no attribute {name!r}")

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
    feats["cocheras_informadas"] = 1.0
    feats["latitud"]            = float(form["lat"])
    feats["longitud"]           = float(form["lng"])

    seleccion = set(form.get("amenities", []))
    for chip, feat_name in AMENITY_CHIPS.items():
        if chip in seleccion:
            feats[feat_name] = 1.0
    amenities_count = float(sum(1 for c in AMENITY_CHIPS if c in seleccion))
    feats["amenities_count"] = amenities_count

    feats["dist_mar_km"]        = float(geo["dist_mar_km"])
    feats["cantidad_denuncias"] = float(geo["cantidad_denuncias"])
    for t in POI_TYPES:
        feats[f"count_1km_{t}"]      = float(geo[f"count_1km_{t}"])
        feats[f"dist_nearest_m_{t}"] = float(geo[f"dist_nearest_m_{t}"])

    enc = model_service.target_encoder
    feats["distrito_enc"] = float(
        enc["map"].get(geo["distrito"], enc["global_mean"]))

    feats["area_por_dormitorio"] = area / max(dorm, 1.0)
    feats["ratio_area_banos"]    = area / (banos + 1.0)
    feats["area_x_amenities"]    = area * amenities_count
    feats["antiguedad_sq"]       = antiguedad ** 2
    feats["total_poi_1km"]       = float(
        sum(geo[f"count_1km_{t}"] for t in POI_TYPES))

    feats["tipo_propiedad_Departamento"] = 1.0
    feats["mismatch_type_ninguno"]       = 1.0

    for f in model_service.log_features:
        feats[f] = float(np.log1p(feats[f]))

    orden = model_service.feature_order
    return pd.DataFrame([[feats[name] for name in orden]], columns=orden)

GRUPO_META = {
    "Ubicación":              "Distrito, nivel socioeconómico, distancia al mar y al centro",
    "Tamaño y distribución":  "Área, dormitorios, baños y cocheras",
    "Antigüedad":             "Años de antigüedad del inmueble",
    "Amenidades":             "Ascensor, seguridad, piscina, acabados y demás equipamiento",
    "Seguridad":              "Denuncias y comisarías del distrito",
    "Servicios cercanos":     "Supermercados, colegios, bancos y otros POIs a 1 km",
    "Otros":                  "Factores técnicos (fuente del aviso, tipo de propiedad)",
}

def _grupo_de_feature(f: str) -> str:
    """Mapea una feature cruda del modelo a su grupo legible."""
    if "denuncias" in f or "comisarias" in f:
        return "Seguridad"
    if f.startswith("count_") or f.startswith("dist_nearest_m_") or f == "total_poi_1km":
        return "Servicios cercanos"
    if f.startswith("antiguedad"):
        return "Antigüedad"
    if (f in ("latitud", "longitud", "dist_mar_km", "dist_centro_km", "distrito_enc",
              "estrato_nse", "es_zona_premium") or f.startswith("cat_dist_")):
        return "Ubicación"
    if f in ("area_final_m2", "dormitorios", "banos", "cocheras", "area_por_dormitorio",
             "ratio_area_banos", "es_estudio", "cocheras_informadas", "area_x_amenities"):
        return "Tamaño y distribución"
    if f.startswith("tiene_") or f == "amenities_count":
        return "Amenidades"
    return "Otros"

_POI_NOMBRE = {
    "supermercados": "supermercado",
    "malls":         "centro comercial",
    "farmacias":     "farmacia",
    "colegios":      "colegio",
    "hospitales":    "hospital",
    "bancos":        "banco",
    "universidades": "universidad",
    "parqueos":      "estacionamiento",
    "parques":       "parque",
    "estaciones":    "estación de transporte",
}

_AMENIDAD_LABEL = {
    "tiene_ascensores":            "Ascensor",
    "tiene_seguridad":             "Seguridad / vigilancia",
    "tiene_piscina":               "Piscina",
    "tiene_acabados_de_lujo":      "Acabados de lujo",
    "tiene_amueblado_a":           "Amoblado",
    "tiene_terraza":               "Terraza",
    "tiene_jacuzzi":               "Jacuzzi",
    "tiene_vista_al_mar":          "Vista al mar",
    "tiene_vista_a_la_ciudad":     "Vista a la ciudad",
    "tiene_walk_in_closet":        "Walk-in closet",
    "tiene_centros_comerciales_cercanos": "Centros comerciales cerca",
    "tiene_cerca_a_parque_a_menos_de_2_cdras": "Parque a menos de 2 cuadras",
    "tiene_cuartos_de_servicio":   "Cuarto de servicio",
    "tiene_bano_de_servicio":      "Baño de servicio",
    "tiene_sistema_contra_incendios": "Sistema contra incendios",
    "tiene_caseta_de_guardia":     "Caseta de guardia",
    "tiene_portero_electrico":     "Portero eléctrico",
}

def _poi_keyword(f: str) -> str | None:
    """Detecta el tipo de POI dentro del nombre de la feature."""
    for kw in _POI_NOMBRE:
        if kw in f:
            return kw
    return None

def _driver_de_feature(f: str, valor: float, geo: dict, form: dict) -> tuple | None:
    """Resuelve una feature cruda a (driver_id, etiqueta, valor_str, orden_dist).

    Devuelve None si la feature es técnica/no presentable (se ignora del
    drill-down, pero su φ sigue contando en el total del grupo).
    `orden_dist` marca si menor valor es "mejor" (distancias) solo para elegir
    el valor representativo al fusionar; no afecta el signo del efecto.
    """

    kw = _poi_keyword(f)
    if kw is not None:
        nombre = _POI_NOMBRE[kw]
        if f.startswith("dist_nearest_m_"):
            m = float(valor)
            txt = f"a {m:.0f} m" if m < 1000 else f"a {m/1000:.1f} km"
            return (f"dist_{kw}", f"Cercanía a {nombre}", txt, m)
        if f.startswith("count_"):
            n = int(round(float(valor)))
            plural = nombre + ("s" if not nombre.endswith("l") else "es")
            return (f"count_{kw}", f"{plural.capitalize()} alrededor",
                    f"{n} a 1 km", -n)
        return None

    if f == "area_final_m2":
        return ("area", "Área", f"{float(valor):.0f} m²", float(valor))
    if f == "area_por_dormitorio":
        return ("area_dorm", "Espacio por dormitorio", f"{float(valor):.0f} m²/dorm", float(valor))
    if f == "dormitorios":
        return ("dorm", "Dormitorios", f"{int(round(float(valor)))}", float(valor))
    if f == "banos":
        return ("banos", "Baños", f"{int(round(float(valor)))}", float(valor))
    if f == "cocheras":
        return ("cocheras", "Cocheras", f"{int(round(float(valor)))}", float(valor))
    if f == "es_estudio" and float(valor) >= 0.5:
        return ("estudio", "Tipo estudio", "Sí", 0)

    if f in ("antiguedad_anios", "antiguedad_sq"):
        anios = float(form.get("antiguedad_anios", 0))
        return ("antiguedad", "Antigüedad", f"{anios:.0f} años", anios)

    if f == "distrito_enc":
        return ("distrito", "Distrito", str(geo.get("distrito", "—")), 0)
    if f == "estrato_nse":
        return ("nse", "Nivel socioeconómico del barrio", f"estrato {float(valor):.1f}", float(valor))
    if f == "dist_mar_km":
        return ("dist_mar", "Distancia al mar", f"{float(valor):.1f} km", float(valor))
    if f == "dist_centro_km":
        return ("dist_centro", "Distancia al centro", f"{float(valor):.1f} km", float(valor))
    if f == "es_zona_premium" and float(valor) >= 0.5:
        return ("premium", "Zona premium de Lima", "Sí", 0)
    if f.startswith("cat_dist_") and float(valor) >= 0.5:
        nivel = f.replace("cat_dist_", "")
        return ("cat_dist", "Categoría del distrito", nivel.capitalize(), 0)

    if f == "n_comisarias_distrito":
        return ("comisarias", "Comisarías en el distrito", f"{int(round(float(valor)))}", float(valor))
    if f == "denuncias_violentas_distrito":
        return ("den_viol", "Denuncias violentas (distrito)", f"{int(round(float(valor)))}", float(valor))
    if f == "denuncias_patrimoniales_distrito":
        return ("den_patr", "Denuncias patrimoniales (distrito)", f"{int(round(float(valor)))}", float(valor))

    if f.startswith("tiene_"):
        if float(valor) < 0.5:
            return None
        label = _AMENIDAD_LABEL.get(f) or f.replace("tiene_", "").replace("_", " ").capitalize()
        return (f, label, "Sí", 0)
    if f == "amenities_count":
        return ("amen_count", "Cantidad de amenidades", f"{int(round(float(valor)))}", float(valor))

    return None

def explain_fair_value(form: dict) -> dict:
    """Explicación SHAP de la predicción central (solo v2).

    Devuelve el precio base del modelo, el precio estimado y la contribución de
    cada grupo de features. Como el modelo predice en log, la atribución es
    aditiva en log-space (Σ contribuciones = log1p(precio) − base) y se traduce
    a un efecto MULTIPLICATIVO sobre el precio: factor_g = exp(Σφ del grupo).

    Matemática (validada): 1 + precio = exp(base) · Π exp(φ_i). Por eso el
    precio base se reporta como exp(base) − 1 y el % de cada grupo como
    (exp(Σφ_grupo) − 1)·100. Los efectos NO se suman entre grupos (son
    multiplicativos).
    """
    if model_service.mode != "v2":
        raise RuntimeError("explain_fair_value: solo disponible con el modelo v2")

    geo = geo_lookup(float(form["lat"]), float(form["lng"]))
    from wasi.models.ml_v2 import build_features_v2
    X = build_features_v2(form, geo)

    contribs, bias = model_service.shap_contributions(X)
    orden = model_service.feature_order

    log_feats = set(model_service.log_features)
    valores = {
        c: (float(np.expm1(X.iloc[0][c])) if c in log_feats else float(X.iloc[0][c]))
        for c in orden
    }

    por_grupo: dict[str, float] = {}

    drivers_por_grupo: dict[str, dict[str, dict]] = {}
    for nombre, phi in zip(orden, contribs):
        g = _grupo_de_feature(nombre)
        por_grupo[g] = por_grupo.get(g, 0.0) + phi

        d = _driver_de_feature(nombre, valores[nombre], geo, form)
        if d is None:
            continue
        driver_id, label, valor_str, orden_repr = d
        dg = drivers_por_grupo.setdefault(g, {})
        if driver_id in dg:
            dg[driver_id]["contribution_log"] += phi
        else:
            dg[driver_id] = {"label": label, "value": valor_str,
                             "contribution_log": phi, "_orden": orden_repr}

    total_log = bias + sum(contribs)
    base_price = float(np.expm1(bias))
    predicted_price = float(np.expm1(total_log))

    grupos = []
    for g, phi_g in por_grupo.items():

        factor = float(np.exp(phi_g))
        pct = (factor - 1.0) * 100.0

        ds = sorted(drivers_por_grupo.get(g, {}).values(),
                    key=lambda x: abs(x["contribution_log"]), reverse=True)
        drivers = [{
            "label": d["label"],
            "value": d["value"],
            "pct_effect": round((float(np.exp(d["contribution_log"])) - 1.0) * 100.0, 1),
            "positive": d["contribution_log"] >= 0,
        } for d in ds[:3] if abs(d["contribution_log"]) >= 0.002]
        grupos.append({
            "label": g,
            "description": GRUPO_META.get(g, ""),
            "contribution_log": round(phi_g, 6),
            "pct_effect": round(pct, 1),
            "positive": phi_g >= 0,
            "drivers": drivers,
        })

    grupos.sort(key=lambda x: abs(x["contribution_log"]), reverse=True)

    return {
        "base_price": round(base_price, 2),
        "predicted_price": round(predicted_price, 2),
        "groups": grupos,
        "distrito": geo["distrito"],
    }

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

def _es_proximo_a_training(geo: dict, from_catalog: bool) -> bool:
    """True si el veredicto es trivial por cercanía al set de entrenamiento.

    Dispara con el flag explícito del catálogo o cuando el pin cae casi encima
    de un listing real (dist_nearest_km < TRAIN_PROXIMITY_KM).
    """
    return bool(from_catalog) or geo.get("dist_nearest_km", 1e9) < TRAIN_PROXIMITY_KM

def _confianza(geo: dict, from_catalog: bool = False) -> str:
    """Confianza calibrada por densidad de comparables (backtest LOO).

    Umbrales de `confidence_thresholds.json`: el backtest mostró que la zona
    muy escasa tiene error netamente peor (~17 %/p75 30 %) frente al resto
    (~11 %/p75 19 %). Un fallback geográfico fuerza siempre "Baja". Un aviso
    pegado al training (catálogo o pin sobre un listing) también → "Baja", porque
    el "Justo" sería trivial (el modelo ya vio ese precio).
    """
    if geo["fallback_reason"] is not None:
        return "Baja"
    if _es_proximo_a_training(geo, from_catalog):
        return "Baja"
    n = geo["n_comparables"]
    if n >= CONF_ALTA_MIN:
        return "Alta"
    if n >= CONF_MEDIA_MIN:
        return "Media"
    return "Baja"

COUNTERFACTUAL_SPECS = [
    {"feature": "area",             "delta": 10,  "singular": "m²",                "plural": "m²",                 "min": 10, "max": 1000},
    {"feature": "dormitorios",      "delta": 1,   "singular": "dormitorio",        "plural": "dormitorios",         "min": 0,  "max": 20},
    {"feature": "banos",            "delta": 1,   "singular": "baño",              "plural": "baños",               "min": 1,  "max": 20},
    {"feature": "cocheras",         "delta": 1,   "singular": "cochera",           "plural": "cocheras",            "min": 0,  "max": 20},
    {"feature": "antiguedad_anios", "delta": 5,   "singular": "año de antigüedad", "plural": "años de antigüedad",  "min": 0,  "max": 100},
]

def _clamp_int(value: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, int(value)))

def _predict_perturbed(form: dict, geo: dict) -> float:
    """Re-predict para un form ya perturbado. Ruteo idéntico a predict_fair_value."""
    if model_service.mode == "v2":
        from wasi.models.ml_v2 import build_features_v2
        X = build_features_v2(form, geo)
    else:
        X = build_features(form, geo)
    return float(model_service.predict(X))

def compute_counterfactuals(form: dict, geo: dict, base_prediction: float) -> list[dict]:
    """Perturbación ±delta por feature accionable, devuelve top-N por |pct_change|.

    base_prediction = predicción del form original (sin perturbar). En Sprint 3.1
    cuando entre quantile, esto será P50. Antes, es el fair_value central.

    Deduplicación: si +delta y −delta de la misma feature ambos califican,
    se devuelve solo el de mayor |pct_change| para no mostrar dos veces la
    misma palanca al usuario.
    """
    if base_prediction <= 0:
        return []

    results = []
    es_estudio = bool(form.get("es_estudio", False))

    for spec in COUNTERFACTUAL_SPECS:
        feat = spec["feature"]
        delta = spec["delta"]
        current = int(form.get(feat, 0))

        for sign in (+1, -1):
            new_val = current + sign * delta

            lo = spec["min"]
            if feat == "banos" and not es_estudio:
                lo = max(lo, 1)
            new_val = _clamp_int(new_val, lo, spec["max"])

            if new_val == current:
                continue

            form_perturbed = {**form, feat: new_val}
            new_price = round(_predict_perturbed(form_perturbed, geo), 2)
            pct_change = round((new_price - base_prediction) / base_prediction * 100, 1)

            sign_label = "+" if sign > 0 else "−"
            qty = abs(sign * delta)

            name = spec["singular"] if qty == 1 else spec["plural"]
            results.append({
                "feature": feat,
                "label": f"{sign_label}{qty} {name}".strip(),
                "delta": sign * delta,
                "new_value": new_val,
                "new_price": new_price,
                "pct_change": pct_change,
            })

    best_per_feature: dict[str, dict] = {}
    for r in results:
        f = r["feature"]
        if f not in best_per_feature or abs(r["pct_change"]) > abs(best_per_feature[f]["pct_change"]):
            best_per_feature[f] = r
    deduped = list(best_per_feature.values())

    deduped.sort(key=lambda r: abs(r["pct_change"]), reverse=True)
    return deduped[:5]

_CF_NUM_SPECS = [
    ("area",              +15, 1000, "+15 m²"),
    ("cocheras",          +1,    3,  "Agregar 1 cochera"),
    ("banos",             +1,    4,  "Agregar 1 baño"),
    ("dormitorios",       +1,    5,  "Agregar 1 dormitorio"),
    ("antiguedad_anios",  -5,    0,  "Si fuera 5 años más nuevo"),
]
_CF_INFORMATIVE = {"antiguedad_anios"}
_CF_NOISE_PCT = 0.5

def _direction(delta: float) -> str:
    if delta > 0:
        return "sube"
    if delta < 0:
        return "baja"
    return "neutro"

def compute_counterfactuals_full(form: dict, geo: dict, base: float) -> list[dict]:
    """Palancas accionables (numéricas + amenities) re-servidas contra el modelo
    congelado. `geo` se calcula una vez fuera y se reusa (lat/lng fijos)."""
    if base <= 0:
        return []
    items = []
    es_estudio = bool(form.get("es_estudio", False))
    current_amen = list(form.get("amenities", []))

    for feat, delta, cap, label in _CF_NUM_SPECS:
        cur = int(form.get(feat, 0))
        new_val = cur + delta

        if delta > 0:
            new_val = min(new_val, cap)
        else:
            new_val = max(new_val, cap)
        if feat == "banos" and not es_estudio:
            new_val = max(new_val, 1)
        if new_val == cur:
            continue
        new_price = round(_predict_perturbed({**form, feat: new_val}, geo), 2)
        d = round(new_price - base, 2)
        dpct = round(d / base * 100, 1)
        if abs(dpct) < _CF_NOISE_PCT:
            continue
        items.append({
            "label": label, "feature": feat,
            "kind": "informativo" if feat in _CF_INFORMATIVE else "estructura",
            "delta": d, "delta_pct": dpct,
            "direction": _direction(d), "new_price": new_price,
        })

    _ = current_amen

    items.sort(key=lambda r: abs(r["delta"]), reverse=True)
    return items

def counterfactual_full(form: dict) -> dict:
    """Entry-point del endpoint. geo una vez; base = P50 si hay quantile, sino
    el predict central. Puede lanzar OutOfBoundsError (pin fuera de Lima)."""
    geo = geo_lookup(float(form["lat"]), float(form["lng"]))
    if model_service.mode == "v2":
        from wasi.models.ml_v2 import build_features_v2
        X = build_features_v2(form, geo)
    else:
        X = build_features(form, geo)
    base = round(model_service.predict(X), 2)
    pi = model_service.predict_interval(X) if model_service.has_quantile else None
    base = (pi or {}).get("p50") or base
    return {
        "base_fair_value": base,
        "distrito": geo["distrito"],
        "items": compute_counterfactuals_full(form, geo, base),
    }

def predict_fair_value(form: dict) -> dict:
    """Pipeline completo: form → precio de referencia + veredicto.

    `form` debe traer: lat, lng, area, dormitorios, banos, es_estudio,
    cocheras, antiguedad_anios, amenities[], precio.
    Puede lanzar OutOfBoundsError (pin fuera de Lima) → el router lo mapea a 400.
    """
    t0 = time.perf_counter()

    geo = geo_lookup(float(form["lat"]), float(form["lng"]))

    if model_service.mode == "v2":
        from wasi.models.ml_v2 import build_features_v2
        X = build_features_v2(form, geo)
    else:
        X = build_features(form, geo)
    fair_value = round(model_service.predict(X), 2)

    prediction_interval = model_service.predict_interval(X) if model_service.has_quantile else None

    precio = float(form["precio"])
    diff = round(precio - fair_value, 2)
    diff_pct = round((diff / fair_value * 100) if fair_value else 0.0, 2)
    if diff_pct < -ZONE_BAND_PCT:
        zone = "Ganga"
    elif diff_pct > ZONE_BAND_PCT:
        zone = "Inflado"
    else:
        zone = "Justo"

    mae_pct = _mae_pct()
    delta = fair_value * (mae_pct / 100)

    base_for_cf = (prediction_interval or {}).get("p50") or fair_value
    counterfactuals = compute_counterfactuals(form, geo, base_prediction=base_for_cf)

    from_catalog = bool(form.get("from_catalog", False))
    warnings = list(geo["warnings"])
    if _es_proximo_a_training(geo, from_catalog):
        warnings.append(_LEAK_WARNING)

    return {
        "fair_value": fair_value,
        "announced_price": precio,
        "diff": diff,
        "diff_pct": diff_pct,
        "zone": zone,
        "confidence": _confianza(geo, from_catalog),
        "n_comparables": geo["n_comparables"],
        "coverage_radius_km": geo["coverage_radius_km"],
        "model_r2": _r2(),
        "model_mae": _mae_usd(),
        "mae_pct": mae_pct,
        "min": round(fair_value - delta, 2),
        "max": round(fair_value + delta, 2),
        "factors": _factores(form, geo),
        "counterfactuals": counterfactuals,
        "prediction_interval": prediction_interval,
        "predicted_in_seconds": round(time.perf_counter() - t0, 3),
        "warnings": warnings,
        "fallback_reason": geo["fallback_reason"],
        "version": model_service.version,
        "distrito": geo["distrito"],

        "lat": float(form["lat"]),
        "lng": float(form["lng"]),
        "area": float(form.get("area", 0)) or None,
        "dormitorios": int(form.get("dormitorios", 0)),
    }

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

# Umbrales de confianza calibrados (Fase 0.5 — backtest LOO).
# scripts/calibrate_confidence.py los regenera.
_CONF_PATH = CONFIDENCE_THRESHOLDS
try:
    _conf = json.loads(_CONF_PATH.read_text())
    CONF_ALTA_MIN = int(_conf["alta_min_comparables"])
    CONF_MEDIA_MIN = int(_conf["media_min_comparables"])
except Exception:                       # sin el archivo → defaults razonables
    CONF_ALTA_MIN, CONF_MEDIA_MIN = 119, 27

# Umbral de proximidad al set de entrenamiento. Si el pin cae a <50 m de un
# listing real, el IDW (floor 10 m) hace que ese listing domine la interpolación
# → el modelo predice ~su propio precio → el veredicto "Justo" es trivial, no una
# validación independiente. Pasa siempre al analizar un aviso del catálogo (que
# se pobló con los mismos listings de training). Se marca confianza Baja + warning.
TRAIN_PROXIMITY_KM = 0.05
_LEAK_WARNING = ("Este aviso forma parte de los datos con los que se entrenó el "
                 "modelo; el veredicto es referencial, no una validación independiente.")

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

# Labels en español neutro para el contrafactual accionable. Mismas 8 keys de
# AMENITY_CHIPS / AMENIDADES del front. Se usan para armar "Agregar/Quitar <X>".
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

# Banda ± para el veredicto "Justo". Más angosto que el MAE del modelo
# (~16 %): un precio dentro del 8 % del valor de referencia se considera justo.
ZONE_BAND_PCT = 8.0

# Métricas del modelo en test (informativas, van en PredictOut).
# v1 (RandomForest) vs v2 (XGBoost re-entrenado con features socio-eco).
#
# Evaluación LAZY: ml.py se importa antes de que model_service.load() corra en
# el lifespan, así que el modo activo (v1/v2) recién se conoce en runtime.
# mae_pct = MAPE por validación espacial (GroupKFold 5-fold por coordenada,
# sin leakage de ubicación): 16.42% ± 0.59%. El split aleatorio da 15.74%, pero
# inflado: 35% de los inmuebles de test comparten coordenada con train.
# Ver pipeline/scripts/_audit_spatial_cv.py.
_METRICS_V2 = {"r2": 0.847, "mae_usd": 159.0, "mae_pct": 16.4}
_METRICS_V1 = {"r2": 0.785, "mae_usd": 173.0, "mae_pct": 15.9}


def _model_metrics() -> dict:
    """Devuelve métricas del modo activo, evaluado en runtime (no en import)."""
    return _METRICS_V2 if model_service.mode == "v2" else _METRICS_V1


# Accessors lazy — se evalúan al acceder, no al import. Compatibles con
# el resto del código que las usaba como constantes (ml.MODEL_R2, etc.).
class _LazyMetric:
    def __init__(self, key: str):
        self._key = key
    def __get__(self, instance, owner):
        return _model_metrics()[self._key]
    def __float__(self):
        return float(_model_metrics()[self._key])
    def __repr__(self):
        return str(_model_metrics()[self._key])


# Las accedemos como funciones helper para evitar magia descriptor:
def _r2() -> float:        return _model_metrics()["r2"]
def _mae_usd() -> float:   return _model_metrics()["mae_usd"]
def _mae_pct() -> float:   return _model_metrics()["mae_pct"]


# Compat shim: módulos externos (health.py) usan `ml.MODEL_R2` directo.
# Definimos `__getattr__` para que el lookup sea lazy.
def __getattr__(name: str):
    if name == "MODEL_R2":      return _r2()
    if name == "MODEL_MAE_USD": return _mae_usd()
    if name == "MODEL_MAE_PCT": return _mae_pct()
    raise AttributeError(f"module 'ml' has no attribute {name!r}")


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


# ── explainability SHAP (TreeSHAP nativo de XGBoost) ─────────────────────────
# Agrupa las 101 features en 7 grupos legibles. Cada feature cae en exactamente
# un grupo (cobertura verificada). El orden de chequeo importa: las reglas más
# específicas (denuncias, POIs) van antes que las genéricas.
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


# ── drivers concretos dentro de cada grupo ──────────────────────────────────
# El grupo dice "Servicios cercanos +6%"; el driver baja al QUÉ: "Cercanía a un
# supermercado (a 230 m) +4%". Cada feature cruda se resuelve a un driver
# semántico (driver_id) con etiqueta legible y el valor real de la propiedad.
# Varias features pueden colapsar en el mismo driver (ej. count_1km_osm_super_*
# + count_1km_supermercados → "Supermercados alrededor"): se suman sus φ.

# POIs: nombre legible (singular) por palabra clave en la feature.
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

# Amenidades: feature → etiqueta presentable (override; el resto se deriva del
# nombre quitando "tiene_" y reemplazando "_" por espacio).
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
    # — Servicios cercanos: POIs (distancia y densidad) —
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
        return None  # otros derivados de POI

    # — Tamaño y distribución —
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

    # — Antigüedad (lineal + cuadrático fusionados) —
    if f in ("antiguedad_anios", "antiguedad_sq"):
        anios = float(form.get("antiguedad_anios", 0))
        return ("antiguedad", "Antigüedad", f"{anios:.0f} años", anios)

    # — Ubicación —
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

    # — Seguridad —
    if f == "n_comisarias_distrito":
        return ("comisarias", "Comisarías en el distrito", f"{int(round(float(valor)))}", float(valor))
    if f == "denuncias_violentas_distrito":
        return ("den_viol", "Denuncias violentas (distrito)", f"{int(round(float(valor)))}", float(valor))
    if f == "denuncias_patrimoniales_distrito":
        return ("den_patr", "Denuncias patrimoniales (distrito)", f"{int(round(float(valor)))}", float(valor))

    # — Amenidades (solo las presentes) —
    if f.startswith("tiene_"):
        if float(valor) < 0.5:
            return None
        label = _AMENIDAD_LABEL.get(f) or f.replace("tiene_", "").replace("_", " ").capitalize()
        return (f, label, "Sí", 0)
    if f == "amenities_count":
        return ("amen_count", "Cantidad de amenidades", f"{int(round(float(valor)))}", float(valor))

    return None  # fuente_*, tipo_propiedad_*, mismatch_*, lat/long, ratios técnicos


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
    # Valor real por feature. Las log_features viajan como log1p(x) dentro de X;
    # se invierten para mostrar el valor físico ("85 m²", no "4.4").
    log_feats = set(model_service.log_features)
    valores = {
        c: (float(np.expm1(X.iloc[0][c])) if c in log_feats else float(X.iloc[0][c]))
        for c in orden
    }

    # Suma de contribuciones (log-space) por grupo + drivers concretos.
    por_grupo: dict[str, float] = {}
    # driver_id → {label, value, contribution_log, _orden}
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
            dg[driver_id]["contribution_log"] += phi  # fusiona φ del mismo driver
        else:
            dg[driver_id] = {"label": label, "value": valor_str,
                             "contribution_log": phi, "_orden": orden_repr}

    total_log = bias + sum(contribs)
    base_price = float(np.expm1(bias))
    predicted_price = float(np.expm1(total_log))

    grupos = []
    for g, phi_g in por_grupo.items():
        # Efecto multiplicativo puro (orden-independiente).
        factor = float(np.exp(phi_g))
        pct = (factor - 1.0) * 100.0
        # Top-3 drivers del grupo por |impacto|, con efecto individual.
        ds = sorted(drivers_por_grupo.get(g, {}).values(),
                    key=lambda x: abs(x["contribution_log"]), reverse=True)
        drivers = [{
            "label": d["label"],
            "value": d["value"],
            "pct_effect": round((float(np.exp(d["contribution_log"])) - 1.0) * 100.0, 1),
            "positive": d["contribution_log"] >= 0,
        } for d in ds[:3] if abs(d["contribution_log"]) >= 0.002]  # ~±0.2%
        grupos.append({
            "label": g,
            "description": GRUPO_META.get(g, ""),
            "contribution_log": round(phi_g, 6),  # aditivo: Σ = total_log - bias
            "pct_effect": round(pct, 1),
            "positive": phi_g >= 0,
            "drivers": drivers,
        })
    # Mayor impacto (|log|) primero.
    grupos.sort(key=lambda x: abs(x["contribution_log"]), reverse=True)

    return {
        "base_price": round(base_price, 2),
        "predicted_price": round(predicted_price, 2),
        "groups": grupos,
        "distrito": geo["distrito"],
    }


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


# ── orquestación ────────────────────────────────────────────────────────────
# ── Contrafactuales ligeros (Sprint 2.2) ─────────────────────────────────────
# "¿Qué pasaría si...?" — perturbamos 1 feature accionable a la vez ±delta,
# re-construimos el vector de features y re-predecimos. NO es DiCE (no busca
# contrafactuales óptimos); es una perturbación numérica simple que da al
# usuario una idea concreta de la sensibilidad del precio a cada característica.
#
# Rango y delta por feature (clamps al schema PredictIn):
#   area:              [10, 1000]   delta ±10 m²
#   dormitorios:       [0, 20]      delta ±1
#   banos:             [1, 20]      delta ±1  (0 solo si es_estudio=True)
#   cocheras:          [0, 20]      delta ±1
#   antiguedad_anios:  [0, 100]     delta ±5  (sensibilidad realista)
# Labels singular/plural explícitos para evitar agramaticalidad ("años de antigüedads").
# El label se elige según qty: 1 = singular, >1 = plural. Unit (m²) se agrega aparte.
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

            # Clamps con regla especial para baños: min=1 salvo es_estudio
            lo = spec["min"]
            if feat == "banos" and not es_estudio:
                lo = max(lo, 1)
            new_val = _clamp_int(new_val, lo, spec["max"])

            # Si tras clamp queda igual al original, no aporta información
            if new_val == current:
                continue

            form_perturbed = {**form, feat: new_val}
            new_price = round(_predict_perturbed(form_perturbed, geo), 2)
            pct_change = round((new_price - base_prediction) / base_prediction * 100, 1)

            sign_label = "+" if sign > 0 else "−"
            qty = abs(sign * delta)
            # Singular si qty=1, plural si qty>1
            name = spec["singular"] if qty == 1 else spec["plural"]
            results.append({
                "feature": feat,
                "label": f"{sign_label}{qty} {name}".strip(),
                "delta": sign * delta,
                "new_value": new_val,
                "new_price": new_price,
                "pct_change": pct_change,
            })

    # Deduplicar por feature: si ambos signos están, quedarse con el de mayor |%|
    best_per_feature: dict[str, dict] = {}
    for r in results:
        f = r["feature"]
        if f not in best_per_feature or abs(r["pct_change"]) > abs(best_per_feature[f]["pct_change"]):
            best_per_feature[f] = r
    deduped = list(best_per_feature.values())

    # Ordenar por |pct_change| desc, devolver top 5
    deduped.sort(key=lambda r: abs(r["pct_change"]), reverse=True)
    return deduped[:5]


# ── Contrafactuales accionables (endpoint dedicado /fairvalue/counterfactual) ─
# A diferencia de compute_counterfactuals (±delta numérico para el card de
# /predict), aquí se exploran palancas accionables COMPLETAS: variantes
# numéricas con límites PLAUSIBLES (no los del schema) + toggle de las 8
# amenities conocidas. Todo es re-serving del modelo congelado (mismo
# _predict_perturbed), cero re-entrenamiento. El modelo NO es monótono: un
# cambio "positivo" puede dar delta negativo -> se reporta tal cual (honestidad
# del dominio). geo se calcula UNA vez fuera y se reusa (lat/lng fijo en todas
# las variantes; la única diferencia es la palanca).
#
#   feature,           delta, cap_plausible, label
_CF_NUM_SPECS = [
    ("area",              +15, 1000, "+15 m²"),
    ("cocheras",          +1,    3,  "Agregar 1 cochera"),
    ("banos",             +1,    4,  "Agregar 1 baño"),
    ("dormitorios",       +1,    5,  "Agregar 1 dormitorio"),
    ("antiguedad_anios",  -5,    0,  "Si fuera 5 años más nuevo"),  # informativo
]
_CF_INFORMATIVE = {"antiguedad_anios"}
_CF_NOISE_PCT = 0.5   # |delta_pct| < 0.5% = ruido del árbol, se descarta


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

    # --- numéricas ---
    for feat, delta, cap, label in _CF_NUM_SPECS:
        cur = int(form.get(feat, 0))
        new_val = cur + delta
        # clamp realista: subir no pasa el cap; bajar (antigüedad) no baja del cap=0
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

    # --- amenities: NO se exponen como palanca (decisión 2026-06-30) ---
    # Las amenities pesan <1% del modelo (vs distrito 56%). Su señal real está
    # confundida con la ubicación (confounding): un depto con walk-in closet está
    # en San Isidro, y el modelo ya atribuye ese precio al distrito. Sin restricción
    # de monotonía, XGBoost puede dar delta NEGATIVO al agregar una amenity valiosa
    # (artefacto de peso bajo, no señal). Mostrar eso como palanca accionable
    # ("Agregar terraza −$30") destruye la credibilidad del simulador. Las amenities
    # SIGUEN alimentando la predicción base (build_features_v2 las usa); solo dejan
    # de ofrecerse como lever simulable. current_amen se conserva en el form base.
    _ = current_amen  # documentado: alimenta la base, no se togglea

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
    # Ruteo según el modo del model_service (cargado en startup):
    # - v1: build_features (74 features RF)
    # - v2: build_features_v2 (95 features XGBoost con NSE/OSM/seguridad)
    if model_service.mode == "v2":
        from wasi.models.ml_v2 import build_features_v2
        X = build_features_v2(form, geo)
    else:
        X = build_features(form, geo)
    fair_value = round(model_service.predict(X), 2)

    # Sprint 3.1: intervalo de predicción P25/P50/P75 (solo v2 con quantile
    # models cargados). El centro sigue siendo el modelo principal (no P50),
    # para no romper el contrato de fair_value.
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

    # Métricas resueltas en runtime según el modo activo del servicio.
    mae_pct = _mae_pct()
    delta = fair_value * (mae_pct / 100)

    # Contrafactuales (S2.2 + S3.1): la base es P50 del modelo de cuantiles
    # cuando está disponible, sino fair_value central. Esto asegura coherencia
    # — el usuario ve el contrafactual perturbado desde el mismo centro
    # estadístico que está mirando arriba en el card del rango.
    base_for_cf = (prediction_interval or {}).get("p50") or fair_value
    counterfactuals = compute_counterfactuals(form, geo, base_prediction=base_for_cf)

    # Leak local: aviso del catálogo o pin pegado a un listing de training. El
    # "Justo" sería trivial → confianza Baja + warning honesto (no toca el modelo).
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
        # Para pedir comparables (FR-03) sin re-ingresar el form.
        "lat": float(form["lat"]),
        "lng": float(form["lng"]),
        "area": float(form.get("area", 0)) or None,
        "dormitorios": int(form.get("dormitorios", 0)),
    }

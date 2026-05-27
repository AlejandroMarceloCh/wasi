"""Endpoint de Entorno — contexto del barrio para un pin (lat, lng).

Los datos (POIs, crimen) los sirve geo_index.py: para cualquier punto del
mapa devuelve el contexto interpolado. No hay tablas de POIs en la BD.
"""
from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from distrito_features import get_distrito_features
from geo_index import POI_TYPES, OutOfBoundsError, geo_lookup, scoring_entorno
from models import User
from schemas import EntornoOut, PoiContext

router = APIRouter(prefix="/api/entorno", tags=["entorno"])

# Presentación de cada tipo de POI.
POI_META = {
    "supermercados": ("Supermercados", "🛒"),
    "farmacias":     ("Farmacias", "💊"),
    "colegios":      ("Colegios", "🏫"),
    "hospitales":    ("Hospitales", "🏥"),
    "bancos":        ("Bancos", "🏦"),
    "universidades": ("Universidades", "🎓"),
    "parqueos":      ("Parqueos", "🅿️"),
}


def _level_for(score: int) -> str:
    if score >= 80:
        return "Excelente"
    if score >= 65:
        return "Bueno"
    if score >= 50:
        return "Regular"
    return "Riesgo"


def _clamp(v: float, lo: int, hi: int) -> int:
    return int(max(lo, min(hi, v)))


@router.get("", response_model=EntornoOut)
def entorno(
    lat: float = Query(..., description="Latitud del pin"),
    lng: float = Query(..., description="Longitud del pin"),
    current: User = Depends(get_current_user),
):
    try:
        geo = geo_lookup(lat, lng)
    except OutOfBoundsError:
        raise HTTPException(
            status_code=400,
            detail="Por ahora solo cubrimos Lima Metropolitana. Mueve el pin a un punto dentro de Lima e intenta de nuevo.",
        )

    # POIs por tipo
    total_poi = 0
    pois = []
    for kind in POI_TYPES:
        count = int(round(geo[f"count_1km_{kind}"]))
        total_poi += count
        label, emoji = POI_META[kind]
        pois.append(PoiContext(
            kind=kind, label=label, emoji=emoji,
            count_1km=count,
            dist_nearest_m=round(geo[f"dist_nearest_m_{kind}"], 1),
        ))

    denuncias = int(round(geo["cantidad_denuncias"]))
    security, services = scoring_entorno(geo["cantidad_denuncias"], float(total_poi))
    score = _clamp(round(0.5 * security + 0.5 * services), 0, 100)
    level = _level_for(score)

    warnings = list(geo["warnings"])
    if security < 55:
        warnings.append("Zona con número de denuncias por encima del promedio.")
    if services < 50:
        warnings.append("Pocos servicios (POIs) a 1 km de este punto.")

    summary = (
        f"Entorno {level.lower()} en {geo['distrito']}: {total_poi} POIs en 1 km, "
        f"{denuncias} denuncias registradas."
    )

    # Breakdown del score (Sprint 1.3) — n° comisarías del distrito + ratio
    # de denuncias del distrito vs promedio Lima. Usa data ya cargada por
    # DistritoFeatures, sin requests extra.
    df = get_distrito_features()
    n_comisarias = int(df.lookup(geo["distrito"]).get("n_comisarias_distrito", 0))
    denuncias_distrito = df.total_denuncias(geo["distrito"])
    lima_avg = df.lima_avg_denuncias or 1.0
    denuncias_vs_lima_pct = round(denuncias_distrito / lima_avg, 2)

    # Serenazgo — factor visual (Sprint 3.4). None si el distrito no tiene datos.
    serenazgo_data = df.serenazgo(geo["distrito"])

    # Sprint 3.6 — POIs premium del barrio (colegios top / clínicas premium / restaurantes
    # fine dining). Geocodificados via Nominatim, son features VISUALES para el usuario
    # (NO entran al modelo central porque la cobertura es muy chica). Si la categoría
    # devuelve 0 en 1km, se omite del response para no contaminar el UI.
    from osm_lookup import get_osm
    osm_feats = get_osm().lookup(lat, lng)
    premium_nearby = {}
    for cat, label in (
        ("colegios_top", "Colegios top"),
        ("clinicas_premium", "Clínicas premium"),
        ("restaurantes_premium", "Restaurantes fine dining"),
    ):
        count = int(osm_feats.get(f"count_1km_osm_{cat}", 0))
        dist_m = float(osm_feats.get(f"dist_nearest_m_osm_{cat}", 9999.0))
        if count > 0 or dist_m < 3000:
            premium_nearby[cat] = {
                "label": label,
                "count_1km": count,
                "dist_nearest_m": round(dist_m, 0) if dist_m < 9999 else None,
            }

    return EntornoOut(
        distrito=geo["distrito"],
        score=score, level=level, security=security, services=services,
        pois=pois,
        cantidad_denuncias=denuncias,
        dist_mar_km=round(geo["dist_mar_km"], 2),
        n_comparables=geo["n_comparables"],
        summary=summary,
        warnings=warnings,
        n_comisarias_distrito=n_comisarias,
        denuncias_distrito_total=denuncias_distrito,
        denuncias_vs_lima_pct=denuncias_vs_lima_pct,
        serenazgo=serenazgo_data,
        premium_nearby=premium_nearby or None,
    )

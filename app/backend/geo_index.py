"""
Índice espacial KD-tree + IDW haversine  ·  Fase 1 del PLAN.

Para un pin (lat, lng) nuevo, reconstruye las features geográficas que el
modelo necesita (POIs, denuncias, dist_mar) interpolando por distancia
inversa (IDW) desde los 3.348 listings del dataset.

  - cKDTree sobre coordenadas en esfera unitaria  → recupera vecinos
    (su orden coincide con el orden por distancia haversine).
  - Distancia haversine (geodésica, en metros) para los pesos IDW.
  - IDW normalizado con piso: w_i = (1/max(d_i, floor)) / Σ_j(1/max(d_j, floor)).
  - distrito = distrito_oficial del vecino más cercano (sin ponderar).
  - Fallbacks de baja densidad / sin cobertura.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

# --- bbox Lima Metropolitana ---------------------------------------------
# Aproximación conservadora (rectángulo, no polígono exacto). Envuelve el
# bbox real del dataset: lat [-12.39, -11.79], lng [-77.16, -76.77].
LAT_MIN, LAT_MAX = -12.5, -11.7
LNG_MIN, LNG_MAX = -77.2, -76.7

EARTH_RADIUS_M = 6_371_000.0

# Piso de distancia del peso IDW. DECISIÓN DE MODELO, no detalle técnico.
# El test de sensibilidad (100 pins a 5-15 m de listings reales) mostró:
#   floor 10 vs 50 m → mediana 0,7 %  pero  p95 16 % en el vector geo.
# El floor controla el campo cercano: con un pin casi encima de un listing,
# floor=10 m deja que ese listing domine la interpolación (sus POIs a 1 km
# son casi idénticos 10 m más allá → es la mejor estimación). Un floor alto
# sobre-suavizaría mezclando listings más lejanos. Se elige 10 m a propósito.
# Validación final sobre fair_value (no solo el vector geo): Fase 2.
IDW_FLOOR_M = 10.0
RADIO_COMPARABLES_KM = 1.0  # radio para contar n_comparables
RADIO_COBERTURA_KM = 5.0    # sin vecinos dentro de esto → fallback no_coverage
DENSIDAD_MINIMA = 3         # < N comparables en 1 km → fallback low_density

POI_TYPES = ["supermercados", "farmacias", "colegios", "hospitales",
             "bancos", "universidades", "parqueos"]

# Columnas geo que se interpolan por IDW.
IDW_COLS = (
    ["dist_mar_km", "cantidad_denuncias"]
    + [f"count_1km_{t}" for t in POI_TYPES]
    + [f"dist_nearest_m_{t}" for t in POI_TYPES]
)


class OutOfBoundsError(Exception):
    """El pin cae fuera del bbox de Lima Metropolitana → HTTP 400."""


def _to_unit_sphere(lat, lng) -> np.ndarray:
    """lat/lng en grados → coordenadas cartesianas en la esfera unitaria.

    La distancia euclidiana entre dos puntos de la esfera unitaria es
    monótona con la distancia haversine, así que el orden de vecinos del
    KD-tree coincide con el orden geodésico real.
    """
    lat_r = np.radians(np.asarray(lat, dtype=float))
    lng_r = np.radians(np.asarray(lng, dtype=float))
    return np.column_stack([
        np.cos(lat_r) * np.cos(lng_r),
        np.cos(lat_r) * np.sin(lng_r),
        np.sin(lat_r),
    ])


def _haversine_m(lat1, lng1, lat2, lng2):
    """Distancia haversine en metros. Acepta escalares o arrays en 2 y 3,4."""
    lat1, lng1 = np.radians(lat1), np.radians(lng1)
    lat2, lng2 = np.radians(lat2), np.radians(lng2)
    dlat, dlng = lat2 - lat1, lng2 - lng1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_M * np.arcsin(np.sqrt(a))


def in_bbox(lat: float, lng: float) -> bool:
    return LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX


class GeoIndex:
    """Índice espacial cargado una sola vez al startup del backend."""

    def __init__(self, csv_path: Path):
        self.df = pd.read_csv(csv_path).reset_index(drop=True)
        faltan = [c for c in (["latitud", "longitud", "distrito_oficial"] + IDW_COLS)
                  if c not in self.df.columns]
        if faltan:
            raise RuntimeError(f"geo_index.csv: faltan columnas {faltan}")
        self._lat = self.df["latitud"].to_numpy(dtype=float)
        self._lng = self.df["longitud"].to_numpy(dtype=float)
        self._geo = {c: self.df[c].to_numpy(dtype=float) for c in IDW_COLS}
        self._tree = cKDTree(_to_unit_sphere(self._lat, self._lng))
        # Medias por distrito y globales — fallback de baja densidad.
        self._dist_means = self.df.groupby("distrito_oficial")[IDW_COLS].mean()
        self._global_means = self.df[IDW_COLS].mean()
        self.n = len(self.df)
        # Arrays para percentile rank en scoring de entorno (O(log n) por lookup).
        poi_sum = sum(self.df[f"count_1km_{t}"].to_numpy(dtype=float) for t in POI_TYPES)
        self._sorted_denuncias = np.sort(self.df["cantidad_denuncias"].to_numpy(dtype=float))
        self._sorted_total_poi = np.sort(poi_sum)

    def lookup(self, lat: float, lng: float, k: int = 8,
               floor_m: float = IDW_FLOOR_M) -> dict:
        """Reconstruye las features geo para el pin (lat, lng).

        Devuelve un dict con las 16 columnas de IDW_COLS + lat/lng + distrito
        + metadata (n_comparables, coverage_radius_km, fallback_reason, warnings).
        Lanza OutOfBoundsError si el pin está fuera del bbox de Lima.
        """
        if not in_bbox(lat, lng):
            raise OutOfBoundsError(f"pin ({lat}, {lng}) fuera del bbox de Lima")

        k = min(k, self.n)
        _, idx = self._tree.query(_to_unit_sphere([lat], [lng]), k=k)
        idx = np.atleast_1d(idx).ravel()
        d_knn = _haversine_m(lat, lng, self._lat[idx], self._lng[idx])

        # distrito = vecino más cercano (sin ponderar)
        nearest = int(idx[int(np.argmin(d_knn))])
        distrito = str(self.df.iloc[nearest]["distrito_oficial"])

        # densidad / cobertura sobre todo el índice
        d_all = _haversine_m(lat, lng, self._lat, self._lng)
        n_comparables = int(np.sum(d_all <= RADIO_COMPARABLES_KM * 1000))
        dist_nearest_km = float(np.min(d_all) / 1000)
        coverage_radius_km = float(np.max(d_knn) / 1000)

        warnings: list[str] = []
        fallback_reason: str | None = None

        if dist_nearest_km > RADIO_COBERTURA_KM:
            fallback_reason = "no_coverage"
            warnings.append("Sin comparables dentro de 5 km; estimación de baja confianza.")
            geo = self._global_means
        elif n_comparables < DENSIDAD_MINIMA:
            fallback_reason = "low_density"
            warnings.append("Pocos comparables en 1 km; se usa el promedio del distrito.")
            geo = (self._dist_means.loc[distrito]
                   if distrito in self._dist_means.index else self._global_means)
        else:
            # IDW normalizado con piso de distancia
            w = 1.0 / np.maximum(d_knn, floor_m)
            w = w / w.sum()
            geo = pd.Series({c: float(np.dot(w, self._geo[c][idx])) for c in IDW_COLS})

        out: dict = {
            "latitud": float(lat),
            "longitud": float(lng),
            "distrito": distrito,
            "n_comparables": n_comparables,
            "coverage_radius_km": round(coverage_radius_km, 3),
            "dist_nearest_km": round(dist_nearest_km, 4),
            "fallback_reason": fallback_reason,
            "warnings": warnings,
        }
        for c in IDW_COLS:
            out[c] = float(geo[c])
        return out


    def _percentile_rank(self, sorted_arr: np.ndarray, val: float) -> float:
        """Fracción del dataset con valor ≤ val (0.0 → 1.0)."""
        return float(np.searchsorted(sorted_arr, val, side="right")) / len(sorted_arr)


# --- singleton ------------------------------------------------------------
_INDEX: GeoIndex | None = None


def get_index() -> GeoIndex:
    """Devuelve el índice (lo construye en la primera llamada)."""
    global _INDEX
    if _INDEX is None:
        _INDEX = GeoIndex(Path(__file__).resolve().parent / "data" / "geo_index.csv")
    return _INDEX


def geo_lookup(lat: float, lng: float, k: int = 8) -> dict:
    """Atajo: reconstruye las features geo para un pin."""
    return get_index().lookup(lat, lng, k=k)


def scoring_entorno(denuncias: float, total_poi: float) -> tuple[int, int]:
    """Devuelve (security, services) normalizados por percentile rank del dataset.

    security: 98 (pocas denuncias) → 20 (muchas). Rango [20, 98].
    services: 30 (pocos POIs) → 98 (muchos).     Rango [30, 98].
    """
    idx = get_index()
    pct_den = idx._percentile_rank(idx._sorted_denuncias, denuncias)
    pct_poi = idx._percentile_rank(idx._sorted_total_poi, total_poi)
    security = int(max(20, min(98, round(100 - pct_den * 80))))
    services = int(max(30, min(98, round(30 + pct_poi * 68))))
    return security, services

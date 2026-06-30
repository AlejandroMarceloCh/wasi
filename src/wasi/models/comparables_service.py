"""Avisos comparables reales para acompañar el Fair Value (FR-03).

Pedido por 2 expertos: "muéstrame contra qué avisos comparas". Sirve los avisos
reales del dataset que el modelo conoce, cercanos al pin y similares en tamaño,
para que el usuario vea la evidencia detrás del precio de referencia.

Fuente: `data/comparables.csv` (derivado de inmuebles_clean_v2.csv, 3.744 avisos).
Sin PII: solo distrito + características + precio + distancia, nunca dirección
exacta ni contacto. Carga una vez al startup (igual patrón que GeoIndex).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

from wasi.paths import DATA_DIR

_EARTH_M = 6_371_000.0

def _to_unit_sphere(lat, lng) -> np.ndarray:
    lat_r = np.radians(np.asarray(lat, dtype=float))
    lng_r = np.radians(np.asarray(lng, dtype=float))
    return np.column_stack([
        np.cos(lat_r) * np.cos(lng_r),
        np.cos(lat_r) * np.sin(lng_r),
        np.sin(lat_r),
    ])

def _haversine_m(lat1, lng1, lat2, lng2) -> np.ndarray:
    lat1, lng1, lat2, lng2 = map(np.radians, (lat1, lng1, lat2, lng2))
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlng / 2) ** 2
    return 2 * _EARTH_M * np.arcsin(np.sqrt(a))

class ComparablesService:
    """Índice espacial de avisos reales para mostrar comparables al usuario."""

    def __init__(self, csv_path: Path):
        self.df = pd.read_csv(csv_path).reset_index(drop=True)
        self._lat = self.df["lat"].to_numpy(dtype=float)
        self._lng = self.df["lng"].to_numpy(dtype=float)
        self._tree = cKDTree(_to_unit_sphere(self._lat, self._lng))
        self.n = len(self.df)

    def nearby(self, lat: float, lng: float, area: float | None = None,
               dormitorios: int | None = None, k: int = 6,
               pool: int = 60) -> list[dict]:
        """Top-k avisos cercanos, re-rankeados por similitud de tamaño.

        1. Recupera un pool de los `pool` vecinos geográficos más cercanos.
        2. Los re-rankea combinando distancia física + similitud de área y
           dormitorios (para no mostrar un loft al lado de una casa grande).
        3. Devuelve los k mejores con su distancia real en km.
        """
        if self.n == 0:
            return []
        kk = min(pool, self.n)
        _, idx = self._tree.query(_to_unit_sphere([lat], [lng]), k=kk)
        idx = np.atleast_1d(idx).ravel()
        dist_m = _haversine_m(lat, lng, self._lat[idx], self._lng[idx])

        rows = self.df.iloc[idx].copy()
        rows["_dist_km"] = dist_m / 1000.0

        score = rows["_dist_km"] / max(rows["_dist_km"].max(), 0.1)
        if area:
            score = score + (rows["area_m2"] - area).abs() / max(float(area), 1.0)
        if dormitorios is not None:
            score = score + (rows["dormitorios"] - dormitorios).abs() * 0.3
        rows["_score"] = score
        rows = rows.sort_values("_score").head(k)

        out: list[dict] = []
        for _, r in rows.iterrows():
            out.append({
                "distrito": str(r["distrito"]),
                "precio_usd": int(r["precio_usd"]),
                "area_m2": int(r["area_m2"]),
                "dormitorios": int(r["dormitorios"]),
                "banos": int(r["banos"]),
                "antiguedad_anios": int(r["antiguedad_anios"]),
                "lat": float(r["lat"]),
                "lng": float(r["lng"]),
                "distancia_km": round(float(r["_dist_km"]), 2),
            })
        return out

_SERVICE: ComparablesService | None = None

def get_comparables_service() -> ComparablesService:
    global _SERVICE
    if _SERVICE is None:
        _SERVICE = ComparablesService(
            DATA_DIR / "comparables.csv")
    return _SERVICE

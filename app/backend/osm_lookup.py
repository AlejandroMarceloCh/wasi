"""Helper para construir features de POIs OSM en runtime (v2).

Carga los 7 JSON de Overpass al iniciar el backend y construye un KD-tree
por categoría sobre la esfera unitaria. Para un (lat, lng) nuevo devuelve:
  - count_500m_osm_<cat>
  - count_1km_osm_<cat>
  - dist_nearest_m_osm_<cat>

Categorías: supermercados, malls, universidades, parques, farmacias, bancos,
estaciones. Mismo patrón que `geo_index.py` (KD-tree + haversine).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict

import numpy as np
from scipy.spatial import cKDTree

EARTH_M = 6_371_000.0

OSM_CATEGORIES = ['supermercados', 'malls', 'universidades', 'parques',
                  'farmacias', 'bancos', 'estaciones']

_DATA_DIR = Path(__file__).resolve().parent / "data" / "external"


def _to_unit_sphere(lat: np.ndarray, lng: np.ndarray) -> np.ndarray:
    lat_r, lng_r = np.radians(lat), np.radians(lng)
    return np.column_stack([
        np.cos(lat_r) * np.cos(lng_r),
        np.cos(lat_r) * np.sin(lng_r),
        np.sin(lat_r),
    ])


def _haversine_m(lat1, lng1, lat2, lng2):
    lat1, lng1 = np.radians(lat1), np.radians(lng1)
    lat2, lng2 = np.radians(lat2), np.radians(lng2)
    dlat, dlng = lat2 - lat1, lng2 - lng1
    a = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlng / 2) ** 2
    return 2 * EARTH_M * np.arcsin(np.sqrt(a))


def _load_category(path: Path) -> np.ndarray:
    """Lee un JSON Overpass y devuelve array (N, 2) de lat/lng."""
    if not path.exists():
        return np.empty((0, 2))
    data = json.loads(path.read_text())
    pts = []
    for el in data.get('elements', []):
        if 'lat' in el and 'lon' in el:
            pts.append((el['lat'], el['lon']))
        elif 'center' in el:
            pts.append((el['center']['lat'], el['center']['lon']))
    return np.array(pts) if pts else np.empty((0, 2))


class OSMIndex:
    """Singleton lazy: 7 KD-trees, uno por categoría."""

    def __init__(self):
        self._coords: Dict[str, np.ndarray] = {}
        self._trees: Dict[str, cKDTree] = {}
        for cat in OSM_CATEGORIES:
            coords = _load_category(_DATA_DIR / f"{cat}.json")
            self._coords[cat] = coords
            if len(coords) > 0:
                self._trees[cat] = cKDTree(_to_unit_sphere(coords[:, 0], coords[:, 1]))

    def lookup(self, lat: float, lng: float) -> Dict[str, float]:
        """Devuelve 21 features (7 categorías × 3 métricas) para un pin."""
        out: Dict[str, float] = {}
        listing_xyz = _to_unit_sphere(np.array([lat]), np.array([lng]))
        for cat in OSM_CATEGORIES:
            coords = self._coords[cat]
            if len(coords) == 0:
                out[f"count_500m_osm_{cat}"]      = 0
                out[f"count_1km_osm_{cat}"]       = 0
                out[f"dist_nearest_m_osm_{cat}"]  = 9999.0
                continue
            tree = self._trees[cat]
            k = min(50, len(coords))
            _, idx = tree.query(listing_xyz, k=k)
            idx = np.atleast_1d(idx).ravel()
            d_m = _haversine_m(lat, lng, coords[idx, 0], coords[idx, 1])
            out[f"count_500m_osm_{cat}"]     = int((d_m <= 500).sum())
            out[f"count_1km_osm_{cat}"]      = int((d_m <= 1000).sum())
            out[f"dist_nearest_m_osm_{cat}"] = float(d_m.min())
        return out


_INDEX: OSMIndex | None = None


def get_osm() -> OSMIndex:
    global _INDEX
    if _INDEX is None:
        _INDEX = OSMIndex()
    return _INDEX

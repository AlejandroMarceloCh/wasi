"""Lookup de POIs SOLO para el display de Entorno (no entra al modelo).

Resuelve dos problemas de calidad de dato del display:
  1. geo_index.csv capa los conteos en 60 (1 de cada 4 puntos clavado en 60).
  2. "supermercados" mezclaba supermercados reales con tiendas de conveniencia
     (Tambo/Mass/Oxxo) y bodegas, inflando el número.

Usa data fresca de Overpass (scripts/fetch_display_pois.py), donde OSM ya separa
shop=supermarket de shop=convenience. Para cada pin devuelve, por categoría:
count_500m, count_1km y dist_nearest_m. Mismo patrón KD-tree + haversine que
osm_lookup.py / geo_index.py.

El modelo no usa este módulo: sus features salen de osm_lookup.py +
geo_index.py (congelados para mantener consistencia train/serve).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
from scipy.spatial import cKDTree

from wasi.paths import EXTERNAL_DATA_DIR

EARTH_M = 6_371_000.0

_BASE = EXTERNAL_DATA_DIR
_DISPLAY = _BASE / "display"

CATEGORIES: Dict[str, Tuple[Path, str]] = {
    "supermercados": (_DISPLAY / "supermercados.json", "Supermercados"),
    "conveniencia":  (_DISPLAY / "conveniencia.json",  "Tiendas de conveniencia"),
    "farmacias":     (_BASE / "farmacias.json",        "Farmacias"),
    "colegios":      (_DISPLAY / "colegios.json",      "Colegios"),
    "hospitales":    (_DISPLAY / "hospitales.json",    "Hospitales"),
    "bancos":        (_BASE / "bancos.json",           "Bancos"),
    "universidades": (_BASE / "universidades.json",    "Universidades"),
    "parqueos":      (_DISPLAY / "parqueos.json",      "Parqueos"),
}

DISPLAY_ORDER = list(CATEGORIES.keys())

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

def _load_coords(path: Path) -> np.ndarray:
    """Lee un JSON Overpass → array (N, 2) de lat/lng (usa center para ways/relations)."""
    if not path.exists():
        return np.empty((0, 2))
    data = json.loads(path.read_text())
    pts: List[Tuple[float, float]] = []
    for el in data.get("elements", []):
        if "lat" in el and "lon" in el:
            pts.append((el["lat"], el["lon"]))
        elif "center" in el:
            pts.append((el["center"]["lat"], el["center"]["lon"]))
    return np.array(pts) if pts else np.empty((0, 2))

class DisplayPOIIndex:
    """Singleton lazy: un KD-tree por categoría de display."""

    def __init__(self) -> None:
        self._coords: Dict[str, np.ndarray] = {}
        self._trees: Dict[str, cKDTree] = {}
        for cat, (path, _label) in CATEGORIES.items():
            coords = _load_coords(path)
            self._coords[cat] = coords
            if len(coords) > 0:
                self._trees[cat] = cKDTree(_to_unit_sphere(coords[:, 0], coords[:, 1]))

    def lookup(self, lat: float, lng: float) -> List[dict]:
        """Devuelve, por categoría (en DISPLAY_ORDER): count_500m, count_1km, dist_nearest_m.

        Usa búsqueda por radio (query_ball_point) para que el conteo sea exacto
        aunque haya cientos de POIs en 1 km (no hay cap como en geo_index).
        """
        pin_xyz = _to_unit_sphere(np.array([lat]), np.array([lng]))[0]

        r_chord = 2.0 * np.sin((1100.0 / EARTH_M) / 2.0)
        out: List[dict] = []
        for cat in DISPLAY_ORDER:
            _path, label = CATEGORIES[cat]
            coords = self._coords[cat]
            if len(coords) == 0:
                out.append({"kind": cat, "label": label,
                            "count_500m": 0, "count_1km": 0, "dist_nearest_m": None})
                continue
            tree = self._trees[cat]
            idx = tree.query_ball_point(pin_xyz, r=r_chord)
            if idx:
                d_m = _haversine_m(lat, lng, coords[idx, 0], coords[idx, 1])
                d_in1k = d_m[d_m <= 1000]
                out.append({
                    "kind": cat, "label": label,
                    "count_500m": int((d_m <= 500).sum()),
                    "count_1km": int(len(d_in1k)),
                    "dist_nearest_m": round(float(d_m.min()), 1),
                })
            else:

                _, j = tree.query(pin_xyz, k=1)
                dn = float(_haversine_m(lat, lng, coords[int(j), 0], coords[int(j), 1]))
                out.append({"kind": cat, "label": label,
                            "count_500m": 0, "count_1km": 0, "dist_nearest_m": round(dn, 1)})
        return out

    def points(self, lat: float, lng: float, radius_m: float = 1000.0,
               cap: int = 400) -> List[dict]:
        """POIs individuales dentro de `radius_m`, por categoría — para pintarlos
        en el mapa. Devuelve [{kind, label, points: [[lat,lng], ...]}]. `cap`
        limita por categoría para no mandar payloads enormes."""
        pin_xyz = _to_unit_sphere(np.array([lat]), np.array([lng]))[0]
        r_chord = 2.0 * np.sin((radius_m * 1.05 / EARTH_M) / 2.0)
        out: List[dict] = []
        for cat in DISPLAY_ORDER:
            _path, label = CATEGORIES[cat]
            coords = self._coords[cat]
            pts: List[List[float]] = []
            if len(coords) > 0:
                idx = self._trees[cat].query_ball_point(pin_xyz, r=r_chord)
                if idx:
                    idx = np.asarray(idx)
                    d_m = _haversine_m(lat, lng, coords[idx, 0], coords[idx, 1])
                    sel = idx[d_m <= radius_m]
                    for k in sel[:cap]:
                        pts.append([round(float(coords[k, 0]), 6),
                                    round(float(coords[k, 1]), 6)])
            out.append({"kind": cat, "label": label, "points": pts})
        return out

_INDEX: DisplayPOIIndex | None = None

def get_display_pois() -> DisplayPOIIndex:
    global _INDEX
    if _INDEX is None:
        _INDEX = DisplayPOIIndex()
    return _INDEX

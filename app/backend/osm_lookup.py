"""Helper para construir features de POIs OSM en runtime (v2).

Carga los 7 JSON de Overpass al iniciar el backend y construye un KD-tree
por categoría sobre la esfera unitaria. Para un (lat, lng) nuevo devuelve:
  - count_500m_osm_<cat>
  - count_1km_osm_<cat>
  - dist_nearest_m_osm_<cat>

Categorías: supermercados, malls, universidades, parques, farmacias, bancos,
estaciones. Mismo patrón que `geo_index.py` (KD-tree + haversine).

A partir de Sprint 3.2 se agregan 6 features adicionales por tier de calidad
(Wong vs Plaza Vea, BCP vs banco chico, Inkafarma vs farmacia barrial) sin
tocar las 21 originales — son AGREGADAS, no reemplazan.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
from scipy.spatial import cKDTree

EARTH_M = 6_371_000.0

OSM_CATEGORIES = ['supermercados', 'malls', 'universidades', 'parques',
                  'farmacias', 'bancos', 'estaciones']

# Regex de tier por categoría. Casos sin match caen a "other" (no genera feature).
# Diseñados con \b o anchors para evitar falsos positivos (Ej: "Banco de la Nación"
# no debería matchear "BCP"). Insensitive a may/min.
_TIER_REGEX: Dict[str, Dict[str, re.Pattern]] = {
    'supermercados': {
        'premium': re.compile(r'\b(wong|vivanda|cencosud\s*express|la\s*bonbonniere)\b', re.I),
        'mass':    re.compile(r'\b(plaza\s*vea|tottus|metro|mass|tambo)\b', re.I),
    },
    'bancos': {
        'premium': re.compile(r'\b(bcp|bbva|interbank|scotiabank|banbif|citibank|santander)\b', re.I),
        'mass':    re.compile(r'\b(banco\s+de\s+la\s+naci[oó]n|mibanco|banco\s+pichincha|banco\s+azteca|banco\s+ripley|banco\s+falabella|caja\s+(huancayo|piura|arequipa|trujillo|sullana|cusco|ica|tacna|paita|metropolitana|maynas)|edpyme)\b', re.I),
    },
    'farmacias': {
        # cadena_grande = cadenas nacionales con > ~30 sucursales en el dataset
        'cadena':  re.compile(r'\b(inkafarma|mifarma|mi\s*farma|boticas\s+y\s+salud|boticas\s+per[uú]|arcangel|nova\s*farma|inka\s*farma)\b', re.I),
        # 'indep' es el resto (no se calcula con regex, se calcula como total - cadena).
    },
}

# Categorías que admiten tier breakdown. Las que no están acá no generan features extra.
_TIERED_CATEGORIES = list(_TIER_REGEX.keys())

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


def _load_category(path: Path) -> Tuple[np.ndarray, List[str]]:
    """Lee un JSON Overpass y devuelve (array (N, 2) lat/lng, lista de N nombres).

    Nombre vacío si el POI no tiene `tags.name`.
    """
    if not path.exists():
        return np.empty((0, 2)), []
    data = json.loads(path.read_text())
    pts, names = [], []
    for el in data.get('elements', []):
        if 'lat' in el and 'lon' in el:
            pts.append((el['lat'], el['lon']))
        elif 'center' in el:
            pts.append((el['center']['lat'], el['center']['lon']))
        else:
            continue
        names.append((el.get('tags') or {}).get('name', '') or '')
    return (np.array(pts), names) if pts else (np.empty((0, 2)), [])


def _classify_tier(category: str, names: List[str]) -> Dict[str, np.ndarray]:
    """Para una categoría tiered, devuelve {tier_name: bool_mask sobre todos los POIs}.

    Cada mask es 1D bool de tamaño len(names). Para `farmacias` solo se calcula
    `cadena`; el `indep` se infiere por complemento en `lookup()`.
    """
    if category not in _TIER_REGEX:
        return {}
    tiers: Dict[str, np.ndarray] = {}
    for tier_name, pattern in _TIER_REGEX[category].items():
        tiers[tier_name] = np.array([bool(pattern.search(n)) for n in names])
    return tiers


class OSMIndex:
    """Singleton lazy: 7 KD-trees, uno por categoría.

    Mantiene además los nombres de cada POI y máscaras por tier para 3
    categorías (supermercados, bancos, farmacias) para emitir 6 features
    adicionales de calidad (Sprint 3.2).
    """

    def __init__(self):
        self._coords: Dict[str, np.ndarray] = {}
        self._names:  Dict[str, List[str]]  = {}
        self._tier_masks: Dict[str, Dict[str, np.ndarray]] = {}
        self._trees:  Dict[str, cKDTree] = {}
        for cat in OSM_CATEGORIES:
            coords, names = _load_category(_DATA_DIR / f"{cat}.json")
            self._coords[cat] = coords
            self._names[cat] = names
            if len(coords) > 0:
                self._trees[cat] = cKDTree(_to_unit_sphere(coords[:, 0], coords[:, 1]))
                self._tier_masks[cat] = _classify_tier(cat, names)

    def lookup(self, lat: float, lng: float) -> Dict[str, float]:
        """Devuelve 21 features OSM base + 6 tier features = 27 features.

        Base (21): count_500m_osm_<cat>, count_1km_osm_<cat>, dist_nearest_m_osm_<cat>
                   para las 7 categorías.
        Tier (6):  count_1km_osm_supermercados_premium / _mass
                   count_1km_osm_bancos_premium / _mass
                   count_1km_osm_farmacias_cadena / _indep
        """
        out: Dict[str, float] = {}
        listing_xyz = _to_unit_sphere(np.array([lat]), np.array([lng]))
        for cat in OSM_CATEGORIES:
            coords = self._coords[cat]
            if len(coords) == 0:
                out[f"count_500m_osm_{cat}"]      = 0
                out[f"count_1km_osm_{cat}"]       = 0
                out[f"dist_nearest_m_osm_{cat}"]  = 9999.0
                if cat in _TIERED_CATEGORIES:
                    if cat == 'farmacias':
                        out[f"count_1km_osm_{cat}_cadena"] = 0
                        out[f"count_1km_osm_{cat}_indep"]  = 0
                    else:
                        out[f"count_1km_osm_{cat}_premium"] = 0
                        out[f"count_1km_osm_{cat}_mass"]    = 0
                continue

            tree = self._trees[cat]
            k = min(50, len(coords))
            _, idx = tree.query(listing_xyz, k=k)
            idx = np.atleast_1d(idx).ravel()
            d_m = _haversine_m(lat, lng, coords[idx, 0], coords[idx, 1])
            in_1km = d_m <= 1000
            out[f"count_500m_osm_{cat}"]     = int((d_m <= 500).sum())
            out[f"count_1km_osm_{cat}"]      = int(in_1km.sum())
            out[f"dist_nearest_m_osm_{cat}"] = float(d_m.min())

            if cat in _TIERED_CATEGORIES:
                masks = self._tier_masks.get(cat, {})
                # idx son índices globales en coords; in_1km es bool sobre esos vecinos.
                neighbor_global_idx = idx[in_1km]
                if cat == 'farmacias':
                    cadena_mask = masks.get('cadena', np.zeros(len(coords), dtype=bool))
                    n_cadena = int(cadena_mask[neighbor_global_idx].sum())
                    n_total  = int(in_1km.sum())
                    out[f"count_1km_osm_{cat}_cadena"] = n_cadena
                    out[f"count_1km_osm_{cat}_indep"]  = n_total - n_cadena
                else:
                    premium_mask = masks.get('premium', np.zeros(len(coords), dtype=bool))
                    mass_mask    = masks.get('mass',    np.zeros(len(coords), dtype=bool))
                    out[f"count_1km_osm_{cat}_premium"] = int(premium_mask[neighbor_global_idx].sum())
                    out[f"count_1km_osm_{cat}_mass"]    = int(mass_mask[neighbor_global_idx].sum())
        return out


_INDEX: OSMIndex | None = None


def get_osm() -> OSMIndex:
    global _INDEX
    if _INDEX is None:
        _INDEX = OSMIndex()
    return _INDEX

"""Tests del índice geográfico (Fase 1)."""
import math

import pytest

from geo_index import OutOfBoundsError, geo_lookup


def test_zona_densa():
    r = geo_lookup(-12.121, -77.030)            # Miraflores
    assert r["distrito"] == "Miraflores"
    assert r["n_comparables"] > 50
    assert r["fallback_reason"] is None


def test_zona_escasa_dispara_fallback():
    r = geo_lookup(-12.380, -76.790)            # borde sur, pocos listings
    assert r["fallback_reason"] in ("low_density", "no_coverage")
    assert r["warnings"]


def test_fuera_de_bbox():
    with pytest.raises(OutOfBoundsError):
        geo_lookup(-13.5, -77.0)


def test_sin_nan():
    r = geo_lookup(-12.10, -77.04)
    for k, v in r.items():
        if isinstance(v, float):
            assert not math.isnan(v), f"{k} es NaN"

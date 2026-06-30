"""Sprint 1 — leak local del FairValue (avisos del catálogo / pin sobre training).

El catálogo se pobló con los mismos listings de entrenamiento. Analizar el precio
de uno de ellos da un "Justo" trivial (el modelo ya vio ese precio). No es leak de
métricas (el MAPE es GroupKFold espacial honesto) — es un artefacto local de esa
vista. El fix baja la confianza a "Baja" y agrega un warning. Estos tests lo blindan.
"""
import pandas as pd
import pytest

from wasi.features.geo_index import get_index
from wasi.models.ml import _LEAK_WARNING, TRAIN_PROXIMITY_KM, predict_fair_value
from wasi.models.model_service import model_service


@pytest.fixture(scope="module", autouse=True)
def _load():
    if not model_service.is_loaded:
        model_service.load()


def _form(**kw):
    d = dict(lat=-12.121, lng=-77.030, area=85, dormitorios=2, banos=2,
             cocheras=1, antiguedad_anios=6, es_estudio=False,
             amenities=["ascensor", "seguridad"], precio=1200)
    d.update(kw)
    return d


def _listing_coords():
    """Coordenadas exactas de un listing real del índice (= set de training)."""
    idx = get_index()
    row = idx.df.iloc[0]
    return float(row["latitud"]), float(row["longitud"])


def test_from_catalog_baja_confianza_y_warning():
    """flag explícito del catálogo → confianza Baja + warning de leak."""
    res = predict_fair_value(_form(from_catalog=True))
    assert res["confidence"] == "Baja"
    assert _LEAK_WARNING in res["warnings"]


def test_pin_sobre_listing_dispara_aunque_no_haya_flag():
    """Pin pegado a un listing real (< 50 m) → Baja + warning, sin from_catalog.

    Cubre el caso en que el usuario, sin saberlo, ubica el pin justo encima de un
    aviso del dataset: el IDW colapsa a ese listing y el veredicto sería trivial.
    """
    lat, lng = _listing_coords()
    res = predict_fair_value(_form(lat=lat, lng=lng, from_catalog=False))
    assert res["confidence"] == "Baja"
    assert _LEAK_WARNING in res["warnings"]


# Pin de control: lejos de cualquier listing (>50 m) y SIN fallback geográfico,
# para aislar el efecto del leak de otras razones que fuerzan "Baja". Verificado:
# dist_nearest_km≈0.233 km, fallback_reason=None.
_PIN_LEJANO = dict(lat=-12.30, lng=-76.85)


def test_pin_manual_lejano_no_marca_leak():
    """Control: un pin manual lejos de cualquier listing NO lleva el warning de leak."""
    geo = get_index().lookup(**_PIN_LEJANO)
    # Pre-condición del fixture: el punto debe estar realmente lejos y sin fallback,
    # si no, el test no estaría aislando el leak (falla ruidosa, no falso-verde).
    assert geo["dist_nearest_km"] >= TRAIN_PROXIMITY_KM
    assert geo["fallback_reason"] is None

    res = predict_fair_value(_form(from_catalog=False, **_PIN_LEJANO))
    assert _LEAK_WARNING not in res["warnings"]

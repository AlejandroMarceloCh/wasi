"""Tests de build_features y predict_fair_value (Fase 2 / Fase 7)."""
import pytest

from geo_index import OutOfBoundsError
from ml import AMENITY_CHIPS, build_features, predict_fair_value
from model_service import model_service


@pytest.fixture(scope="module", autouse=True)
def _load():
    """Garantiza el modelo cargado para todo el módulo."""
    if not model_service.is_loaded:
        model_service.load()


def _form(**kw):
    d = dict(lat=-12.121, lng=-77.030, area=85, dormitorios=2, banos=2,
             cocheras=1, antiguedad_anios=6, es_estudio=False,
             amenities=["ascensor", "seguridad"], precio=1200)
    d.update(kw)
    return d


def _geo():
    from geo_index import geo_lookup
    return geo_lookup(-12.121, -77.030)


def test_build_features_shape():
    """build_features (v1, 74) sigue funcionando aunque el modo activo sea v2.

    Importante: build_features apunta al model_service global; en modo v2 ese
    feature_order tiene ~95 features y build_features lo respeta (rellena 0).
    El test verifica que la forma coincide con el feature_order activo.
    """
    X = build_features(_form(), _geo())
    assert X.shape[0] == 1
    assert X.shape[1] == len(model_service.feature_order)
    assert list(X.columns) == model_service.feature_order


def test_predict_fair_value_v2_shape():
    """En modo v2, predict_fair_value usa build_features_v2 (95 features)."""
    if model_service.mode != "v2":
        pytest.skip("v2 no activo")
    from ml_v2 import build_features_v2
    X = build_features_v2(_form(), _geo())
    assert X.shape[0] == 1
    assert X.shape[1] >= 80
    assert "estrato_nse" in X.columns
    assert "n_comisarias_distrito" in X.columns
    assert not X.isnull().any().any()


def test_build_features_sin_nan():
    X = build_features(_form(), _geo())
    assert not X.isnull().any().any()


def test_build_features_amenities_mapean():
    X = build_features(_form(amenities=["piscina"]), _geo())
    assert X["tiene_piscina"].iloc[0] == 1.0
    assert X["tiene_ascensores"].iloc[0] == 0.0
    # amenities_count = cantidad de chips seleccionados
    assert X["amenities_count"].iloc[0] == 1.0


def test_predict_fair_value_keys_y_rango():
    r = predict_fair_value(_form())
    for k in ("fair_value", "zone", "confidence", "factors",
              "n_comparables", "warnings", "version", "distrito"):
        assert k in r
    assert 200 <= r["fair_value"] <= 10000
    assert r["zone"] in ("Ganga", "Justo", "Inflado")
    assert len(r["factors"]) == 5


def test_predict_zone_inflado_y_ganga():
    fair = predict_fair_value(_form(precio=1000))["fair_value"]
    assert predict_fair_value(_form(precio=fair * 2))["zone"] == "Inflado"
    assert predict_fair_value(_form(precio=fair * 0.5))["zone"] == "Ganga"


def test_predict_fuera_de_bbox_lanza():
    with pytest.raises(OutOfBoundsError):
        predict_fair_value(_form(lat=-13.6, lng=-77.0))


def test_es_estudio_se_propaga():
    X = build_features(_form(es_estudio=True, dormitorios=0, banos=1), _geo())
    assert X["es_estudio"].iloc[0] == 1.0

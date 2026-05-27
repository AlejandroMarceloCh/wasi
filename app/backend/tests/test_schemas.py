"""Tests de validación del contrato PredictIn (rangos + regla es_estudio)."""
import pytest
from pydantic import ValidationError

from schemas import PredictIn


def _base(**kw):
    d = dict(lat=-12.1, lng=-77.0, area=80, dormitorios=2, banos=2,
             es_estudio=False, cocheras=1, antiguedad_anios=5,
             amenities=[], precio=1000)
    d.update(kw)
    return d


def test_predict_in_valido():
    p = PredictIn(**_base())
    assert p.area == 80 and p.banos == 2


def test_area_fuera_de_rango():
    with pytest.raises(ValidationError):
        PredictIn(**_base(area=5))        # < 10
    with pytest.raises(ValidationError):
        PredictIn(**_base(area=2000))     # > 1000


def test_banos_cero_sin_estudio_falla():
    with pytest.raises(ValidationError):
        PredictIn(**_base(banos=0, es_estudio=False))


def test_banos_cero_con_estudio_ok():
    p = PredictIn(**_base(banos=0, es_estudio=True))
    assert p.banos == 0 and p.es_estudio is True


def test_antiguedad_y_precio_fuera_de_rango():
    with pytest.raises(ValidationError):
        PredictIn(**_base(antiguedad_anios=200))
    with pytest.raises(ValidationError):
        PredictIn(**_base(precio=0))

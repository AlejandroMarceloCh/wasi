"""Tests de validación del contrato PredictIn (rangos + regla es_estudio)."""
import pytest
from pydantic import ValidationError

from schemas import CounterfactualIn, PredictIn

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
        PredictIn(**_base(area=5))
    with pytest.raises(ValidationError):
        PredictIn(**_base(area=2000))

def test_banos_cero_sin_estudio_falla():
    with pytest.raises(ValidationError):
        PredictIn(**_base(banos=0, es_estudio=False))

def test_banos_cero_con_estudio_ok():
    p = PredictIn(**_base(banos=0, es_estudio=True))
    assert p.banos == 0 and p.es_estudio is True

def test_dormitorios_cero_sin_estudio_falla():
    """P-07: un inmueble no-estudio no puede tener 0 dormitorios."""
    with pytest.raises(ValidationError):
        PredictIn(**_base(dormitorios=0, es_estudio=False))

def test_dormitorios_cero_con_estudio_ok():
    """Un estudio/monoambiente sí puede tener 0 dormitorios."""
    p = PredictIn(**_base(dormitorios=0, banos=1, es_estudio=True))
    assert p.dormitorios == 0 and p.es_estudio is True

def test_counterfactual_dormitorios_cero_sin_estudio_falla():
    d = _base(dormitorios=0, es_estudio=False)
    d.pop("precio")
    with pytest.raises(ValidationError):
        CounterfactualIn(**d)

def test_antiguedad_cero_es_valida():
    """Antigüedad 0 = inmueble a estrenar. NO se prohíbe (desviación del plan,
    que pedía min=1; la fuente real solo objetaba dormitorios=0)."""
    p = PredictIn(**_base(antiguedad_anios=0))
    assert p.antiguedad_anios == 0

def test_antiguedad_y_precio_fuera_de_rango():
    with pytest.raises(ValidationError):
        PredictIn(**_base(antiguedad_anios=200))
    with pytest.raises(ValidationError):
        PredictIn(**_base(precio=0))

"""Tests del endpoint de precio de VENTA (modelo independiente de alquiler).

El modelo de venta se carga en el lifespan (al entrar al TestClient). Si el
.joblib no esta presente, el endpoint devuelve 503 y el test se salta en runtime.
"""
import pytest

def _form(**kw):
    d = dict(lat=-12.1215, lng=-77.0305, area=100, dormitorios=3, banos=2,
             cocheras=1, antiguedad_anios=5, precio=250000)
    d.update(kw)
    return d

def _venta(client, headers, **kw):
    r = client.post("/api/fairvalue/predict-venta", headers=headers, json=_form(**kw))
    if r.status_code == 503:
        pytest.skip("modelo de venta no cargado en este entorno")
    return r

def test_predict_venta_ok(client, auth_headers):
    r = _venta(client, auth_headers)
    assert r.status_code == 200
    d = r.json()
    assert d["fair_value"] > 0
    assert d["zone"] in ("Ganga", "Justo", "Inflado")
    assert d["distrito"]
    assert d["min"] < d["fair_value"] < d["max"]
    assert d["version"] == "venta-v1"

def test_predict_venta_inflado(client, auth_headers):
    r = _venta(client, auth_headers, precio=3_000_000)
    assert r.json()["zone"] == "Inflado"

def test_predict_venta_ganga(client, auth_headers):
    r = _venta(client, auth_headers, precio=40_000)
    assert r.json()["zone"] == "Ganga"

def test_predict_venta_fuera_bbox(client, auth_headers):
    r = client.post("/api/fairvalue/predict-venta", headers=auth_headers,
                    json=_form(lat=0.0, lng=0.0))
    if r.status_code == 503:
        pytest.skip("modelo de venta no cargado")
    assert r.status_code == 400

def test_predict_venta_sin_token(client):
    r = client.post("/api/fairvalue/predict-venta", json=_form())
    assert r.status_code == 401

def test_predict_venta_no_toca_alquiler(client, auth_headers):
    """El endpoint de alquiler sigue intacto tras agregar venta."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json={
        "lat": -12.1215, "lng": -77.0305, "area": 80, "dormitorios": 2,
        "banos": 2, "es_estudio": False, "cocheras": 1, "antiguedad_anios": 5,
        "amenities": ["ascensor"], "precio": 1200})
    assert r.status_code == 200
    assert r.json()["fair_value"] > 0

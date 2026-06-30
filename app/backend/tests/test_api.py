"""Tests de los endpoints (Fase 3): happy path, errores 400/422/401, entorno."""

def _payload(**kw):
    d = dict(lat=-12.121, lng=-77.030, area=90, dormitorios=2, banos=2,
             es_estudio=False, cocheras=1, antiguedad_anios=8,
             amenities=["ascensor", "seguridad"], precio=1400)
    d.update(kw)
    return d

def test_predict_happy_path(client, auth_headers):
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    assert r.status_code == 200
    d = r.json()
    assert d["zone"] in ("Ganga", "Justo", "Inflado")
    assert d["confidence"] in ("Alta", "Media", "Baja")
    assert d["fair_value"] > 0
    assert len(d["factors"]) == 5
    assert d["distrito"] == "Miraflores"
    assert d["version"]

def test_explain_shap_additividad(client, auth_headers):
    """El endpoint SHAP devuelve atribución real y reconstruye la predicción.

    Como el modelo predice en log, debe cumplirse:
    1 + predicted_price = (1 + base_price) · Π exp(contribution_log_grupo).
    Además predicted_price == fair_value del mismo análisis.
    """
    import math

    pred = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    assert pred.status_code == 200
    aid = pred.json()["analysis_id"]
    fair_value = pred.json()["fair_value"]

    r = client.get(f"/api/fairvalue/explain/{aid}", headers=auth_headers)
    assert r.status_code == 200
    d = r.json()
    assert d["groups"], "debe haber grupos de explicación"

    assert abs(d["predicted_price"] - fair_value) <= 1.0

    recon = (1 + d["base_price"]) * math.prod(
        math.exp(g["contribution_log"]) for g in d["groups"])
    assert abs(recon - (1 + d["predicted_price"])) <= 1.0

def test_explain_analisis_inexistente_404(client, auth_headers):
    r = client.get("/api/fairvalue/explain/999999", headers=auth_headers)
    assert r.status_code == 404

def test_predict_pin_fuera_de_lima_400(client, auth_headers):
    r = client.post("/api/fairvalue/predict", headers=auth_headers,
                    json=_payload(lat=-13.5, lng=-77.0))
    assert r.status_code == 400

def test_predict_area_invalida_422(client, auth_headers):
    r = client.post("/api/fairvalue/predict", headers=auth_headers,
                    json=_payload(area=5))
    assert r.status_code == 422

def test_predict_sin_token_401(client):
    r = client.post("/api/fairvalue/predict", json=_payload())
    assert r.status_code == 401

def test_predict_zona_escasa_devuelve_fallback(client, auth_headers):
    """En zona sin comparables: 200 + fallback_reason + warnings poblados."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers,
                    json=_payload(lat=-12.380, lng=-76.790))
    assert r.status_code == 200
    d = r.json()
    assert d["fallback_reason"] in ("low_density", "no_coverage")
    assert d["warnings"]

def test_entorno_por_pin(client, auth_headers):
    r = client.get("/api/entorno", headers=auth_headers,
                   params={"lat": -12.121, "lng": -77.030})
    assert r.status_code == 200
    d = r.json()
    assert d["distrito"] == "Miraflores"

    kinds = {p["kind"] for p in d["pois"]}
    assert {"supermercados", "conveniencia"} <= kinds
    assert len(d["pois"]) == 8

    for p in d["pois"]:
        assert "count_500m" in p and "count_1km" in p

    por_kind = {p["kind"]: p for p in d["pois"]}
    assert por_kind["conveniencia"]["count_1km"] >= por_kind["supermercados"]["count_1km"]
    assert 0 <= d["score"] <= 100

def test_entorno_pois_puntos_para_el_mapa(client, auth_headers):
    """El endpoint de puntos devuelve POIs individuales [lat,lng] por categoría
    para pintarlos en el mapa (zona densa = Miraflores)."""
    r = client.get("/api/entorno/pois", headers=auth_headers,
                   params={"lat": -12.121, "lng": -77.030})
    assert r.status_code == 200
    layers = r.json()["layers"]
    kinds = {l["kind"] for l in layers}
    assert {"supermercados", "conveniencia"} <= kinds
    for l in layers:
        for p in l["points"]:
            assert len(p) == 2
    assert sum(len(l["points"]) for l in layers) > 0

def test_entorno_breakdown_score_campos(client, auth_headers):
    """Sprint 1.3 backend: EntornoOut expone n_comisarias_distrito,
    denuncias_distrito_total y denuncias_vs_lima_pct para el breakdown UI.
    Verificamos presencia + tipo + rangos sensatos."""
    r = client.get("/api/entorno", headers=auth_headers,
                   params={"lat": -12.121, "lng": -77.030})
    assert r.status_code == 200
    d = r.json()

    assert "n_comisarias_distrito" in d
    assert "denuncias_distrito_total" in d
    assert "denuncias_vs_lima_pct" in d

    assert isinstance(d["n_comisarias_distrito"], int)
    assert isinstance(d["denuncias_distrito_total"], int)
    assert isinstance(d["denuncias_vs_lima_pct"], (int, float))

    assert d["n_comisarias_distrito"] >= 0
    assert d["denuncias_distrito_total"] >= 0
    assert d["denuncias_vs_lima_pct"] >= 0

    assert d["n_comisarias_distrito"] > 0
    assert d["denuncias_distrito_total"] > 0
    assert d["denuncias_vs_lima_pct"] > 0

def test_entorno_400_mensaje_amable(client, auth_headers):
    """El detail del 400 debe ser copy amable, sin jerga de 'bbox'."""

    r = client.get("/api/entorno", headers=auth_headers,
                   params={"lat": -13.531, "lng": -71.967})
    assert r.status_code == 400
    detail = r.json().get("detail", "")
    assert "Lima Metropolitana" in detail
    assert "bbox" not in detail

def test_entorno_summary_sin_km_del_mar(client, auth_headers):
    """El summary de entorno no debe mencionar 'a X km del mar'."""
    r = client.get("/api/entorno", headers=auth_headers,
                   params={"lat": -12.121, "lng": -77.030})
    assert r.status_code == 200
    summary = r.json()["summary"]
    assert "del mar" not in summary.lower()
    assert "km del mar" not in summary.lower()

"""Test de integración end-to-end con el usuario demo (Fase 7)."""


def _payload(**kw):
    d = dict(lat=-12.121, lng=-77.030, area=90, dormitorios=2, banos=2,
             es_estudio=False, cocheras=1, antiguedad_anios=8,
             amenities=["ascensor", "seguridad"], precio=1300)
    d.update(kw)
    return d


def test_flujo_completo(client, auth_headers):
    """predict → getAnalysis → save report → entorno → dashboard."""
    # 1 — predecir
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    assert r.status_code == 200
    aid = r.json()["analysis_id"]

    # 2 — releer el análisis
    r = client.get(f"/api/analyses/{aid}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["analysis_id"] == aid

    # 3 — guardar reporte
    r = client.post(f"/api/analyses/{aid}/save", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["report_id"] > 0

    # 4 — entorno del mismo pin
    r = client.get("/api/entorno", headers=auth_headers,
                   params={"lat": -12.121, "lng": -77.030})
    assert r.status_code == 200

    # 5 — dashboard refleja el análisis
    r = client.get("/api/dashboard", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["stats"]["analyses_count"] >= 1


def test_login_demo(client):
    """El usuario demo sembrado funciona."""
    r = client.post("/api/auth/login",
                    json={"email": "ana@wasi.pe", "password": "demo1234"})
    assert r.status_code == 200
    assert r.json()["token"]


# ── casos límite ────────────────────────────────────────────────────────
def test_borde_pin_en_el_mar(client, auth_headers):
    """Pin sobre el mar (dentro del bbox, sin comparables) → 200 + fallback."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers,
                    json=_payload(lat=-12.20, lng=-77.18))
    assert r.status_code == 200
    assert r.json()["fallback_reason"] in ("low_density", "no_coverage")


def test_borde_area_minima_422(client, auth_headers):
    r = client.post("/api/fairvalue/predict", headers=auth_headers,
                    json=_payload(area=5))
    assert r.status_code == 422


def test_borde_banos_cero_sin_estudio_422(client, auth_headers):
    r = client.post("/api/fairvalue/predict", headers=auth_headers,
                    json=_payload(banos=0, es_estudio=False))
    assert r.status_code == 422


def test_borde_estudio_banos_cero_ok(client, auth_headers):
    r = client.post("/api/fairvalue/predict", headers=auth_headers,
                    json=_payload(banos=0, es_estudio=True, dormitorios=0))
    assert r.status_code == 200

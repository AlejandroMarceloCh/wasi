"""Planes Pro simulado y límite de análisis del plan Free (#3).

Cubre: activar trial/suscripción/cancelar, el estado en /me, y el tope de 5
análisis mensuales del Free (402) que Pro levanta.
"""


def _fresh_headers(client, email):
    client.post("/api/auth/register", json={
        "email": email, "name": email.split("@")[0], "password": "billing123"})
    r = client.post("/api/auth/login", json={"email": email, "password": "billing123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _payload(**kw):
    d = dict(lat=-12.121, lng=-77.030, area=90, dormitorios=2, banos=2,
             es_estudio=False, cocheras=1, antiguedad_anios=8,
             amenities=["ascensor"], precio=1400)
    d.update(kw)
    return d


def test_trial_activa_pro_y_me_lo_refleja(client):
    h = _fresh_headers(client, "trial@wasi.pe")

    me0 = client.get("/api/me", headers=h).json()
    assert me0["is_pro"] is False
    assert me0["analyses_limit"] == 5

    r = client.post("/api/billing/trial", headers=h)
    assert r.status_code == 200
    st = r.json()
    assert st["is_pro"] is True and st["plan"] == "pro"
    assert st["trial_ends_at"] is not None

    me1 = client.get("/api/me", headers=h).json()
    assert me1["is_pro"] is True
    assert me1["analyses_limit"] is None  # ilimitado

    # Reintentar el trial estando ya en Pro → 409.
    assert client.post("/api/billing/trial", headers=h).status_code == 409


def test_subscribe_y_cancel(client):
    h = _fresh_headers(client, "subs@wasi.pe")

    sub = client.post("/api/billing/subscribe", headers=h).json()
    assert sub["is_pro"] is True and sub["trial_ends_at"] is None

    cancel = client.post("/api/billing/cancel", headers=h).json()
    assert cancel["is_pro"] is False and cancel["plan"] == "free"

    me = client.get("/api/me", headers=h).json()
    assert me["analyses_limit"] == 5


def test_free_limite_5_analisis_y_pro_ilimitado(client):
    h = _fresh_headers(client, "limite@wasi.pe")

    # 5 análisis del plan Free pasan.
    for i in range(5):
        r = client.post("/api/fairvalue/predict", headers=h, json=_payload())
        assert r.status_code == 200, f"análisis {i+1} debería pasar: {r.text}"

    # El 6º supera el tope → 402.
    r6 = client.post("/api/fairvalue/predict", headers=h, json=_payload())
    assert r6.status_code == 402
    assert "Pro" in r6.json()["detail"]

    me = client.get("/api/me", headers=h).json()
    assert me["analyses_this_month"] == 5 and me["analyses_limit"] == 5

    # Al pasar a Pro, el límite desaparece.
    client.post("/api/billing/subscribe", headers=h)
    r7 = client.post("/api/fairvalue/predict", headers=h, json=_payload())
    assert r7.status_code == 200


def test_billing_requiere_auth(client):
    assert client.post("/api/billing/trial").status_code == 401
    assert client.post("/api/billing/subscribe").status_code == 401
    assert client.post("/api/billing/cancel").status_code == 401

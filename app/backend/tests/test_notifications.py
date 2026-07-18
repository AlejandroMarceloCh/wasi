"""Notificaciones in-app (#2).

Cubre el disparador (un lead nuevo notifica al dueño), la bandeja, el contador
de no leídas (badge) y el marcado como leídas. También verifica que quien envía
el lead NO recibe notificación (solo el propietario).
"""


def _headers(client, email, role="Inquilino"):
    client.post("/api/auth/register", json={
        "email": email, "name": email.split("@")[0], "password": "notif1234",
        "role": role})
    r = client.post("/api/auth/login", json={"email": email, "password": "notif1234"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _listing(**kw):
    d = dict(district="Miraflores", address="Av. Larco 200", lat=-12.121, lng=-77.030,
             area_m2=80, dormitorios=2, banos=2, cocheras=1, antiguedad_anios=5,
             es_estudio=False, price_usd=1400, description="Test",
             amenities=["ascensor"], contact_name="Owner",
             contact_phone="+51999000111", contact_email="owner@wasi.pe")
    d.update(kw)
    return d


def _crea_listing_con_lead(client):
    """Devuelve (headers_owner, headers_inquilino, listing_id) con 1 lead enviado."""
    owner = _headers(client, "notif_owner@wasi.pe", role="Propietario")
    inq = _headers(client, "notif_inq@wasi.pe", role="Inquilino")
    lid = client.post("/api/listings", headers=owner, json=_listing()).json()["id"]
    r = client.post(f"/api/listings/{lid}/leads", headers=inq, json={
        "name": "Interesado", "phone": "+51988777666",
        "email": "interesado@wasi.pe", "message": "Quiero verlo"})
    assert r.status_code == 201
    return owner, inq, lid


def test_lead_genera_notificacion_al_dueno(client):
    owner, inq, lid = _crea_listing_con_lead(client)

    # El dueño recibe la notificación.
    notifs = client.get("/api/notifications", headers=owner).json()
    assert len(notifs) >= 1
    n = notifs[0]
    assert n["type"] == "lead"
    assert n["listing_id"] == lid
    assert "Interesado" in n["body"]
    assert n["read"] is False

    # El inquilino que la envió NO recibe nada.
    assert client.get("/api/notifications", headers=inq).json() == []


def test_unread_count_y_read_all(client):
    owner, _, _ = _crea_listing_con_lead(client)

    before = client.get("/api/notifications/unread-count", headers=owner).json()
    assert before["unread"] >= 1

    marked = client.post("/api/notifications/read-all", headers=owner).json()
    assert marked["unread"] == 0

    after = client.get("/api/notifications/unread-count", headers=owner).json()
    assert after["unread"] == 0

    # Tras leer, la notificación sigue en la bandeja pero read=True.
    notifs = client.get("/api/notifications", headers=owner).json()
    assert notifs and all(n["read"] is True for n in notifs)


def test_notifications_requiere_auth(client):
    assert client.get("/api/notifications").status_code == 401
    assert client.get("/api/notifications/unread-count").status_code == 401
    assert client.post("/api/notifications/read-all").status_code == 401

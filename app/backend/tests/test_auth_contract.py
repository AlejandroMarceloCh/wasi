def test_register_normaliza_email_y_login_case_insensitive(client):
    r = client.post("/api/auth/register", json={
        "email": "CaseUser@WASI.Pe",
        "name": "Case User",
        "password": "case1234",
    })
    assert r.status_code == 201
    assert r.json()["user"]["email"] == "caseuser@wasi.pe"

    dup = client.post("/api/auth/register", json={
        "email": "caseuser@wasi.pe",
        "name": "Case User",
        "password": "case1234",
    })
    assert dup.status_code == 409

    login = client.post("/api/auth/login", json={
        "email": "CASEUSER@WASI.PE",
        "password": "case1234",
    })
    assert login.status_code == 200


def test_patch_me_rechaza_nombre_vacio_tras_strip(client, auth_headers):
    r = client.patch("/api/me", headers=auth_headers, json={"name": "   "})
    assert r.status_code == 422


def test_register_enum_email_devuelve_409_decision_documentada(client):
    """#19: el registro distingue cuentas existentes con 409 explícito. Es un
    trade-off UX > sigilo aceptado (el rate-limit de 10/min mitiga la velocidad
    de enumeración). Se pinea el comportamiento: si se cambia a un flujo opaco
    (mensaje genérico + email de verificación), este test debe actualizarse."""
    client.post("/api/auth/register", json={
        "email": "enum@wasi.pe", "name": "Enum", "password": "enum1234"})
    dup = client.post("/api/auth/register", json={
        "email": "enum@wasi.pe", "name": "Enum", "password": "enum1234"})
    assert dup.status_code == 409
    assert "registrado" in dup.json()["detail"].lower()

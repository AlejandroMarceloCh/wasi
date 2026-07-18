def test_register_normaliza_email_y_login_case_insensitive(client):
    r = client.post("/api/auth/register", json={
        "email": "CaseUser@WASI.Pe",
        "name": "Case User",
        "password": "case1234",
    })
    assert r.status_code == 201
    # El registro ya no devuelve token ni user (respuesta genérica, #7).
    body = r.json()
    assert "message" in body
    assert "token" not in body and "user" not in body

    # El correo se normalizó a minúsculas: login case-insensitive funciona.
    login = client.post("/api/auth/login", json={
        "email": "CASEUSER@WASI.PE",
        "password": "case1234",
    })
    assert login.status_code == 200


def test_patch_me_rechaza_nombre_vacio_tras_strip(client, auth_headers):
    r = client.patch("/api/me", headers=auth_headers, json={"name": "   "})
    assert r.status_code == 422


def test_register_no_revela_email_existente(client):
    """#7/#19: el registro NO debe permitir enumerar correos. La respuesta de
    un correo nuevo y la de uno ya registrado deben ser indistinguibles: mismo
    status y mismo body genérico, sin token ni 409. La cuenta original queda
    intacta (su contraseña sigue siendo válida)."""
    nuevo = client.post("/api/auth/register", json={
        "email": "enum@wasi.pe", "name": "Enum", "password": "enum1234"})
    dup = client.post("/api/auth/register", json={
        "email": "enum@wasi.pe", "name": "Otro", "password": "distinta99"})

    # Indistinguibles: mismo status y mismo cuerpo.
    assert nuevo.status_code == 201 and dup.status_code == 201
    assert nuevo.json() == dup.json()
    assert "token" not in dup.json()

    # El segundo registro no sobreescribió la cuenta: login con la pass original.
    ok = client.post("/api/auth/login", json={
        "email": "enum@wasi.pe", "password": "enum1234"})
    assert ok.status_code == 200
    # Y la contraseña del intento intruso no sirve.
    bad = client.post("/api/auth/login", json={
        "email": "enum@wasi.pe", "password": "distinta99"})
    assert bad.status_code == 401

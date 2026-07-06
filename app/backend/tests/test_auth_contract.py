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

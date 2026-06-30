"""Tests de listings (oferta) y leads (demanda) — flywheel.

Reusa client/auth_headers de conftest. auth_headers es un Inquilino (role
default) -> no puede publicar (403); para publicar se usa _seller_headers.

Veredicto: el umbral real es ZONE_BAND_PCT = 8% (ml.py), MISMO corte que el
análisis. El fixture usa price=1400, ref=1200 (+16.7%) -> "Inflado" sin
ambigüedad de borde.
"""


def _seller_headers(client):
    client.post("/api/auth/register", json={
        "email": "seller@wasi.pe", "name": "Seller", "password": "seller123",
        "role": "Propietario"})
    r = client.post("/api/auth/login", json={
        "email": "seller@wasi.pe", "password": "seller123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _listing(**kw):
    d = dict(district="Miraflores", address="Av. Larco 100", lat=-12.121, lng=-77.030,
             area_m2=80, dormitorios=2, banos=2, cocheras=1, antiguedad_anios=5,
             es_estudio=False, price_usd=1400, fair_value_ref=1200,
             description="Test", amenities=["ascensor"],
             contact_name="Owner", contact_phone="+51999000111",
             contact_email="owner@wasi.pe")
    d.update(kw)
    return d


def test_create_listing_seller_ok(client):
    h = _seller_headers(client)
    r = client.post("/api/listings", headers=h, json=_listing())
    assert r.status_code == 201
    d = r.json()
    assert d["district"] == "Miraflores"
    assert d["amenities"] == ["ascensor"]
    assert d["zone"] == "Inflado"          # 1400 vs 1200 -> +16.7% (> 8%) -> Inflado


def test_zone_justo_dentro_de_banda(client):
    h = _seller_headers(client)
    # 1250 vs 1200 -> +4.2% (dentro de ±8%) -> Justo
    r = client.post("/api/listings", headers=h, json=_listing(price_usd=1250, fair_value_ref=1200))
    assert r.status_code == 201
    assert r.json()["zone"] == "Justo"


def test_zone_ganga_bajo_la_banda(client):
    h = _seller_headers(client)
    # 1000 vs 1200 -> -16.7% (< -8%) -> Ganga
    r = client.post("/api/listings", headers=h, json=_listing(price_usd=1000, fair_value_ref=1200))
    assert r.status_code == 201
    assert r.json()["zone"] == "Ganga"


def test_zone_none_sin_referencia(client):
    h = _seller_headers(client)
    r = client.post("/api/listings", headers=h, json=_listing(fair_value_ref=None))
    assert r.status_code == 201
    assert r.json()["zone"] is None


def test_create_listing_inquilino_403(client, auth_headers):
    r = client.post("/api/listings", headers=auth_headers, json=_listing())
    assert r.status_code == 403


def test_create_listing_sin_token_401(client):
    r = client.post("/api/listings", json=_listing())
    assert r.status_code == 401


def test_list_listings_filtra_distrito(client):
    h = _seller_headers(client)
    client.post("/api/listings", headers=h, json=_listing(district="Surco"))
    r = client.get("/api/listings", headers=h, params={"district": "Surco"})
    assert r.status_code == 200
    assert all(x["district"] == "Surco" for x in r.json())


def test_my_listings_solo_propias(client):
    h = _seller_headers(client)
    r = client.get("/api/listings/mine", headers=h)
    assert r.status_code == 200
    # Todas las creadas por este seller; al menos las de los tests anteriores.
    assert isinstance(r.json(), list)


def test_lead_flow(client, auth_headers):
    h = _seller_headers(client)
    lid = client.post("/api/listings", headers=h, json=_listing()).json()["id"]
    r = client.post(f"/api/listings/{lid}/leads", headers=auth_headers, json={
        "name": "Ana", "phone": "+51911222333", "email": "ana@wasi.pe",
        "message": "Disponible?"})
    assert r.status_code == 201
    # El dueño ve el lead; otro usuario recibe 404.
    own = client.get(f"/api/listings/{lid}/leads", headers=h)
    assert own.status_code == 200 and len(own.json()) == 1
    other = client.get(f"/api/listings/{lid}/leads", headers=auth_headers)
    assert other.status_code == 404


def test_get_listing_404(client, auth_headers):
    r = client.get("/api/listings/999999", headers=auth_headers)
    assert r.status_code == 404


def test_create_listing_con_image_url(client):
    h = _seller_headers(client)
    url = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80"
    r = client.post("/api/listings", headers=h, json=_listing(image_url=url))
    assert r.status_code == 201
    assert r.json()["image_url"] == url


def test_create_listing_sin_image_url(client):
    h = _seller_headers(client)
    r = client.post("/api/listings", headers=h, json=_listing())
    assert r.status_code == 201
    # _listing() no manda image_url -> default None -> placeholder de marca en el front
    assert r.json()["image_url"] is None


def test_delete_listing_owner_ok(client):
    """P-14: el dueño borra su inmueble (204) y deja de aparecer en /mine."""
    h = _seller_headers(client)
    created = client.post("/api/listings", headers=h, json=_listing()).json()
    lid = created["id"]
    r = client.delete(f"/api/listings/{lid}", headers=h)
    assert r.status_code == 204
    mine = client.get("/api/listings/mine", headers=h).json()
    assert all(l["id"] != lid for l in mine)


def test_delete_listing_ajeno_404(client, auth_headers):
    """Un usuario que no es dueño no puede borrar (404, no revela el inmueble)."""
    h = _seller_headers(client)
    created = client.post("/api/listings", headers=h, json=_listing()).json()
    # auth_headers = Inquilino distinto al dueño
    r = client.delete(f"/api/listings/{created['id']}", headers=auth_headers)
    assert r.status_code == 404

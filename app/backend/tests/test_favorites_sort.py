"""Tests de sort/zone/limit en GET /api/listings y del flujo de favoritos.

Reusa client/auth_headers de conftest. La BD es de scope sesión y compartida
entre tests, así que los listings de ordenamiento se aíslan en un distrito
propio ("TestSortZone") para no mezclarse con los de test_listings.py.

Veredicto: umbral ZONE_BAND_PCT = 8% (ml.py).
- price=1000, ref=1200 -> -16.7% -> Ganga
- price=1250, ref=1200 -> +4.2%  -> Justo
- price=1400, ref=1200 -> +16.7% -> Inflado
"""

_ZONE_DISTRICT = "TestSortZone"


def _seller_headers(client):
    client.post("/api/auth/register", json={
        "email": "seller_fav@wasi.pe", "name": "SellerFav",
        "password": "seller123", "role": "Propietario"})
    r = client.post("/api/auth/login", json={
        "email": "seller_fav@wasi.pe", "password": "seller123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _listing(**kw):
    d = dict(district=_ZONE_DISTRICT, address="Av. Test 100", lat=-12.121, lng=-77.030,
             area_m2=80, dormitorios=2, banos=2, cocheras=1, antiguedad_anios=5,
             es_estudio=False, price_usd=1400, fair_value_ref=1200,
             description="Test", amenities=["ascensor"],
             contact_name="Owner", contact_phone="+51999000111",
             contact_email="owner@wasi.pe")
    d.update(kw)
    return d


def _seed_zone_listings(client, h):
    """Crea (idempotente por test, pero pueden repetirse entre tests) un set con
    los 3 veredictos + precios distintos para ordenar. Devuelve los ids."""
    ganga = client.post("/api/listings", headers=h,
                        json=_listing(price_usd=1000, fair_value_ref=1200)).json()
    justo = client.post("/api/listings", headers=h,
                        json=_listing(price_usd=1250, fair_value_ref=1200)).json()
    inflado = client.post("/api/listings", headers=h,
                         json=_listing(price_usd=1400, fair_value_ref=1200)).json()
    return ganga, justo, inflado


def _zone_listings(client, h, **params):
    p = {"district": _ZONE_DISTRICT}
    p.update(params)
    r = client.get("/api/listings", headers=h, params=p)
    assert r.status_code == 200, r.text
    return r.json()


# ── sort ────────────────────────────────────────────────────────────────────
def test_sort_precio_asc(client):
    h = _seller_headers(client)
    _seed_zone_listings(client, h)
    rows = _zone_listings(client, h, sort="precio_asc")
    precios = [x["price_usd"] for x in rows]
    assert precios == sorted(precios), f"no ascendente: {precios}"


def test_sort_precio_desc(client):
    h = _seller_headers(client)
    _seed_zone_listings(client, h)
    rows = _zone_listings(client, h, sort="precio_desc")
    precios = [x["price_usd"] for x in rows]
    assert precios == sorted(precios, reverse=True), f"no descendente: {precios}"


def test_sort_ganga_primero(client):
    h = _seller_headers(client)
    _seed_zone_listings(client, h)
    rows = _zone_listings(client, h, sort="ganga")
    # El más ganga = (price-ref)/ref más negativo. El primero debe ser un Ganga.
    assert rows[0]["zone"] == "Ganga"
    # Monotonía: el score (price-ref)/ref es no decreciente a lo largo de la lista.
    def score(x):
        ref = x.get("fair_value_ref")
        return (x["price_usd"] - ref) / ref if ref else float("inf")
    scores = [score(x) for x in rows]
    assert scores == sorted(scores), f"orden ganga no monótono: {scores}"


def test_sort_default_reciente(client):
    h = _seller_headers(client)
    _seed_zone_listings(client, h)
    rows = _zone_listings(client, h)  # sin sort -> created_at desc
    fechas = [x["created_at"] for x in rows]
    assert fechas == sorted(fechas, reverse=True), "default no es created_at desc"


def test_sort_invalido_422(client):
    h = _seller_headers(client)
    r = client.get("/api/listings", headers=h, params={"sort": "barato"})
    assert r.status_code == 422


# ── zone filter ──────────────────────────────────────────────────────────────
def test_zone_filter_ganga(client):
    h = _seller_headers(client)
    _seed_zone_listings(client, h)
    rows = _zone_listings(client, h, zone="Ganga")
    assert len(rows) >= 1
    assert all(x["zone"] == "Ganga" for x in rows)


def test_zone_filter_inflado(client):
    h = _seller_headers(client)
    _seed_zone_listings(client, h)
    rows = _zone_listings(client, h, zone="Inflado")
    assert all(x["zone"] == "Inflado" for x in rows)


def test_zone_filter_invalido_422(client):
    h = _seller_headers(client)
    r = client.get("/api/listings", headers=h, params={"zone": "Carisimo"})
    assert r.status_code == 422


# ── limit ────────────────────────────────────────────────────────────────────
def test_limit_top_n(client):
    h = _seller_headers(client)
    _seed_zone_listings(client, h)
    rows = _zone_listings(client, h, sort="ganga", limit=2)
    assert len(rows) == 2


def test_limit_cero_lista_vacia(client):
    h = _seller_headers(client)
    _seed_zone_listings(client, h)
    rows = _zone_listings(client, h, limit=0)
    assert rows == []


def test_limit_negativo_422(client):
    h = _seller_headers(client)
    r = client.get("/api/listings", headers=h, params={"limit": -1})
    assert r.status_code == 422


def test_zone_y_sort_combinados(client):
    h = _seller_headers(client)
    _seed_zone_listings(client, h)
    rows = _zone_listings(client, h, zone="Ganga", sort="precio_asc", limit=1)
    assert len(rows) <= 1
    if rows:
        assert rows[0]["zone"] == "Ganga"


# ── favoritos ────────────────────────────────────────────────────────────────
def test_favorite_guardar_y_listar(client, auth_headers):
    """auth_headers (Inquilino) guarda un listing; aparece en GET /api/favorites
    con su veredicto (zone)."""
    h = _seller_headers(client)
    lid = client.post("/api/listings", headers=h,
                      json=_listing(price_usd=1000, fair_value_ref=1200)).json()["id"]

    r = client.post("/api/favorites", headers=auth_headers, json={"listing_id": lid})
    assert r.status_code == 201, r.text
    assert r.json()["id"] == lid
    assert r.json()["zone"] == "Ganga"   # 1000 vs 1200 -> Ganga, viene en la respuesta

    favs = client.get("/api/favorites", headers=auth_headers)
    assert favs.status_code == 200
    ids = [x["id"] for x in favs.json()]
    assert lid in ids
    fav = next(x for x in favs.json() if x["id"] == lid)
    assert fav["zone"] == "Ganga"


def test_favorite_idempotente_no_duplica(client, auth_headers):
    """Guardar dos veces el mismo listing: la segunda da 200 (no 201) y no
    duplica en la lista."""
    h = _seller_headers(client)
    lid = client.post("/api/listings", headers=h, json=_listing()).json()["id"]

    r1 = client.post("/api/favorites", headers=auth_headers, json={"listing_id": lid})
    assert r1.status_code == 201
    r2 = client.post("/api/favorites", headers=auth_headers, json={"listing_id": lid})
    assert r2.status_code == 200, "el segundo POST debe ser idempotente (200)"

    favs = client.get("/api/favorites", headers=auth_headers).json()
    apariciones = [x for x in favs if x["id"] == lid]
    assert len(apariciones) == 1, "el favorito no debe duplicarse"


def test_favorite_quitar(client, auth_headers):
    h = _seller_headers(client)
    lid = client.post("/api/listings", headers=h, json=_listing()).json()["id"]
    client.post("/api/favorites", headers=auth_headers, json={"listing_id": lid})

    d = client.delete(f"/api/favorites/{lid}", headers=auth_headers)
    assert d.status_code == 204

    favs = client.get("/api/favorites", headers=auth_headers).json()
    assert lid not in [x["id"] for x in favs]


def test_favorite_quitar_idempotente(client, auth_headers):
    """Borrar un favorito que no existe igual da 204 (estado final = no guardado)."""
    d = client.delete("/api/favorites/999999", headers=auth_headers)
    assert d.status_code == 204


def test_favorite_listing_inexistente_404(client, auth_headers):
    r = client.post("/api/favorites", headers=auth_headers, json={"listing_id": 999999})
    assert r.status_code == 404


def test_favorite_sin_token_401(client):
    r = client.post("/api/favorites", json={"listing_id": 1})
    assert r.status_code == 401


def test_favorites_aislados_por_usuario(client, auth_headers):
    """Los favoritos de un usuario no aparecen para otro."""
    h = _seller_headers(client)
    lid = client.post("/api/listings", headers=h, json=_listing()).json()["id"]
    client.post("/api/favorites", headers=auth_headers, json={"listing_id": lid})

    # El seller (otro usuario) no debe ver ese favorito.
    favs_seller = client.get("/api/favorites", headers=h).json()
    assert lid not in [x["id"] for x in favs_seller]

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
             es_estudio=False, price_usd=1400,
             description="Test", amenities=["ascensor"],
             contact_name="Owner", contact_phone="+51999000111",
             contact_email="owner@wasi.pe")
    d.update(kw)
    return d

def _expected_comparable_ref(district, area_m2):
    from database import SessionLocal
    from models import Listing

    db = SessionLocal()
    try:
        rows = (
            db.query(Listing.price_usd, Listing.area_m2)
            .filter(
                Listing.district == district,
                Listing.status == "activo",
                Listing.area_m2 > 0,
                Listing.price_usd > 0,
            )
            .all()
        )
    finally:
        db.close()
    ppm2 = sorted(price / area for price, area in rows)
    n = len(ppm2)
    med = ppm2[n // 2] if n % 2 else (ppm2[n // 2 - 1] + ppm2[n // 2]) / 2
    return round(med * area_m2, 0)

def test_create_listing_seller_ok(client):
    h = _seller_headers(client)
    r = client.post("/api/listings", headers=h, json=_listing())
    assert r.status_code == 201
    d = r.json()
    assert d["district"] == "Miraflores"
    assert d["amenities"] == ["ascensor"]

def test_create_listing_no_acepta_fair_value_ref_del_cliente(client):
    """Seguridad: aunque el cliente mande fair_value_ref absurdo (para falsear
    'Ganga'), el server lo ignora y calcula/omite su propia referencia."""
    h = _seller_headers(client)
    r = client.post("/api/listings", headers=h,
                    json=_listing(fair_value_ref=1))
    assert r.status_code == 201
    assert r.json()["fair_value_ref"] != 1

def test_create_listing_usa_modelo_ml_para_fair_value_ref(client, monkeypatch):
    import routers.listings as listings_router

    def fake_predict(form):
        assert form["area"] == 80
        assert form["precio"] == 1400
        return {"fair_value": 1777.4}

    monkeypatch.setattr(listings_router, "predict_fair_value", fake_predict)
    h = _seller_headers(client)
    r = client.post("/api/listings", headers=h, json=_listing())
    assert r.status_code == 201
    assert r.json()["fair_value_ref"] == 1777

def test_create_listing_fallback_comparables_si_modelo_falla(client, monkeypatch):
    import routers.listings as listings_router

    h = _seller_headers(client)
    seed = client.post("/api/listings", headers=h, json=_listing(area_m2=100, price_usd=1200))
    assert seed.status_code == 201
    expected_ref = _expected_comparable_ref("Miraflores", 50)

    def broken_predict(_form):
        raise RuntimeError("modelo no disponible")

    monkeypatch.setattr(listings_router, "predict_fair_value", broken_predict)
    r = client.post("/api/listings", headers=h, json=_listing(area_m2=50, price_usd=1600))
    assert r.status_code == 201
    assert r.json()["district"] == "Miraflores"
    assert r.json()["fair_value_ref"] == expected_ref

def test_create_listing_fallback_si_modelo_devuelve_respuesta_invalida(client, monkeypatch):
    import routers.listings as listings_router

    h = _seller_headers(client)
    seed = client.post("/api/listings", headers=h, json=_listing(area_m2=100, price_usd=1200))
    assert seed.status_code == 201
    expected_ref = _expected_comparable_ref("Miraflores", 50)

    monkeypatch.setattr(listings_router, "predict_fair_value", lambda _form: {})
    r = client.post("/api/listings", headers=h, json=_listing(area_m2=50, price_usd=1600))
    assert r.status_code == 201
    assert r.json()["district"] == "Miraflores"
    assert r.json()["fair_value_ref"] == expected_ref

def test_create_listing_rechaza_distrito_inconsistente_con_pin(client):
    h = _seller_headers(client)
    r = client.post("/api/listings", headers=h,
                    json=_listing(district="San Isidro", lat=-12.121, lng=-77.030))
    assert r.status_code == 422
    assert "district no coincide" in r.json()["detail"]

def test_zone_from_price_bands():
    from routers.listings import _zone_from_price
    assert _zone_from_price(1400, 1200) == "Inflado"
    assert _zone_from_price(1250, 1200) == "Justo"
    assert _zone_from_price(1000, 1200) == "Ganga"
    assert _zone_from_price(1200, None) is None
    assert _zone_from_price(1200, 0) is None

def test_create_listing_inquilino_403(client, auth_headers):
    r = client.post("/api/listings", headers=auth_headers, json=_listing())
    assert r.status_code == 403

def test_create_listing_sin_token_401(client):
    r = client.post("/api/listings", json=_listing())
    assert r.status_code == 401

def test_list_listings_filtra_distrito(client):
    h = _seller_headers(client)
    client.post("/api/listings", headers=h, json=_listing(district="Miraflores"))
    r = client.get("/api/listings", headers=h, params={"district": "Miraflores"})
    assert r.status_code == 200
    assert all(x["district"] == "Miraflores" for x in r.json())

def test_my_listings_solo_propias(client):
    h = _seller_headers(client)
    r = client.get("/api/listings/mine", headers=h)
    assert r.status_code == 200

    assert isinstance(r.json(), list)

def test_lead_flow(client, auth_headers):
    h = _seller_headers(client)
    lid = client.post("/api/listings", headers=h, json=_listing()).json()["id"]
    r = client.post(f"/api/listings/{lid}/leads", headers=auth_headers, json={
        "name": "Ana", "phone": "+51911222333", "email": "ana@wasi.pe",
        "message": "Disponible?"})
    assert r.status_code == 201

    own = client.get(f"/api/listings/{lid}/leads", headers=h)
    assert own.status_code == 200 and len(own.json()) == 1
    other = client.get(f"/api/listings/{lid}/leads", headers=auth_headers)
    assert other.status_code == 404

def test_listing_no_activo_no_visible_ni_contactable_para_no_dueno(client, auth_headers):
    from database import SessionLocal
    from models import Listing

    h = _seller_headers(client)
    lid = client.post("/api/listings", headers=h, json=_listing()).json()["id"]
    db = SessionLocal()
    try:
        l = db.get(Listing, lid)
        l.status = "pausado"
        db.commit()
    finally:
        db.close()

    r = client.get(f"/api/listings/{lid}", headers=auth_headers)
    assert r.status_code == 404

    own = client.get(f"/api/listings/{lid}", headers=h)
    assert own.status_code == 200
    assert own.json()["status"] == "pausado"

    lead = client.post(f"/api/listings/{lid}/leads", headers=auth_headers, json={
        "name": "Ana", "phone": "+51911222333", "email": "ana@wasi.pe",
        "message": "Disponible?"})
    assert lead.status_code == 409

def test_listings_excluye_pausados_y_alquilados(client, auth_headers):
    from database import SessionLocal
    from models import Listing

    h = _seller_headers(client)
    paused_id = client.post("/api/listings", headers=h, json=_listing()).json()["id"]
    rented_id = client.post("/api/listings", headers=h, json=_listing()).json()["id"]
    db = SessionLocal()
    try:
        db.get(Listing, paused_id).status = "pausado"
        db.get(Listing, rented_id).status = "alquilado"
        db.commit()
    finally:
        db.close()

    r = client.get("/api/listings", headers=auth_headers)
    assert r.status_code == 200
    ids = {x["id"] for x in r.json()}
    assert paused_id not in ids
    assert rented_id not in ids

def test_favorites_bloquean_y_filtran_no_activos(client, auth_headers):
    from database import SessionLocal
    from models import Listing

    h = _seller_headers(client)
    active_id = client.post("/api/listings", headers=h, json=_listing()).json()["id"]
    paused_id = client.post("/api/listings", headers=h, json=_listing()).json()["id"]
    rented_id = client.post("/api/listings", headers=h, json=_listing()).json()["id"]
    db = SessionLocal()
    try:
        db.get(Listing, paused_id).status = "pausado"
        db.get(Listing, rented_id).status = "alquilado"
        db.commit()
    finally:
        db.close()

    assert client.post("/api/favorites", headers=auth_headers,
                       json={"listing_id": active_id}).status_code == 201
    assert client.post("/api/favorites", headers=auth_headers,
                       json={"listing_id": paused_id}).status_code == 404
    assert client.post("/api/favorites", headers=auth_headers,
                       json={"listing_id": rented_id}).status_code == 404

    db = SessionLocal()
    try:
        db.get(Listing, active_id).status = "alquilado"
        db.commit()
    finally:
        db.close()

    favs = client.get("/api/favorites", headers=auth_headers)
    assert favs.status_code == 200
    assert active_id not in {x["id"] for x in favs.json()}

def test_listing_contact_email_y_lead_email_lowercase(client, auth_headers):
    h = _seller_headers(client)
    created = client.post("/api/listings", headers=h,
                          json=_listing(contact_email="OWNER@WASI.PE")).json()
    assert created["contact_email"] == "owner@wasi.pe"

    r = client.post(f"/api/listings/{created['id']}/leads", headers=auth_headers, json={
        "name": "Ana", "phone": "+51911222333", "email": "ANA@WASI.PE",
        "message": "Disponible?"})
    assert r.status_code == 201
    assert r.json()["email"] == "ana@wasi.pe"

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

    r = client.delete(f"/api/listings/{created['id']}", headers=auth_headers)
    assert r.status_code == 404

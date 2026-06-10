"""Tests del endpoint dedicado POST /api/fairvalue/counterfactual.

Palancas accionables (numéricas + amenities) re-servidas contra el modelo
CONGELADO. Validan: contrato del schema, coherencia direction<->signo, toggle
de amenities (Agregar/Quitar), determinismo (modelo congelado), validador de
baños, out-of-bounds y orden por |delta| desc.

Reusa client/auth_headers de conftest (mismo patrón que test_counterfactuals.py).
El payload NO lleva `precio` (a diferencia de /predict).
"""

VALID_DIRECTIONS = {"sube", "baja", "neutro"}
ITEM_KEYS = ("label", "kind", "feature", "delta", "delta_pct", "direction", "new_price")


def _payload(**kw):
    d = dict(lat=-12.121, lng=-77.030, area=80, dormitorios=2, banos=2,
             es_estudio=False, cocheras=1, antiguedad_anios=10,
             amenities=["ascensor", "seguridad"])
    d.update(kw)
    return d


def test_endpoint_200_estructura(client, auth_headers):
    """Happy path: 200, base_fair_value > 0, items con las 7 keys del schema y
    direction coherente con el signo de delta."""
    r = client.post("/api/fairvalue/counterfactual", headers=auth_headers, json=_payload())
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["base_fair_value"] > 0
    assert isinstance(d["distrito"], str) and d["distrito"]
    assert isinstance(d["items"], list)
    for it in d["items"]:
        for k in ITEM_KEYS:
            assert k in it, f"falta key {k} en item {it}"
        assert it["direction"] in VALID_DIRECTIONS
        # coherencia direction <-> signo de delta
        if it["delta"] > 0:
            assert it["direction"] == "sube"
        elif it["delta"] < 0:
            assert it["direction"] == "baja"
        else:
            assert it["direction"] == "neutro"
        assert it["new_price"] > 0


def test_amenity_toggle_presente(client, auth_headers):
    """Con piscina presente, si pasa el filtro de ruido aparece 'Quitar piscina'."""
    r = client.post("/api/fairvalue/counterfactual", headers=auth_headers,
                    json=_payload(amenities=["piscina"]))
    assert r.status_code == 200
    items = r.json()["items"]
    piscina = [i for i in items if i["feature"] == "amenity:piscina"]
    # puede filtrarse por ruido (<0.5%); si está, debe ser un "Quitar"
    for i in piscina:
        assert i["kind"] == "amenity"
        assert i["label"].startswith("Quitar"), f"label inesperado: {i['label']!r}"


def test_amenity_toggle_ausente(client, auth_headers):
    """Sin amenities, los items de amenities deben proponer 'Agregar <X>'."""
    r = client.post("/api/fairvalue/counterfactual", headers=auth_headers,
                    json=_payload(amenities=[]))
    assert r.status_code == 200
    items = r.json()["items"]
    amen = [i for i in items if i["feature"].startswith("amenity:")]
    for i in amen:
        assert i["label"].startswith("Agregar"), f"label inesperado: {i['label']!r}"


def test_no_toca_modelo_determinismo(client, auth_headers):
    """Dos llamadas con el mismo form -> base_fair_value idéntico (modelo congelado)."""
    p = _payload()
    r1 = client.post("/api/fairvalue/counterfactual", headers=auth_headers, json=p)
    r2 = client.post("/api/fairvalue/counterfactual", headers=auth_headers, json=p)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["base_fair_value"] == r2.json()["base_fair_value"]


def test_banos_validator_422(client, auth_headers):
    """banos=0 con es_estudio=False -> 422 (Pydantic), no 500."""
    r = client.post("/api/fairvalue/counterfactual", headers=auth_headers,
                    json=_payload(banos=0, es_estudio=False))
    assert r.status_code == 422


def test_out_of_bounds_400(client, auth_headers):
    """Pin fuera del bbox de Lima -> 400 con el mensaje del patrón."""
    r = client.post("/api/fairvalue/counterfactual", headers=auth_headers,
                    json=_payload(lat=0.0, lng=0.0))
    assert r.status_code == 400
    assert "Lima" in r.json()["detail"]


def test_orden_por_delta_abs_desc(client, auth_headers):
    """items ordenados por |delta| descendente."""
    r = client.post("/api/fairvalue/counterfactual", headers=auth_headers, json=_payload())
    items = r.json()["items"]
    if len(items) >= 2:
        magnitudes = [abs(i["delta"]) for i in items]
        assert magnitudes == sorted(magnitudes, reverse=True), \
            f"items no ordenados por |delta| desc: {magnitudes}"

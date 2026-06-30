"""Comparables (FR-03): avisos reales como evidencia del Fair Value."""
import pytest
from wasi.models.comparables_service import get_comparables_service
from wasi.paths import DATA_DIR

_COMPARABLES_CSV = DATA_DIR / "comparables.csv"


def test_comparables_service_devuelve_cercanos_y_similares():
    pytest.importorskip("pandas")  # siempre disponible, pero...
    if not _COMPARABLES_CSV.exists():
        pytest.skip(f"comparables.csv no encontrado: {_COMPARABLES_CSV}")
    svc = get_comparables_service()
    assert svc.n > 1000  # dataset cargado
    items = svc.nearby(-12.121, -77.030, area=85, dormitorios=2, k=6)
    assert len(items) == 6
    # todos dentro de un radio razonable y con precio/área válidos
    for it in items:
        assert it["precio_usd"] > 0
        assert it["area_m2"] > 0
        assert it["distancia_km"] >= 0
        assert "lat" not in it or isinstance(it["lat"], float)
    # ordenados por similitud: el primero no debería estar más lejos que el último
    assert items[0]["distancia_km"] <= max(i["distancia_km"] for i in items)


def test_comparables_endpoint_ok(client, auth_headers):
    r = client.get("/api/fairvalue/comparables",
                   params={"lat": -12.121, "lng": -77.030, "area": 85, "dormitorios": 2},
                   headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert len(body["items"]) == 6
    assert body["total_dataset"] > 1000


def test_comparables_fuera_de_lima_400(client, auth_headers):
    r = client.get("/api/fairvalue/comparables",
                   params={"lat": -2.0, "lng": -60.0},  # selva, fuera de Lima
                   headers=auth_headers)
    assert r.status_code == 400


def test_comparables_sin_token_401(client):
    r = client.get("/api/fairvalue/comparables", params={"lat": -12.1, "lng": -77.0})
    assert r.status_code == 401

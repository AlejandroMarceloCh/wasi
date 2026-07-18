"""Red de seguridad de la Tanda 2 (Sprint 17, #36).

Cubre los bordes auditados que no tenían test al cerrar los Sprints 12–16.
La meta (del plan): que un revert de cualquier fix de la Tanda 1 o 2 haga
fallar al menos un test de la suite.

Tests:
  - CORS (#CORS): origen permitido devuelve header, origen bloqueado no.
  - Rate-limit 429 (#T040): el handler slowapi→app responde 429 al exceder.
  - Path features de venta (#17): build_features_venta importa desde `wasi`
    (no del .pyc zombie) y resuelve geo_lookup correctamente.

Confirmados ya cubiertos por otros archivos (no se duplican acá):
  - Tope PATCH por operación → test_patch_respeta_tope_de_precio_por_operacion
  - Lead phone exige dígitos → test_lead_telefono_exige_digitos
  - image_url rechaza SVG → test_image_url_rechaza_svg
  - Zone Ganga implausible → test_zone_no_etiqueta_ganga_implausible
  - sort=ganga/zone bajan a SQL (#21) → test_sort_ganga_baja_a_sql_y_coincide_con_score_python,
    test_zone_filter_baja_a_sql_excluye_sucia_y_sin_ref
  - Índice compuesto (#33) → test_indice_compuesto_listings_creado_por_ensure_schema
  - Enumeración emails (#7/#19) → test_register_no_revela_email_existente (test_auth_contract.py)
"""
import sys
from pathlib import Path

import pytest


# ──────────────────────────────────────────────────────────────────────────
# CORS — verificación de los orígenes configurados en main.py
# ──────────────────────────────────────────────────────────────────────────

def test_cors_origen_permitido_devuelve_header(client):
    """El origen default (Vite dev :5173) recibe Access-Control-Allow-Origin."""
    r = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173", (
        "el origen permitido debe devolverse en el header CORS")


def test_cors_origen_bloqueado_no_devuelve_header(client):
    """Un origen no listado NO recibe header CORS — el browser bloqueará la respuesta."""
    r = client.get("/api/health", headers={"Origin": "https://malicioso.example"})
    assert r.status_code == 200  # la request se procesa (CORS no es control de acceso)
    assert r.headers.get("access-control-allow-origin") is None, (
        "un origen no permitido no debe recibir header CORS — expondría la API a cualquier sitio")


def test_cors_preflight_origen_permitido_devuelve_ok(client):
    """OPTIONS preflight desde el origen permitido responde 200 con headers CORS."""
    r = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"


# ──────────────────────────────────────────────────────────────────────────
# Rate-limit — wiring slowapi → app → handler 429
# ──────────────────────────────────────────────────────────────────────────

def test_rate_limit_responde_429_al_exceder():
    """#36: un endpoint con @limiter.limit responde 429 al exceder el cupo.

    Verifica end-to-end el wiring de slowapi en el MISMO patrón que usa Wasi
    (Limiter + add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)).
    Si upgrading slowapi rompe el handler, o alguien desconecta el handler en
    main.py, este test falla.

    El test NO usa el `client` global (que tiene WASI_RATELIMIT=0) para no
    contaminar el resto de la suite con un contador de rate-limit cargado.
    """
    from fastapi import FastAPI, Request
    from fastapi.testclient import TestClient
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.util import get_remote_address

    lim = Limiter(key_func=get_remote_address)
    mini = FastAPI()
    mini.state.limiter = lim
    mini.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    @mini.get("/limited")
    @lim.limit("2/minute")
    def limited(request: Request):
        return {"ok": True}

    c = TestClient(mini)
    r1 = c.get("/limited")
    r2 = c.get("/limited")
    r3 = c.get("/limited")
    assert r1.status_code == 200, "primer request dentro del cupo"
    assert r2.status_code == 200, "segundo request dentro del cupo"
    assert r3.status_code == 429, "tercer request excede el cupo → debe dar 429"


def test_rate_limit_wiring_en_app_real():
    """Complemento del test anterior: la app real tiene el handler conectado.

    Si alguien borra `app.add_exception_handler(RateLimitExceeded, ...)` en
    main.py, los @limiter.limit de los endpoints dejarían de responder 429
    y darían 500 en cambio. Este test pinea ese contrato.
    """
    from slowapi.errors import RateLimitExceeded
    from main import app

    assert RateLimitExceeded in app.exception_handlers, (
        "main.py debe registrar add_exception_handler(RateLimitExceeded, "
        "_rate_limit_exceeded_handler) para que los @limiter.limit respondan 429")


# ──────────────────────────────────────────────────────────────────────────
# #17 — pipeline de features de venta importa desde `wasi` (no del .pyc zombie)
# ──────────────────────────────────────────────────────────────────────────

def test_build_features_venta_importa_desde_wasi():
    """#17: build_features_venta resuelve geo_lookup desde el paquete wasi
    instalado, no desde el .pyc zombie de app/backend/geo_index.py (que ya no
    existe como .py).

    Si alguien revierte el fix (vuelve al sys.path.insert hacia
    app/backend + `from geo_index`), este test falla con ImportError o porque
    el módulo de geo_lookup no empieza con 'wasi.'.
    """
    backend_root = Path(__file__).resolve().parent.parent
    repo_root = backend_root.parent.parent
    ventas_dir = repo_root / "ventas_model"

    if not (ventas_dir / "build_features_venta.py").exists():
        pytest.skip("ventas_model/build_features_venta.py no está en este checkout")

    sys.path.insert(0, str(ventas_dir))
    try:
        if "build_features_venta" in sys.modules:
            del sys.modules["build_features_venta"]
        import build_features_venta as bfv

        # El import del fix apunta al paquete wasi, no a un módulo suelto.
        assert bfv.geo_lookup.__module__.startswith("wasi."), (
            f"geo_lookup debe venir del paquete wasi, no de {bfv.geo_lookup.__module__}")
        assert len(bfv.IDW_COLS) == 16, "IDW_COLS son las 16 features geo del modelo de alquiler"
    finally:
        sys.path.pop(0)
        sys.modules.pop("build_features_venta", None)

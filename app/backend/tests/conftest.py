"""Fixtures de pytest — Fase 3.

Usa una BD SQLite temporal (no toca wasi.db). El DATABASE_URL se setea
ANTES de importar la app para que el engine apunte a la BD de prueba.

Producción corre PostgreSQL: para validar la suite contra el motor real
(diferencias de DDL, tipos y transacciones que SQLite no reproduce) se
exporta WASI_TEST_DATABASE_URL apuntando a una BD de prueba desechable.
Sin esa variable el comportamiento no cambia: SQLite temporal.
"""
import os
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

_TEST_DB_URL = os.environ.get("WASI_TEST_DATABASE_URL", "").strip()
if _TEST_DB_URL:
    os.environ["DATABASE_URL"] = _TEST_DB_URL
else:
    _TMPDB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    os.environ["DATABASE_URL"] = f"sqlite:///{_TMPDB.name}"

os.environ["JWT_SECRET"] = "pytest-secret-not-real-min-32-chars-padding-xyz"

os.environ["WASI_ENABLE_DEMO_SEED"] = "1"

os.environ["WASI_SKIP_BULK_SEED"] = "1"

os.environ["WASI_RATELIMIT"] = "0"

from fastapi.testclient import TestClient
from main import app

@pytest.fixture(scope="session")
def client():
    """TestClient — al entrar al contexto dispara el lifespan (carga modelo)."""
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="session")
def auth_headers(client):
    """Registra un usuario de prueba y devuelve el header Authorization.

    Es Pro (suscripción simulada) para que la batería de tests que hace muchos
    análisis con este mismo usuario no choque con el tope mensual del plan Free
    (5/mes). El límite Free en sí se prueba con usuarios frescos en
    test_billing.py."""
    client.post("/api/auth/register", json={
        "email": "pytest@wasi.pe", "name": "Pytest", "password": "pytest123"})
    r = client.post("/api/auth/login", json={
        "email": "pytest@wasi.pe", "password": "pytest123"})
    headers = {"Authorization": f"Bearer {r.json()['token']}"}
    client.post("/api/billing/subscribe", headers=headers)  # Pro → análisis ilimitados
    return headers

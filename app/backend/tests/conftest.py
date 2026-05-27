"""Fixtures de pytest — Fase 3.

Usa una BD SQLite temporal (no toca wasi.db). El DATABASE_URL se setea
ANTES de importar la app para que el engine apunte a la BD de prueba.
"""
import os
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

# BD temporal — debe definirse antes de importar database/main.
_TMPDB = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_TMPDB.name}"

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    """TestClient — al entrar al contexto dispara el lifespan (carga modelo)."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def auth_headers(client):
    """Registra un usuario de prueba y devuelve el header Authorization."""
    client.post("/api/auth/register", json={
        "email": "pytest@wasi.pe", "name": "Pytest", "password": "pytest123"})
    r = client.post("/api/auth/login", json={
        "email": "pytest@wasi.pe", "password": "pytest123"})
    return {"Authorization": f"Bearer {r.json()['token']}"}

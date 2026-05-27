"""Tests de los endpoints de observabilidad (Sprint 2.1).

Cubre:
- GET /api/health (sin auth) → shape y valores básicos.
- GET /api/model/info → presencia de campos + tipos + valores sensatos.
"""


def test_health_sin_auth_responde_200(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    d = r.json()
    # Campos requeridos en el contrato
    assert d["status"] in ("ok", "degraded")
    assert d["model_mode"] in ("v1", "v2")
    assert isinstance(d["model_version"], str)
    assert isinstance(d["uptime_seconds"], int)
    assert d["uptime_seconds"] >= 0


def test_health_no_requiere_auth_ni_filtra_jerga(client):
    """Monitoring tools deben llegar sin token. La response no debe filtrar
    nombres internos de archivos ni stack traces."""
    r = client.get("/api/health")
    body = r.text.lower()
    assert "joblib" not in body
    assert "traceback" not in body


def test_model_info_shape_y_tipos(client):
    r = client.get("/api/model/info")
    assert r.status_code == 200
    d = r.json()
    # Campos del schema ModelInfoOut
    for k in ("mode", "version", "n_features", "trained_at",
              "days_since_training", "dataset_period", "metrics"):
        assert k in d, f"falta campo {k}"
    # Tipos
    assert isinstance(d["n_features"], int)
    assert d["n_features"] > 0
    assert isinstance(d["dataset_period"], str)
    # Metrics anidado
    m = d["metrics"]
    for k in ("r2", "mae_usd", "mape_pct"):
        assert k in m
        assert isinstance(m[k], (int, float))
    # Sanity check: el modelo en prod (v2) debe tener métricas dentro de
    # rangos esperables del baseline. Si v1 fallback, también razonable.
    assert 0.5 < m["r2"] < 1.0
    assert 50 < m["mae_usd"] < 500
    assert 5 < m["mape_pct"] < 30


def test_model_info_trained_at_iso(client):
    """trained_at debe ser ISO 8601 parseable."""
    from datetime import datetime
    r = client.get("/api/model/info")
    d = r.json()
    if d.get("trained_at"):
        # parsea sin error si es ISO válido
        datetime.fromisoformat(d["trained_at"])
        assert d["days_since_training"] is not None
        assert d["days_since_training"] >= 0

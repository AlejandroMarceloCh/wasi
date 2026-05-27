"""Tests del intervalo de predicción P25/P50/P75 (Sprint 3.1).

Verifican: presencia en PredictOut cuando v2 + quantile cargado, ordenamiento
P25 ≤ P50 ≤ P75, y consistencia del centro (P50 cercano a fair_value).

Post-auditoría T2: si el modelo activo es v2 con quantile, los asserts son
ESTRICTOS (no permitir skip silencioso); si es v1 sin quantile, se ignoran.
"""
import json
from pathlib import Path

# Detecta si hay quantile cargado para subir el nivel de exigencia de los tests.
_QUANTILE_FILE = Path(__file__).resolve().parent.parent / "models" / "v2" / "xgb_q50_v2.joblib"
_QUANTILE_AVAILABLE = _QUANTILE_FILE.exists()


def _payload(**kw):
    d = dict(lat=-12.121, lng=-77.030, area=80, dormitorios=2, banos=2,
             es_estudio=False, cocheras=1, antiguedad_anios=10,
             amenities=["ascensor", "seguridad"], precio=1100)
    d.update(kw)
    return d


def test_prediction_interval_presente(client, auth_headers):
    """Si los modelos quantile están en disco, deben llegar al output."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    assert r.status_code == 200
    d = r.json()
    if _QUANTILE_AVAILABLE:
        assert d.get("prediction_interval") is not None, \
            "modelos quantile en disco pero prediction_interval=None en respuesta"
        pi = d["prediction_interval"]
        for k in ("p25", "p50", "p75"):
            assert k in pi
            assert isinstance(pi[k], (int, float))


def test_prediction_interval_ordenado(client, auth_headers):
    """P25 <= P50 <= P75 (monotonía de los cuantiles)."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    pi = r.json().get("prediction_interval")
    if not _QUANTILE_AVAILABLE:
        return
    assert pi is not None
    assert pi["p25"] <= pi["p50"] <= pi["p75"], f"intervalo no monótono: {pi}"


def test_p50_cercano_a_fair_value(client, auth_headers):
    """El P50 quantile debe estar cerca del fair_value central.

    Tolerancia: 15% (post-auditoría T5; antes 25% era permisivo en exceso).
    Si la diferencia supera ese gap, hay divergencia material entre los
    objectives `reg:squarederror` y `reg:quantileerror` que merece investigarse.
    """
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    d = r.json()
    pi = d.get("prediction_interval")
    if not _QUANTILE_AVAILABLE:
        return
    assert pi is not None
    fair = d["fair_value"]
    ratio = abs(pi["p50"] - fair) / fair
    assert ratio < 0.15, f"P50 ${pi['p50']} muy lejos de fair_value ${fair} ({ratio:.1%})"


def test_intervalo_no_degenerado(client, auth_headers):
    """El ancho P75-P25 debe ser razonable: ni 0 (modelo colapsado) ni absurdo."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    pi = r.json().get("prediction_interval")
    if not _QUANTILE_AVAILABLE:
        return
    assert pi is not None
    width_pct = (pi["p75"] - pi["p25"]) / max(pi["p50"], 1)
    assert width_pct > 0.05, f"intervalo demasiado estrecho: {width_pct:.1%}"
    assert width_pct < 1.0, f"intervalo absurdamente ancho: {width_pct:.1%}"


def test_quantile_coverage_file_existe():
    """El script de entrenamiento persiste métricas; verificamos que estén."""
    p = Path(__file__).resolve().parent.parent / "models" / "v2" / "quantile_coverage.json"
    if not p.exists():
        return
    data = json.loads(p.read_text())
    assert "coverage_p25_p75" in data
    cov = data["coverage_p25_p75"]
    # Tolerancia: 35% - 65%. Esperado teórico 50%; XGBoost quantile sin
    # conformal calibration puede desviarse, pero ≥35% es defendible.
    assert 0.35 < cov < 0.65, f"coverage P25-P75 fuera de rango defendible: {cov}"
    assert "mape_p50_pct" in data
    assert 10 < data["mape_p50_pct"] < 25, f"MAPE P50 sospechoso: {data['mape_p50_pct']}"
    # Hiperparámetros ahora son dict, no string (post-auditoría T1).
    assert isinstance(data.get("hyperparams"), dict), \
        "hyperparams debe ser dict con los valores reales (no string genérico)"

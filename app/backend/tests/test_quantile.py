"""Tests del intervalo de predicción P25/P50/P75 (Sprint 3.1).

Verifican: presencia en PredictOut, ordenamiento P25 ≤ P50 ≤ P75, y consistencia
del centro (P50 cercano a fair_value).
"""
import json
from pathlib import Path


def _payload(**kw):
    d = dict(lat=-12.121, lng=-77.030, area=80, dormitorios=2, banos=2,
             es_estudio=False, cocheras=1, antiguedad_anios=10,
             amenities=["ascensor", "seguridad"], precio=1100)
    d.update(kw)
    return d


def test_prediction_interval_presente(client, auth_headers):
    """Solo si hay quantile models cargados (v2 + xgb_q*_v2.joblib)."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    assert r.status_code == 200
    d = r.json()
    # En v2 con modelos cargados debe estar; en v1 puede ser None.
    if d.get("prediction_interval"):
        pi = d["prediction_interval"]
        for k in ("p25", "p50", "p75"):
            assert k in pi
            assert isinstance(pi[k], (int, float))


def test_prediction_interval_ordenado(client, auth_headers):
    """P25 <= P50 <= P75 (monotonía de los cuantiles)."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    pi = r.json().get("prediction_interval")
    if pi:
        assert pi["p25"] <= pi["p50"] <= pi["p75"], f"intervalo no monótono: {pi}"


def test_p50_cercano_a_fair_value(client, auth_headers):
    """El P50 quantile debe estar cerca del fair_value central (mismo training set,
    objetivo equivalente). Tolerancia: 25% — los hiperparámetros del quantile son
    distintos al central, así que un poco de gap es esperable."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    d = r.json()
    pi = d.get("prediction_interval")
    if pi:
        fair = d["fair_value"]
        ratio = abs(pi["p50"] - fair) / fair
        assert ratio < 0.25, f"P50 ${pi['p50']} muy lejos de fair_value ${fair} ({ratio:.1%})"


def test_intervalo_no_degenerado(client, auth_headers):
    """El ancho P75-P25 debe ser razonable: ni 0 (modelo colapsado) ni absurdamente grande."""
    r = client.post("/api/fairvalue/predict", headers=auth_headers, json=_payload())
    pi = r.json().get("prediction_interval")
    if pi:
        width_pct = (pi["p75"] - pi["p25"]) / max(pi["p50"], 1)
        assert width_pct > 0.05, f"intervalo demasiado estrecho: {width_pct:.1%}"
        assert width_pct < 1.0, f"intervalo absurdamente ancho: {width_pct:.1%}"


def test_quantile_coverage_file_existe():
    """El script de entrenamiento persiste métricas; verificamos que estén."""
    p = Path(__file__).resolve().parent.parent / "models" / "v2" / "quantile_coverage.json"
    if not p.exists():
        # En v1 o sin quantile entrenado, este test no aplica.
        return
    data = json.loads(p.read_text())
    assert "coverage_p25_p75" in data
    cov = data["coverage_p25_p75"]
    # Tolerancia amplia: 30% - 70%. El esperado teórico es 50%, pero XGBoost
    # quantile sin conformal puede desviarse.
    assert 0.30 < cov < 0.70, f"coverage P25-P75 fuera de rango razonable: {cov}"
    assert "mape_p50_pct" in data
    assert 10 < data["mape_p50_pct"] < 25, f"MAPE P50 sospechoso: {data['mape_p50_pct']}"

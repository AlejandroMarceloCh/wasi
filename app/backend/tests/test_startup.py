"""Tests de validación de startup del modelo (Fase 0.5 / Fase 3 + v2).

Cubre el caso de ÉXITO en ambos modos y los dos de FALLA que aplican solo a
v1 (manifest/golden de la versión RandomForest); v2 valida contra sus
propios artefactos (manifest_v2/golden_v2).
"""
import json
import shutil

import pytest

import wasi.models.model_service as model_service_module
from wasi.models.model_service import MODELS, MODELS_V2, USE_V2, ModelService

def test_startup_exito():
    """Camino feliz: el modelo carga (v1 con 74 features o v2 con ~95)."""
    ms = ModelService()
    ms.load()
    assert ms.is_loaded
    assert ms.version != "unloaded"
    if USE_V2:
        assert ms.mode == "v2"
        assert len(ms.feature_order) >= 80
        assert "estrato_nse" in ms.feature_order
        assert "n_comisarias_distrito" in ms.feature_order
    else:
        assert ms.mode == "v1"
        assert len(ms.feature_order) == 74

@pytest.mark.skipif(USE_V2, reason="manifest.json no se valida en modo v2")
def test_startup_falla_manifest_adulterado():
    """v1 only: un hash que no coincide → RuntimeError (el backend no arranca)."""
    path = MODELS / "manifest.json"
    backup = path.read_text()
    try:
        data = json.loads(backup)
        primer = next(iter(data["artefactos"]))
        data["artefactos"][primer] = "0" * 64
        path.write_text(json.dumps(data))
        with pytest.raises(RuntimeError):
            ModelService().load()
    finally:
        path.write_text(backup)

@pytest.mark.skipif(USE_V2, reason="golden_prediction.json no se valida en modo v2")
def test_startup_falla_golden_incorrecto():
    """v1 only: un expected adulterado en golden_prediction → RuntimeError."""
    path = MODELS / "golden_prediction.json"
    backup = path.read_text()
    try:
        data = json.loads(backup)
        data["casos"][0]["expected"] *= 1.5
        path.write_text(json.dumps(data))
        with pytest.raises(RuntimeError):
            ModelService().load()
    finally:
        path.write_text(backup)

@pytest.mark.skipif(not USE_V2, reason="manifest_v2.json solo se valida en modo v2")
def test_startup_v2_falla_manifest_adulterado(monkeypatch, tmp_path):
    """v2: un hash que no coincide debe impedir cargar el modelo."""
    data = json.loads((MODELS_V2 / "manifest_v2.json").read_text())
    primer = next(iter(data["artefactos"]))
    shutil.copy2(MODELS_V2 / primer, tmp_path / primer)
    data["artefactos"][primer] = "0" * 64
    (tmp_path / "manifest_v2.json").write_text(json.dumps(data))

    monkeypatch.setattr(model_service_module, "MODELS_V2", tmp_path)
    with pytest.raises(RuntimeError):
        ModelService().load()

@pytest.mark.skipif(not USE_V2, reason="golden_prediction_v2.json solo se valida en modo v2")
def test_startup_v2_falla_golden_incorrecto(monkeypatch, tmp_path):
    """v2: un expected adulterado debe impedir cargar el modelo."""
    ms = ModelService()
    ms.load()

    data = json.loads((MODELS_V2 / "golden_prediction_v2.json").read_text())
    data["casos"][0]["expected"] *= 1.5
    (tmp_path / "golden_prediction_v2.json").write_text(json.dumps(data))

    monkeypatch.setattr(model_service_module, "MODELS_V2", tmp_path)
    with pytest.raises(RuntimeError):
        ms._check_golden_v2()

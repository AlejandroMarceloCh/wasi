"""Tests de validación de startup del modelo (Fase 0.5 / Fase 3 + v2).

Cubre el caso de ÉXITO en ambos modos y los dos de FALLA que aplican solo a
v1 (manifest/golden). En v2 (XGBoost con 95 features socio-eco) esas
validaciones se saltan porque corresponden al RF v1.
"""
import json

import pytest

from model_service import MODELS, USE_V2, ModelService


def test_startup_exito():
    """Camino feliz: el modelo carga (v1 con 74 features o v2 con ~95)."""
    ms = ModelService()
    ms.load()
    assert ms.is_loaded
    assert ms.version != "unloaded"
    if USE_V2:
        assert ms.mode == "v2"
        assert len(ms.feature_order) >= 80   # v2 tiene ~95 features
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

"""Serving seguro del modelo de venta (gate de la auditoría Babilonia).

Verifica el fail-fast: con manifest válido el modelo carga y sirve; si el hash
del .joblib no coincide con el manifest (modelo cambiado sin regenerar), venta se
deshabilita SIN tumbar el backend (aislamiento). La métrica se lee del manifest,
no hardcodeada.
"""
import json

import pytest

from wasi.models.venta_service import VentaService
from wasi.paths import VENTAS_BUNDLE, VENTAS_MANIFEST

_HAS_MODEL = VENTAS_BUNDLE.exists() and VENTAS_MANIFEST.exists()

pytestmark = pytest.mark.skipif(
    not _HAS_MODEL, reason="modelo/manifest de venta no presentes")


def test_venta_carga_y_valida_integridad():
    svc = VentaService()
    svc.load()
    assert svc.is_loaded(), "con manifest válido, venta debe cargar"
    # La métrica viene del manifest, no del hardcode.
    manifest = json.loads(VENTAS_MANIFEST.read_text())
    assert svc.mae_pct == manifest["metrica"]["mae_pct"]


def test_venta_hash_corrupto_deshabilita_sin_tumbar():
    """Si el .joblib cambió sin regenerar el manifest, no se sirve el modelo
    dudoso (is_loaded False) pero no se lanza excepción (backend sigue vivo)."""
    orig = VENTAS_MANIFEST.read_text()
    try:
        bad = json.loads(orig)
        bad["sha256"] = "0" * 64
        VENTAS_MANIFEST.write_text(json.dumps(bad))
        svc = VentaService()
        svc.load()  # no debe lanzar
        assert not svc.is_loaded(), "hash inválido → venta deshabilitada"
    finally:
        VENTAS_MANIFEST.write_text(orig)

    # Restaurado: vuelve a cargar.
    svc2 = VentaService()
    svc2.load()
    assert svc2.is_loaded()


def test_venta_golden_dentro_de_tolerancia():
    """Las predicciones actuales coinciden con el golden (si no, load fallaría)."""
    svc = VentaService()
    svc.load()
    assert svc.is_loaded()

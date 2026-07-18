"""
Centraliza todos los paths de artefactos del proyecto Wasi.
Todos los módulos importan de aquí; cero Path(__file__) dispersos.

Soporta WASI_REPO_ROOT como env var para override en Render.

Pre-migración R3+R4: data/ y models/ viven en app/backend/.
Post-migración R3+R4: viven en la raíz del repo.
paths.py detecta automáticamente cuál es el caso.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

def _find_root(start: Path) -> Path:
    """Sube desde start hasta encontrar pyproject.toml (raíz del repo)."""
    for p in [start, *start.parents]:
        if (p / "pyproject.toml").exists():
            return p
    raise RuntimeError(
        f"No se encontró pyproject.toml subiendo desde {start}. "
        "Definir WASI_REPO_ROOT como variable de entorno."
    )

_env_root = os.environ.get("WASI_REPO_ROOT", "")
REPO_ROOT: Path = Path(_env_root) if _env_root else _find_root(Path(__file__))

_BACKEND_DIR = REPO_ROOT / "app" / "backend"

DATA_DIR: Path = (
    REPO_ROOT / "data"
    if (REPO_ROOT / "data").exists()
    else _BACKEND_DIR / "data"
)
MODELS_DIR: Path = (
    REPO_ROOT / "models"
    if (REPO_ROOT / "models").exists()
    else _BACKEND_DIR / "models"
)

VENTAS_BUNDLE: Path = REPO_ROOT / "ventas_model" / "models" / "xgb_venta.joblib"
# Fail-fast del modelo de venta (mismo rigor que alquiler): manifest con hash
# SHA-256 + métrica, y golden de predicciones. Los genera generate_venta_artefacts.py.
VENTAS_MANIFEST: Path = REPO_ROOT / "ventas_model" / "models" / "manifest_venta.json"
VENTAS_GOLDEN: Path = REPO_ROOT / "ventas_model" / "models" / "golden_venta.json"
CONFIDENCE_THRESHOLDS: Path = (
    MODELS_DIR / "v2" / "confidence_thresholds.json"
    if (MODELS_DIR / "v2" / "confidence_thresholds.json").exists()
    else _BACKEND_DIR / "confidence_thresholds.json"
)

MODELS_V2_DIR: Path = MODELS_DIR / "v2"
EXTERNAL_DATA_DIR: Path = DATA_DIR / "external"

def _check_paths() -> None:
    critical = {
        "VENTAS_BUNDLE": VENTAS_BUNDLE,
        "CONFIDENCE_THRESHOLDS": CONFIDENCE_THRESHOLDS,
        "MODELS_V2_DIR": MODELS_V2_DIR,
    }
    for name, p in critical.items():
        if not p.exists():
            logger.warning("wasi.paths: %s no encontrado en %s", name, p)
    logger.debug(
        "wasi.paths: REPO_ROOT=%s DATA_DIR=%s MODELS_DIR=%s",
        REPO_ROOT, DATA_DIR, MODELS_DIR,
    )

_check_paths()

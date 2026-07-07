"""Endpoints de observabilidad — health check + model info.

Sprint 2.1: rúbrica DS3022 U4_T2 slide 4 "Métricas de Software".
- GET /api/health        → liveness + version del modelo
- GET /api/model/info    → metadata del modelo (entrenamiento, métricas, features)

Ningún endpoint requiere auth: monitoring tools (uptime, kubernetes probes)
deben poder consultar sin token.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List, Optional

from fastapi import APIRouter, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import wasi.models.ml as ml
from wasi.models.model_service import model_service
from wasi.models.venta_service import venta_service
from wasi.paths import DATA_DIR, MODELS_DIR

router = APIRouter(prefix="/api", tags=["observability"])

_STARTED_AT = time.time()

class HealthOut(BaseModel):
    model_config = {"protected_namespaces": ()}
    status: str
    model_mode: str
    model_version: str
    venta_model_loaded: bool
    uptime_seconds: int

class ModelMetrics(BaseModel):
    r2: float
    mae_usd: float
    mape_pct: float
    rmse_usd: Optional[float] = None

class ModelInfoOut(BaseModel):
    mode: str
    version: str
    name: Optional[str]
    n_features: int
    trained_at: Optional[str]
    days_since_training: Optional[int]
    dataset_period: str
    metrics: ModelMetrics

def _modelo_principal_path() -> Path | None:
    """Path al .joblib activo, según el modo del model_service."""
    if model_service.mode == "v2":
        p = MODELS_DIR / "v2" / "modelo_final_v2.joblib"
    else:
        p = MODELS_DIR / "04_random_forest.joblib"
    return p if p.exists() else None

def _trained_at_iso() -> Optional[str]:
    """ISO 8601 del mtime del .joblib activo."""
    p = _modelo_principal_path()
    if p is None:
        return None
    ts = datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc)
    return ts.isoformat()

_DISTRITOS_PATH = DATA_DIR / "distritos_zona.json"
_distritos_cache: Optional[List[Any]] = None

@router.get("/distritos-zona")
def distritos_zona():
    """Zonas de precio por distrito (ganga/justo/inflado). No requiere auth."""
    global _distritos_cache
    if _distritos_cache is None and _DISTRITOS_PATH.exists():
        _distritos_cache = json.loads(_DISTRITOS_PATH.read_text())
    return JSONResponse(_distritos_cache or [])

@router.get("/health", response_model=HealthOut)
def health(response: Response):
    """Liveness probe. No requiere auth. 503 si el modelo (alquiler) no está
    cargado. El estado de venta se reporta pero no tumba el health: el producto
    principal funciona aunque venta esté caído."""
    is_ok = model_service.is_loaded
    if not is_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    try:
        venta_ok = venta_service.is_loaded()
    except Exception:
        venta_ok = False
    return HealthOut(
        status="ok" if is_ok else "degraded",
        model_mode=model_service.mode,
        model_version=model_service.version,
        venta_model_loaded=venta_ok,
        uptime_seconds=int(time.time() - _STARTED_AT),
    )

@router.get("/model/info", response_model=ModelInfoOut)
def model_info():
    """Metadata del modelo en producción — entrenamiento, features, métricas."""
    trained_at = _trained_at_iso()
    days_since = None
    if trained_at:
        delta = datetime.now(tz=timezone.utc) - datetime.fromisoformat(trained_at)
        days_since = max(0, delta.days)

    return ModelInfoOut(
        mode=model_service.mode,
        version=model_service.version,
        name=model_service._model_name,
        n_features=len(model_service.feature_order),
        trained_at=trained_at,
        days_since_training=days_since,

        dataset_period="2026-02 .. 2026-04",
        metrics=ModelMetrics(
            r2=float(ml.MODEL_R2),
            mae_usd=float(ml.MODEL_MAE_USD),
            mape_pct=float(ml.MODEL_MAE_PCT),

            rmse_usd=None,
        ),
    )

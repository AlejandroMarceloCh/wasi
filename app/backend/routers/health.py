"""Endpoints de observabilidad — health check + model info.

Sprint 2.1: rúbrica DS3022 U4_T2 slide 4 "Métricas de Software".
- GET /api/health        → liveness + version del modelo
- GET /api/model/info    → metadata del modelo (entrenamiento, métricas, features)

Ningún endpoint requiere auth: monitoring tools (uptime, kubernetes probes)
deben poder consultar sin token.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

import ml
from model_service import model_service

router = APIRouter(prefix="/api", tags=["observability"])

# Timestamp de arranque del proceso (para uptime).
_STARTED_AT = time.time()


# ── Schemas ────────────────────────────────────────────────────────────────
# protected_namespaces=() evita warning de Pydantic v2 cuando un campo
# empieza con "model_" (su namespace reservado).
class HealthOut(BaseModel):
    model_config = {"protected_namespaces": ()}
    status: str                       # "ok" | "degraded"
    model_mode: str                   # "v1" | "v2"
    model_version: str
    uptime_seconds: int


class ModelMetrics(BaseModel):
    r2: float
    mae_usd: float
    mape_pct: float                   # = MODEL_MAE_PCT
    rmse_usd: Optional[float] = None  # informativo


class ModelInfoOut(BaseModel):
    mode: str
    version: str
    name: Optional[str]
    n_features: int
    trained_at: Optional[str]         # ISO 8601
    days_since_training: Optional[int]
    dataset_period: str               # rango de fechas del scraping
    metrics: ModelMetrics


# ── Helpers ────────────────────────────────────────────────────────────────
def _modelo_principal_path() -> Path | None:
    """Path al .joblib activo, según el modo del model_service."""
    backend_dir = Path(__file__).resolve().parent.parent
    if model_service.mode == "v2":
        p = backend_dir / "models" / "v2" / "modelo_final_v2.joblib"
    else:
        p = backend_dir / "models" / "04_random_forest.joblib"
    return p if p.exists() else None


def _trained_at_iso() -> Optional[str]:
    """ISO 8601 del mtime del .joblib activo."""
    p = _modelo_principal_path()
    if p is None:
        return None
    ts = datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc)
    return ts.isoformat()


# ── Endpoints ─────────────────────────────────────────────────────────────
@router.get("/health", response_model=HealthOut)
def health():
    """Liveness probe. No requiere auth."""
    is_ok = model_service.is_loaded
    return HealthOut(
        status="ok" if is_ok else "degraded",
        model_mode=model_service.mode,
        model_version=model_service.version,
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
        # Listings scrapeados durante feb-abr 2026 (3,348 avisos reales de Lima).
        dataset_period="2026-02 .. 2026-04",
        metrics=ModelMetrics(
            r2=float(ml.MODEL_R2),
            mae_usd=float(ml.MODEL_MAE_USD),
            mape_pct=float(ml.MODEL_MAE_PCT),
            # RMSE no se guarda en ml.py; lo dejamos None hasta exponerlo.
            rmse_usd=None,
        ),
    )

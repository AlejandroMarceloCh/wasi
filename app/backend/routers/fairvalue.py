"""Predicción de precio de referencia, lectura y guardado de análisis."""
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from geo_index import OutOfBoundsError
import ml  # ml.MODEL_R2 / MODEL_MAE_USD / MODEL_MAE_PCT son LAZY via __getattr__
from ml import predict_fair_value
from models import Analysis, AnalysisFactor, Property, Report, User
from routers.dashboard import _time_ago
from schemas import Counterfactual, Factor, PredictIn, PredictOut, RecentItem, SaveOut

router = APIRouter(prefix="/api", tags=["fairvalue"])


def _analysis_to_out(a: Analysis) -> PredictOut:
    """Reconstruye PredictOut desde un Analysis persistido (historial)."""
    fair = float(a.fair_value)
    delta = fair * (float(a.mae_pct) / 100)
    warnings = []
    if a.fallback_reason == "low_density":
        warnings.append("Pocos comparables en 1 km; se usó el promedio del distrito.")
    elif a.fallback_reason == "no_coverage":
        warnings.append("Sin comparables dentro de 5 km; estimación de baja confianza.")
    return PredictOut(
        analysis_id=a.id,
        fair_value=fair,
        announced_price=float(a.announced_price),
        diff=float(a.diff or 0),
        diff_pct=float(a.diff_pct or 0),
        zone=a.zone or "Justo",
        confidence=a.confidence,
        n_comparables=a.n_comparables,
        coverage_radius_km=float(a.coverage_radius_km or 0),
        model_r2=ml.MODEL_R2,           # lazy via ml.__getattr__
        model_mae=ml.MODEL_MAE_USD,     # lazy via ml.__getattr__
        mae_pct=float(a.mae_pct),
        min=round(fair - delta, 2),
        max=round(fair + delta, 2),
        factors=[Factor(label=f.label, score=f.score, positive=f.positive)
                 for f in a.factors],
        predicted_in_seconds=0.0,
        warnings=warnings,
        fallback_reason=a.fallback_reason,
        version=a.model_version,
        distrito=a.property.district,
    )


@router.post("/fairvalue/predict", response_model=PredictOut)
def predict(
    payload: PredictIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    # Inferencia. El pin fuera del bbox de Lima → 400.
    try:
        res = predict_fair_value(payload.model_dump())
    except OutOfBoundsError:
        raise HTTPException(
            status_code=400,
            detail="Por ahora solo cubrimos Lima Metropolitana. Mueve el pin a un punto dentro de Lima e intenta de nuevo.",
        )

    # Persistir el inmueble analizado.
    prop = Property(
        district=res["distrito"],
        lat=payload.lat, lng=payload.lng,
        area_m2=payload.area,
        dormitorios=payload.dormitorios, banos=payload.banos,
        cocheras=payload.cocheras, antiguedad_anios=payload.antiguedad_anios,
        es_estudio=payload.es_estudio,
        amenities=",".join(payload.amenities),
    )
    db.add(prop)
    db.flush()

    # Persistir el análisis (la zona/diff las calcula ml.py, no la BD).
    analysis = Analysis(
        user_id=current.id, property_id=prop.id,
        announced_price=res["announced_price"],
        fair_value=res["fair_value"],
        diff=res["diff"], diff_pct=res["diff_pct"], zone=res["zone"],
        mae_pct=res["mae_pct"], confidence=res["confidence"],
        n_comparables=res["n_comparables"],
        coverage_radius_km=res["coverage_radius_km"],
        fallback_reason=res["fallback_reason"],
        model_version=res["version"],
    )
    db.add(analysis)
    db.flush()

    for idx, f in enumerate(res["factors"]):
        db.add(AnalysisFactor(
            analysis_id=analysis.id, label=f["label"],
            score=f["score"], positive=f["positive"], order_idx=idx))

    # Actividad del usuario (antes lo hacía un trigger PL/pgSQL).
    current.last_activity_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(analysis)

    out = _analysis_to_out(analysis)
    out.predicted_in_seconds = res["predicted_in_seconds"]
    out.warnings = res["warnings"]
    # Contrafactuales (Sprint 2.2): no se persisten en BD — son derivables del
    # form + modelo, no histórico. Se calculan en cada predict.
    out.counterfactuals = [Counterfactual(**cf) for cf in res.get("counterfactuals", [])]
    return out


@router.get("/analyses", response_model=List[RecentItem])
def list_analyses(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Lista TODOS los análisis del usuario (ordenados por fecha desc).
    Se usa en el modal de 'Análisis recientes' del dashboard, donde el
    frontend filtra por zona y pagina cliente-side."""
    rows = db.execute(
        select(Analysis, Property)
        .join(Property, Property.id == Analysis.property_id)
        .where(Analysis.user_id == current.id)
        .order_by(Analysis.created_at.desc())
    ).all()
    return [
        RecentItem(
            id=a.id,
            address=f"Inmueble en {p.district}",
            district=p.district,
            time=_time_ago(a.created_at),
            diff_pct=float(a.diff_pct or 0),
            fair_value=float(a.fair_value or 0),
            zone=a.zone or "Justo",
            kind="analysis",
        )
        for a, p in rows
    ]


@router.get("/analyses/{analysis_id}", response_model=PredictOut)
def get_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    a = db.get(Analysis, analysis_id)
    if not a or a.user_id != current.id:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    return _analysis_to_out(a)


@router.post("/analyses/{analysis_id}/save", response_model=SaveOut)
def save_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    a = db.get(Analysis, analysis_id)
    if not a or a.user_id != current.id:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    existing = db.execute(
        select(Report).where(Report.analysis_id == analysis_id)
    ).scalar_one_or_none()
    if existing:
        return SaveOut(report_id=existing.id)
    rep = Report(user_id=current.id, analysis_id=analysis_id)
    db.add(rep)
    db.commit()
    db.refresh(rep)
    return SaveOut(report_id=rep.id)

"""Endpoint del dashboard: stats, recientes, cobertura y próximo paso."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Analysis, District, Property, Report, User
from schemas import (
    CoverageItem, DashboardOut, DashStats, NextStep, RecentItem, UserOut,
)

router = APIRouter(prefix="/api", tags=["dashboard"])


def _time_ago(dt: datetime) -> str:
    """String corto tipo 'hace 2h' / 'hace 3d'."""
    if not dt:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    secs = int((datetime.now(timezone.utc) - dt).total_seconds())
    if secs < 60:
        return "hace un momento"
    if secs < 3600:
        return f"hace {secs // 60}m"
    if secs < 86400:
        return f"hace {secs // 3600}h"
    return f"hace {secs // 86400}d"


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    # ---- Stats del usuario ----
    analyses_count = db.scalar(
        select(func.count(Analysis.id)).where(Analysis.user_id == current.id)
    ) or 0
    reports_count = db.scalar(
        select(func.count(Report.id)).where(Report.user_id == current.id)
    ) or 0
    avg_savings = db.scalar(
        select(func.coalesce(func.avg(func.abs(Analysis.diff)), 0.0)).where(
            Analysis.user_id == current.id, Analysis.zone == "Inflado")
    ) or 0.0

    # ---- Recientes (top 6) ----
    rows = db.execute(
        select(Analysis, Property)
        .join(Property, Property.id == Analysis.property_id)
        .where(Analysis.user_id == current.id)
        .order_by(Analysis.created_at.desc())
        .limit(6)
    ).all()
    recent = [
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

    # ---- Cobertura por distrito ----
    cov_rows = db.execute(
        select(District.name, District.listings_count, District.coverage_level)
        .order_by(District.listings_count.desc())
    ).all()
    coverage = [CoverageItem(name=r[0], listings=r[1], level=r[2]) for r in cov_rows]

    # ---- Próximo paso: análisis con mayor sobreprecio sin reporte ----
    next_row = db.execute(
        select(Analysis, Property)
        .join(Property, Property.id == Analysis.property_id)
        .outerjoin(Report, Report.analysis_id == Analysis.id)
        .where(Analysis.user_id == current.id,
               Analysis.zone == "Inflado", Report.id.is_(None))
        .order_by(func.abs(Analysis.diff).desc())
        .limit(1)
    ).first()
    if next_row:
        a, p = next_row
        next_step = NextStep(
            address=f"Inmueble en {p.district}",
            sobreprecio_amount=float(abs(a.diff or 0)),
            analysis_id=a.id,
        )
    else:
        next_step = NextStep()

    return DashboardOut(
        user=UserOut.model_validate(current),
        stats=DashStats(
            analyses_count=int(analyses_count),
            reports_count=int(reports_count),
            avg_savings=round(float(avg_savings), 2),
        ),
        recent=recent,
        coverage=coverage,
        next_step=next_step,
        last_activity_at=_time_ago(current.last_activity_at),
    )

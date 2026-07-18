"""Planes Pro (simulado, sin cobro real).

Activa/cancela el plan Pro del usuario. No hay pasarela de pago: `subscribe`
marca Pro sin vencimiento y `trial` da 14 días. El límite de análisis del plan
Free se aplica en el endpoint de predicción (ver plan.py).
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import User
from plan import TRIAL_DAYS, is_pro
from ratelimit import limiter
from schemas import PlanStateOut

router = APIRouter(prefix="/api/billing", tags=["billing"])


def _state(user: User) -> PlanStateOut:
    return PlanStateOut(
        plan=user.plan,
        is_pro=is_pro(user),
        trial_ends_at=user.trial_ends_at,
    )


@router.post("/trial", response_model=PlanStateOut)
@limiter.limit("10/minute")
def start_trial(request: Request, db: Session = Depends(get_db),
                current: User = Depends(get_current_user)):
    """Inicia el trial Pro de 14 días. 409 si ya tiene Pro vigente."""
    if is_pro(current):
        raise HTTPException(status_code=409, detail="Ya tienes el plan Pro activo.")
    current.plan = "pro"
    current.trial_ends_at = datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)
    db.commit()
    db.refresh(current)
    return _state(current)


@router.post("/subscribe", response_model=PlanStateOut)
@limiter.limit("10/minute")
def subscribe(request: Request, db: Session = Depends(get_db),
              current: User = Depends(get_current_user)):
    """Activa Pro sin vencimiento (suscripción simulada, sin cobro real)."""
    current.plan = "pro"
    current.trial_ends_at = None
    db.commit()
    db.refresh(current)
    return _state(current)


@router.post("/cancel", response_model=PlanStateOut)
@limiter.limit("10/minute")
def cancel(request: Request, db: Session = Depends(get_db),
           current: User = Depends(get_current_user)):
    """Vuelve al plan Free."""
    current.plan = "free"
    current.trial_ends_at = None
    db.commit()
    db.refresh(current)
    return _state(current)

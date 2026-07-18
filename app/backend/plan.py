"""Lógica de planes (Free / Pro) y límite de análisis.

Pro es simulado: no hay cobro real. Un usuario es Pro si `plan == "pro"` y su
trial no venció (o no tiene trial = suscripción sin vencimiento). Free tiene un
tope de análisis por mes; Pro es ilimitado.
"""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models import Analysis, User

# Tope de análisis mensuales del plan Free. Pro = ilimitado.
FREE_MONTHLY_LIMIT = 5
# Duración del trial Pro.
TRIAL_DAYS = 14


def _as_utc(dt: datetime) -> datetime:
    """Normaliza a aware-UTC. Los datetimes del ORM se guardan naive-UTC."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def is_pro(user: User, now: datetime = None) -> bool:
    """True si el usuario tiene Pro vigente. Un trial vencido cuenta como free."""
    if (user.plan or "free").lower() != "pro":
        return False
    if user.trial_ends_at is None:
        return True  # suscripción sin vencimiento
    now = now or datetime.now(timezone.utc)
    return _as_utc(user.trial_ends_at) > now


def _month_start(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def analyses_this_month(db: Session, user_id: int, now: datetime = None) -> int:
    """Cuántos análisis creó el usuario en el mes calendario actual (UTC)."""
    now = now or datetime.now(timezone.utc)
    n = db.scalar(
        select(func.count(Analysis.id)).where(
            Analysis.user_id == user_id,
            Analysis.created_at >= _month_start(now),
        )
    )
    return int(n or 0)


def analyses_limit(user: User, now: datetime = None):
    """Tope mensual de análisis. None = ilimitado (Pro)."""
    return None if is_pro(user, now) else FREE_MONTHLY_LIMIT


def can_analyze(db: Session, user: User, now: datetime = None) -> bool:
    """¿Puede crear un análisis más este mes?"""
    limit = analyses_limit(user, now)
    if limit is None:
        return True
    return analyses_this_month(db, user.id, now) < limit

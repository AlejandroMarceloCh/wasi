"""Notificaciones in-app del usuario.

Hoy el único disparador es un lead nuevo sobre un inmueble del propietario
(ver `create_lead` en listings.py). El endpoint sirve la bandeja, el contador
de no leídas (badge de la campana) y el marcado como leídas.
"""
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Notification, User
from schemas import NotificationOut, UnreadCountOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

# Techo de la bandeja: las notificaciones son un feed, no un historial infinito.
_LIMIT = 50


def _to_out(n: Notification) -> NotificationOut:
    return NotificationOut(
        id=n.id, type=n.type, title=n.title, body=n.body,
        listing_id=n.listing_id, read=n.read_at is not None,
        created_at=n.created_at,
    )


@router.get("", response_model=List[NotificationOut])
def list_notifications(db: Session = Depends(get_db),
                       current: User = Depends(get_current_user)):
    """Notificaciones del usuario, más recientes primero (máx. 50)."""
    rows = db.execute(
        select(Notification)
        .where(Notification.user_id == current.id)
        .order_by(Notification.created_at.desc())
        .limit(_LIMIT)
    ).scalars().all()
    return [_to_out(n) for n in rows]


@router.get("/unread-count", response_model=UnreadCountOut)
def unread_count(db: Session = Depends(get_db),
                 current: User = Depends(get_current_user)):
    """Cantidad de no leídas — alimenta el badge de la campana."""
    n = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == current.id,
            Notification.read_at.is_(None),
        )
    ) or 0
    return UnreadCountOut(unread=int(n))


@router.post("/read-all", response_model=UnreadCountOut)
def mark_all_read(db: Session = Depends(get_db),
                  current: User = Depends(get_current_user)):
    """Marca todas las no leídas como leídas. Idempotente. Se llama al abrir la
    campana. Un UPDATE en bloque (no N queries)."""
    db.execute(
        update(Notification)
        .where(Notification.user_id == current.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(timezone.utc))
    )
    db.commit()
    return UnreadCountOut(unread=0)

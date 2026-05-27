"""Endpoints de autenticación: register, login, me."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database import get_db
from models import Analysis, Property, Report, User
from schemas import (
    RegisterIn, LoginIn, AuthOut, UserOut, MeOut, ReportItem, UpdateMeIn,
)
from auth import hash_password, verify_password, create_access_token, get_current_user

# Roles válidos para el perfil — el form del frontend ofrece estos tres
VALID_ROLES = {"Inquilino", "Propietario", "Agente inmobiliario"}

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    """Crea un usuario nuevo. Devuelve 409 si el email ya existe."""
    existing = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El correo ya está registrado")
    user = User(
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
        plan="free",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, user.email)
    return AuthOut(token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=AuthOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    """Verifica credenciales y emite JWT."""
    user = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    token = create_access_token(user.id, user.email)
    return AuthOut(token=token, user=UserOut.model_validate(user))


# Endpoint /me fuera del prefix /api/auth — montado aparte
me_router = APIRouter(prefix="/api", tags=["me"])


def _build_me(db: Session, current: User) -> MeOut:
    """Arma la respuesta de /me: usuario + conteos + reportes guardados.

    Los conteos usan las mismas queries que el dashboard — fuente única de
    verdad para que perfil y dashboard nunca diverjan.
    """
    analyses_count = db.scalar(
        select(func.count(Analysis.id)).where(Analysis.user_id == current.id)
    ) or 0
    reports_count = db.scalar(
        select(func.count(Report.id)).where(Report.user_id == current.id)
    ) or 0

    # Lista de reportes guardados (Report → Analysis → Property para el distrito)
    report_rows = db.execute(
        select(Report, Property)
        .join(Analysis, Analysis.id == Report.analysis_id)
        .join(Property, Property.id == Analysis.property_id)
        .where(Report.user_id == current.id)
        .order_by(Report.saved_at.desc())
    ).all()
    reports = [
        ReportItem(
            id=r.id,
            analysis_id=r.analysis_id,
            address=f"Inmueble en {p.district}",
            date=r.saved_at.strftime("%d/%m/%Y") if r.saved_at else "—",
        )
        for r, p in report_rows
    ]

    return MeOut(
        user=UserOut.model_validate(current),
        plan=current.plan,
        last_activity_at=current.last_activity_at,
        analyses_count=int(analyses_count),
        reports_count=int(reports_count),
        reports=reports,
    )


@me_router.get("/me", response_model=MeOut)
def me(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    return _build_me(db, current)


@me_router.patch("/me", response_model=MeOut)
def update_me(
    payload: UpdateMeIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Actualiza campos editables del perfil (nombre, rol)."""
    if payload.name is not None:
        current.name = payload.name.strip()
    if payload.role is not None:
        if payload.role not in VALID_ROLES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Rol inválido. Opciones: {', '.join(sorted(VALID_ROLES))}",
            )
        current.role = payload.role
    db.commit()
    db.refresh(current)
    return _build_me(db, current)

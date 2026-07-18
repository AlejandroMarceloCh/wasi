"""Endpoints de autenticación: register, login, me."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from ratelimit import limiter
from models import Analysis, Property, Report, User
from schemas import (
    RegisterIn, LoginIn, AuthOut, RegisterOut, UserOut, MeOut, ReportItem, UpdateMeIn,
)
from auth import hash_password, verify_password, create_access_token, get_current_user
from plan import analyses_limit, analyses_this_month, is_pro

VALID_ROLES = {"Inquilino", "Propietario", "Agente inmobiliario"}

# #7/#19 — mensaje idéntico exista o no la cuenta: es lo que cierra la
# enumeración de emails. No cambiar por copies distintos según el caso.
REGISTER_GENERIC_MSG = (
    "Si el correo está disponible, tu cuenta fue creada. Inicia sesión para continuar."
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=RegisterOut, status_code=201)
@limiter.limit("10/minute")
def register(request: Request, payload: RegisterIn, db: Session = Depends(get_db)):
    """Registra un usuario SIN revelar si el correo ya existía (#7/#19).

    Antes devolvía 409 "El correo ya está registrado" → confirmaba la
    existencia de una cuenta (enumeración de emails). Ahora la respuesta es
    genérica e **idéntica** en ambos casos (correo nuevo o ya registrado):
    no se emite token ni datos de usuario y no se puede distinguir "creado"
    de "ya existe". El cliente hace login automático tras el registro; si el
    correo ya existía con otra contraseña, el login falla con el error
    genérico de credenciales, sin filtrar que la cuenta existe.

    Nota: el rol inválido sí devuelve 422 — es validación de input, no revela
    nada sobre el correo.
    """
    email = str(payload.email).strip().lower()
    role = payload.role or "Inquilino"
    if role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Rol inválido. Opciones: {', '.join(sorted(VALID_ROLES))}")

    existing = db.execute(select(User).where(func.lower(User.email) == email)).scalar_one_or_none()
    if existing is None:
        user = User(
            email=email,
            name=payload.name,
            password_hash=hash_password(payload.password),
            plan="free",
            role=role,
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            # Carrera: otro request creó el correo entre el SELECT y el commit.
            # Respuesta genérica igual → tampoco revela nada.
            db.rollback()
    return RegisterOut(message=REGISTER_GENERIC_MSG)

@router.post("/login", response_model=AuthOut)
@limiter.limit("5/minute")
def login(request: Request, payload: LoginIn, db: Session = Depends(get_db)):
    """Verifica credenciales y emite JWT."""
    email = str(payload.email).strip().lower()
    user = db.execute(select(User).where(func.lower(User.email) == email)).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    token = create_access_token(user.id, user.email)
    return AuthOut(token=token, user=UserOut.model_validate(user))

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
        is_pro=is_pro(current),
        trial_ends_at=current.trial_ends_at,
        analyses_this_month=analyses_this_month(db, current.id),
        analyses_limit=analyses_limit(current),
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
        current.name = payload.name
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

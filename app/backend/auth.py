"""Hash de contraseñas, emisión y validación de JWT.

Modelo de amenaza (#18): el JWT se guarda en localStorage del navegador, así
que un XSS exitoso puede robarlo y usarlo hasta que expire. Mitigaciones
vigentes: (1) `exp` corto (jwt_expire_days, default 1 día) acota la ventana;
(2) lista blanca estricta de algoritmo (HS256/384/512, nada de 'none'); (3)
secreto mínimo 32 chars validado al arranque; (4) logout cliente-side limpia
el token del storage. Deuda arquitectural DEFERIDA al humano: revocación
real (blacklist/estado en DB) o refresh tokens — ambas requieren decisión de
producto e infra, fuera del alcance de este hardening.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db, settings
from models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: int, email: str) -> str:
    """Emite JWT con expiración configurable."""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algo)

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algo])
    except jwt.PyJWTError:
        return None

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Dependency: valida el token y devuelve el usuario."""
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token requerido")
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    user = db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    return user

"""Conexión a la base de datos.

Por defecto usa SQLite (un archivo, cero setup — la BD viaja con el proyecto).
Para usar PostgreSQL basta definir DATABASE_URL en el entorno o en .env.
El código es agnóstico del motor: el ORM (models.py) genera el DDL correcto.
"""
import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_DEFAULT = f"sqlite:///{os.path.join(BACKEND_DIR, 'wasi.db')}"

class Settings(BaseSettings):
    """Variables de entorno (.env)."""
    database_url: str = SQLITE_DEFAULT

    jwt_secret: str
    jwt_algo: str = "HS256"
    jwt_expire_days: int = 7
    groq_api_key: str = ""

    @field_validator("jwt_secret")
    @classmethod
    def _jwt_secret_fuerte(cls, v: str) -> str:
        """Un secreto HS256 corto es crackeable por fuerza bruta: con él
        cualquiera puede forjar un JWT para cualquier user_id. Mínimo 32 chars.
        Falla en el arranque (no firma tokens con un secreto débil)."""
        if len(v) < 32:
            raise ValueError(
                "JWT_SECRET debe tener al menos 32 caracteres. "
                "Genera uno con: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        return v

    @field_validator("jwt_algo")
    @classmethod
    def _jwt_algo_permitido(cls, v: str) -> str:
        """Solo algoritmos HMAC simétricos. Evita 'none' (tokens sin firma) o
        un algoritmo asimétrico mal configurado que rompería la verificación."""
        if v not in {"HS256", "HS384", "HS512"}:
            raise ValueError("JWT_ALGO debe ser HS256, HS384 o HS512.")
        return v

    model_config = SettingsConfigDict(
        env_file=os.path.join(BACKEND_DIR, ".env"),
        case_sensitive=False,
        extra="ignore",
    )

settings = Settings()

_connect_args = (
    {"check_same_thread": False}
    if settings.database_url.startswith("sqlite")
    else {}
)
engine = create_engine(
    settings.database_url, pool_pre_ping=True, future=True, connect_args=_connect_args
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
Base = declarative_base()

def get_db():
    """Dependency: inyecta una sesión por request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def ensure_schema() -> None:
    """Migración ligera idempotente.

    `Base.metadata.create_all()` crea tablas nuevas pero NO altera tablas que
    ya existen. Las columnas agregadas después del primer arranque se añaden
    acá. Agnóstico del motor (SQLite y PostgreSQL soportan ADD COLUMN).
    """
    insp = inspect(engine)
    tables = insp.get_table_names()
    if "users" not in tables:
        return
    cols = {c["name"] for c in insp.get_columns("users")}
    if "role" not in cols:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN role VARCHAR(32) "
                "NOT NULL DEFAULT 'Inquilino'"
            ))

    if "listings" in tables:
        lcols = {c["name"] for c in insp.get_columns("listings")}
        # operacion: los listings sembrados son de alquiler → default retrocompatible.
        if "operacion" not in lcols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE listings ADD COLUMN operacion VARCHAR(16) "
                    "NOT NULL DEFAULT 'alquiler'"
                ))
        # image_url: ampliar de VARCHAR(512) a TEXT para las fotos base64.
        # SQLite ignora la longitud (no requiere ALTER); PostgreSQL sí.
        if engine.dialect.name == "postgresql":
            try:
                with engine.begin() as conn:
                    conn.execute(text(
                        "ALTER TABLE listings ALTER COLUMN image_url TYPE TEXT"))
            except Exception:
                pass  # ya era TEXT o el motor no lo permite; no es fatal

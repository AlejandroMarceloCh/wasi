"""Conexión a la base de datos.

Por defecto usa SQLite (un archivo, cero setup — la BD viaja con el proyecto).
Para usar PostgreSQL basta definir DATABASE_URL en el entorno o en .env.
El código es agnóstico del motor: el ORM (models.py) genera el DDL correcto.
"""
import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_DEFAULT = f"sqlite:///{os.path.join(BACKEND_DIR, 'wasi.db')}"


class Settings(BaseSettings):
    """Variables de entorno (.env)."""
    database_url: str = SQLITE_DEFAULT
    jwt_secret: str = "dev_secret_change_me"
    jwt_algo: str = "HS256"
    jwt_expire_days: int = 7

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


settings = Settings()

# SQLite con FastAPI necesita check_same_thread=False (varios hilos por request).
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
    if "users" not in insp.get_table_names():
        return  # tabla aún no creada; create_all() la hará completa
    cols = {c["name"] for c in insp.get_columns("users")}
    if "role" not in cols:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE users ADD COLUMN role VARCHAR(32) "
                "NOT NULL DEFAULT 'Inquilino'"
            ))

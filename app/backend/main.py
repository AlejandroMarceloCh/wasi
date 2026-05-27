"""Entry point FastAPI para ubIcA."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import models  # noqa: F401 — registra las tablas en Base.metadata
from database import Base, engine, ensure_schema
from geo_index import get_index
from model_service import model_service
from seed import seed_if_empty
from routers import auth as auth_router
from routers import dashboard as dashboard_router
from routers import entorno as entorno_router
from routers import fairvalue as fairvalue_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: crea tablas, carga y valida el modelo, calienta el índice geo.

    Si el modelo no pasa las validaciones (hash, n_features, golden prediction),
    model_service.load() lanza RuntimeError y el backend NO arranca — fail-fast.
    """
    Base.metadata.create_all(bind=engine)
    ensure_schema()                      # migración ligera (columnas nuevas)
    seed_if_empty()                      # distritos + usuario demo (idempotente)
    print("[ubIcA] Base de datos lista.")

    model_service.load()                 # 3 validaciones de startup; falla dura
    get_index()                          # calienta el KD-tree geográfico
    print("[ubIcA] Índice geográfico cargado. Backend listo.")
    yield


app = FastAPI(title="ubIcA API", version="2.0.0", lifespan=lifespan)

# CORS abierto para dev (frontend desde index.html / file:// o vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(auth_router.me_router)
app.include_router(dashboard_router.router)
app.include_router(fairvalue_router.router)
app.include_router(entorno_router.router)


@app.get("/")
def root():
    return {
        "service": "ubIcA API",
        "status": "ok",
        "model_version": model_service.version,
    }

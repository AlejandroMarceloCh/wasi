"""Entry point FastAPI para Wasi."""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

import models
from ratelimit import limiter
from database import Base, engine, ensure_schema
from wasi.features.geo_index import get_index
from wasi.models.model_service import model_service
from wasi.models.venta_service import venta_service
from seed import demo_seed_enabled, seed_if_empty
from routers import auth as auth_router
from routers import dashboard as dashboard_router
from routers import entorno as entorno_router
from routers import fairvalue as fairvalue_router
from routers import health as health_router
from routers import listings as listings_router
from routers import notifications as notifications_router
from routers import billing as billing_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: crea tablas, carga y valida el modelo, calienta el índice geo.

    Si el modelo no pasa las validaciones (hash, n_features, golden prediction),
    model_service.load() lanza RuntimeError y el backend NO arranca — fail-fast.
    """
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    seed_if_empty()

    if demo_seed_enabled() and not os.environ.get("WASI_SKIP_BULK_SEED"):
        try:
            from seed_listings_bulk import seed_bulk
            seed_bulk()
        except Exception as e:
            print(f"[Wasi] catálogo no sembrado: {e}")
    print("[Wasi] Base de datos lista.")

    model_service.load()
    try:
        venta_service.load()
    except Exception as e:
        print(f"[Wasi] venta_service no disponible: {e}")
    get_index()
    print("[Wasi] Índice geográfico cargado. Backend listo.")
    yield

app = FastAPI(title="Wasi API", version="2.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Dev local: Vite corre en :5173 (nuevo frontend). :5500 se mantiene por
# compatibilidad. En producción se fija WASI_CORS_ORIGINS al dominio de Vercel.
_cors = os.environ.get(
    "WASI_CORS_ORIGINS", "http://localhost:5173,http://localhost:5500")
_origins = ["*"] if _cors.strip() == "*" else [o.strip() for o in _cors.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(auth_router.me_router)
app.include_router(dashboard_router.router)
app.include_router(fairvalue_router.router)
app.include_router(entorno_router.router)
app.include_router(health_router.router)
app.include_router(listings_router.router)
app.include_router(notifications_router.router)
app.include_router(billing_router.router)

@app.get("/")
def root():
    return {
        "service": "Wasi API",
        "status": "ok",
        "model_version": model_service.version,
    }

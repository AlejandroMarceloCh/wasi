"""Pydantic schemas para todos los endpoints.

El contrato de FairValue (PredictIn/PredictOut) está CONGELADO — ver
PLAN.md sección 9. No cambiar campos sin reabrir el Gate 2.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, model_validator


# ---------- Auth ----------
class RegisterIn(BaseModel):
    email: EmailStr
    name: str
    password: str = Field(min_length=6)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    email: str
    name: str
    plan: str
    role: str = "Inquilino"


class AuthOut(BaseModel):
    token: str
    user: UserOut


class ReportItem(BaseModel):
    id: int
    analysis_id: int
    address: str
    date: str
    status: str = "Activo"


class UpdateMeIn(BaseModel):
    """Campos editables del perfil. Todos opcionales: se actualiza lo enviado."""
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    role: Optional[str] = None


class MeOut(BaseModel):
    user: UserOut
    plan: str
    last_activity_at: datetime
    analyses_count: int
    reports_count: int
    reports: List[ReportItem]


# ---------- Dashboard ----------
class DashStats(BaseModel):
    analyses_count: int
    reports_count: int
    avg_savings: float


class RecentItem(BaseModel):
    id: int
    address: str
    district: str
    time: str
    diff_pct: float
    fair_value: float
    zone: str
    kind: str


class CoverageItem(BaseModel):
    name: str
    listings: int
    level: str


class NextStep(BaseModel):
    address: Optional[str] = None
    sobreprecio_amount: Optional[float] = None
    analysis_id: Optional[int] = None


class DashboardOut(BaseModel):
    user: UserOut
    stats: DashStats
    recent: List[RecentItem]
    coverage: List[CoverageItem]
    next_step: NextStep
    last_activity_at: str           # ya formateado tipo "hace 2h"


# ---------- FairValue  (CONTRATO CONGELADO — PLAN.md §9) ----------
class PredictIn(BaseModel):
    lat: float                                        # pin; bbox se valida en geo_lookup
    lng: float
    area: float = Field(ge=10, le=1000)               # m²
    dormitorios: int = Field(ge=0, le=20)
    banos: int = Field(ge=0, le=20)                   # 0 solo si es_estudio
    es_estudio: bool = False
    cocheras: int = Field(ge=0, le=20)
    antiguedad_anios: int = Field(ge=0, le=100)
    amenities: List[str] = Field(default_factory=list)
    precio: float = Field(gt=0)

    @model_validator(mode="after")
    def _banos_no_cero_sin_estudio(self):
        if self.banos == 0 and not self.es_estudio:
            raise ValueError("banos solo puede ser 0 si es_estudio = true")
        return self


class Factor(BaseModel):
    label: str
    score: int
    positive: bool


class Counterfactual(BaseModel):
    """¿Qué pasaría si...? — perturbación ±delta de una feature accionable."""
    feature: str
    label: str           # legible: "+1 baño", "−5 años de antigüedad", "+10 m²"
    delta: int           # +1 / −1 / +10 / etc.
    new_value: int       # valor de la feature tras el clamp
    new_price: float
    pct_change: float    # vs base_prediction (fair_value actual, P50 cuando entre quantile)


class PredictionInterval(BaseModel):
    """Intervalo de predicción P25/P50/P75 (XGBoost quantile, Sprint 3.1)."""
    p25: float
    p50: float
    p75: float


class PredictOut(BaseModel):
    # model_r2 / model_mae chocan con el namespace reservado "model_" de Pydantic;
    # los nombres son del contrato congelado, así que se libera el namespace.
    model_config = {"protected_namespaces": ()}

    analysis_id: int
    fair_value: float
    announced_price: float
    diff: float
    diff_pct: float
    zone: str                       # Ganga | Justo | Inflado
    confidence: str                 # Alta | Media | Baja
    n_comparables: int
    coverage_radius_km: float
    model_r2: float
    model_mae: float
    mae_pct: float
    min: float
    max: float
    factors: List[Factor]
    counterfactuals: List[Counterfactual] = Field(default_factory=list)
    prediction_interval: Optional[PredictionInterval] = None
    predicted_in_seconds: float
    warnings: List[str] = Field(default_factory=list)
    fallback_reason: Optional[str] = None
    version: str
    distrito: str


class SaveOut(BaseModel):
    report_id: int


# ---------- Entorno  (servido por geo_index.py, por pin) ----------
class PoiContext(BaseModel):
    kind: str
    label: str
    emoji: str
    count_1km: int
    dist_nearest_m: float


class EntornoOut(BaseModel):
    distrito: str
    score: int
    level: str                      # Excelente | Bueno | Regular | Riesgo
    security: int
    services: int
    pois: List[PoiContext]
    cantidad_denuncias: int
    dist_mar_km: float
    n_comparables: int
    summary: str
    warnings: List[str] = Field(default_factory=list)
    # Breakdown del score (Sprint 1.3) — para visualización expandible
    n_comisarias_distrito: int = 0
    denuncias_distrito_total: int = 0
    denuncias_vs_lima_pct: float = 0.0   # 1.0 = igual al promedio Lima; 2.0 = doble; 0.5 = mitad

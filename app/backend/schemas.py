"""Pydantic schemas para todos los endpoints.

El contrato de FairValue (PredictIn/PredictOut) está CONGELADO — ver
PLAN.md sección 9. No cambiar campos sin reabrir el Gate 2.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

class RegisterIn(BaseModel):
    email: EmailStr
    name: str
    password: str = Field(min_length=6)
    role: Optional[str] = "Inquilino"

    @field_validator("email", mode="after")
    @classmethod
    def _email_lower(cls, v: EmailStr) -> str:
        return str(v).strip().lower()

    @field_validator("name", mode="after")
    @classmethod
    def _name_no_vacio(cls, v: str) -> str:
        name = v.strip()
        if len(name) < 2:
            raise ValueError("name debe tener al menos 2 caracteres")
        return name

class LoginIn(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email", mode="after")
    @classmethod
    def _email_lower(cls, v: EmailStr) -> str:
        return str(v).strip().lower()

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

    @field_validator("name", mode="after")
    @classmethod
    def _name_no_vacio_tras_strip(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        name = v.strip()
        if len(name) < 2:
            raise ValueError("name debe tener al menos 2 caracteres")
        return name

class MeOut(BaseModel):
    user: UserOut
    plan: str
    last_activity_at: datetime
    analyses_count: int
    reports_count: int
    reports: List[ReportItem]

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
    last_activity_at: str

class PredictIn(BaseModel):
    lat: float
    lng: float
    area: float = Field(ge=10, le=1000)
    dormitorios: int = Field(ge=0, le=20)
    banos: int = Field(ge=0, le=20)
    es_estudio: bool = False
    cocheras: int = Field(ge=0, le=20)
    antiguedad_anios: int = Field(ge=0, le=100)
    amenities: List[str] = Field(default_factory=list)
    precio: float = Field(gt=0)

    from_catalog: bool = False

    @model_validator(mode="after")
    def _no_cero_sin_estudio(self):
        if self.banos == 0 and not self.es_estudio:
            raise ValueError("banos solo puede ser 0 si es_estudio = true")
        if self.dormitorios == 0 and not self.es_estudio:
            raise ValueError("dormitorios solo puede ser 0 si es_estudio = true")
        return self

class SimulateOut(BaseModel):
    """Salida del simulador what-if: solo la predicción, sin persistir nada."""
    fair_value: float
    zone: str
    diff: float
    diff_pct: float
    p25: Optional[float] = None
    p50: Optional[float] = None
    p75: Optional[float] = None

class Factor(BaseModel):
    label: str
    score: int
    positive: bool

class Counterfactual(BaseModel):
    """¿Qué pasaría si...? — perturbación ±delta de una feature accionable."""
    feature: str
    label: str
    delta: int
    new_value: int
    new_price: float
    pct_change: float

class CounterfactualIn(BaseModel):
    """Form del contrafactual accionable (endpoint dedicado). Igual a PredictIn
    PERO SIN `precio`: el contrafactual no compara contra un precio anunciado,
    solo re-sirve el modelo congelado variando palancas."""
    lat: float
    lng: float
    area: float = Field(ge=10, le=1000)
    dormitorios: int = Field(ge=0, le=20)
    banos: int = Field(ge=0, le=20)
    es_estudio: bool = False
    cocheras: int = Field(ge=0, le=20)
    antiguedad_anios: int = Field(ge=0, le=100)
    amenities: List[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _no_cero_sin_estudio(self):
        if self.banos == 0 and not self.es_estudio:
            raise ValueError("banos solo puede ser 0 si es_estudio = true")
        if self.dormitorios == 0 and not self.es_estudio:
            raise ValueError("dormitorios solo puede ser 0 si es_estudio = true")
        return self

class CounterfactualItem(BaseModel):
    """Una palanca accionable re-servida contra el modelo congelado."""
    label: str
    kind: str
    feature: str
    delta: float
    delta_pct: float
    direction: str
    new_price: float

class CounterfactualOut(BaseModel):
    base_fair_value: float
    distrito: str
    items: List[CounterfactualItem] = Field(default_factory=list)

class ComparableItem(BaseModel):
    """Aviso real cercano y similar, mostrado como evidencia del Fair Value (FR-03).
    Sin PII: distrito + características + precio + distancia, nunca dirección exacta."""
    distrito: str
    precio_usd: int
    area_m2: int
    dormitorios: int
    banos: int
    antiguedad_anios: int
    lat: float
    lng: float
    distancia_km: float

class ComparablesOut(BaseModel):
    items: List[ComparableItem] = Field(default_factory=list)
    total_dataset: int

class PredictionInterval(BaseModel):
    """Intervalo de predicción P25/P50/P75 (XGBoost quantile, Sprint 3.1)."""
    p25: float
    p50: float
    p75: float

class PredictOut(BaseModel):

    model_config = {"protected_namespaces": ()}

    analysis_id: int
    fair_value: float
    announced_price: float
    diff: float
    diff_pct: float
    zone: str
    confidence: str
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

    lat: Optional[float] = None
    lng: Optional[float] = None
    area: Optional[float] = None
    dormitorios: Optional[int] = None

class PredictVentaIn(BaseModel):
    """Form para estimar precio de VENTA. Mismo patron que PredictIn pero el
    modelo de venta no usa amenities/es_estudio. `precio` = precio de venta
    anunciado (USD total) para el veredicto."""
    lat: float
    lng: float
    area: float = Field(ge=10, le=2000)
    dormitorios: int = Field(ge=0, le=20)
    banos: int = Field(ge=1, le=20)
    cocheras: int = Field(default=0, ge=0, le=20)
    antiguedad_anios: int = Field(default=0, ge=0, le=100)
    precio: float = Field(gt=0)

class PredictVentaOut(BaseModel):
    """Resultado de venta. Subconjunto de PredictOut con lo que el modelo de
    venta SI expone (sin SHAP/cuantiles/narrativa, que son fase 2)."""
    model_config = {"protected_namespaces": ()}

    fair_value: float
    announced_price: float
    diff: float
    diff_pct: float
    zone: str
    n_comparables: int
    coverage_radius_km: float
    model_r2: float
    mae_pct: float
    min: float
    max: float
    warnings: List[str] = Field(default_factory=list)
    fallback_reason: Optional[str] = None
    distrito: str
    version: str = "venta-v1"

class SaveOut(BaseModel):
    report_id: int

class ListingIn(BaseModel):
    district: str = Field(min_length=2, max_length=128)
    address: str = Field(min_length=3, max_length=255)
    lat: float
    lng: float
    area_m2: float = Field(ge=10, le=1000)
    dormitorios: int = Field(ge=0, le=20)
    banos: int = Field(ge=0, le=20)
    cocheras: int = Field(default=0, ge=0, le=20)
    antiguedad_anios: int = Field(default=0, ge=0, le=100)
    es_estudio: bool = False
    price_usd: float = Field(gt=0, le=50000)

    description: Optional[str] = Field(default="", max_length=2000)
    image_url: Optional[str] = Field(default=None, max_length=1_500_000)
    amenities: List[str] = Field(default_factory=list)
    contact_name: str = Field(min_length=2, max_length=255)
    contact_phone: str = Field(min_length=6, max_length=32)
    contact_email: EmailStr

    @field_validator("contact_email", mode="after")
    @classmethod
    def _contact_email_lower(cls, v: EmailStr) -> str:
        return str(v).strip().lower()

    @field_validator("image_url")
    @classmethod
    def _image_url_segura(cls, v: Optional[str]) -> Optional[str]:
        """Acepta URLs http(s) o imágenes subidas embebidas (data:image/...).
        Rechaza javascript:, data:text, etc. para evitar XSS al renderear en
        <img> (data:image solo pinta píxeles, no ejecuta script)."""
        if v is None or v == "":
            return v
        low = v.lower()
        if low.startswith(("http://", "https://")) or low.startswith("data:image/"):
            return v
        raise ValueError("image_url debe ser http(s):// o una imagen subida (data:image/)")

    @model_validator(mode="after")
    def _no_cero_sin_estudio(self):
        if self.banos == 0 and not self.es_estudio:
            raise ValueError("banos solo puede ser 0 si es_estudio = true")
        if self.dormitorios == 0 and not self.es_estudio:
            raise ValueError("dormitorios solo puede ser 0 si es_estudio = true")
        return self

class ListingOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    district: str
    address: str
    lat: float
    lng: float
    area_m2: float
    dormitorios: int
    banos: int
    cocheras: int
    antiguedad_anios: int
    es_estudio: bool
    price_usd: float
    fair_value_ref: Optional[float] = None
    description: str
    image_url: Optional[str] = None
    amenities: List[str] = Field(default_factory=list)
    contact_name: str

    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    status: str
    zone: Optional[str] = None
    created_at: datetime

class FavoriteIn(BaseModel):
    """Guardar un inmueble en favoritos. Solo necesita el id del listing;
    el user sale del token."""
    listing_id: int = Field(gt=0)

class LeadIn(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    phone: str = Field(min_length=6, max_length=32)
    email: EmailStr
    message: Optional[str] = Field(default="", max_length=1000)

    @field_validator("email", mode="after")
    @classmethod
    def _email_lower(cls, v: EmailStr) -> str:
        return str(v).strip().lower()

class LeadOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    listing_id: int
    name: str
    phone: str
    email: str
    message: str
    created_at: datetime

class ExplainDriver(BaseModel):
    label: str
    value: str
    pct_effect: float
    positive: bool

class ExplainGroup(BaseModel):
    label: str
    description: str
    contribution_log: float
    pct_effect: float
    positive: bool
    drivers: List[ExplainDriver] = Field(default_factory=list)

class ExplainOut(BaseModel):
    base_price: float
    predicted_price: float
    groups: List[ExplainGroup]
    distrito: str

class NarrativeOut(BaseModel):
    narrative: str
    distrito: str
    predicted_price: float
    groups: List[ExplainGroup]

class PoiHighlight(BaseModel):
    kind: str
    name: str
    dist_m: int
    tier: Optional[str] = None

class DetailedNarrativeOut(BaseModel):
    """Análisis extenso para el modal 'Análisis completo'. Reúne TODO el
    espectro disponible: SHAP + veredicto + confianza + entorno nombrado."""
    narrative: str
    distrito: str
    fair_value: float
    announced_price: Optional[float] = None
    zone: Optional[str] = None
    diff_pct: Optional[float] = None
    confidence: Optional[str] = None
    n_comparables: int = 0
    mae_pct: float
    price_min: float
    price_max: float
    groups: List[ExplainGroup]
    poi_highlights: List[PoiHighlight] = []

class PoiContext(BaseModel):
    kind: str
    label: str
    count_500m: int = 0
    count_1km: int
    dist_nearest_m: Optional[float] = None

class EntornoPoiLayer(BaseModel):
    kind: str
    label: str
    points: List[List[float]]

class EntornoPoisOut(BaseModel):
    layers: List[EntornoPoiLayer]

class EntornoOut(BaseModel):
    distrito: str
    score: int
    level: str
    security: int
    services: int
    pois: List[PoiContext]
    cantidad_denuncias: int
    dist_mar_km: float
    n_comparables: int
    summary: str
    warnings: List[str] = Field(default_factory=list)

    n_comisarias_distrito: int = 0
    denuncias_distrito_total: int = 0
    denuncias_vs_lima_pct: float = 0.0

    serenazgo: Optional[dict] = None

    premium_nearby: Optional[dict] = None

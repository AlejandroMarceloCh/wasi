"""Pydantic schemas para todos los endpoints.

El contrato de FairValue (PredictIn/PredictOut) está CONGELADO — ver
PLAN.md sección 9. No cambiar campos sin reabrir el Gate 2.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# ---------- Auth ----------
class RegisterIn(BaseModel):
    email: EmailStr
    name: str
    password: str = Field(min_length=6)
    role: Optional[str] = "Inquilino"   # validado contra VALID_ROLES en el router


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
    def _banos_no_cero_sin_estudio(self):
        if self.banos == 0 and not self.es_estudio:
            raise ValueError("banos solo puede ser 0 si es_estudio = true")
        return self


class CounterfactualItem(BaseModel):
    """Una palanca accionable re-servida contra el modelo congelado."""
    label: str            # "Agregar 1 cochera", "+15 m²", "Amoblar", "Quitar piscina"
    kind: str             # "estructura" | "amenity" | "informativo"
    feature: str          # "cocheras", "amenity:piscina", "area"
    delta: float          # USD vs base
    delta_pct: float
    direction: str        # "sube" | "baja" | "neutro"
    new_price: float


class CounterfactualOut(BaseModel):
    base_fair_value: float
    distrito: str
    items: List[CounterfactualItem] = Field(default_factory=list)


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
    precio: float = Field(gt=0)            # precio de venta anunciado (USD)


class PredictVentaOut(BaseModel):
    """Resultado de venta. Subconjunto de PredictOut con lo que el modelo de
    venta SI expone (sin SHAP/cuantiles/narrativa, que son fase 2)."""
    model_config = {"protected_namespaces": ()}

    fair_value: float                      # precio de venta justo (USD total)
    announced_price: float
    diff: float
    diff_pct: float
    zone: str                              # Ganga | Justo | Inflado
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


# ---------- Listings / Leads (flywheel de oferta) ----------
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
    fair_value_ref: Optional[float] = Field(default=None, ge=0)
    description: Optional[str] = Field(default="", max_length=2000)
    image_url: Optional[str] = Field(default=None, max_length=512)
    amenities: List[str] = Field(default_factory=list)
    contact_name: str = Field(min_length=2, max_length=255)
    contact_phone: str = Field(min_length=6, max_length=32)
    contact_email: EmailStr

    @field_validator("image_url")
    @classmethod
    def _image_url_solo_http(cls, v: Optional[str]) -> Optional[str]:
        """Solo se aceptan URLs http(s). Rechaza javascript:, data:, etc.
        (evita XSS si la URL se renderea en el frontend). Se mantiene como str
        para no cambiar el tipo de guardado."""
        if v is None or v == "":
            return v
        if not v.lower().startswith(("http://", "https://")):
            raise ValueError("image_url debe empezar con http:// o https://")
        return v

    @model_validator(mode="after")
    def _banos_no_cero_sin_estudio(self):
        if self.banos == 0 and not self.es_estudio:
            raise ValueError("banos solo puede ser 0 si es_estudio = true")
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
    amenities: List[str] = Field(default_factory=list)   # se rearma desde el CSV en el router
    contact_name: str
    contact_phone: str
    contact_email: str
    status: str
    zone: Optional[str] = None         # veredicto derivado: Ganga|Justo|Inflado|None
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


class LeadOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    listing_id: int
    name: str
    phone: str
    email: str
    message: str
    created_at: datetime


# ---------- Explainability SHAP (TreeSHAP nativo XGBoost) ----------
class ExplainGroup(BaseModel):
    label: str
    description: str
    contribution_log: float   # aditivo en log-space (Σ = log1p(precio) − base)
    pct_effect: float         # efecto multiplicativo sobre el precio: (exp(Σφ)−1)·100
    positive: bool


class ExplainOut(BaseModel):
    base_price: float         # exp(base)−1, el precio base del modelo
    predicted_price: float    # = fair_value central
    groups: List[ExplainGroup]
    distrito: str


class NarrativeOut(BaseModel):
    narrative: str
    distrito: str
    predicted_price: float
    groups: List[ExplainGroup]


class PoiHighlight(BaseModel):
    kind: str                       # categoría legible: 'Supermercado', 'Banco', ...
    name: str                       # nombre real del POI (OSM)
    dist_m: int                     # distancia en metros
    tier: Optional[str] = None      # 'gama alta' | 'gama masiva' | 'cadena' | None


class DetailedNarrativeOut(BaseModel):
    """Análisis extenso para el modal 'Análisis completo'. Reúne TODO el
    espectro disponible: SHAP + veredicto + confianza + entorno nombrado."""
    narrative: str                  # informe estructurado en secciones markdown
    distrito: str
    fair_value: float
    announced_price: Optional[float] = None
    zone: Optional[str] = None      # Ganga | Justo | Inflado
    diff_pct: Optional[float] = None
    confidence: Optional[str] = None
    n_comparables: int = 0
    mae_pct: float
    price_min: float
    price_max: float
    groups: List[ExplainGroup]
    poi_highlights: List[PoiHighlight] = []


# ---------- Entorno  (servido por geo_index.py, por pin) ----------
class PoiContext(BaseModel):
    kind: str
    label: str
    count_500m: int = 0
    count_1km: int
    dist_nearest_m: Optional[float] = None


class EntornoPoiLayer(BaseModel):
    kind: str
    label: str
    points: List[List[float]]   # [[lat, lng], ...]


class EntornoPoisOut(BaseModel):
    layers: List[EntornoPoiLayer]


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
    # Factor visual de serenazgo (Sprint 3.4) — NO entra al modelo ML.
    # {serenos_total, serenos_por_km2, label} o None si el distrito no tiene datos.
    serenazgo: Optional[dict] = None
    # Sprint 3.6 — POIs premium del barrio (colegios top, clínicas premium, restaurantes
    # fine dining). NO entran al modelo ML (cobertura muy chica genera overfitting).
    # Cada key: {label, count_1km, dist_nearest_m}. None si no hay ninguno relevante.
    premium_nearby: Optional[dict] = None

"""Modelos SQLAlchemy 2.x para Wasi.

6 tablas transaccionales. Los datos geográficos (POIs, crimen) NO viven en la
BD — los sirve geo_index.py por pin. Por eso no hay tablas `pois`/`crime`.
El ORM es agnóstico del motor: corre igual en SQLite y PostgreSQL.
"""
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text,
    UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    plan: Mapped[str] = mapped_column(String(16), nullable=False, default="free")
    # Fin del trial Pro (NULL = sin trial vigente). Con plan="pro" y trial_ends_at
    # NULL = suscripción sin vencimiento; con fecha futura = trial activo; con
    # fecha pasada = trial vencido (se trata como free). Ver plan.py:is_pro.
    trial_ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="Inquilino")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analyses = relationship("Analysis", back_populates="user")
    reports = relationship("Report", back_populates="user")
    listings = relationship("Listing", back_populates="owner")
    favorites = relationship(
        "Favorite", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship(
        "Notification", back_populates="user", cascade="all, delete-orphan",
        order_by="Notification.created_at.desc()")

class District(Base):
    """Distrito de Lima. Solo para el widget de cobertura del dashboard;
    los datos geográficos reales los sirve geo_index.py."""
    __tablename__ = "districts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    listings_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    coverage_level: Mapped[str] = mapped_column(String(16), nullable=False, default="baja")

class Property(Base):
    """Inmueble analizado. Refleja el form nuevo (pin + datos estructurales).
    `district` se guarda denormalizado (nombre que devuelve geo_lookup)."""
    __tablename__ = "properties"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    district: Mapped[str] = mapped_column(String(128), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    area_m2: Mapped[float] = mapped_column(Float, nullable=False)
    dormitorios: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    banos: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    cocheras: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    antiguedad_anios: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    es_estudio: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    amenities: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analyses = relationship("Analysis", back_populates="property")

class Analysis(Base):
    __tablename__ = "analyses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id"), nullable=False)
    announced_price: Mapped[float] = mapped_column(Float, nullable=False)
    fair_value: Mapped[float] = mapped_column(Float, nullable=False)
    diff: Mapped[float] = mapped_column(Float, nullable=True)
    diff_pct: Mapped[float] = mapped_column(Float, nullable=True)
    zone: Mapped[str] = mapped_column(String(32), nullable=True)
    mae_pct: Mapped[float] = mapped_column(Float, nullable=False, default=15.9)
    confidence: Mapped[str] = mapped_column(String(16), nullable=False, default="Media")
    n_comparables: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    coverage_radius_km: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    fallback_reason: Mapped[str] = mapped_column(String(32), nullable=True)
    model_version: Mapped[str] = mapped_column(String(32), nullable=False, default="rf")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="analyses")
    property = relationship("Property", back_populates="analyses")
    factors = relationship(
        "AnalysisFactor", back_populates="analysis",
        cascade="all, delete-orphan", order_by="AnalysisFactor.order_idx")
    report = relationship("Report", back_populates="analysis", uselist=False)

class AnalysisFactor(Base):
    __tablename__ = "analysis_factors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analysis_id: Mapped[int] = mapped_column(
        ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    positive: Mapped[bool] = mapped_column(Boolean, default=True)
    order_idx: Mapped[int] = mapped_column(Integer, default=0)

    analysis = relationship("Analysis", back_populates="factors")

class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    analysis_id: Mapped[int] = mapped_column(
        ForeignKey("analyses.id"), unique=True, nullable=False)
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="reports")
    analysis = relationship("Analysis", back_populates="report")

class Listing(Base):
    """Inmueble publicado por un propietario/agente para alquiler o venta.
    Arranca el flywheel de oferta. fair_value_ref se captura del modelo
    (de alquiler o de venta según `operacion`) al publicar."""
    __tablename__ = "listings"
    # #33: indice compuesto para los filtros reales del catalogo (status +
    # operacion). `create_all` lo crea en BDs nuevas; ensure_schema lo añade a
    # las existentes (CREATE INDEX IF NOT EXISTS).
    __table_args__ = (
        Index("ix_listings_operacion_status", "operacion", "status"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    operacion: Mapped[str] = mapped_column(
        String(16), nullable=False, default="alquiler", server_default="alquiler")
    district: Mapped[str] = mapped_column(String(128), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    area_m2: Mapped[float] = mapped_column(Float, nullable=False)
    dormitorios: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    banos: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    cocheras: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    antiguedad_anios: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    es_estudio: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    price_usd: Mapped[float] = mapped_column(Float, nullable=False)
    fair_value_ref: Mapped[float] = mapped_column(Float, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    image_url: Mapped[str] = mapped_column(Text, nullable=True)
    amenities: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    contact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(32), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="activo")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="listings")
    leads = relationship("Lead", back_populates="listing",
                         cascade="all, delete-orphan", order_by="Lead.created_at.desc()")
    favorites = relationship(
        "Favorite", back_populates="listing", cascade="all, delete-orphan")

class Lead(Base):
    """Contacto generado por un inquilino sobre un Listing (Capa 2 del negocio)."""
    __tablename__ = "leads"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    listing_id: Mapped[int] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    listing = relationship("Listing", back_populates="leads")

class Favorite(Base):
    """Inmueble guardado por un inquilino. Tabla NUEVA (aditiva): create_all la
    crea sin tocar tablas existentes. unique(user_id, listing_id) garantiza que
    un usuario no pueda guardar el mismo listing dos veces (idempotencia a nivel
    de BD; el endpoint también lo maneja para no devolver 500)."""
    __tablename__ = "favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "listing_id", name="uq_favorite_user_listing"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    listing_id: Mapped[int] = mapped_column(
        ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="favorites")
    listing = relationship("Listing", back_populates="favorites")

class Notification(Base):
    """Aviso in-app para un usuario, generado por eventos del negocio (hoy: un
    lead nuevo sobre tu inmueble). Tabla NUEVA/aditiva: `create_all` la crea sin
    tocar tablas existentes. `read_at` NULL = no leída (el badge la cuenta)."""
    __tablename__ = "notifications"
    __table_args__ = (
        # El filtro real es "mis notificaciones no leídas, más recientes primero".
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(32), nullable=False, default="lead")
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(String(400), nullable=False, default="")
    # Listing relacionado (si aplica). SET NULL: si se borra el inmueble, la
    # notificación sobrevive sin FK colgante.
    listing_id: Mapped[int] = mapped_column(
        ForeignKey("listings.id", ondelete="SET NULL"), nullable=True, index=True)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")

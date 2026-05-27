"""Modelos SQLAlchemy 2.x para Wasi.

6 tablas transaccionales. Los datos geográficos (POIs, crimen) NO viven en la
BD — los sirve geo_index.py por pin. Por eso no hay tablas `pois`/`crime`.
El ORM es agnóstico del motor: corre igual en SQLite y PostgreSQL.
"""
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func,
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
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="Inquilino")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analyses = relationship("Analysis", back_populates="user")
    reports = relationship("Report", back_populates="user")


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
    amenities: Mapped[str] = mapped_column(String(255), nullable=False, default="")  # csv de chips
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

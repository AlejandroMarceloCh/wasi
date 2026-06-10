"""venta_service.py — Servicio del modelo de VENTA · capa de aislamiento.

Mismo patron que model_service.py (alquiler) pero para el modelo de precio de
VENTA entrenado en ventas_model/. Carga el bundle xgb_venta.joblib y predice un
precio de venta en USD a partir del mismo geo_lookup() que usa alquiler.

El modelo es independiente del de alquiler (congelado): integrarlo NO toca el
path de alquiler. Si el .joblib no existe, is_loaded() = False y el endpoint de
venta devuelve 503 (degradacion limpia).
"""
from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from geo_index import geo_lookup

BUNDLE = (Path(__file__).resolve().parent.parent.parent
          / "ventas_model" / "models" / "xgb_venta.joblib")

# MAPE espacial honesto del modelo (ventas_model/RESULTADOS.md, GroupKFold por
# coordenada, target encoding refit por fold). Se usa para la banda de error.
MAE_PCT = 15.8
MODEL_R2 = 0.856
ZONE_BAND_PCT = 8.0   # mismo umbral de veredicto que alquiler (ml.ZONE_BAND_PCT)
INMUEBLE_COLS = ["m2", "dormitorios", "banos", "cocheras", "antiguedad_anios"]


class VentaService:
    """Carga y sirve el modelo de precio de venta."""

    def __init__(self) -> None:
        self._model = None
        self._features: list[str] | None = None
        self._distrito_enc: dict | None = None
        self._distrito_glob: float = 0.0

    def load(self) -> None:
        if not BUNDLE.exists():
            print(f"[venta_service] {BUNDLE.name} no encontrado — venta deshabilitada")
            return
        b = joblib.load(BUNDLE)
        self._model = b["model"]
        self._features = list(b["features"])
        self._distrito_enc = dict(b["distrito_enc"])
        self._distrito_glob = float(b["distrito_glob"])
        print(f"[venta_service] modelo de venta cargado · {len(self._features)} features "
              f"· MAPE {MAE_PCT}% · R2 {MODEL_R2}")

    def is_loaded(self) -> bool:
        return self._model is not None

    def predict(self, form: dict) -> dict:
        """form -> precio de venta USD. Reusa geo_lookup (mismas fuentes que
        alquiler). Lanza OutOfBoundsError si el pin esta fuera de Lima."""
        geo = geo_lookup(float(form["lat"]), float(form["lng"]))
        distrito = geo.get("distrito") or geo.get("distrito_oficial") or ""
        row = {c: geo[c] for c in self._features if c in geo}
        row["m2"] = float(form["area"])
        row["dormitorios"] = int(form["dormitorios"])
        row["banos"] = int(form["banos"])
        row["cocheras"] = int(form.get("cocheras", 0))
        row["antiguedad_anios"] = int(form.get("antiguedad_anios", 0))
        row["distrito_enc"] = self._distrito_enc.get(distrito, self._distrito_glob)
        X = pd.DataFrame([row])[self._features]
        fair = float(np.expm1(self._model.predict(X))[0])
        return {
            "fair_value": round(fair, 2),
            "distrito": distrito,
            "n_comparables": int(geo.get("n_comparables", 0)),
            "coverage_radius_km": float(geo.get("coverage_radius_km", 0)),
            "fallback_reason": geo.get("fallback_reason"),
        }


venta_service = VentaService()

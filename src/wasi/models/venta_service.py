"""venta_service.py — Servicio del modelo de VENTA · capa de aislamiento.

Mismo patron que model_service.py (alquiler) pero para el modelo de precio de
VENTA entrenado en ventas_model/. Carga el bundle xgb_venta.joblib y predice un
precio de venta en USD a partir del mismo geo_lookup() que usa alquiler.

El modelo es independiente del de alquiler (congelado): integrarlo NO toca el
path de alquiler. Si el .joblib no existe, is_loaded() = False y el endpoint de
venta devuelve 503 (degradacion limpia).
"""
from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from wasi.features.geo_index import geo_lookup
from wasi.paths import VENTAS_BUNDLE, VENTAS_GOLDEN, VENTAS_MANIFEST

logger = logging.getLogger("wasi.venta_service")

BUNDLE = VENTAS_BUNDLE

# Defaults/retrocompat. La fuente de verdad efectiva es el manifest (métrica
# leída al cargar → self.mae_pct/self.r2/self.zone_band_pct). Estas constantes
# quedan como fallback y para consumidores que aún importan el módulo.
MAE_PCT = 15.8
MODEL_R2 = 0.856
ZONE_BAND_PCT = 8.0
INMUEBLE_COLS = ["m2", "dormitorios", "banos", "cocheras", "antiguedad_anios"]


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()

class VentaService:
    """Carga y sirve el modelo de precio de venta, con fail-fast de integridad."""

    def __init__(self) -> None:
        self._model = None
        self._features: list[str] | None = None
        self._distrito_enc: dict | None = None
        self._distrito_glob: float = 0.0
        # Métrica efectiva (del manifest; fallback a las constantes de módulo).
        self.mae_pct: float = MAE_PCT
        self.r2: float = MODEL_R2
        self.zone_band_pct: float = ZONE_BAND_PCT

    def load(self) -> None:
        if not BUNDLE.exists():
            print(f"[venta_service] {BUNDLE.name} no encontrado — venta deshabilitada")
            return
        b = joblib.load(BUNDLE)
        model = b["model"]
        features = list(b["features"])
        distrito_enc = dict(b["distrito_enc"])
        distrito_glob = float(b["distrito_glob"])

        # Gate "serving seguro": si hay manifest, validar hash + golden ANTES de
        # servir. Fallo de integridad → venta deshabilitada (no se sirve un modelo
        # dudoso) SIN tumbar el backend (aislamiento: alquiler sigue). Si no hay
        # manifest, se sirve como antes con un warning (retrocompat de deploys).
        if VENTAS_MANIFEST.exists():
            try:
                self._validate_integrity(model, features, distrito_enc, distrito_glob)
            except Exception as exc:
                logger.error(
                    "[venta_service] validación de integridad FALLÓ — venta "
                    "deshabilitada (503). Regenerar con generate_venta_artefacts.py. "
                    "Motivo: %s", exc)
                return
        else:
            logger.warning(
                "[venta_service] sin manifest_venta.json — se sirve SIN validación "
                "de integridad. Correr generate_venta_artefacts.py para el fail-fast.")

        self._model = model
        self._features = features
        self._distrito_enc = distrito_enc
        self._distrito_glob = distrito_glob
        print(f"[venta_service] modelo de venta cargado · {len(features)} features "
              f"· MAPE {self.mae_pct}% · R2 {self.r2}")

    def _validate_integrity(self, model, features, distrito_enc, distrito_glob) -> None:
        """Valida hash del .joblib vs manifest + golden de predicciones. Carga la
        métrica del manifest. Lanza si algo no cuadra."""
        manifest = json.loads(VENTAS_MANIFEST.read_text())
        real = _sha256(BUNDLE)
        if real != manifest["sha256"]:
            raise RuntimeError(
                f"hash de {BUNDLE.name} no coincide con manifest_venta "
                f"(esperado {manifest['sha256'][:12]}…, real {real[:12]}…). "
                "El modelo cambió sin regenerar el manifest.")
        met = manifest.get("metrica", {})
        self.mae_pct = float(met.get("mae_pct", MAE_PCT))
        self.r2 = float(met.get("r2", MODEL_R2))
        self.zone_band_pct = float(met.get("zone_band_pct", ZONE_BAND_PCT))

        if VENTAS_GOLDEN.exists():
            golden = json.loads(VENTAS_GOLDEN.read_text())
            tol = golden["tolerancia_relativa"]
            for caso in golden["casos"]:
                pred = self._predict_with(model, features, distrito_enc, distrito_glob,
                                          caso["form"])
                esperado = caso["expected_fair_value"]
                dif = abs(pred - esperado) / esperado
                if dif > tol:
                    raise RuntimeError(
                        f"golden de venta falló (caso '{caso['nombre']}'): esperado "
                        f"${esperado:.2f}, obtenido ${pred:.2f}, dif {dif*100:.4f}% "
                        f"> {tol*100}%. Modelo o entorno cambiado.")

    def is_loaded(self) -> bool:
        return self._model is not None

    def _predict_with(self, model, features, distrito_enc, distrito_glob, form: dict) -> float:
        """Predicción cruda (USD) con artefactos dados — usada en la validación
        golden antes de comprometer el estado del servicio."""
        geo = geo_lookup(float(form["lat"]), float(form["lng"]))
        distrito = geo.get("distrito") or geo.get("distrito_oficial") or ""
        row = {c: geo[c] for c in features if c in geo}
        row["m2"] = float(form["area"])
        row["dormitorios"] = int(form["dormitorios"])
        row["banos"] = int(form["banos"])
        row["cocheras"] = int(form.get("cocheras", 0))
        row["antiguedad_anios"] = int(form.get("antiguedad_anios", 0))
        row["distrito_enc"] = distrito_enc.get(distrito, distrito_glob)
        X = pd.DataFrame([row])[features]
        return float(np.expm1(model.predict(X))[0])

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

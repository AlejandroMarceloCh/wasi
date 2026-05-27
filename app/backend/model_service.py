"""
model_service.py — Servicio del modelo · capa de aislamiento.

Toda la lógica específica del modelo de Leo vive acá: carga, validación de
startup y predicción. El resto del backend (endpoints, build_features) habla
con la clase `ModelService`, nunca con el `.joblib` directamente.

────────────────────────────────────────────────────────────────────────────
CUANDO LEO ENTREGUE UNA VERSIÓN NUEVA DEL MODELO:
  1. Copiar los .joblib nuevos a app/backend/models/
  2. ./venv/bin/python scripts/generate_model_artefacts.py
     (regenera feature_order.json, manifest.json, golden_prediction.json)
  3. Reiniciar el backend.
El startup valida el swap. Si las 74 features cambiaron, si un hash no cuadra,
o si el golden prediction falla → RuntimeError y el backend NO arranca.
Mientras Leo solo re-entrene (mismas 74 features) el swap es invisible.
────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

MODELS = Path(__file__).resolve().parent / "models"
MODELS_V2 = MODELS / "v2"
MODELO_PRINCIPAL = "04_random_forest.joblib"
MODELO_PRINCIPAL_V2 = "modelo_final_v2.joblib"

# v2 está activo si existe el artefacto principal en models/v2/.
# Los tests legacy pueden forzar v1 con env var DPD_FORCE_V1=1.
import os
USE_V2 = (MODELS_V2 / MODELO_PRINCIPAL_V2).exists() and not os.environ.get("DPD_FORCE_V1")


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


class ModelService:
    """Encapsula el modelo: carga, validación de startup y predicción."""

    def __init__(self) -> None:
        self._model = None
        self._manifest: dict | None = None
        self._feature_order: list[str] | None = None
        self._log_features: list[str] | None = None
        self._target_enc: dict | None = None
        self._mode: str = "v1"
        self._model_name: str | None = None

    # ─── carga + validación de startup ──────────────────────────────────
    def load(self) -> None:
        """Carga el modelo. Detecta v2 si los artefactos existen, sino v1.

        En v1 corre las 3 validaciones estrictas (manifest, n_features, golden).
        En v2 (XGBoost re-entrenado con sample weights + features socio-eco)
        skip manifest/golden — son del modelo viejo y no aplican.
        """
        if USE_V2:
            self._load_v2()
        else:
            self._check_manifest()                       # 1 — hashes
            self._model = joblib.load(MODELS / MODELO_PRINCIPAL)
            self._load_artefactos()
            self._check_n_features()                     # 2 — n_features_in_
            self._check_golden_prediction()              # 3 — golden
            print(f"[model_service] modelo v1 cargado y validado · version {self.version}")

    def _load_v2(self) -> None:
        """Carga modelo_final_v2.joblib + artefactos v2 (95 features XGBoost)."""
        bundle = joblib.load(MODELS_V2 / MODELO_PRINCIPAL_V2)
        self._model = bundle["modelo"]
        self._model_name = bundle["nombre"]
        self._feature_order = list(joblib.load(MODELS_V2 / "feature_names_v2.joblib"))
        enc = joblib.load(MODELS_V2 / "target_enc_distrito_v2.joblib")
        # En v2, el encoder ya viene smoothed (k=30). Convertimos a Series-like dict.
        self._target_enc = {
            "map": enc["map"] if hasattr(enc["map"], "get") else dict(enc["map"]),
            "global_mean": float(enc["global_mean"]),
            "k": int(enc.get("k", 30)),
        }
        self._log_features = list(joblib.load(MODELS_V2 / "features_log_transformed_v2.joblib"))
        self._mode = "v2"
        metrics = bundle.get("metricas_test", {})
        print(f"[model_service] modelo v2 cargado · {self._model_name} · "
              f"R²={metrics.get('r2', '?')} MAPE={metrics.get('mape', '?')}%")

    def _check_manifest(self) -> None:
        path = MODELS / "manifest.json"
        if not path.exists():
            raise RuntimeError(
                "model_service: falta manifest.json — correr "
                "scripts/generate_model_artefacts.py")
        self._manifest = json.loads(path.read_text())
        for nombre, hash_esperado in self._manifest["artefactos"].items():
            f = MODELS / nombre
            if not f.exists():
                raise RuntimeError(f"model_service: falta el artefacto '{nombre}'")
            real = _sha256(f)
            if real != hash_esperado:
                raise RuntimeError(
                    f"model_service: el hash de '{nombre}' no coincide con el "
                    f"manifest (esperado {hash_esperado[:12]}…, real {real[:12]}…). "
                    f"¿Cambió el modelo? Correr generate_model_artefacts.py.")

    def _load_artefactos(self) -> None:
        fo = json.loads((MODELS / "feature_order.json").read_text())
        self._feature_order = [f["name"] for f in fo["features"]]
        self._target_enc = joblib.load(MODELS / "target_enc_distrito.joblib")
        self._log_features = list(joblib.load(MODELS / "features_log_transformed.joblib"))

    def _check_n_features(self) -> None:
        n = getattr(self._model, "n_features_in_", None)
        if n != len(self._feature_order):
            raise RuntimeError(
                f"model_service: el modelo espera {n} features pero "
                f"feature_order.json tiene {len(self._feature_order)}. "
                f"El modelo cambió — revisar build_features.")
        nombres = getattr(self._model, "feature_names_in_", None)
        if nombres is not None and [str(x) for x in nombres] != self._feature_order:
            raise RuntimeError(
                "model_service: feature_order.json no coincide con el orden de "
                "feature_names_in_ del modelo. Regenerar feature_order.json.")

    def _check_golden_prediction(self) -> None:
        golden = json.loads((MODELS / "golden_prediction.json").read_text())
        tol = golden["tolerancia_relativa"]
        for caso in golden["casos"]:
            X = pd.DataFrame([caso["input"]], columns=self._feature_order)
            pred = self.predict(X)
            esperado = caso["expected"]
            dif = abs(pred - esperado) / esperado
            if dif > tol:
                raise RuntimeError(
                    f"model_service: golden prediction falló "
                    f"(caso '{caso['rank_precio']}'): esperado ${esperado:.2f}, "
                    f"obtenido ${pred:.2f}, dif {dif * 100:.4f}% > {tol * 100}%. "
                    f"Incompatibilidad de versión o modelo cambiado.")

    # ─── predicción ─────────────────────────────────────────────────────
    def predict(self, X) -> float:
        """Predice el precio de referencia en USD para un caso (74 features).

        X: DataFrame 1×74 o array-like de 74 valores, en el orden de
        feature_order. Devuelve USD (el modelo predice en log → expm1).
        """
        if self._model is None:
            raise RuntimeError("model_service: modelo no cargado (llamar load())")
        if isinstance(X, pd.DataFrame):
            X = X[self._feature_order]                # garantiza el orden
        else:
            X = pd.DataFrame([list(X)], columns=self._feature_order)
        pred_log = float(self._model.predict(X)[0])
        return float(np.expm1(pred_log))

    # ─── accesores ──────────────────────────────────────────────────────
    @property
    def version(self) -> str:
        if self._mode == "v2":
            return f"v2-{self._model_name}"
        return self._manifest["version"] if self._manifest else "unloaded"

    @property
    def mode(self) -> str:
        """'v1' o 'v2' — usado por ml.py para rutear build_features."""
        return self._mode

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def feature_order(self) -> list[str]:
        return list(self._feature_order or [])

    @property
    def log_features(self) -> list[str]:
        """Features a las que se aplica log1p (intersecadas con las 74)."""
        return [f for f in (self._log_features or []) if f in (self._feature_order or [])]

    @property
    def target_encoder(self) -> dict:
        """dict {'map': Series por distrito, 'global_mean': float} en espacio log."""
        return self._target_enc

    def feature_importances(self) -> dict[str, float]:
        """Importancia de cada feature según el RF (para los `factors`)."""
        imp = getattr(self._model, "feature_importances_", None)
        if imp is None:
            return {}
        return dict(zip(self._feature_order, (float(x) for x in imp)))


# ─── singleton — se carga una vez en el startup del backend ─────────────────
model_service = ModelService()

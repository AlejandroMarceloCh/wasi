"""
Auditoría de artefactos del modelo de Leo  ·  Fase 0.5 del PLAN.

Carga cada .joblib de app/backend/models/ e imprime su estructura interna:
tipo, n_features, nombres, dtypes, features con log1p y forma de outlier_caps.
El modelo principal es Random Forest (04_random_forest.joblib).

Uso:  ./venv/bin/python scripts/audit_artefactos.py
"""
from pathlib import Path
import sys

import joblib
import numpy as np
import pandas as pd

# Rutas relativas a app/backend/
BACKEND = Path(__file__).resolve().parent.parent
MODELS = BACKEND / "models"
PIPELINE_DATA = BACKEND.parent.parent / "pipeline" / "data" / "processed"


def sep(titulo: str) -> None:
    print("\n" + "=" * 70)
    print(titulo)
    print("=" * 70)


def auditar_modelo(path: Path, nombre: str):
    """Carga un modelo (RF/XGB) y reporta n_features y nombres."""
    sep(f"MODELO — {nombre}  ({path.name})")
    try:
        modelo = joblib.load(path)
    except Exception as e:
        print(f"  ERROR al cargar: {e}")
        return None
    print(f"  tipo: {type(modelo)}")
    n_feat = getattr(modelo, "n_features_in_", None)
    print(f"  n_features_in_: {n_feat}")
    nombres = getattr(modelo, "feature_names_in_", None)
    if nombres is not None:
        print(f"  feature_names_in_ ({len(nombres)}): {list(nombres)}")
    else:
        print("  feature_names_in_: AUSENTE (modelo entrenado sin nombres)")
    if hasattr(modelo, "n_estimators"):
        print(f"  n_estimators: {modelo.n_estimators}")
    return modelo


def main() -> int:
    print("Auditoría de artefactos  ·  Fase 0.5")
    print(f"models/ = {MODELS}")

    # --- Modelos ---
    rf = auditar_modelo(MODELS / "04_random_forest.joblib", "Random Forest (PRINCIPAL)")
    xgb = auditar_modelo(MODELS / "05_xgboost.joblib", "XGBoost (solo Gate 6)")

    # --- feature_names.joblib ---
    sep("ARTEFACTO — feature_names.joblib (74 features esperadas, sin escalar)")
    try:
        feat_names = joblib.load(MODELS / "feature_names.joblib")
        print(f"  tipo: {type(feat_names)}")
        feat_list = list(feat_names)
        print(f"  cantidad: {len(feat_list)}")
        for i, f in enumerate(feat_list):
            print(f"    [{i:2d}] {f}")
    except Exception as e:
        print(f"  ERROR: {e}")
        feat_list = None

    # --- target_enc_distrito.joblib ---
    sep("ARTEFACTO — target_enc_distrito.joblib")
    try:
        tenc = joblib.load(MODELS / "target_enc_distrito.joblib")
        print(f"  tipo: {type(tenc)}")
        if isinstance(tenc, dict):
            print(f"  claves ({len(tenc)}): {list(tenc.items())[:10]} ...")
        else:
            print(f"  repr: {repr(tenc)[:500]}")
            for attr in ("classes_", "mapping", "cols", "_dim"):
                if hasattr(tenc, attr):
                    print(f"  .{attr}: {repr(getattr(tenc, attr))[:300]}")
    except Exception as e:
        print(f"  ERROR: {e}")

    # --- features_log_transformed.joblib ---
    sep("ARTEFACTO — features_log_transformed.joblib (19 features con log1p)")
    try:
        log_feats = joblib.load(MODELS / "features_log_transformed.joblib")
        print(f"  tipo: {type(log_feats)}")
        log_list = list(log_feats)
        print(f"  cantidad: {len(log_list)}")
        for f in log_list:
            print(f"    - {f}")
    except Exception as e:
        print(f"  ERROR: {e}")

    # --- outlier_caps.joblib ---
    sep("ARTEFACTO — outlier_caps.joblib (Gate 1: punto de aplicación)")
    try:
        caps = joblib.load(MODELS / "outlier_caps.joblib")
        print(f"  tipo: {type(caps)}")
        if isinstance(caps, dict):
            print(f"  cantidad de columnas: {len(caps)}")
            for k, v in caps.items():
                print(f"    {k}: {v}")
        else:
            print(f"  repr: {repr(caps)[:800]}")
    except Exception as e:
        print(f"  ERROR: {e}")

    # --- Cruce con X_test.csv ---
    sep("CRUCE — X_test.csv (columnas y orden reales del entrenamiento)")
    xtest_path = PIPELINE_DATA / "X_test.csv"
    if xtest_path.exists():
        xtest = pd.read_csv(xtest_path)
        print(f"  shape: {xtest.shape}")
        print(f"  columnas ({len(xtest.columns)}):")
        for i, (c, dt) in enumerate(zip(xtest.columns, xtest.dtypes)):
            print(f"    [{i:2d}] {c:42s} {dt}")
        if feat_list is not None:
            set_feat = set(feat_list)
            set_xtest = set(xtest.columns)
            print(f"\n  feature_names vs X_test:")
            print(f"    en feature_names y NO en X_test: {sorted(set_feat - set_xtest)}")
            print(f"    en X_test y NO en feature_names: {sorted(set_xtest - set_feat)}")
            print(f"    orden idéntico: {list(feat_list) == list(xtest.columns)}")
    else:
        print(f"  X_test.csv no encontrado en {xtest_path}")

    # --- Verificación n_features RF ---
    sep("VERIFICACIÓN — RF espera 74 features")
    if rf is not None:
        n = getattr(rf, "n_features_in_", None)
        print(f"  rf.n_features_in_ = {n}  →  {'OK (74)' if n == 74 else 'REVISAR'}")

    print("\nAuditoría completa.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())

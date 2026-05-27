"""
Generador de artefactos derivados  ·  Fase 0.5 del PLAN.

Produce tres archivos que el backend usa para validar el modelo al startup:

  models/feature_order.json      — 74 features en orden canónico + dtypes.
  models/manifest.json           — SHA-256 de cada .joblib + version global.
  models/golden_prediction.json  — 5 vectores fijos de X_test + predicción RF.

Uso:  ./venv/bin/python scripts/generate_model_artefacts.py
"""
from pathlib import Path
import hashlib
import json
import sys

import joblib
import numpy as np
import pandas as pd

BACKEND = Path(__file__).resolve().parent.parent
MODELS = BACKEND / "models"
PIPELINE_DATA = BACKEND.parent.parent / "pipeline" / "data" / "processed"

# Artefactos versionados que el manifest cubre.
ARTEFACTOS = [
    "04_random_forest.joblib",
    "05_xgboost.joblib",
    "feature_names.joblib",
    "target_enc_distrito.joblib",
    "features_log_transformed.joblib",
    "outlier_caps.joblib",
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def gen_feature_order(xtest: pd.DataFrame, feat_names: list) -> dict:
    """74 features en orden canónico con su dtype. Falla si hay desalineación."""
    if list(feat_names) != list(xtest.columns):
        raise SystemExit("ABORT: feature_names.joblib no coincide con X_test.csv")
    return {
        "n_features": len(feat_names),
        "features": [
            {"name": c, "dtype": str(dt)}
            for c, dt in zip(xtest.columns, xtest.dtypes)
        ],
    }


def gen_manifest() -> dict:
    """SHA-256 de cada artefacto + un hash global como 'version'."""
    hashes = {}
    for nombre in ARTEFACTOS:
        path = MODELS / nombre
        if not path.exists():
            raise SystemExit(f"ABORT: falta artefacto {nombre}")
        hashes[nombre] = sha256(path)
    # version global = hash de los hashes concatenados en orden fijo
    combinado = "".join(hashes[n] for n in ARTEFACTOS)
    version = hashlib.sha256(combinado.encode()).hexdigest()[:16]
    return {"version": version, "sklearn_version": "1.6.1", "artefactos": hashes}


def gen_golden(rf, xtest: pd.DataFrame) -> dict:
    """5 vectores estratificados por precio de y_test + predicción RF esperada."""
    ytest = pd.read_csv(PIPELINE_DATA / "y_test.csv")["log_precio"].reset_index(drop=True)
    # índices ordenados por precio → 5 cortes (bajo, bajo-medio, medio, alto-medio, alto)
    orden = ytest.sort_values().index.to_list()
    n = len(orden)
    cortes = [0.05, 0.27, 0.50, 0.73, 0.95]
    idxs = [orden[min(int(q * n), n - 1)] for q in cortes]

    casos = []
    for rank, i in zip(["bajo", "bajo-medio", "medio", "alto-medio", "alto"], idxs):
        fila = xtest.iloc[[i]]                       # DataFrame 1xN, conserva nombres
        pred_log = float(rf.predict(fila)[0])
        casos.append({
            "rank_precio": rank,
            "row_index": int(i),
            "total_poi_1km": float(xtest.iloc[i]["total_poi_1km"]),
            "input": [float(v) for v in xtest.iloc[i].to_list()],
            "expected": float(np.expm1(pred_log)),
        })
    return {
        "tolerancia_relativa": 0.001,
        "descripcion": "5 vectores fijos de X_test.csv; expected = expm1(RF.predict).",
        "casos": casos,
    }


def main() -> int:
    print("Generando artefactos derivados  ·  Fase 0.5\n")

    xtest = pd.read_csv(PIPELINE_DATA / "X_test.csv")
    feat_names = joblib.load(MODELS / "feature_names.joblib")
    rf = joblib.load(MODELS / "04_random_forest.joblib")

    # 1 — feature_order.json
    feature_order = gen_feature_order(xtest, feat_names)
    (MODELS / "feature_order.json").write_text(
        json.dumps(feature_order, indent=2, ensure_ascii=False))
    print(f"  feature_order.json     — {feature_order['n_features']} features")

    # 2 — manifest.json
    manifest = gen_manifest()
    (MODELS / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False))
    print(f"  manifest.json          — version {manifest['version']}")

    # 3 — golden_prediction.json
    golden = gen_golden(rf, xtest)
    (MODELS / "golden_prediction.json").write_text(
        json.dumps(golden, indent=2, ensure_ascii=False))
    print(f"  golden_prediction.json — {len(golden['casos'])} vectores")
    for c in golden["casos"]:
        print(f"    {c['rank_precio']:11s} row={c['row_index']:3d}  "
              f"poi_1km={c['total_poi_1km']:6.0f}  expected=${c['expected']:.2f}")

    print("\nArtefactos generados en models/.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())

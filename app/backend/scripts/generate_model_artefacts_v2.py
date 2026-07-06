"""
Generador de artefactos de validación para el modelo v2 (producción).
Produce los insumos de las 3 validaciones fail-fast del startup
(model_service._load_v2): manifest hash, n_features y golden prediction.

Produce:
  models/v2/manifest_v2.json           — SHA-256 de cada artefacto v2 servido.
  models/v2/golden_prediction_v2.json  — 5 vectores fijos (forms reales por
                                         distrito → build_features_v2) +
                                         predicción esperada del XGBoost v2.

Uso:  ./venv/bin/python scripts/generate_model_artefacts_v2.py
NO toca los .joblib (modelo CONGELADO): solo lee y registra hashes/outputs.
"""
from pathlib import Path
import hashlib
import json
import sys

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from wasi.paths import MODELS_V2_DIR
MODELS_V2 = MODELS_V2_DIR

ARTEFACTOS_V2 = [
    "modelo_final_v2.joblib",
    "feature_names_v2.joblib",
    "target_enc_distrito_v2.joblib",
    "features_log_transformed_v2.joblib",
    "xgb_q25_v2.joblib",
    "xgb_q50_v2.joblib",
    "xgb_q75_v2.joblib",
]

GOLDEN_FORMS = [
    ("miraflores-alto",  {"lat": -12.1211, "lng": -77.0300, "area": 120, "dormitorios": 3,
                          "banos": 3, "cocheras": 2, "antiguedad_anios": 2,
                          "es_estudio": False, "amenities": []}),
    ("surco-medio",      {"lat": -12.1356, "lng": -76.9836, "area": 85, "dormitorios": 2,
                          "banos": 2, "cocheras": 1, "antiguedad_anios": 8,
                          "es_estudio": False, "amenities": []}),
    ("jesusmaria-medio", {"lat": -12.0750, "lng": -77.0480, "area": 70, "dormitorios": 2,
                          "banos": 1, "cocheras": 0, "antiguedad_anios": 15,
                          "es_estudio": False, "amenities": []}),
    ("sjl-bajo",         {"lat": -12.0260, "lng": -77.0090, "area": 60, "dormitorios": 2,
                          "banos": 1, "cocheras": 0, "antiguedad_anios": 20,
                          "es_estudio": False, "amenities": []}),
    ("barranco-estudio", {"lat": -12.1450, "lng": -77.0210, "area": 38, "dormitorios": 1,
                          "banos": 1, "cocheras": 0, "antiguedad_anios": 5,
                          "es_estudio": True, "amenities": []}),
]

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def main() -> int:
    print("Generando artefactos de validación v2\n")

    hashes = {}
    for nombre in ARTEFACTOS_V2:
        path = MODELS_V2 / nombre
        if not path.exists():
            raise SystemExit(f"ABORT: falta artefacto {nombre}")
        hashes[nombre] = sha256(path)
    combinado = "".join(hashes[n] for n in ARTEFACTOS_V2)
    version = hashlib.sha256(combinado.encode()).hexdigest()[:16]
    manifest = {"version": version, "artefactos": hashes}
    (MODELS_V2 / "manifest_v2.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False))
    print(f"  manifest_v2.json          — version {version} · {len(hashes)} artefactos")

    from wasi.models.model_service import model_service
    from wasi.features.geo_index import geo_lookup
    from wasi.models.ml_v2 import build_features_v2

    model_service.load()
    if model_service.mode != "v2":
        raise SystemExit("ABORT: el servicio no cargó en modo v2")

    casos = []
    for nombre, form in GOLDEN_FORMS:
        geo = geo_lookup(form["lat"], form["lng"])
        X = build_features_v2(form, geo)
        pred = model_service.predict(X)
        casos.append({
            "rank_precio": nombre,
            "input": {c: float(X.iloc[0][c]) for c in X.columns},
            "expected": float(pred),
        })
        print(f"    {nombre:18s} expected=${pred:,.2f}")

    golden = {
        "tolerancia_relativa": 0.001,
        "descripcion": ("5 vectores construidos con build_features_v2 sobre forms "
                        "reales por distrito; expected = expm1(XGB_v2.predict)."),
        "casos": casos,
    }
    (MODELS_V2 / "golden_prediction_v2.json").write_text(
        json.dumps(golden, indent=2, ensure_ascii=False))
    print(f"  golden_prediction_v2.json — {len(casos)} casos · tol 0.1%")
    print("\nListo. El startup v2 ahora puede validar manifest + n_features + golden.\n")
    return 0

if __name__ == "__main__":
    sys.exit(main())

"""Genera el fail-fast del modelo de VENTA (gate "serving seguro" de la auditoría).

Igual que alquiler (generate_model_artefacts_v2.py) pero para venta, que hasta hoy
NO tenía validación de arranque. Produce:
  - manifest_venta.json : hash SHA-256 del xgb_venta.joblib + métrica (MAPE/R²/banda).
  - golden_venta.json   : N forms reales con su predicción esperada (expm1 XGB).

El arranque (venta_service.load) valida ambos: si el .joblib fue cambiado sin
regenerar el manifest, o el entorno mueve la predicción, venta NO se sirve (se
deshabilita con log de error, sin tumbar alquiler). La métrica deja de estar
hardcodeada en el serving: viene del manifest → no se puede servir un modelo con
una etiqueta de MAPE vieja.

NO reentrena el modelo: solo describe el .joblib que ya existe.

Correr:
    PYTHONPATH=src app/backend/venv/bin/python ventas_model/generate_venta_artefacts.py
"""
import hashlib
import json
from pathlib import Path

from wasi.models.venta_service import MAE_PCT, MODEL_R2, ZONE_BAND_PCT, venta_service
from wasi.paths import VENTAS_BUNDLE, VENTAS_GOLDEN, VENTAS_MANIFEST

# Forms reales por distrito (mismos campos que espera venta_service.predict).
GOLDEN_FORMS = [
    {"nombre": "miraflores-3d", "lat": -12.1211, "lng": -77.0300,
     "area": 120, "dormitorios": 3, "banos": 2, "cocheras": 1, "antiguedad_anios": 5},
    {"nombre": "san-isidro-2d", "lat": -12.0970, "lng": -77.0365,
     "area": 90, "dormitorios": 2, "banos": 2, "cocheras": 1, "antiguedad_anios": 3},
    {"nombre": "surco-4d", "lat": -12.1450, "lng": -76.9920,
     "area": 160, "dormitorios": 4, "banos": 3, "cocheras": 2, "antiguedad_anios": 10},
    {"nombre": "jesus-maria-2d", "lat": -12.0740, "lng": -77.0480,
     "area": 75, "dormitorios": 2, "banos": 1, "cocheras": 0, "antiguedad_anios": 15},
    {"nombre": "san-borja-3d", "lat": -12.1080, "lng": -76.9990,
     "area": 110, "dormitorios": 3, "banos": 2, "cocheras": 1, "antiguedad_anios": 8},
]


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def main():
    if not VENTAS_BUNDLE.exists():
        raise SystemExit(f"No existe {VENTAS_BUNDLE} — no hay modelo de venta que describir.")

    venta_service.load()
    if not venta_service.is_loaded():
        raise SystemExit("venta_service no cargó el modelo — no se puede generar golden.")

    # Golden: predicción esperada de cada form con el modelo actual.
    casos = []
    for f in GOLDEN_FORMS:
        pred = venta_service.predict(f)
        casos.append({"nombre": f["nombre"], "form": f,
                      "expected_fair_value": round(pred["fair_value"], 2)})

    golden = {
        "tolerancia_relativa": 0.001,
        "descripcion": "Forms reales de venta por distrito; expected = venta_service.predict (expm1 XGB).",
        "casos": casos,
    }
    VENTAS_GOLDEN.write_text(json.dumps(golden, indent=2, ensure_ascii=False), encoding="utf-8")

    manifest = {
        "version": _sha256(VENTAS_BUNDLE)[:16],
        "artefacto": VENTAS_BUNDLE.name,
        "sha256": _sha256(VENTAS_BUNDLE),
        # La métrica vive acá, no hardcodeada en el serving: cambiar el modelo
        # sin re-medir/regenerar el manifest se detecta al arrancar.
        "metrica": {"mae_pct": MAE_PCT, "r2": MODEL_R2, "zone_band_pct": ZONE_BAND_PCT},
    }
    VENTAS_MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"[gen-venta] manifest → {VENTAS_MANIFEST.name} (sha {manifest['sha256'][:12]}…)")
    print(f"[gen-venta] golden   → {VENTAS_GOLDEN.name} ({len(casos)} casos)")
    for c in casos:
        print(f"           {c['nombre']:16} → ${c['expected_fair_value']:,.0f}")


if __name__ == "__main__":
    main()

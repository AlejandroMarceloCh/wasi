"""
Gate 4-v2 — equivalencia del pipeline para el ARTEFACTO SERVIDO (v2).

Hermano de `validate_pipeline.py` (Gate 4), pero para el modelo que de verdad
se sirve en producción (`model_mode: v2`). El Gate 4 original sigue forzando
v1 con `DPD_FORCE_V1=1` para validar la equivalencia feature-by-feature contra
`X_test.csv` (dataset v1 commiteado); ese gate se mantiene como referencia
histórica del dataset v1.

Este gate NO toca `DPD_FORCE_V1` → cae al camino real de producción:
  - `model_service.load()` corre las 3 validaciones fail-fast de v2
    (manifest_v2 + n_features + golden_prediction_v2).
  - Además verifica explícitamente que `feature_names_v2.joblib` coincida con
    `feature_names_in_` del modelo (contrato del feature order).
  - Re-corre los 5 casos golden contra el input persistido para reportar la
    diferencia observada (no sólo "pasó / no pasó").

Por qué no hay equivalencia feature-by-feature como en v1: el dataset v2 no
está versionado en el repo (ver bitácora Gate 2 / Sprint 10), así que no hay
`X_test_v2.csv` contra el cual comparar. El contrato que sí podemos validar
reproduciblemente es: (a) el modelo carga sin RuntimeError, (b) sus 101
features están en el orden declarado, y (c) las 5 golden predictions del
arte­facto sirven — mismas validaciones que el arranque del backend.

Uso:  ./venv/bin/python scripts/validate_pipeline_v2.py
"""
from pathlib import Path
import json
import os
import sys

import pandas as pd

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

# NO seteamos DPD_FORCE_V1 — queremos el camino de producción (USE_V2=True).
# Si el entorno lo trae puesto, avisamos y salimos con error explícito (no
# tiene sentido validar v2 con v1 forzado).
if os.environ.get("DPD_FORCE_V1"):
    print("ERROR: DPD_FORCE_V1 está seteado — este gate valida v2.")
    print("       Quitá DPD_FORCE_V1 del entorno antes de correrlo.")
    sys.exit(2)

from wasi.models.model_service import USE_V2, MODELS_V2, model_service  # noqa: E402
from wasi.paths import REPO_ROOT  # noqa: E402

GATES = Path(os.environ.get("WASI_GATES_DIR", str(REPO_ROOT / "gates")))


def main() -> int:
    if not USE_V2:
        print(f"ERROR: USE_V2=False — falta {MODELS_V2}/modelo_final_v2.joblib "
              f"o el manifest. Este gate solo corre cuando v2 está servido.")
        return 2

    # 1) Carga: ejecuta _check_manifest_v2 + _check_n_features + _check_golden_v2.
    #    Si algo falla acá, levanta RuntimeError (igual que el arranque del backend).
    model_service.load()

    checks = {}

    # 2) mode y feature count.
    checks["mode"] = model_service.mode == "v2"
    feature_order = model_service.feature_order
    checks["n_features"] = len(feature_order) == 101
    print(f"Check mode:        {model_service.mode!r}  "
          f"{'OK' if checks['mode'] else 'FALLA'}")
    print(f"Check n_features:  {len(feature_order)}  "
          f"{'OK (==101)' if checks['n_features'] else f'FALLA (esperado 101)'}")

    # 3) feature_names_v2.joblib coincide con feature_names_in_ del modelo.
    nombres_modelo = [str(x) for x in
                      getattr(model_service._model, "feature_names_in_", [])]
    checks["feature_order_match"] = nombres_modelo == feature_order
    print(f"Check feature_order vs feature_names_in_: "
          f"{'OK' if checks['feature_order_match'] else 'FALLA'}")

    # 4) Golden predictions v2 reproducibles (reporte, no solo pass/fail).
    golden_path = MODELS_V2 / "golden_prediction_v2.json"
    golden = json.loads(golden_path.read_text())
    tol = golden["tolerancia_relativa"]
    peor_dif = 0.0
    detalles = []
    for caso in golden["casos"]:
        X = pd.DataFrame([caso["input"]], columns=feature_order)
        pred = float(model_service.predict(X))
        esperado = float(caso["expected"])
        dif = abs(pred - esperado) / esperado
        peor_dif = max(peor_dif, dif)
        detalles.append((caso["rank_precio"], esperado, pred, dif))
    checks["golden"] = peor_dif <= tol
    print(f"Check golden v2:   {len(detalles)} casos, peor dif "
          f"{peor_dif*100:.4f}% (tol {tol*100:.3f}%)  "
          f"{'OK' if checks['golden'] else 'FALLA'}")

    # 5) Quantile (opcional — solo si el artefacto los trae).
    if model_service.has_quantile:
        cov_path = MODELS_V2 / "quantile_coverage.json"
        cov = json.loads(cov_path.read_text()) if cov_path.exists() else {}
        checks["quantile"] = bool(cov)
        print(f"Check quantile:    coverage P25-P75="
              f"{cov.get('coverage_p25_p75', '?')}  "
              f"{'OK' if checks['quantile'] else 'SIN coverage.json'}")
    else:
        checks["quantile"] = None
        print("Check quantile:    skip (sin modelos quantile)")

    todos_ok = all(v for v in checks.values() if v is not None)
    estado = "CERRADO" if todos_ok else "REVISAR"

    # Reporte.
    GATES.mkdir(exist_ok=True)
    filas = "\n".join(
        f"| {r} | ${e:,.2f} | ${p:,.2f} | {d*100:.4f}% |"
        for r, e, p, d in detalles
    )
    md = f"""# Gate 4-v2 — equivalencia del pipeline v2 (ARTEFACTO SERVIDO) · RESULTADO

**Fecha:** autogenerado por `validate_pipeline_v2.py`
**Estado:** {estado}.

## Por qué este gate existe

`validate_pipeline.py` (Gate 4) fuerza `DPD_FORCE_V1=1` y valida el dataset
v1 (74 features). En producción el backend sirve **v2** (101 features,
XGBoost) — este gate valida ese artefacto, no el de referencia.

## Checks

- **mode v2 activo:** `{'OK' if checks['mode'] else 'FALLA'}` (`{model_service.mode}`)
- **101 features:** `{'OK' if checks['n_features'] else 'FALLA'}` ({len(feature_order)})
- **feature_names_v2.joblib == feature_names_in_:** `{'OK' if checks['feature_order_match'] else 'FALLA'}`
- **golden_prediction_v2 (tolerancia {tol*100:.3f}%):** `{'OK' if checks['golden'] else 'FALLA'}`
- **quantile (opcional):** `{checks['quantile']}`

## Reproducibilidad de las 5 golden predictions

| caso | esperado | predicho | dif rel |
|------|---------:|---------:|--------:|
{filas}

Peor diferencia observada: **{peor_dif*100:.4f}%** (tol {tol*100:.3f}%).

## Qué NO cubre este gate

No hay equivalencia feature-by-feature contra `X_test` v2: el dataset v2 no
está versionado en el repo (ver bitácora Gate 2 / Sprint 10). Las validaciones
reproducibles desde el repo son las mismas que el arranque del backend:
manifest (hashes SHA-256), número/order de features, y golden predictions.
"""
    out = GATES / "gate_v2_resultado.md"
    out.write_text(md)
    print(f"Escrito: {out}")
    return 0 if todos_ok else 1


if __name__ == "__main__":
    sys.exit(main())

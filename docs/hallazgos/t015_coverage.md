# T015 — Coverage P25–P75 vs 50% (correctitud)

**TARGET:** `model_service.py` + artefactos quantile  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Coverage empírico **42.74%** vs 50% teórico (`models/v2/quantile_coverage.json`). **Conformal prediction no está implementada** en el repo; solo mencionada en README como trabajo futuro.

---

## Hallazgos

### [MEDIO] · Intervalos quantile sub-cobren ~7.3 pp · `models/v2/quantile_coverage.json:2-3` — `"coverage_p25_p75": 0.4274`, `"expected_coverage": 0.5`, `n_test=503`. Startup log: `model_service.py:110-111`. · El 57% de avisos reales caen fuera del banda P25–P75 mostrada al usuario. · Calibrar con conformal en **holdout** (sin reentrenar modelo central) ajustando offsets por cuantil.

### [MEDIO] · Modelos quantile con hiperparámetros distintos al central · JSON `note`: quantile usa `max_depth=5, n_estimators=300` vs central v2 más profundo (nota en JSON línea 19). · Intervalos no son intervalos del mismo estimador — cobertura baja esperable. · Unificar hiperparámetros o conformalizar predicciones del central.

### [INFO] · Conformal prediction: no hay código · Búsqueda `conformal` en `*.py`: 0 matches; solo `README.md:370,385`. · No se puede “arreglar sin reentrenar” hoy con un switch. · Implementar capa post-hoc: scores de no conformidad en `y_test` + ajuste de quantiles.

### [BAJO] · MAPE P50 quantile 15.5% vs central 16.4% · `quantile_coverage.json:6` — mediana quantile ligeramente mejor. · Intervalos centrados en P50 pueden ser más coherentes que mezclar `predict()` central con bandas quantile. · Exponer `predict_interval()` como default en UI (ya existe `model_service.py:220-243`).

---

## Veredicto

**Sub-cobertura confirmada.** Conformal prediction **podría** mejorar coverage sin reentrenar el XGBoost central, pero **requiere implementación nueva** — no existe hoy.

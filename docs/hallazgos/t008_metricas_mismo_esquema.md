# T008 — R² 0.847 y MAPE 16.4% mismo esquema (honestidad)

**TARGET:** `notebooks/05_evaluacion_seleccion.ipynb`  
**LENTE:** honestidad  
**Fecha:** 2026-07-06

---

## Resumen

**No:** R² 0.847 y MAPE 16.4% **no** provienen del mismo esquema de validación en el código verificado. R² ~0.85 sale del split aleatorio (nb04 XGBoost val/test); MAPE 16.4% es constante en `ml.py` asociada a validación espacial según README, sin script de respaldo.

---

## Hallazgos

### [CRÍTICO] · Mezcla de esquemas en métricas de producto · `src/wasi/models/ml.py:60` — `_METRICS_V2 = {"r2": 0.847, "mae_pct": 16.4}` empaquetados juntos; `model_service.py:98-100` intenta leer `metricas_test` del bundle pero recibe `None` en v2. · UI/disclaimers pueden mostrar R² optimista (aleatorio) con MAPE “honesto” (espacial) sin aclaración. · Separar campos: `r2_random`, `mape_spatial`; mostrar pareja coherente al usuario.

### [ALTO] · Notebook 05 selecciona Linear Regression, no XGBoost v2 · Celda 12: “Modelo seleccionado: Linear Regression”; celda 24 guarda `modelo_final.joblib` con métricas del **best_model** del experimento v1. · Producción usa XGBoost v2 (`model_service.py:76-86`) — nb05 no es la fuente del modelo actual. · Actualizar nb05 o archivarlo como histórico v1.

### [MEDIO] · R² 0.847 ≈ R² val XGBoost 0.8501 (nb04) · Output nb04: XGBoost val R²=0.8501, MAPE=15.78%. Constante `0.847` en `ml.py` probablemente redondeo de test/val **aleatorio**. · Confirma mezcla de esquemas si MAPE 16.4% es espacial. · Recalcular ambas métricas en un solo notebook de validación.

### [INFO] · Precedente explícito en venta (lección aprendida) · `ventas_model/train_venta.py:106-109` — tabla separada: R² solo en fila aleatoria; MAPE espacial sin R². · Modelo de honestidad parcial ya aplicado en venta. · Igualar para alquiler.

---

## Veredicto

**Deshonestidad metodológica en reporting:** R² y MAPE reportados juntos no comparten el mismo split/validación verificable.

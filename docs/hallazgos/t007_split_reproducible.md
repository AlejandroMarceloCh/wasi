# T007 — Reproducibilidad 15.7% vs 16.4% (reproducibilidad)

**TARGET:** notebooks/04, 05  
**LENTE:** reproducibilidad  
**Fecha:** 2026-07-06

---

## Resumen

El **15.78%** es reproducible desde el notebook 04 (XGBoost, split aleatorio, val). El **16.4%** está hardcodeado en `ml.py` y **no** aparece en notebooks 04/05 ni en `modelo_final_v2.joblib` (`metricas_test: None`). No hay script versionado que reproduzca el contraste aleatorio vs espacial para alquiler.

---

## Hallazgos

### [CRÍTICO] · MAPE 15.78% = XGBoost validación aleatoria (nb04) · `notebooks/04_entrenamiento_modelos.ipynb` output celda XGBoost: `[Val] MAPE=15.78% R²=0.8501`; tabla comparativa líneas ~791. Split: `random_state=42` en nb03 celda 7. · Métrica reproducible **solo** con datos procesados (`data/processed/` ausente en repo actual). · Restaurar `X_train.csv`/`y_val.csv` o documentar ruta alternativa.

### [CRÍTICO] · MAPE 16.4% no reproducible desde notebooks 04/05 · `src/wasi/models/ml.py:60` — `_METRICS_V2 = {"mae_pct": 16.4}` constante; `models/v2/modelo_final_v2.joblib` bundle con `metricas_test: None`. README (`README.md:175-176`) afirma GroupKFold espacial 16.4% vs aleatorio 15.7%. · Narrativa académica sin código trazable en targets auditados. · Publicar script de validación espacial o ajustar cifras al nb04.

### [MEDIO] · Contraste venta sí es reproducible (referencia) · `ventas_model/train_venta.py:57-84,124` — imprime MAPE aleatorio y espacial en la misma corrida; `ventas_model/RESULTADOS.md` documenta ambos. · Patrón correcto que falta en alquiler. · Replicar estructura A/B de `train_venta.py` para pipeline de alquiler v2.

### [INFO] · Diferencia 15.7 vs 16.4 coherente con sesgo espacial leve · +0.6 pp espacial > aleatorio es plausible si el espacial es honesto. · Sin script, no verificable numéricamente. · Ejecutar GroupKFold cuando exista script.

---

## Veredicto

**No reproducible** el par 15.7%/16.4% para alquiler desde notebooks 04/05. Solo el 15.78% aleatorio tiene evidencia directa.

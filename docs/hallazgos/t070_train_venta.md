# T070 — Rigor `train_venta.py`

**TARGET:** `ventas_model/train_venta.py`  
**LENTE:** rigor (hiperparámetros, validación espacial, honestidad métricas)  
**Fecha:** 2026-07-06

---

## Resumen

**Mejor disciplina que alquiler en notebooks**: GroupKFold espacial con re-encoding por fold y MAPE espacial como métrica principal en `RESULTADOS.md`. Residual: hiperparámetros sin justificación ni tuning, split de validación del 15% **no usado**, MAPE en escala original sin corrección de Jensen, y R²/MAE solo del split aleatorio.

---

## Hallazgos

### [MEDIO] · Split de validación (15%) creado y descartado · `ventas_model/train_venta.py:59-60` — `iva` se calcula con `train_test_split(itmp, test_size=0.50)` pero no interviene en early stopping, tuning ni reporte. · Desperdicio de datos y oportunidad perdida de detectar overfitting antes del test aleatorio. · Usar `iva` para `early_stopping_rounds` de XGBoost o para grid search; o eliminar el split y documentar 80/20.

### [MEDIO] · Hiperparámetros fijos sin búsqueda ni ablación · `ventas_model/train_venta.py:26-31` — `n_estimators=400`, `max_depth=5`, `learning_rate=0.05`, etc. copiados sin CV ni justificación en el script. · Óptimo local desconocido; riesgo de sobre/sub-ajuste no cuantificado. · `RandomizedSearchCV` con `GroupKFold` sobre `coord_cell`; fijar params en README tras estabilizar.

### [MEDIO] · Validación espacial solo reporta MAPE · `ventas_model/train_venta.py:72-84,106-109` — loop espacial calcula MAPE por fold; R² y MAE USD quedan en `—` en la tabla de `RESULTADOS.md`. · Imposible comparar error absoluto en USD bajo validación honesta; sesgo de escala log no auditado en folds espaciales. · Calcular `r2_score` y `MAE` en USD por fold en el mismo loop.

### [MEDIO] · MAPE sobre `expm1` sin corrección de sesgo log · `ventas_model/train_venta.py:54,66-68,81-82` — target `log1p(price_usd)`; predicciones retransformadas con `expm1` (sesgo de Jensen, cf. T014 alquiler). · MAPE espacial 15.8% puede estar ligeramente optimista vs error medio real en USD. · Evaluar Duan smearing o métricas en log; reportar ambas.

### [BAJO] · Grupos espaciales desbalanceados · `build_features_venta.py:37` + datos: 6 271 filas, 2 549 `coord_cell` únicas, máx **89 filas/celda**, 1 084 celdas con >1 aviso. · GroupKFold con grupos de tamaño muy distinto puede dar folds con varianza alta (±0.7% ya observado). · `GroupKFold` con `n_splits` adaptado; o agrupar por edificio si hay ID.

### [BAJO] · Constantes de métrica en `venta_service` mezclan esquemas · `src/wasi/models/venta_service.py:24-25` — `MAE_PCT=15.8` (espacial) y `MODEL_R2=0.856` (aleatorio, `train_venta.py:69`). · API/logs pueden leerse como si R² fuera validación espacial (misma trampa T008, mitigada en `RESULTADOS.md`). · Renombrar a `MODEL_R2_RANDOM_SPLIT`; no exponer R² como métrica de producción.

### [INFO] · GroupKFold espacial con encoder por fold · `ventas_model/train_venta.py:72-78` — `encode_distrito(df.iloc[tr])` dentro del loop; grupos = `coord_cell`. · MAPE espacial 15.8% es metodológicamente defendible. · Mantener como plantilla; ya cubierto en T016 desde lente leakage.

### [INFO] · Artefacto final entrenado en dataset completo · `ventas_model/train_venta.py:86-95` — encoding y modelo sobre todo `df` tras métricas. · Correcto para serving si las métricas honestas ya se calcularon en B. · OK; documentar en informe de modelo.

### [INFO] · Honestidad en reporte vs split aleatorio · `ventas_model/train_venta.py:111-112` y `RESULTADOS.md:14-15` — advierte que el aleatorio infla la métrica. · Cultura de métrica correcta para venta v2. · OK.

---

## Veredicto

**Rigor espacial superior al pipeline de alquiler versionado.** Cerrar gaps de tuning, usar el holdout de validación, y reportar R²/MAE espaciales elevaría confianza antes de producción más allá del demo v0.

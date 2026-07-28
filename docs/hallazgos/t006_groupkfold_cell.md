# T006 — GroupKFold y `coord_cell` (correctitud)

**TARGET:** notebooks/04 + `src/wasi/features/geo_index.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Para **alquiler**, no existe `coord_cell` ni `GroupKFold` en notebooks 04/05 ni en `geo_index.py`. La validación espacial documentada en README **no es reproducible** desde esos targets. Para **venta**, `coord_cell` agrupa por lat/lng redondeados a 3 decimales (~111 m) pero **no garantiza** separación a nivel edificio.

---

## Hallazgos

### [CRÍTICO] · Notebooks 04/05: sin GroupKFold ni clave de grupo espacial · Búsqueda en repo: `GroupKFold` solo en `ventas_model/train_venta.py:72-73`. `notebooks/04_entrenamiento_modelos.ipynb` usa split aleatorio 70/15/15 heredado de nb03. · El MAPE “espacial 16.4%” de alquiler **no se puede verificar** en los targets de esta tarea. · Incorporar script/celda con GroupKFold (p.ej. por `h3_index_8` o celda lat/lng) o corregir documentación.

### [MEDIO] · `geo_index.py` no define `coord_cell` · `src/wasi/features/geo_index.py:75-153` — índice para **inferencia** (IDW + vecino más cercano); no participa en splits de entrenamiento. · No es el mecanismo anti-leakage del modelo de alquiler. · Separar conceptos: geo_index = serving; GroupKFold = entrenamiento.

### [MEDIO] · `coord_cell` en venta: resolución ~111 m, colisiones frecuentes · `ventas_model/build_features_venta.py:36-37` — `round(lat,3)_round(lng,3)`. En `ventas_features.csv` (6271 filas): 2549 celdas únicas; **1084 celdas** con >1 aviso (máx 89/edificio). · GroupKFold evita leakage **entre celdas**, no entre unidades del mismo edificio si comparten coordenada redondeada. · Finer grid (4 decimales / H3 res 10) o agrupar por `id` de edificio si existe.

### [BAJO] · Distinto edificio, misma celda: avisos separados en train y test · Con resolución 3 decimales, dos pins a ~50 m pueden caer en celdas distintas → fuga espacial residual en split aleatorio de venta (artefacto A en `train_venta.py:57-70`). · MAPE aleatorio de venta optimista vs espacial. · Priorizar métrica espacial (ya reportada en RESULTADOS.md).

---

## Veredicto

**No conforme** respecto a la premisa del plan para alquiler (04 + geo_index). La clave espacial existe solo en venta y es una aproximación gruesa.

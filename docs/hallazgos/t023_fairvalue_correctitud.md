# T023 — Fairvalue: correctitud (predict/simulate/venta/counterfactual/comparables)

**TARGET:** `app/backend/routers/fairvalue.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Out-of-bounds unificado en 400 con copy amable. Simulate/counterfactual no persisten. Hay pérdida de datos al re-leer análisis y validación laxa en narrativa.

---

## Hallazgos

### [INFO] · Out-of-bounds → 400 mensaje Lima · `fairvalue.py:94-98,157-161,184-187,226-229,246-250` — `OutOfBoundsError` capturado consistentemente. · UX coherente. · OK.

### [ALTO] · `GET /analyses/{id}` no restaura counterfactuals ni prediction_interval · `fairvalue.py:48-83,283-292` — `_analysis_to_out` omite ambos; solo `predict` los adjunta en líneas 140-143. · Reabrir análisis desde perfil/historial pierde gráficos de palancas y banda P25-P75. · Persistir en tablas auxiliares o recomputar al leer (mismo input del Property).

### [MEDIO] · `predict` siempre persiste aunque sea exploración · `fairvalue.py:100-134` — cada POST crea Property+Analysis+Factors; `from_catalog` en schema no cambia comportamiento. · Historial inflado si el cliente llama `/predict` en vez de `/simulate` (mitigado en UI de publicar, no en fairvalue-form alquiler). · Flag `persist=false` o rutear UI de preview solo a simulate.

### [INFO] · `predict-venta` 503 si modelo no cargado · `fairvalue.py:178-181` — fail explícito. · Correcto. · OK.

### [INFO] · `simulate` y `counterfactual` sin side-effects en BD · `fairvalue.py:146-167,216-230` — solo lectura del modelo. · OK.

### [MEDIO] · Parámetro `mode` en narrativa sin validar · `fairvalue.py:404,420,493,513` — cualquier string ≠ `"seller"` cae en rama buyer. · `mode=admin` silenciosamente usa prompt de comprador. · Validar `mode in ("buyer","seller")` → 422.

### [BAJO] · `predict-venta` hace `db.commit()` solo para `last_activity_at` · `fairvalue.py:201-202` — side-effect mínimo sin Analysis. · Actividad de usuario actualizada aunque sea preview. · Aceptable; documentar.

### [INFO] · Comparables exige auth y valida bbox · `fairvalue.py:232-253` — `in_bbox` antes de consultar índice. · Sin PII en items (schema `ComparableItem`). · OK.

### [INFO] · Ownership en análisis guardados · `fairvalue.py:289-291,305-307,414-416` — 404 si no es del usuario. · OK.

---

## Veredicto

**Modelo y errores geográficos bien manejados.** El hueco crítico es la rehidratación incompleta de `PredictOut` al leer análisis persistidos.

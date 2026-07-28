# T031 — Fairvalue: contrato backend ↔ frontend

**TARGET:** `app/backend/routers/fairvalue.py`  
**LENTE:** contrato  
**Fecha:** 2026-07-06

---

## Resumen

`api.js` y pantallas consumen los endpoints con shapes mayormente alineados. La brecha principal es la relectura de análisis sin `counterfactuals`/`prediction_interval`. Dos formatos de contrafactual coexisten (embed vs endpoint).

---

## Hallazgos

### [ALTO] · `getAnalysis` incompleto vs `predict` en vivo · `fairvalue.py:48-83` vs `screens-fairvalue.jsx:844-855,1070-1108` — UI usa `liveData` si coincide `analysis_id`; si no, `Api.getAnalysis` pierde `counterfactuals` y `prediction_interval`. · Reabrir desde perfil/reportes muestra menos widgets que tras calcular. · Recomputar o persistir al guardar análisis.

### [INFO] · `predict` alquiler — campos usados por frontend · `screens-fairvalue.jsx:112-126` — `analysis_id`, `fair_value`, `zone`, `diff_pct`, warnings, factors. · Contrato OK en respuesta fresca. · OK.

### [INFO] · `predictVenta` — subconjunto consumido · `screens-fairvalue.jsx:103-108,419-491` — `fair_value`, `announced_price`, `diff`, `zone`, `min`/`max`, `mae_pct`, `n_comparables`, `warnings`, `distrito`. · Sin `analysis_id` (venta no persiste) — UI usa `ventaData` en memoria. · OK.

### [INFO] · `simulate` — sliders what-if · `screens-fairvalue.jsx:652-667`, `screens-seller.jsx:189-195` — `fair_value`, `zone`, `p25/p50/p75`. · Backend `SimulateOut` alinea. · OK.

### [MEDIO] · Dos schemas de contrafactual · `predict` embebe `Counterfactual` (`feature`, `pct_change`, …) · `POST /counterfactual` devuelve `CounterfactualOut.items` (`kind`, `direction`, `delta_pct`, …). · Frontend: result embebe tipo A (`screens-fairvalue.jsx:1095`); listing detail y publish usan tipo B (`screens-listings.jsx:481`, `screens-seller.jsx:197`). · Documentar como contratos distintos; no unificar sin migración UI.

### [INFO] · `comparables` query params · `api.js:213-217` — lat, lng, area?, dormitorios?. · Router `fairvalue.py:232-238` coincide. · OK.

### [BAJO] · UI hardcodea "Venta · v1" · `screens-fairvalue.jsx:482` — ignora `data.version` del backend (`venta-v1`). · Desincronización cosmética si cambia versión. · Usar `data.version`.

### [INFO] · Narrative `mode` buyer/seller · `api.js:221-222`, `screens-fairvalue.jsx:864` — query `?mode=seller` para propietario. · Backend acepta cualquier string (ver T023). · Contrato informal funciona para valores conocidos.

### [INFO] · `listAnalyses` para modal dashboard · `api.js:224`, `screens-home.jsx:953` — `RecentItem` con `id`, `zone`, `address`. · Dashboard inalcanzable (T028) pero contrato válido. · OK.

---

## Veredicto

**Contrato feliz-path sólido.** Arreglar rehidratación de `PredictOut` es el desajuste de mayor impacto UX.

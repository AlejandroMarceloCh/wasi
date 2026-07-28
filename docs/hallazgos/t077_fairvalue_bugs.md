# T077 — FairValue: bugs (wizard, resultado, hooks, null-guards)

**TARGET:** `app/screens-fairvalue.jsx`  
**LENTE:** bugs  
**Fecha:** 2026-07-06

---

## Resumen

Wizard y resultados son robustos en null-guards (`Array.isArray`, fallbacks de zona). Los bugs relevantes son races en cargas paralelas del resultado, Nominatim sin abort, y ensanchamiento client-side de bandas que puede divergir del servidor.

---

## Hallazgos

### [ALTO] · `FairValueResult`: explain/narrative sin cancel al cambiar `analysisId` · `screens-fairvalue.jsx:825-867` — `cancel` solo protege `getAnalysis`; `Api.explain` y `Api.narrative` siguen y llaman `setExplain`/`setNarrative` sin comprobar id actual. · Usuario abre análisis A, navega rápido a B: puede ver narrativa de A con datos de B. · Pasar `reqId = analysisId` y comparar en cada `.then`; o `AbortController` si el API lo soporta.

### [MEDIO] · Reverse geocode Nominatim sin abort · `screens-fairvalue.jsx:71-89` — fetch a OSM en paso 3 sin `AbortController`; múltiples pins rápidos encolan respuestas. · `locLabel` muestra distrito viejo tras mover pin. · Abort en cleanup + ignorar si `key !==` actual.

### [MEDIO] · Bandas `bandMin`/`bandMax` recalculadas en cliente · `screens-fairvalue.jsx:955-959` — si `confidence` Media/Baja, ignora `data.min`/`data.max` del backend y aplica `CONF_WIDEN`. · Posicionamiento seller (Conservador/Agresivo) puede diferir del servidor y del modal detallado (`detail.price_min`). · Usar siempre `data.min`/`data.max` o documentar divergencia; alinear con backend.

### [MEDIO] · `WhatIfSimulator` mount: closure stale en primer simulate · `screens-fairvalue.jsx:650-660` — `useE(..., [])` llama `payload(f)` con `f` inicial; si `baseForm` llegara async, primer valor erróneo. · En práctica `baseForm` es prop inmediata; riesgo bajo en detalle listing. · Depender de `[baseForm.lat, baseForm.area, ...]` o pasar `baseForm` directo.

### [MEDIO] · Carrera en `WhatIfSimulator.run` parcialmente mitigada · `screens-fairvalue.jsx:662-675` — `reqId` en debounce simulate. · OK para sliders; el mount inicial no tiene reqId. · Extender patrón al primer fetch.

### [BAJO] · `VentaResult` sin guard si `bandMin`/`bandMax` null · `screens-fairvalue.jsx:431-432,450-452` — asume números del API. · 422/respuesta incompleta podría NaN en `barPct`. · `typeof bandMin === 'number'` antes de barra.

### [BAJO] · `ComparablesCard` siempre “/mes” · `screens-fairvalue.jsx:767,775` — copy fijo aunque el análisis sea venta (si se reutilizara). · Hoy venta usa `VentaResult` separado. · OK mientras rutas separadas; riesgo si unifican.

### [BAJO] · `EntornoMapScreen` Photon/Nominatim sin cancel en búsqueda · `screens-fairvalue.jsx:1486-1500` — debounce 400 ms sin abort. · Sugerencias desordenadas al borrar texto rápido. · AbortController por request.

### [INFO] · `banner warn` class · Sprint 0. · No re-reportar.

### [INFO] · Teclado en sugerencias AddressSearch · Sprint 5 `screens-core.jsx`. · No re-reportar.

### [INFO] · Parser errores API · Sprint 0 `api.js`. · No re-reportar.

---

## Veredicto

Prioridad: **cancelación coherente en FairValueResult** (explain + narrative + detailed). Es el bug con mayor riesgo de mostrar veredicto/narrativa incorrectos al usuario.

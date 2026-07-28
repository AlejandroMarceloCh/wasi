# T100 — Flujo FairValue + entorno: e2e

**TARGET:** `app/screens-fairvalue.jsx`, `app/app.jsx` (`onSubmitForm`, `entornoReturn`)  
**LENTE:** e2e (código + QA manual)  
**Fecha:** 2026-07-06  
**Browser:** no ejecutado — inferencia de código + gaps QA.

---

## Resumen

Estimar precio → ver resultado (gauge, narrativa, SHAP en alquiler) → mapa de entorno → volver es el core de Wasi. El wizard de 3 pasos y `entornoReturn` (Sprint 3) arreglaron el callejón sin salida desde home. Persisten races en cargas del resultado y asimetría venta vs alquiler en explicabilidad.

---

## Flujo documentado (happy path)

### Alquiler
1. Tab **Analizar precio** → `FairValueForm` pasos: Ubicación → Características → Precio.
2. Submit → `Api.predict` (persiste análisis) → `onSubmitForm(analysisId, ctx, { predictData, form })` → `fairvalue-result`.
3. `FairValueResult` carga `explain` + `narrative`; opcional guardar reporte.
4. **Ver contexto del barrio** → `setEntornoReturn('fairvalue-result')` → `entorno-map`.
5. **Atrás** en entorno → vuelve a resultado (o a home si se abrió desde ahí con `go()`).

### Venta
1. Mismo wizard con `operacion = venta` → `Api.predictVenta` (no persiste) → `VentaResult`.
2. Sin `analysisId`, sin SHAP ni guardar reporte; sí botón entorno.

### Desde catálogo
`ListingDetailScreen` → Analizar → `fvPrefill` + `from_catalog: true` → form con banner de aviso del catálogo.

---

## Hallazgos

### [ALTO] · Race explain/narrative al cambiar análisis · `screens-fairvalue.jsx:825-867` (T077) — `getAnalysis` tiene `cancel`; `explain` y `narrative` no. · Usuario abre análisis A, luego B desde perfil: narrativa de A con datos de B. · **QA manual:** historial perfil → dos análisis seguidos → leer narrativa. · reqId en todos los fetches.

### [MEDIO] · Venta sin SHAP / explain / guardar reporte · `screens-fairvalue.jsx:100-108,419-583` — flujo acorta en gauge + warnings. · Paridad de producto menor vs alquiler; usuario venta no ve “por qué”. · Roadmap venta v2 o copy “explicación disponible solo alquiler”.

### [MEDIO] · `locLabel` Nominatim sin abort en paso 3 · `screens-fairvalue.jsx:71-89` — pins rápidos dejan etiqueta vieja. · **QA manual:** mover pin 3 veces seguidas en paso 3.

### [MEDIO] · Bandas precio ensanchadas en cliente si confianza Media/Baja · `screens-fairvalue.jsx:955-959` (T077) — puede divergir de `data.min/max` del servidor. · Conservador/Agresivo del vendedor no coincide con modal detallado.

### [MEDIO] · `fairvalue-result` back siempre al formulario · `app.jsx:208` — no respeta si entraste desde detalle de listing. · Tras analizar un aviso, back debería volver al detalle. · `fvReturn` análogo a `detailReturn`.

### [BAJO] · Área máx 1000 m² en FairValue vs 2000 en publicar venta · `screens-fairvalue.jsx:59`. · Mismo inmueble no estimable en analizar. · Alinear `PRECIO_MAX`/`area` por operación.

### [BAJO] · `EntornoMapScreen` búsqueda Photon sin abort · `screens-fairvalue.jsx:1486-1500` — sugerencias desordenadas.

### [INFO] · `entornoReturn` desde home · Sprint 3. · No re-reportar.

### [INFO] · `banner warn` · Sprint 0. · No re-reportar.

### [INFO] · Teclado en sugerencias · Sprint 5. · No re-reportar.

### [INFO] · `simulate` vs `predict` en publicar (no ensuciar historial) · Sprint 2. · No re-reportar.

---

## Gaps de QA manual

| Paso | Qué probar | Riesgo |
|------|------------|--------|
| Wizard completo alquiler | 3 pasos + precio límite | 422 traducido (S0) |
| Wizard venta | Toggle venta, precio $500k | `VentaResult` + warnings modelo |
| SHAP / grupos | Expandir factores en resultado | Datos vacíos si explain falla |
| Guardar reporte | Botón guardar | Contador perfil sube |
| Entorno desde resultado | POIs, score, búsqueda alias “jockey” | Alias T095 |
| Entorno desde home | Mapa distrito sin análisis previo | Vuelve a home (S3) |
| Confianza Baja | Distrito pocos avisos | Banner cobertura (T078) |
| Sesión expira en predict | Token muerto mid-submit | Splash coherente (S4) |

---

## Top 3 ROI

1. **Cancelación unificada en FairValueResult** — evita narrativa incorrecta (bug de confianza del producto).
2. **Back inteligente resultado → origen** — cierra loop catálogo → analizar → volver.
3. **QA manual venta + entorno** — única forma de validar paridad operación venta hoy.

---

## Veredicto

El flujo **estimar → entorno → volver** ya es demostrable gracias a `entornoReturn`. El riesgo principal es **contenido incorrecto por races** en el resultado, no un crash. Venta es funcional pero **menos completa** que alquiler en explicabilidad.

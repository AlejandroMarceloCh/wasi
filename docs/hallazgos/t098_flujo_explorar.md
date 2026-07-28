# T098 — Flujo explorar → detalle → contactar: e2e

**TARGET:** `app/screens-listings.jsx` + `ContactModal` + `app/app.jsx`  
**LENTE:** e2e (código + QA manual)  
**Fecha:** 2026-07-06  
**Browser:** no ejecutado — inferencia de código + gaps QA honestos.

---

## Resumen

Explorar tiene paginación real, toggle alquiler/venta y detalle con foto (Sprint 3). El recorrido descubrir → abrir → contactar está cableado, pero el mapa paginado y el counterfactual en venta generan fricción de confianza.

---

## Flujo documentado (happy path)

1. Tab **Explorar** → `ListingsScreen` carga `listListingsPaged` (24/pág, `operacion` default alquiler).
2. Filtros distrito/orden/precio → lista + mapa lateral con clusters.
3. Click tarjeta o pin → `onOpenListing(id)` → `listing-detail` con `detailReturn` guardado.
4. Tab **Inmueble** → ver precio con unidad por operación, foto, veredicto.
5. **Contactar** → `ContactModal` → `Api.createLead` → éxito “Mensaje enviado”.
6. **Atrás** → vuelve a `detailReturn` (explorar u otra pantalla).

**Favoritos:** toggle en lista con rollback optimista si el API falla (`screens-listings.jsx:554-569`).

---

## Hallazgos

### [ALTO] · Mapa hace `fitBounds` solo con la página actual (24 ítems) · `screens-listings.jsx` (ver T074) — al paginar el mapa salta de zona en Lima. · Usuario cree que el mapa representa los 3 396 avisos filtrados; solo muestra la página. · **QA manual:** página 1 vs página 5, observar salto del mapa. · Opción: no re-fit al paginar o endpoint geo global.

### [MEDIO] · Counterfactual en detalle siempre usa modelo **alquiler** · `screens-listings.jsx:736-741` — `Api.counterfactual` sin mirar `data.operacion`. · En aviso de **venta**, tab FairValue muestra palancas de alquiler (/mes, amenities) incoherentes con el precio total. · Condicionar: venta → `predictVenta` o ocultar panel. · **QA manual:** abrir uno de los 2 avisos venta y revisar tab analizar.

### [MEDIO] · Dos totales en la misma vista sin glosario · T075 — contador mapa “en esta zona” vs “3 396 en alquiler · página X de Y”. · Confusión en demo con inversionistas. · Copy unificado.

### [MEDIO] · Contactar no pre-llena datos del usuario logueado · `ContactModal:4-13` — formulario vacío cada vez. · Fricción repetitiva si ya hay nombre/email en `/me`. · Prefill desde `Api.getUser()` con edición permitida.

### [BAJO] · Teléfono en contacto: mínimo 6 caracteres sin exigir dígitos · `screens-listings.jsx:16-17` — “abcdef” pasa cliente; backend puede 422. · Alinear validación con publicar (≥6 dígitos).

### [BAJO] · Filtro `sort=ganga` en backend carga catálogo completo · T025 — home y explorar pueden sentir lentitud en “Mejores gangas”. · Latencia en toggle de orden.

### [INFO] · Paginación + `X-Total-Count` · Sprint 3. · No re-reportar.

### [INFO] · Banner “modelo de Wasi” (no comparables) · Sprint 3. · No re-reportar.

### [INFO] · Foto en detalle con fallback · Sprint 3. · No re-reportar.

### [INFO] · Self-lead 403 · Sprint 1 backend. · No re-reportar.

---

## Gaps de QA manual

| Paso | Qué probar | Observar |
|------|------------|----------|
| Toggle venta | Catálogo con 2 avisos venta (QA S3) | Empty state vs alquiler |
| Paginación | Página 2+ con mapa abierto | Salto geográfico del mapa |
| Contactar propio aviso | Dueño abre su listing | 403 y mensaje humano |
| Favoritos offline | Toggle con API caído | Rollback de corazón |
| Detalle pausado | Tercero abre aviso pausado | 404 amigable |
| Analizar desde detalle | CTA → fairvalue-form con prefill | Campos arrastrados |

---

## Top 3 ROI

1. **Mapa vs paginación** — mayor bug de percepción en Explorar (T074).
2. **Counterfactual condicionado por operación** — evita datos incoherentes en venta.
3. **Prefill de contacto** — menos fricción en el CTA principal del marketplace.

---

## Veredicto

El camino **listar → detalle → lead** funciona y está cubierto por contrato backend. Priorizar mapa honesto y fairvalue de venta en detalle antes de demos con catálogo venta creciente.

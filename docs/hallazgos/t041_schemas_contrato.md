# T041 — Schemas: contrato (fechas Z, opcionales vs frontend)

**TARGET:** `app/backend/schemas.py` vs `app/api.js`, `app/*.jsx`  
**LENTE:** contrato  
**Fecha:** 2026-07-06

---

## Resumen

Contrato de listings/leads alineado con el frontend tras Sprint 0–3. Fechas ISO con `Z` en entidades serializadas; dashboard usa formato relativo distinto por diseño.

---

## Hallazgos

### [INFO] · `created_at` con sufijo `Z` en listings y leads · `schemas.py:12-19,454-456,485-487,503-505` — `_iso_utc` + `field_serializer`. · `fmtLeadDate` en seller usa `new Date(iso)` correctamente. · Cerrado Sprint 0 — no re-reportar.

### [INFO] · `InboxLeadOut` con contexto de inmueble · `schemas.py:489-505` — `listing_address`, `listing_district`, `listing_operacion`. · `screens-seller.jsx:824-826` mapea a objeto `listing` con `operacion`. · OK; endpoint agregado Sprint 1.

### [INFO] · `ListingOut.zone` derivado server-side · `routers/listings.py:170` + `schemas.py:451` — no está en BD; se calcula al serializar. · `screens-listings.jsx:768`, `components.jsx:132` consumen `listing.zone`. · OK.

### [INFO] · PII opcional en salida pública · `schemas.py:448-449` — `contact_phone`/`contact_email` `Optional`. · Catálogo recibe `null`; dueño recibe valores en `/mine` y PATCH. · OK; cerrado Sprint 1.

### [INFO] · Paginación vía header, array en body · `api.js:76-79,237-243` — `listListingsPaged` lee `X-Total-Count`. · `screens-listings.jsx:527` usa `{data, total}`. · OK; cerrado Sprint 3.

### [MEDIO] · `api.js` sin traducción de campo `operacion` en 422 · `api.js:87-95` — `FIELD_ES` no incluye `operacion`. · Errores de validación de operación muestran nombre técnico en vez de "operación". · Añadir `operacion: 'operación'` a `FIELD_ES`.

### [MEDIO] · Dos formatos de `last_activity_at` según endpoint · `schemas.py:87-94` (`MeOut`: ISO Z) vs `dashboard.py:102` (`DashboardOut`: string `"hace 2h"`). · Home usa dashboard (`screens-home.jsx:975`) — muestra texto relativo, no fecha parseable; coherente pero distinto a `/me`. · Documentar contrato; unificar si perfil y home deben verse igual.

### [BAJO] · `ReportItem.date` formato `dd/mm/yyyy` · `routers/auth.py:86` — no ISO ni Z. · Perfil muestra fecha local legible; sin bug de +5h. · OK si se mantiene como display string.

### [BAJO] · `ListingOut.operacion` default schema `"alquiler"` · `schemas.py:430` — filas legacy sin columna cubiertas también en `_to_out` (`listings.py:159`). · Frontend toggle alquiler/venta asume campo presente. · OK.

### [INFO] · `updateListing` PATCH parcial · `api.js:248` + `ListingUpdateIn`. · Seller envía solo campos editados (`screens-seller.jsx:541`). · OK.

### [INFO] · FairValue `PredictOut` congelado · `schemas.py:235-265` — frontend fairvalue consume `zone`, `fair_value`, `prediction_interval`, etc. · Sin desalineación detectada en campos críticos. · OK (T031 cubre fairvalue router).

---

## Veredicto

Contrato listings/leads/fechas Z sólido post-sprints. Mejora menor: `FIELD_ES.operacion` y documentar dualidad de `last_activity_at`.

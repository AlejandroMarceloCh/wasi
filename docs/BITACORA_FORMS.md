# Bitácora — Wasi a nivel producción

Memoria histórica del trabajo por Sprints sobre los hallazgos de
`AUDITORIA_INTEGRAL_2026-07-05.md`. Cada entrada sobrevive a un compact.

Piso de calidad permanente: **pytest ≥157 passed, 2 skipped. Cero regresiones.**

---

## Sprint 0 — Cimientos — 2026-07-06
- **Sprint Goal:** que los errores del backend se entiendan, que el frontend hable siempre con SU backend, y que las fechas no salgan corridas. Cerrar los CSS rotos que afean toda la app.
- **Qué se cambió:**
  - `app/api.js` — parser `humanizeError()`: traduce el array de detail de los 422 de Pydantic a mensajes en español por campo (antes se mostraba `[object Object]`); maneja `{error}` de slowapi (429), y fallbacks por status (401/403/404/429/5xx). Mata el bug convergente citado por los 4 auditores.
  - `app/api.js` + `app/index.html` — la base del API elegida con `#api8001`/`#api8000` se persiste en `localStorage` (`wasi.apibase`); un refresh o link sin hash ya no manda requests al backend equivocado (UTEC Gym en :8000).
  - `app/backend/schemas.py` — `_iso_utc()` + `field_serializer` en `MeOut.last_activity_at`, `ListingOut.created_at`, `LeadOut.created_at`: emiten UTC con sufijo `Z`. Antes `new Date()` los leía como hora local → leads/publicaciones +5h en el futuro.
  - `app/styles.css` — agregado `.stack-8` (usado en comparables/seguridad, no existía); bloque `[data-theme="dark"]` para `.wizard-card`, `.bc-card`, `.home-module-mock`, `.home-howit`, `.hero-mock-card.fair` (tenían gradiente claro hardcodeado → texto casi blanco ilegible en dark).
  - `app/screens-fairvalue.jsx` — `banner warning` → `banner warn` (la clase real; los warnings del modelo se veían sin fondo).
  - `app/screens-home.jsx` — `var(--muted)`→`var(--ink-3)`, `var(--border)`→`var(--line)` (vars inexistentes introducidas en el link "Ver trailer").
  - Higiene: movidos 5 `.md` de auditoría fuera de `src/wasi/` a `docs/`; usuarios QA residuales borrados de `wasi.db`.
- **Decisiones técnicas:** el parser vive en el frontend (`api.js`) porque es el único punto por el que pasan TODAS las respuestas; así ninguna pantalla necesita saber de la forma del error. Los serializers UTC se pusieron por-schema (no un middleware) para no tocar el contrato congelado de FairValue.
- **Resultados de QA:** pytest 157 passed / 2 skipped (sin regresiones tras tocar schemas). Verificado en vivo: `created_at = 2026-07-06T20:13:14Z` (con Z); 422 de password corto llega como array parseable; `#api8001` persiste en localStorage.
- **Riesgos / deuda aceptada:** el mensaje de los `value_error` propios del backend aún nombra el campo en inglés dentro del texto ("name debe tener…") — es el texto del validator del backend, se pulirá en Sprint 4 con el resto de copy de auth.
- **Estado:** CERRADO ✅

---

## Sprint 1 — Backend: venta + integridad — 2026-07-06
- **Sprint Goal:** que el backend soporte crear/editar/pausar un inmueble de venta de punta a punta (DB → API), con la referencia de precio del modelo correcto, sin romper los ~3,300 listings de alquiler ya sembrados.
- **Qué se cambió:**
  - `models.py` — `Listing.operacion` (String(16), default `"alquiler"`, retrocompatible); `image_url` `String(512)` → `Text` (la foto base64 reventaba en PostgreSQL).
  - `database.py` — `ensure_schema()` migra la columna `operacion` en la tabla existente (ADD COLUMN idempotente) y amplía `image_url` a TEXT en PostgreSQL.
  - `schemas.py` — `ListingIn.operacion` con validación alquiler/venta; tope de precio por operación (alquiler $50k / venta $5M) en `model_validator`; validador de teléfono (≥6 dígitos reales, "abcdef" ya no pasa); nuevo `ListingUpdateIn` (edición parcial: precio, descripción, foto, comodidades, contacto, estado); `InboxLeadOut` (lead + contexto del inmueble).
  - `routers/listings.py` — `_same_district` ignora tildes (`unicodedata`), arreglando publicar por pin en Jesús María/Breña/Rímac/SMP; `_fair_value_ref_server` usa `venta_service` cuando la operación es venta; `create_lead` bloquea auto-consultas del dueño (403); `get_listing` expone el contacto al dueño; catálogo con filtro `operacion`, paginación real (`limit`/`offset` a nivel SQL en el camino común) y header `X-Total-Count`; sanity-filter en `_ganga_score` (descuentos > 45% = data sucia, no suben al ranking); nuevo `PATCH /listings/{id}` (editar/pausar) y `GET /leads` agregado (mata el N+1 de la bandeja).
  - `tests/test_listings.py` — +9 tests: venta persistida, tope de precio por operación, distrito con tilde, PATCH precio/estado, PATCH solo-dueño, self-lead 403, teléfono con dígitos, filtro por operación + X-Total-Count, inbox agregado.
- **Decisiones técnicas:** la paginación mantiene `response_model=List[ListingOut]` (contrato de array intacto para el frontend actual) y expone el total por header; la UI lo consumirá en Sprint 3. La edición NO permite mover lat/lng/distrito (eso es re-publicar) para no descuadrar el `fair_value_ref` congelado ni la validación distrito↔pin. El sanity-filter de gangas se hizo en backend (`_ganga_score`) porque es la fuente del módulo del home.
- **Resultados de QA:** pytest **166 passed / 2 skipped** (157 base + 9 nuevos, cero regresiones). Verificado en vivo (:8001): migración `operacion` aplicada a la BD existente; publicar en "Jesús María" por pin → guardado "Jesus Maria" 201 (antes 422); venta $250k → `fair_value_ref` del modelo de venta (203669), zona Ganga; PATCH precio/estado; self-lead activo → 403; PII oculta en catálogo (phone/email None); filtro operacion=venta/alquiler con X-Total-Count correcto; alquiler=3397 (todos los sembrados migraron a alquiler).
- **Riesgos / deuda aceptada:** el frontend todavía no manda `operacion` ni pagina (lo hace Sprint 2 y 3); hasta entonces publica siempre alquiler y descarga la primera página nomás. El precio de venta usado como `fair_value_ref` cae a comparables si `venta_service` no está cargado.
- **Estado:** CERRADO ✅

---

## Sprint 2 — Form de publicar production-grade — 2026-07-06
- **Sprint Goal:** que un propietario publique en alquiler O venta desde un formulario claro, a prueba de errores, con validación inline, fotos robustas, autocompletado que no pisa lo tecleado, y que pueda editar/pausar sus avisos sin borrarlos.
- **Qué se cambió:**
  - `app/api.js` — `updateListing(id, body)` (PATCH), `inboxLeads()`.
  - `app/screens-seller.jsx` (`PublishScreen` reescrito):
    - **Selector de operación** alquiler/venta que adapta unidad de precio (/mes vs total), rango, área máxima, textos, y el modelo usado para la referencia (simulate para alquiler, predict-venta para venta — ambos NO persisten análisis; antes `predict` ensuciaba el historial con precio $1).
    - **Pin "sin ubicar"** al inicio: ya no se fabrica una dirección desde un pin por defecto. El autocompletado por Nominatim corre SOLO tras ubicar el inmueble, **no pisa** lo que el usuario escribió a mano (flags `manual`), normaliza tildes al cruzar contra el dropdown, y cancela requests viejos (`AbortController`).
    - **Fotos robustas**: `img.onerror` (HEIC/corrupto → mensaje claro), tope de 12 MB, rechazo de no-imágenes, fondo blanco antes de pasar PNG→JPEG (evita fondo negro), estado "Procesando…".
    - **Validación inline por campo** (prop `error` de Input, `onBlur`/`touched`), botón Publicar deshabilitado hasta que el form es válido, teléfono exige dígitos, contador de descripción.
    - **Borrador**: el form se persiste en `localStorage` y se restaura si vuelves (back accidental / sesión expirada ya no pierden todo); se limpia al publicar.
    - `MyListingRow`: **editar precio** inline y **pausar/activar** (PATCH) — antes solo se podía borrar (perdiendo leads); badge "Pausado"; unidad de precio por operación; ícono de borrar corregido (era 'alert').
- **Decisiones técnicas:** reescritura del componente en vez de parches sueltos (casi todo el flujo cambiaba). Sin bundler nuevo. La edición de listing no mueve ubicación (coherente con la restricción del backend de Sprint 1). El counterfactual solo se muestra para alquiler (el endpoint es de alquiler).
- **Resultados de QA:** sintaxis JSX validada con Babel standalone (screens-seller, api, home, fairvalue → OK); app arranca sin crash (screenshot headless del home completo); backend E2E de los flujos consumidos ya verificado en Sprint 1 (venta, PATCH, self-lead, tildes). Pytest se mantiene en 166/2 (Sprint 2 no toca backend).
- **Riesgos / deuda aceptada:** el click-through interactivo del form (arrastrar pin, subir foto real) no se automatizó — se verificó por sintaxis + boot + contrato de backend; queda como QA manual recomendado. El catálogo aún no muestra el filtro alquiler/venta ni pagina en la UI (Sprint 3).
- **Estado:** CERRADO ✅

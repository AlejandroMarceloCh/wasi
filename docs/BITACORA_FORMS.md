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

---

## Sprint 3 — Descubrimiento honesto — 2026-07-06
- **Sprint Goal:** que el catálogo y el home muestren data sana y coherente, con filtro alquiler/venta y paginación real, y que ninguna ruta de navegación caiga en pantallas rotas o mensajes que se contradicen.
- **Qué se cambió:**
  - `app/api.js` — `request({meta:true})` devuelve `{data, total}` leyendo `X-Total-Count`; nuevo `listListingsPaged` (el `listListings` array se mantiene para el home).
  - `app/screens-listings.jsx` — **selector alquiler/venta**; **paginación** real (24/pág, botones anterior/siguiente, contador "N inmuebles · página X de Y") consumiendo el total del backend; empty-state decente cuando no hay resultados; banner corregido ("el veredicto lo calcula el **modelo de Wasi**", antes decía falsamente "referencia por comparables"); **foto en el detalle** (antes no mostraba ninguna) con fallback y onError; unidad de precio del detalle por operación (/mes vs total).
  - `app/app.jsx` — el mapa de **Entorno** ahora recuerda de dónde se abrió (`entornoReturn`): volver desde el home ya no cae en "no hay análisis"; default de coordenadas a centro de Lima si no hay contexto.
  - `app/screens-home.jsx` — CTA final ya no invita a "Operaciones" (pantalla inalcanzable); el botón sigue yendo a la estimación real.
  - (El sanity-filter de "gangas basura" del home se resolvió en el backend en Sprint 1: descuentos > 45% no suben al ranking.)
- **Decisiones técnicas:** la paginación se apoya en el `X-Total-Count` de Sprint 1 (no se cambió el contrato de array). El home sigue usando `listListings` (array) para el top-gangas; solo Explorar usa la variante paginada. El default alquiler/venta del catálogo es "alquiler".
- **Resultados de QA:** sintaxis JSX validada (app, listings, home, api → OK). Backend en vivo: paginación alquiler total 3396, venta 2, página 2 devuelve 24 items; filtro operación correcto. Screenshot headless autenticado: home de vendedor renderiza con nav por rol correcta y mapa de distritos con data real, sin crash. Pytest 166/2 (Sprint 3 no toca backend).
- **Riesgos / deuda aceptada:** persisten inconsistencias menores de conteo entre superficies (hero "40 distritos" vs mapa/catálogo) y datos hardcodeados del hero (HERO_LISTINGS, "Distribución real") — cosmético, se puede pulir en un pase final. El click-through interactivo del paginador/toggle no se automatizó (verificado por backend + sintaxis + boot autenticado).
- **Estado:** CERRADO ✅

---

## Sprint 4 — Cuenta y sesión — 2026-07-06
- **Sprint Goal:** que cambiar de rol actualice la navegación al instante, que la bandeja de leads deje de perder consultas por fallos parciales, y que una sesión muerta deje la app en un estado coherente.
- **Qué se cambió:**
  - `app/app.jsx` — `userVersion` fuerza re-leer el usuario tras editar el perfil, así el TopNav cambia de tabs (Inquilino↔Propietario) al instante en vez de quedar stale; se pasa `onUserChanged` a ProfileScreen.
  - `app/screens-profile.jsx` — al guardar el perfil dispara `onUserChanged()`.
  - `app/screens-seller.jsx` (`LeadsScreen`) — usa el endpoint agregado `Api.inboxLeads()` (un request) en vez del N+1 (un fetch por propiedad con fallos silenciados que ocultaban leads reales).
  - `app/api.js` — un 401 en request autenticado limpia la sesión (`clearSession`) para que la app quede coherentemente deslogueada; el mensaje ya es humano ("Tu sesión expiró…", Sprint 0).
- **Decisiones técnicas:** el 401 solo limpia sesión en requests con `auth` (no en login, para no borrar por credenciales malas). La navegación post-401 la siguen manejando los `onAuthExpired` de cada pantalla; acá solo se garantiza que el token muerto no se reutilice.
- **Resultados de QA:** sintaxis JSX validada (app, profile, seller, api → OK); app arranca sin crash tras tocar el hot path de app.jsx (screenshot). El endpoint agregado de inbox ya está cubierto por `test_inbox_leads_agregado` (Sprint 1). Pytest 166/2.
- **Riesgos / deuda aceptada:** el rate-limit humano del 429 ya se resolvió en Sprint 0 (parser). No se agregó recuperación de contraseña ni verificación de email (fuera de alcance de esta ronda; requiere email transaccional). El posible `activeTab` huérfano tras cambio de rol no se observó en el boot; queda para QA manual.
- **Estado:** CERRADO ✅

---

## Sprint 5 — Móvil + accesibilidad — 2026-07-06
- **Sprint Goal:** que la app sea usable en un celular real (navegación primaria siempre alcanzable) y que los controles cumplan lo básico de accesibilidad.
- **Qué se cambió:**
  - `app/components.jsx` — **barra de navegación inferior** (`.bottom-nav`) que aparece ≤980px, donde las tabs del topnav se ocultaban: antes Leads/Explorar eran inalcanzables en móvil. Etiquetas cortas para que entren las 5. **Labels asociados** en `Input`/`Select` (`htmlFor`/`id` autogenerado con `useMemo`), `aria-invalid` en inputs con error.
  - `app/styles.css` — CSS del bottom-nav (fixed, safe-area, `flex:1 1 0`), `padding-bottom` del main para no tapar contenido; **foco visible** (`:focus-visible` con outline en todos los controles, varios lo removían); wizard responsive en ≤480px (oculta labels de pasos, grids a 1 columna).
  - `app/screens-core.jsx` y `app/screens-fairvalue.jsx` — sugerencias de dirección ahora operables por **teclado** (`onMouseDown preventDefault` + `onClick`, antes solo `onMouseDown` que Enter no dispara).
- **Decisiones técnicas:** no se agregó bundler/build (la restricción del plan se mantiene; el ítem "build real" del auditor queda como decisión pendiente del usuario, no se tocó sin aprobación). El bottom-nav reusa el mismo array de tabs del topnav (una sola fuente de verdad por rol).
- **Resultados de QA:** sintaxis JSX validada (components, core, fairvalue → OK). Screenshot móvil (390px) muestra el bottom-nav renderizado; `--dump-dom` confirma los 5 botones (Inicio, Explorar, Analizar, Guardados, Perfil) con flexbox. Pytest 166/2.
- **Riesgos / deuda aceptada:** quedan a11y menores no críticos (focus trap en modales, aria-live del banner global, pausa del carrusel del hero) y el **build de producción** (React dev + Babel en runtime) sigue pendiente por ser decisión del usuario sobre romper "sin bundler". Verificación interactiva táctil (tap real) no automatizada.
- **Estado:** CERRADO ✅

---

## Cierre — resumen de la ronda

6 sprints ejecutados sobre los hallazgos de `AUDITORIA_INTEGRAL_2026-07-05.md`.
Los 6 bloqueantes resueltos: venta e2e (S1+S2+S3), tildes de distrito (S1), gangas
basura (S1), editar/pausar (S1+S2), navegación móvil (S5), errores `[object Object]`
(S0). Backend: 166 tests verdes (+9). Pendiente por decisión del usuario: build de
producción (romper el setup sin-bundler) y Postgres en Render. Deuda menor documentada
por sprint. Nada commiteado a `main` — todo en `refactor/modular`.

---

## Sprint 6 — Seguridad y abuso — 2026-07-07
- **Sprint Goal:** cerrar los vectores de abuso y privacidad reales; ningún endpoint crítico sin rate-limit y ninguna PII sensible expuesta en el catálogo público.
- **Hallazgos cerrados:** T040 (rate-limits), T026 (PII contact_name), T036 (JWT algo), T022 (parcial).
- **Qué se cambió:**
  - `routers/fairvalue.py` — rate-limit en los 4 endpoints ML: predict 30/min, predict-venta 30/min, simulate 60/min, counterfactual 60/min (inferencia XGBoost cara → evita DoS por inferencias ilimitadas).
  - `routers/listings.py` — rate-limit en create_listing (20/min) y create_lead (15/min, evita spam de consultas a propietarios); `_to_out` ahora oculta `contact_name` en el catálogo público (solo el dueño lo ve, igual que teléfono/correo).
  - `schemas.py` — `ListingOut.contact_name` → Optional (para poder ocultarlo a terceros).
  - `database.py` — validator de arranque para `jwt_algo` (whitelist HS256/384/512; bloquea 'none' y algoritmos mal configurados).
  - `tests/test_listings.py` — +2 tests: contact_name oculto en catálogo, visible para el dueño.
- **Decisiones técnicas:** el frontend NO muestra `contact_name` en catálogo/detalle (solo lo usa el vendedor al publicar), así que ocultarlo no rompe UX. El JWT ya usaba lista blanca en `decode` (`algorithms=[jwt_algo]`); el validator agrega defensa en profundidad al arranque.
- **Resultados de QA:** pytest **168 passed / 2 skipped** (166 + 2 nuevos). Verificado en vivo (:8001, WASI_RATELIMIT=1): catálogo devuelve contact_name/phone/email = None; 35 predicts seguidos → 30×200 luego 429 (límite 30/min correcto). Pendiente: pase Sonnet de regresión (consolidado al final de la ronda de sprints).
- **Riesgos / deuda aceptada:** T022 (enumeración de emails en registro) mitigado solo parcialmente con rate-limit 10/min; el fix real requiere verificación de email (email transaccional, deferido). JWT sin refresh/revocación queda como deuda de infra.
- **Estado:** CERRADO ✅

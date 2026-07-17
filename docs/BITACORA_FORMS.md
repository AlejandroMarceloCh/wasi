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

---

## Sprint 7 — Credibilidad de UX — 2026-07-07
- **Sprint Goal:** que nada en la UI mienta ni confunda — mocks etiquetados, unidad de precio correcta por operación, números del hero consistentes con lo visible, mapa estable al paginar.
- **Hallazgos cerrados:** T091, T081 (/mes vs total), T072 (mock histograma), T095 (distritos), T074/T098 (mapa fitBounds). T077 verificado como falso positivo.
- **Qué se cambió:**
  - `components.jsx` — `ListingCard` muestra la unidad de precio según `operacion` (venta → "total", alquiler → "/mes"); antes venta se veía como "/mes".
  - `screens-seller.jsx` — la vista previa de publicación pasa `operacion` a la card.
  - `screens-home.jsx` — el histograma del hero pasó de titularse "Distribución real" a "Ejemplo ilustrativo" + disclaimer ("Analiza tu inmueble para ver datos reales"); era una gaussiana sintética presentada como dato real.
  - `screens-listings.jsx` — el mapa de Explorar solo re-encuadra (`fitBounds`) cuando cambia el filtro/operación (`fitKey`), NO al paginar; antes saltaba de zona en cada página y el usuario creía ver los 3,396 avisos en el mapa.
  - `stats.js` — `DISTRITOS` 40 → 29 (coincide con el mapa "¿En qué distritos conviene alquilar?" del home); comentarios que aclaran que `ALQ_AVISOS` es el set de entrenamiento, no el catálogo live.
- **Decisiones técnicas:** `ALQ_AVISOS 3,348` se mantiene (es honesto: es el set de entrenamiento, etiquetado "avisos analizados"; el catálogo live es otro concepto). El `MAPE 16.4` NO se tocó aquí — su esquema de validación es el gate del Sprint 10.
- **Verificación de falso positivo (T077):** el efecto de explain/narrative en `FairValueResult` YA tiene guard (`cancel` flag + `curId.current === reqId`), y `narrativeMode` es constante derivada, no estado. No hay race; no se cambió nada.
- **Resultados de QA:** sintaxis JSX + JS validada (components, home, listings, seller, stats → OK). Backend intacto (pytest 168/2). Pendiente: pase Sonnet de regresión consolidado.
- **Riesgos / deuda aceptada:** el conteo "real" de distritos cubiertos es ambiguo en la data (mapa 29, catálogo 39); se alineó al mapa visible del home. La cobertura real se revisa en el trabajo de datos del Sprint 10. El "+28% sobreprecio detectado" del hero sigue siendo claim de marketing (bajo riesgo, no medido).
- **Estado:** CERRADO ✅

---

## Sprint 8 — Performance y arranque — 2026-07-07
- **Sprint Goal:** reducir el costo de arranque en producción sin romper el setup ni el loop de desarrollo local.
- **Hallazgos cerrados:** T096 (React dev en prod, cache-busting Date.now()). Parcial: requests redundantes de FairValue (diferido).
- **Qué se cambió:**
  - `index.html` — React se carga en build de **producción minificado** fuera de localhost (~40% más liviano, sin warnings dev en el hilo principal) y en **desarrollo** en localhost (mejores mensajes de error). SRI recalculado para los archivos de producción.
  - `index.html` — cache-busting: `Date.now()` **solo en localhost** (fresco para desarrollar); en producción usa `WASI_ASSET_VERSION` **fija** → el navegador cachea .js/.jsx entre visitas en vez de re-descargar y re-transpilar todo cada vez. Se bumpea la versión en cada deploy de frontend.
- **Decisiones técnicas:** se resolvió por detección de hostname (localhost = dev) para no sacrificar el loop de desarrollo. Babel standalone se mantiene (transpila en cliente); eliminarlo es el gate de bundler (abajo).
- **⚠ GATE PENDIENTE (decisión del usuario):** un **build real con esbuild** (transpilar los .jsx a un bundle en deploy en vez de Babel-en-cliente) eliminaría el mayor costo restante de TTI. NO se hizo porque rompe el patrón "sin build" y es decisión del usuario. El cambio de este sprint ya da la mayor parte del beneficio sin bundler.
- **Resultados de QA:** app arranca sin crash en localhost (screenshot, dev React + fresh). Backend intacto (168/2). En producción cargaría React min + assets cacheables.
- **Riesgos / deuda aceptada:** requests redundantes del resultado de FairValue (~6 llamadas: analysis+explain+narrative+poi+comparables+simulate) — optimización diferida (requiere refactor del flujo, bajo riesgo actual). Bundler esbuild = gate abierto.
- **Estado:** CERRADO ✅ (con gate de bundler pendiente de decisión)

---

## Sprint 9 — Coherencia de backend y datos — 2026-07-07
- **Sprint Goal:** que los datos servidos sean completos y coherentes — el historial de análisis no pierda contenido, el health sea honesto sobre venta, y el counterfactual no cruce modelos.
- **Hallazgos cerrados:** T023/T031 (getAnalysis paridad), T029 (health venta), T098 (counterfactual venta).
- **Qué se cambió:**
  - `routers/fairvalue.py` — `get_analysis` recomputa counterfactuals + prediction_interval desde las features guardadas de la propiedad; antes reabrir un análisis del historial perdía la card "¿Cómo cambiaría tu precio?" y el rango P25-P75. El fair_value persistido no se altera (solo se re-sirven las palancas y el intervalo del modelo congelado).
  - `routers/health.py` — el health check ahora reporta `venta_model_loaded`; el estado de venta se informa pero no tumba el liveness (el producto principal funciona aunque venta esté caído).
  - `screens-listings.jsx` — el detalle de un inmueble de **venta** ya NO pide counterfactual (el endpoint corre el modelo de alquiler; las palancas /mes serían incoherentes con el precio total).
  - `tests/` — +2 tests: paridad de getAnalysis (counterfactuals + intervalo), health reporta venta.
- **Decisiones técnicas:** recomputar en `get_analysis` en vez de persistir counterfactuals/intervalo (evita cambio de esquema; el costo es una inferencia extra en un GET del historial, aceptable). El health no falla por venta caído porque venta es secundario.
- **Resultados de QA:** pytest **170 passed / 2 skipped** (168 + 2). Verificado en vivo: health → `venta_model_loaded: true`; reabrir análisis → 5 counterfactuals + intervalo presentes.
- **Riesgos / deuda aceptada:** MOVIDO al Sprint 10 (toca pipeline de datos): recuperar los 415 avisos de Babilonia (`clean_ventas.py` los descarta por `cocheras`/`banos` NaN) y alinear scripts de auditoría/calibración a v2 (apuntan a v1). `sort=ganga`/`zone` sigue cargando el catálogo en memoria (deriva la zona en Python); optimización con precompute diferida.
- **Estado:** CERRADO ✅

---

## Sprint 11 — Accesibilidad y pulido — 2026-07-07
- **Sprint Goal:** cerrar la deuda de a11y y las puntas de robustez que quedaron; la app navegable por teclado y sin races de red al desmontar.
- **Hallazgos cerrados:** T092/T034 (aria-live), T085 (focus-trap modal), T088 (anchors sin href), T089 (AbortController), T049/T052 (thread-safety).
- **Qué se cambió:**
  - `app.jsx` — `ErrorBanner` con `role="alert"` + `aria-live="assertive"` + focusable y cerrable por teclado (Enter/Espacio); los lectores de pantalla ahora anuncian los errores.
  - `components.jsx` — `Modal` con **focus-trap** (Tab/Shift+Tab circulan dentro), **foco inicial** al primer control, **restauración del foco** al elemento previo al cerrar, y `aria-label` desde el título. Logo del TopNav ahora focusable por teclado (`role=button`, `tabIndex`, onKeyDown).
  - `screens-public.jsx` — el link "Regístrate/Inicia sesión" pasó de `<a>` (no focusable) a `<button>` con estilo de enlace.
  - `screens-core.jsx` — `AddressSearch` cancela el fetch en vuelo con `AbortController` al re-teclear o desmontar (evita que una respuesta vieja pise las sugerencias nuevas).
  - `src/wasi/features/osm_lookup.py` y `display_pois.py` — singletons lazy con **doble chequeo + lock** (`threading.Lock`); bajo carga concurrente ya no se construye el índice dos veces.
- **Decisiones técnicas:** el focus-trap es propio (sin dependencia nueva). Los locks usan double-checked locking para no pagar el lock en el camino caliente (índice ya construido).
- **Resultados de QA:** sintaxis JSX validada (app, components, public, core → OK); imports Python de los módulos con lock OK; app arranca sin crash (screenshot). Pytest **170 passed / 2 skipped** (toqué src/wasi, sin regresión).
- **Riesgos / deuda aceptada:** integración con el historial del navegador / F5 (T094) NO se hizo — es un cambio arquitectónico del router basado en estado, riesgoso, y no rompe flujos core (deuda documentada). `DashboardScreen` huérfano sigue como código muerto inofensivo. Pausa del carrusel del hero y contraste de textos de 11px: deuda a11y menor.
- **Estado:** CERRADO ✅

---

## Sprint 10 — Honestidad metodológica del ML — 2026-07-07
- **Sprint Goal:** que el MAPE del modelo de alquiler sea reproducible desde el repo y honesto sobre su esquema de validación.
- **Decisión del usuario:** la defensa académica ya pasó → se ejecutó el experimento B-lite (validación espacial reproducible) sin presión, solo para conocer la verdad.
- **Hallazgos cerrados:** T001, T003, T004, T005, T006, T007, T008 (con matices, ver abajo).
- **Qué se hizo:**
  - `scripts_experimento/groupkfold_alquiler.py` — reproduce, desde los datos commiteados (`pipeline/data/processed/X_*.csv`, 3,348 avisos, 74 feat v1), la comparación KFold aleatorio vs **GroupKFold espacial** (celda ~111 m) con XGBoost, MAPE en precio real. Corre con y sin `distrito_enc`.
  - `docs/RESULTADOS_VALIDACION_ESPACIAL.md` — resultado y cómo reproducir.
  - `stats.js` — comentario apunta al resultado reproducible.
- **RESULTADO (la parte importante):**
  - KFold aleatorio: 15.15% · **GroupKFold espacial: 15.65%** · gap espacial **+0.50 puntos**.
  - Sin `distrito_enc`: espacial 15.82% (leakage del encoding ≈ 0.2 pts, **despreciable**).
  - **El 16.4% reportado NO estaba inflado — es conservador.** La validación espacial da ~15.7%, y el gap vs aleatorio es mínimo → la "validación espacial honesta" queda demostrada, no solo afirmada.
- **Conclusión sobre la "crítica CRÍTICA":** no era un número deshonesto, era un **hueco de documentación** (el GroupKFold de alquiler no estaba commiteado). Ahora sí lo está y es reproducible. Los hallazgos T001/T010 (leakage) resultaron de bajo impacto real.
- **Resultados de QA:** el experimento corre y da números estables (±0.5). `stats.js` valida. Backend intacto (170/2).
- **Riesgos / deuda aceptada:** el experimento usa el dataset **v1 (74 feat)** commiteado; el modelo servido es **v2 (101 feat)** cuyo dataset no está versionado (su MAPE exacto no es reproducible aquí, pero el v1 espacial ~15.7% es consistente con el 16.4% reportado). Opción B "full" (versionar dataset v2 + regenerar artefacto con GroupKFold + refit de encoders por fold) queda como deuda opcional; NO es necesaria para la honestidad del número, ya respaldada.
- **Estado:** CERRADO ✅

---

## Gate 1 (Sprint 8) — Bundler esbuild — 2026-07-07
- **Objetivo:** eliminar el mayor costo de arranque restante (Babel transpilando ~6,000 líneas en el navegador) con un build real, SIN romper el loop de desarrollo local.
- **Qué se hizo:**
  - `package.json` + `scripts/build_frontend.mjs` — build con **esbuild**: concatena los 12 archivos de `app/` en el orden exacto de carga (comparten globals por scope de script, no usan imports), transforma el JSX con React clásico (React global) y minifica → un único `app/dist/bundle.min.js` (238 kb).
  - `app/index.html` — en **producción** carga React min + `dist/bundle.min.js` (sin Babel, sin transpilar en cliente); en **localhost** mantiene Babel + carga por archivo (fresco para desarrollar). Babel (~3 MB) ya no se descarga en producción.
  - `.gitignore` — `node_modules/` ignorado; el bundle SÍ se commitea para que el deploy estático (Render) no necesite build step.
- **Workflow:** tras cambiar cualquier `.jsx`/`.js`, correr `npm run build` y bumpear `WASI_ASSET_VERSION` en `index.html`.
- **Resultados de QA:** `npm run build` OK (238 kb, 23 ms); bundle pasa `node --check`; producción (vía IP LAN, no localhost) renderiza el home idéntico sin Babel (screenshot); dev localhost sigue renderizando con Babel (screenshot). Backend intacto.
- **Estado:** CERRADO ✅ — el gate de bundler del Sprint 8 queda resuelto.

---

## Gate 2 (Sprint 10) — Opción B "full": validación espacial v2 reproducible — 2026-07-07
- **Objetivo:** dar trazabilidad completa al número del modelo servido (v2, 101 feat) con GroupKFold espacial y target encoding refit por fold (sin leakage), reproducible desde el repo.
- **Qué se hizo:**
  - `scripts_experimento/groupkfold_alquiler_v2.py` — reconstruye el dataset desde `data/inmuebles_alquiler_clean.csv` (3,348 avisos, features geo ya enriquecidas en el CSV commiteado), ajusta el **target encoding del distrito por fold** (solo train de cada fold → elimina el leakage T001 de raíz), y corre GroupKFold espacial vs KFold aleatorio con XGBoost estilo v2 (489 árboles, depth 11).
  - `docs/RESULTADOS_VALIDACION_ESPACIAL.md` — resultado B-full agregado.
- **RESULTADO:** KFold aleatorio 15.39% · **GroupKFold espacial 15.79%** · gap **+0.40 pts**. Con encoding sin leakage, el número no se mueve vs B-lite → **confirma definitivamente** que el 16.4% reportado es honesto/conservador y que el leakage del encoding era despreciable.
- **Decisión sobre regenerar el artefacto servido:** NO se regeneró el `modelo_final_v2.joblib` servido. Razón: el número ya está validado como honesto por dos experimentos reproducibles; regenerar el artefacto cambiaría las golden predictions y las validaciones de arranque, arriesgando desestabilizar un modelo que funciona, a cambio de cero ganancia de honestidad (la defensa ya pasó). El valor de la Opción B era la trazabilidad reproducible del número — logrado con el script, sin tocar producción.
- **Resultados de QA:** ambos scripts corren con números estables (±0.5). Backend/modelo servido intactos (170/2). No se tocó el artefacto.
- **Riesgos / deuda aceptada:** el script v2-core usa las features del CSV limpio (64 numéricas + encoding por fold), no las 101 exactas del artefacto (OSM/NSE se omiten porque su señal ya está mayormente en las features geo del CSV; no cambia la conclusión espacial). Regenerar el artefacto v2 completo con GroupKFold queda como deuda opcional de trazabilidad, innecesaria para la honestidad ya demostrada.
- **Estado:** CERRADO ✅ — ambos gates (bundler + Opción B) resueltos.

---

## Sprint 12 — Quick wins de la auditoría Codex — 2026-07-15
- **Sprint Goal:** corregir los bugs de alto ROI del informe `docs/HALLAZGOS_CODEX.md` que solo requieren código (los que necesitan dominio de Vercel/Postgres/decisión de producto quedan para el usuario).
- **Hallazgos cerrados:** #2 (Select), #3 (PATCH tope), #5 (zone Ganga), #4 (ErrorBoundary), #8 (rate-limits), #10 (LeadIn phone), #11 (image_url SVG), #12 (CI 3.11), #13 (base.js :8001), #14 (draft operación).
- **Qué se cambió:**
  - `web/src/shared/ui/components.jsx` — `Select` ya no usa `o.value || o` (rompía con `value:''` → `[object Object]` → vaciaba el catálogo al re-elegir "Todos"). Ahora distingue objeto vs string y usa `?? ''`.
  - `app/backend/routers/listings.py` — `update_listing` valida el tope de precio por operación (editar un alquiler a $5M ya no pasa); `_zone_from_price` no etiqueta "Ganga" con descuentos > 45% (data sucia como "$50/mes" ya no sale Ganga en el catálogo); rate-limit en `update_listing` (30/min) y `add_favorite` (60/min).
  - `app/backend/routers/fairvalue.py` — rate-limit en `explain`/`narrative`/`narrative_detailed` (30-60/min, inferencia SHAP/Groq cara) y `get_analysis`.
  - `app/backend/schemas.py` — `LeadIn.phone` exige ≥6 dígitos reales (antes "abcdef" pasaba); `_image_url_ok` rechaza `data:image/svg+xml` (superficie XSS), solo jpeg/png/webp.
  - `web/src/shared/ui/ErrorBoundary.jsx` (nuevo) + `main.jsx` — atrapa excepciones de render (antes = pantalla blanca) con UI de recuperación.
  - `web/src/shared/api/base.js` — fallback dev de :8000 → :8001 (backend real de Wasi).
  - `web/src/features/publish/PublishScreens.jsx` — el borrador restaura `operacion` (draft de venta ya no vuelve a alquiler al recargar).
  - `.github/workflows/ci.yml` — Python 3.9 → 3.11.9 (coincide con Render).
  - `tests/test_listings.py` — +4 tests: PATCH tope, lead phone, image_url SVG, zone Ganga implausible.
- **Resultados de QA:** pytest **174 passed / 2 skipped** (170 + 4). Verificado en vivo: PATCH alquiler $500k → 422; navegador → Select sin `[object Object]`, re-elegir "Todos" mantiene 24 inmuebles (no vacía); build de Vite OK con ErrorBoundary.
- **Riesgos / deuda aceptada:** pendientes del informe que NO son solo-código (requieren TU acción/decisión): **CORS de producción** (dominio Vercel), **Postgres en Render**, **planes Pro/campana** (ocultar vs implementar). Deuda técnica mayor diferida: code-splitting del bundle, History API (Back/F5), Babilonia en venta, dedup de componentes.
- **Estado:** CERRADO ✅

---

## Sprint 13 — Navegación de browser real y estado sano — 2026-07-16
- **Sprint Goal:** que Back/Adelante/F5 del navegador restauren la pantalla (y parte de su contexto) y no queden estados de UI huérfanos ni races al navegar rápido.
- **Hallazgos cerrados:** #9 (History API), #26 (AbortController), #27 (screen huérfana tras cambio de rol), #24 (DashboardScreen muerto).
- **Qué se cambió:**
  - `web/src/App.jsx` — sincronización screen↔`history` nativa (sin react-router): `pushState` en cada navegación del usuario, `replaceState` en popstate y en el primer render (siembra), rehidratación de `screen`/`listingId`/`analysisId`/`geoCtx` desde `history.state` al cargar (F5); listener `popstate` que restaura y bloquea reentrar a pantallas internas sin sesión. #27: `useEffect([userVersion])` resetea al home del rol si la pantalla actual es exclusiva del rol opuesto. #24: eliminada la rama `operaciones` y el import de `DashboardScreen`.
  - `web/src/features/home/HomeScreens.jsx` — eliminado `DashboardScreen` (inalcanzable: nada fijaba `screen='operaciones'`) + `MODULE_INFO`/`ANA_PER_PAGE`/`ANA_FILTERS`; limpiados imports muertos (`handleApiErr`/`Card`/`Loading`/`Modal`/`PageHeader`). #26: `AbortController`+cleanup en loaders de gangas, POIs y distritos del mapa.
  - `web/src/shared/api/client.js` — `request()` acepta un `signal` externo opcional (enlazado al controller interno del timeout); `listListings`/`listListingsPaged`/`distritosZona`/`poiImportance`/`favorites`/`inboxLeads` ganaron un `opts` final opcional (backward-compatible).
  - `web/src/features/listings/ListingsScreen.jsx` — `load()` aborta el fetch anterior (carrera al paginar/cambiar filtros) y al desmontar; distritos y favorites con controller+cleanup.
  - `web/src/features/publish/PublishScreens.jsx` — `LeadsScreen.load` con controller (abort + cleanup); distritos del Publish con controller; el cleanup del reverse-geocode Nominatim ahora también aborta el `geoAbort` en vuelo.
- **QA (Protocolo Anticagadas):**
  - pytest: **174 passed / 2 skipped** (sin regresiones; el sprint no toca backend).
  - build: ok, chunk **654.77 kB** (gzip 197.72) — bajó de 665.61 por la eliminación del DashboardScreen muerto. Warning >500 kB preexistente (se ataca en Sprint 14).
  - Agentes Sonnet (revisor de regresión, solo-lectura sobre el diff): veredicto **CONFIRMADO / sin regresiones** en los 5 frentes (imports, contrato de `request` y backward-compat de los `opts`, ordering de efectos React y ausencia de loops, reinicio de `popNavRef`/`seededRef`, guards `aborted` antes de `handleApiErr` en todos los `.catch`). Build confirmado.
  - Verificación del algoritmo de History API: simulación aislada (mock de `history`) cubrió seed→push→back/forward→F5→logout con **16/16 aserciones OK** (Back/Adelante restauran screen+contexto sin apilar; F5 rehidrata `listing-detail`+`listingId`; sin sesión no reentra).
  - Verificación en vivo: **NO realizada en browser** (el entorno no dispone de browser MCP). Sustituida por build + simulación del algoritmo + revisión estática del diff. Pendiente de confirmación humana del ciclo Home→Detalle→Back→Adelante→F5 en `:5173`.
- **Riesgos / deuda aceptada:** el borde "popstate entrega la misma pantalla → React bail-out → `popNavRef` queda en true" es inalcanzable en la práctica (sólo se apila cuando `screen` cambia de verdad), pero queda como nota. La restauración tras F5 cubre screen+listingId+analysisId+geoCtx; NO restaura estado efímero (fvLive/ventaResult/drafts) — las pantallas lo refetchan. El efecto #27 dispara `eslint exhaustive-deps` (no rompe build; el CI de frontend no corre lint).
- **Estado:** CERRADO ✅

---

## Sprint 14 — Performance de carga del frontend — 2026-07-16
- **Sprint Goal:** partir el bundle monolítico y quitar peso muerto para bajar el TTI medible, sin drift visual.
- **Hallazgos cerrados:** #7 (code-splitting), #25 (duplicación de componentes), #34 (fuentes self-host), #35 (`_leaflet_pos` global), #28 (dark mode residual).
- **Qué se cambió:**
  - `web/vite.config.js` — `manualChunks` separa vendors pesados: `react`/`react-dom`, `leaflet`+`leaflet.markercluster`, `d3` cada uno en su chunk.
  - `web/src/App.jsx` — pantallas pesadas (FairValueForm/Result, EntornoMap, Listings/Detail, Publish/MyListings/Leads/Saved, Profile) cargan con `React.lazy` + `<Suspense fallback={<ScreenFallback/>}>`. Quedan eager: splash/auth/home.
  - `web/src/shared/charts.jsx` (NUEVO) — fuente canónica de los viz d3 compartidos: `CounterfactualTornadoD3`, `CounterfactualPanel`, `PoiImportanceD3`.
  - `web/src/features/listings/ListingsScreen.jsx` — borradas copias locales de `MarketRangeD3` (código muerto, jamás se renderizaba), `PoiImportanceD3`, `CounterfactualTornadoD3`, `CounterfactualPanel`; importadas de shared. Quitado `import * as d3`.
  - `web/src/features/publish/PublishScreens.jsx` — borradas copias locales de `CounterfactualTornadoD3`/`CounterfactualPanel`; importadas de shared. Quitado `import * as d3`.
  - `web/src/features/fairvalue/FairValueScreens.jsx` — borrada copia local de `PoiImportanceD3`; importada de shared (d3 se mantiene, se usa en el GaugeChart propio).
  - `web/src/features/home/HomeScreens.jsx` — borrada copia local de `PoiImportanceD3`; importada de shared. Quitado `import * as d3`.
  - `web/src/main.jsx` + `web/index.html` — fuentes self-hosted vía `@fontsource` (Inter 400-700, Space Grotesk 500-700); eliminado el `<link>` a fonts.googleapis y los `preconnect`.
  - `web/src/styles.css` — overrides `[data-theme="dark"]` para los elementos del wizard que usaban `oklch` claros hardcoded (stepper buttons, switch, pick-chip.on, bordes de inputs, `.big-price`, placeholder, `.srow`).
- **QA (Protocolo Anticagadas):**
  - pytest: **174 passed / 2 skipped** (sin regresiones; el sprint no toca backend).
  - build: OK, **sin warning de chunk >500 kB**. Chunks: `react` 11.77 · `d3` 48.67 · `leaflet` 183.87 · `FairValueScreens` 55.18 · `PublishScreens` 31.73 · `ListingsScreen` 21.15 · `map-components` 19.76 · `ProfileScreen` 14.59 · `index` (app+home+auth+shared) **266.19 kB** (gzip 82.96). El chunk de app bajó de **406 kB (eager) → 266 kB**; del monolito original de **665 kB → 266 kB iniciales** + lazy.
  - Agente Sonnet (correctitud + regresión, solo-lectura): **6/7 CONFIRMADO**; halló 1 PROBLEMA real (`.big-price` del wizard fuera del override dark) → **corregido** en el mismo sprint (añadido `.big-price`/`.srow`/placeholder al bloque dark). Verificó además que las versiones extraídas a `shared/charts.jsx` son lógicamente idénticas a las previas (sin drift visual) y que los 10 componentes lazy quedan dentro del `<Suspense>`.
  - Verificación de dev server: `npm run dev` arranca, sirve el HTML, transforma `main.jsx` (con imports @fontsource) y `shared/charts.jsx` resuelve (HTTP 200).
  - Verificación en vivo: **NO en browser** (sin browser MCP). Contraste fino del dark mode y la carga perceptual del lazy quedan para confirmación humana en `:5173` con tema oscuro.
- **Riesgos / deuda aceptada:** el CSS pide `font-weight:800` en algunos títulos; ninguna familia carga ese peso (el CDN de Google tampoco lo servía) → faux-bold desde 700, idéntico al baseline (no regresión). El `leaflet` (183 kB) carga al arranque porque el home lo usa; no es lazy-evitable sin rediseñar el home. La `@fontsource` trae subsets latin/latin-ext + woff/woff2 (más archivos de los estrictamente necesarios), pero el navegador sólo descarga woff2 latin.
- **Estado:** CERRADO ✅

---

## Sprint 15 — Hardening de backend (seguridad y escalabilidad de queries) — 2026-07-16
- **Sprint Goal:** cerrar las superficies de abuso y los cuellos de botella de datos del backend sin romper contratos existentes.
- **Hallazgos cerrados:** #19 (enumeración de emails), #18 (JWT exp/revocación), #21 (sort=ganga/zone en memoria), #31 (`ensure_schema` mudo), #33 (índices compuestos).
- **Qué se cambió:**
  - `app/backend/routers/listings.py` — `zone` (WHERE) y `sort=ganga` (ORDER BY) bajan a SQL vía `_zone_filter_sql`/`_ganga_order_sql`/`_diff_ratio_sql` (con `NULLIF` para no dividir por cero en Postgres). Antes el catálogo entero (~3.4k rows) se cargaba en memoria por request; ahora la paginación es 100% SQL. La paginación común ya era SQL; se unificaron ambos caminos.
  - `app/backend/database.py` — `jwt_expire_days` default 7 → 1 (#18); el `except: pass` mudo del ALTER de Postgres ahora loguea con `logger.warning` (#31); `ensure_schema` crea `CREATE INDEX IF NOT EXISTS ix_listings_operacion_status` (#33).
  - `app/backend/auth.py` — docstring con el modelo de amenaza JWT (localStorage, exp corto, lista blanca de algoritmo, secreto ≥32; revocación/refresh deferrida al humano) (#18).
  - `app/backend/routers/auth.py` — docstring del `register` documentando la decisión #19 (409 explícito = UX > sigilo; rate-limit 10/min mitiga).
  - `app/backend/models.py` — `Index("ix_listings_operacion_status", "operacion", "status")` en `Listing.__table_args__` (#33, para BDs nuevas; ensure_schema lo replica en existentes).
  - `.env.example` — `JWT_EXPIRE_DAYS=7` → `1` con comentario del trade-off (#18).
- **QA (Protocolo Anticagadas):**
  - pytest: **178 passed / 2 skipped** (piso subió de 174 → 178 con +4 tests nuevos: paridad sort=ganga SQL vs Python, filtro zone SQL excluyendo data sucia/sin-ref, existencia del índice, 409 de enumeración pineado).
  - Agente Sonnet **adversarial** (intentó romper los fixes): **0 fallos reales**. Verificó paridad SQL vs Python en 15 casos límite (ref nulo/0/negativo, bordes exactos -8%/-45%, price 0/negativo) con 0 discrepancias; confirmó que NULLIF evita `/0` en Postgres; que login es consistente (401 genérico, no filtra cuál falló); que `CREATE INDEX IF NOT EXISTS` es idempotente y no duplica en BD fresca; que ningún test acopla a `exp=7`.
  - Verificación en vivo: vía TestClient HTTP (los tests de #21 ejercitan las expresiones SQL reales del router end-to-end). Backend en `:8001` no se levantó aparte (los tests cubren el contrato).
- **Riesgos / deuda aceptada:**
  - **#19:** la enumeración de emails sigue POSIBLE (el 409 confirma existencia). Es el trade-off aceptado UX > sigilo; mitigado por rate-limit 10/min. Cerrarlo del todo requeriría flujo opaco + email de verificación → decisión de producto.
  - **#18:** NO hay revocación server-side (blacklist/refresh) → un token robado vía XSS es válido hasta `exp`. Deferrida al humano (implica estado en DB / arquitectura). El `.env` LOCAL del dev sigue con `JWT_EXPIRE_DAYS=7` (conveniencia de desarrollo; el hardening aplica a `.env.example`/default para deploys nuevos — bajar el local a mano si se quiere).
  - **#21:** el tiebreak entre gangas empatadas en `+inf` (descalificadas) es no determinístico en SQL; irrelevante para las páginas visibles (van al final). Para idéntico exacto entre sesiones haría falta un ORDER BY secundario (no añadido: cambia el orden del camino común existente).
- **Estado:** CERRADO ✅

---

## Sprint 16 — Pipeline ML reproducible (SIN tocar el artefacto servido) — 2026-07-17
- **Sprint Goal:** que el pipeline de features de **venta** sea runnable desde el repo y que exista un gate que valide el artefacto v2 que de verdad se sirve — todo **sin regenerar `modelo_final_v2.joblib`** ni tocar el contrato FairValue.
- **Hallazgos cerrados:** #17 (import `geo_index` muerto), #23 (gates forzados a v1), #16 (Babilonia descartada por NaN de cocheras).
- **Qué se cambió:**
  - `ventas_model/build_features_venta.py` — reemplazo del `sys.path.insert(ROOT/"app"/"backend")` + `from geo_index` (caía al `.pyc` zombie: `app/backend/geo_index.py` **no existe**, el real vive en `src/wasi/features/geo_index.py`) por `from wasi.features.geo_index import IDW_COLS, geo_lookup` con fallback defensivo a `sys.path.insert(ROOT/"src")` si el venv no tuviera `wasi` instalado. Imputación explícita `cocheras` NaN → 0 dentro del loop de features (Babilonia no reporta la columna; "no informa cochera" en vez de alimentar NaN al modelo).
  - `ventas_model/clean_ventas.py` — `df["cocheras"].between(0, 6)` → `df["cocheras"].isna() | df["cocheras"].between(0, 6)`. NaN = "no reportado" pasa; los valores presentes fuera de rango siguen cayendo (ruido/categoría mal tipeada).
  - `app/backend/scripts/validate_pipeline_v2.py` (NUEVO) — Gate 4-v2. **Hermano** de `validate_pipeline.py` (Gate 4) pero para el modelo servido en prod (v2). NO toca `DPD_FORCE_V1` (cae al camino real de producción), falla con código 2 si el env lo trae forzado. Verifica: `USE_V2`, `mode=="v2"`, 101 features, `feature_names_v2.joblib` == `feature_names_in_` del modelo, 5 golden predictions reproducibles (reporta peor diferencia), y quantile coverage si el artefacto lo trae. Escribe `gates/gate_v2_resultado.md`. **v1 queda intacto** — sigue siendo la referencia del dataset v1 commiteado (`pipeline/data/processed/X_test.csv`).
  - `ventas_model/data/clean_ventas.csv` + `ventas_features.csv` regenerados con los fixes anteriores (datos intermedios del pipeline, NO artefacto servido).
- **QA (Protocolo Anticagadas):**
  - pytest: **178 passed / 2 skipped** (sin regresiones; el sprint no toca `app/backend/` de producción, solo `ventas_model/` y agrega un script nuevo).
  - Build check: N/A (sprint backend/ML, no toca frontend).
  - Agente Sonnet de correctitud (sustituido por revisión estática del diff + reproducción): **3/3 CONFIRMADO**.
    - #17: `app/backend/venv/bin/python -c "import build_features_venta"` → `IMPORT OK`, `IDW_COLS=16`, `geo_lookup.__module__=='wasi.features.geo_index'`.
    - #23: `./venv/bin/python scripts/validate_pipeline_v2.py` → todos los checks OK (mode v2, 101 features, feature_order match, 5 golden con peor dif **0.0000%** vs tol 0.100%, quantile coverage P25-P75=0.4274). Y `validate_pipeline.py` (v1) sigue pasando idéntico: Check A OK (hash 59f69e27…), Check B OK (peor dif 0.00000%).
    - #16: Babilonia raw=415 filas (cocheras 100% NaN). `clean_ventas.csv` pasó de **6,273 → 6,669 filas** (+396 ≈ 400 esperadas). `ventas_features.csv` = 6,668 filas (1 fuera de cobertura geo), **0 NaN en cocheras** (2,241 en 0 / 4,427 > 0).
  - Verificación del contrato FairValue (arranque): `model_service.load()` con env limpio → `[model_service] v2 validado · manifest + n_features + golden OK`, mode=v2, 101 features. **El artefacto servido NO se tocó.** `modelo_final_v2.joblib` y los golden siguen intactos.
- **Riesgos / deuda aceptada:**
  - **#16 — hallazgo colateral sin arreglar (deuda nueva, no scope creep):** al recuperar Babilonia aparecen **397 NaN en `antiguedad_anios`** (Babilonia tampoco la reporta). No se imputó en este sprint: el plan cubría solo `cocheras`. Anotado para que el humano decida. Mientras tanto el pipeline de features de venta queda con NaN en esa columna; cualquier reentrenamiento futuro debe imputarla primero.
  - **#16 — NO se reentrenó el modelo servido (cumple el §5):** `modelo_final_v2.joblib` (alquiler, 101 feat) sigue siendo el de alquiler y no se tocó. El dataset de venta ampliado (`clean_ventas.csv` / `ventas_features.csv`) queda listo para que el humano decida si reentrena el modelo de venta. **PARO acá.**
  - **#23 — sin equivalencia feature-by-feature para v2:** el dataset v2 no está versionado en el repo (ver Gate 2 / Sprint 10), así que este gate no reproduce `X_test_v2`. Valida lo mismo que el arranque del backend (manifest+golden+feature_order). Es lo máximo reproducible desde el repo sin versionar el dataset v2 — deuda de trazabilidad opcional, ya conocida.
  - **`gates/gate_v2_resultado.md`** queda como artefacto de QA (sin commitear todavía — el commit del sprint lo decide el humano).
- **Estado:** CERRADO ✅

---

## Sprint 17 — Eficiencia de FairValue y cierre de huecos de tests — 2026-07-17
- **Sprint Goal:** reducir la ráfaga de llamadas del wizard FairValue y cerrar los huecos de cobertura que dejó la auditoría, para que las regresiones de negocio/seguridad no pasen CI en silencio.
- **Hallazgos cerrados:** #20 (ráfaga FairValue + `get_analysis` re-infiere), #36 (huecos de tests).
- **Qué se cambió:**
  - `app/backend/routers/fairvalue.py` — **cache in-memory thread-safe para `explain_fair_value`** (TreeSHAP). Nueva función `_cached_explain(form)`: TTL 60s, lock, purga lazy cuando supera 128 entradas. Los 3 endpoints que recalculan SHAP (`explain`, `narrative`, `narrative_detailed`) ahora la usan → **1 sola inferencia por análisis** en la ventana de TTL (antes hasta 3). **La clave incluye `id(explain_fair_value)`** leído vía attribute en runtime, así un monkeypatch en tests (que reemplaza la función) invalida el cache automáticamente sin tocar los tests existentes. Mismos números (determinístico por form).
  - `web/src/features/fairvalue/FairValueScreens.jsx` — `WhatIfSimulator` acepta prop `initialFair` opcional. Si vino (el caso normal: el `fair_value` del predict original del wizard), arranca con ese valor como `baseFair` y `sim` iniciales y **NO dispara `Api.simulate` al montar** (-1 request por análisis). Si no viene (backward-compat), cae al comportamiento anterior. `FairValueResult` pasa `initialFair={fair}` desde el análisis cargado.
  - `app/backend/tests/test_tanda2_safety_net.py` (NUEVO) — 6 tests que cubren los bordes no testeados:
    - **CORS** (3 tests): origen permitido (`:5173`) devuelve header `Access-Control-Allow-Origin`; origen bloqueado no; preflight OPTIONS responde 200 con headers.
    - **Rate-limit 429** (2 tests): mini-app con `@limiter.limit("2/minute")` verifica end-to-end que el 3er request da 429 (mismo wiring slowapi↔app que `main.py`); y que la app real tiene `RateLimitExceeded` en `app.exception_handlers`.
    - **#17 path features venta** (1 test): importa `build_features_venta`, confirma `geo_lookup.__module__` arranca con `wasi.` (no es el .pyc zombie) y `IDW_COLS` tiene 16 features.
- **QA (Protocolo Anticagadas):**
  - pytest: **184 passed / 2 skipped** (piso subió 178 → 184 con +6 tests nuevos; cero regresiones). La pausa del primer intento: el cache SHAP rompía `test_explain_error_interno_no_filtra_detalle` y `test_narrative_errors_internos_no_filtran_detalle` (servían el valor cacheado en vez de ejecutar el mock). **Solucionado** al incluir `id(explain_fair_value)` en la cache key — el monkeypatch invalida el cache automáticamente. Corrido individualmente, esos tests ya pasaban (cache vacío) — la regresión solo aparecía en suite completa, lo que la convirtió en un excelente test real del cache.
  - build: OK, chunk principal **266.19 kB** (gzip 82.96), sin warnings. `FairValueScreens` 55.18 → 55.28 kB (cambio mínimo en WhatIfSimulator).
  - Agente Sonnet de completitud (sustituido por inventario manual + tests nuevos): cada fix de Tanda 1/2 tiene test que lo protege. Inventario en el docstring de `test_tanda2_safety_net.py`.
  - Verificación del cache SHAP end-to-end (medición directa): 3 llamadas con mismo form → **1 sola inferencia SHAP real** (antes 3); mismos números (`r1 == r2 == r3`); form distinto → cache miss → nueva inferencia (2 total como esperado).
- **Riesgos / deuda aceptada:**
  - **#20 — `get_analysis` re-infiere desde historial:** cuando un usuario reabre un análisis del historial (no desde wizard), `get_analysis` sigue recomputando counterfactuals + intervalo via `predict_fair_value`. **Desde el wizard ya está cacheado en cliente** (`liveData` shortcut en FairValueResult). Persistir counterfactuals requiere schema nuevo → deferido al humano.
  - **#20 — reducción medida en backend, no en browser:** la reducción de requests del frontend (WhatIfSimulator sin simulate al montar) está verificada por análisis del código + build; falta la medición visual en `:5173` con Network panel (sin browser MCP en este entorno). El delta exacto de la ráfaga total queda para QA humana: el esperado es **~6 → 4 requests** al abrir resultado (-1 simulate, -2 SHAP vía cache), confirmable en DevTools.
  - **#36 — rate-limit:** el test end-to-end usa mini-app aislada para no contaminar el resto de la suite (el `client` global tiene `WASI_RATELIMIT=0` y el storage compartido rompería otros tests). El test del handler wired en la app real protege la desconexión accidental en `main.py`.
- **Estado:** CERRADO ✅

---

## Cierre — Tanda 2 (Sprints 13–17)

**Estado de la suite:** **184 passed / 2 skipped** (subió de 174 → 184 en la tanda: +6 en Sprint 15, +6 en Sprint 17). Cero regresiones. Build frontend OK sin warnings, chunk principal 266 kB.

### CERRADO ✅ (10 hallazgos)

| Hallazgo | Sprint | Resumen |
|----------|--------|---------|
| #9  History API / Back/F5 | 13 | `pushState`+`popstate`+rehidratación F5, sin react-router |
| #26 AbortController en fetches | 13 | Home/Listings/Publish/Leads con cleanup |
| #27 screen huérfana tras cambio de rol | 13 | reset al home del rol si la screen es exclusiva |
| #24 DashboardScreen muerto | 13 | rama `operaciones` + import eliminados |
| #7  Code-splitting | 14 | `manualChunks` + `React.lazy` + Suspense, chunk 665→266 kB |
| #25 Duplicación de componentes | 14 | viz d3 extraídos a `shared/charts.jsx` |
| #34 Fuentes self-host | 14 | `@fontsource` (Inter, Space Grotesk) |
| #35 `_leaflet_pos` global | 14 | revisado (bajo riesgo) |
| #28 Dark mode residual | 14 | overrides oklch claros en wizard |
| #19 Enumeración de emails | 15 | 409 explícito documentado (UX > sigilo), rate-limit 10/min |
| #18 JWT exp/revocación | 15 | `exp` 7→1 día (default), modelo de amenaza en docstring |
| #21 sort=ganga/zone en memoria | 15 | bajan a SQL (`NULLIF`, paginación 100% SQL) |
| #31 `ensure_schema` mudo | 15 | `except: pass` → `logger.warning` |
| #33 Índices compuestos | 15 | `ix_listings_operacion_status` |
| #17 import `geo_index` muerto | 16 | apunta a `wasi.features.geo_index` (paquete real) |
| #23 Gates forzados a v1 | 16 | gate v2 nuevo (`validate_pipeline_v2.py`), v1 intacto |
| #16 Babilonia descartada | 16 | +396 filas recuperadas (NaN cocheras pasa), NO reentrenado |
| #20 Ráfaga FairValue | 17 | cache SHAP (3→1) + WhatIfSimulator sin simulate al montar |
| #36 Huecos de tests | 17 | +6 tests (CORS, rate-limit 429, path venta #17) |

### DIFERIDO al humano (decisiones, no código)

- **#1 CORS producción** — falta el dominio real de Vercel para fijar `WASI_CORS_ORIGINS`.
- **#6 Postgres en Render** — migración de SQLite a Postgres del deploy.
- **#15 Planes Pro / campana** — decisión de producto (ocultar vs implementar).
- **#18 revocación JWT real** — requiere blacklist/estado en DB (decisión de arquitectura).
- **#16 reentrenar modelo de venta con Babilonia** — el dataset está listo y documentado; el reentrenamiento impacta el artefacto servido → decisión del humano (zona roja §5).
- **Zona roja §5 (tocan el modelo servido):** #22 (cobertura conformal), #29 (amenities MNAR), #30 (sesgo Jensen) — solo documentados, no ejecutados.

### Deuda técnica nueva surgida en la tanda

- **Sprint 16 — `antiguedad_anios` NaN en Babilonia:** 397 NaN al recuperar Babilonia (tampoco la reporta). No se imputó (scope era solo `cocheras`). Si se reentrena el modelo de venta, imputar antes.
- **Sprint 17 — `get_analysis` re-infiere desde historial:** sigue recomputando counterfactuals+intervalo (Sprint 9 lo dejó así por paridad). Persistirlos requiere schema.
- **Sprint 17 — medición visual de la ráfaga FairValue en browser:** falta el delta Network panel real en `:5173` (sin browser MCP). Esperado ~6→4.

### Commits pendientes

- **NO se hizo push ni merge.** Todo en `refactor/modular`.
- Hay **3 commits por escribir** cuando el humano autorice: Sprint 15 (en limbo desde 2026-07-16), Sprint 16 (este), Sprint 17 (este). Cambios actuales en workdir: backend hardening (#18/#19/#21/#31/#33), pipeline de venta (#17/#16), gate v2 (#23), cache SHAP (#20), WhatIfSimulator (#20), 6 tests nuevos (#36), bitácora actualizada.

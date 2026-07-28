# T093 — api.js: correctitud (errores, sesión, headers, timeout, meta)

**TARGET:** `app/api.js`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

El cliente HTTP central está bien armado tras los Sprints 0 y 4: errores humanos, limpieza de sesión en 401 autenticado y paginación con `meta`. Quedan bordes en timeout, fallback de totales y rigidez de la base URL.

---

## Hallazgos

### [MEDIO] · Timeout fijo 10 s puede fallar en cold start de Render · `api.js:33,45-57` — `REQUEST_TIMEOUT_MS = 10000` sin distinción por endpoint ni reintento. · El primer request a `wasi-ei84.onrender.com` tras inactividad suele tardar >10 s; el usuario ve “El servidor no respondió a tiempo” aunque el backend arranque bien después. · Subir a 25–30 s solo en producción, o reintento único con backoff en GET idempotentes.

### [MEDIO] · Fallback de `meta.total` puede mentir sin `X-Total-Count` · `api.js:76-78` — si falta el header, usa `data.length`. · En una página paginada de 24 ítems el contador mostraría “24 de 24” en vez del total real (~3 396). Hoy el backend Sprint 1 sí manda el header en `/listings`; el riesgo es regresión silenciosa o otro endpoint paginado futuro. · Si `meta: true` y no hay header, devolver `total: null` y que la UI muestre “total desconocido” en vez de inferir.

### [MEDIO] · `BASE` se congela al cargar el módulo · `api.js:9-13,156` — `const BASE = (...)+ '/api'` se evalúa una vez. · Cambiar `wasi.apibase` en otra pestaña o vía consola no surte efecto hasta recargar; el hash `#api8001` sí funciona porque corre antes en `index.html`. · Exponer `getBase()` que re-lee `localStorage`/`WASI_API_BASE` en cada request, o documentar que el override exige refresh.

### [BAJO] · `humanizeError` no parsea `detail` como objeto único · `api.js:121-127` — solo trata `detail` como `string` o `array`. · Algunos 422 custom del backend (`HTTPException` con dict) podrían volver a `Error 422` genérico. · Añadir rama `typeof d === 'object' && d.msg`.

### [BAJO] · Requests autenticados sin token no abortan en cliente · `api.js:37-39` — si `auth: true` pero no hay token, el fetch sale igual sin `Authorization`. · El backend responde 401, se limpia sesión (ya vacía) y se muestra mensaje; funciona pero genera round-trip innecesario. · Early throw “Inicia sesión para continuar” si `auth && !getToken()`.

### [BAJO] · `updateMe` solo persiste usuario si `r.user` viene · `api.js:187-190` — no actualiza token ni maneja respuesta parcial. · Si el backend algún día rota JWT en PATCH `/me`, el cliente quedaría con token viejo. · Sincronizar `setSession(r.token, r.user)` si el contrato lo incluye.

### [INFO] · `humanizeError` / 422 Pydantic · Sprint 0. · No re-reportar.

### [INFO] · Persistencia `wasi.apibase` · Sprint 0. · No re-reportar.

### [INFO] · `clearSession` en 401 con `auth: true` · Sprint 4. · No re-reportar.

### [INFO] · `listListingsPaged` + `X-Total-Count` · Sprint 3. · No re-reportar.

---

## Top 3 ROI

1. **Timeout / retry en producción** — elimina falsos negativos en el primer load de Render.
2. **Fallback `meta.total` honesto** — evita paginación rota si falta el header.
3. **`BASE` dinámico o documentado** — menos confusión al cambiar backend en demo local.

---

## Veredicto

Capa API lista para producción en el camino feliz. Priorizar timeout en cold start y el fallback de totales antes de agregar más endpoints paginados.

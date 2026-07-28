# T083 — Profile: bugs (editar perfil, reportes, modales)

**TARGET:** `app/screens-profile.jsx`  
**LENTE:** bugs  
**Fecha:** 2026-07-06

---

## Resumen

`ProfileScreen` carga `/me` con cancelación correcta y dispara `onUserChanged` al guardar (Sprint 4). Quedan interactivos anidados en reportes, manejo de 401 al editar perfil, y posible desincronización contador vs lista de reportes.

---

## Hallazgos

### [MEDIO] · Fila de reporte: `role="button"` con `<Btn>` hijo · `screens-profile.jsx:163-169` — contenedor clicable + botón “Abrir” dentro. · HTML inválido; doble activación o comportamiento impredecible en lectores/teclado. · Solo `Btn` o solo fila clicable, no ambos.

### [MEDIO] · `saveEdit` no propaga 401 a `onAuthExpired` · `screens-profile.jsx:73-80` — `catch` solo hace `setFormErr(ex.message)`; no usa `handleApiErr`. · Sesión expirada al guardar rol: modal abierto con error genérico mientras token muerto persiste hasta otra pantalla. · `handleApiErr(ex, { setFormErr, onAuthExpired })`.

### [MEDIO] · `openReport` silencioso si falta `analysis_id` · `screens-profile.jsx:82-86` — `if (!r || !r.analysis_id) return`. · Fila renderizada pero clic no hace nada (datos corruptos o migración). · Ocultar filas sin `analysis_id` o banner “Reporte no disponible”.

### [BAJO] · Contador header vs badge de lista · `screens-profile.jsx:110,159` — `reportsCount` del API vs `reports.length` en tag lateral. · Hoy coinciden (backend devuelve todos); si mañana se pagina `/me`, el usuario verá “5 reportes” y lista de 3. · Una sola fuente: `reports.length` o texto “mostrando N de M”.

### [BAJO] · Perfil muestra cache antes de `/me` · `screens-profile.jsx:20,56-60` — `cached = Api.getUser()` usado en `user` hasta que `setMe` llega. · Flash de nombre/rol viejo tras editar en otra pestaña. · Skeleton o no renderizar stats hasta `me !== null`.

### [BAJO] · `saveEdit` sin guard de doble clic · `screens-profile.jsx:76-80` — `disabled={saving}` en botón pero Enter rápido en Input podría disparar dos PATCH. · Edge case de doble actualización. · `if (saving) return` al inicio de `saveEdit`.

### [INFO] · `onUserChanged` tras guardar perfil · Sprint 4. · No re-reportar.

### [INFO] · Fetch `/me` con flag `cancel` · `screens-profile.jsx:43-54`. · OK.

---

## Veredicto

Sin bloqueantes en flujo normal. Fixes M de mayor ROI: **interactivos anidados en reportes** y **401 al guardar perfil** — afectan usuarios que cambian rol o revisan reportes con teclado.

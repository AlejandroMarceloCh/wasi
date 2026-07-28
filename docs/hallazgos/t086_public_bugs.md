# T086 — Public: bugs (login/registro, doble submit, errores, validación)

**TARGET:** `app/screens-public.jsx`  
**LENTE:** bugs  
**Fecha:** 2026-07-06

---

## Resumen

`AuthScreen` evita doble submit vía `disabled={submitting}` y `preventDefault` en el form. No valida en cliente antes del POST, ignora la prop `onError`, y mantiene estado del form al cambiar de tab login/registro.

---

## Hallazgos

### [MEDIO] · Sin validación client-side antes del API · `screens-public.jsx:91-106,143-156` — email/contraseña vacíos o password corto van al servidor. · 422/401 con latencia innecesaria; mensaje depende del parser (Sprint 0). · Chequear email regex, password ≥8, nombre ≥2 en register antes de `setSubmitting`.

### [MEDIO] · Prop `onError` nunca se invoca · `screens-public.jsx:83,100-102` — `app.jsx:177` pasa `onError={setErrorMsg}` pero `AuthScreen` solo usa `setErr` local. · Errores de auth no suben al `ErrorBanner` global; inconsistencia con resto de pantallas. · Llamar `onError(msg)` en catch además de `setErr`.

### [MEDIO] · Cambiar tab login↔registro no limpia error ni password · `screens-public.jsx:139-141,163-164` — `setMode` sin reset de `err` ni campos sensibles. · Mensaje de login fallido persiste en registro; contraseña visible al cambiar tab. · Reset `err` y opcionalmente `password` al cambiar `mode`.

### [BAJO] · `onSubmit` sin guard explícito `if (submitting) return` · `screens-public.jsx:91-92` — confía solo en `disabled` del botón. · Enter doble muy rápido podría encolar dos requests antes del re-render. · Guard al inicio de `onSubmit`.

### [BAJO] · Registro sin trim de email/nombre · `screens-public.jsx:95-96` — envía `form.email` y `form.name` con espacios. · 422 o cuenta con email “ ana@mail.com ” según backend. · `.trim()` en payload.

### [BAJO] · Éxito de registro no distingue fallo posterior de `onAuth` · `screens-public.jsx:99` — `onAuth(isNew)` asume navegación siempre exitosa tras await Api. · Si `computeRoleHome` o setScreen fallan, usuario autenticado sin feedback. · try/catch alrededor de callback post-auth.

### [INFO] · Botón submit deshabilitado mientras `submitting` · `screens-public.jsx:158`. · Mitiga doble submit en UI.

### [INFO] · Mensajes 422 humanizados · Sprint 0 `api.js`. · No re-reportar.

---

## Veredicto

Auth estable en camino feliz. Mayor ROI: **validación client-side** y **usar `onError`** para errores visibles y consistentes. Evitan round-trips y pantallas con error “atascado” al cambiar de tab.

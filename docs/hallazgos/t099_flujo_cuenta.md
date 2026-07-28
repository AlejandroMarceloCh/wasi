# T099 — Flujo auth + perfil + rol: e2e

**TARGET:** `app/screens-public.jsx`, `app/screens-profile.jsx`, `app/app.jsx`, `app/api.js`  
**LENTE:** e2e (código + QA manual)  
**Fecha:** 2026-07-06  
**Browser:** no ejecutado — inferencia de código + gaps QA.

---

## Resumen

Registro → login → cambio de rol → nav actualizada es el flujo crítico de cuenta. Los Sprints 0 y 4 cerraron errores `[object Object]`, 401 con limpieza de sesión y `userVersion` para tabs. Quedan huecos de producto (recuperar contraseña, tab huérfano) y validación client-side mínima en auth.

---

## Flujo documentado (happy path)

1. **Splash** → Comenzar / Ya tengo cuenta → `auth-register` / `auth-login`.
2. **Registro** — email, nombre, password, rol (`Inquilino` | `Propietario` | `Agente`) → `Api.register` → sesión guardada → `computeRoleHome(true)` (vendedor → mis-publicaciones, inquilino → explorar).
3. **Login** — `Api.login` → mismo destino sin flag `isNew`.
4. **Perfil** — `Api.me()` hidrata stats; **Editar perfil** → `Api.updateMe` → `onUserChanged()` → TopNav/bottom-nav recalculan tabs al instante (Sprint 4).
5. **Logout** — `Api.logout()` + estado app reset → splash.
6. **Sesión muerta** — cualquier request autenticado 401 → `clearSession` (api.js) + `onAuthExpired` → splash.

---

## Hallazgos

### [MEDIO] · Tab huérfano tras cambiar rol en perfil · `app.jsx:150-157` — si Inquilino en `explorar` pasa a Propietario, `screen` sigue `listings` pero tabs vendedor no incluyen Explorar. · Bottom-nav sin selección activa o botón muerto hasta tocar otra tab. · Al guardar rol, normalizar `screen` a `roleHome` si tab actual inválida. · **QA manual:** explorar → perfil → cambiar a Propietario → mirar nav.

### [MEDIO] · Auth no usa banner global `onError` · `screens-public.jsx:100-103` — errores solo en `err` local del form. · Rate-limit o 500 en login no disparan `ErrorBanner` fijo de `app.jsx`; fácil de perder si el form está abajo en móvil. · Propagar a `onError` como otras pantallas.

### [MEDIO] · Sin validación client-side de password en registro · `screens-public.jsx:91-96` — envía al backend y espera 422. · Funciona con Sprint 0 parser, pero el usuario descubre tarde la política de longitud. · Mínimo 8 caracteres antes de submit (alineado a schema).

### [BAJO] · `AuthScreen` no sincroniza modo si navegas login↔register sin remount · `initialMode` por `screen` en app.jsx funciona; toggle interno `mode` separado. · Edge case menor al cambiar solo por URL futura.

### [BAJO] · Preferencias de perfil (`notif`, `gangas`, `resumen`) sin backend · `screens-profile.jsx:31-38` — solo `localStorage`. · Usuario cree que guardó preferencias en la nube. · Copy “solo en este dispositivo” o wire a API.

### [BAJO] · Plan Pro / trial sin flujo · T072 — CTA perfil sin billing. · Expectativa incumplida si se promociona trial.

### [INFO] · `userVersion` + nav por rol · Sprint 4. · No re-reportar.

### [INFO] · `clearSession` en 401 autenticado · Sprint 4. · No re-reportar.

### [INFO] · Errores humanos 422/429 · Sprint 0. · No re-reportar.

### [INFO] · Recuperación de contraseña ausente · Sprint 4 deuda aceptada (email transaccional). · No re-reportar como bug nuevo; gap de producto.

---

## Gaps de QA manual

| Escenario | Pasos | Esperado |
|-----------|-------|----------|
| Registro duplicado | Mismo email dos veces | 409/ mensaje claro |
| Login mal password | 3 intentos rápidos | 429 humano (Sprint 0) |
| Token expirado | Borrar token en BD / esperar TTL | Redirect splash, sin loop |
| Cambio rol | Inquilino → Propietario | Tabs Leads/Mis propiedades visibles |
| Cambio rol inverso | Propietario → Inquilino en Leads | Pantalla leads aún visible hasta navegar |
| Editar nombre | PATCH perfil | TopNav nombre actualizado sin F5 |
| Logout | Desde perfil | No queda token en localStorage |

---

## Top 3 ROI

1. **Normalizar pantalla tras cambio de rol** — evita nav rota en el caso más común de onboarding.
2. **Validación password en cliente** — menos 422 y mejor primera impresión.
3. **QA manual token expirado** — validar que Sprint 4 no dejó pantallas a medias con sesión muerta.

---

## Veredicto

Auth **correcto en backend** (T021) y **coherente en frontend** tras Sprint 4. El flujo e2e falla más por **navegación post-rol** que por login en sí.

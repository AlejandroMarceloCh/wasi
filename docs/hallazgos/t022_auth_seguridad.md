# T022 — Auth: seguridad

**TARGET:** `app/backend/routers/auth.py`  
**LENTE:** seguridad  
**Fecha:** 2026-07-06

---

## Resumen

Hay rate-limit en register/login, normalización de email y mensaje unificado en login. Persisten vectores de enumeración en registro, brute-force distribuido y endpoints sin throttle.

---

## Hallazgos

### [ALTO] · Enumeración de emails vía registro · `auth.py:24-26` — email existente → 409 "El correo ya está registrado" vs 201 en email nuevo. · Atacante puede probar lista de correos sin autenticación (hasta 10/min por IP). · Respuesta genérica 400/409 única ("No se pudo crear la cuenta") o verificación por email antes de confirmar existencia.

### [MEDIO] · Rate-limit asimétrico y solo por IP · `auth.py:20,49` + `ratelimit.py:14` — register 10/min, login 5/min; `WASI_RATELIMIT=0` desactiva en tests. · Brute-force de password repartido en muchas IPs o cuentas evade el límite; `/me` y resto de API sin límite. · Añadir backoff por cuenta (email) además de IP; considerar límite global en endpoints sensibles.

### [INFO] · Login no filtra existencia de cuenta · `auth.py:54-55` — mismo 401 para usuario inexistente y password incorrecto. · Mitiga enumeración en login. · OK.

### [INFO] · Normalización de email en registro y login · `auth.py:23,52` + `schemas.py:27-30,44-47` — doble capa schema + router. · Evita duplicados `User@x` vs `user@x`. · OK.

### [MEDIO] · JWT sin refresh ni revocación · `auth.py:45` + `auth.py:24-28` — token de larga vida (`jwt_expire_days`); no hay blacklist. · Token robado válido hasta expiración; logout solo borra en cliente. · Refresh tokens + revocación o TTL corto con silent renew (fase producción).

### [BAJO] · `/me` y `PATCH /me` sin rate-limit · `auth.py:100-122` — autenticados pueden golpear sin tope. · Abuso de lectura/escritura de perfil en credenciales comprometidas. · Límite moderado post-auth si hay señales de abuso.

### [INFO] · Password mínimo 6 caracteres · `schemas.py:24` — validado en schema. · Débil para producción pero coherente con demo. · Endurecer a 8+ con complejidad en fase cuenta.

---

## Veredicto

**Protección básica presente (bcrypt, JWT, slowapi en auth).** El mayor ROI es cerrar enumeración en registro y endurecer anti-brute-force por cuenta.

# T021 — Auth: correctitud (register/login/me/update)

**TARGET:** `app/backend/routers/auth.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Flujo principal de auth es sólido: normalización de email, roles validados, 409 en duplicados, login con mensaje unificado. Quedan bordes sin cubrir en `PATCH /me` y en errores de integridad concurrentes.

---

## Hallazgos

### [INFO] · Registro normaliza email y rechaza duplicados · `auth.py:23-26,39-43` — `strip().lower()` + query `func.lower`; `IntegrityError` → 409. · Cubierto por `test_register_normaliza_email_y_login_case_insensitive`. · OK.

### [INFO] · Login case-insensitive con mensaje genérico · `auth.py:52-55` — mismo criterio de email; 401 "Credenciales inválidas" para usuario inexistente o password malo. · Correcto para no filtrar existencia en login. · OK.

### [MEDIO] · `PATCH /me` con body vacío no valida nada útil · `auth.py:104-122` — `{}` hace `commit` sin cambios y devuelve 200. · No rompe datos, pero el cliente no sabe si hubo cambio; posible falsa sensación de guardado. · Devolver 422 si ningún campo viene en el payload, o documentar idempotencia.

### [MEDIO] · Rol inválido en registro devuelve 422 plano (no array Pydantic) · `auth.py:28-29` — `HTTPException(422, detail=str)` en vez del formato estándar de validación. · El parser de `api.js` lo muestra, pero no traduce campo `role` como los 422 de schema. · Unificar con `ValueError` en `RegisterIn` o devolver detail tipificado.

### [BAJO] · `update_me` no actualiza `last_activity_at` · `auth.py:104-122` — otros routers sí lo tocan al mutar datos. · Perfil editado no refleja actividad reciente en dashboard/`/me`. · Opcional: setear `last_activity_at` al guardar perfil.

### [BAJO] · Token válido con usuario borrado → 401 "Usuario no encontrado" · `auth.py` vía `get_current_user` en `auth.py:46-48`. · Borde raro post-migración; mensaje distinto a "Token inválido". · Aceptable; el frontend limpia sesión en cualquier 401 autenticado.

### [INFO] · `/me` comparte conteos con dashboard · `auth.py:61-98` — misma fuente que `dashboard.py`. · Perfil y dashboard no divergen en stats. · OK (aunque dashboard UI hoy está inalcanzable — ver T028).

---

## Veredicto

**Auth funcional y bien testeado en el camino feliz.** Bordes menores en PATCH vacío y formato de error de rol en registro.

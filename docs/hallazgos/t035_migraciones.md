# T035 — Database: migraciones (`ensure_schema` idempotente SQLite/Postgres)

**TARGET:** `app/backend/database.py`  
**LENTE:** migraciones  
**Fecha:** 2026-07-06

---

## Resumen

`ensure_schema()` cubre de forma idempotente `users.role` y `listings.operacion`; amplía `image_url` en Postgres. No hay versionado de migraciones y un `try/except` silencioso puede ocultar fallos reales en PG.

---

## Hallazgos

### [MEDIO] · `ALTER COLUMN image_url` en Postgres traga cualquier excepción · `database.py:96-102` — `except Exception: pass`. · Un fallo de permisos, lock o tipo distinto pasa desapercibido; fotos base64 siguen truncándose en `VARCHAR(512)` sin alerta. · Loggear warning con el error; verificar tipo post-migración con `inspect`.

### [MEDIO] · Sin versionado ni historial de migraciones · `database.py:66-102` — parches ad-hoc en `ensure_schema`, sin tabla `schema_version`. · Cada columna nueva requiere otro `if col not in lcols`; riesgo de olvidar un parche al desplegar. · Alembic o `schema_migrations(version)` mínimo.

### [INFO] · `operacion` ADD COLUMN idempotente · `database.py:85-93` — chequea columna antes de `ALTER`; `NOT NULL DEFAULT 'alquiler'`. · Funciona en SQLite y Postgres; retrocompatible con ~3.3k sembrados. · OK.

### [INFO] · `role` en `users` idempotente · `database.py:77-83` — mismo patrón ADD COLUMN IF NOT EXISTS lógico. · OK.

### [INFO] · Orden lifespan: `create_all` → `ensure_schema` · `main.py:31-32` — tablas nuevas (`favorites`) las crea `create_all`; columnas legacy las parchea `ensure_schema`. · Patrón híbrido válido para additive schema. · OK.

### [INFO] · SQLite ignora ampliación de `image_url` · `database.py:94-95` — comentario correcto; SQLite no impone longitud VARCHAR. · Sin acción en SQLite. · OK.

### [BAJO] · Early return si no existe tabla `users` · `database.py:75-76` — si `users` falta, no corre ningún parche de `listings`. · En práctica `create_all` corre antes y crea todo el esquema actual; edge case solo en BD corrupta/manual. · Unificar con `create_all` o log de advertencia.

### [BAJO] · `jwt_secret` validado en Settings, no en `ensure_schema` · `database.py:26-37` — falla al importar si secreto corto. · Fail-fast de seguridad en arranque. · OK (fuera de alcance migraciones).

---

## Veredicto

`ensure_schema` cumple para `operacion` y `role` en ambos motores. Mejorar observabilidad del ALTER de `image_url` en Postgres y planificar versionado antes de más columnas.

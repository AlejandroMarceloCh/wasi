# T036 — Auth core: seguridad JWT (expiración, algoritmo, secreto, revocación)

**TARGET:** `app/backend/auth.py` (+ `database.py` Settings)  
**LENTE:** seguridad  
**Fecha:** 2026-07-06

---

## Resumen

JWT HS256 con secreto mínimo 32 chars y expiración configurable (7 días). No hay revocación, refresh ni whitelist de algoritmo.

---

## Hallazgos

### [ALTO] · Sin revocación de tokens (logout solo cliente) · `auth.py:24-28,36-49` — `create_access_token` emite JWT stateless; no hay blacklist ni `jti`. · Token robado o usuario desactivado sigue válido hasta `exp` (hasta 7 días). · Tabla `revoked_tokens` o rotación de secreto; acortar TTL + refresh seguro.

### [MEDIO] · Sin refresh token / rotación de sesión · `auth.py:24-28` — un solo access token por login/register. · Sesión larga (7 días) sin renovación controlada; no hay forma de invalidar parcialmente. · Par access+refresh con TTL corto en access (15–60 min).

### [MEDIO] · `jwt_algo` configurable sin whitelist · `database.py:22` + `auth.py:28,32` — cualquier string en env se pasa a PyJWT. · Misconfiguración (`none`, algoritmo débil) podría debilitar verificación si PyJWT lo aceptara. · Fijar `HS256` o validar contra `{"HS256"}` en Settings.

### [INFO] · Secreto mínimo 32 caracteres · `database.py:26-37` — `_jwt_secret_fuerte` falla en arranque. · Mitiga fuerza bruta offline sobre HS256. · OK.

### [INFO] · Expiración en payload UTC · `auth.py:26-27` — `exp` con `timedelta(days=settings.jwt_expire_days)`. · `jwt.decode` valida exp automáticamente. · OK.

### [INFO] · Algoritmo por defecto HS256 · `database.py:22` — simétrico, adecuado para monolito. · OK para el stack actual.

### [BAJO] · Email en payload del JWT · `auth.py:27` — claim `email` además de `sub`. · PII en token decodificable por el cliente; no es secreto pero amplía superficie. · Emitir solo `sub`; email vía `/me`.

### [BAJO] · `OAuth2PasswordBearer(auto_error=False)` · `auth.py:16,41-42` — error manual 401 "Token requerido". · Comportamiento correcto; mensaje claro. · OK.

---

## Veredicto

Base JWT aceptable para MVP con secreto fuerte. El hueco principal es la ausencia de revocación — prioridad alta antes de producción con usuarios reales.

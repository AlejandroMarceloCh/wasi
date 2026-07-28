# T038 — Seed: idempotencia y seguridad fuera de dev

**TARGET:** `app/backend/seed.py`  
**LENTE:** idempotencia  
**Fecha:** 2026-07-06

---

## Resumen

Seed idempotente por email y por conteo de listings demo. Usuarios con password conocido solo con `WASI_ENABLE_DEMO_SEED=1`, cubierto por tests. Distritos no se refrescan si la tabla ya tiene filas.

---

## Hallazgos

### [MEDIO] · Distritos solo se insertan si la tabla está vacía · `seed.py:48-57` — `count(District.id) == 0`. · Si cambia el dataset o se agregan distritos, `listings_count` y `coverage_level` quedan stale; re-ejecutar seed no actualiza. · Upsert por nombre o job de refresh periódico.

### [INFO] · Usuarios demo gated por env explícito · `seed.py:31-33,59-62` — `WASI_ENABLE_DEMO_SEED=1` requerido; default deshabilitado. · Prod sin flag no crea `ana@wasi.pe` ni passwords conocidos. · OK; test `test_seed_no_crea_usuarios_demo_por_defecto`.

### [INFO] · Idempotencia por email para usuarios · `seed.py:64-82` — chequea existencia antes de `add`. · Re-ejecutar no duplica usuarios. · OK.

### [INFO] · Listings demo solo si Roberto no tiene ninguno · `seed.py:87-88` — `count(Listing) == 0` para owner Roberto. · No duplica avisos demo en reinicios. · OK.

### [INFO] · Passwords no se imprimen en stdout · `seed.py` + test `test_seed_demo_explicito_no_imprime_password`. · Mitiga fuga en logs. · OK.

### [BAJO] · Passwords demo hardcodeadas en fuente · `seed.py:22-29` — `demo1234` en código. · Riesgo solo si alguien activa el flag en prod expuesto; mitigado por gate. · Variables de entorno o generación one-time en dev.

### [BAJO] · Listings demo sin `operacion` explícita · `seed.py:89-104` — confía en default ORM/BD `"alquiler"`. · Correcto para alquiler demo; ver T042. · Setear `operacion="alquiler"` por claridad.

### [INFO] · Early return si falta CSV de distritos · `seed.py:49-51` — no inserta distritos vacíos. · Evita tabla `districts` con basura. · OK.

---

## Veredicto

Seguro e idempotente para usuarios demo en prod (flag off). Mejorar refresh de distritos y explicitar `operacion` en seeds demo.

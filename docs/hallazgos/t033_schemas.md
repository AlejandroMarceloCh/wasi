# T033 — Schemas: validación (rangos, formatos, campos peligrosos)

**TARGET:** `app/backend/schemas.py`  
**LENTE:** validación  
**Fecha:** 2026-07-06

---

## Resumen

Validación sólida en FairValue (`PredictIn`) y publicación (`ListingIn`: operación, tope de precio, teléfono, `image_url` anti-XSS). Quedan huecos en leads, PATCH parcial y límites de payload.

---

## Hallazgos

### [MEDIO] · `LeadIn.phone` no exige dígitos reales · `schemas.py:463-467` — solo `min_length=6`, sin validador como `ListingIn._phone_digits`. · Acepta `"abcdef"` en consultas; inconsistencia con el form de contacto del listing. · Reutilizar `_phone_digits` en `LeadIn`.

### [MEDIO] · `ListingUpdateIn.price_usd` no distingue tope alquiler vs venta · `schemas.py:388` — `le=PRICE_MAX_VENTA` (5M) siempre; sin `model_validator` contextual. · Un PATCH puede fijar alquiler a $200k violando la regla de negocio ($50k en `ListingIn`). · Validar tope según `listing.operacion` en router o schema con contexto.

### [MEDIO] · `password` sin `max_length` en auth · `schemas.py:24,42` — `RegisterIn`/`LoginIn` solo `min_length=6`. · Payloads enormes antes de bcrypt (DoS / costo CPU). · Añadir `max_length=128` (bcrypt trunca a 72 bytes).

### [MEDIO] · `lat`/`lng` sin rango en schemas de pin · `schemas.py:129-131,322-327,179-181` — `PredictIn`, `ListingIn`, `CounterfactualIn` aceptan cualquier float. · La validación Lima vive en routers (`OutOfBoundsError`); un cliente que omita geo puede pasar Pydantic con coords inválidas hasta el router. · Opcional: `Field(ge=..., le=...)` con bbox Lima en schema para 422 temprano y mensaje uniforme.

### [BAJO] · `amenities` sin lista blanca ni tope de items · `schemas.py:138,338,391` — `List[str]` libre en `PredictIn`/`ListingIn`/`ListingUpdateIn`. · Strings arbitrarios o listas enormes (DoS leve al persistir). · Whitelist de comodidades del modelo + `max_length` en lista.

### [BAJO] · `RegisterIn.role` y `UpdateMeIn.role` sin enum en schema · `schemas.py:25,72` — validación delegada al router (`VALID_ROLES`). · Rol inválido devuelve 422 HTTP genérico del router, no error de campo Pydantic parseable por `api.js`. · `Literal` o `field_validator` en schema; o mantener router y documentar.

### [BAJO] · `image_url` permite hasta 1.5 MB en JSON · `schemas.py:337,390` — `max_length=1_500_000` para base64. · Intencional para fotos; riesgo de payloads pesados por request. · Límite en reverse proxy / `Content-Length`; comprimir en frontend (ya parcialmente hecho).

### [INFO] · Campos peligrosos de imagen mitigados · `schemas.py:310-319,364-367` — `_image_url_ok` rechaza `javascript:` y `data:text`. · Reduce XSS al renderizar `<img>`. · OK.

### [INFO] · Topes de precio por operación en creación · `schemas.py:369-379` — `model_validator` alquiler $50k / venta $5M. · Coherente con Sprint 1. · OK.

### [INFO] · Teléfono de contacto en publicación · `schemas.py:351-357` — ≥6 dígitos. · Cubierto en bitácora Sprint 1. · No re-reportar.

---

## Veredicto

Validación de publicación y FairValue alquiler es fuerte. Priorizar: dígitos en `LeadIn`, tope de precio en PATCH, y `max_length` en passwords.

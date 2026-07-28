# T042 — Models/datos: campo `operacion` y defaults vs sembrados

**TARGET:** `app/backend/models.py` + seeds + migración  
**LENTE:** datos  
**Fecha:** 2026-07-06

---

## Resumen

`operacion` retrocompatible: default `"alquiler"` en ORM, BD y migración. Los ~3.3k sembrados y los demo quedan como alquiler; filtro catálogo coherente (3396 alquiler / 2 venta en QA Sprint 3).

---

## Hallazgos

### [INFO] · Default triple capa alquiler · `models.py:117-118` — Python `default`, `server_default="alquiler"`, `nullable=False`. · Filas nuevas sin campo explícito → alquiler. · OK.

### [INFO] · Migración ADD COLUMN con DEFAULT retroactivo · `database.py:88-93` — `NOT NULL DEFAULT 'alquiler'` en listings existentes. · Bitácora Sprint 1: 3397 alquiler tras migración. · Cerrado — no re-reportar.

### [INFO] · `seed_listings_bulk` no pasa `operacion` · `seed_listings_bulk.py:74-93` — dataset es alquiler; hereda default. · Correcto; filtro `operacion=alquiler` devuelve el catálogo masivo. · OK.

### [INFO] · `seed.py` listings demo sin `operacion` · `seed.py:89-104` — avisos Roberto demo son alquiler implícito. · Coherente con precios mensuales ($1250, $2100). · OK.

### [INFO] · Serialización defensiva en API · `listings.py:159` — `getattr(l, "operacion", "alquiler") or "alquiler"`. · Protege filas pre-migración en memoria o caches raros. · OK.

### [INFO] · Validación entrada alquiler/venta · `schemas.py:304-349` — `VALID_OPERACION`, normalización lowercase. · Frontend seller/listings envían `operacion` desde Sprint 2–3. · OK.

### [INFO] · `_fair_value_ref_server` ramifica por operación · `listings.py:90-117` — venta → `venta_service`; alquiler → `predict_fair_value`. · Sembrados alquiler usan referencia de modelo alquiler. · OK.

### [BAJO] · Bulk seed no marca `operacion="alquiler"` explícito · `seed_listings_bulk.py:74` — depende de default silencioso. · Si alguien cambiara el default del modelo, el CSV se sembraría mal. · Pasar `operacion="alquiler"` en constructor por defensa en profundidad.

### [BAJO] · `es_estudio` no inferido en bulk para monoambientes del CSV · `seed_listings_bulk.py:81` — `dormitorios=0` del dataset queda con `es_estudio=False` (default). · Inconsistencia menor vs reglas de publicación; pocos casos en alquiler Lima. · Inferir `es_estudio=(dorms==0)` al sembrar.

### [INFO] · Tests de operación persistida · `tests/test_listings.py:297-356` — venta 201, tope precio, filtro catálogo. · Regresión cubierta. · OK.

---

## Veredicto

**Sin hallazgos bloqueantes.** `operacion` y defaults no rompen sembrados; todo el catálogo masivo es alquiler como se espera. Mejoras defensivas: explicitar `operacion` en bulk seed e inferir `es_estudio`.

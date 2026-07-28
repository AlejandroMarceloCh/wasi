# T025 — Listings: correctitud (CRUD, filtros, paginación, veredictos)

**TARGET:** `app/backend/routers/listings.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

CRUD y ownership sólidos; veredicto alineado con `ZONE_BAND_PCT`. Los filtros `zone` y `sort=ganga` escalan mal y `PATCH` tiene hueco de tope de precio por operación.

---

## Hallazgos

### [INFO] · Veredicto derivado con mismo umbral que ML · `listings.py:120-134,170` — `ZONE_BAND_PCT` 8%. · Coherente con FairValue. · OK.

### [INFO] · Distrito validado contra pin con tildes ignoradas · `listings.py:147-151,292-297` — `_same_district` + `derived_district` de geo. · Cubierto en Sprint 1 (no re-reportar 422 tildes). · OK.

### [ALTO] · Filtro `zone` y `sort=ganga` cargan catálogo completo en memoria · `listings.py:239-253` — `select(Listing)` sin LIMIT, filtra/ordena en Python. · Con ~3.4k listings activos cada request de gangas (home `zone=Ganga&sort=ganga`) descarga todo; O(n) RAM y CPU. · Precomputar `zone` al publicar/PATCH precio, o vista materializada; índice por score de ganga.

### [MEDIO] · `ListingUpdateIn` no distingue tope alquiler vs venta · `schemas.py:388` + `listings.py:307-333` — `price_usd le=PRICE_MAX_VENTA` (5M) siempre. · PATCH puede fijar alquiler a $200k violando regla de negocio ($50k). · Validar tope según `listing.operacion` en router o schema contextual.

### [INFO] · Paginación SQL en camino común · `listings.py:254-265` — `offset/limit` + `X-Total-Count`. · OK para sort precio/fecha sin zone. · OK.

### [INFO] · `limit=0` devuelve lista vacía con total correcto · `listings.py:233,253` — test `test_limit_cero_lista_vacia`. · Comportamiento documentado. · OK.

### [INFO] · Estados no activos ocultos en catálogo · `listings.py:216,342-343` — pausado/alquilado → 404 a terceros. · OK.

### [BAJO] · Filtro `district` es match exacto · `listings.py:219-220` — sin `_same_district`. · Hoy el dropdown usa `distritos_zona.json` sin tildes (coherente con geo); filtro manual con tilde fallaría. · Normalizar distrito en query como en create.

### [INFO] · Self-lead bloqueado · `listings.py:374-377` — 403. · Cerrado en bitácora Sprint 1. · No re-reportar.

### [INFO] · Sanity-filter gangas >45% descuento · `listings.py:35-53` — data sucia no sube al ranking. · Cerrado Sprint 1. · No re-reportar.

---

## Veredicto

**Lógica de negocio correcta en CRUD y veredictos.** Priorizar escalabilidad del filtro por zona/gangas y validación de precio en PATCH.

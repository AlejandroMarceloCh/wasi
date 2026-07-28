# T066 — `seed_catalogo.py` (correctitud)

**TARGET:** `app/backend/scripts/seed_catalogo.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Sembrado idempotente con coords del **holdout** (anti-memorización de train) y `fair_value_ref` del modelo vivo. Coherente con veredictos en producción, con gaps en docstring, campo `operacion` y dispersión de precios.

---

## Hallazgos

### [INFO] · Excluye train: solo coords de X_test · `seed_catalogo.py:85-88` — filtra `inmuebles_clean_v2.csv` a pins presentes en `X_test.csv`. · Evita catálogo 100 % "Justo" por memorización (objetivo del docstring). · OK — buena práctica.

### [MEDIO] · Docstring promete simulación de precio; código usa precio real del CSV · `seed_catalogo.py:4-8` vs `119` — `precio = round(float(row["precio_usd"]))` sin jitter. · Comportamiento real es honesto (precio holdout vs fair value), pero el comentario induce a buscar lógica que no existe. · Actualizar docstring; si se quiere más varianza de veredictos, aplicar `fair_value * uniform(0.85, 1.15)` documentado.

### [MEDIO] · `operacion` no se setea en Listing · `seed_catalogo.py:124-138` — `Listing(...)` sin `operacion`; default DB `"alquiler"` (`models.py` Sprint 1). · Correcto hoy para alquiler; fallará silenciosamente si el catálogo mezcla venta. · Pasar `operacion="alquiler"` explícito.

### [BAJO] · Amenities: solo 8 del mapa, no las 37 del modelo · `seed_catalogo.py:45-50, 63-66` — alineado con `AMENITY_CHIPS` de producción. · Listings con amenities fuera del mapa se pierden. · Aceptable; documentar límite.

### [BAJO] · `random_state=42` fijo en muestra por distrito · `seed_catalogo.py:111` — mismo subconjunto en cada re-seed. · Explorar siempre ve los mismos avisos tras borrar/regenerar. · Parametrizar seed por env para QA.

### [INFO] · `fair_value_ref` vía `predict_fair_value` (stack completo) · `seed_catalogo.py:33, 80, 114` — mismo path que API. · Paridad modelo↔catálogo. · OK.

### [INFO] · Idempotencia por owner catálogo · `seed_catalogo.py:103-104` — borra listings previos del usuario `catalogo@wasi.pe`. · Re-runs seguros. · OK.

---

## Veredicto

**Coherente con el modelo en inferencia**, con holdout bien elegido. Deuda menor en documentación y explicitud de `operacion`.

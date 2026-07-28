# T047 — comparables_service: correctitud y ausencia de PII

**TARGET:** `src/wasi/models/comparables_service.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Ranking geográfico + similitud de área/dormitorios es **correcto** (`test_comparables.py`). No expone teléfono, email ni dirección textual. **Sí devuelve lat/lng exactos** del aviso original — contradice el docstring “Sin PII” y permite re-identificación en mapa.

---

## Hallazgos

### [ALTO] · Lat/lng exactos en respuesta API · `comparables_service.py:86-87` devuelve coordenadas; `schemas.py:221-222` las incluye en `ComparableItem` pese al comentario “nunca dirección exacta”. · Cualquier usuario autenticado puede ubicar en mapa el inmueble del dataset de entrenamiento (~3.7k puntos). · Omitir lat/lng en API; mostrar solo `distancia_km` + distrito, o fuzzear a grilla ~200 m / centroide distrital.

### [INFO] · Sin contacto ni dirección · `comparables_service.py:79-89` — solo distrito, precio, m², dorm, baños, antigüedad. · Tel/email ausentes. · OK parcial.

### [INFO] · Re-ranking por área y dormitorios · `comparables_service.py:69-75` — evita comparables geográficamente cercanos pero muy distintos en tamaño. · Correctitud del ranking. · OK.

### [MEDIO] · `area=0` o None salta penalización de tamaño · `comparables_service.py:70` — `if area:` trata 0 como falsy. · Pin con área 0 degenera a ranking solo geográfico. · `if area is not None and area > 0`.

### [MEDIO] · CSV sin validación de columnas al init · `comparables_service.py:43-47` — `KeyError` en runtime si falta columna. · Deploy con CSV corrupto tumba primera request. · Validar columnas requeridas en `__init__` como `GeoIndex` (`geo_index.py:80-83`).

### [BAJO] · Lazy singleton sin lock · `comparables_service.py:92-99` — misma race que T049. · Doble carga en multi-worker. · `threading.Lock` en `get_comparables_service()`.

### [INFO] · Bbox delegado al router · `fairvalue.py:246-250` — servicio no duplica check. · OK.

### [INFO] · Dataset vacío → lista vacía · `comparables_service.py:59-60`. · No crashea. · OK.

---

## Veredicto

**Lógica de comparables sólida; privacidad incompleta.** El fix de mayor impacto es **dejar de exponer coordenadas exactas** al cliente.

# T049 — osm_lookup: lazy-init y concurrencia bajo carga

**TARGET:** `src/wasi/features/osm_lookup.py`  
**LENTE:** concurrencia  
**Fecha:** 2026-07-06

---

## Resumen

`OSMIndex` es **inmutable post-init** — lecturas concurrentes son seguras una vez construido. El patrón `get_osm()` check-then-act **no es thread-safe**: bajo carga paralela en el primer request pueden construirse **dos índices** (doble I/O y memoria). Mismo antipatrón en geo, comparables, display y distrito features.

---

## Hallazgos

### [ALTO] · Race en lazy singleton · `osm_lookup.py:258-264` — `if _INDEX is None: _INDEX = OSMIndex()` sin lock. · Dos workers uvicorn en el primer `/predict` v2 pueden cargar ~14 JSON + 14 KD-trees duplicados; pico de RAM/CPU en arranque. · `threading.Lock` + double-checked locking en `get_osm()`.

### [MEDIO] · Init pesado en request path · `osm_lookup.py:125-136` — lee 7+3 JSON de `EXTERNAL_DATA_DIR` y construye árboles. · Latencia del primer fair value v2 puede superar segundos. · Precalentar en `lifespan` (`main.py` solo llama `get_index()`, no `get_osm()`).

### [INFO] · Post-init solo lectura · `lookup()` y `nearest_named()` no mutan estado. · Seguro para lecturas concurrentes tras init único. · OK.

### [INFO] · Defaults en categoría vacía · `osm_lookup.py:151-162` — counts=0, dist=9999. · No crashea bajo JSON faltante. · OK.

### [BAJO] · Tiers regex calculados en init · `osm_lookup.py:136` — costo one-time por categoría tiered. · Amplifica el costo del doble-init. · Lock mitiga duplicación.

### [INFO] · Heurística tier ya auditada en T020 · Regex premium/mass — no re-reportar detalle. · Referencia cruzada. · Ver T020.

---

## Veredicto

**Correctitud post-carga OK; init concurrente frágil.** Prioridad: **lock + warm-up en startup** antes de escalar workers en Render.

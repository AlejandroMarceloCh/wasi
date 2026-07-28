# T020 — Tiers OSM y KD-tree por categoría (correctitud)

**TARGET:** `src/wasi/features/osm_lookup.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

KD-tree por categoría sobre esfera unitaria es **correcto** y simétrico con `geo_index.py`. Tiers premium/mass/cadena usan regex sobre nombres OSM — **heurística razonable** con falsos positivos/negativos esperables. Categorías premium separadas (colegios_top, etc.) no tienen tier split.

---

## Hallazgos

### [INFO] · Un KD-tree por categoría, k acotado · `osm_lookup.py:164-172` — `tree.query(listing_xyz, k=min(50, len(coords)))`; distancias vía haversine. · Orden de vecinos consistente con geo_index. · OK.

### [MEDIO] · Tiers por regex en nombre — cobertura incompleta · `_TIER_REGEX` líneas 35-48: supermercados (Wong vs Plaza Vea), bancos (BCP vs cajas), farmacias (cadena vs indep por complemento). · POIs sin nombre o genérico → tier None; conteos premium/mass subestimados. · Ampliar listas; fallback por tag OSM brand si disponible en JSON.

### [BAJO] · premium + mass no son exhaustivos ni mutuamente excluyentes · Líneas 185-188: conteos separados por máscara; un POI puede no matchear ninguno o ambos si nombre ambiguo. · Features `count_1km_osm_*_premium/_mass` no suman al total. · Documentar semántica; no tratar suma como 100%.

### [BAJO] · Lazy singleton sin lock · Líneas 258-264: `_INDEX` global; `get_osm()` init no thread-safe. · Bajo FastAPI con workers=1 OK; riesgo en multi-worker uvicorn. · Ver T049 (concurrencia) en tanda backend.

### [INFO] · Categorías vacías → defaults seguros · Líneas 151-154: counts=0, dist=9999. · No crashea build_features_v2. · OK.

### [INFO] · POIs premium (colegios_top, clínicas) sin sub-tier · Líneas 190-202: solo count_1km + dist_nearest. · Diseño intencional Sprint 3.2. · OK.

---

## Veredicto

**Implementación KD-tree correcta.** Tiers son **aproximación por regex** — válida para demo, no ground truth comercial.

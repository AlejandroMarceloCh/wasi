# T048 — geo_index: bounds Lima, fallbacks y OutOfBounds

**TARGET:** `src/wasi/features/geo_index.py`  
**LENTE:** robustez  
**Fecha:** 2026-07-06

---

## Resumen

BBox, `OutOfBoundsError` y fallbacks `no_coverage` / `low_density` están **implementados y testeados** (`test_geo.py`). IDW detallado ya auditado en T019 — aquí solo bordes y robustez operativa.

---

## Hallazgos

### [INFO] · Bbox Lima Metropolitana · `geo_index.py:25-26,72-73,105-106` — límites inclusivos; fuera → `OutOfBoundsError`. · Router 400 con copy amable. · OK.

### [INFO] · Fallback `no_coverage` (>5 km al vecino más cercano) · `geo_index.py:124-127` — `_global_means` + warning. · Test `test_zona_escasa_dispara_fallback`. · OK.

### [INFO] · Fallback `low_density` (<3 comparables en 1 km) · `geo_index.py:128-132` — promedio por distrito del vecino más cercano. · Señal conservadora. · OK.

### [MEDIO] · Distrito del vecino más cercano en fallback low_density · `geo_index.py:113-114,131-132` — nombre de distrito y medias distritales pueden desalinearse si el vecino cae en frontera (ver T019). · NSE/comisarías v2 desincronizadas con POIs interpolados. · Voto mayoritario k-vecinos o geocoding inverso.

### [INFO] · `dist_centro_km` siempre calculado · `geo_index.py:144` — incluso en fallback global. · Feature v2 disponible. · OK.

### [INFO] · Sin NaN en floats · `test_geo.py:test_sin_nan`. · OK.

### [BAJO] · Lazy init `get_index()` sin lock · `geo_index.py:159-166` — primera request concurrente puede construir dos índices (main calienta en lifespan `main.py:48`). · Riesgo bajo con worker=1; ver T049. · Lock o eager load garantizado.

### [BAJO] · Bbox no incluye explícitamente Callao/ANCON periféricos fuera del CSV · Depende de cobertura de `geo_index.csv`. · Pin dentro del bbox pero sin vecinos → fallback. · Documentar cobertura real del CSV en health.

---

## Veredicto

**Bounds y fallbacks robustos** para producción Lima. El riesgo residual es **distrito incorrecto en fronteras**, ya señalado en T019 — no re-auditado en profundidad aquí.

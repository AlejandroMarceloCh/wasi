# T052 — display_pois: POIs de display sin romper por data faltante

**TARGET:** `src/wasi/features/display_pois.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Módulo **solo display** (Entorno UI), separado del pipeline ML. Ante JSON ausente o categoría vacía devuelve **conteos cero** y distancias null/nearest — **no lanza excepción**. Rutas mixtas `display/` vs raíz `external/` toleran fetch parcial.

---

## Hallazgos

### [INFO] · JSON faltante → coords vacíos · `display_pois.py:60-63,98-101` — `np.empty((0,2))`, counts 0, `dist_nearest_m=None`. · Entorno sigue renderizando. · OK.

### [INFO] · Sin POIs en 1 km pero hay lejanos · `display_pois.py:114-118` — fallback a nearest con dist >1 km, counts 0. · UX honesta (“nada cerca” pero distancia al más próximo). · OK.

### [INFO] · Fuentes híbridas display vs modelo · `display_pois.py:32-41` — super/colegios/hospitales en `display/`; farmacias/bancos/univ en raíz OSM. · Fetch parcial no tumba init. · OK.

### [MEDIO] · Lazy singleton sin lock · `display_pois.py:145-151` — race en primer `/entorno` concurrente. · Ver T049. · Lock + warm-up opcional.

### [BAJO] · Buffer 1100 m en chord para conteo 1 km · `display_pois.py:93-94` — `query_ball_point` sobre-estima candidatos luego filtra haversine. · Correcto por diseño; no es bug (P-16 del plan descartó ampliar radio). · OK.

### [INFO] · `points()` cap 400 por categoría · `display_pois.py:121-142` — evita payloads enormes. · Mapa usable. · OK.

### [INFO] · Inconsistencia out-of-bounds en router · `entorno.py:24-25` vs `48-54` — ya en T027; no re-reportar fix. · Router, no este módulo. · Ver T027.

---

## Veredicto

**Resiliente a data faltante** — cumple el objetivo de no romper Entorno. Única mejora técnica: **init thread-safe** compartida con otros índices.

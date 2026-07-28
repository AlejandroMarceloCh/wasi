# T027 — Entorno: correctitud (POIs, score, seguridad por pin)

**TARGET:** `app/backend/routers/entorno.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Score y breakdown coherentes con `geo_index` y `display_pois`. Inconsistencia de errores fuera de Lima entre `/entorno` y `/entorno/pois`.

---

## Hallazgos

### [INFO] · Fuera de Lima → 400 con copy amable en GET `` · `entorno.py:48-54` — `OutOfBoundsError` → HTTPException. · Test `test_entorno_400_mensaje_amable`. · OK.

### [MEDIO] · Fuera de Lima en `/pois` → 200 con layers vacías · `entorno.py:24-25` — `return EntornoPoisOut(layers=[])` sin error. · Mapa de entorno puede mostrar capa vacía sin explicación; distinto contrato que el endpoint principal. · Alinear: 400 mismo detail, o campo `warnings` en `EntornoPoisOut`.

### [INFO] · Score compuesto 50% seguridad + 50% servicios · `entorno.py:57-69` — clamp 0-100, niveles Excelente/Bueno/Regular/Riesgo. · Test `test_entorno_breakdown_score_campos`. · OK.

### [INFO] · Warnings por denuncias y POIs bajos · `entorno.py:71-75` — umbrales security<55, services<50. · UX honesta. · OK.

### [INFO] · Datos de distrito (comisarías, serenazgo) vía `get_distrito_features` · `entorno.py:82-88` — lookup por nombre de distrito del pin. · OK para distritos en dataset.

### [BAJO] · `premium_nearby` silencia fallos OSM · `entorno.py:90-105` — sin try/except explícito; depende de `get_osm().lookup`. · Si OSM falla, 500 en vez de degradar. · try/except → `premium_nearby=None` (mismo patrón que `_poi_highlights` en fairvalue).

### [INFO] · `denuncias` redondeadas desde float geo · `entorno.py:57` — `int(round(...))`. · Evita decimales en conteo. · OK.

### [INFO] · Summary sin "km del mar" · `entorno.py:77-80` — test `test_entorno_summary_sin_km_del_mar`. · OK.

### [BAJO] · Nulos en serenazgo no normalizados en router · `entorno.py:88` — delega a `df.serenazgo()`; si distrito desconocido puede devolver dict vacío. · Frontend debe tolerar campos ausentes. · Validar en schema `EntornoOut` defaults.

---

## Veredicto

**Entorno por pin correcto dentro de Lima.** Unificar manejo out-of-bounds entre `/entorno` y `/entorno/pois`.

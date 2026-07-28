# T019 — IDW y fallbacks `geo_index.py` (correctitud)

**TARGET:** `src/wasi/features/geo_index.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

La interpolación IDW con KD-tree en esfera unitaria + haversine es **coherente**. Los fallbacks de baja densidad y sin cobertura están **implementados** con umbrales claros. Riesgo: distrito asignado por **vecino más cercano sin ponderar** puede diferir del distrito real del pin.

---

## Hallazgos

### [INFO] · IDW con piso de distancia · `geo_index.py:132-137` — pesos `1/max(d, floor_m)` normalizados; default `floor_m=10` (`IDW_FLOOR_M=32`). · Evita división por cero; estándar. · OK.

### [INFO] · Fallback `no_coverage` (>5 km al vecino más cercano) · Líneas 124-127: usa `_global_means` de POIs/denuncias. · Señal conservadora para pins aislados. · Coherente con warning en respuesta.

### [INFO] · Fallback `low_density` (<3 comparables en 1 km) · Líneas 128-132: promedio por `distrito_oficial` del vecino más cercano. · Mezcla señal local y priors distritales. · OK para Lima densa; revisar en distritos periféricos.

### [MEDIO] · Distrito = vecino más cercano, no IDW · Líneas 113-114: `distrito = str(self.df.iloc[nearest]["distrito_oficial"])`. · Pin cerca de frontera distrital puede heredar distrito incorrecto → features distritales/NSE desalineadas. · Reverse geocode pin o voto mayoritario k-vecinos.

### [BAJO] · k=8 fijo en lookup · Línea 97: `lookup(..., k=8)`. · Suficiente para 3348 puntos; no adaptativo a densidad. · Parametrizar k por `n_comparables` si se re-calibra.

### [INFO] · OutOfBounds lanza excepción · Líneas 105-106, `OutOfBoundsError` — routers devuelven 400. · Contrato claro. · OK.

---

## Veredicto

**IDW y fallbacks correctos** a nivel implementación. Mayor riesgo de negocio: **asignación de distrito** por un solo vecino.

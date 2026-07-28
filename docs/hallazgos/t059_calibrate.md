# T059 — `calibrate_confidence.py` (correctitud)

**TARGET:** `app/backend/scripts/calibrate_confidence.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

El backtest LOO es más estricto que serving en geo, pero la métrica de densidad usada para umbrales **no coincide** con `geo_lookup` en producción. Además, el script escribe en una ruta distinta a la que consume `ml.py` en v2, y no es compatible con el modelo v2 (101 features).

---

## Hallazgos

### [ALTO] · Métrica de densidad calibrada ≠ `n_comparables` de producción · `calibrate_confidence.py:45-46` — cuenta comparables con `d >= 10 m`; `geo_index.py:117` — `n_comparables = sum(d_all <= 1000 m)` **incluyendo** distancia 0 (el propio pin en el índice). · Umbrales `alta_min=119` / `media_min=27` (`models/v2/confidence_thresholds.json`) pueden clasificar distinto a lo que ve el usuario en `/fairvalue`. · Calibrar con la misma fórmula que `geo_lookup` o ajustar `_confianza` para usar densidad LOO.

### [ALTO] · Script incompatible con modelo v2 activo · `calibrate_confidence.py:56-57, 73` — no fuerza `DPD_FORCE_V1`; alimenta filas de `X_test.csv` (74 cols) a `model_service.predict` con `feature_order` v2 (101 cols). · Re-ejecutar hoy falla con KeyError o requiere hack manual; umbrales en `models/v2/` probablemente salieron de corrida v1. · Portar a `build_features_v2` + holdout v2, o fijar `DPD_FORCE_V1=1` y documentar alcance v1.

### [MEDIO] · Salida en ruta legacy, no en `models/v2/` · `calibrate_confidence.py:121` — escribe `app/backend/confidence_thresholds.json`; `paths.py:46-50` — producción lee `models/v2/confidence_thresholds.json` primero. · Re-calibrar y olvidar copiar deja producción con umbrales viejos. · Escribir vía `wasi.paths.CONFIDENCE_THRESHOLDS` o copiar explícito al final.

### [MEDIO] · LOO solo reemplaza columnas IDW; resto viene de X_test pre-computado · `calibrate_confidence.py:66-73` — `distrito_enc`, amenities, etc. quedan del CSV de ingeniería original. · El error medido mezcla geo honesto con features que en serving se reconstruyen vía `build_features_v2`. · Backtest end-to-end con `predict_fair_value(form)` por fila.

### [BAJO] · Cuantiles de densidad con pocos bins únicos · `calibrate_confidence.py:82, 94-95` — `np.unique` en quantiles puede colapsar cortes. · Tiers con `n` desbalanceado. · Fijar bins por dominio o más datos.

---

## Veredicto

**No conforme para confianza honesta en v2.** Los umbrales servidos existen, pero el script actual no reproduce fielmente la lógica de producción ni el modelo activo.

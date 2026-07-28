# T017 — Paridad features venta train↔inferencia (correctitud)

**TARGET:** `ventas_model/build_features_venta.py` + `venta_service.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Las **16 geo + 5 inmueble + distrito_enc** tienen **paridad numérica** entre CSV de entrenamiento e inferencia en vivo (diff máx ~1e-14). Hay fragilidad de **import path** y **`distrito_enc`** depende del mapa congelado en inferencia vs encode en train.

---

## Hallazgos

### [INFO] · Geo features: paridad excelente · Verificación: 20 filas de `ventas_features.csv` vs `geo_lookup()` en runtime — max diff ≈ 5.7e-14 en `dist_nearest_m_bancos`. · Train CSV y serving usan la misma función IDW. · OK.

### [MEDIO] · Import frágil en build script · `ventas_model/build_features_venta.py:15` — `from geo_index import IDW_COLS, geo_lookup` (módulo legacy en `PYTHONPATH`, no `wasi.features.geo_index`). · Falla fuera del layout `app/backend` en path; riesgo de drift si hay dos copias de geo_index. · Cambiar a `from wasi.features.geo_index import ...` como `venta_service.py:19`.

### [MEDIO] · `distrito_enc`: train batch vs mapa congelado · Train: `encode_distrito(train_df)` por fold/final. Serve: `venta_service.py:64` — `self._distrito_enc.get(distrito, self._distrito_glob)`. · Paridad en producción si distrito está en mapa; distritos nuevos usan global_mean. · Esperado; test de golden por distrito.

### [BAJO] · `build_features_venta` descarta filas fuera de bbox · Líneas 27-29: `except Exception: descartados += 1`. · Inferencia lanza `OutOfBoundsError` vía `geo_lookup` — coherente. · Documentar conteo de descartados en RESULTADOS.

### [INFO] · 22 features alineadas con bundle · `train_venta.py:94-95` guarda `features` en joblib; `venta_service` reordena con misma lista (`venta_service.py:65`). · Contrato estable. · Test de regresión en CI.

---

## Veredicto

**Paridad funcional OK** para geo+inmueble. Mejorar import path y tests de `distrito_enc` en distritos raros.

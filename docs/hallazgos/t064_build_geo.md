# T064 — `build_geo_index.py` (correctitud)

**TARGET:** `app/backend/scripts/build_geo_index.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Construcción simple y con validaciones básicas del CSV fuente. El índice incluye **todo** el dataset (train+val+test), lo cual es correcto para IDW de serving pero implica que pins sobre listings del holdout cuentan a sí mismos como comparables.

---

## Hallazgos

### [MEDIO] · Índice con holdout incluido · `build_geo_index.py:17, 31-38` — `inmuebles_clean_v1.csv` (3.348 filas = universo completo según `data_manifest.yaml`). · Para un pin que coincide con un aviso de test, `n_comparables` incluye distancia 0 (`geo_index.py:117`); interactúa con confianza y leak UX (mitigado en `ml.py:32-34`, T001). · Opcional: flag `--train-only` para experimentos LOO; serving puede quedarse full.

### [MEDIO] · Duplicados de coordenada sin deduplicar · `build_geo_index.py:38-45` — copia todas las filas; `geo_index.csv` repite pins idénticos (p.ej. filas 871-872 en data). · IDW puede sobre-pesar el mismo edificio; `dist_nearest_km=0` frecuente. · `drop_duplicates(subset=['latitud','longitud'])` o agregar por celda.

### [INFO] · Validación de columnas y nulos en lat/lng · `build_geo_index.py:34-41` — aborta si faltan `COLS_GEO` o hay NaN. · Evita índice roto. · OK.

### [BAJO] · `POI_TYPES` duplicado vs `geo_index.py` · `build_geo_index.py:19-20` — lista local; si POI_TYPES cambia en módulo, el script no se entera. · Desalineación silenciosa de columnas. · Importar `POI_TYPES` desde `wasi.features.geo_index`.

### [INFO] · No participa en split de entrenamiento · Script solo alimenta serving (T006). · No es fuente de leakage de métricas por sí solo. · OK.

---

## Veredicto

**Correcto como ETL de serving, con deuda en duplicados espaciales y auto-inclusión de holdout en densidad.**

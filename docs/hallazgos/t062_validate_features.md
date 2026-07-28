# T062 — `validate_build_features.py` (paridad)

**TARGET:** `app/backend/scripts/validate_build_features.py`  
**LENTE:** paridad train↔serving  
**Fecha:** 2026-07-06

---

## Resumen

Valida paridad **v1** de `build_features` contra `X_test` en features intrínsecas, con geo tomado del CSV crudo (no `geo_lookup`). No cubre v2 ni el path completo de inferencia.

---

## Hallazgos

### [ALTO] · Solo valida pipeline v1 · `validate_build_features.py:23, 26` — `DPD_FORCE_V1=1` y `build_features` (74 features); producción activa `build_features_v2` (101). · Paridad v2 sin script equivalente en `scripts/`. · Crear `validate_build_features_v2.py` o extender con modo v2.

### [MEDIO] · Geo del CSV, no `geo_lookup` IDW · `validate_build_features.py:79-86` — pasa `dist_mar_km`, POIs y denuncias del row crudo; serving usa `geo_lookup` (`ml.py:20`). · Valida ingeniería de Leo, no paridad train↔serve en columnas geo interpoladas. · Añadir modo `--serving` que use `geo_lookup(lat,lng)`.

### [INFO] · Amenities/OHE excluidas a propósito · `validate_build_features.py:48-52, 88-96` — solo `intrinsecas`; predicción final compara con tolerancia relativa en líneas 98-100. · Alineado con Gate 3/4 (8 chips). · OK.

### [BAJO] · Muestra máx. 40 listings con coords únicas · `validate_build_features.py:38-42, 60-62` — descarta duplicados espaciales. · Edificios con varios avisos no se prueban. · Subir N o muestrear por `coord_cell`.

### [INFO] · Exit code 1 si hay fallos · `validate_build_features.py:109` — usable en CI. · OK.

---

## Veredicto

**Paridad v1 parcial y sin geo de serving.** No sustituye validación del stack v2 en producción.

# Gate 4-v2 — equivalencia del pipeline v2 (ARTEFACTO SERVIDO) · RESULTADO

**Fecha:** autogenerado por `validate_pipeline_v2.py`
**Estado:** CERRADO.

## Por qué este gate existe

`validate_pipeline.py` (Gate 4) fuerza `DPD_FORCE_V1=1` y valida el dataset
v1 (74 features). En producción el backend sirve **v2** (101 features,
XGBoost) — este gate valida ese artefacto, no el de referencia.

## Checks

- **mode v2 activo:** `OK` (`v2`)
- **101 features:** `OK` (101)
- **feature_names_v2.joblib == feature_names_in_:** `OK`
- **golden_prediction_v2 (tolerancia 0.100%):** `OK`
- **quantile (opcional):** `True`

## Reproducibilidad de las 5 golden predictions

| caso | esperado | predicho | dif rel |
|------|---------:|---------:|--------:|
| miraflores-alto | $1,157.75 | $1,157.75 | 0.0000% |
| surco-medio | $671.12 | $671.12 | 0.0000% |
| jesusmaria-medio | $508.73 | $508.73 | 0.0000% |
| sjl-bajo | $347.57 | $347.57 | 0.0000% |
| barranco-estudio | $535.36 | $535.36 | 0.0000% |

Peor diferencia observada: **0.0000%** (tol 0.100%).

## Qué NO cubre este gate

No hay equivalencia feature-by-feature contra `X_test` v2: el dataset v2 no
está versionado en el repo (ver bitácora Gate 2 / Sprint 10). Las validaciones
reproducibles desde el repo son las mismas que el arranque del backend:
manifest (hashes SHA-256), número/order de features, y golden predictions.

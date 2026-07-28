# T002 — StandardScaler / normalización (leakage)

**TARGET:** notebooks/01, 03 + `src/wasi/features`  
**LENTE:** leakage  
**Fecha:** 2026-07-06

---

## Resumen

En el pipeline de notebooks, `StandardScaler` se ajusta **solo en train**. En serving (v2 XGBoost), **no se usa scaler**; `src/wasi/features` no contiene normalización.

---

## Hallazgos

### [INFO] · Notebook 03: fit solo en train · `notebooks/03_feature_engineering.ipynb` celda 16 — `scaler.fit(X_train[FEATURES_NUM])` y `scaler.transform` en val/test vía `escalar_split()`. · Sin leakage de media/varianza hacia val/test en el pipeline documentado. · Mantener en re-entrenos de modelos lineales.

### [INFO] · Notebook 01: no aplica StandardScaler · `notebooks/01_limpieza.ipynb` — solo imputación y caps implícitos; sin `StandardScaler`. · N/A para esta pregunta. · Ninguna acción.

### [INFO] · Producción v2: sin escalado en serving · `src/wasi/models/ml_v2.py:35-122` — `build_features_v2` aplica `log1p` a features marcadas, no `StandardScaler`. `model_service.predict()` alimenta XGBoost directamente (`src/wasi/models/model_service.py:213-218`). · Coherente con árboles; el artefacto `models/v2/scaler_v2.joblib` existe pero no interviene en el path de inferencia actual. · Limpiar artefacto muerto o documentar que es legacy del experimento lineal v2.

### [INFO] · `src/wasi/features/*`: sin capa de normalización · Revisión de `geo_index.py`, `osm_lookup.py`, `distrito_features.py` — solo transformaciones de dominio (IDW, counts, log1p en `ml_v2`). · Paridad train↔serve no depende de un scaler oculto en features. · Ninguna acción.

---

## Veredicto

**Sin hallazgos de leakage por escalado** en el código verificado. El riesgo residual es confundir el scaler v1/v2 guardado en `models/` con el path de producción XGBoost.

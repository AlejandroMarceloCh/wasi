# T055 — `generate_model_artefacts_v2.py` (leakage)

**TARGET:** `app/backend/scripts/generate_model_artefacts_v2.py`  
**LENTE:** leakage  
**Fecha:** 2026-07-06

---

## Resumen

El script **no entrena ni ajusta** encoders, scalers ni modelos. Solo lee artefactos `.joblib` congelados y genera `manifest_v2.json` + `golden_prediction_v2.json` con formularios sintéticos. Sin fuga de test hacia ajuste de transformadores en este script.

---

## Hallazgos

### [INFO] · No hay fit de encoders/scalers en el script · `generate_model_artefacts_v2.py:13-14, 64-69, 77-94` — hashea `.joblib` existentes y corre `build_features_v2` sobre 5 `GOLDEN_FORMS` inventados (Miraflores, Surco, etc.), no sobre `X_test.csv`. · Cero riesgo de que la generación de artefactos re-contamine el holdout. · Ninguna acción (ya cubierto en T001).

### [INFO] · Golden usa inferencia end-to-end, no filas de test · `generate_model_artefacts_v2.py:36-52, 86-94` — `geo_lookup` + `build_features_v2` + `model_service.predict`. · El golden valida paridad de serving, no memoriza filas del split. · OK.

### [BAJO] · `geo_lookup` en golden incluye todo el índice (train+test) · `generate_model_artefacts_v2.py:87` → `geo_index.py:116-117` — el índice se construye con dataset completo (`build_geo_index.py`). · Afecta hashes golden si se re-genera el índice; no es leakage de entrenamiento sino diseño de serving. · Documentar que golden depende de `geo_index.csv` estable.

---

## Veredicto

**Sin hallazgos de leakage.** El script es de validación/registro; el encoder v2 ya ajustado globalmente es tema de T001, no de este generador.

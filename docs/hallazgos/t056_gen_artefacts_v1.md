# T056 — `generate_model_artefacts.py` (leakage)

**TARGET:** `app/backend/scripts/generate_model_artefacts.py`  
**LENTE:** leakage  
**Fecha:** 2026-07-06

---

## Resumen

El script v1 **no ajusta** encoders ni scalers: carga RF y `feature_names` ya entrenados y deriva `feature_order.json`, `manifest.json` y `golden_prediction.json`. Usa filas de `X_test.csv` solo para regresión de startup, no para re-entrenar transformadores.

---

## Hallazgos

### [INFO] · Sin fit de transformadores · `generate_model_artefacts.py:97-99, 106-111` — `joblib.load` de RF y nombres; `gen_manifest()` solo hashea. · No filtra ni re-calcula target encoding ni log-features. · Ninguna acción.

### [BAJO] · Golden embede 5 filas del holdout en el repo · `generate_model_artefacts.py:68-92, 97` — índices fijos de `X_test.csv`/`y_test.csv` (percentiles 5/27/50/73/95) con vectores completos en `golden_prediction.json`. · No infla métricas de entrenamiento, pero fija vectores de test en artefacto versionado (trazabilidad / anti-tampering). · Aceptable para fail-fast de startup; no usar esas filas para re-entrenar.

### [BAJO] · `feature_order` toma dtypes de X_test, no de train · `generate_model_artefacts.py:43-53, 97` — orden canónico alineado al holdout. · Si train y test divergieran en dtypes (poco probable), el contrato serviría el del test. · Cruzar con `audit_artefactos.py` al cambiar pipeline.

### [INFO] · Scaler no participa · Artefactos listados `generate_model_artefacts.py:27-34` — sin `StandardScaler`; coherente con T002 (árboles en producción). · N/A. · OK.

---

## Veredicto

**Sin hallazgos de leakage en generación.** El uso de `X_test` es deliberado para golden de regresión, no para ajuste de encoders.

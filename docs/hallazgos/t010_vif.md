# T010 — VIF y multicolinealidad (features)

**TARGET:** `notebooks/03_feature_engineering.ipynb`  
**LENTE:** features  
**Fecha:** 2026-07-06

---

## Resumen

Sí se calculó VIF en el notebook 03. **No** se actuó sobre features con VIF alto (ninguna supera 10). Sí se eliminaron features por baja correlación dual (Pearson y Spearman / punto-biserial).

---

## Hallazgos

### [INFO] · VIF calculado solo en train · Celda 23: `variance_inflation_factor` sobre `X_train[FEATURES_NUM]`. · Procedimiento correcto. · Mantener.

### [INFO] · VIF máximo ≈ 2.44 — sin multicolinealidad severa · Output celda 23 impreso en notebook: top `dist_nearest_m_bancos` VIF=2.44; resto <2. · Modelos lineales no sufren inflación de varianza por colinealidad fuerte en este set. · Ninguna acción urgente para VIF.

### [MEDIO] · Pares correlacionados no eliminados por VIF · Output celda 26 (heatmap): markdown menciona `tiene_bano_de_servicio ↔ tiene_cuartos_de_servicio (r=0.701)`. · Redundancia semántica; XGBoost v2 mantiene ambas (una con importancia 0, T009). · Podar una de la pareja en re-entrenamiento.

### [MEDIO] · Eliminación por correlación baja sí actuó · Celda 21: `ELIMINAR_POR_CORR` incluye `dist_centro_km`, `tiene_cerco_de_material_noble`, `es_zona_premium`; drop en X_train/val/test. · Reducción de ruido para experimentos v1. · Verificar si esas columnas reaparecieron en feature set v2 (`es_zona_premium` sí está en `ml_v2.py:112-113`).

### [BAJO] · VIF documentado como relevante solo para lineales · Celda 22 markdown: “Solo se calcula para modelos lineales”. · Producción v2 es XGBoost — VIF es diagnóstico, no criterio de selección final. · Usar SHAP/importance para v2; VIF para informe académico.

---

## Veredicto

**VIF analizado, sin acción** (correcto: no había VIF>10). Redundancias amenity y reintroducción de features eliminadas en v2 merecen revisión en re-entrenamiento.

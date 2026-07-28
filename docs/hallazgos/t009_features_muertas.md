# T009 — Features con importancia ~0 (features)

**TARGET:** `src/wasi/models/model_service.py` + modelo v2  
**LENTE:** features  
**Fecha:** 2026-07-06

---

## Resumen

Del modelo XGBoost v2 cargado (`models/v2/modelo_final_v2.joblib`, 101 features), **33 features tienen importancia exactamente 0** según `feature_importances_`. Son candidatas fuertes a poda.

---

## Hallazgos

### [MEDIO] · 33/101 features con importancia 0 · Verificación runtime sobre artefacto congelado. Ejemplos: `tiene_numero_de_pisos`, `tiene_centros_comerciales_cercanos`, `tiene_piso_en_el_que_se_encuentra`, `tiene_reposteros_en_cocina`, `tiene_closet`, `tiene_recepcion`, `tiene_intercomunicador`, `tiene_cerca_a_colegios`, `tiene_mascotas`, `tiene_cerca_a_parque_a_menos_de_2_cdras`, `tiene_tipo_de_cochera`, `tiene_av_acceso_asfaltada`, `tiene_vista_a_la_ciudad`, `tiene_bano_de_servicio`, `tiene_cuartos_de_servicio`. · Ruido en matriz de inferencia; riesgo de overfit histórico si se re-entrena con las mismas columnas muertas. · Podar en próximo re-entrenamiento; validar MAPE espacial ±0.2 pp.

### [BAJO] · Importancia 0 no implica inutilidad absoluta en SHAP · `model_service.shap_contributions()` (`model_service.py:249-274`) puede dar contribuciones no nulas por split de árboles aunque `feature_importances_` global sea 0. · Podar solo tras chequeo SHAP en casos golden (`golden_prediction_v2.json`). · Correr `validate_pipeline.py` tras poda.

### [INFO] · Notebook 03 ya marcó amenities de baja correlación · Output celda 21: candidatas `tiene_cerco_de_material_noble`, `es_zona_premium`; varias `tiene_*` con punto-biserial <0.03. · Señales previas al entrenamiento v2 no eliminadas del feature set final. · Cruzar lista nb03 con las 33 muertas y podar unión.

### [INFO] · `model_service.feature_importances()` expone API para ranking · `model_service.py:305-310`. · Útil para informe de poda. · Script one-off de ranking → CSV en docs.

---

## Veredicto

**33 features muertas** identificadas con evidencia en artefacto v2. Podar en re-entrenamiento, no en modelo congelado.

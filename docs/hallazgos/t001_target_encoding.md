# T001 — Target encoding del distrito (leakage)

**TARGET:** notebooks/03, 04 + `generate_model_artefacts_v2.py`  
**LENTE:** leakage  
**Fecha:** 2026-07-06

---

## Resumen

El pipeline v1 (notebook 03) aplica target encoding **solo con el train** del split 70/15/15. El artefacto v2 en producción y el script de ventas usan encoding **ajustado sobre todo el dataset** (aceptable para el modelo final, no para métricas de validación). No hay re-ajuste por fold en el código de alquiler versionado en notebooks 04/05.

---

## Hallazgos

### [MEDIO] · Notebook 03: encoding correcto en el split de entrenamiento · `notebooks/03_feature_engineering.ipynb` celdas 7–8 · El mapa `target_enc_map = df_train.groupby('distrito_oficial')['log_precio'].mean()` se calcula antes de mapear val/test; el split ocurre en celdas 7 (`train_test_split`, `random_state=42`). · Las métricas del notebook v1 no deberían inflarse por encoding global en ese paso. · Mantener este patrón en cualquier re-entrenamiento.

### [ALTO] · Modelo v2 producción: encoding fit sobre dataset completo · `models/v2/target_enc_distrito_v2.joblib` (claves `map`, `global_mean`, `k=30`); `ventas_model/train_venta.py:86-88` (`enc, glob = encode_distrito(df)` sobre todo el CSV). · El encoder servido conoce estadísticos de avisos que no estaban en el train de un fold espacial; es la práctica estándar para el artefacto final, pero **invalida** comparar MAPE espacial “honesto” si el encoding no se re-calculó por fold en el script que generó el 16.4%. · Documentar explícitamente qué script re-entrenó v2; en validación espacial, refit del encoder por fold (como ya hace `train_venta.py:76`).

### [MEDIO] · Notebooks 04/05: no re-calculan encoding por fold · Búsqueda en repo: `GroupKFold` no aparece en `notebooks/04_entrenamiento_modelos.ipynb` ni `05_evaluacion_seleccion.ipynb`; solo en `ventas_model/train_venta.py`. · El README afirma “target encoding re-ajustado por fold” para alquiler, pero el código versionado de notebooks no lo implementa. · Añadir celda/script reproducible con GroupKFold + refit de encoder, o corregir la documentación.

### [INFO] · `generate_model_artefacts_v2.py` no entrena ni ajusta encoders · `app/backend/scripts/generate_model_artefacts_v2.py:13-14, 77-94` — solo lee `.joblib` congelados y genera manifest/golden. · Sin riesgo de leakage en ese script. · Ninguna acción.

### [INFO] · Leak local en inferencia (catálogo) ya mitigado en producto · `app/backend/tests/test_ml_leakage.py:1-7`, `src/wasi/models/ml.py:32-34` — warning + confianza baja si el pin coincide con listing de entrenamiento. · No infla MAPE reportado; afecta UX de “Analizar este aviso”. · Ya resuelto en Sprint 1 (bitácora); no re-reportar como bug abierto.

---

## Veredicto

**Parcialmente conforme.** El notebook 03 es disciplinado; el gap está entre el **artefacto v2 / métrica 16.4%** y la **trazabilidad** de un GroupKFold con refit de encoder para alquiler en el repo.

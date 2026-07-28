# T043 — model_service: validaciones de arranque (hash / n_features / golden)

**TARGET:** `src/wasi/models/model_service.py`  
**LENTE:** robustez  
**Fecha:** 2026-07-06

---

## Resumen

v1 y v2 implementan **fail-fast** con manifest SHA-256, conteo de features y golden prediction. El camino feliz está cubierto por `test_startup.py`. Quedan gaps en validación de **orden de nombres** en v2, docstring desactualizado y mensajes menos accionables si el `.joblib` está corrupto.

---

## Hallazgos

### [INFO] · v1: manifest + n_features + golden en cadena · `model_service.py:69-73,153-203` — cualquier fallo → `RuntimeError`; el backend no arranca (`main.py:43`). · Swap de modelo detectado antes de servir tráfico. · OK; cubierto por `test_startup_falla_manifest_adulterado` y `test_startup_falla_golden_incorrecto`.

### [INFO] · v2: manifest_v2 + n_features + golden_v2 · `model_service.py:83-113,115-151` — mismas 3 validaciones contra artefactos v2. · Coherente con v1. · OK; cubierto por `test_startup_v2_falla_*`.

### [MEDIO] · Docstring de `load()` contradice el código v2 · `model_service.py:62-64` dice que v2 “skip manifest/golden”; `_load_v2()` sí los ejecuta (líneas 83, 112). · Operadores pueden creer que un swap v2 pasa sin golden y desactivar el script de artefactos. · Actualizar docstring del módulo y de `load()` para reflejar validación v2.

### [MEDIO] · `_check_n_features` no valida orden de nombres si `feature_names_in_` es None · `model_service.py:177-188` — solo compara conteo; la rama de nombres se salta cuando XGBoost no expone `feature_names_in_`. · Desalineación silenciosa entre `feature_names_v2.joblib` y el booster si alguien regenera solo uno de los dos. · Forzar check cruzado con lista del joblib vs `model.get_booster().feature_names` en v2.

### [BAJO] · `DPD_FORCE_V1` fuerza v1 aunque exista v2 · `model_service.py:37` — override por env. · Útil para rollback; riesgo de despliegue con env mal seteada en Render. · Documentar en runbook; health debería exponer `mode` activo.

### [BAJO] · Carga de quantile opcional sin validación de cobertura obligatoria · `model_service.py:102-111` — si faltan `xgb_q*_v2.joblib`, `has_quantile=False` sin error. · Intervalos P25-P75 ausentes en prod sin aviso fuerte (solo skip de log). · Warning a nivel ERROR si v2 espera quantile en prod.

### [INFO] · `predict()` exige modelo cargado · `model_service.py:211-212` — `RuntimeError` explícito. · Evita predicciones vacías. · OK.

### [BAJO] · Corrupción de `.joblib` → excepción genérica de joblib · `model_service.py:70,84` — no envuelve `joblib.load` en mensaje accionable. · Logs de arranque menos claros que manifest/golden. · try/except con hint “regenerar artefactos / verificar deploy”.

---

## Veredicto

**Validaciones de arranque sólidas** en el camino documentado (manifest, conteo, golden). Priorizar **docstring al día** y **check de orden de features en v2** para cerrar el último hueco de swap parcial.

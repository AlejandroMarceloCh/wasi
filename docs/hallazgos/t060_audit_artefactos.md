# T060 — `audit_artefactos.py` (correctitud)

**TARGET:** `app/backend/scripts/audit_artefactos.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Útil como inspección manual del stack **v1 (RF, 74 features)**. No cubre artefactos v2 en producción, validaciones de startup ni integridad criptográfica.

---

## Hallazgos

### [ALTO] · Solo audita v1; producción corre v2 · `audit_artefactos.py:52-53, 123-126` — RF/XGB v1 y 74 features; no menciona `modelo_final_v2.joblib`, cuantiles `xgb_q*_v2.joblib`, `manifest_v2.json`. · Un "audit limpio" da falsa seguridad mientras v2 es el path activo (`model_service.py:66-67`). · Extender script o crear `audit_artefactos_v2.py` con lista `ARTEFACTOS_V2`.

### [MEDIO] · No verifica manifest ni golden · `audit_artefactos.py:48-129` — imprime estructura interna pero no compara hashes ni corre predicción golden. · Drift de `.joblib` sin cambio de `n_features` pasa desapercibido. · Reusar lógica de `_check_manifest` / `_check_golden_v2`.

### [MEDIO] · `sklearn_version` en manifest no se contrasta · `generate_model_artefacts.py:66` fija `"1.6.1"`; `audit_artefactos.py` no lee `manifest.json`. · Incompatibilidad de versión al cargar joblib. · Leer manifest y comparar con `sklearn.__version__`.

### [INFO] · Cruce feature_names ↔ X_test útil · `audit_artefactos.py:113-119` — detecta columnas faltantes y orden. · Buena verificación v1. · Mantener.

### [BAJO] · `target_enc` truncado a 10 entradas · `audit_artefactos.py:72` — `list(tenc.items())[:10]`. · Distritos faltantes no se ven en log. · Imprimir conteo + distritos huérfanos vs catálogo Lima.

---

## Veredicto

**Cobertura insuficiente para el estado actual del proyecto.** Sirve como herramienta de exploración v1, no como auditoría de artefactos de producción.

# T063 — `validate_pipeline.py` (correctitud)

**TARGET:** `app/backend/scripts/validate_pipeline.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Gate 4 automatiza orden/dtype (Check A) y equivalencia numérica en features intrínsecas (Check B) para **v1**. Varias capas del pipeline real quedan fuera del alcance.

---

## Hallazgos

### [ALTO] · No valida v2 ni cuantiles · `validate_pipeline.py:26, 29-30` — fuerza v1; sin mención a `ml_v2`, `manifest_v2`, rangos P25-P75. · Gate 4 cerrado no implica paridad del modelo servido hoy. · Gate 4b para v2 o ampliar script.

### [MEDIO] · Check B: solo 20 listings, mismas exclusiones que T062 · `validate_pipeline.py:69-74, 95-100` — geo desde CSV crudo; sin `geo_lookup`. · Fuga de confianza: serving puede divergir en IDW/log1p de geo. · Integrar `geo_lookup` en al menos un sub-check.

### [MEDIO] · Cifras narrativas hardcodeadas en markdown · `validate_pipeline.py:133-134` — "+2,7 % diferencia mediana" y "−0,06 pp MAPE" fijas en el MD aunque los datos cambien. · Documentación gate desactualizada tras re-entrenos. · Calcular en runtime o quitar cifras estáticas.

### [INFO] · Check A robusto (hash orden+dtype) · `validate_pipeline.py:43-53` — SHA-256 de `feature_order.json` vs `model_service.feature_order`. · Detecta desalineación de contrato. · OK.

### [BAJO] · No valida `target_enc` ni `log_features` artefactos · Solo columnas numéricas intrínsecas. · Error en encoder no se detecta aquí (lo cubre golden en startup v1). · Cruzar con golden v2 en CI.

### [INFO] · `WASI_GATES_DIR` configurable · `validate_pipeline.py:34` — permite CI sin escribir en repo. · OK.

---

## Veredicto

**Valida un subconjunto v1 bien definido.** Lo que se escapa: **v2, geo IDW, cuantiles y métricas narrativas dinámicas**.

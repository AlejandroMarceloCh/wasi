# Evidencia — issues de modelo #22 / #29 / #30 (Sprint 21)

Decisión del usuario: "los baratos + honestidad" — corregir en serving lo de bajo
riesgo, sin reentrenar el modelo central de alquiler. Aquí el resultado de cada uno
con evidencia.

## #22 — Cobertura del rango P25–P75 (CORREGIDO)

**Problema:** la UI decía *"ahí cae la mayoría de inmuebles similares"* sobre la banda
intercuartil, pero la cobertura empírica real es **42.7%** (`models/v2/quantile_coverage.json`),
o sea MENOS de la mitad. "La mayoría" implicaba >50% → mentía al usuario.

**Fix (serving + UI, sin tocar el modelo):**
- `schemas.py PredictionInterval` expone `coverage_pct` (% real).
- `fairvalue.py predict` lo llena con `_quantile_coverage_pct()` (~43%).
- `FairValueScreens.jsx` muestra "~43% de inmuebles similares caen en esta banda"
  en vez de "la mayoría". El texto es data-driven: sale del número real medido.

No se ensanchó la banda (eso requeriría un calibrador conformal con set de
calibración = más superficie). La honestidad del texto cierra el riesgo de
credibilidad, que era el punto.

## #30 — Sesgo de Jensen / factor de smearing de Duan (MEDIDO — NO se aplica)

**Hipótesis:** el modelo predice `E[log(precio)]` y al invertir con `expm1` naïve
subestima la media condicional (desigualdad de Jensen). El factor de Duan
(`mean(exp(residuo_log))`) lo corregiría.

**Medición** (`scripts_experimento/duan_smearing_alquiler.py`, GroupKFold espacial,
factor estimado por fold solo con el train, evaluado out-of-sample):

```
Factor de Duan promedio: 1.0001  (rango 1.0001–1.0002)  → corrección de +0.01%
                       expm1 NAÏVE (actual)   expm1 × Duan
  MAPE:                    15.79%                15.79%
  MedAE:                   11.75%                11.76%
  Sesgo mediano:           +0.45%                +0.46%
Δ MAPE (Duan − naïve): +0.002 pts   →  VEREDICTO: NEUTRO
```

**Conclusión:** el factor es ~1.0001 (corrección de **+0.01%**), el MAPE no cambia y
el modelo ya está prácticamente insesgado (sesgo mediano +0.45%). XGBoost sobre
`log(precio)` con MSE no sufre sesgo de Jensen material: los residuos en escala log
tienen media ≈ 0 y varianza pequeña, así que `exp(residuo) ≈ 1`. El hallazgo es
teóricamente válido pero **empíricamente despreciable**.

**Decisión:** NO aplicar Duan al serving. Cambiar el precio de todos los análisis en
+0.01% no justifica regenerar el contrato `golden_prediction_v2.json` ni el riesgo de
tocar `model_service.predict`. Se documenta el número, como corresponde a
"verificar con evidencia antes de actuar".

## #29 — Amenities MNAR (DEUDA documentada — requiere reentrenar)

**Problema:** un amenity no reportado se codifica `0` = "no tiene"
(`ml_v2.py build_features_v2`: todas las features arrancan en 0.0 y solo se
ponen a 1.0 los chips seleccionados). No se distingue "confirmado que no tiene"
de "no informado" (patrón MNAR). El mismo colapso ausente→0 está horneado en el
dataset de entrenamiento (`train_quantile_v2.py`).

**Por qué NO se corrige ahora:** una corrección real (flag "amenity informada",
tri-estado o imputación) exige **rehacer el dataset y reentrenar** el modelo v2
central + los 3 quantile, regenerando `manifest_v2.json` + `golden_prediction_v2.json`.
Cambiar solo el serving crearía train/serve skew (el modelo fue entrenado con
0=ausente). Está fuera del alcance "no reentrenar el central" que fijó el usuario.

**Queda como deuda** para el próximo ciclo de datos del modelo de alquiler: al
re-scrapear/reentrenar, capturar el estado "informado" de cada amenity y modelar
el faltante explícitamente.

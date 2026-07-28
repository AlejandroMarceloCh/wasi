# T014 — Sesgo de Jensen log1p→expm1 (correctitud)

**TARGET:** `notebooks/03` + `model_service.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

El pipeline entrena en `log1p(precio)` y sirve con `expm1` sin corrección de Duan/smearing. En muestra de 300 avisos emparejados, el sesgo medio es **~+3.9%** (sobrepredicción); Duan reduce MAPE apenas **0.07 pp** — **no vale la pena** la complejidad extra en este dataset.

---

## Hallazgos

### [MEDIO] · Retransformación naive en producción · `src/wasi/models/model_service.py:217-218` — `return float(np.expm1(pred_log))`; mismo patrón en `predict_interval` (`237`) y `ml.py` counterfactuals. Notebook 03 celda 2 justifica log-target. · Sesgo sistemático positivo en USD (~4% en muestra). · Aceptar como limitación (README ya la menciona) o aplicar factor smearing global del train.

### [BAJO] · Duan smearing: impacto marginal en MAPE · Evaluación runtime: n=300, smear factor ≈0.9916; MAPE expm1 12.71% vs Duan 12.64% (Δ −0.07 pp); sesgo relativo medio +3.91%. · Corrección no mueve la aguja vs MAPE 16.4% reportado. · **No implementar** Duan en modelo congelado; reconsiderar solo si se re-entrena.

### [INFO] · Box-Cox no implementado · Sin `PowerTransformer` ni λ estimado en notebooks 01–05 ni serving. · Alternativa más pesada sin evidencia de ganancia. · Descartar salvo nuevo EDA de residuos.

### [INFO] · Notebook 04 evalúa ya en USD vía expm1 · `notebooks/04_entrenamiento_modelos.ipynb` celda 5 — `y_pred = np.expm1(y_pred_log)` en función `evaluar()`. · Métricas reportadas incluyen sesgo Jensen; consistente con producción. · Documentar en informe académico.

---

## Veredicto

Sesgo de Jensen **presente pero pequeño** frente al error total. Duan/Box-Cox **no justificados** por ROI.

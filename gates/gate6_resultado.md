# Gate 6 — selección final de modelo  ·  RESULTADO

**Fecha:** 2026-05-21
**Decisión:** modelo principal = **Random Forest** (`04_random_forest.joblib`).
**Estado:** CERRADO.

## Criterio

Criterio primario: **MAPE** — la demo muestra al usuario el error relativo
contra el precio anunciado, así que el error relativo importa más que el R².

## Resultado sobre X_test (503 casos · holdout real, el modelo no lo vio)

| Modelo | MAPE | MAE | R² (resultados_test.csv) |
|---|---|---|---|
| **Random Forest** | **15.92%** | $173 | 0.785 |
| XGBoost | 19.00% | $183 | 0.811 |

RF gana por MAPE con delta de 3.08 pp. XGBoost tiene mejor R² pero peor
error relativo — el R² premia ajustar bien los precios altos, mientras el MAPE
refleja lo que ve el usuario en cada predicción.

## Desglose por rango de precio (confirmación estratificada)

| rango USD/mes | n | MAPE RF | MAPE XGBoost |
|---|---|---|---|
| <400 | 46 | 23.76% | 27.67% |
| 400-600 | 88 | 17.95% | 23.60% |
| 600-800 | 127 | 13.30% | 19.16% |
| 800-1100 | 116 | 11.80% | 13.41% |
| 1100-1600 | 63 | 17.13% | 18.18% |
| >1600 | 63 | 19.01% | 17.02% |

## Conclusión

RF supera a XGBoost por MAPE en el global y se mantiene competitivo o mejor
en los rangos de precio. No pierde por > 3 pp en ningún tramo relevante.
**Random Forest confirmado** como modelo de producción.

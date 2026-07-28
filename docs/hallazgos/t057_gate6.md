# T057 — `gate6_seleccion_modelo.py` (correctitud)

**TARGET:** `app/backend/scripts/gate6_seleccion_modelo.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

La comparación RF vs XGBoost sobre el **mismo** `X_test`/`y_test` con la misma métrica (MAPE/MAE) es metodológicamente justa. Hay desalineación entre métricas calculadas en runtime y R² incrustado en el markdown generado.

---

## Hallazgos

### [INFO] · Mismo esquema de evaluación para ambos modelos · `gate6_seleccion_modelo.py:28-36` — mismas filas, `np.expm1` en predicciones y target. · Comparación apple-to-apple. · OK.

### [MEDIO] · R² en el reporte es constante, no se calcula · `gate6_seleccion_modelo.py:78-81` — `0.785` y `0.811` hardcodeados; MAPE/MAE sí se computan en líneas 38-40. · Si los `.joblib` cambian, el markdown puede contradecir MAPE runtime y engañar auditoría histórica. · Calcular R² en el script (`r2_score(real, pred_rf)`) o leer `resultados_test.csv`.

### [BAJO] · Fecha y decisión fijas en plantilla · `gate6_seleccion_modelo.py:67-69, 95-97` — siempre escribe "Random Forest confirmado" aunque `ganador` (línea 52) fuera XGBoost en una re-ejecución. · Re-ejecutar gate6 sin revisar el MD manualmente puede dejar documentación falsa. · Parametrizar conclusión con `ganador` y fecha `datetime.now()`.

### [BAJO] · Criterio único MAPE sin empate ni intervalo · `gate6_seleccion_modelo.py:52-53` — delta en puntos porcentuales sin test de significancia. · Delta pequeño (<1 pp) podría ser ruido. · Añadir bootstrap o regla de empate documentada.

---

## Veredicto

**Comparación justa en datos y métricas primarias.** El gap está en la **honestidad del artefacto markdown** (R² y conclusión estáticos).

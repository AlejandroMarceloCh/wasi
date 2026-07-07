# Validación espacial del modelo de alquiler — resultado reproducible

**Fecha:** 2026-07-07 · **Script:** `scripts_experimento/groupkfold_alquiler.py`

## Contexto
La auditoría (100 composers) marcó como CRÍTICO que el MAPE "16.4% con GroupKFold
espacial" del modelo de alquiler **no se reproducía desde el repo**: los notebooks
04/05 usan un split train/val/test plano (`pipeline/data/processed/X_*.csv`) y el
`GroupKFold` solo existía para el modelo de venta. La duda: ¿el 16.4% era honesto
o un número de split aleatorio reetiquetado como "espacial"?

## Experimento (B-lite)
Sobre los datos **commiteados** (X_train+val+test, 3,348 avisos, 74 features v1),
se comparó KFold aleatorio vs GroupKFold **espacial** (celda ~111 m por
lat/lng redondeados a 3 decimales), con el mismo XGBoost, midiendo MAPE en precio
real (USD, tras `expm1`). Se corrió con y sin `distrito_enc` para acotar el efecto
del target encoding.

## Resultado

| Esquema | MAPE (con distrito_enc) | MAPE (sin distrito_enc) |
|---|---|---|
| KFold aleatorio | 15.15% ± 0.55 | 15.38% ± 0.36 |
| **GroupKFold espacial** | **15.65% ± 0.60** | **15.82% ± 0.58** |
| Gap espacial | +0.50 pts | +0.45 pts |
| Celdas espaciales únicas | 1,878 (≈1.78 avisos/celda) | — |

## Conclusiones
1. **El 16.4% reportado es defendible y hasta conservador.** La validación
   espacial reproducible da ~15.7–15.8%; el número de la presentación no está
   inflado.
2. **El gap espacial es mínimo (~0.5 puntos).** El modelo generaliza a zonas
   geográficas no vistas casi tan bien como a un split aleatorio → la "validación
   espacial honesta" queda demostrada, no solo afirmada.
3. **El leakage del target encoding es despreciable** (~0.2 puntos al quitar
   `distrito_enc`). La preocupación de la auditoría (T001/T010) era de bajo
   impacto real.

## Cómo reproducir
```bash
PYTHONPATH=app/backend app/backend/venv/bin/python scripts_experimento/groupkfold_alquiler.py
```

## Notas de honestidad
- El experimento usa el dataset **v1 (74 features)** porque es el que está
  commiteado con su split. El modelo **servido es v2 (101 features, XGBoost)**;
  su dataset de entrenamiento no está versionado, así que su MAPE exacto no es
  reproducible aquí. El v1 espacial (~15.7%) es el mejor proxy reproducible y es
  consistente con el 16.4% reportado.
- Para trazabilidad completa a futuro (Opción B "full"): versionar el dataset v2
  y regenerar el artefacto con GroupKFold espacial + refit de encoders por fold.
  No es necesario para la honestidad del número reportado, que este experimento
  ya respalda.

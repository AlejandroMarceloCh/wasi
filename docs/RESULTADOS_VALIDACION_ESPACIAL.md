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

## B-full — versión v2 con encoding refit por fold (sin leakage)
Segundo experimento (`scripts_experimento/groupkfold_alquiler_v2.py`), más
riguroso: reconstruye el dataset desde el CSV limpio commiteado
(`data/inmuebles_alquiler_clean.csv`, 3,348 avisos, features geo ya enriquecidas)
y ajusta el **target encoding del distrito POR FOLD** (solo con el train de cada
fold → elimina por completo el leakage del encoding, el hallazgo "crítico" T001).
XGBoost al estilo v2 (489 árboles, depth 11).

| Esquema | MAPE |
|---|---|
| KFold aleatorio | 15.39% ± 0.60 |
| **GroupKFold espacial** | **15.79% ± 0.51** |
| Gap espacial | +0.40 pts |

Con el encoding refit por fold (cero leakage), el número **prácticamente no se
mueve** vs B-lite → confirma que el leakage del target encoding era despreciable,
y que la validación espacial da ~15.8%, consistente con el 16.4% reportado
(conservador).

## Cómo reproducir
```bash
# v1 (split committeado):
PYTHONPATH=app/backend app/backend/venv/bin/python scripts_experimento/groupkfold_alquiler.py
# v2-core (reconstruido, encoding por fold, sin leakage):
PYTHONPATH=app/backend app/backend/venv/bin/python scripts_experimento/groupkfold_alquiler_v2.py
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

---

## Adenda 2026-07-27 — el esquema v2 real, medido

Lo de arriba se escribió cuando el dataset v2 no estaba versionado y había que
usar proxies. Eso ya no aplica: el dataset se reconstruyó desde fuentes
commiteadas y el esquema v2 completo se midió de punta a punta.

**Qué faltaba (y por qué el proxy era necesario entonces):** ningún script del
repo generaba `modelo_final_v2.joblib` — los notebooks 04/05 son v1 (split
plano, producen `modelo_final.joblib`) y el dataset de 101 features nunca se
commiteó. Los dos experimentos previos corrían sobre subconjuntos: `B-lite` con
las 74 features v1, `B-full` con 65 reconstruidas. Ninguno con las 101 servidas.

**Qué se hizo:** `scripts/build_dataset_v2.py` reconstruye las 101 features
desde `data/inmuebles_alquiler_clean.csv` + `data/external/*` (OSM vía
`osm_lookup`, NSE/comisarías/denuncias vía `distrito_features`), y
`scripts/train_model_v2.py` las valida con los hiperparámetros leídos del propio
artefacto servido. Encoding e imputación se ajustan **por fold**.

| Métrica | Se reportaba | Medido (GroupKFold espacial) | Veredicto |
|---|---|---|---|
| MAPE | 16.4 % | **16.16 % ± 0.41** | fiel — se reportaba conservador |
| R² | 0.847 | **0.816** | estaba optimista (−0.031) |
| MAE | $159 | **$168** | estaba optimista (−$9) |
| RMSE | $298 | **$317** | estaba optimista |
| KFold aleatorio | 15.7 % | **15.50 %** | consistente |
| Gap espacial | +0.7 pts | **+0.66 pts** | consistente |

**Conclusión.** La sospecha de que el 16.4 % podía ser un número de split
aleatorio reetiquetado queda **descartada con evidencia**: el MAPE espacial real
del esquema v2 es 16.16 %, mejor que lo publicado. En cambio R², MAE y RMSE sí
estaban optimistas — nunca habían pasado por validación espacial, solo el MAPE.
Los cuatro se corrigieron en `ml.py`, `README.md` y `web/src/shared/lib/stats.js`.

**Lo que sigue abierto.** El artefacto servido concreto no es reevaluable
out-of-sample (se entrenó con todo el dataset y su split original se perdió), así
que lo medido es el **esquema**, no esa instancia. Para cerrarlo del todo hay que
promover un artefacto entrenado por este script — disponible con
`--fit-final`, que escribe en `models/v2/candidato/` sin tocar el servido. Esa
promoción cambia las golden predictions y es decisión del humano.

Reproducir:
```bash
PYTHONPATH=app/backend app/backend/venv/bin/python scripts/build_dataset_v2.py
app/backend/venv/bin/python scripts/train_model_v2.py
```

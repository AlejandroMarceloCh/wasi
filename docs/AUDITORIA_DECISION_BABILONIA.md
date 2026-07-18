# Auditoría de decisión — ¿Integrar Babilonia al modelo de venta?

**Fecha:** 2026-07-17
**Autor de la decisión:** (equipo Wasi)
**Estado:** PROPUESTA, pendiente de auditoría antes de ejecutar
**Alcance:** modelo de **venta** (`ventas_model/`). NO toca el modelo de alquiler ni su artefacto v2.
**Qué se audita:** la propuesta de **revertir el reentrenamiento con Babilonia** y servir el modelo entrenado solo con InfoCasas, dejando Babilonia como deuda de normalización.

> Objetivo de este documento: que un revisor externo pueda **refutar o confirmar** la decisión con evidencia reproducible. Está escrito para el escrutinio, no para defender una postura. Si algo no se probó, se dice. Las secciones §7 (límites) y §8 (preguntas) son el material de ataque.

---

## 1. Decisión propuesta (TL;DR)

**No integrar las filas de Babilonia al modelo de venta servido en su forma actual.** Servir el modelo entrenado solo con InfoCasas (MAPE espacial honesto **15.8%**), y tratar Babilonia como una fuente que requiere **normalización de área** antes de poder usarse. En paralelo, agregar al pipeline de venta el fail-fast (golden + manifest) que hoy no existe — esto es independiente de Babilonia.

**Razón central:** Babilonia no aporta "más datos" en el sentido útil; aporta una fuente con un **sesgo de medición sistemático** (precio/m² ~25% menor con áreas ~47% mayores, concentrado en distritos premium). El modelo la predice a **24.6% de error vs 15.9% en InfoCasas** (1.5× peor), y su inclusión degrada la métrica global (15.8% → 16.4%).

---

## 2. Contexto y cómo llegamos aquí

- El modelo de venta servido (`ventas_model/models/xgb_venta.joblib`) se entrenó originalmente con **6 271** avisos de **InfoCasas** → MAPE espacial **15.8% ± 0.7**.
- En un sprint previo se recuperaron **397** filas de **Babilonia** que un filtro de limpieza descartaba (bug: `cocheras` 100% NaN excluía todas las filas). La recuperación en sí es correcta.
- Al **reentrenar** con el dataset combinado (6 668 filas), el MAPE espacial subió a **16.4% ± 0.5**. Este documento investiga **por qué** y decide qué modelo servir.

Las dos fuentes:

| Fuente | Filas (clean) | Rol |
|---|---|---|
| InfoCasas | 6 272 | base histórica del modelo |
| Babilonia | 397 | recuperada recientemente |

---

## 3. Evidencia

### 3.1 Métricas de los dos modelos (validación honesta)

Ambos con la misma arquitectura (XGBoost, 400 árboles, `max_depth=5`, target `log1p(price_usd)`) y la misma validación: **GroupKFold espacial** (grupos = celdas de coordenada redondeada ~111 m) con **target encoding de distrito refit por fold** (sin fuga del target). Este esquema evita el leakage de "mismo edificio en train y test" que infla el split aleatorio.

| Modelo | Filas | MAPE aleatorio | **MAPE espacial (honesto)** | R² | MAE USD |
|---|---|---|---|---|---|
| Solo InfoCasas (actual servido) | 6 271 | 14.8% | **15.8% ± 0.7** | 0.856 | $43 234 |
| + Babilonia (reentrenado) | 6 668 | 14.3% | **16.4% ± 0.5** | 0.856 | $42 736 |

Observación: el reentrenado tiene **menor varianza** (±0.5 vs ±0.7) y MAE global algo menor, pero **peor MAPE espacial**. La contradicción MAE↓ / MAPE↑ es consistente con Babilonia aportando inmuebles de **mayor valor absoluto** (donde el error porcentual pesa distinto).

### 3.2 Distribución por fuente (dónde difieren)

Medianas y percentiles p10 / p90 sobre `clean_ventas.csv`:

| Variable | InfoCasas (med · p10 · p90) | Babilonia (med · p10 · p90) | Lectura |
|---|---|---|---|
| **precio/m² (USD)** | 2 099 · 1 441 · 2 932 | **1 575 · 818 · 3 002** | Babilonia ~25% más barato/m²; p10 implausible (818) |
| **área m²** | 97 · 53 · 230 | **143 · 60 · 368** | Babilonia ~47% más grande en mediana |
| precio USD | 201 140 · 98 000 · 515 388 | 212 000 · 69 960 · 772 000 | similar centro, cola más larga |
| dormitorios | 3 | 3 | igual |
| baños | 2 | 2 | igual |

**Distritos top de Babilonia:** Santiago de Surco (90), Miraflores (59), San Isidro (41), San Borja (17), Chorrillos (16), Cercado de Lima (14), Comas (13), Barranco (13).

El punto crítico: Babilonia se concentra en **distritos premium** (Surco, Miraflores, San Isidro, San Borja, Barranco) donde el precio/m² real de mercado es **> 2 000 USD/m²**. Un precio/m² mediano de **1 575** y un p10 de **818** en ese segmento es **anómalamente bajo**.

### 3.3 Dificultad del modelo por fuente (el número duro)

MAPE **out-of-fold** (GroupKFold espacial) desagregado por fuente, usando el modelo entrenado con ambas:

| Fuente | n | MAPE out-of-fold |
|---|---|---|
| InfoCasas | 6 274 | **15.9%** |
| Babilonia | 394 | **24.6%** |

Babilonia es **1.5× más difícil de predecir**. Sus 394 filas con ~24.6% de error arrastran el promedio global de 15.8% a 16.4%. No es ruido aleatorio de "más muestra": es un segmento con una relación precio↔área distinta de la del resto.

*(394 y no 397: 3 filas cayeron fuera del bbox de cobertura del índice geoespacial al construir features.)*

### 3.4 Imputación aplicada (para transparencia)

Babilonia no reporta `cocheras` ni `antiguedad_anios` (397 NaN cada una). Se imputaron con la **mediana** de cada columna sobre valores informados: `cocheras → 1`, `antiguedad_anios → 0`. La imputación **no** es la causa del deterioro (ver §7): el problema es precio/área, no estas dos columnas.

---

## 4. Hipótesis causal

**La más parsimoniosa:** Babilonia reporta **área total / de terreno** (o incluye áreas comunes) en lugar de **área construida/techada**, mientras InfoCasas reporta área construida. Esto:
- infla el m² (mediana 143 vs 97, **+47%**),
- deflacta el precio/m² (1 575 vs 2 099, **−25%**),
- y rompe la relación precio↔área que el modelo aprendió de InfoCasas → error alto (24.6%).

Es consistente con **todas** las señales de §3.2 a la vez, sin necesidad de otra explicación.

**Alternativas no descartadas** (ver §7): preventa/pozo (precios de lista bajos), remates/adjudicaciones, conversión de moneda (soles→USD) mal hecha, o geolocalización imprecisa que asigna inmuebles de distritos más baratos a etiquetas premium.

---

## 5. Opciones y trade-offs

| Opción | MAPE servido | Pros | Contras |
|---|---|---|---|
| **A. Revertir a solo-InfoCasas** (propuesta) | 15.8% | Mejor métrica; relación precio↔área coherente; reproducible | Sigue dependiendo de una sola fuente/scraper (riesgo de sesgo propio no detectado) |
| B. Servir el reentrenado (con Babilonia) | 16.4% | Segunda fuente; menor varianza de CV | Sirve un modelo peor; contamina predicciones de inmuebles grandes/premium con una relación precio↔área inconsistente |
| C. Normalizar Babilonia y reintegrar | por medir | Recupera señal premium/grande de forma legítima | Requiere entender el campo "área" de Babilonia; sin garantía de que converja; trabajo de datos |

**Recomendación: A ahora, C como deuda.** No se elige B porque la "diversidad de fuente" que ofrece es ilusoria: la fuente mide una variable (área) de forma distinta, así que mezclar introduce sesgo sistemático, no robustez.

---

## 6. Cómo se ejecutaría A (si se aprueba)

1. `ventas_model/clean_ventas.py`: excluir filas de Babilonia **por fuente**, con un comentario que documente el motivo (24.6% MAPE, precio/m² inconsistente) y un puntero a este documento. Así el pipeline `clean → features → train` **reproduce exactamente** el modelo servido de 15.8%.
2. Restaurar `ventas_model/models/xgb_venta.joblib` al artefacto de 15.8% (o regenerarlo desde el pipeline ya sin Babilonia — idealmente lo segundo, para que artefacto y pipeline coincidan).
3. Agregar **golden + manifest de venta** (fail-fast en arranque), que hoy no existe (a diferencia de alquiler). Esto es robustez del pipeline, **independiente** de la decisión Babilonia.

---

## 7. Límites de este análisis (dónde atacar)

Se declara explícitamente lo que **no** se hizo, para que la auditoría sea real:

1. **No se verificó manualmente** ningún aviso de Babilonia contra su fuente original (URL/scrape crudo). La hipótesis de "área total vs construida" es **inferencia estadística**, no confirmación por inspección. Podría ser otra causa (§4, alternativas).
2. **No se probó la prueba definitiva de la hipótesis:** normalizar el área de Babilonia (p.ej. reescalar por un factor, o recomputar precio/m²) y reentrenar para ver si el MAPE de Babilonia converge hacia ~16%. Si convergiera, confirmaría causa-área; si no, la hipótesis cae.
3. El **MAPE por fuente (24.6%)** se midió con el modelo entrenado con **ambas** fuentes. No se entrenó un modelo **solo-Babilonia** (n=394 es pequeño para CV espacial, pero daría una cota de "cuán auto-consistente" es Babilonia).
4. La exclusión propuesta es **por fuente** (frágil: acopla la limpieza a un metadato de scraping). Una regla **observable** —p.ej. descartar por `precio/m²` fuera de un rango robusto por distrito (z-score)— sería más general y atraparía outliers de InfoCasas también. No se evaluó si esa regla sola resuelve el problema sin mencionar la fuente.
5. No se auditó si **InfoCasas** tiene su propio sesgo de área/precio (se asume como referencia "correcta" sin verificarlo). Todo el argumento es *relativo* a InfoCasas.
6. `precio_m2` ya existe como columna en `clean_ventas.csv`; el filtro de limpieza (`precio_m2 ∈ [400, 6000]`) **no** excluyó a Babilonia, lo que confirma que sus precios/m² caen dentro del rango "plausible" global aunque sean anómalos **para su distrito**. No se probó un filtro de precio/m² **condicional al distrito**.

---

## 8. Preguntas para el auditor

1. ¿La hipótesis de **área total vs construida** es la más parsimoniosa dada la evidencia, o hay una explicación mejor que también cubra §3.2 completo?
2. ¿Es defendible excluir **por fuente**, o la limpieza debería basarse en un criterio **observable y general** (precio/m² z-score por distrito) que no dependa del metadato de scraping? ¿Cuál es más robusto a futuro?
3. ¿El **GroupKFold espacial** (celda ~111 m) es la validación adecuada para juzgar esta decisión, o hay un sesgo en cómo agrupa Babilonia (que se concentra en pocos distritos)?
4. ¿El deterioro 15.8→16.4 justifica descartar 394 avisos, o el valor de tener **señal de inmuebles grandes/premium** (aunque ruidosa) supera el costo? ¿Cómo se pesaría eso?
5. ¿Debería **bloquearse** la integración hasta correr la prueba de §7.2 (normalizar+reentrenar), o la evidencia actual ya es suficiente para decidir A?
6. ¿Sirve de algo un modelo **solo-Babilonia** o **con indicador de fuente** como feature (dejar que el modelo aprenda el offset por fuente) en vez de excluir?
7. ¿La imputación por mediana (`antiguedad→0`, `cocheras→1`) es apropiada, o debería usarse el manejo nativo de NaN de XGBoost / una columna indicadora?

---

## 9. Reproducibilidad

Todo lo anterior se reproduce desde la raíz del repo con el venv del backend (`app/backend/venv`):

```bash
# 1) Reentrenar con el dataset actual (incluye Babilonia) y ver MAPE espacial:
PYTHONPATH=src app/backend/venv/bin/python ventas_model/build_features_venta.py
app/backend/venv/bin/python ventas_model/train_venta.py           # imprime MAPE aleatorio y espacial
cat ventas_model/RESULTADOS.md

# 2) Distribución por fuente (§3.2) y MAPE out-of-fold por fuente (§3.3):
#    (script ad-hoc usado en la investigación; ver docs para el snippet exacto)
#    marca Babilonia por (lat,lng,price) contra clean_ventas.csv[fuente=='babilonia']
```

Artefactos y archivos relevantes:
- Datos: `ventas_model/data/clean_ventas.csv` (col `fuente`), `ventas_model/data/ventas_features.csv`
- Pipeline: `ventas_model/clean_ventas.py`, `build_features_venta.py`, `train_venta.py`
- Modelo servido: `ventas_model/models/xgb_venta.joblib` · reporte: `ventas_model/RESULTADOS.md`
- Serving: `src/wasi/models/venta_service.py` (constante `MAE_PCT` a actualizar según el modelo elegido)

---

## 9-bis. ADENDA — Resultado de la auditoría (2026-07-17)

Un auditor independiente refutó la recomendación A. **Veredicto: C reformulada.**
Se acepta íntegro. Correcciones a este documento:

- **Falla central (P0):** la comparación 15.8% vs 16.4% cambió la **población de test**.
  El 16.4% incorpora 397 filas de Babilonia, intrínsecamente más difíciles, así que el
  promedio sube por **composición, no por contaminación**. La prueba correcta es
  **pareada** (mismos folds, mismas filas de test InfoCasas, dos entrenamientos):
  **15.821% → 15.823% (+0.002 pp)** = esencialmente **cero**. Incluir Babilonia además
  **mejora** su propia predicción (29.15% → 24.64%, −4.51 pp). → "Babilonia contamina el
  modelo" queda **refutado**. Era el error de cambiar el denominador que este mismo doc
  advertía en §7 y no ejecutó.
- **Conteo (P1):** hay 6 669 filas limpias (6 272 InfoCasas + 397 Babilonia). La única
  fila fuera de cobertura es **InfoCasas**, no Babilonia. Mi "394 Babilonia en features"
  vino de un **matching frágil** (round lat/lng/price) → de ahí el gate de *provenance*.
- **Causa "área total vs techada" (P1):** es real en **algunos** avisos (inspección
  manual: 397/204 m², 146/73 m², 241/180 m²) pero **no sistemática** (otros 153/153). Un
  factor global NO sirve (reescalar ×0.85 mejoró Babilonia pero empeoró InfoCasas y el
  global). Mi §4 la presentó como causa única probable — incorrecto.
- **Muestra sesgada por el scraper (P1):** Babilonia toma hasta 20 resultados por combo
  precio×dormitorios → no es muestra aleatoria del portal. Por eso las **medianas
  marginales por fuente (§3.2) mezclan medición, ranking, composición y cobertura** y no
  son evidencia limpia de sesgo de área.
- **Validación (P2):** "GroupKFold espacial honesto" promete de más: la celda ~111 m
  bloquea el mismo edificio pero los folds mezclan barrios vecinos y no modelan cambio de
  fuente/distrito. Se necesita **holdout geográfico bloqueado** + métricas por
  fuente/distrito/área.

**Acción tomada (2026-07-17):** rollback conservador al artefacto de InfoCasas (15.8%),
que deja serving/artefacto/RESULTADOS consistentes. Es **cuarentena operativa** mientras
se cumplen los gates — **NO** una conclusión de que Babilonia empeora el modelo.

**Gates mínimos antes de decidir A o B (del auditor):**
1. **Contrato de área** — campo explícito (techada / total / ambos) en el scraper e input.
2. **Provenance** — propagar `fuente` e ID hasta `ventas_features.csv` (matar el matching frágil).
3. **Benchmark pareado** — mismos folds, mismas filas de test, dos entrenamientos (efecto causal).
4. **Holdout geográfico bloqueado** + métricas por fuente/distrito/área.
5. **Missingness** — ablación: NaN nativo de XGBoost vs mediana + columnas indicadoras.
6. **Serving seguro** — manifest (SHA-256) + golden + métrica DENTRO del bundle de venta (fail-fast), que hoy no existe.

---

## 10. Decisión final (a completar tras la auditoría)

- [ ] **Aprobada A** (revertir a InfoCasas, Babilonia como deuda) — ~~propuesta original~~, **refutada** (§9-bis)
- [ ] **Aprobada B** (servir el reentrenado con Babilonia; actualizar `MAE_PCT` a 16.4) — no como definitivo (faltan gates)
- [x] **Aprobada C reformulada** (rollback conservador a InfoCasas como cuarentena; cumplir los 6 gates antes de decidir A o B)
- [ ] Otra: __________

**Auditor:** independiente **Fecha:** 2026-07-17
**Comentarios:** ver §9-bis. Rollback ejecutado el 2026-07-17.

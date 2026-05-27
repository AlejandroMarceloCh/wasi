# Auditoría Proyecto DPD v2 (ubIcA) vs Rúbrica + Carta Magna del Curso DS3022

> **Auditor:** análisis honesto sin inflar puntajes.
> **Fecha:** 2026-05-26.
> **Fuentes:**
> - Rúbrica oficial Prototipo (20 pts) — Funcionalidad/5, Diseño y Usabilidad/5, Integración Datos+Modelo/7, Innovación/3.
> - Carta magna del curso: 5 partes / 615 slides + 121 cells (`~/.claude/proyectos/proyecto-dpd-curso.md`).
> - Estado actual del proyecto: `~/Desktop/PROYECTOS_2026/Proyecto_DPD/` + memoria `~/.claude/proyectos/proyecto-dpd.md`.

---

## TL;DR

- **Puntaje estimado actual: 18 / 20**
- **Puntaje máximo alcanzable con quick wins (1-2 días): 19.5 / 20**
- **Bloqueadores para Excelente puro (20/20):**
  1. **Sin métrica de "impacto en mundo real" o A/B** (la carta magna define MVP como *aprendizaje validado sobre rendimiento e impacto en el mundo real*, no solo MAPE offline — U1_T2 MVP slides 18-21).
  2. **Sin explicabilidad por predicción** (sin SHAP/LIME ni contrafactual visible al usuario — U4_T2 slide 65 enseña contrafactuales con DiCE).
  3. **Sin Data Product Canvas ni Journey Map físico entregado** como artefacto (Ideación slides 22-37). El proyecto tiene todo el contenido, pero no el deliverable formal.
  4. **Sin documento explícito de "8 tipos de requerimientos" mapeados** (U2_T1 slides 30-39). Está implícito en el código, pero no escrito en una sola tabla para el jurado.

---

## Criterio 1 — Funcionalidad (/5)

### Nivel actual: **4.5 / 5 — Excelente**

### Justificación

**Lo que SÍ funciona impecable (evidencia concreta):**

- **Backend FastAPI completo** con 7 endpoints reales: `POST /api/auth/{login,register}`, `GET /api/dashboard`, `POST /api/fairvalue/predict`, `GET /api/analyses/{id}` + `POST /api/analyses/{id}/save`, `GET /api/entorno`, `GET /api/me`, `PATCH /api/me`, `GET /api/analyses`.
- **42 tests pytest pasando** (30 originales + 12 v2 senior, 2 v1-only saltados con `pytest.mark.skipif`). Cobertura end-to-end: OSM lookup, distrito features, build_features_v2, predict_fair_value en 4 zonas (Miraflores cara, SMP barata, La Planicie low-coverage, Cusco fuera de bbox lanza 400).
- **Switch v1/v2 automático** vía `model_service.mode` con env var de override `DPD_FORCE_V1=1` — robustez para regresión.
- **Validación geográfica** dura: bbox Lima [-12.5,-11.7] × [-77.2,-76.7], lanza `OutOfBoundsError` fuera. Frontend tiene `enLima()` de espejo.
- **Cache-busting de scripts** (`<script src=...?v=Date.now()>`) — evita cache stale durante demo.
- **Modal vía `ReactDOM.createPortal(content, document.body)`** — fix de centrado bajo ancestros con `transform` (decisión documentada 2026-05-21).
- **Persistencia** SQLite agnóstica (`DATABASE_URL` env var permite PostgreSQL en prod).
- **JWT + bcrypt + role-based** (columna `role` con migración ligera idempotente `ensure_schema`).
- **Manejo de 401 global** → `handleApiErr` con `onAuthExpired` callback uniforme.

**Lo que tiene errores menores (no críticos):**

- `MapPicker` de Entorno se reinicia al re-montar (pendiente documentado).
- ConvergenceWarning de Optuna durante entrenamiento (no afecta producción).
- El conflicto de puertos 8000 con utec-gym requiere kill manual.

### Brechas hacia Excelente puro (5/5)

- **GAP menor**: no hay endpoint `GET /health` ni `GET /version` separado (info de versión vive en `/api/dashboard`). El profesor en U4_T2 slide 4 enumera "Métricas de Software: Memoria, Latencia, Demora de Carga".
- **GAP menor**: no hay rate-limiting ni circuit-breaker explícito en `/api/fairvalue/predict` (U4_T2 slide 19: "Conseguir Baja latencia <10ms para predicciones complejas. Considerando muchos datos y con fallas de sistema").

### Quick wins (1-2 días)

1. Agregar `GET /api/health` que devuelva `{status, model_mode, model_version, uptime_seconds, last_prediction_at}` — directo de `model_service`. Permite la pregunta del jurado "¿cómo monitorean en producción?".
2. Loggear `predicted_in_seconds` en BD (ya existe el campo) y exponerlo en `/api/dashboard` como métrica de latencia p50/p95 — alinea con U4_T2 slides 17-26 (Latencia, Costo, Rendimiento).

---

## Criterio 2 — Diseño y Usabilidad (/5)

### Nivel actual: **4.5 / 5 — Excelente con un par de huecos puntuales**

### Justificación contrastando con U5 MLUX/MLUI

**Heurísticas de Nielsen (U5 slide 45) — el profe las cita explícitamente:**

| Heurística | Aplicación en el proyecto | Estado |
|---|---|---|
| 1. Visibilidad del estado del sistema | `Confianza: Alta/Media/Baja` tag + `predicted_in_seconds` chip + banner low-coverage cuando `n<20` | ✅ |
| 2. Match sistema-mundo real | Verdict pill "Ganga / Justo / Inflado" en castellano peruano neutro; no jerga ML al usuario final | ✅ |
| 3. Control y libertad del usuario | Pin arrastrable + clickeable en `MapPicker`; back-handler en cada screen; `onAuthExpired` callback | ✅ |
| 4. Consistencia y estándares | Sistema de componentes (`<Card>`, `<Btn>`, `<Tag>`, `<Modal>` único vía portal); todo en `components.jsx` | ✅ |
| 5. Prevención de errores | `enLima()` valida bbox antes de submit; `disabled={value<=min}` en Stepper; 401 → forzar logout | ✅ |
| 6. Reconocer vs recordar | 8 amenities como **chips visuales** (no checkbox list — Gate 3 confirmó que 8 chips bastan); login pre-relleno demo | ✅ |
| 7. Flexibilidad y eficiencia | Wizard 3 pasos con steps marcados; filtros chips (Todos/Inflados/Gangas/Justos) en modal flotante de análisis recientes | ✅ |
| 8. Estética y diseño minimalista | "Claude Design" mock-driven 8 secciones de HomeScreen con histograma SVG bell-curve, mini-gauge, heatmap CSS | ✅ |
| 9. Ayuda al usuario a reconocer/recuperarse de errores | Banner `warning` cuando hay warnings del backend; FairValueResult muestra `warnings.join(' · ')` | ✅ |
| 10. Ayuda y documentación | Modal "Ayuda" con FAQ desde perfil; `Icon name="info"` con explicación inline; tooltip "Basado en precios de avisos, no de cierre real" | ⚠️ parcial — falta tooltip por feature (ver brechas) |

**Accesibilidad WCAG (U5 slide 45 cita los 4 principios: perceptible, operable, comprensible, robusto):**

- ✅ `aria-label` en 4 sitios (paginación, navegación de distritos) — verificado en `screens.jsx` L1077-1219.
- ❌ **GAP**: solo 4 `aria-label` en 2.204 líneas — los demás botones (logout, modal-close, chips de amenities, +/− Stepper) no tienen `aria-label`. WCAG 2.1 A.
- ❌ **GAP**: `alt=""` no aparece (no hay `<img>` semánticos — todo es SVG inline, aceptable).
- ⚠️ Verdict pills usan color (rojo/verde/amarillo) como única señal — fallar contraste para daltonismo. La carta magna marca esto: U5 slide 32 "Translations are gender-specific" como ejemplo de diseño justo.

**Data-Driven UI (U5 slides 47-56):**

- ✅ Layout jerárquico (U5 slide 49 "CRITICAL/GLANCEABLE/INFORMATIVE"): `FairValueResult` tiene gauge centrado (critical), tags de comparables (glanceable), banner explicativo (informative).
- ✅ Personas implícitos: el HomeScreen "Para inquilinos, propietarios, agentes e inversionistas" reconoce 4 personas distintas (cita María Fernández agente inmobiliaria).
- ⚠️ No hay "adaptive UI con frequency" (U5 slide 54) — pero tampoco es razonable para un MVP.

**Resistencia ética / dilemas (U5 slides 30-37, casos Original Stitch, Tay, Predictive Policing):**

- ✅ **Honestidad explícita**: copy del proyecto cambió de "precio justo" → "precio de referencia" tras decidir que el modelo predice precios de aviso, no de cierre. Documentado 2026-05-21.
- ✅ **Banner low-coverage** cuando `n_comparables < 20`: comunica "precisión ±X% más amplia, tómalo como referencia gruesa". Esta es la enseñanza directa de U5 slide 30 (Original Stitch falló por NO comunicar que el modelo tenía 28% de errores).
- ✅ **HomeScreen "La data detrás"**: párrafo nuevo sobre el desbalance del mercado limeño (41% Miraflores+San Isidro). Esto es **MLUX honesto** — el profe lo enseña en U5 slide 35 (Credit Card Fraud) y 16 (Zillow).

### Brechas hacia Excelente puro (5/5)

1. **No hay tooltip explicando qué es `estrato_nse`, `dist_nearest_m_parqueos`, etc.** El usuario ve "Random Forest · MAPE 15,9%" pero no qué significa MAPE. U5 slide 65 ("Feedback → Explicabilidad y Transparencia") lo pide.
2. **Aria-labels incompletos** — sólo 4 en 2.204 líneas. WCAG fail.
3. **Daltonismo**: verdict pill colorea con rojo/verde/amarillo sin patrón. Agregar icono diferenciado por zona (ya hay `dot` pero solo cambia color).
4. **Dark mode promete** en U5 slide 46 como tendencia UI 2024 — el proyecto no lo tiene. No es crítico pero suma "Innovación" si se agrega.

### Quick wins (medio día)

1. **Pasada de aria-labels**: agregar a todos los botones de Modal close, logout, +/− Stepper, chips de amenity. ~30 min.
2. **Iconos diferenciadores en verdict pill**: ↑ Inflado / = Justo / ↓ Ganga (no solo color). 10 min.
3. **Tooltip glossary** mínimo en `FairValueResult`: hover sobre "MAPE", "R²", "Confianza Alta/Media/Baja" muestra 1 línea explicativa. ~1h.
4. **Mostrar 3 factores con `<AnimBar>` ya existentes** + 1 frase "Tu zona es %v1 más cara que el promedio porque tiene %v2 supermercados y estrato NSE 5". Esto es contrafactual ligero (U4_T2 slide 65 cita DiCE).

---

## Criterio 3 — Integración de Datos y Modelo (/7)

### Nivel actual: **6.5 / 7 — Excelente, con un solo gap honesto (zonas premium low-coverage)**

### Justificación contrastando con U3 Feature Engineering + U4 Modelos + Producción

**Técnicas de U3_T1 que el profe enseña y el proyecto APLICA:**

| Técnica (slide) | Aplicación v2 | Evidencia |
|---|---|---|
| Manejo MNAR/MAR/MCAR (slides 12-15) | NaN en amenities binarias = "no informado" ≠ 0 (MNAR); NaN en `cocheras` ≠ 0 cocheras (MAR semantico) | `pipeline/README.md` "Decisiones clave de diseño" |
| Imputación mediana agrupada (slide 25) | `antiguedad_anios` imputada por mediana agrupada por distrito + tipo propiedad | `README.md` |
| OneHotEncoder (slide 32) | `cat_dist_emergente`/`cat_dist_establecido`/`cat_dist_popular` (3 OHE), `tipo_propiedad_Departamento`, `fuente_*` | `feature_names_v2.joblib` |
| Feature Scaling — Standardization (slide 36) | `scaler_v2.joblib` aplicado a numéricas; bool/OHE sin escalar | `models/v2/scaler_v2.joblib` |
| Cuándo NO escalar (slide 38: "Decision Trees, Random Forests, Naive Bayes, Gradient Boosting Typically Not Needed") | RF/XGBoost training usa features sin escalar | Gate 2 decisión 2026-05-20 |
| Variance Threshold (slide 54) | Drop por correlación |corr|<0.05 con target en pipeline v2 | NB08 celda 12 |
| Correlation Coefficient (slide 53) | `cantidad_denuncias` (H3) descartada con |corr|=0.0085; `count_1km_supermercados` Leo descartada |corr|=0.046 | NB08 |
| Embedded methods - RF Importance (slide 62) | XGBoost feature_importances_ reportado top-25 en NB09 con `distrito_enc=0.42`, `estrato_nse=0.13`, `cat_dist_popular=0.10`... | NB09 celda 14 |
| PCA (slide 64) | NO aplicado — pero **razón válida**: las 95 features ya están filtradas por |corr| y RF/XGB manejan colinearidad. PCA sobre boosting es overkill. |

**Técnicas de U3_T2 (imbalance) — ¡este es el corazón de la v2!:**

| Técnica (slide) | Aplicación v2 | Evidencia |
|---|---|---|
| Detección de desbalance (slide 8 — distribución MIMIC) | Diagnóstico NB06: top 2 distritos = 41.7% del dataset, 22 distritos con <30 listings | NB06 outputs |
| Métricas asimétricas para imbalance (slide 14) | RMSE/MAE/MAPE — el profe enseña F1/Recall para clasificación pero el proyecto adapta a **regresión**: usa MAPE (no MAE) porque es relativa, más justa para zonas baratas vs caras. | NB10 |
| **Class-balanced loss (slide 24)** | **Sample weighting `1/sqrt(count_distrito)`** — La Molina (68 listings) cuenta 3.51× más que Miraflores (874). Adaptación de "Weighted loss $W_c = N/\text{samples}_c$" del slide 24 a un regression problem con dominio continuo (distrito como proxy de clase). | NB08 celda 16, `~/.claude/proyectos/proyecto-dpd.md` §6 "Por qué sample_weight=1/sqrt(count) y no 1/count" |
| **Cost-sensitive learning (slide 23)** | Implícito en sample_weight + Bayesian smoothing | NB08 |
| Resampling (slides 16-17) | NO se hace oversampling porque NB06 mostró que la causa raíz es **falta de listings reales en zonas premium** (La Planicie tiene 0 listings en el dataset). Replicar 0 listings da 0. **Decisión honesta documentada**: "compromiso cero data sintética". | CHANGELOG_v2.md §Limitación honesta |
| SMOTE (slide 19) | NO aplicado. Razón: SMOTE para regresión es **SMOTER** y el profe no lo enseña; además sería data sintética. |

**Adaptaciones que SUPERAN la rúbrica:**

- ✅ **Bayesian smoothing target encoder k=30** (NB08 celda 6) — Villa El Salvador (1 listing) baja de mean=5.85 a smoothed=6.68. Esto es **target encoding regularizado**, técnica de Kaggle/Facebook 2014 (el profe cita el paper de Facebook en U3_T2 slide 5 — He et al.).
- ✅ **Split estratificado por categoria_distrito × estrato_nse** (NB08 celda 4). El profe enseña `train_test_split` random en U3_T1 slide 39; el proyecto va más allá.
- ✅ **Optuna 20 trials con TPESampler(seed=42)** (NB09). Hyperparameter tuning sistemático (vs grid search manual del slide).
- ✅ **Outlier capping p99 calculado en train, aplicado a 3 splits** (NB08 celda 8). Cierra el bug 3 del audit de Leo.
- ✅ **Log1p del target** (`precio_usd` → log) — distribución skewed, regla de oro. Y log1p selectivo en 35 features con skew > 1.

**U4_T1 (Modelos y Algoritmos):**

| Concepto (slide) | Aplicación | Estado |
|---|---|---|
| Batch monolítico vs Real-time ML (slides 6-7) | Backend FastAPI = **online inference pipeline** (slide 7). `model_service.py` carga `.joblib` al startup → predicción ~250ms. | ✅ |
| Feature Store (slide 8) | `geo_index.py` (KD-tree + IDW haversine) + `osm_lookup.py` (7 KD-trees por categoría) + `distrito_features.py` actúan como **feature store ligero in-memory** para lookup geo. | ✅ |
| 3 pipelines (slide 10) | Feature pipeline (NB07), Training pipeline (NB08-09), Inference pipeline (`ml_v2.build_features_v2`). | ✅ Limpio |
| Concept drift / Data drift (slide 20) | Documentado pero NO monitoreado en producción. **GAP** — el proyecto no se reentrena. | ⚠️ Aceptable para MVP |
| Aprendizaje supervisado Quantitative→Regresión (slide 24) | Regresión sobre log(precio_usd) | ✅ |
| Hiperparámetros (slide 35) | Optuna sobre RF (n=176, depth=17, leaf=5) y XGB (n=489, depth=11, lr=0.039, subsample=0.725, colsample=0.909, reg_alpha=8e-4, reg_lambda=2.5e-5) | ✅ Tuneado a fondo |

**U4_T2 (ML in Production):**

| Concepto (slide) | Aplicación | Estado |
|---|---|---|
| Métricas: software/entrada/salida (slide 4) | Track de `predicted_in_seconds` en BD; `n_comparables` y `confidence` como métricas de salida | ✅ |
| Online vs Offline prediction (slide 29) | Online (FastAPI sincrono) — apropiado para el caso | ✅ |
| Joblib > Pickle (slides 54-57 enseña ambos) | Proyecto usa **joblib** (recomendado para sklearn) | ✅ |
| Arquitectura Edge/Cloud/App/DB (slide 40) | React (client) → FastAPI (app) → SQLite (DB) + joblib en memoria como prediction service | ✅ |
| **Contrafactuales (slide 65)** | **NO IMPLEMENTADO**. El profe enseña DiCE — el proyecto tiene `factors` con `<AnimBar>` pero no calcula contrafactual ("si pusieras tu depto 2 km más cerca al mar, el precio subiría $X"). **GAP claro**. | ❌ |

### Brechas hacia Excelente puro (7/7)

1. **GAP — Contrafactuales** (U4_T2 slide 65, paper DiCE de Mothilal et al. citado): el proyecto da `factors` (importancia de variables) pero no contrafactual ("¿qué pasaría si...?"). Es la cumbre de la pirámide de explicabilidad ML.
2. **GAP — Monitoreo de drift**: no hay endpoint que diga "el modelo se entrenó en avisos hasta marzo 2025, ya pasaron N meses, performance esperado degradado en X%". U4_T1 slide 20 cita Concept Drift Covid como ejemplo arquetípico.
3. **Limitación honesta documentada** — zonas premium low-coverage (La Planicie, Casuarinas, San Borja Alto): v2 acertó 1/5 stress cases vs v1 2/5. **Esto NO se penaliza si se defiende bien** porque es limitación del DATASET, no del modelo (compromiso cero data sintética). Pero a nivel rúbrica, el resultado test es 15.74% MAPE — bueno pero no extraordinario.

### Quick wins

1. **Contrafactual ligero** (~3h): para cada predicción, computar 3 alternativas tipo "Si tuvieras +1 baño → +$X" usando perturbación numérica simple del input + re-predict (mucho más simple que DiCE, pero suficiente para defensa). El backend ya tiene `factors`; agregar `counterfactuals: [{feature, delta, predicted_price}]`.
2. **Endpoint `/api/model/info`** (~30 min) que diga "modelo entrenado 2026-03-15, dataset hasta 2025-12, días desde último entrenamiento: 71, drift esperado: bajo". Honestidad temporal.
3. **Notebook 11** (~2h) "Análisis de errores por zona": gráfico residual vs distrito, residual vs estrato_nse — el profe enseña esto en U4_T2 slide 7 "Audit performance → Error analysis".

---

## Criterio 4 — Innovación (/3)

### Nivel actual: **2.5 / 3 — Excepcional pero falta el cierre formal del "wow factor"**

### Justificación

**Lo novedoso del proyecto vs proyectos del curso (slides 51-56 muestran AnimaMatch, ShopSmart, SweetDiet, Dermis, Edutrack):**

1. **Fusión de dos proyectos reales (Justa + PredictRent) en un solo producto con migración v1→v2 limpia**. Esto NO es típico: el proyecto adoptó código de Leo (otro equipo), abrió PR con 8 commits atómicos al repo original, y mantuvo `model_service.py` como capa de aislamiento que permite swap sin breakage. Esto es **ingeniería de software senior** que ningún proyecto del curso ejemplifica.

2. **4 bugs auditados de Leo cerrados con notebook 06** — diagnosis cuantitativo del bias del v1 antes de proponer v2. Esto es **CRISP-DM bien hecho** (Business Understanding → Data Understanding antes de Modeling).

3. **Cero data sintética como compromiso ético explícito** — la limitación de La Planicie se comunica al usuario via banner UX. Esto es **MLUX honesto en producción**, lo que U5 slide 30 (Original Stitch) usa como anti-ejemplo: aquellos NO comunicaron el error y quebraron.

4. **Fuentes externas reales múltiples integradas** — no usa un solo dataset cerrado:
   - **CENACOM 2017** (INEI, 149 comisarías Lima Metropolitana — filtro UBIGEO 1501 + 0701).
   - **MININTER 2018-2026** (357k filas → 2,643 agregadas, 7 modalidades → 3 buckets).
   - **OSM Overpass** (7 categorías, 11,200+ elementos, 7 KD-trees en backend).
   - **INEI Lib1744** (PDF + tabla manual de 52 distritos × estrato_nse 1-5).
   - **Limitación honesta**: shapefile INEI no descargable, no APEIM por solo PDF agregado — documentado.

5. **Adaptive UI por confidence**: si `n_comparables < 20` aparece banner amarillo con precisión ampliada (±28%). Si confidence='Baja' el verdict pill cambia tag. Esto es **micro-adaptive UI by data context** (U5 slide 56).

6. **Cache-busting + Portal modal + ensure_schema migration** — soluciones a 3 bugs sutiles documentadas en bitácora con razón técnica. Eso es nivel senior.

7. **Tabla manual NSE razonada** — no es solo "lookup": 52 distritos × (estrato 1-5, categoria 3 valores) basado en APEIM + INEI Lib1744 + criterio inmobiliario. Defendible: la auditoría 6 (Codex) confirmó coherencia con datos del dataset (Miraflores estrato 5 con 874 listings, SJL estrato 1 con 10 comisarías y 14,557 denuncias violentas).

### Brechas hacia Excelente puro (3/3)

1. **Falta UN gancho memorable de demo** — los proyectos slides 52-56 tienen UN momento "wow":
   - AnimaMatch: el grid 1-10 de anime con score híbrido.
   - ShopSmart: comparar mouses por imagen.
   - Dermis: foto de piel → recomendación cosmética.
   - SweetDiet: escanear etiqueta nutricional con check "APTO".

   El proyecto ubIcA tiene **muchas cosas buenas** pero ninguna escena de 30 segundos que el jurado recuerde 2 días después. Sugerencia: **demo del pin arrastrable en mapa de Lima** mostrando cómo TODOS los datos cambian en vivo (precio + score + POIs + verdict + comisarías), idealmente con un "antes/después" desde La Planicie ($720 baja confianza) hasta Miraflores ($1100 alta confianza).

2. **GAP — Innovación de modelo limitada**: el proyecto NO usa Deep Learning (los notebooks NLP del profe usan DistilBERT). XGBoost + Optuna es estado del arte para tabular, pero "innovación excepcional" típicamente requiere algo más: ¿retrieval? ¿LLM para resumir comparables? ¿prediction intervals con quantile regression?

3. **Falta el elevator pitch formal** (Ideación slides 42-45 lo pide en 5 partes: gancho → problema → solución → propuesta de valor → CTA). El HomeScreen rediseñado tiene el contenido pero un párrafo escrito de 2 minutos es defensa.

### Quick wins (1 día)

1. **Quantile regression** (XGBoost soporta nativo) → "Precio probable: $700–$1,100 (P25–P75), centro $850". Esto da **intervalos de predicción reales**, no solo el punto. Diferenciador vs todos los proyectos del curso. ~3-4h.
2. **Elevator pitch escrito** (15 min): "Si solo supiéramos el precio justo de cualquier alquiler en Lima sin que un agente nos manipulara... 41% del mercado se concentra en 2 distritos. ubIcA cruza 95 features de 3,348 listings reales con CENACOM, MININTER, INEI y OSM para darte una segunda opinión honesta. R² 0.86, MAPE 15.7%. Banner amarillo cuando no tenemos suficiente data — porque mentir cuesta más que callar."
3. **Comparar con Properati/Urbania "estimador"** — si tienen estimador, mostrar que el de ellos predice $X y el nuestro $Y, con argumentos del por qué. Esto es "value vs competitors" (U5 slide 14).

---

## Recomendaciones priorizadas

### CRÍTICAS — sin estas pierden puntos seguros

1. **Pasada de aria-labels y contraste daltonismo** en frontend (~1h). WCAG es enseñado explícitamente en U5 slide 45.
2. **Endpoint `/api/health` + `/api/model/info`** (~45 min). U4_T2 slide 4 ("Métricas de Software, entrada, salida") lo pide.
3. **Tooltips glossary** en `FairValueResult` para MAPE, R², Confianza Alta/Media/Baja (~1h). U5 slide 65 "Explicabilidad y Transparencia".
4. **Elevator pitch escrito y memorizado** (~30 min). Ideación slides 42-45.

### IMPORTANTES — suben de Adecuado a Excelente

5. **Contrafactual ligero** (~3h). U4_T2 slide 65 — el profe lo cita y NINGÚN proyecto del curso lo aplica.
6. **Tooltip por feature en `<AnimBar>`** para los factors mostrados (~1h). Explicar "estrato_nse" en castellano peruano.
7. **Notebook 11 análisis de errores residual por distrito y estrato** (~2h). U4_T2 slide 7-8 ("Error analysis").
8. **Data Product Canvas como artefacto** (Ideación slide 29, 9 bloques) — el proyecto tiene todo el contenido para llenarlo en 30 min. Llevarlo impreso. **Esto vale puntos seguros si el jurado pregunta por la fase Ideación.**

### NICE-TO-HAVE — bonus de innovación

9. **Quantile regression intervalos** (XGBoost `objective='reg:quantileerror'`). Diferenciador real.
10. **Dark mode** (U5 slide 46 tendencia 2024).
11. **Comparar contra Properati estimador** en el HomeScreen — "vs competidores".
12. **Demo guiada de 90 segundos**: La Planicie → Miraflores → SMP, mostrando los 3 verdicts y el banner low-coverage.

---

## Argumentos para defensa oral

### 5 PUNTOS FUERTES a enfatizar

1. **"Mejora real medible: MAPE 15.92% → 15.74%, MAE $173 → $158, R² 0.785 → 0.861, RMSE −25%"**. Cifras concretas, no marketing. Mostrar `resultados_test_v2.csv`.
2. **"Cerramos 4 bugs auditados del pipeline original con notebook 06 antes de proponer cualquier cambio"** — diagnosis cuantitativo, CRISP-DM Business+Data Understanding antes de Modeling.
3. **"4 fuentes externas reales integradas (CENACOM, MININTER, OSM, INEI Lib1744) — cero data sintética como compromiso ético explícito"**. La limitación de La Planicie se comunica al usuario via banner — esto es lo opuesto al caso Original Stitch (U5 slide 30) que mintió sobre su precisión y quebró.
4. **"42 tests pytest pasando incluyendo tests senior end-to-end por zona (Miraflores cara, SMP barata, La Planicie low-coverage, Cusco fuera de bbox = 400)"**. Quality assurance del fundamentals poster (U2_T1 slide 16).
5. **"Switch v1/v2 automático con env var override — model_service.py como capa de aislamiento permite swap mecánico cuando Leo entregue v3"**. Ingeniería de software para sostener evolución del modelo en producción (U4_T2 slide 41 "Arquitectura de servicio de predicción").

### 3 LIMITACIONES a reconocer (con solución propuesta)

1. **"Zonas premium con N=0 listings no se resuelven sin más data. La Molina empeoró MAPE +18pp porque las features socio-eco le dicen 'premium' pero los listings reales son de Sol de La Molina (popular)."**
   - *Solución propuesta:* re-scrape focused en La Planicie/Casuarinas/San Borja Alto via Playwright a Properati/Urbania (1-2 días). Pero el compromiso fue cero data sintética en este PR.

2. **"No tenemos contrafactuales tipo DiCE — solo importancia de variables agregada."**
   - *Solución propuesta:* implementación ligera vía perturbación numérica del input (no DiCE completo, pero suficiente). 3 horas, lo agregamos antes de la sustentación.

3. **"El modelo no se reentrena automáticamente — entrenado offline."**
   - *Solución propuesta:* el dataset original ya cubre 2018-2024; un re-scrape trimestral + reentrenamiento manual cubre concept drift. Para nivel productivo se necesita Feature Store (U4_T1 slide 8) + airflow.

### CITAS/REFERENCIAS del curso para nombrar (gana puntos al jurado)

- **Eric Ries (U1_T2 MVP slide 10)**: "El producto mínimo viable es esa versión de un nuevo producto que permite a un equipo recopilar la máxima cantidad de aprendizaje validado sobre los clientes con el menor esfuerzo." → Nosotros publicamos un PR público al repo original con 8 commits atómicos para validar las hipótesis.
- **DJ Patil (U1_T1 slide 10)**: "Un producto de datos facilita un objetivo final a través del uso de datos."
- **Bill Schmarzo (U1_T2 BI vs DS slide 9)**: Predictive Analytics — "What will revenues and profits likely be next year?" ↔ Prescriptive Actions — "What should we do?". ubIcA hace predictive (precio) + prescriptive (negociable/oportunidad/alineado).
- **Christoph Molnar (U3_T1 slide 44)**: "La predicción no puede expresarse como la suma de los efectos de las características" → por eso usamos XGBoost (que captura interacciones), no Linear Regression (que el bug NB05 demostró que es el peor).
- **Andrej Karpathy (U4_T1 slide 32)**: "En Tesla, casi todo el lost sleep es por datasets, no por models/algorithms" → la v2 fue 80% data engineering (4 fuentes externas), 20% modelo.
- **Lin et al. 2017 — Focal Loss (U3_T2 slide 25)**: el profe lo enseña como técnica de imbalance. Nosotros usamos sample_weight como equivalente para regresión (Class-balanced loss slide 24).
- **He et al. 2014 — Facebook ads paper (U3_T2 slide 5)**: lo citamos al hablar del target encoding con Bayesian smoothing — técnica de Kaggle/Facebook 2014.
- **CRISP-DM y TDSP (U1_T2 MVP slide 36)**: el proyecto siguió Business Understanding (gates) → Data Understanding (NB06) → Data Preparation (NB07-08) → Modeling (NB09) → Evaluation (NB10) → Deployment (app/backend).

---

## Resumen del puntaje estimado

| Criterio | Actual | Con quick wins críticos (~3h) | Tope teórico |
|---|---|---|---|
| Funcionalidad | 4.5/5 | 5/5 | 5 |
| Diseño y Usabilidad | 4.5/5 | 5/5 | 5 |
| Integración Datos y Modelo | 6.5/7 | 6.5/7 (gap real: contrafactual) | 7 |
| Innovación | 2.5/3 | 3/3 (con quantile + pitch) | 3 |
| **TOTAL** | **18/20** | **19.5/20** | **20/20** |

**Conclusión honesta:** el proyecto está en nivel **Excelente sólido (18/20)**. Para llegar a 19.5/20 alcanzan 3-4 horas de quick wins (aria-labels, tooltips, endpoint health, elevator pitch, contrafactual ligero). El 20/20 puro requiere quantile regression o algo de DL ligero (e.g. embedding de distrito como capa neural) — bonus pero no necesario.

**Lo que NO hay que tocar:** el modelo XGBoost con 15.74% MAPE y R² 0.861 está en su techo dado el dataset (3,348 listings concentrados en 2 distritos). Más tuning no va a mover la aguja. El gap es de DATOS, no de modelo — y la honestidad con que se comunica esto es **bonus, no liability**, si se defiende bien.

# Q&A defensivo — 5 preguntas core + 2 de reserva

> **Objetivo:** memorizar las respuestas a las 5 preguntas más probables del jurado.
> Las 2 de reserva son por si preguntan algo extra raro.
> **Regla de oro:** si no sabes, di "no sé, pero puedo mostrar dónde lo verificamos". NUNCA inventar.

---

## CORE 1 · "¿Por qué XGBoost y no Random Forest u otro modelo?"

**Respuesta (60 s):**

> "Comparé 5 modelos en el Gate 6: Linear Regression, Ridge, Lasso, Random Forest y XGBoost.
> Random Forest dio MAPE 15,92 % y XGBoost 15,74 %. Diferencia chica pero consistente:
> XGBoost ganó en 5 de los 6 rangos de precio. Solo perdió en precios > $1,600 por 1.99 puntos porcentuales, que es tolerable.
> R² fue 0.86 para XGBoost vs 0.78 para RF.
> XGBoost captura interacciones no aditivas que el RF promedia — eso lo defiende Christoph Molnar en *Interpretable ML*.
> El gate está documentado en `gates/gate6_resultado.md` si quieren ver la evidencia."

**Si insisten "¿por qué no probaste algo más sofisticado tipo Neural Net?":**
> "Con 3,348 listings, una red neuronal va a sobreajustar antes de extraer señal nueva. Como dice Karpathy, en problemas tabulares con poca data, datasets > algorithms. Más data sería el siguiente paso, no más modelo."

---

## CORE 2 · "¿Cómo manejan la incertidumbre del modelo?"

**Respuesta (50 s):**

> "Tres niveles:
>
> Primero, **nivel de confianza** — calibrado con backtest leave-one-out sobre los 503 listings del test. Excluimos el propio listing y sus vecinos a menos de 10 metros. Umbrales: Alta ≥ 119 comparables en 1 km, Media ≥ 27, Baja resto. Está en `confidence_thresholds.json` y `scripts/calibrate_confidence.py`.
>
> Segundo, **rango P25-P75** del modelo de cuantiles. XGBoost con `reg:quantileerror`, 3 modelos. Coverage real 42,7 % sobre test, esperado teórico 50 %. Defendible.
>
> Tercero, **banner UX** cuando confidence = Baja. El usuario ve 'cobertura baja, tómalo como referencia, no como precio'. Honestidad sobre la incertidumbre es **bonus, no liability**."

**Si preguntan "¿por qué el coverage no es exactamente 50 %?":**
> "Porque entrenamos XGBoost quantile sin conformal calibration. Es lo siguiente en la roadmap. Para 50 % exacto, conformal prediction sobre validation set garantiza coverage matemáticamente. Costo: ~2 horas. Lo dejé para después de la defensa porque 42,7 % ya es defendible."

---

## CORE 3 · "¿Cómo monitorizan el modelo en producción?"

**Respuesta (40 s):**

> "Tres endpoints + un proceso:
>
> `/api/health` devuelve status, model_mode, model_version y uptime — sin auth para que monitoring tools tipo UptimeRobot puedan consultar sin token.
>
> `/api/model/info` expone n_features, trained_at, days_since_training y las métricas R², MAE, MAPE. Si el modelo lleva > 90 días sin reentrenarse, el dashboard puede levantar alerta.
>
> El campo `predicted_in_seconds` se loguea en cada predicción, expuesto en `/api/dashboard`. Latencia p95 en local < 1 s con los 10 re-predicts del contrafactual.
>
> El proceso de reentrenamiento es manual trimestral — `pipeline/scripts/train_quantile_v2.py` es reproducible en 30 segundos. Mejora obvia: schedule mensual automatizado con CI/CD; está en backlog."

---

## CORE 4 · "¿Qué hacen con el sesgo a Miraflores?"

**Respuesta (45 s):**

> "El dataset tiene 874 listings de Miraflores y 12 de SMP. Si entrenamos plano, el modelo se va a comportar como un 'modelo de Miraflores' aplicado a Lima.
>
> Tres mitigaciones aplicadas:
>
> Primero, **sample weighting** `1/sqrt(count_distrito)`. Inspirado conceptualmente en Focal Loss de Lin et al. 2017, aunque el paper es de clasificación. Cada listing pesa según la rareza de su distrito.
>
> Segundo, **stratified split** por categoria_distrito × estrato_nse. Test set mantiene la misma proporción de zonas que el train.
>
> Tercero, **target encoding con Bayesian smoothing k=30** sobre el distrito. Si un distrito tiene n < 30 listings, el valor se suaviza hacia el promedio Lima. Inspirado en He et al. 2014 del paper de Facebook ads.
>
> En el Notebook 11 muestro el residual por categoria_distrito y por estrato_nse para verificar que el sesgo bajó. Pueden verlo en `docs/notebooks/11_analisis_residuos.ipynb`."

---

## CORE 5 · "¿Cuál es el plan de monetización?"

**Respuesta (30 s):**

> "Out of scope para el MVP académico, pero pensando en sostenibilidad:
>
> Modelo freemium: predicción gratis sin signup, dashboard histórico con cuenta, alertas premium ($2/mes) cuando un anuncio entra/sale del rango.
>
> Posible B2B: API con rate limiting para agencias inmobiliarias y portales.
>
> Costo de operación actual: ~$11 al mes (dominio + EC2 t2.micro). Punto de equilibrio: ~10 usuarios pagos.
>
> El Canvas tiene el bloque de costos detallado en `docs/defensa/01_canvas.md` sección 8."

---

## RESERVA 1 · "¿Por qué no usaron DiCE para contrafactuales?"

**Respuesta (40 s):**

> "DiCE de Mothilal et al. está en U4_T2 slide 65 del curso. Lo evalué.
>
> DiCE busca contrafactuales **óptimos** — el cambio mínimo que cruza una frontera de decisión. En clasificación tiene sentido. En regresión continua como esta, no hay frontera natural — el precio es un continuo.
>
> Lo que sí necesita el usuario es: '¿cuánto cambia el precio si modifico esto?'. Eso se logra con **perturbación numérica simple** — ±1 unidad en cada feature accionable, clamps al schema, dedupe por feature, top-5 por |%|.
>
> 50 líneas de código, sin dependencia externa, latencia menor a 100 ms. DiCE habría sido sobre-ingeniería. Lo defiendo como **inspiración del concepto**, no como implementación literal."

---

## RESERVA 2 · "¿Por qué SQLite y no Postgres?"

**Respuesta (30 s):**

> "Tres razones:
>
> Una, **cero setup** — un archivo `.db` y arranca. Para un evaluador clonando el repo, eso vale más que rendimiento.
>
> Dos, **agnóstico del motor** — el código usa SQLAlchemy 2. Cambiar a Postgres es una variable de entorno `DATABASE_URL`. No requiere refactor.
>
> Tres, **escala suficiente para MVP** — la BD acumula `users + analyses + factors + reports`. Con 1,000 usuarios analizando 10 veces al mes, son 120,000 filas/año. SQLite maneja eso en < 100 MB. Postgres entraría si necesitamos lectura concurrente fuerte o full-text search.
>
> El Gate 5 documenta la decisión arquitectural."

---

## Reglas durante el Q&A

1. **Pausa antes de responder.** 2 segundos de pausa = pareces que piensas. 0 segundos = pareces ensayado.
2. **Repite la pregunta** si te da tiempo para pensar: "¿Por qué XGBoost? Buena pregunta — comparé 5 modelos en el Gate 6...". Da 3 segundos extra.
3. **No te disculpes.** "Esa es una limitación que reconocemos, [solución]." NUNCA "perdón, eso no lo hicimos bien".
4. **Si preguntan algo del Sprint 4 (defensa)** — Canvas, Pitch, demo — apunta a los archivos: "está en `docs/defensa/`, en el repo".
5. **Si preguntan algo que no sabes:** "No estoy seguro, pero puedo mostrar dónde lo verificamos en el código." → abrir el archivo, leer juntos. Mucho mejor que inventar.
6. **Si el jurado tiene razón en una crítica:** asiente, anótalo en una libreta visible. "Buena observación, lo agrego al backlog." No defiendas lo indefendible.
7. **Si te quedas en blanco:** "Déjenme retomar." Volver al pitch o a la demo. No improvisar tecnología.

---

## Preguntas que NO quieres (cómo desviarlas)

**"¿Y por qué no implementaron dark mode?"**
> "Es opcional según la priorización post-auditoría Codex. La rúbrica pesa más Funcionalidad + Datos+Modelo que vanidad UX. Está en backlog para 1.1."

**"¿Por qué no usaron data de Properati API en vez de scrapear?"**
> "Properati API requiere pago y aprobación comercial. Para un proyecto académico abierto, scraping respetando robots.txt es la única vía sostenible. La data scrapeada es reproducible por cualquiera con `pipeline/scrapers/`."

**"¿Probaron con CatBoost o LightGBM?"**
> "CatBoost destaca cuando hay muchas variables categóricas y nosotros tenemos solo `distrito` (target-encoded). LightGBM es comparable a XGBoost en rendimiento, pero XGBoost tiene mejor soporte para `quantileerror` que necesité en el Sprint 3.1. Decisión basada en herramientas disponibles, no en rendimiento esperable diferente."

**"¿Por qué solo Lima Metropolitana?"**
> "Por las mismas fuentes públicas. INEI tiene ENAPRES por departamento, MININTER también — extender a Arequipa o Trujillo es replicar el pipeline con sus archivos. Está en el roadmap del slide 11."

---

## La pregunta que NO te van a hacer pero te conviene preparar

**"¿Qué aprendieron haciendo este proyecto?"**

> "Tres cosas que no creía al inicio:
>
> Una, **el modelo es la parte más fácil**. El gap real está en la calidad y cobertura de los datos. XGBoost vs Random Forest movió 0.18 pp; más data en SJL movería 5 pp.
>
> Dos, **la honestidad sobre la incertidumbre vende**. Pensé que mostrar 'no sé' aleja al usuario; en realidad lo hace confiar más en los casos donde sí sabemos.
>
> Tres, **el proceso pesa**. 6 gates pre-ejecución, 4 auditorías sabueso, 63 tests — no son académicos. Son lo que diferencia un MVP defendible de un demo de portafolio."

Si dan tiempo libre al final ("¿algo más que quieran decir?"), usar esto como cierre.

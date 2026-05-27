# PLAN_ENTREGA_FINAL — Sprint hacia 19.5+/20

> **Generado:** 2026-05-26
> **Auditado por Codex 5.3:** 2026-05-27 (ver `docs/codex_audit_resultado.md`)
> **Deadline:** 2026-06-26 (1 mes)
> **Estado actual:** 18/20 (rúbrica DS3022)
> **Objetivo:** 19.5+/20 (realista con foco en S1+S2+S4; S3 parcial)
> **Cómo usar:** marcar `- [ ]` a medida que se completa. Cada tarea tiene archivo, criterio de aceptación y estimado.
>
> Referencias:
> - Histórico de implementación v6 (RF→XGB v2): `_archive/docs_obsoletos/PLAN.md`
> - Auditoría rúbrica: `AUDIT_v2_vs_rubrica.md`
> - Carta magna curso: `docs/curso_DS3022_carta_magna.md`
> - Auditoría Codex del plan: `docs/codex_audit_resultado.md`

---

## 0. Cambios post-auditoría Codex (2026-05-27)

Codex 5.3 leyó código real y rúbrica oficial. Ajustes aplicados:

| # | Hallazgo Codex | Acción tomada |
|---|----------------|---------------|
| 1 | Tests reales = **44** (no 31) | Métrica baseline corregida |
| 2 | `feature_order.json` legacy (74 feats) vs `feature_names_v2.joblib` activo (95 feats) | Aclarado: v2 es producción, v1 deprecado |
| 3 | **Yields BCRP/ASEI no tienen fuente en repo** | Marcado como **heurístico** — defensa: "calibrado por orden de magnitud, no fuente oficial" |
| 4 | S3 subestimado 25h → 40-48h reales | **S3.2 + S3.3 + S3.5 marcados OPCIONALES**; S3.1 (quantile) es el único core de S3 |
| 5 | S1.3 "sin nuevas requests" era falso (`EntornoOut` no expone `count_500m`) | Corregido: S1.3 SÍ requiere cambio mínimo en `routers/entorno.py` |
| 6 | Conflicto base contrafactual vs P50 | Regla explícita: **contrafactual siempre sobre P50** (post-quantile) |
| 7 | Retrain S3.2/S3.3 puede romper `test_v2_features.py` (umbrales fijos) | Mitigación documentada en S3.2 |
| 8 | Citas académicas: Karpathy ⚠️, He et al. ⚠️, Lin et al. Focal Loss ⚠️ forzada | Reformuladas como "inspiración" en S4.4 |

**Veredicto Codex:** 19.5 alcanzable con foco brutal en S1+S2+S4. Lo **innegociable**: contrafactual visible (S2.2) + error analysis (S2.3 Notebook 11).

---

## 1. Decisiones cerradas (2026-05-26)

| # | Tema | Decisión | Por qué |
|---|------|----------|---------|
| 1 | `dist_mar_km` en el modelo | **Se queda** | Es driver real (Miraflores, Barranco). Solo se quita el texto "a X km del mar" del resumen visible en EntornoScreen. |
| 2 | `n_comparables` y `coverage_radius_km` en UI | **Se ocultan del UI visible** | Confunden al usuario (Leo). Internamente siguen calculando banner low-coverage + nivel de confianza. |
| 3 | Visual del score de entorno | **Breakdown expandible bajo el círculo** | Muestra qué impulsa el score (denuncias vs Lima, chips por categoría POI). Sin retrain. |
| 4 | POIs de calidad (colegios/clínicas/fine_dining) | **Fuentes oficiales** | SUSALUD RENIPRESS (clínicas cat. II-1, II-2, III-1, III-2), MINEDU/SUNEDU (colegios privados con `fee=yes`), fine_dining se deja para post-entrega. |
| 5 | Nexo Inmobiliario (yield) | **Fórmula calibrada con BCRP+ASEI** | Scrapear "entrega inmediata"; `alquiler = venta × yield_zona / 12`. Yields: Miraflores/SI/Barranco 5.5%, La Molina/Surco 4.5%, JM/PL/Magdalena 5%, SJL/Ate 8.5%. |
| 6 | Quantile regression | **3 XGBoost con `reg:quantileerror`** | P25/P50/P75. P50 reemplaza al modelo actual; mostramos rango. Valor real para zonas con poca data (La Planicie). |

---

## 2. Estado actual de la rúbrica

| Criterio | Hoy | Quick wins | Tope |
|----------|-----|------------|------|
| Funcionalidad | 4.5/5 | 5/5 | 5 |
| Diseño y Usabilidad | 4.5/5 | 5/5 | 5 |
| Integración Datos y Modelo | 6.5/7 | 7/7 | 7 |
| Innovación | 2.5/3 | 3/3 | 3 |
| **TOTAL** | **18/20** | **20/20** | **20** |

Gap real para 20/20: contrafactual + quantile + Canvas/Pitch + accesibilidad.

---

## 3. Roadmap por semanas (horas realistas post-Codex)

```
S1 (26 may – 02 jun)   ~14h    UI fixes + WCAG + breakdown entorno
S2 (03 jun – 09 jun)   ~18h    Endpoints + contrafactual + Notebook 11   ← CORE
S3 (10 jun – 18 jun)   ~12h    Quantile (S3.1 únicamente como CORE)
                       +28h    S3.2/3.3/3.5 OPCIONALES si hay tiempo
S4 (19 jun – 26 jun)   ~14h    Defensa: Canvas+Pitch al inicio, ensayo al final
```

**Total CORE:** ~58h (factible con 3-4h/día × 28 días)
**Total con OPCIONALES:** ~86h (irrealista; recortar S3.2/3.3 si entra en S2 desbordada)

---

## SPRINT 1 — Frontend UI fixes  ·  S1 (26 may – 02 jun)  ·  ~14 h (real)

**Objetivo:** cerrar el feedback de Leo + bugs de copy que afectan diseño/usabilidad. Sin tocar el modelo. Sube Funcionalidad + Usabilidad de 4.5 → 5.

### 1.1 Bugs de copy (~1h)
- [ ] **"Random Forest · MAPE 15.9%" → "XGBoost v2 · MAPE 15.74%"** en 7+ lugares de `app/screens.jsx`.
  *Criterio:* `grep -c "Random Forest" app/screens.jsx` → 0. Cards de Home, FairValueResult, About, FAQ.
- [ ] **FAQ "hexágono geográfico" → "agregadas por distrito"** en `app/screens.jsx:1841` (no usamos H3).
  *Criterio:* `grep "hexágono" app/screens.jsx` → 0 resultados.
- [ ] Footer del FairValueResult: quitar "Random Forest · MAPE 15.9%" o reemplazar por "Modelo XGBoost v2 · margen ±15.7%".

### 1.2 Feedback de Leo (~3h)
- [ ] **Ocultar `n_comparables` y `coverage_radius_km`** del UI de `FairValueResult`.
  *Criterio:* esos dos campos no aparecen en pantalla; banner low-coverage sigue saliendo cuando `confidence === "Baja"`.
- [ ] **Quitar "a X km del mar"** del summary text de `EntornoMapScreen`.
  *Criterio:* el feature sigue en backend; solo desaparece del párrafo descriptivo.
- [ ] **HTTP 400 UX**: cuando el pin está fuera del bbox de Lima, mostrar mensaje amable en lugar de console error.
  *Criterio:* arrastrar pin a Trujillo → toast/banner "Por ahora solo tenemos data de Lima Metropolitana". No console error.
- [ ] **Rewrite banner de baja cobertura** para que sea self-contained (sin jerga técnica).
  *Antes:* "n_comparables: 12 (< 27). coverage_radius_km: 1.8"
  *Después:* "Pocos avisos cerca para comparar — el rango puede ser ancho. Tomalo como referencia."

### 1.3 Visual UX del score de entorno (~4h) — requiere cambio en backend
> **Corrección Codex:** `EntornoOut` actual NO expone `count_500m` ni `n_comisarias_1km`. Hay que extender el schema. `OSMIndex.lookup()` sí tiene la data interna, pero el router no la sirve.

- [ ] **Backend primero:** extender `EntornoOut` en `app/backend/routers/entorno.py` con:
  - `poi_counts_500m: dict[str, int]` (7 categorías OSM)
  - `n_comisarias_1km: int`
  - `denuncias_vs_lima_pct: float` (ratio distrito/promedio para barra relativa)
  *Criterio:* `curl /api/entorno?lat=-12.12&lng=-77.03` devuelve los 3 campos nuevos.
- [ ] **Frontend después:** bajo el círculo del score, añadir **breakdown expandible** en 2 columnas:
  - **Seguridad** → bar relativa "denuncias por km² del distrito vs promedio Lima" + n° comisarías cercanas.
  - **Servicios** → chips de categoría con conteo: `🏪 3 supermercados · 🏦 2 bancos · 🌳 4 parques · 🏥 1 clínica · 🚌 5 estaciones`.
  *Criterio:* breakdown visible al hacer tap "Ver detalle"; sin requests extra (data viene del mismo `/api/entorno`).

### 1.4 Aria-labels WCAG (~2h)
- [ ] **`aria-label` en todos los botones interactivos** de `screens.jsx` y `components.jsx`:
  Modal close, logout, +/− Steppers, chips de amenities, mapa pin drag.
  *Criterio:* `grep -c "aria-label" app/screens.jsx app/components.jsx` ≥ 30.
- [ ] **Iconos diferenciadores en verdict pill** (no solo color):
  - Inflado → ↑ rojo
  - Justo → = verde
  - Ganga → ↓ azul
  *Criterio:* daltónico distingue verdict sin ver el color.
- [ ] Verificar contraste WCAG AA en `home-eyebrow`, `verdict-pill`, `banner-coverage` (4.5:1 mínimo).

### 1.5 Tooltips glossary (~1h)
- [ ] Componente `<Glossary term="MAPE">...</Glossary>` que muestra tooltip on hover (desktop) o tap (mobile).
- [ ] Términos a cubrir en `FairValueResult` y `AboutScreen`: **MAPE, R², Confianza Alta/Media/Baja, n_comparables (interno), XGBoost**.
- [ ] Copy en español peruano neutro, 1 línea por término.

**Aceptación Sprint 1:** screens limpias, sin "Random Forest" en copy, breakdown de score visible, 30+ aria-labels, tooltips funcionando.

---

## SPRINT 2 — Backend endpoints + contrafactual  ·  S2 (03 jun – 09 jun)  ·  ~18 h (real)  ·  **INNEGOCIABLE**

**Objetivo:** llenar gaps técnicos de la rúbrica (observabilidad + explicabilidad). Sube Integración Datos y Modelo de 6.5 → 7.

### 2.1 Endpoints de observabilidad (~1h)
- [ ] `GET /api/health` → `{status: "ok", model_mode: "v2", model_version: "xgb_v2_20260520", uptime_seconds: 12345}`.
- [ ] `GET /api/model/info` → `{trained_at, dataset_period, days_since_training, n_features: 95, metrics: {mae: 158, mape: 0.1574, r2: 0.861, rmse: 284}}`.
- [ ] Loggear `predicted_in_seconds` (ya existe en payload) y exponer p50/p95 agregado en `/api/dashboard`.
*Criterio:* `curl localhost:8000/api/health` y `/api/model/info` devuelven JSON con shape correcta.

### 2.2 Contrafactual ligero (~5h)
> **Regla post-Codex:** la base del contrafactual es **`fair_value` actual** en S2 (modelo XGBoost central). Si S3.1 (quantile) entra, la base pasa a **P50**. El campo se llama siempre `base_prediction` internamente; lo que cambia es de dónde sale el número.

- [ ] En `app/backend/ml_v2.py`, agregar `compute_counterfactuals(form, geo, base_prediction)`:
  - Por cada feature accionable (área, baños, dormitorios, cocheras, antigüedad): perturbar ±1 unidad y re-predecir.
  - **Edge case:** clampear a rangos válidos antes de perturbar (`baños ≥ 1` salvo `es_estudio`, `area ≥ 10 m²`, etc.). Nunca perturbar fuera del schema `PredictIn`.
  - Retornar `List[{feature, delta, new_price, pct_change}]` ordenada por `|pct_change|` desc.
- [ ] En `PredictOut`, agregar `counterfactuals: List[Counterfactual]`.
- [ ] En `FairValueResult`, sección **"Cómo cambiaría tu precio"** con top-5 contrafactuales:
  > "+ 1 baño → $1,080 (+8%)"
  > "+ 10 m² → $1,030 (+3%)"
  > "− 5 años de antigüedad → $1,020 (+2%)"
*Criterio:* contrafactuales visibles para 1 caso real; latencia total `/predict` < 300 ms (relajado: 5 re-predicciones suman ~50-100ms con XGBoost).

### 2.3 Notebook 11 — análisis de errores (~3h) — **INNEGOCIABLE**
> **Codex:** este notebook es lo que más mueve la rúbrica en "Integración Datos y Modelo" (slide U4_T2 7-8). No cortar bajo ninguna circunstancia. Versión mínima viable: 2 plots + 1 párrafo de conclusión.
- [ ] Crear `pipeline/notebooks/11_analisis_residuos.ipynb`:
  - Scatter `residual vs precio_real` (línea de cero).
  - Boxplot residual por `categoria_distrito` (popular/emergente/establecido).
  - Boxplot residual por `estrato_nse` (1..5).
  - Top 10 listings con mayor error absoluto + scrap-back para validar.
  - Conclusión: ¿el modelo es justo across estratos?
*Criterio:* notebook ejecuta end-to-end; plots claros; bullet de conclusión escrito.

### 2.4 Tooltip por feature en factors (~2h)
- [ ] En `FairValueResult`, al hacer hover sobre cada `<AnimBar>` factor, mostrar tooltip explicando qué es la feature en castellano peruano neutro.
- [ ] Mapping `factor_name → explicación`: `estrato_nse → "Nivel socioeconómico del distrito (1-5, INEI)"`, `dist_nearest_m_parqueos → "Distancia al estacionamiento público más cercano"`, etc.
*Criterio:* tooltips no técnicos en los 5 factors visibles.

### 2.5 Tests de regresión (~2h)
- [ ] `tests/test_counterfactuals.py`: perturbación ±1 unidad respeta sign del coeficiente esperado (+ área → + precio).
- [ ] `tests/test_health.py`: `/api/health` y `/api/model/info` devuelven 200 con shape.
*Criterio:* 4 tests nuevos pasan; total pytest ≥ 35 tests verdes.

**Aceptación Sprint 2:** contrafactuales en pantalla, endpoints de observabilidad, notebook 11 ejecutable, tooltips en factors, tests pasan.

---

## SPRINT 3 — Quantile (CORE) + recortes opcionales  ·  S3 (10 jun – 18 jun)

**Objetivo:** diferenciadores reales vs proyectos del curso. Sube Innovación de 2.5 → 3.

> **Codex:** S3 original (25h) era irrealista — 40-48h reales. Reestructurado:
> - **S3.1 quantile = CORE** (12h, único innegociable de este sprint).
> - **S3.2 POIs calidad** + **S3.3 Nexo** + **S3.5 dark mode** = OPCIONALES. Hacer solo si S1+S2 cierran en tiempo.
> - **S3.4 serenazgo visual** = OPCIONAL bajo (queda lindo pero no mueve rúbrica).

### 3.1 Quantile regression (~12h real) — **CORE de S3**
- [ ] En `pipeline/`, entrenar 3 XGBoost adicionales con mismas 95 features:
  - `xgb_q25.joblib` → `objective='reg:quantileerror', quantile_alpha=0.25`
  - `xgb_q50.joblib` → `quantile_alpha=0.50`
  - `xgb_q75.joblib` → `quantile_alpha=0.75`
- [ ] Validar coverage del intervalo en test set: % de listings reales que caen dentro de `[P25, P75]` debe ser ~50%.
- [ ] En `ml_v2.py`, cargar los 3 modelos al startup; `predict_fair_value` retorna `prediction_interval: {p25, p50, p75}`.
- [ ] El campo `fair_value` pasa a ser el P50 (en lugar del modelo central actual).
- [ ] En `FairValueResult`, reemplazar el número único por **rango**:
  > "Precio estimado: **$850 – $1,150**"
  > "Centro probable: $1,000"
- [ ] Banner de baja cobertura ahora muestra explícitamente cuán ancho es el rango.
*Criterio:* coverage P25-P75 ≈ 50% en test; rango visible en UI; latencia `/predict` < 300 ms.

### 3.2 POIs de calidad (~10h real) — **OPCIONAL**
> **Codex:** retrain con nuevas features puede romper `test_v2_features.py` (umbrales fijos tipo `assert pred > 800`). Mitigación: actualizar fixtures de tests con nuevos valores **antes** de retrain, no después.
- [ ] **Clínicas**: descargar RENIPRESS de SUSALUD, filtrar Lima + categoría II-1/II-2/III-1/III-2 (privadas). Reemplazar `count_hospitales_*` por `count_clinicas_top_*`.
- [ ] **Colegios privados**: OSM con `amenity=school + fee=yes` o padrón MINEDU privadas Lima. Reemplazar `count_colegios_*` por `count_colegios_privados_*`.
- [ ] **Restaurantes top**: OSM con `amenity=restaurant` y rating si disponible. Si no, dejar `count_restaurantes_*` como está y documentar limitación.
- [ ] En `osm_lookup.py`, agregar las nuevas categorías al `OSMIndex`.
- [ ] Retrain XGBoost con nuevas features → comparar MAPE.
*Criterio:* MAPE igual o mejor con nuevas features; documentado en `gates/gate7_resultado.md` si baja, o "sin mejora" si no mueve aguja.

### 3.3 Nexo Inmobiliario (~10h real) — **OPCIONAL**
> **Codex:** los yields del plan original (5.5% / 4.5% / 8.5%) no tienen fuente trazable en repo. **Antes de usarlos en defensa**, o (A) conseguir cita explícita BCRP Nota Semanal 2024 o ASEI Reporte Inmobiliario y guardarla en `pipeline/data/raw/yields_source.md`, o (B) presentar como **heurístico calibrado por orden de magnitud típico del mercado** sin atribuir a fuente oficial. Defenderlo como "calibración heurística" es honesto; inventar fuente es atacable.
- [ ] Scraper `pipeline/scrapers/nexo_inmobiliario.py`: solo listings con tag "entrega inmediata".
- [ ] Por cada listing: extraer `precio_venta`, `area`, `distrito`, `lat/lng`, `dorm/banos/cocheras`.
- [ ] Aplicar fórmula yield:
  ```python
  YIELDS = {
      "Miraflores": 0.055, "San Isidro": 0.055, "Barranco": 0.055,
      "La Molina": 0.045, "Santiago de Surco": 0.045,
      "Jesús María": 0.05, "Pueblo Libre": 0.05, "Magdalena del Mar": 0.05,
      "San Juan de Lurigancho": 0.085, "Ate": 0.085, "Los Olivos": 0.085,
  }
  alquiler_estimado = precio_venta * YIELDS.get(distrito, 0.05) / 12
  ```
- [ ] Mergear con dataset original para zonas con baja cobertura (La Planicie, Casuarinas, Las Lomas).
- [ ] Retrain → comparar MAPE en zonas premium específicamente.
*Criterio:* +200 listings premium agregados; MAPE en La Planicie/Casuarinas mejor que el actual o documentado como "no mueve por baja muestra".

### 3.4 Serenazgo (datos públicos para visual) (~3h) — **OPCIONAL bajo**
- [ ] Investigar disponibilidad por municipio: portales transparencia (Miraflores, San Isidro, San Borja, Surco, La Molina suelen publicar).
- [ ] Compilar CSV `serenazgo_por_distrito.csv` con n° serenos / km² y respuesta promedio si está.
- [ ] **No** entra al modelo (no hay para todos los distritos uniforme). Solo va al breakdown visual del score de entorno (Sprint 1.3).
*Criterio:* CSV con cobertura mínima 15 distritos top; chip en breakdown "Serenazgo activo: sí/no".

### 3.5 Dark mode (~2h) — **OPCIONAL bajo**
- [ ] Toggle en `Topbar`; usar CSS custom properties.
- [ ] U5 slide 46 lo lista como tendencia 2024 → bonus de innovación.
*Criterio:* toggle funciona; ambos modos con contraste WCAG AA.

**Aceptación Sprint 3:** intervalos P25-P75 en producción, +200 listings de Nexo, RENIPRESS integrado, serenazgo visible en breakdown.

---

## SPRINT 4 — Defensa oral  ·  S4 (19 jun – 26 jun)  ·  ~14 h (real)
> **Codex:** Canvas + Pitch primero (lunes-martes), no al final. Ensayo grabado al final con artefactos ya cerrados.

**Objetivo:** preparar la sustentación. Sin código nuevo. Diferencia entre 19/20 y 20/20 está acá.

### 4.1 Data Product Canvas (~2h)
- [ ] Completar plantilla del slide 29 (curso DS3022), 9 bloques:
  1. **Problema** — Asimetría de información en alquileres de Lima; 41% del mercado concentrado en 2 distritos.
  2. **Cliente** — Inquilino primerizo + dueño que quiere fijar precio justo.
  3. **Propuesta de valor** — Segunda opinión honesta basada en data real, no en estimaciones de agentes.
  4. **Solución** — ML + 4 fuentes externas + UX honesta con bandas de confianza.
  5. **KPIs** — MAPE 15.74%, R² 0.861, % predicciones dentro de ±15%, NPS post-uso.
  6. **Datos requeridos** — Listings inmobiliarios + INEI NSE + MININTER denuncias + CENACOM comisarías + OSM POIs.
  7. **Arquitectura** — FastAPI + XGBoost + cKDTree + React SPA. Diagrama de DIAGRAMAS.md.
  8. **Costos** — Hosting $10/mes (EC2 t2.micro), scraping mensual (0 si manual), reentrenamiento trimestral.
  9. **Riesgos** — Sesgo a Miraflores; modelo no se reentrena solo; data scraping queda obsoleta.
- [ ] Versión imprimible PDF en `Proyecto_DPD/entregables/canvas.pdf`.

### 4.2 Elevator Pitch 90 segundos (~1h)
- [ ] Estructura U5 slide 42-45: gancho → problema → solución → propuesta de valor → CTA.
- [ ] Borrador inicial:
  > "**Gancho:** Si solo supiéramos el precio justo de cualquier alquiler en Lima sin que un agente nos manipulara...
  > **Problema:** 41% del mercado se concentra en 2 distritos. El resto, info opaca.
  > **Solución:** ubIcA cruza 95 features de 3,348 listings con CENACOM, MININTER, INEI y OSM.
  > **Valor:** R² 0.86, MAPE 15.7%. Banner amarillo cuando no tenemos suficiente data — porque mentir cuesta más que callar.
  > **CTA:** Demo en vivo: arrastra el pin, mira la honestidad del rango."
- [ ] Memorizado en español + versión escrita para slide final.

### 4.3 Demo guiada 90s (~2h)
- [ ] Script: **La Planicie → Miraflores → SMP**.
  - La Planicie: pin en zona N=2 → confidence=Baja + banner + rango ancho. *"Honesto sobre lo que no sabemos."*
  - Miraflores: pin en Larcomar → confidence=Alta + verdict justo. *"Donde tenemos data, somos precisos."*
  - SMP: pin en zona popular → muestra cómo el yield de Nexo metió data nueva. *"Datos públicos + scraping ético."*
- [ ] Practicar 3 veces con cronómetro.

### 4.4 Slides de defensa (~3h)
- [ ] **5 puntos fuertes** (memorizar):
  1. "MAPE 15.92% → 15.74%, MAE $173 → $158, RMSE −25%"
  2. "4 bugs auditados cerrados antes de proponer cambios" (CRISP-DM)
  3. "4 fuentes externas reales — cero data sintética"
  4. "42+ tests pytest pasando incluyendo end-to-end por zona"
  5. "Switch v1/v2 automático con `model_service.py` como capa de aislamiento"
- [ ] **3 limitaciones honestas con solución**:
  1. La Planicie/Casuarinas N≤5 → re-scrape v2.1 + Nexo yield.
  2. Sin contrafactuales DiCE → solución ligera por perturbación numérica (Sprint 2).
  3. Modelo no se reentrena automático → reentrenamiento manual trimestral documentado.
- [ ] **Citas para jurado** (validadas por Codex):
  - ✅ Eric Ries (MVP = aprendizaje validado) — sólida
  - ✅ DJ Patil (producto de datos) — sólida
  - ✅ Bill Schmarzo (predictive + prescriptive) — sólida
  - ✅ Christoph Molnar `Interpretable ML` (interacción no-aditiva → XGBoost > Linear) — sólida
  - ✅ CRISP-DM y TDSP — sólidas (marco)
  - ⚠️ Karpathy ("datasets > algorithms") — defendible pero **extrapolación de NN a tabular**; presentar como "filosofía aplicada"
  - ⚠️ He et al. 2014 FB "Practical Lessons from Predicting Clicks" — usar como **inspiración para target encoding con smoothing**, no como respaldo literal del k=30
  - ⚠️ Lin et al. 2017 Focal Loss — paper es de **clasificación**. Presentar `sample_weight = 1/sqrt(count_distrito)` como "**inspiración conceptual** de Focal Loss para regresión", NO como equivalencia técnica. Si el jurado pregunta, reconocer la adaptación honestamente.

### 4.5 Q&A defensivo (~1.5h) — recortar a 5 preguntas core + 2 de reserva
- [ ] Preparar respuestas a las **5 preguntas más probables** del jurado (+ 2 reserva):
  1. ¿Por qué XGBoost y no Random Forest? → MAPE 15.74 vs 15.92, mejor en 5 de 6 rangos.
  2. ¿Por qué no DiCE para contrafactuales? → Solución ligera por perturbación (Sprint 2), DiCE es overkill para 5 features accionables.
  3. ¿Cómo monitoreas el modelo en producción? → `/api/health` + `/api/model/info` + `predicted_in_seconds` (Sprint 2.1).
  4. ¿Qué pasa con listings nuevos? → Reentrenamiento trimestral manual; gate de drift en startup detecta incompatibilidades.
  5. ¿Por qué no usar API de Google Places? → Costo + latencia + dependencia externa. OSM cubre 11,100 POIs gratis.
  6. ¿Cómo manejas el sesgo a Miraflores? → Sample weighting `1/sqrt(count_distrito)` + stratified split + banner UX.
  7. ¿Qué es estrato_nse y de dónde sale? → INEI ENAPRES 2024 a nivel de manzana.
  8. ¿Por qué Bayesian smoothing k=30? → He et al. 2014 FB paper; sin smoothing, distritos con n=2 sobreajustan.
  9. ¿Cómo validás que el rango P25-P75 es realista? → Coverage en test set ~50% (Sprint 3.1).
  10. ¿Cuál es el plan de monetización? → Out-of-scope (académico); ver Canvas bloque 8 (Costos).

### 4.6 Ensayo completo (~2h)
- [ ] **Dry run** completo: pitch (90s) + demo (90s) + slides técnicos (5 min) + Q&A simulado.
- [ ] Grabarse en video; revisar tiempos.

**Aceptación Sprint 4:** Canvas PDF impreso, pitch memorizado, demo cronometrada, Q&A escrito, 1 dry run grabado.

---

## 4. Métricas de éxito (cierre del sprint)

| Métrica | Hoy | Meta entrega | Cómo medir |
|---------|-----|--------------|------------|
| MAPE en test | 15.74% | ≤ 15.5% | `pipeline/scripts/eval.py` |
| Coverage P25-P75 | n/a | 45–55% | Sprint 3.1 validación |
| Tests pytest | 44 | ≥ 48 | `pytest --collect-only` |
| Aria-labels | 4 | ≥ 30 | `grep -c aria-label app/screens.jsx` |
| Latencia `/predict` p95 | ~30 ms | < 300 ms (con contrafactual + 3 modelos) | endpoint `/api/dashboard` |
| Rúbrica auto-eval | 18/20 | 19.5+/20 | revisar `AUDIT_v2_vs_rubrica.md` |

---

## 5. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Retrain Sprint 3 empeora MAPE | Media | Mantener `ml_v2.py` actual como fallback; switch en `model_service.py`. |
| Nexo scraping bloqueado por antibot | Alta | Plan B: usar precios publicados sin yield (datos como están), documentar limitación. |
| RENIPRESS data desactualizada | Baja | Validar fecha de última actualización antes de integrar. |
| Quantile coverage muy off (e.g. 70%) | Media | Recalibrar `quantile_alpha` o usar conformal prediction simple. |
| 1 mes no alcanza para Sprint 3 completo | Media | Priorizar Sprint 1 + 2 + 4 (van seguro). Sprint 3 se recorta a quantile (lo que más mueve aguja). |

---

## 6. Lo que NO se toca

- **Modelo XGBoost v2 base** (MAPE 15.74%, R² 0.861): está en su techo dado el dataset. Quantile es **aditivo**, no reemplaza.
- **Esquema BD SQLite**: estable, no se migra a Postgres ahora.
- **Login/auth flow**: funciona con demo user `ana@ubica.pe / demo1234`; no se cambia.
- **Mermaid diagrams** en DIAGRAMAS.md: ya están aprobados, no se rehacen.

---

## 7. Definición de "ENTREGABLE"

El producto está listo para sustentar cuando:
1. Sprint 1 completo (UI sin bugs de copy, breakdown de score, aria-labels).
2. Sprint 2 completo (contrafactuales visibles, `/health` responde, notebook 11 corre). **INNEGOCIABLE.**
3. Sprint 3.1 (quantile) en producción. S3.2/3.3/3.5 solo si el tiempo lo permite.
4. Sprint 4 completo (Canvas + Pitch + Demo + Q&A escritos y ensayados).
5. **48+ tests pytest pasando** incluyendo `test_counterfactuals.py` y `test_quantile.py`.
6. **Auto-eval de rúbrica ≥ 19.5/20** con evidencia en `AUDIT_v2_vs_rubrica.md` actualizado.
7. Backend + frontend corriendo en localhost sin warnings.
8. Branch `feat/entrega-final` mergeado a `main` en GitHub.

---

## 7.5 Plan B — si solo alcanzan 2 semanas (post-Codex)

Codex estima: con 2 semanas alcanzás **19.0 – 19.25**, no 19.5. Para llegar a 19.5 en 2 semanas, quantile (S3.1) tiene que entrar y estar estable.

**Must-have en 2 semanas:**
1. S1.1 + S1.2 (copy fixes + Leo feedback) — 6h
2. S1.4 aria-labels mínimos (5 botones core) — 1h
3. S2.1 `/health` + `/model/info` — 1h
4. S2.2 contrafactual visible — 5h
5. S2.3 Notebook 11 mínimo (2 plots + conclusión) — 2h
6. S4.1 Canvas — 2h
7. S4.2 Pitch 90s — 1h
8. S4.3 Demo cronometrada — 2h

**Total Plan B:** ~20h en 2 semanas → 19.0 - 19.25 seguro.

**Descartar en Plan B:** S1.3 breakdown completo, S1.5 tooltips, S2.4 tooltip por feature, S3 entero, S4.4 slides extendidos, S4.5 Q&A largo.

---

## 8. Cómo retomar este plan

Al inicio de cada sesión:
- `cat PLAN_ENTREGA_FINAL.md | grep "^- \[ \]" | head -10` → próximas tareas pendientes.
- Marcar `- [x]` apenas se completa cada tarea.
- Anotar bloqueos o desvíos en `session.log` con tipo `BLOCKER` o `ARCH`.
- Al cerrar un sprint, hacer commit con mensaje `sprint N: <resumen>` y actualizar la sección "Métricas de éxito".

---

**Fecha de inicio del sprint:** 2026-05-26
**Próxima revisión:** 2026-06-02 (fin Sprint 1)

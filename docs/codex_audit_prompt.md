# Prompt para auditoría con Codex 5.3 (Cursor) — v2

> **Cómo usar:** abrir Cursor en la raíz `Proyecto_DPD/`, activar Codex 5.3, pegar el prompt de abajo entre las líneas `=== INICIO PROMPT ===` y `=== FIN PROMPT ===`. Codex tiene acceso al filesystem del workspace.

---

## Archivos que Codex DEBE leer antes de responder

Listados en orden de prioridad:

1. `PLAN_ENTREGA_FINAL.md` — **objeto de la auditoría**
2. `docs/curso_DS3022_carta_magna.md` — **rúbrica + 615 slides del profesor + 121 cells de notebooks** (carta magna del curso)
3. `AUDIT_v2_vs_rubrica.md` — auditoría previa del estado 18/20
4. `FLUJO_TRABAJO.md` — sistema actual fin-a-fin
5. `DIAGRAMAS.md` — 6 diagramas Mermaid
6. `README.md` — overview
7. `app/backend/ml_v2.py`, `app/backend/osm_lookup.py`, `app/backend/geo_index.py`, `app/backend/routers/fairvalue.py`, `app/backend/routers/entorno.py` — verificar que las features mencionadas en el plan existen
8. `app/screens.jsx` — verificar bugs de copy ("Random Forest", "hexágono geográfico")
9. `pipeline/notebooks/` — entender el pipeline real de entrenamiento

---

## === INICIO PROMPT ===

Sos un auditor técnico senior de proyectos de ML aplicado. Auditás `PLAN_ENTREGA_FINAL.md` y devolvés un veredicto **honesto, factual, sin floro**.

### Contexto

**Producto:** ubIcA — webapp predice precio de alquiler en Lima Metropolitana, veredicto Ganga/Justo/Inflado.

**Modelo actual:** XGBoost v2, 95 features. MAPE 15.74%, R² 0.861, MAE $158, RMSE $284.

**Stack:** FastAPI + SQLAlchemy 2 + SQLite (backend) · React 18 + Babel standalone + Leaflet CDN (frontend, sin build).

**Dataset:** 3,348 listings inmobiliarios reales + INEI NSE (manzana) + MININTER denuncias 2024 + CENACOM 50 comisarías + OSM 11,100 POIs (7 categorías).

**Curso:** DS3022 UTEC (Desarrollo de Productos de Datos). Rúbrica oficial en `docs/curso_DS3022_carta_magna.md`. Niveles: Inicial / En proceso / Adecuado / Excelente.

**Estado:** 18/20 estimado. Objetivo: **19.5+/20** en 1 mes (26 may → 26 jun 2026).

**Yo:** dev en solitario, UTEC + practicante part-time en otra empresa (~3-4 h/día reales en este proyecto).

### Tarea — 7 secciones obligatorias

Respondé en este orden, sin saltarte secciones:

#### Sección 1 — Veredicto general
2-3 oraciones. ¿Factible? ¿Qué se cae primero si el tiempo aprieta?

#### Sección 2 — Verificación de premisas del plan contra el código real
**OBLIGATORIO:** abrir los archivos del backend y verificar. Marcar cada premisa como ✅ verificado / ❌ falso / ⚠️ ambiguo:

- [ ] El plan dice "Sprint 1.3 exponer `count_500m` que ya está en `OSMIndex.lookup`" → ¿realmente existe en `app/backend/osm_lookup.py`?
- [ ] El plan dice "ml_v2.py asume 95 features" → ¿coincide con `feature_order.json` o equivalente?
- [ ] El plan dice "31 tests pytest pasando" → ¿cuántos hay realmente en `app/backend/tests/`?
- [ ] El plan dice "screens.jsx tiene 7+ menciones de 'Random Forest'" → `grep` para confirmar.
- [ ] El plan dice "FAQ línea 1841 'hexágono geográfico'" → verificar línea exacta.
- [ ] El plan dice "XGBoost soporta `objective='reg:quantileerror'` nativo" → ¿la versión de xgboost en `requirements.txt` lo soporta? (xgboost ≥ 1.7).
- [ ] El plan dice "OSM tiene 7 categorías × 3 métricas = 21 features" → confirmar en `osm_lookup.py`.
- [ ] Yields por zona (5.5% Miraflores, 4.5% La Molina, etc.) → ¿hay alguna fuente citada en `pipeline/` o son inventados?

#### Sección 3 — Factibilidad temporal por sprint
Para cada sprint (S1, S2, S3, S4):
- ¿Horas realistas para alguien que conoce el código?
- Tareas subestimadas (típico: scraping, retraining, integración modelos).
- Dependencias ocultas no explícitas.
- ¿Qué cae primero si falta tiempo?

Formato por sprint:
```
### Sprint N — [nombre]
- Tiempo estimado en plan: X horas
- Tiempo realista estimado: Y horas
- ✅ Bien: ...
- ⚠️  Riesgo: ...
- ❌ Subestimado: ...
- 💡 Sugerencia: ...
```

#### Sección 4 — Consistencia interna del plan
Detectar contradicciones entre sprints. Ejemplos a buscar (no exhaustivo):
- Sprint 3.1 reemplaza `fair_value` por P50; Sprint 2.2 usa `base_prediction` para contrafactual. ¿Está claro cuál es la base?
- Sprint 1.2 oculta `n_comparables` del UI; Sprint 3.1 muestra rango ancho cuando confidence=Baja, pero ¿cómo se decide "ancho" sin exponer n_comparables al usuario?
- Sprint 3.2 retraining puede romper tests fijados a predicciones actuales — ¿el plan lo contempla?
- Las 6 "decisiones cerradas" del plan ¿son consistentes con los sprints? (ej. decisión 1 dice `dist_mar` queda en modelo, ¿algún sprint accidentalmente lo toca?)

#### Sección 5 — Gaps vs rúbrica oficial (`docs/curso_DS3022_carta_magna.md`)
**OBLIGATORIO:** leer la rúbrica desglosada en la carta magna y mapear los 4 criterios (Func/5, UX/5, Datos&Modelo/7, Innov/3) contra los sprints. Para cada criterio:
- ¿Qué nivel alcanza el plan (Inicial/En proceso/Adecuado/Excelente)?
- ¿Qué items específicos de la rúbrica NO están cubiertos en ningún sprint?
- ¿El plan cubre los slides clave que enfatizó el profesor? (revisar carta magna: WCAG en U5 slide 45, Data Product Canvas U2 slide 29, error analysis U4_T2 slide 7-8, DiCE U4_T2 slide 65, Elevator Pitch U2 slide 42-45).

#### Sección 6 — Validación de citas académicas
El plan cita autores para defensa oral. Validar:
- **Eric Ries** (MVP = aprendizaje validado) — correcto.
- **DJ Patil** (producto de datos) — correcto.
- **Bill Schmarzo** (predictive + prescriptive) — correcto.
- **Andrej Karpathy** ("datasets > algorithms") — verificar contexto (¿tweet? ¿paper? aplica a tabular ML?).
- **He et al. 2014** (target encoding Bayesian smoothing, FB paper) — el paper es "Practical Lessons from Predicting Clicks on Ads at Facebook"; ¿el plan aplica bien la técnica?
- **Christoph Molnar** (interacción no-aditiva justifica XGBoost) — verificar (`Interpretable ML` book).
- **Lin et al. 2017 Focal Loss** — paper original es para clasificación; el plan dice "adaptado a regression vía sample_weight". ¿Es sólido o forzado?

Marcar cada cita como ✅ aplica bien / ⚠️ aplicación forzada / ❌ no aplica.

#### Sección 7 — Sobre-ingeniería + recortes
Tareas que se pueden cortar sin perder puntos:
- Sprint 3.2 retraining con POIs de calidad — si MAPE no mejora, ¿vale el tiempo?
- Sprint 3.5 dark mode — ¿realmente suma o es vanidad?
- Sprint 4.5 Q&A con 10 preguntas — ¿alcanzaría con 5?
- Sprint 2.3 notebook 11 análisis de residuos — ¿es bonus o crítico para rúbrica?

#### Sección 8 — Plan B (solo 2 semanas en lugar de 4)
Si el tiempo se reduce a la mitad, priorización honesta:
- Qué se hace en S1+S2 (2 semanas, must-have).
- Qué se descarta o difiere.
- ¿Con solo 2 semanas alcanza 19/20 o cae a 18.5/20?

### Reglas de auditoría

- **NO** inventar archivos, líneas o funciones. Si dudas, abre el archivo.
- **NO** floro motivacional. Solo data verificable.
- **SÍ** ser concreto: `archivo.py:línea`, `función()`, `commit hash`.
- **SÍ** marcar lo que está bien también (no solo gaps).
- **SÍ** decir "no sé" o "no verificable sin web" cuando aplique.
- **SÍ** cruzar datos: el plan dice X, el código dice Y → reportarlo.
- Idioma: español. Tono: directo, técnico, sin tecnicismos vacíos.

### Formato de salida

Markdown plano con las 8 secciones anteriores. Al final, una tabla resumen:

```
| Sprint | Horas plan | Horas reales | Riesgo | Recortable |
|--------|-----------|--------------|--------|------------|
| S1 | 10h | ? | ? | ? |
...
```

Y un cierre de 3 líneas: ¿el plan llega a 19.5/20? ¿Qué es lo único innegociable?

## === FIN PROMPT ===

---

## Notas para el usuario (Alejandro)

- Carta magna copiada a `docs/curso_DS3022_carta_magna.md` (296 KB, 5137 líneas) para que Codex pueda leerla desde el workspace.
- Si Codex se queda corto en respuesta (límite de tokens), pedirle: "continuá con Sección N" donde se cortó.
- El reporte de Codex debería ser entre 800-1500 líneas. Si devuelve menos de 400, está siendo perezoso — repreguntar con "expandí Sección 3 y 5, faltan verificaciones concretas".
- Pegame el resultado y ajustamos `PLAN_ENTREGA_FINAL.md`.

# Resultado auditoría Codex 5.3 — 2026-05-27

> Reporte recibido tras ejecutar `docs/codex_audit_prompt.md` en Cursor con Codex 5.3.
> Cambios aplicados al plan documentados en `PLAN_ENTREGA_FINAL.md` sección 0.

---

## 1) Veredicto general

Sí, **19.5+/20 es factible en 4 semanas con 3-4 h/día**, pero solo si recortás Sprint 3 a lo que realmente puntúa en rúbrica.

Lo primero que se cae si el tiempo aprieta es **S3.2 + S3.3** (POIs calidad + Nexo + retrain): alto costo de datos/integración y retorno incierto en puntaje.

El plan está bien orientado en S1/S2/S4; el riesgo real está en sobrecargar innovación técnica sin asegurar cierre de entregables evaluables.

---

## 2) Verificación de premisas contra código real

> **Nota factual:** `docs/curso_DS3022_carta_magna.md` no estaba en el workspace al momento de la primera lectura; Codex usó `~/.claude/proyectos/proyecto-dpd-curso.md` como fuente equivalente (la misma que cita la auditoría previa).

- ✅ **"S1.3 exponer count_500m ya en OSMIndex.lookup"** → existe en `app/backend/osm_lookup.py` (`count_500m_osm_<cat>` en `lookup()`).
- ⚠️ **"ml_v2.py asume 95 features"** → v2 sí, pero `app/backend/models/feature_order.json` (v1) sigue en 74. Hay artefacto legacy.
- ❌ **"31 tests pytest"** → hoy `pytest --collect-only` da **44 tests**. Además 2 `skipif` en `test_startup.py` cuando `USE_V2`.
- ✅ **"screens.jsx tiene 7+ menciones de Random Forest"** → `rg` devuelve **11 ocurrencias**.
- ✅ **"FAQ línea 1841: hexágono geográfico"** → correcto, está en `app/screens.jsx:1841`.
- ✅ **"XGBoost soporta reg:quantileerror"** → `requirements.txt` fija `xgboost==2.1.4` (≥ 1.7).
- ✅ **"OSM 7 categorías × 3 métricas = 21 features"** → `OSM_CATEGORIES` tiene 7; `lookup()` emite `count_500m`, `count_1km`, `dist_nearest` → 21.
- ❌ **Yields por zona (5.5/4.5/8.5)** → **NO encontró respaldo en `pipeline/`** (.md/.py). Hoy está solo en el plan, sin fuente trazable en repo.

---

## 3) Factibilidad temporal por sprint

### Sprint 1 — Frontend UI fixes
- Tiempo plan: 10 h
- Tiempo realista: **14 h**
- ✅ Bien: copy fixes + WCAG + feedback UX son tareas concretas.
- ⚠️ Riesgo: "breakdown entorno sin nuevas requests" implica tocar contrato de `GET /api/entorno` + UI.
- ❌ Subestimado: aria-labels en toda UI + revisión regresiva manual.
- 💡 Sugerencia: cerrar primero copy/WCAG/400 UX y dejar breakdown avanzado al final del sprint.

### Sprint 2 — Backend observabilidad + contrafactual
- Tiempo plan: 12 h
- Tiempo realista: **18 h**
- ✅ Bien: `/health`, `/model/info`, contrafactual simple y tests empujan rúbrica.
- ⚠️ Riesgo: contrafactual en predict puede romper latencia y esquema de respuesta.
- ❌ Subestimado: Notebook 11 + UI de contrafactual + tests de regresión en una sola semana.
- 💡 Sugerencia: dejar Notebook 11 mínimo viable (2 gráficos + conclusión) y priorizar endpoints + contrafactual visible.

### Sprint 3 — Quantile + POIs calidad + Nexo
- Tiempo plan: 25 h
- Tiempo realista: **40-48 h**
- ✅ Bien: quantile (P25/P50/P75) sí es diferenciador defendible.
- ⚠️ Riesgo: dependencia externa fuerte (scraping, fuentes oficiales, limpieza, matching).
- ❌ Subestimado: S3.2 y S3.3 son mini-proyectos de datos completos.
- 💡 Sugerencia: partir en dos: (A) quantile productivo, (B) data expansion experimental sin comprometer release.

### Sprint 4 — Defensa oral
- Tiempo plan: 12 h
- Tiempo realista: **14 h**
- ✅ Bien: aquí se ganan puntos seguros de jurado.
- ⚠️ Riesgo: demasiada narrativa técnica sin artefactos finales (Canvas, pitch, demo cronometrada).
- ❌ Subestimado: iterar guion + ensayo grabado + Q&A.
- 💡 Sugerencia: cerrar Canvas/Pitch al inicio de S4 y usar resto para práctica.

---

## 4) Consistencia interna del plan

- ⚠️ **Base de predicción inconsistente:** S2.2 define contrafactual sobre `base_prediction`; S3.1 cambia `fair_value` a P50. Falta regla explícita: "contrafactual siempre sobre P50".
- ⚠️ **Ocultar `n_comparables` vs explicar rango:** S1.2 quiere ocultarlo al usuario, pero S3.1 depende de ese contexto para justificar rango ancho. Se puede resolver con copy ("cobertura baja") sin exponer número, pero el plan no lo formaliza.
- ⚠️ **Riesgo de tests post-retrain no gestionado:** hay tests con umbrales de predicción (`>800`, `<700`) en `test_v2_features.py`; retrains de S3.2/S3.3 pueden romperlos.
- ✅ Decisión "`dist_mar_km` se queda" sí es consistente con código actual (`ml_v2.py`, `geo_index.py`, `entorno.py`).
- ⚠️ "Sin nuevas requests" en S1.3 **no es consistente** si quieres `count_500m` OSM en UI de entorno: hoy `EntornoOut` no lo expone.
- ✅ Orden de prioridad macro sí cierra: S1/S2 corrigen huecos rubricables; S3/S4 agregan diferenciador y defensa.

---

## 5) Gaps vs rúbrica oficial

### Funcionalidad (/5)
- Nivel plan: **Excelente (5/5)** si ejecuta S1+S2.
- No cubierto: plan de fallback si `/predict` sube latencia con contrafactual.
- Cobertura de slides clave: parcial (más fuerte en producción que en ideación).

### Diseño y Usabilidad (/5)
- Nivel plan: **Adecuado → Excelente**.
- No cubierto: checklist explícito de contraste real WCAG por componente.
- Slides clave:
  - ✅ WCAG U5 slide 45: sí lo ataca (aria-labels, contraste).
  - ⚠️ Dark mode (slide 46) está como opcional; no crítico para rúbrica.

### Integración Datos y Modelo (/7)
- Nivel plan: **Adecuado alto / Excelente bajo (6.5-7)**.
- No cubierto:
  - Política de estabilidad de tests/modelo tras retrain.
  - Plan de monitoreo de drift más allá de endpoint informativo.
- Slides clave:
  - ✅ Error analysis U4_T2 slide 7-8: contemplado en Notebook 11.
  - ✅ DiCE/contrafactual U4_T2 slide 65: cubierto vía versión ligera (no DiCE completo).

### Innovación (/3)
- Nivel plan: **Excelente posible (3/3)**.
- No cubierto: evidencia de impacto real (no solo métrica offline), que en curso se remarca para MVP.
- Slides clave:
  - ✅ Canvas U2 slide 29: contemplado.
  - ✅ Elevator pitch U2 slide 42-45: contemplado.
  - ⚠️ Si S3 pesado se atrasa, innovación puede volver a 2.5/3.

---

## 6) Validación de citas académicas

- ✅ **Eric Ries** (MVP = aprendizaje validado): correcto y alineado al material.
- ✅ **DJ Patil** (producto de datos): correcto.
- ✅ **Bill Schmarzo** (predictive/prescriptive): correcto en marco conceptual.
- ⚠️ **Karpathy** ("datasets > algorithms"): cita existe en slides; aplicar a tabular inmobiliario es razonable, pero extrapolación indirecta.
- ⚠️ **He et al. 2014** (Facebook ads): el paper sí está en slides; usarlo como respaldo directo de "Bayesian smoothing k=30" es parcial, no literal.
- ✅ **Christoph Molnar** (interacciones no aditivas): aplica bien para justificar XGBoost vs lineal.
- ⚠️ **Lin et al. 2017 Focal Loss**: paper original es clasificación; adaptación a regresión vía `sample_weight` es defendible como **inspiración**, pero técnicamente forzada si se presenta como equivalencia.

---

## 7) Sobre-ingeniería y recortes recomendados

- **S3.2 POIs calidad + retrain:** recortable primero. Alto esfuerzo y no garantiza mejora de MAPE ni puntos extra claros.
- **S3.5 Dark mode:** recortable sin costo de rúbrica central.
- **S4.5 Q&A 10 preguntas:** 5 bien preparadas + 2 de reserva alcanza.
- **S2.3 Notebook 11:** **NO lo cortaría**; da evidencia directa para U4_T2 (error analysis), útil para jurado.
- **S3.3 Nexo yield:** mover a backlog si no hay fuente sólida y trazable en código/documentación.

---

## 8) Plan B (2 semanas)

**Must-have (S1 + S2):**
- Copy/consistencia total (eliminar Random Forest legacy, FAQ hexágono).
- WCAG mínimo verificable (aria-label, contraste, mensajes de error 400).
- `/api/health` + `/api/model/info`.
- Contrafactual ligero visible en `FairValueResult`.
- Notebook 11 mínimo (error analysis por zona/estrato).
- Preparar Canvas + pitch en paralelo (no esperar S4).

**Qué descartar:**
- S3.2 POIs calidad + retrain.
- S3.3 Nexo completo.
- S3.5 dark mode.
- S4 Q&A extenso (reducir alcance).

**¿Llega a 19/20 o cae?**
- Con 2 semanas bien ejecutadas: **19.0 - 19.25 probable**.
- Para 19.5 en 2 semanas, necesitás además un diferenciador técnico claro (quantile listo y estable), lo veo justo pero no seguro.

---

## Tabla resumen

| Sprint | Horas plan | Horas reales | Riesgo | Recortable |
|--------|-----------|--------------|--------|------------|
| S1 | 10 | 14 | Medio | Parcial (breakdown avanzado) |
| S2 | 12 | 18 | Medio-Alto | Parcial (alcance Notebook 11) |
| S3 | 25 | 40-48 | Alto | Sí (S3.2/S3.3/S3.5) |
| S4 | 12 | 14 | Medio | Parcial (Q&A 10→5) |

---

## Cierre Codex

> No te diría que 19.5 está **garantizado**; sí es **alcanzable** con foco brutal en S1+S2+entregables de defensa.
>
> Si tengo que elegir **una sola cosa innegociable: contrafactual visible + evidencia de error analysis** (impacta rúbrica técnica y discurso).
>
> Todo lo demás (POIs premium, Nexo, dark mode) es secundario frente a eso.

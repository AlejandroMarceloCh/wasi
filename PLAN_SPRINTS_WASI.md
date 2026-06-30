# PLAN DE SPRINTS — WASI (iteración post-feedback 24-25 jun 2026)

> **Objetivo:** "ambos a la vez" (entrega/defensa curso DS3022 + base para producto). Ejecución: Alejandro + Claude codeando juntos en `~/Desktop/PROYECTOS_2026/Proyecto_DPD/`.
> **Fuentes del feedback:** 6 videos usabilidad (`Transcripciones/output_video/`) + 3 expertos (`Transcripciones/output/`: Juan real-estate, UTEC técnico, propietario real). Reporte crudo: `FEEDBACK_AUDIT_WASI.md`. Este plan ya pasó verificación adversarial.

---

## 0. ESTADO DE EJECUCIÓN — actualizar al cerrar CADA sprint

> ⚠️ PROTOCOLO: al terminar un sprint, ANTES de seguir o de cualquier compact, llenar su fila aquí y su bloque de bitácora (§3.ter). Verificar con `cat` que quedó escrito. Esto es lo que sobrevive a un autocompact.

| Sprint | Estado | Fecha cierre | Tests verdes | Commit |
|--------|--------|--------------|--------------|--------|
| 1 — Data leak | ✅ cerrado | 2026-06-27 | 127 passed, 2 skip | (sin commit aún) |
| 2 — Bugs demo | ✅ cerrado | 2026-06-27 | JSX OK + 127 pytest | (sin commit aún) |
| 3 — Validaciones | ✅ cerrado | 2026-06-27 | 130 pytest + JSX OK | (sin commit aún) |
| 4 — Dirección + % | ✅ cerrado | 2026-06-27 | 131 pytest + JSX OK | (sin commit aún) |
| 5 — Fotos + mapa | ✅ cerrado | 2026-06-27 | 134 pytest + JSX OK | (sin commit aún) |
| 6 — Narrativa (opc) | ✅ verificado | 2026-06-27 | ya cubierto en código | (sin cambios) |
| GATE final (§3.bis) | 🟡 A verde / B pendiente | 2026-06-27 | A: 134 pytest + JSX OK | falta E2E manual + informe |

Estados: ⬜ pendiente · 🔄 en curso · ✅ cerrado · ⚠️ cerrado-con-deuda (anotar deuda en bitácora).

### 🔴 DEUDA ACUMULADA — revisar con el usuario AL FINAL (no dejar nada en el aire)

> Cualquier tarea pactada que NO se implementó tal cual (no aplica, se difirió, se cambió de alcance, o requiere acción del usuario) se anota acá EN EL MOMENTO. Al cerrar todos los sprints, este es el checklist de cierre que reviso con Alejandro.

| Sprint | Item pactado | Qué pasó | Acción pendiente |
|--------|--------------|----------|------------------|
| S1 | Re-split train/serve + reentrenar | NO se hizo: el MAPE ya era espacial honesto, reentrenar habría sido destructivo | Ninguna — decisión correcta, ver bitácora S1 |
| S2 | P-05 debounce de precios absurdos | NO aplica: en `seller` el cálculo es botón manual, no en vivo | Confirmar en demo que no hay otro flujo con recálculo por tecla |
| S2 | Checklist E2E manual (pasos 3-4) | Pendiente: requiere navegador | **Alejandro** corre el E2E del GATE §3.bis |
| S3 | Antigüedad `min=1` | NO se hizo a propósito: antigüedad 0 = "a estrenar" es válido; la fuente (Propietario 2) solo objetaba dormitorios=0 | Ninguna — decisión de dominio correcta |
| S3 | Errores inline junto al campo (P-08) | Parcial: los Steppers previenen en la fuente (no se llega a 0) → error inline redundante ahí | Decidir si poner inline en inputs de texto (precio/área) en S4/S5 |
| S4 | "$X/mes por categoría" de POI | NO se hizo: sería data-incorrecto (importancia global ≠ efecto SHAP del inmueble). Se hizo peso relativo en su lugar | Confirmar con Alejandro que el peso relativo es suficiente para Inq5 |
| S4 | Refactor `EntornoMapScreen` a `AddressSearch` | NO se hizo: se dejó su buscador inline para no arriesgar la pantalla que funciona | Unificar (DRY) cuando haya holgura — opcional |
| S4 | Footer fuente en card importancia (P-12) | NO aplica: ya existe en EntornoMapScreen; en la card de importancia sería fuente incorrecta | Ninguna |
| S5 | 🔴 **Agregar amenities valiosas BAJA el precio en v2** | HALLAZGO NUEVO al testear P-17: quitar seguridad/ascensor está OK (baja), pero "Agregar cocina equipada/amoblado/terraza/walk-in" da delta NEGATIVO. Artefacto del modelo v2, no de UI | **Hablar con Leo** (reentrenar / revisar encoding de amenities). Afecta credibilidad del simulador en la demo — **decidir si ocultar amenities con signo incoherente hasta el fix** |
| S5 | Foto: upload real desde dispositivo (P-10) | Solo se mejoró el copy; el upload+S3 es backlog | Backlog producto (no curso) |
| S5 | P-15 copy "Barranco" | NO reproducible: la nav ya limpia el prefill (`app.jsx:135`) y "Barranco" es el distrito real del geo_lookup, no hardcodeo | Ninguna |
| S5 | Leyenda de clusters (P-13) | Ya existía (`screens-listings.jsx:264`); solo se reforzó + tooltip | Ninguna |

### Cómo retomar tras un compact (leer en este orden)
1. Esta tabla §0 → ¿cuál es el primer sprint no-✅? Ese es el activo.
2. Su bloque en §3.ter (bitácora) → qué se hizo y qué quedó a medias.
3. Su sprint en §3 → tareas (archivo:línea) y Done/test.
4. `cd app/backend && pytest -q` → baseline real antes de tocar nada.
5. Memoria del proyecto: `~/.claude/proyectos/proyecto-dpd.md` y `session.log` en la raíz.

---

## 1. Veredicto de calidad del feedback

Sobrevivió lo importante: el **DATA LEAK del FairValue está CONFIRMADO verbatim** ("estás haciendo data leak", UTEC L114) y mapeado a código real — es el hallazgo más serio. También sobreviven todos los bugs de formulario (precio que se sobrescribe, antigüedad/dormitorios=0, validaciones al fondo, sin autocomplete de dirección, foto solo-URL), la confusión con porcentajes del entorno, y la tesis B2B de Juan.

Se cayó o se infló bastante en el **storytelling**: el "¡qué bacán! por datos SIDPOL de Propietario 2" es doblemente falso (era Inquilino 5 y no había SIDPOL — la fuente real es `sistip_poi` de la SBS); el "Tottus excluido por radio" es inventado (era el inmueble mismo cayendo fuera del círculo de comparables, no un POI); los "scores 4-5 en todas las sesiones" es falso (hay un 3 explícito y sesiones sin score); BUG-02 (amenities invertidas) es artefacto del modelo v1, no bug del código; el "consenso de 3 expertos B2B" y "data leak línea 114" no eran verificables con las 6 fuentes asignadas pero sí se confirman en los transcripts de UTEC/Juan. **BUG-02 no es bug**: con v2 el signo es correcto.

---

## 2. Lista maestra de problemas REALES

| ID | Problema | Tipo | Sev | Ubicación | Esf | Curso | Producto |
|----|----------|------|-----|-----------|-----|-------|----------|
| P-01 | Data leak: `geo_index.csv` = mismo dataset de training; listings del catálogo siempre "Justo" | bug-modelo | **Crítica** | `build_geo_index.py:17,30-47`; `geo_index.py:117-176`; `ml.py:454-468` | M | **Máximo** | Alto |
| P-02 | Confianza Alta/Media/Baja no penaliza proximidad a training (`dist_nearest_km` ignorado) | bug-modelo | Alta | `geo_index.py:139-141`; `ml.py:454-468` | S | Alto | Alto |
| P-03 | Botón "Publicar" no responde ni explica por qué (submit silencioso si `!formOk`) | bug-ui | **Crítica** (demo) | `screens-seller.jsx:280,91-92` | M | Alto | Alto |
| P-04 | Precio sugerido sobrescribe lo que el usuario escribió (línea 71 incondicional) | bug-ui | Alta | `screens-seller.jsx:71,238` | M | Alto | Alto |
| P-05 | Precios absurdos ($16457/$1591) al recalcular en vivo — sin debounce | bug-ui | Alta (demo) | `screens-seller.jsx:238,49-50,245-248` | S | Alto | Medio |
| P-06 | Antigüedad permite 0 | friccion/validación | Media | `screens-seller.jsx:25,181-182`; `screens-fairvalue.jsx:237`; `schemas.py:111` | S | Medio | Medio |
| P-07 | Dormitorios permite 0 si no es estudio | friccion/validación | Media | `screens-seller.jsx:183-184`; `schemas.py:107,270,119` | S | Medio | Medio |
| P-08 | Errores de validación al fondo del form, lejos del campo | friccion | Media | `screens-seller.jsx:271-274,201-205,245-249` | M | Medio | Medio |
| P-09 | Sin buscador/autocomplete de dirección (arrastre de pin frustrante) | feature | Alta | `screens-core.jsx:14-82`; `screens-fairvalue.jsx:1379-1567` | S | Alto | Alto |
| P-10 | Sin fotos del inmueble (bloqueante de decisión inquilino) | feature | Alta | `screens-seller.jsx:214-215`; `components.jsx:128-129`; `models.py:136` | S→L | Alto | Alto |
| P-11 | Porcentajes del entorno sin contexto (1.25% sin escala ni $; no se dice que suman -5.7%) | feature/UX | Alta | `screens-listings.jsx:380-432`; `model_service.py:poi_importance()` | M | Alto | Alto |
| P-12 | Fuente de datos no visible en `PoiInsightCard` (sí en mapa standalone) | feature/UX | Media | `screens-listings.jsx:426-434` vs `screens-fairvalue.jsx:1666-1669` | S | Alto | Medio |
| P-13 | Sin leyenda de qué significan los números en clusters del mapa | feature/UX | Media | `screens-listings.jsx:242-298,146-167` | S | Medio | Medio |
| P-14 | Sin botón "borrar propiedad" publicada | feature | Media | (Mis Propiedades — no mapeado en insumo) | S | Medio | Medio |
| P-15 | Copy IA dice "Barranco" hardcodeado (no herencia de coords) | bug-ui | Baja | `screens-fairvalue.jsx:27-40,1379-1381` | S | Bajo | Bajo |
| P-16 | Pin no se ve arrastrable; POIs en el borde del radio se excluyen | friccion | Baja | `screens-core.jsx:34-42`; `display_pois.py:145-146` | S | Bajo | Medio |
| P-17 | BUG-02 amenities invertidas — **artefacto de v1, NO bug**; falta test de regresión | bug-modelo | Baja | `ml.py:509-571`; `test_counterfactuals.py:109-121` | S | Medio | Bajo |
| E-01 | Pivote B2B (suscripción a inmobiliarias, benchmark automatizado) | estrategia | — | producto | L | Bajo | **Máximo** |
| E-02 | Renombrar "FairValue" a español; precio aviso vs cierre; high/low-end | estrategia/modelo | — | varios | M-L | Medio | Alto |

---

## 3. PLAN POR SPRINTS

### Sprint 1 — Cerrar el DATA LEAK (lo que un profe de DS detecta al toque)

**Goal:** El FairValue deja de devolver "Justo" automático para listings del catálogo; confianza penaliza proximidad a training; queda test que lo demuestra.

**Tareas:**
- `build_geo_index.py:17,30-47` — generar dos índices: `geo_index_train.csv` (85%, GroupKFold por distrito) para entrenamiento y `geo_index_serve.csv` (100%) para serving. Reentrenar el modelo usando solo el train.
- `geo_index.py:139-141` (método `lookup()`) — exponer flag `is_in_training_set = dist_nearest_km < 0.1` (100m, configurable).
- `ml.py:454-468` (`_confianza`) — si `is_in_training_set`, forzar `confianza='Baja'` independiente de `n_comparables`.
- `ml.py:predict_fair_value` — si cae en training, agregar warning: "Inmueble muy similar a datos de entrenamiento; estimación posiblemente sesgada."

**Done / test:** `app/backend/tests/test_ml_leakage.py`:
- `test_training_listing_low_confidence`: tomar 50 listings de `inmuebles_clean_v2.csv`, llamar `geo_lookup` → `is_in_training_set=True` y `confianza=='Baja'`.
- `test_leak_zone_differs`: con holdout real, dato del dataset vs dato sintético a 5km deben diferir en zona/confianza (hoy ambos quedan "Justo").

**Por qué primero:** Es el único hallazgo confirmado verbatim por el experto y el más penalizable en la rúbrica (Datos&Modelo/7). Todo lo demás es UI. Re-split cambia las métricas del informe → hay que hacerlo antes de congelar números (ver Riesgos).

---

### Sprint 2 — Bugs bloqueantes de demo (flujo propietario)

**Goal:** El propietario puede publicar sin quedarse trabado y el precio no hace cosas raras frente al jurado.

**Tareas:**
- `screens-seller.jsx:91-92,271-274` — submit silencioso → banner que lista campos faltantes ("Completa: Teléfono mín. 6, Email válido"); capturar error de red por separado.
- `screens-seller.jsx:71` — cambiar a `if (fv != null && !priceUserTyped) set('price_usd', ...)`; agregar estado `priceUserTyped` seteado en onChange (línea 238). No sobrescribir lo que el usuario escribió.
- `screens-seller.jsx:238` — debounce 300-500ms en onChange del precio (o pasar a `onBlur`); ocultar mensaje de error hasta post-debounce. Mata los $16457/$1591.

**Done / test:**
- Manual: dejar teléfono vacío + click Publicar → banner específico. Calcular → editar precio a 950 → recalcular → sigue 950.
- pytest: `test_create_listing_seller_validation_errors` (falta contact_phone) y `test_publish_screen_price_no_overwrite_on_recalc`.

**Por qué segundo:** Sin esto la demo se rompe en vivo (P-03 lo confirmó el moderador). No depende de Sprint 1.

---

### Sprint 3 — Validaciones de formulario coherentes

**Goal:** No se publican inmuebles con dormitorios/antigüedad=0; los errores salen junto al campo.

**Tareas:**
- `screens-seller.jsx:182` y `screens-fairvalue.jsx:237` — Stepper antigüedad `min={1}`.
- `screens-seller.jsx:183-184` y `screens-fairvalue.jsx:239` — Stepper dormitorios `min={f.es_estudio ? 0 : 1}`.
- `schemas.py` — `@field_validator` en `ListingIn` y `PredictIn`: `if not es_estudio and dormitorios==0: raise`; rechazar `antiguedad_anios==0` para residencial (o documentar 0="sin determinar").
- `screens-seller.jsx` — error inline bajo cada Stepper en vez de solo banner del paso 4.

**Done / test:** pytest en `test_listings.py`: `ListingIn(dormitorios=0, es_estudio=False)` y `antiguedad_anios=0` levantan `ValueError`. Manual: stepper deshabilita "-" en el mínimo.

**Por qué tercero:** Barato (S), refuerza Datos&Modelo, y limpia el flujo que ya tocamos en Sprint 2.

---

### Sprint 4 — Features de alto impacto: dirección + comunicación de %

**Goal:** El propietario encuentra su dirección escribiendo, y el inquilino entiende qué significan los porcentajes del entorno.

**Tareas:**
- `screens-core.jsx:14-82` — `MapPicker` acepta prop `searchable` (default false); reusar el bloque Photon de `EntornoMapScreen` (`screens-fairvalue.jsx:1398-1460`) + `setFlyTo` existente (49-56). Activar `searchable` en FairValueForm paso 1 y en PublishScreen.
- `screens-listings.jsx:380-432` (`PoiInsightCard`/`PoiImportanceD3`) — frase ancla antes del gráfico: "Estos factores del entorno representan ~-5.7% del peso total del modelo"; mostrar cada item como `%` **y** `~$X/mes` = `(pct/100)*fair_value`.
- `model_service.py:poi_importance()` — agregar `pct_of_env_total` por item.
- `screens-listings.jsx:433` — footer de fuente reusado de `screens-fairvalue.jsx:1666-1669` ("Fuente: OpenStreetMap · MININTER").

**Done / test:** Manual: escribir "San Martín de Porres" → mapa centra <5s. `PoiInsightCard` muestra $ y la frase ancla y la fuente. pytest: `poi_importance()` suma en [4-8]% y cada item trae `pct` + `pct_of_env_total`.

**Por qué cuarto:** Son las fricciones más citadas (dirección: Prop1+Prop2; %: Inq5 el más articulado) y suben UX/5 + Innovación/3. Depende de que el modelo (Sprint 1) ya esté estable para los $ derivados.

---

### Sprint 5 — Fotos + pulido visual del mapa

**Goal:** El inquilino ve algo más que un placeholder; el mapa se autoexplica.

**Tareas:**
- `screens-seller.jsx:214-215` — para el curso (esfuerzo S): cambiar label a "Foto del inmueble (pega URL de Google Fotos/Drive)" + hint con ejemplo. **Para producto (L, backlog):** `POST /api/listings/upload-image` multipart + S3 + `models.py:136`.
- `screens-listings.jsx:245-265` — leyenda de clusters: "Los números = cuántos avisos hay en la zona. Zoom para ver precios."; tooltip `title` en `divIcon`.
- `screens-seller.jsx` (Mis Propiedades) — botón "Borrar" (P-14, pedido literal "falta borrar").
- `screens-fairvalue.jsx:27-40` — fijar default neutro LIMA_CENTRO y pasar `prefill={}` en "Nuevo análisis" (P-15/coords).
- `test_counterfactuals.py:121` — agregar `test_counterfactual_signo_coherente_amenities` (quitar seguridad/ascensor < 0 en v2) para blindar P-17.

**Done / test:** Manual: leyenda explica los números; borrar funciona; nuevo análisis no hereda Barranco. pytest amenities verde.

**Por qué quinto:** Cierra los pendientes UX restantes. Fotos full (upload+S3) es producto, no curso → solo el copy-fix entra acá.

---

### Sprint 6 (opcional, si hay tiempo) — Narrativa de defensa + honestidad de datos

**Goal:** El producto comunica sus límites como fortaleza (lo que el experto pidió: "no muestres datos por vender").

**Tareas:**
- Renombrar "FairValue" → "Análisis de precio" en UI (E-02, pedido UTEC).
- `display_pois.py:145-146` — buffer +50m en el filtro de radio (P-16, error de haversine).
- Slide/sección en el informe explicando el fix del data leak y el nuevo split (convierte la debilidad en rigor demostrado).
- Disclaimer "precio de aviso, no de cierre" donde se muestra el precio (cita UTEC L478).

**Done / test:** Revisión visual + el informe refleja las métricas post-split (no las viejas).

---

## 3.bis — GATE DE ACEPTACIÓN FINAL (al cerrar TODOS los sprints)

> No se da por terminado el plan hasta pasar este gate. Valida que los sprints no se rompieron entre sí y que el producto está listo para la defensa. Es el "test al finalizar todo" — distinto de los Done/test por sprint.

**Goal global:** ningún hallazgo verificado sigue abierto, la suite completa pasa en verde, y el informe defiende números honestos (post-data-leak).

### A. Suite automatizada completa (debe correr toda junta, no por partes)
```bash
cd app/backend && pytest -q          # 16 archivos baseline + nuevos de Sprints 1/2/3/5
```
Verde obligatorio en, como mínimo:
- `test_ml_leakage.py` (Sprint 1) — leak cerrado
- `test_listings.py` (Sprint 3) — validaciones dormitorios/antigüedad
- `test_counterfactuals.py::test_counterfactual_signo_coherente_amenities` (Sprint 5) — v2 con signo correcto
- Los 16 baseline NO deben haberse roto por el re-split (regresión).

### B. Checklist E2E manual (un solo recorrido, los dos flujos)
| # | Paso | Resultado esperado |
|---|------|--------------------|
| 1 | Inquilino: abrir listing del **catálogo** y correr FairValue | confianza **Baja** + warning de cercanía a training (no "Justo" automático) — P-01/02 |
| 2 | Inquilino: ver breakdown de entorno | cada % muestra también `~$X/mes` + frase ancla del -5.7% + fuente visible — P-11/12 |
| 3 | Propietario: form con teléfono vacío → Publicar | banner específico de campos faltantes (no submit mudo) — P-03 |
| 4 | Propietario: calcular precio → editar a 950 → recalcular | queda 950, sin valores absurdos — P-04/05 |
| 5 | Propietario: intentar dormitorios=0 (no estudio) | bloqueado con error inline — P-06/07/08 |
| 6 | Propietario: escribir "San Martín de Porres" en el mapa | centra en <5s sin arrastrar pin — P-09 |
| 7 | Mis Propiedades: borrar una publicación | desaparece — P-14 |
| 8 | Nuevo análisis | no hereda "Barranco" — P-15 |

### C. Gate de modelo/informe (lo académicamente crítico)
- [ ] Producción carga **v2 (XGBoost)**, no v1 — confirmar `model_service` (blinda P-17 en la demo).
- [ ] MAPE/R² del informe son los **post-split** (recalculados tras Sprint 1), no los viejos inflados.
- [ ] El informe tiene la sección que explica el fix del leak como rigor (convierte la debilidad en fortaleza).

**Criterio de cierre:** A en verde + B 8/8 + C 3/3. Si algo falla, vuelve al sprint dueño de ese ID antes de declarar terminado.

---

## 3.ter — BITÁCORA DE EJECUCIÓN (llenar al cerrar cada sprint)

> Una entrada por sprint. Escribir en el momento del cierre, no después. Si el contexto se está por acabar, esto es lo prioritario a persistir. Mantener conciso: qué se cambió (archivo:línea reales), qué test quedó verde, qué se desvió del plan, qué quedó como deuda.

### Sprint 1 — Data leak  ✅ (2026-06-27)
- **Estado:** ✅ cerrado
- **DIAGNÓSTICO CORREGIDO (clave):** el "data leak" NO era de métricas. Verificado en `ml.py:67-70`: el MAPE 16.42% ya se calcula con GroupKFold espacial SIN leakage de ubicación. El leak es **local a una pantalla**: "Analizar este precio" sobre un aviso del catálogo (mismos listings de training) → el modelo predice ~su propio precio → "Justo" trivial. El estudiante mismo lo dijo en el transcript UTEC L115 ("el fair value SÍ funciona en su vista principal"). **NO se reentrenó nada** — habría roto golden predictions + manifest hashes y no había MAPE inflado que arreglar. El "riesgo #1" del plan (recongelar informe) quedó anulado.
- **Archivos tocados:**
  - `app/backend/schemas.py:112-116` — `PredictIn.from_catalog: bool = False`
  - `app/backend/ml.py:32-40` — `TRAIN_PROXIMITY_KM = 0.05` + `_LEAK_WARNING`
  - `app/backend/ml.py:_es_proximo_a_training()` + `_confianza(geo, from_catalog)` — fuerza "Baja"
  - `app/backend/ml.py:predict_fair_value` — agrega warning a `warnings` cuando hay proximidad
  - `app/screens-fairvalue.jsx:111-116` — conectado `from_catalog: fromCatalog` (el estado existía pero NO se enviaba)
- **Qué se hizo:** aviso del catálogo o pin a <50 m de un listing → `confidence='Baja'` + warning honesto ("forma parte de los datos de entrenamiento; veredicto referencial"). No toca el modelo ni el informe.
- **Tests:** `tests/test_ml_leakage.py` (3 tests nuevos) + suite completa → `pytest -q` = **127 passed, 2 skipped**.
- **Desviaciones vs plan:** el plan original pedía re-split + reentrenar (esfuerzo M, riesgoso). Se reemplazó por fix local (esfuerzo S) tras verificar el código. Ver memoria `project_wasi_dpd_dataleak`.
- **Deuda / pendiente:** ninguna. (Opcional futuro: mostrar el warning de leak con estilo destacado en el card del frontend, hoy va en la lista `warnings` estándar.)
- **MAPE/R² post-split:** N/A — no hubo re-split. Métricas del informe se mantienen (16.42% espacial, ya honesto).

### Sprint 2 — Bugs demo  ✅ (2026-06-27)
- **Estado:** ✅ cerrado
- **Archivos tocados:** todo en `app/screens-seller.jsx` (`PublishScreen`):
  - estado nuevo `priceUserTyped` (init desde prefill)
  - `calcular()` línea ~74 — `if (fv != null && !priceUserTyped)` antes de pre-rellenar el precio (P-04)
  - helper `camposFaltantes()` — lista legible de lo que falta
  - `submit()` — si `!formOk` muestra banner "Para publicar, completa: …" en vez de no hacer nada (P-03)
  - input de precio — `onChange` marca `setPriceUserTyped(true)`
  - botón Publicar — `disabled={submitting}` (antes `!formOk || submitting`, por eso quedaba mudo)
- **Qué se hizo:** P-03 (botón mudo → banner de campos faltantes) y P-04 (precio del usuario ya no se pisa con el sugerido; la referencia se ve en el Tag).
- **Tests:** sin tests frontend en el repo (es JSX vanilla + Babel standalone in-browser). Validado: ambos `.jsx` transpilan limpio con `@babel/preset-react`. Backend `pytest -q` = 127 passed, 2 skipped (sin regresión). Pendiente checklist manual E2E (pasos 3 y 4 del GATE §3.bis).
- **Desviaciones / deuda:** **P-05 (debounce de precios absurdos) NO aplica** — en `seller` el precio sugerido se calcula con botón manual (`calcular`), no en vivo; el `$16457` de Propietario 2 fue otro flujo. No hay recálculo por tecla que debounce-ar. Errores inline junto al campo (P-08) quedan para Sprint 3.

### Sprint 3 — Validaciones  ✅ (2026-06-27)
- **Estado:** ✅ cerrado
- **Archivos tocados:**
  - `app/screens-seller.jsx` — Stepper dormitorios `min={f.es_estudio?0:1}`; toggle estudio→no-estudio fuerza `Math.max(1, dorm)` (P-07)
  - `app/screens-fairvalue.jsx` — mismos 2 cambios en el form de análisis
  - `app/backend/schemas.py` — `PredictIn` y `ListingIn`: validator extendido `_no_cero_sin_estudio` rechaza `dormitorios==0 and not es_estudio`
  - `app/backend/tests/test_schemas.py` — 3 tests nuevos (dorm 0 sin estudio falla / con estudio ok / antigüedad 0 válida)
- **Qué se hizo:** dormitorios=0 ya no es posible para no-estudio (frontend lo previene en el Stepper, backend lo rechaza como defensa). Baños ya estaba resuelto. El caso estudio→no-estudio sube dormitorios a 1.
- **Tests:** `pytest -q` = **130 passed, 2 skipped** (3 nuevos). JSX transpila limpio.
- **Desviaciones / deuda:** ver tabla de deuda — **antigüedad NO se forzó a min=1** (el plan lo pedía, pero la fuente real solo objetaba dormitorios; antigüedad 0 = a estrenar es válido). **Errores inline junto al campo (P-08) NO se hicieron** — el Stepper previene en la fuente (no se puede llegar a 0), así que el error inline es redundante para steppers; queda pendiente solo para inputs de texto (precio/área) si se decide en S4/S5.

### Sprint 4 — Dirección + %  ✅ (2026-06-27)
- **Estado:** ✅ cerrado
- **Archivos tocados:**
  - `app/screens-core.jsx` — componente nuevo `AddressSearch` (buscador Photon + autocomplete, autocontenido, sin clases `efm-*` del overlay)
  - `app/screens-seller.jsx` + `app/screens-fairvalue.jsx` — estado `flyTo` + `<AddressSearch onPick=…/>` arriba del MapPicker, `flyTo` pasado al MapPicker
  - `app/backend/model_service.py:poi_importance()` — agrega `pct_of_env_total` (peso relativo dentro del entorno, suma 100%)
  - `app/screens-listings.jsx` — `PoiImportanceD3` muestra el relativo + (% absoluto); copy del `PoiInsightCard` reescrito para que el % se dimensione
  - `app/backend/tests/test_v2_features.py` — test `poi_importance` trae pct_of_env_total y suma 100%
- **Qué se hizo:** (A) buscador de dirección con autocomplete en ambos forms (lo pidieron Propietario 1 y 2). (B) los % del entorno ahora muestran peso RELATIVO (resuelve la queja de Inquilino 5 de no poder dimensionar 1.25%).
- **Tests:** `pytest -q` = **131 passed, 2 skipped**. 4 JSX transpilan limpio. Pendiente E2E manual (buscar "San Martín de Porres" → centra el mapa).
- **Desviaciones / deuda:** ver tabla. **(1) NO se hizo el "$X/mes por categoría"** que pedía el plan — sería data-incorrecto: `poi_importance` es importancia GLOBAL del modelo, no efecto SHAP en un inmueble; el $/mes real ya vive en el análisis detallado (narrative SHAP). **(2) Footer de fuente (P-12) ya existía** en EntornoMapScreen (`screens-fairvalue.jsx:1672`: OSM · MININTER · CENACOM) — no se duplicó en la card de importancia (sería fuente incorrecta). **(3) `EntornoMapScreen` NO se refactorizó** para usar `AddressSearch` — quedó con su buscador inline propio para no arriesgar la pantalla que ya funciona (deuda DRY menor).

### Sprint 5 — Fotos + mapa  ✅ (2026-06-27)
- **Estado:** ✅ cerrado
- **Archivos tocados:**
  - `app/screens-seller.jsx` — campo foto con hint (pegar URL; upload "pronto"); botón **Borrar** en `MyListingRow` (confirm nativo) + estado `deleting` + `onDeleted=load`
  - `app/screens-listings.jsx` — tooltip `title` en cluster + leyenda reforzada ("acerca el zoom para ver precios")
  - `app/api.js` — `deleteListing(id)`
  - `app/backend/routers/listings.py` — `DELETE /listings/{id}` (solo dueño, cascade limpia leads/favoritos, 404 si ajeno)
  - `app/backend/tests/test_listings.py` — 2 tests (borrar dueño 204 + ajeno 404)
  - `app/backend/tests/test_counterfactuals.py` — test P-17 (quitar seguridad/ascensor no sube precio en v2)
- **Qué se hizo:** foto (copy, P-10 parcial), leyenda clusters (P-13), borrar propiedad (P-14), test que blinda P-17.
- **Tests:** `pytest -q` = **134 passed, 2 skipped** (3 nuevos). JSX limpio.
- **Desviaciones / deuda:** ver tabla — hallazgo NUEVO (agregar amenities baja precio en v2), upload real (backlog), P-15 no reproducible, P-13 ya existía.

### Sprint 6 — Narrativa (opcional)  ✅ verificado (2026-06-27)
- **Estado:** ✅ cerrado — ya cubierto en código, sin cambios necesarios
- **Hallazgo:** las 4 tareas ya estaban hechas o no aplican (verificado, no se tocó código):
  1. **Renombrar "FairValue"→español: YA HECHO.** No hay "Fair Value" visible; la UI dice "Analizar precio" (`app.jsx:69`, `components.jsx:426+`). Lo único restante son nombres internos de componentes (`FairValueForm`/`FairValueResult`) — churn sin valor visible, se deja.
  2. **Disclaimer "aviso vs cierre": YA EXISTE** (`screens-fairvalue.jsx:500, 1052`).
  3. **Buffer +50 m radio POI (P-16): NO es bug** — `display_pois.py:146` usa `d_m <= radius_m` (el borde exacto entra); ampliar mostraría POIs fuera del radio real (incorrecto). El "Tottus fuera del círculo" ya estaba marcado embellecido en la verificación.
- **Pendiente (NO es código):** sección del informe `.tex` explicando el fix del data leak local como rigor — tarea de Alejandro en Overleaf.

### GATE final  🟡 (2026-06-27)
- **A (automatizado): ✅ VERDE** — `pytest -q` = 134 passed, 2 skipped (sin regresión; +11 tests nuevos en S1/S3/S4/S5). Los 5 tests clave por sprint pasan. TODOS los `.jsx` transpilan limpio con `@babel/preset-react`.
- **B (E2E manual 8 pasos): ⬜ PENDIENTE** — requiere navegador; lo corre Alejandro (buscar dirección, publicar con campo faltante, no-overwrite del precio, dorm=0 bloqueado, borrar, etc.).
- **C (modelo/informe): 🟡 parcial** — v2 cargado y validado (golden + manifest OK, confirmado en cada arranque del backend). MAPE/R² del informe SIN cambios (no hubo re-split, ver S1). Falta: sección del informe sobre el fix del leak (Overleaf, Alejandro).
- **Criterio de cierre:** A ✅ · B ⬜ · C 🟡 → **el gate cierra cuando Alejandro complete B y la sección del informe.**

---

## 4. Backlog / fuera de alcance (producto, no curso)

- **Pivote B2B completo** (E-01): suscripción mensual pagada por inmobiliarias, benchmark automatizado vs "los dos jóvenes", detección de outliers que desvían promedios distritales, anti-desintermediación. Es la tesis de Juan y el camino de monetización, pero es un cambio de modelo de negocio, no de sprint.
- **Módulo inversor ROI/payback** (Juan lo enmarcó como B2C).
- **Foto: upload real** multipart + S3 + signed URLs (`POST /api/listings/upload-image`).
- **Real-time / frecuencia de scraping** menor a 3 semanas + almacenar URLs temporales en bucket S3 (UTEC L7).
- **Dos modelos high-end/low-end con orquestador** por segmento (UTEC L435-452).
- **Precio de cierre vs aviso** para reportar rango de negociación (requiere data nueva).
- **Integración con corredor / asesoría legal / filtro de inquilinos** (New Recording) — cambia el producto de "pricing" a "gestión integral".
- **Indicador de seguridad/denuncias** con fuente oficial (Inq5), búsqueda por POI cercano (FR-25).
- **Deduplicación de Property por external_id** (`models.py`) — necesario para el data leak en producción, no urgente para el curso.

---

## 5. Riesgos

1. **El re-split del data leak cambia las métricas del informe.** Hoy reportas MAPE 15.8-16.4% probablemente inflado por el leak. Tras separar train/serve, el MAPE honesto va a subir. **Hay que reentrenar y recalcular ANTES de congelar el informe** — si no, defiendes números que el propio fix invalida. Esto es bueno académicamente (rigor), pero planifícalo: no metas el informe final antes del Sprint 1.

2. **Reentrenar puede degradar la cobertura por distrito.** GroupKFold por distrito con holdout 15% puede dejar distritos con pocas muestras sin geo_serve adecuado. Verificar que `geo_index_serve.csv` queda 100% (solo el train se recorta).

3. **Esfuerzo del MapPicker searchable subestimado.** El insumo lo marca S, pero reusar Photon de `EntornoMapScreen` en dos pantallas distintas (FairValueForm + PublishScreen) puede destapar conflictos de estado/flyTo. Presupuestar M por si acaso.

4. **BUG-02 (amenities) es trampa narrativa.** Si en la demo corre v1 por accidente, las amenities se ven invertidas y el jurado lo nota. **Verificar que producción carga v2 (XGBoost)** antes de la defensa — el test de regresión del Sprint 5 lo blinda, pero confirma el `model_service` cargado.
# Plan de sprints — Resolución integral de hallazgos (Wasi)

**Base:** `docs/hallazgos/` (100 informes) → consolidado por ROI.
**Continúa** la numeración de `docs/BITACORA_FORMS.md` (Sprints 0–5 ya cerrados).
**Ámbito:** ~421 hallazgos abiertos (4 CRÍTICO, ~49 ALTO, resto MEDIO). Los ítems
"académicos" que no bloquean serving se agrupan y se hacen al final o se aceptan
como deuda documentada.

---

## Reglas innegociables (aplican a TODOS los sprints)

### Regla 1 — Sprint Goal
Cada sprint arranca con **un objetivo central concreto y verificable**. NO se cierra
"porque pasó el tiempo": se cierra **solo cuando el Goal está cumplido y demostrado**.
Si al final no se cumplió, el sprint sigue abierto.

### Regla 2 — Protocolo Anticagadas (QA profundo con agentes Sonnet)
Antes de cerrar cada sprint, fase de testeo obligatoria:
1. **Tests automáticos:** `WASI_RATELIMIT=0 WASI_SKIP_BULK_SEED=1 app/backend/venv/bin/python -m pytest app/backend/tests/ -q` → **piso 166 passed, 2 skipped**. Cero regresiones. Agregar tests para lo nuevo.
2. **Prueba manual e2e** del flujo tocado, incluidos los caminos de error, con backend :8001 + frontend :5500.
3. **Agentes Sonnet de regresión** (uno por área tocada, en paralelo). Prompt para cada uno:
   > *"Eres QA senior. Revisa TODO lo que cambió en el Sprint N (te doy la lista de archivos del diff: `git diff --name-only <commit_inicio>..HEAD`). Tu tarea: (a) verificar que los cambios hacen lo que dicen sin romper nada; (b) pruebas de regresión sobre los flujos ANTIGUOS que podrían haberse dañado — FairValue, catálogo, publicar, favoritos, leads, auth; (c) buscar efectos colaterales no previstos (contratos front↔back, estados de error, migraciones). Reporta cada riesgo con archivo:línea y cómo reproducirlo. NO cambies código. Español peruano neutro."*
   Repartir por área: un agente frontend, uno backend/DB, uno ML/datos (si aplica), uno de regresión de flujos. El orquestador (Claude Opus) consolida los reportes.
4. **Corregir todo lo que el QA encuentre** antes de cerrar. Sprint con hallazgos abiertos = no se cierra.

### Regla 3 — Guardado de progreso (bitácora)
Al cerrar cada sprint, **append** a `docs/BITACORA_FORMS.md` con este formato (memoria del
proyecto, sobrevive a compact):
```
## Sprint N — <título> — <fecha>
- **Sprint Goal:** <objetivo cumplido>
- **Hallazgos cerrados:** <IDs T### del consolidado>
- **Qué se cambió:** <archivos y qué en cada uno>
- **Decisiones técnicas:** <por qué así; alternativas descartadas>
- **Resultados de QA:** <pytest X/Y · pruebas manuales · hallazgos de los agentes Sonnet y cómo se resolvieron>
- **Riesgos / deuda aceptada:** <lo diferido y por qué es seguro>
- **Estado:** CERRADO ✅
```
Cada sprint también actualiza `docs/hallazgos/` marcando los IDs resueltos, o un
`docs/HALLAZGOS_ESTADO.md` con la tabla ID → estado (abierto/cerrado/deuda).

### Restricciones (todos los sprints)
- No romper el contrato congelado de FairValue (`PredictIn/PredictOut`).
- Migraciones de DB retrocompatibles (~3,300 listings sembrados).
- Sin dependencias nuevas de frontend salvo aprobación (build tool = decisión del usuario).
- No commitear a `main`. Todo en `refactor/modular`. Commit por sprint.
- Trabajar en lotes pequeños; correr pytest tras cada lote.

---

## Secuencia de sprints (ordenada por ROI)

### Sprint 6 — Seguridad y abuso  ·  esfuerzo S/M
**Sprint Goal:** cerrar los vectores de abuso y privacidad reales; ningún endpoint
crítico queda sin rate-limit y ninguna PII sensible se expone.
**Hallazgos:** T040 (rate-limit ML: predict/simulate/predict-venta/counterfactual), T040 (rate-limit `POST /leads`), T026 (PII: decisión sobre `contact_name` — alias u ocultar a no-dueño), T022 (enumeración de emails en registro → respuesta uniforme), T036 (JWT: whitelist de algoritmos; evaluar refresh/revocación), T040 (rate-limit `POST /listings`).
**Entrega:** rate-limits aplicados y testeados (429 humano ya existe), registro sin oráculo de enumeración, política de PII decidida y documentada.

### Sprint 7 — Credibilidad de UX  ·  esfuerzo S/M
**Sprint Goal:** que nada en la UI mienta ni confunda — mocks etiquetados, unidades
de precio correctas por operación, números del hero consistentes con la data real.
**Hallazgos:** T072 (hero carousel + histograma "Distribución real" → disclaimer o data real), T091/T081 (unidad `/mes` vs `total` por `operacion` en ListingCard y preview), T095/T072 (`stats.js`: distritos/avisos desde runtime, no hardcode 40/3,348), T074/T098 (mapa Explorar: no re-`fitBounds` al paginar), T076 (leyenda del mapa en dark mode), T077/T100 (race explain/narrative en FairValue: `reqId`+abort).
**Entrega:** UI sin datos mock disfrazados de reales, precios coherentes, mapa estable al paginar, sin cruce de narrativas.

### Sprint 8 — Performance y arranque  ·  esfuerzo M  ·  ⚠ GATE de build
**Sprint Goal:** reducir el TTI y el costo de arranque sin romper el setup, y decidir
el build de producción.
**Hallazgos:** T096 (React `.production.min.js` en vez de development; cache-busting `Date.now()` → versión fija; evaluar build mínimo esbuild), requests redundantes de FairValue (~6 llamadas), timeouts vs cold start de Render.
**GATE:** el bundler (esbuild) es **decisión del usuario** (rompe "sin build"). Default sin aprobación: React prod min + versión de cache fija (mejora grande, cero bundler). Si el usuario aprueba esbuild, se hace en este sprint.
**Entrega:** React producción + caché sana; propuesta de build documentada para aprobar.

### Sprint 9 — Coherencia de backend y datos  ·  esfuerzo M
**Sprint Goal:** que los datos servidos sean completos y coherentes, y que los scripts
de auditoría reflejen el modelo v2 real.
**Hallazgos:** T023/T031 (`GET /analyses/{id}` con paridad vs `predict`: counterfactuals + prediction_interval), T014b/T098 (counterfactual del detalle de venta usa modelo de venta, no alquiler), T025 (`sort=ganga`/`zone` no cargar catálogo completo: índice/precompute), T029 (health incluye `venta_service`), T069 (recuperar 415 avisos de Babilonia: `fillna` cocheras/banos; dedup espacial), T060/T062/T059 (scripts de auditoría/calibración apuntando a v2, no v1).
**Entrega:** historial de análisis completo, veredictos coherentes, catálogo que escala, health honesto, dataset de venta recuperado, scripts alineados a v2.

### Sprint 10 — Honestidad metodológica del ML  ·  ⚠ CRÍTICO · GATE A/B
**Sprint Goal:** que el número que se comunica (MAPE/R²) sea **reproducible desde el
repo** y honesto sobre su esquema de validación.
**Contexto:** verificado — `GroupKFold` solo existe para venta; el modelo de alquiler
no tiene validación espacial reproducible en notebooks/scripts; el nb05 selecciona
"Linear Regression" mientras producción corre XGBoost v2. El 16.4% "espacial" de
alquiler no se reproduce desde el código.
**GATE — decisión del usuario:**
- **Opción A (rápida, honesta):** reetiquetar en UI/README/slides — reportar el 16.4% como *validación estándar (KFold)* y destacar que la **validación espacial honesta está demostrada en venta (15.8%)**. Cambio de copy + un notebook mínimo que reproduzca el número que sí se reporta. Cero reentrenamiento. Defendible de inmediato. **(Recomendada si la defensa es pronto.)**
- **Opción B (correcta, pesada):** construir el GroupKFold espacial real para alquiler — clave `coord_cell`/H3, refit de target encoding + imputaciones + caps **solo en train por fold**, métricas pareadas (`r2_random` + `mape_spatial`), regenerar artefactos v2 con trazabilidad en manifest. 1–2 semanas. Recién ahí se cambian las cifras en UI.
**Hallazgos:** T001, T003, T004, T005, T006, T007, T008, T016, T017 (según opción).
**Entrega:** métrica comunicada = métrica reproducible desde el repo, con su esquema declarado sin ambigüedad.

### Sprint 11 — Accesibilidad y pulido final  ·  esfuerzo S/M
**Sprint Goal:** cerrar la deuda de a11y y las puntas sueltas de navegación que quedaron.
**Hallazgos:** T092/T034 (`aria-live` en ErrorBanner), T085 (focus-trap + foco inicial en Modal), T088 (anchors sin href focusables), T089 (AddressSearch con AbortController), T094 (historial del navegador / F5 / DashboardScreen huérfano / post-publicar abre el aviso), T049/T047/T050/T052 (lazy-init con lock — thread-safety), resto de MEDIOs de a11y/robustez.
**Entrega:** app navegable por teclado, sin pantallas huérfanas, sin races de red al desmontar.

### Sprint 12 — Deuda ML académica (opcional)  ·  esfuerzo M
**Sprint Goal:** limpiar la deuda de notebooks que no bloquea serving pero mejora la
narrativa técnica.
**Hallazgos:** T009 (podar features con importancia ~0), T010 (VIF/multicolinealidad), T012/T011 (amenities: flag `informado` vs `ausente` para separar MNAR), T014 (Jensen: smearing de Duan si vale), T015 (coverage P25–P75: conformal). Solo si NO se hizo la Opción B del Sprint 10.
**Entrega:** modelo más simple/honesto; solo si el usuario lo prioriza.

---

## Deuda aceptada (no accionar salvo pedido explícito)
Recuperación de contraseña / verificación de email (requiere email transaccional),
plan Pro/trial sin billing, Postgres en Render (infra), copy de validators backend
en inglés (cosmético), persistencia de prefs de perfil solo en localStorage.

---

## Orden recomendado y cadencia
6 → 7 → 8 → 9 → **10 (gate A/B)** → 11 → (12 opcional).
Sprints 6–9 y 11 son mecánicos y se pueden encadenar. El 10 necesita tu decisión A/B
**antes** de arrancar. Si la defensa es pronto: hacer 6–9 + **10 opción A** primero,
dejar 11–12 para después.

Cada sprint: Goal → lotes con pytest → **Protocolo Anticagadas (Sonnet)** → bitácora → commit.

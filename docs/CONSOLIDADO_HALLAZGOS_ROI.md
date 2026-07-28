# Consolidado de hallazgos Wasi — priorizado por ROI

**Fecha:** 2026-07-06 · **Fuente:** 100 informes `docs/hallazgos/t001–t100` · **Excluye:** ítems cerrados en `BITACORA_FORMS.md`

## Resumen ejecutivo

Se auditaron 100 archivos y se extrajeron **760 hallazgos** brutos; tras deduplicar y excluir **100 ya cerrados** en bitácora (Sprints 0–5) y **308 INFO**, quedan **~270 accionables** (ALTO/CRÍTICO/MEDIO).

Los **6 bloqueantes de producción** de la ronda anterior (venta e2e, tildes, gangas basura, editar/pausar, móvil, errores `[object Object]`) están **cerrados**. El riesgo residual se concentra en tres frentes: **(1) honestidad metodológica del ML** — MAPE 16.4% y R² 0.847 no comparten esquema verificable y no hay GroupKFold para alquiler en el repo; **(2) seguridad/abuso** — PII (`contact_name`), rate-limits ausentes en ML y leads; **(3) credibilidad UX** — mocks del home sin disclaimer, unidades “/mes” en venta, mapa que salta al paginar.

El camino de mayor ROI inmediato mezcla **quick wins de backend/frontend** (PII, rate-limit, copy, `/mes`) con **decisión estratégica sobre build** (React prod + cache) y un **Sprint C de re-entrenamiento** para alinear métricas con validación espacial honesta. Muchos hallazgos de scripts y notebooks son **académicos** (no bloquean serving actual) pero sí comprometen la narrativa ante inversionistas.

## Top 20 por ROI

| Rank | Severidad | Hallazgo | Evidencia | Esfuerzo | Impacto | Tareas |
|------|-----------|----------|-----------|----------|---------|--------|
| 1 | ALTO | `contact_name` del propietario expuesto a cualquier usuario autenticado en catálogo | `listings.py:154-172` | S | PII / privacidad; riesgo legal y desconfianza del propietario | T026 |
| 2 | ALTO | Endpoints ML (`predict`, `simulate`, `predict-venta`, `counterfactual`) sin rate-limit | `routers/fairvalue.py:85,146,169,216` | S | Abuso CPU/RAM; DoS por inferencias XGBoost ilimitadas | T040 |
| 3 | ALTO | `POST /listings/{id}/leads` sin rate-limit → spam de consultas | `routers/listings.py:365` | S | Harassment a propietarios; inbox flood | T040 |
| 4 | ALTO | React 18 **development** + cache-bust `Date.now()` + Babel runtime en cliente | `index.html:43-44,53-64,60-64` | M | TTI multi-segundo en 4G; cero cache entre visitas; bloquea escala real | T096 |
| 5 | ALTO | `ListingCard` y previews siempre muestran precio “/mes” aunque `operacion=venta` | `components.jsx:169-170` | S | Producto venta se ve roto; confusión de unidad de precio | T091,T081 |
| 6 | ALTO | Mapa Explorar hace `fitBounds` solo con los 24 ítems de la página actual | `screens-listings.jsx:177-196` | M | Mapa salta de zona al paginar; usuario cree ver los 3 396 avisos | T074,T098 |
| 7 | ALTO | Hero carousel e histograma presentan mocks como “datos reales” sin disclaimer | `screens-home.jsx:42-53,571-577` | S | Credibilidad frente a inversionistas; contradice promesa de evidencia | T072 |
| 8 | CRÍTICO | MAPE 16.4% y R² 0.847 mezclan esquemas de validación no verificables | `ml.py:60`, `modelo_final_v2.joblib` | L | Métricas de producto potencialmente deshonestas; narrativa académica sin script | T007,T008 |
| 9 | CRÍTICO | Alquiler: sin GroupKFold ni clave espacial en notebooks 04/05 | repo (solo train_venta.py:72-73) | L | Validación espacial 16.4% no reproducible; leakage residual en split aleatorio | T006 |
| 10 | ALTO | Target encoding v2 ajustado sobre dataset completo (no por fold) | train_venta.py:86-88 + artefacto v2 | L | MAPE espacial honesto requiere refit encoder por fold; artefacto final OK, métrica no | T001,T003,T004,T005 |
| 11 | ALTO | Race explain/narrative en FairValue al cambiar análisis rápido | `screens-fairvalue.jsx:825-867` | S | Narrativa de análisis A mezclada con datos de B; bug visible en flujo core | T077,T100 |
| 12 | ALTO | `GET /analyses/{id}` incompleto vs `predict` en vivo (sin counterfactuals/interval) | `fairvalue.py:48-83` | M | Historial de análisis engañoso; usuario pierde contexto guardado | T023,T031 |
| 13 | ALTO | `sort=ganga` y filtro `zone` cargan catálogo completo en memoria | `listings.py:239-253` | M | Latencia en home/explorar con 3 396+ avisos; no escala | T025 |
| 14 | ALTO | Counterfactual en detalle de venta usa modelo de alquiler | `screens-listings.jsx:736-741` | M | Palancas /mes incoherentes con precio total de venta | T098 |
| 15 | ALTO | `DISTRITOS: '40'` y `ALQ_AVISOS: '3,348'` no cuadran con catálogo live | `stats.js:6-7` vs `distritos_zona.json` | S | Números del hero desacreditados al comparar con Explorar | T095,T072 |
| 16 | ALTO | Babilonia eliminada al 100% en `clean_ventas` por `cocheras` NaN | `clean_ventas.py:36` | S | 415 avisos de venta perdidos; modelo venta solo InfoCasas | T069 |
| 17 | ALTO | Enumeración de emails vía registro (409 vs 201) | `auth.py:24-26` | M | Vector de reconocimiento de cuentas | T022 |
| 18 | ALTO | Health check ignora `venta_service` cargado | `health.py:83` | S | Deploy puede reportar OK con modelo venta caído | T029 |
| 19 | ALTO | Scripts de auditoría/calibración apuntan a v1; producción corre v2 | `audit_artefacts.py`, `validate_features.py` | M | CI/auditoría da falsa confianza; drift silencioso | T060,T062,T059 |
| 20 | ALTO | `fillna(0)` en amenities colapsa “desconocido” con “ausente” | notebooks/03 + pipeline v2 | L | Sesgo sistemático en features; predicciones optimistas/pesimistas | T012,T011 |

---

## Bloques por área

### ML

- **[CRÍTICO]** Notebooks 04/05: sin GroupKFold ni clave de grupo espacial · `ventas_model/train_venta.py:72-73` · (T006)
- **[CRÍTICO]** MAPE 15.78% = XGBoost validación aleatoria (nb04) · `—` · (T007)
- **[CRÍTICO]** MAPE 16.4% no reproducible desde notebooks 04/05 · `src/wasi/models/ml.py:60` · (T007)
- **[CRÍTICO]** Mezcla de esquemas en métricas de producto · `src/wasi/models/ml.py:60` · (T008)
- **[MEDIO]** Mediana global de respaldo también usa todo el dataset · `—` · (T003)
- **[MEDIO]** Semántica del centinela es razonable pero no separa train/test · `—` · (T004)
- **[MEDIO]** `geo_index.py` no define `coord_cell` · `src/wasi/features/geo_index.py:75-153` · (T006)
- **[MEDIO]** `coord_cell` en venta: resolución ~111 m, colisiones frecuentes · `ventas_model/build_features_venta.py:36-37` · (T006)
- **[MEDIO]** Contraste venta sí es reproducible (referencia) · `ventas_model/train_venta.py:57` · (T007)
- **[MEDIO]** R² 0.847 ≈ R² val XGBoost 0.8501 (nb04) · `—` · (T008)
- **[MEDIO]** 33/101 features con importancia 0 · `—` · (T009)
- **[MEDIO]** Pares correlacionados no eliminados por VIF · `—` · (T010)
- *…y 20 hallazgos adicionales ML (ver tareas origen).*

### Backend

- **[ALTO]** Enumeración de emails vía registro · `auth.py:24-26` · (T022)
- **[ALTO]** Sin revocación de tokens (logout solo cliente) · `auth.py:24` · (T036)
- **[ALTO]** Endpoints FairValue ML sin rate-limit · `routers/fairvalue.py:85` · (T040)
- **[ALTO]** `POST /listings/{id}/leads` sin rate-limit · `routers/listings.py:365` · (T040)
- **[MEDIO]** JWT sin refresh ni revocación · `auth.py:45` · (T022)
- **[MEDIO]** Leads almacenan PII del inquilino sin retención definida · `listings.py:365` · (T026)
- **[MEDIO]** `jwt_algo` configurable sin whitelist · `database.py:22` · (T036)
- **[ALTO]** `GET /analyses/{id}` no restaura counterfactuals ni prediction_interval · `fairvalue.py:48` · (T023)
- **[ALTO]** Filtro `zone` y `sort=ganga` cargan catálogo completo en memoria · `listings.py:239-253` · (T025)
- **[ALTO]** `contact_name` expuesto en catálogo público autenticado · `listings.py:154` · (T026)
- **[ALTO]** Health ignora `venta_service` · `health.py:83` · (T029)
- **[ALTO]** `getAnalysis` incompleto vs `predict` en vivo · `fairvalue.py:48-83` · (T031)
- *…y 33 hallazgos adicionales Backend (ver tareas origen).*

### src/wasi

- **[ALTO]** Lat/lng exactos en respuesta API · `comparables_service.py:86-87` · (T047)
- **[ALTO]** Race en lazy singleton · `osm_lookup.py:258-264` · (T049)
- **[MEDIO]** Lazy singleton sin lock · `display_pois.py:145-151` · (T020,T047,T050,T052)
- **[MEDIO]** Docstring de `load()` contradice el código v2 · `model_service.py:62-64` · (T043)
- **[MEDIO]** `_check_n_features` no valida orden de nombres si `feature_names_in_` es None · `model_service.py:177-188` · (T043)
- **[MEDIO]** Campos estructurales obligatorios sin `.get()` · `ml_v2.py:50` · (T044)
- **[MEDIO]** Modelo no cargado → DataFrame 0 columnas · `ml_v2.py:48` · (T044)
- **[MEDIO]** Valores negativos no se clampan antes de derivadas · `ml_v2.py:118-119` · (T044)
- **[MEDIO]** Umbrales de confianza: `except Exception` silencioso · `ml.py:25-30` · (T045)
- **[MEDIO]** Métricas R²/MAE hardcodeadas por modo · `ml.py:60` · (T045)
- **[MEDIO]** `fair_value=0` → `diff_pct=0` y zona “Justo” · `ml.py:594-601` · (T045)
- **[MEDIO]** `area=0` o None salta penalización de tamaño · `comparables_service.py:70` · (T047)
- *…y 9 hallazgos adicionales src/wasi (ver tareas origen).*

### Scripts

- **[ALTO]** Métrica de densidad calibrada ≠ `n_comparables` de producción · `calibrate_confidence.py:45-46` · (T059)
- **[ALTO]** Script incompatible con modelo v2 activo · `calibrate_confidence.py:56` · (T059)
- **[ALTO]** Solo audita v1; producción corre v2 · `model_service.py:66-67` · (T060)
- **[ALTO]** Re-ejecución desde página 1 descarta CSV previo · `ventas_model/scrape_infocasas.py:161` · (T067)
- **[ALTO]** Página sin `__NEXT_DATA__` corta el scrape sin reintentos · `ventas_model/scrape_infocasas.py:44` · (T067)
- **[ALTO]** Dependencia exclusiva de JSON-LD `ItemList` en HTML · `ventas_model/scrape_babilonia.py:57` · (T068)
- **[MEDIO]** Rate-limit fijo sin adaptación · `ventas_model/scrape_infocasas.py:22` · (T067)
- **[MEDIO]** R² en el reporte es constante, no se calcula · `gate6_seleccion_modelo.py:78-81` · (T057)
- **[MEDIO]** Baseline "todas las amenities" ≠ producción (8 chips) · `gate3_amenities.py:62-64` · (T058)
- **[MEDIO]** Salida en ruta legacy, no en `models/v2/` · `calibrate_confidence.py:121` · (T059)
- **[MEDIO]** LOO solo reemplaza columnas IDW; resto viene de X_test pre-computado · `calibrate_confidence.py:66-73` · (T059)
- **[MEDIO]** No verifica manifest ni golden · `audit_artefactos.py:48-129` · (T060)
- *…y 20 hallazgos adicionales Scripts (ver tareas origen).*

### Ventas

- **[ALTO]** Babilonia eliminada al 100% por `cocheras` NaN · `ventas_model/clean_ventas.py:36` · (T069)
- **[ALTO]** Dedup insuficiente: 3 229 filas comparten lat/lng · `—` · (T069)
- **[MEDIO]** Encoding producción fit en dataset completo · `—` · (T016)
- **[MEDIO]** `distrito_enc`: train batch vs mapa congelado · `venta_service.py:64` · (T017)
- **[MEDIO]** `property_type` vacío permitido · `—` · (T018,T069)
- **[MEDIO]** `predict()` sin guard interno · `venta_service.py:53-73` · (T046)
- **[MEDIO]** Sin validación de integridad del bundle (hash/golden) · `venta_service.py:38-48` · (T046)
- **[MEDIO]** Features geo: omisión silenciosa → NaN · `venta_service.py:58-65` · (T046)
- **[MEDIO]** Coerción `int()` trunca decimales · `venta_service.py:60-63` · (T046)
- **[MEDIO]** `banos` NaN en Babilonia también filtra filas · `ventas_model/clean_ventas.py:35` · (T069)
- **[MEDIO]** Bbox lng distinto a `geo_index` y scrapers · `clean_ventas.py:38` · (T069)
- **[MEDIO]** Split de validación (15%) creado y descartado · `ventas_model/train_venta.py:59-60` · (T070)
- *…y 4 hallazgos adicionales Ventas (ver tareas origen).*

### Frontend

- **[ALTO]** `ErrorBanner` sin `aria-live` · `app.jsx:28-42` · (T034,T092)
- **[ALTO]** Enlace “Regístrate / Inicia sesión” sin `href` · `screens-public.jsx:163-165` · (T088)
- **[ALTO]** Mapa hace `fitBounds` solo con la página actual (24 ítems) · `screens-listings.jsx:177-196` · (T074,T098)
- **[ALTO]** `ListingCard` siempre muestra “/mes” · `components.jsx:169-170` · (T091)
- **[MEDIO]** Vista previa siempre muestra precio “/mes” · `screens-seller.jsx:474-484` · (T081)
- **[ALTO]** Hero carousel usa avisos ficticios sin disclaimer · `screens-home.jsx:42` · (T072)
- **[ALTO]** Histograma titulado “Distribución real” con datos del mock · `screens-home.jsx:571-577` · (T072)
- **[ALTO]** Race en `load()` sin secuenciación · `screens-listings.jsx:516` · (T074)
- **[ALTO]** Leyenda del mapa invisible en dark mode · `screens-listings.jsx:232-249` · (T076)
- **[ALTO]** `FairValueResult`: explain/narrative sin cancel al cambiar `analysisId` · `screens-fairvalue.jsx:825-867` · (T077)
- **[ALTO]** `Modal` sin focus-trap ni foco inicial · `components.jsx:534-604` · (T085)
- **[ALTO]** `AddressSearch`: fetches sin `AbortController` · `screens-core.jsx:122` · (T089)
- *…y 79 hallazgos adicionales Frontend (ver tareas origen).*

### Infra

- **[ALTO]** React 18 development en producción · `index.html:43-44` · (T096)
- **[ALTO]** Cache-busting con `Date.now()` en cada carga · `index.html:53-64` · (T096)
- **[ALTO]** Babel standalone transpila 9 JSX en el hilo principal · `index.html:60-64` · (T096)
- **[ALTO]** Sin sincronía con el historial del navegador · `app.jsx:53` · (T094)
- **[ALTO]** F5 reinicia contexto de pantalla · `app.jsx:53` · (T094)
- **[ALTO]** Pantallas overlay sin tab activo coherente · `app.jsx:13` · (T094)
- **[ALTO]** `DISTRITOS: '40'` no cuadra con el catálogo geo real · `stats.js:7` · (T095)
- **[MEDIO]** `DashboardScreen` sigue huérfano · `app.jsx:181-189` · (T094)
- **[MEDIO]** Post-publicar no abre el aviso creado · `app.jsx:249` · (T094)
- **[MEDIO]** Tres fuentes de conteo de avisos en la misma sesión · `screens-home.jsx:400` · (T095)
- **[MEDIO]** `VENTA_MAPE` / `VENTA_AVISOS` casi no se exponen · `stats.js:9-10` · (T095)
- **[MEDIO]** Aliases de distrito orientados a Photon, no al dropdown oficial · `aliases_lima.js:194-219` · (T095)
- *…y 6 hallazgos adicionales Infra (ver tareas origen).*

---

## Cerrados en bitácora

No re-auditar; resueltos en Sprints 0–5 (`docs/BITACORA_FORMS.md`):

- Parser `humanizeError()` — errores 422/429 legibles (Sprint 0)
- Persistencia API base `#api8001` en localStorage (Sprint 0)
- Fechas UTC con sufijo `Z` en serializers (Sprint 0)
- CSS dark mode: `.stack-8`, gradientes wizard/home (Sprint 0)
- Campo `operacion` alquiler/venta + migración DB (Sprint 1)
- `image_url` TEXT para fotos base64 (Sprint 1)
- Tildes distrito al publicar (Jesús María → Jesus Maria) (Sprint 1)
- `fair_value_ref` con modelo venta + self-lead 403 (Sprint 1)
- PATCH editar/pausar listing + inbox agregado sin N+1 (Sprint 1)
- Paginación `X-Total-Count` + filtro operación (Sprint 1/3)
- Sanity-filter gangas >45% descuento (Sprint 1)
- Form publicar production-grade: fotos, pin, borrador, validación (Sprint 2)
- Selector alquiler/venta en catálogo + foto en detalle (Sprint 3)
- `entornoReturn` desde home + CTA Operaciones corregido (Sprint 3)
- `userVersion` nav por rol + `clearSession` en 401 (Sprint 4)
- Bottom-nav móvil + labels/focus-visible básicos (Sprint 5)

---

## Deuda aceptable / no accionar ahora

- Build de producción con bundler (esbuild/vite) — decisión explícita del usuario; impacto alto pero cambio arquitectónico
- Recuperación de contraseña / verificación email — requiere email transaccional
- Focus trap en modales, `aria-live` en banner, pausa carrusel hero — a11y menor
- Plan Pro / trial sin billing — gap de producto, no bug
- Mensajes de validator backend en inglés dentro del texto — cosmético copy
- Persistencia de preferencias perfil solo localStorage — documentar o wire API
- Postgres en Render — infra pendiente de decisión
- Features ML con importancia ~0 (T009) — poda académica, no bloquea serving
- Sesgo Jensen log1p→expm1 (T014) — mejora marginal vs re-entrenar
- VIF/multicolinealidad no actuada (T010) — deuda de notebook, modelo funciona

---

## Roadmap sugerido

### Sprint A — Quick wins (1–2 días)

1. Ocultar `contact_name` en catálogo (solo dueño o alias genérico)
2. Rate-limit `predict`/`simulate`/`predict-venta` + `POST /leads`
3. React `.production.min.js` + cache con versión fija (sin bundler aún)
4. `ListingCard` y previews: unidad de precio por `operacion`
5. Disclaimer en hero mock + renombrar histograma “Distribución real”
6. Corregir `stats.js`: distritos y avisos desde runtime/API
7. `fillna(0)` cocheras en `clean_ventas` para recuperar Babilonia
8. Health check incluye `venta_service`
9. Race explain/narrative: `reqId` + abort en FairValue

### Sprint B — Medio (3–5 días)

1. Mapa Explorar: no re-fit al paginar o endpoint geo agregado
2. `getAnalysis` paridad con `predict` (counterfactuals, interval)
3. Counterfactual condicionado por `operacion` en detalle listing
4. Índice SQL para `sort=ganga` / precompute ranking gangas
5. Enumeración emails: respuesta uniforme en registro
6. Actualizar scripts auditoría a v2 (`audit_artefacts`, `validate_features`)
7. Borrador publicar restaura `operacion` (fix 1 línea)
8. Post-publicar redirige a detalle del aviso creado
9. JWT: whitelist algoritmos; evaluar refresh/revocación
10. Modal focus-trap + `aria-live` en ErrorBanner

### Sprint C — Re-entrenamiento ML (1–2 semanas)

1. Script reproducible GroupKFold alquiler (celda `coord_cell` o H3)
2. Refit target encoding + imputaciones + caps **solo en train** por fold
3. Reportar métricas pareadas: `r2_random` + `mape_spatial` (patrón `train_venta.py`)
4. Regenerar artefactos v2 con trazabilidad en manifest
5. Coverage P25–P75: conformal o recalibración de bandas
6. Dedup espacial ventas + bbox unificado con `geo_index`
7. Amenities: distinguir MNAR (flag `informado` vs `ausente`)
8. Re-entrenar y validar antes de cambiar cifras en UI (`stats.js`, disclaimers)

---

## Nota de honestidad académico vs producción

| Tipo | Ejemplos | ¿Bloquea producción hoy? |
|------|----------|---------------------------|
| **Bloqueante operativo** | PII, rate-limit, TTI móvil, `/mes` en venta, mapa fitBounds | **Sí** — afecta usuarios reales ahora |
| **Bloqueante de credibilidad** | Mocks sin disclaimer, stats 40 distritos, MAPE mezclado | **Sí** — en demo con inversionistas |
| **Académico / trazabilidad** | GroupKFold ausente, VIF, Jensen, features muertas | **No** — el modelo sirve; las métricas pueden estar infladas |
| **Deuda de pipeline** | Scripts v1, calibrate_confidence desalineado | **Parcial** — riesgo en próximo re-train |

## Estadísticas de consolidación

| Métrica | Valor |
|---------|-------|
| Informes procesados | 100 |
| Hallazgos brutos | 760 |
| Cerrados / INFO (bitácora) | ~408 |
| Abiertos deduplicados | ~421 |
| CRÍTICO abiertos | 4 |
| ALTO abiertos | ~49 |
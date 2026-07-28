# 100 tareas para 100 Cursor Composers — Wasi

Cada tarea = **un archivo × una lente × una pregunta**, escribiendo a su propio
`.md` en `docs/hallazgos/`. Cero solape, corren en paralelo sin chocar.

## Cómo usar
Para cada composer, pega esta PLANTILLA y rellena la fila que le toca:

```
Eres auditor senior. Tarea ÚNICA y acotada. NO cambies código — solo audita y
reporta. Español peruano neutro. No re-reportes lo ya resuelto en
docs/BITACORA_FORMS.md.

Proyecto: Wasi (proptech Lima). Backend FastAPI en :8001
(PYTHONPATH=app/backend app/backend/venv/bin/python -m uvicorn app.backend.main:app --port 8001).
Frontend React sin build (Babel standalone), app/*.jsx. Tests:
WASI_RATELIMIT=0 WASI_SKIP_BULK_SEED=1 app/backend/venv/bin/python -m pytest app/backend/tests/ -q

TARGET:   <archivo>
LENTE:    <lente>
PREGUNTA: <pregunta específica>
SALIDA:   escribe docs/hallazgos/<archivo_salida> con cada hallazgo:
          [severidad] · qué · evidencia (archivo:línea o celda) · impacto · fix propuesto.
          Si no hay hallazgos, escríbelo igual con "sin hallazgos".
```

## Orden recomendado
Dispara por tandas de ~10, no las 100 de golpe. **Tanda 1 = T001–T020 (ML/pipeline)**:
es el mayor riesgo (si T001 detecta leakage, el MAPE 16.4% está inflado). Luego el
resto. Al final me pasas la carpeta `docs/hallazgos/` y consolido por ROI.

> Honestidad: de 100, las de ML (T001–T020) y bugs de screens grandes (T071–T092)
> son las de mayor yield. Muchas de scripts/módulos volverán "sin hallazgos" — está
> bien, es cobertura exhaustiva, que es lo que pediste.

---

## BLOQUE ML / PIPELINE (T001–T020) — máxima prioridad

| ID | TARGET | LENTE | PREGUNTA | SALIDA |
|----|--------|-------|----------|--------|
| T001 | notebooks/03,04 + generate_model_artefacts_v2.py | leakage | ¿El target encoding del distrito se ajusta SOLO con el train de cada fold, o una vez sobre todo el dataset? | t001_target_encoding.md |
| T002 | notebooks/01,03 + src/wasi/features | leakage | StandardScaler/normalización: ¿fit solo en train o fit_transform sobre todo? | t002_escalado.md |
| T003 | notebooks/01 | leakage | Imputación por mediana agrupada: ¿el estadístico sale solo del train tras el split? | t003_imputacion_mediana.md |
| T004 | notebooks/03 | leakage | dist_nearest_m_* imputado con percentil 95: ¿solo sobre train? | t004_imputacion_p95.md |
| T005 | notebooks/01 | leakage | Caps de outliers de precio/m²: ¿umbral calculado sobre train o sobre todo? | t005_outlier_caps.md |
| T006 | notebooks/04 + geo_index.py | correctitud | ¿coord_cell impide de verdad que dos avisos del mismo edificio caigan en train y test? | t006_groupkfold_cell.md |
| T007 | notebooks/04,05 | reproducibilidad | ¿El 15.7% aleatorio vs 16.4% espacial es reproducible y del mismo pipeline? | t007_split_reproducible.md |
| T008 | notebooks/05 | honestidad | ¿R² 0.847 y MAPE 16.4% son del MISMO esquema de validación? | t008_metricas_mismo_esquema.md |
| T009 | src/wasi/models/model_service.py | features | Lista features con importancia ~0 (candidatas a podar). | t009_features_muertas.md |
| T010 | notebooks/03 | features | ¿Se calculó VIF/multicolinealidad y se actuó sobre él? ¿Features redundantes? | t010_vif.md |
| T011 | notebooks/01,02 | missing-data | Clasifica los nulos principales como MNAR/MAR/MCAR con evidencia. | t011_missing_tipo.md |
| T012 | notebooks/03 | missing-data | Amenities tiene_*=0: ¿"no tiene" o "no reportado"? ¿introduce sesgo? | t012_amenities_sesgo.md |
| T013 | notebooks/01 | missing-data | ¿Se borran filas con nulos correlacionados (MAR) sesgando el dataset? | t013_row_deletion_bias.md |
| T014 | notebooks/03 + model_service.py | correctitud | log1p→expm1: cuantifica el sesgo de Jensen y si Duan/Box-Cox valen la pena. | t014_jensen.md |
| T015 | model_service.py + quantile artefacts | correctitud | Coverage P25-P75 41.7% vs 50%: ¿conformal prediction lo arregla sin reentrenar? | t015_coverage.md |
| T016 | ventas_model/train_venta.py | leakage | ¿El modelo de venta tiene la misma disciplina anti-fuga que alquiler? | t016_venta_leakage.md |
| T017 | ventas_model/build_features_venta.py | correctitud | ¿Las 22 features de venta se construyen igual que en inferencia (paridad)? | t017_venta_features.md |
| T018 | ventas_model/clean_ventas.py | calidad-datos | ¿Dedup, outliers y escala de precio bien manejados? | t018_clean_ventas.md |
| T019 | src/wasi/features/geo_index.py | correctitud | ¿La interpolación IDW y los fallbacks de baja densidad son correctos? | t019_geo_idw.md |
| T020 | src/wasi/features/osm_lookup.py | correctitud | ¿Los tiers (premium/mass) y el KD-tree por categoría son correctos? | t020_osm_tiers.md |

## BLOQUE BACKEND ROUTERS (T021–T032)

| ID | TARGET | LENTE | PREGUNTA | SALIDA |
|----|--------|-------|----------|--------|
| T021 | routers/auth.py | correctitud | Casos borde de registro/login/me/update no cubiertos. | t021_auth_correctitud.md |
| T022 | routers/auth.py | seguridad | Vectores: enumeración de emails, rate-limit, normalización, tokens. | t022_auth_seguridad.md |
| T023 | routers/fairvalue.py | correctitud | predict/simulate/venta/counterfactual/comparables: errores y bordes. | t023_fairvalue_correctitud.md |
| T024 | routers/fairvalue.py | persistencia | ¿Qué endpoints persisten análisis y ensucian el historial? ¿coherente? | t024_fairvalue_persistencia.md |
| T025 | routers/listings.py | correctitud | CRUD, filtros, paginación, veredictos: bordes y errores. | t025_listings_correctitud.md |
| T026 | routers/listings.py | seguridad/PII | ¿PII expuesta? ¿ownership en cada endpoint? ¿self-lead? | t026_listings_pii.md |
| T027 | routers/entorno.py | correctitud | POIs/score/seguridad por pin: bordes, fuera de Lima, nulos. | t027_entorno.md |
| T028 | routers/dashboard.py | correctitud | ¿El dashboard es alcanzable? ¿datos correctos? ¿código muerto? | t028_dashboard.md |
| T029 | routers/health.py | correctitud | ¿El 503/200 refleja el estado real del modelo? | t029_health.md |
| T030 | routers/__init__.py + main include | routing | ¿Todas las rutas registradas? ¿prefijos consistentes? | t030_routing.md |
| T031 | routers/fairvalue.py | contrato | ¿La respuesta cuadra con lo que el frontend consume (campos faltantes)? | t031_fairvalue_contrato.md |
| T032 | routers/listings.py | contrato | ListingOut/InboxLeadOut vs lo que el frontend espera. | t032_listings_contrato.md |

## BLOQUE BACKEND CORE (T033–T042)

| ID | TARGET | LENTE | PREGUNTA | SALIDA |
|----|--------|-------|----------|--------|
| T033 | schemas.py | validación | Huecos de validación (rangos, formatos, campos peligrosos). | t033_schemas.md |
| T034 | models.py | integridad | Relaciones, cascades, nullability, índices faltantes. | t034_models.md |
| T035 | database.py | migraciones | ¿ensure_schema es idempotente y retrocompatible en SQLite y Postgres? | t035_migraciones.md |
| T036 | auth.py (core) | seguridad | JWT: expiración, algoritmo, secreto, revocación, refresh. | t036_jwt.md |
| T037 | main.py | arranque | Lifespan, CORS, orden de init, manejo de fallos de carga. | t037_main.md |
| T038 | seed.py | idempotencia | ¿El seed es idempotente y seguro fuera de dev? | t038_seed.md |
| T039 | seed_listings_bulk.py | correctitud | ¿El seed masivo mete data plausible? ¿respeta el flag? | t039_seed_bulk.md |
| T040 | ratelimit.py | cobertura | ¿Qué endpoints quedan sin rate-limit y deberían tenerlo? | t040_ratelimit.md |
| T041 | schemas.py | contrato | Serializers de fecha (Z), campos opcionales vs frontend. | t041_schemas_contrato.md |
| T042 | models.py | datos | ¿El campo operacion y defaults no rompen los sembrados? | t042_operacion.md |

## BLOQUE src/wasi MÓDULOS (T043–T054)

| ID | TARGET | LENTE | PREGUNTA | SALIDA |
|----|--------|-------|----------|--------|
| T043 | models/model_service.py | robustez | Validaciones al arranque (hash, n_features, golden): ¿sólidas? | t043_model_service.md |
| T044 | models/ml_v2.py | correctitud | ¿build_features_v2 respeta feature_order y no rompe con inputs raros? | t044_ml_v2.md |
| T045 | models/ml.py | correctitud | predict_fair_value: veredicto, clamps, fallbacks. | t045_ml.md |
| T046 | models/venta_service.py | correctitud | Carga, predicción, bordes del modelo de venta. | t046_venta_service.md |
| T047 | models/comparables_service.py | correctitud | ¿Los comparables son correctos y sin PII? | t047_comparables.md |
| T048 | features/geo_index.py | robustez | Bounds de Lima, fallbacks, errores OutOfBounds. | t048_geo_bounds.md |
| T049 | features/osm_lookup.py | concurrencia | Lazy-init thread-safe bajo carga concurrente. | t049_osm_concurrency.md |
| T050 | features/distrito_features.py | correctitud | NSE, comisarías, denuncias por distrito: correctos y completos. | t050_distrito_features.md |
| T051 | features/distritos_lima_features.py | correctitud | ¿Consistencia de nombres de distrito (tildes) con el resto? | t051_distritos_nombres.md |
| T052 | features/display_pois.py | correctitud | POIs de display: correctos, sin romper si falta data. | t052_display_pois.md |
| T053 | paths.py | portabilidad | ¿Las rutas funcionan en dev y en Render sin hardcodes frágiles? | t053_paths.md |
| T054 | features/__init__.py + models/__init__.py | exports | ¿Los exports públicos del paquete son coherentes? | t054_exports.md |

## BLOQUE SCRIPTS (T055–T066)

| ID | TARGET | LENTE | PREGUNTA | SALIDA |
|----|--------|-------|----------|--------|
| T055 | scripts/generate_model_artefacts_v2.py | leakage | ¿La generación de artefactos filtra test en encoders/scalers? | t055_gen_artefacts_v2.md |
| T056 | scripts/generate_model_artefacts.py | leakage | Idem para v1. | t056_gen_artefacts_v1.md |
| T057 | scripts/gate6_seleccion_modelo.py | correctitud | ¿La selección RF vs XGB es justa (mismo esquema)? | t057_gate6.md |
| T058 | scripts/gate3_amenities.py | correctitud | ¿El gate de amenities valida lo correcto? | t058_gate3.md |
| T059 | scripts/calibrate_confidence.py | correctitud | ¿La calibración de confianza es honesta? | t059_calibrate.md |
| T060 | scripts/audit_artefactos.py | correctitud | ¿La auditoría de artefactos cubre lo necesario? | t060_audit_artefactos.md |
| T061 | scripts/audit_calibracion_distritos.py | correctitud | ¿Detecta distritos mal calibrados? | t061_audit_calib.md |
| T062 | scripts/validate_build_features.py | paridad | ¿Verifica de verdad la paridad train↔serving? | t062_validate_features.md |
| T063 | scripts/validate_pipeline.py | correctitud | ¿Qué valida y qué se le escapa? | t063_validate_pipeline.md |
| T064 | scripts/build_geo_index.py | correctitud | ¿El índice geográfico se construye sin fugas ni errores? | t064_build_geo.md |
| T065 | scripts/fetch_display_pois.py | robustez | ¿Manejo de fallos de red/API al traer POIs? | t065_fetch_pois.md |
| T066 | scripts/seed_catalogo.py | correctitud | ¿El catálogo sembrado es coherente con el modelo? | t066_seed_catalogo.md |

## BLOQUE VENTAS SCRAPERS (T067–T070)

| ID | TARGET | LENTE | PREGUNTA | SALIDA |
|----|--------|-------|----------|--------|
| T067 | ventas_model/scrape_infocasas.py | robustez | Rate-limit, manejo de errores, cambios de estructura del sitio. | t067_scrape_infocasas.md |
| T068 | ventas_model/scrape_babilonia.py | robustez | Idem. | t068_scrape_babilonia.md |
| T069 | ventas_model/clean_ventas.py | calidad | Dedup, outliers, escala de precio, coordenadas. | t069_clean_ventas.md |
| T070 | ventas_model/train_venta.py | rigor | Hiperparámetros, validación espacial, honestidad de métricas. | t070_train_venta.md |

## BLOQUE FRONTEND SCREENS × LENTE (T071–T092)

| ID | TARGET | LENTE | PREGUNTA | SALIDA |
|----|--------|-------|----------|--------|
| T071 | screens-home.jsx | bugs | Crashes por null, fetch sin cleanup, estados rotos. | t071_home_bugs.md |
| T072 | screens-home.jsx | ux-copy | Mock presentado como real, jerarquía, copy confuso. | t072_home_ux.md |
| T073 | screens-home.jsx | a11y-responsive | 390px, foco, aria, overflow. | t073_home_a11y.md |
| T074 | screens-listings.jsx | bugs | Filtros/paginación/mapa: bugs y races. | t074_listings_bugs.md |
| T075 | screens-listings.jsx | ux | Fricciones al explorar/filtrar/abrir detalle. | t075_listings_ux.md |
| T076 | screens-listings.jsx | a11y-responsive | Móvil, leyenda del mapa en dark, foco. | t076_listings_a11y.md |
| T077 | screens-fairvalue.jsx | bugs | Wizard, resultado, hooks condicionales, null-guards. | t077_fairvalue_bugs.md |
| T078 | screens-fairvalue.jsx | ux | Coherencia de rangos/banners/confianza. | t078_fairvalue_ux.md |
| T079 | screens-fairvalue.jsx | a11y-responsive | Wizard 360px, sugerencias por teclado, foco. | t079_fairvalue_a11y.md |
| T080 | screens-seller.jsx | bugs | Publicar/editar/pausar/leads: bugs y bordes. | t080_seller_bugs.md |
| T081 | screens-seller.jsx | ux | Fluidez del form, feedback, preview, borrador. | t081_seller_ux.md |
| T082 | screens-seller.jsx | a11y-responsive | Form en móvil, labels, foco. | t082_seller_a11y.md |
| T083 | screens-profile.jsx | bugs | Editar perfil, reportes, modales. | t083_profile_bugs.md |
| T084 | screens-profile.jsx | ux | Funcionalidad decorativa (planes/soporte), claridad. | t084_profile_ux.md |
| T085 | screens-profile.jsx | a11y-responsive | Modales foco/escape, móvil. | t085_profile_a11y.md |
| T086 | screens-public.jsx | bugs | Login/registro: doble submit, errores, validación. | t086_public_bugs.md |
| T087 | screens-public.jsx | ux | Onboarding, claridad del primer paso. | t087_public_ux.md |
| T088 | screens-public.jsx | a11y-responsive | Anchors sin href, foco, móvil. | t088_public_a11y.md |
| T089 | screens-core.jsx | bugs | MapPicker/AddressSearch: races, cleanup, geocoding. | t089_core_bugs.md |
| T090 | screens-core.jsx | a11y | Buscador por teclado, foco visible. | t090_core_a11y.md |
| T091 | components.jsx | bugs | Icon/Modal/Input/TopNav/gauges: bugs y contratos. | t091_components_bugs.md |
| T092 | components.jsx | a11y | Modales focus-trap, ErrorBanner aria-live, labels. | t092_components_a11y.md |

## BLOQUE FRONTEND INFRA + FLUJOS E2E (T093–T100)

| ID | TARGET | LENTE | PREGUNTA | SALIDA |
|----|--------|-------|----------|--------|
| T093 | api.js | correctitud | Manejo de errores, 401 global, headers, timeout, meta. | t093_api.md |
| T094 | app.jsx | navegación | Estado de navegación, historial del navegador, F5, back. | t094_app_nav.md |
| T095 | aliases_lima.js + stats.js | datos | ¿Los conteos (distritos, avisos, MAPE) son consistentes y actuales? | t095_stats_datos.md |
| T096 | index.html | performance | React dev + Babel runtime + cache-busting: costo y build mínimo. | t096_index_perf.md |
| T097 | flujo publicar (alquiler+venta) | e2e | Recorre publicar de punta a punta en el navegador; lista toda fricción/bug. | t097_flujo_publicar.md |
| T098 | flujo explorar+detalle+contactar | e2e | Recorre descubrir→abrir→contactar; lista toda fricción/bug. | t098_flujo_explorar.md |
| T099 | flujo auth+perfil+rol | e2e | Registro→login→cambiar rol→ver nav; lista toda fricción/bug. | t099_flujo_cuenta.md |
| T100 | flujo fairvalue+entorno | e2e | Estimar precio→ver SHAP→ver entorno→volver; lista toda fricción/bug. | t100_flujo_fairvalue.md |

---

## Cierre
Cuando estén los 100 `.md` en `docs/hallazgos/`, pásame la carpeta y hago de
orquestador: dedup + consolidación en un solo informe priorizado por ROI, y
decidimos qué ejecutar. Los composers NO tocan código en esta fase.

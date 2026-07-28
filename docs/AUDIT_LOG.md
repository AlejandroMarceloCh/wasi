# AUDIT_LOG - Wasi

Este archivo es la memoria historica de la auditoria. Si el contexto conversacional se pierde, leer primero:

1. `src/wasi/plan.md`
2. `src/wasi/AUDIT_LOG.md`
3. `src/wasi/CHANGELOG_AUDITORIA.md`
4. `src/wasi/AUDIT_BASELINE.md`
5. `README.md`
6. `git status --short`
7. `git log -5 --oneline`

## Ajuste post Sprint 4 - Formula Explorar v2

- Fecha: 2026-07-05
- Estado: Cerrado - APROBADO CON RIESGOS por QA Codex Agent.
- Objetivo: mejorar la formula que alimenta Explorar para que el veredicto publicado use la misma referencia predictiva que FairValue y el preview de publicacion.
- Cambio realizado:
  - `POST /api/listings` ahora calcula `fair_value_ref` server-side con `predict_fair_value` como fuente primaria.
  - Se mantiene fallback por mediana de comparables activos del mismo distrito si el modelo lanza `RuntimeError` o devuelve una respuesta mal formada.
  - El cliente sigue sin poder imponer `fair_value_ref`.
- Tests agregados:
  - Listing nuevo usa el modelo ML para persistir `fair_value_ref`.
  - Si el modelo falla, el backend cae al fallback por comparables con valor esperado calculado desde BD.
  - Si el modelo devuelve respuesta invalida, el backend cae al fallback por comparables.
- Tests ejecutados:
  - `app/backend/venv/bin/pytest -q app/backend/tests/test_listings.py -ra --tb=short`
  - `app/backend/venv/bin/pytest -q -ra --tb=short`
  - `app/backend/venv/bin/pip check`
  - `git diff --check`
- Resultado:
  - Listings: `21 passed, 3 warnings`.
  - Suite backend: `157 passed, 2 skipped, 3 warnings in 24.51s`.
  - `pip check`: `No broken requirements found`.
  - `git diff --check`: OK.
- QA Codex Agent:
  - Agente: Hilbert.
  - Veredicto: APROBADO CON RIESGOS.
  - Findings corregidos:
    - Fallback solo cubria `RuntimeError`; ahora cubre respuesta mal formada o conversion invalida del resultado ML.
    - Test de fallback validaba solo `not None`; ahora valida referencia esperada por comparables y distrito derivado.
  - Riesgo aceptado:
    - Doble `geo_lookup` en creacion de listing: primero para validar distrito y luego dentro de `predict_fair_value`. Queda para Sprint 5/performance porque requiere exponer una ruta interna de prediccion que reutilice geo precalculado.
- Riesgos residuales:
  - El fallback por comparables sigue siendo menos preciso que el modelo y depende de tener data activa por distrito.
  - Este ajuste alinea la referencia del backend; la UI todavia debe verificarse visualmente en Sprint 6 para confirmar que comunica el resultado sin ambiguedad.

## Sprint 1 - Baseline y mapa completo del sistema

- Fecha inicio: 2026-07-05 13:12:23 -0500
- Fecha cierre: 2026-07-05 14:01:32 -0500
- Estado: Cerrado - APROBADO CON RIESGOS por QA Codex Agent final
- Sprint Goal: Construir una fotografia confiable del estado actual de Wasi y dejar instalada la memoria de auditoria para que todo sprint posterior parta de hechos verificables.
- Areas auditadas:
  - Estado git inicial.
  - Stack y estructura principal.
  - Tests baseline.
  - Endpoints backend.
  - Pantallas/frontend.
  - Artefactos ML.
  - Archivos sensibles/generados locales.
- Cambios realizados:
  - Creado `src/wasi/plan.md`.
  - Creado `src/wasi/AUDIT_BASELINE.md`.
  - Creado `src/wasi/AUDIT_LOG.md`.
  - Creado `src/wasi/CHANGELOG_AUDITORIA.md`.
  - Corregido baseline con rutas reales `/api`, ignored files relevantes, subrepos y entorno exacto de tests.
  - Migrado protocolo de QA externo a QA Codex Agent, como aprobo el usuario para esta sesion.
- Archivos principales tocados:
  - `src/wasi/plan.md`
  - `src/wasi/AUDIT_BASELINE.md`
  - `src/wasi/AUDIT_LOG.md`
  - `src/wasi/CHANGELOG_AUDITORIA.md`
- Tests ejecutados:
  - `make test`
- Resultado de tests:
  - `137 passed, 2 skipped, 1 warning in 18.20s`
  - Skips: `tests/test_startup.py::test_manifest...` y `tests/test_startup.py::test_golden_prediction...` no se validan en modo v2.
  - Warning: `httpx` deprecates `app` shortcut; usar `transport=WSGITransport(app=...)` en el futuro.
- QA Codex Agent:
  - Modelo/agente inicial: Codex subagent auditor.
  - Prompt usado o referencia: ver seccion "Prompt QA Codex Agent para Sprint 1" debajo.
  - Veredicto inicial: RECHAZADO.
  - Findings iniciales: endpoints sin prefijo `/api`, estado incompleto de subrepos/ignored files, entorno de tests poco especifico.
  - Correccion aplicada: `AUDIT_BASELINE.md` ahora incluye mapa real de endpoints, `git status --ignored`, estado de `pipeline` y `research/eda`, tamanos de directorios ignorados, Python local, resultado pytest y `pip check`.
  - Modelo/agente final: Lovelace, QA Codex Agent.
  - Veredicto final: APROBADO CON RIESGOS.
  - Findings final:
    - Medio: `AUDIT_BASELINE.md` omitio inicialmente `./_backups/_archive/pipeline_scrapers_ale/.git`; corregido en baseline.
    - Bajo: `AUDIT_LOG.md` y `CHANGELOG_AUDITORIA.md` seguian marcando QA final como pendiente; corregido en cierre.
- Regresiones encontradas:
  - Ninguna durante baseline; no se cambio comportamiento funcional.
- Riesgos residuales aceptados:
  - Repos anidados detectados deben revisarse antes de limpieza.
  - `pipeline/` y `aws/` estan ignorados por el repo principal, pero contienen piezas relevantes de datos/infra; no limpiar sin decision explicita.
  - `_backups/_archive/pipeline_scrapers_ale/.git` queda inventariado como respaldo local ignorado; no limpiar sin decision explicita.
- Decisiones tecnicas:
  - Mantener documentos de auditoria dentro de `src/wasi/`, como pidio el usuario.
  - No modificar archivos sin trackear previos fuera de la auditoria.
  - No limpiar caches/DB/env en Sprint 1; solo inventariar.
- Pendientes para siguiente sprint:
  - Empezar Sprint 2: seguridad, secretos y configuracion.

### Prompt QA Codex Agent para Sprint 1

```text
Actua como auditor senior del proyecto Wasi.
No seas complaciente. Tu trabajo es encontrar omisiones del baseline, riesgos reales y puntos ciegos.

Contexto:
- Proyecto: Wasi, producto de datos inmobiliario.
- Stack: FastAPI, SQLAlchemy, frontend estatico React/JSX, modelos ML XGBoost, pipeline de datos, SQLite/PostgreSQL, pytest.
- Sprint Goal: Construir una fotografia confiable del estado actual de Wasi y dejar instalada la memoria de auditoria para que todo sprint posterior parta de hechos verificables.
- Cambios realizados: se crearon `src/wasi/plan.md`, `src/wasi/AUDIT_BASELINE.md`, `src/wasi/AUDIT_LOG.md`, `src/wasi/CHANGELOG_AUDITORIA.md`.
- Tests ejecutados: `make test` con resultado `137 passed, 2 skipped, 1 warning`.
- Hallazgos iniciales: repos anidados `pipeline/.git`, `research/eda/.git`; `.env` y `wasi.db` locales no trackeados; warning httpx; archivos sin trackear previos.

Revisa:
1. Si el Sprint Goal realmente se cumplio.
2. Si el baseline omite algun subsistema importante: backend, frontend, ML, pipeline, venta, infra, docs o datos.
3. Si faltan pruebas o comandos baseline.
4. Si hay riesgos de seguridad, versionado, datos o reproducibilidad que deban subir de severidad.
5. Si la bitacora permite retomar el proyecto sin contexto conversacional.

Entrega:
- Findings criticos, altos, medios y bajos.
- Archivos o areas afectadas.
- Pruebas adicionales recomendadas.
- Veredicto: APROBADO, APROBADO CON RIESGOS o RECHAZADO.
```

## Sprint 2 - Seguridad y reproducibilidad critica

- Fecha inicio: 2026-07-05 17:30:07 -0500
- Fecha cierre: 2026-07-05 17:35:37 -0500
- Estado: Cerrado - APROBADO por QA Codex Agent final
- Sprint Goal: Eliminar riesgos criticos de seguridad/reproducibilidad que pueden dejar produccion con cuentas conocidas, entorno local no reproducible o configuracion insegura por defecto.
- Areas auditadas:
  - Seed demo y seed masivo.
  - Logs de credenciales demo.
  - Variables `.env` y `.env.example`.
  - CORS por defecto.
  - Tests de auth/integracion afectados por demo seed.
  - README de reproducibilidad.
- Cambios realizados:
  - `seed_if_empty()` ahora crea usuarios/listings demo solo si `WASI_ENABLE_DEMO_SEED=1`.
  - Startup ejecuta `seed_bulk()` solo en modo demo explicito y si no esta `WASI_SKIP_BULK_SEED`.
  - Logs de seed ya no imprimen passwords demo.
  - CORS default cambio de `*` a `http://localhost:5500`.
  - `.env.example` documenta `WASI_ENABLE_DEMO_SEED`, `WASI_SKIP_BULK_SEED`, `WASI_CORS_ORIGINS` y elimina placeholder `gsk_...`.
  - Tests fijan `JWT_SECRET` propio y habilitan demo seed solo en entorno pytest.
  - Agregado test aislado para no crear usuarios demo por defecto y para validar que modo demo no imprime password.
  - Frontend login ya no precarga `ana@wasi.pe` / `demo1234`.
  - README explica creacion de `app/backend/.env`, generacion de `JWT_SECRET` y modo demo explicito.
- Archivos principales tocados:
  - `app/backend/seed.py`
  - `app/backend/main.py`
  - `app/backend/.env.example`
  - `.env.example`
  - `app/backend/tests/conftest.py`
  - `app/backend/tests/test_seed_security.py`
  - `app/screens-public.jsx`
  - `README.md`
  - `src/wasi/AUDIT_LOG.md`
  - `src/wasi/CHANGELOG_AUDITORIA.md`
- Tests ejecutados:
  - `cd app/backend && venv/bin/pytest -q -ra --tb=short`
  - `cd app/backend && venv/bin/pip check`
  - `rg -n "demo1234|gsk_|JWT_SECRET=.*[A-Za-z0-9_-]{32,}|password.*\\/|WASI_CORS_ORIGINS.*\\*|allow_origins=.*\\*" app/backend README.md .env.example render.yaml .github/workflows -g '!app/backend/venv/**' -g '!app/backend/.env'`
- Resultado de tests:
  - Pytest final: `139 passed, 2 skipped, 3 warnings in 19.39s`.
  - Skips: los dos tests de `tests/test_startup.py` siguen omitidos por modo v2.
  - Warnings: `httpx` deprecated `app` shortcut; warnings de cache pytest por permisos sandbox sobre `.pytest_cache`.
  - `pip check`: `No broken requirements found`.
  - Scan: no key Groq placeholder ni credenciales demo en frontend; `demo1234` queda solo en constantes/tests/README por modo demo explicito.
- QA Codex Agent:
  - Modelo/agente: Galileo, QA Codex Agent.
  - Prompt usado o referencia: revision final de Sprint 2 sobre seed demo, CORS, `.env`, tests, README y bitacora.
  - Veredicto inicial: APROBADO CON RIESGOS.
  - Finding inicial medio: `app/screens-public.jsx` precargaba `ana@wasi.pe` / `demo1234`.
  - Correccion aplicada: login inicializa email/password vacios.
  - Veredicto final: APROBADO.
  - Findings finales: ninguno critico, alto o medio.
- Regresiones encontradas:
  - Ninguna detectada por pytest.
- Riesgos residuales aceptados:
  - `pipeline/`, `aws/`, `research/` y `_backups/` siguen requiriendo decision de versionado/limpieza; no se resolvio en este sprint porque implica decision de ownership del repo.
  - Todavia existe `demo1234` como password de demo, pero solo se materializa si `WASI_ENABLE_DEMO_SEED=1`.
  - CORS aun permite `*` si alguien lo configura explicitamente; documentado como no apto para staging/produccion.
- Decisiones tecnicas:
  - Mantener compatibilidad de tests existentes habilitando `WASI_ENABLE_DEMO_SEED=1` solo en pytest.
  - No crear usuarios demo por defecto en BD vacia.
  - No borrar ni mover archivos ignorados/subrepos sin confirmacion del usuario.
- Pendientes para siguiente sprint:
  - Si se aprueba, avanzar a Sprint 3: pipeline ML y rutas de modelos.

## Sprint 3 - Pipeline ML y rutas de modelos

- Fecha inicio: 2026-07-05 17:53:11 -0500
- Fecha cierre: 2026-07-05 18:09:24 -0500
- Estado: Cerrado - APROBADO CON RIESGOS por QA Codex Agent final
- Sprint Goal: Hacer que pipeline ML, scripts de regeneracion y rutas de artefactos apunten a una unica fuente de verdad y sean ejecutables en el layout actual.
- Areas auditadas:
  - `src/wasi/paths.py`.
  - `src/wasi/models/model_service.py`.
  - Scripts `app/backend/scripts/*` que cargan modelo/features.
  - Scripts criticos `pipeline/run_pipeline.py`, `pipeline/rollback.py` y `pipeline/scripts/train_*`.
  - Docs `aws/README.md`, `pipeline/data_manifest.yaml` y comentario de `.gitignore`.
  - Tests de startup/model paths.
- Cambios realizados:
  - Scripts ML migrados de imports planos (`model_service`, `geo_index`, `ml_v2`, `osm_lookup`, `distrito_features`) a imports `wasi.*`.
  - Scripts que escribian/leian `app/backend/models/v2` ahora usan `wasi.paths.MODELS_V2_DIR`.
  - `generate_model_artefacts_v2.py` usa `MODELS_V2_DIR` y imports `wasi.*`.
  - Scripts v1 `validate_build_features.py` y `validate_pipeline.py` fuerzan `DPD_FORCE_V1=1` antes de importar `model_service`.
  - `validate_pipeline.py` permite `WASI_GATES_DIR` para smoke/CI sin escribir en el repo.
  - `pipeline/run_pipeline.py` y `pipeline/rollback.py` usan `MODELS_V2_DIR`.
  - Scripts de entrenamiento `pipeline/scripts/train_*` apuntan a `MODELS_V2_DIR`.
  - `audit_artefactos.py` y `audit_calibracion_distritos.py` usan `MODELS_DIR`/`MODELS_V2_DIR` reales.
  - Docs AWS/data manifest actualizados de `app/backend/models/v2` a `models/v2`.
  - `model_service.py` y `.gitignore` actualizados para documentar `models/` como ruta productiva.
  - Agregado `test_model_paths.py` para validar ruta canonica, import smoke de scripts criticos y scan anti-imports/rutas obsoletas.
  - Agregados tests negativos v2 para `manifest_v2.json` y `golden_prediction_v2.json` adulterados sin tocar artefactos reales.
- Archivos principales tocados:
  - `src/wasi/models/model_service.py`
  - `.gitignore`
  - `app/backend/scripts/audit_artefactos.py`
  - `app/backend/scripts/audit_calibracion_distritos.py`
  - `app/backend/scripts/calibrate_confidence.py`
  - `app/backend/scripts/generate_model_artefacts_v2.py`
  - `app/backend/scripts/seed_catalogo.py`
  - `app/backend/scripts/validate_build_features.py`
  - `app/backend/scripts/validate_pipeline.py`
  - `app/backend/tests/test_model_paths.py`
  - `app/backend/tests/test_startup.py`
  - `pipeline/run_pipeline.py` (ignorado por repo principal)
  - `pipeline/rollback.py` (ignorado por repo principal)
  - `pipeline/scripts/*.py` seleccionados (ignorados por repo principal)
  - `aws/README.md` (ignorado por repo principal)
  - `pipeline/data_manifest.yaml` (ignorado por repo principal)
- Tests ejecutados:
  - `app/backend/venv/bin/pytest -q app/backend/tests/test_model_paths.py app/backend/tests/test_startup.py -ra --tb=short`
  - `app/backend/venv/bin/pytest -q -ra --tb=short`
  - `app/backend/venv/bin/pip check`
  - `app/backend/venv/bin/python app/backend/scripts/validate_build_features.py`
  - `env WASI_GATES_DIR=/tmp/wasi_gates app/backend/venv/bin/python app/backend/scripts/validate_pipeline.py`
  - `env PYTHONPYCACHEPREFIX=/tmp/wasi_pycache app/backend/venv/bin/python -m py_compile ...`
  - `rg` de rutas/imports obsoletos.
  - `git diff --check`
- Resultado de tests:
  - Subset Sprint 3 final: `6 passed, 2 skipped, 2 warnings`.
  - Suite backend final: `144 passed, 2 skipped, 3 warnings in 19.51s`.
  - `validate_build_features.py`: OK, 40 listings validados, 0 fallos en features intrinsecas.
  - `validate_pipeline.py` con `WASI_GATES_DIR=/tmp/wasi_gates`: OK, checks A/B y salida en `/tmp/wasi_gates/gate4_resultado.md`.
  - `pip check`: `No broken requirements found`.
  - `py_compile`: OK usando cache en `/tmp` para evitar permisos de `~/Library/Caches`.
  - Scan obsoleto: sin hits para imports planos ni `app/backend/models/v2`.
- QA Codex Agent:
  - Modelo/agente: Hubble, QA Codex Agent.
  - Prompt usado o referencia: revision final de Sprint 3 sobre rutas ML, imports, scripts, tests y dirs ignorados.
  - Veredicto inicial: RECHAZADO.
  - Findings iniciales:
    - Alto: quedaban imports `from ml import ...` en `validate_build_features.py`, `validate_pipeline.py`, `seed_catalogo.py` y `audit_calibracion_distritos.py`.
    - Alto: scripts legacy seguian usando `BACKEND / "models"`.
    - Medio: `test_model_paths.py` no cubria scripts rotos.
    - Medio: `pipeline/` y `aws/` siguen ignorados por repo principal.
  - Correccion aplicada:
    - Imports restantes migrados a `wasi.models.ml`.
    - Rutas legacy migradas a `MODELS_DIR`/`MODELS_V2_DIR`.
    - `test_model_paths.py` ampliado con scripts marcados por QA y scan anti-obsoletos.
    - `validate_pipeline.py` permite `WASI_GATES_DIR` para ejecucion en sandbox/CI.
  - Veredicto final: APROBADO CON RIESGOS.
  - Findings finales:
    - Criticos: ninguno.
    - Altos: ninguno.
    - Medios: ninguno funcional.
    - Bajos: `pipeline/` y `aws/` siguen ignorados por repo principal; cambios locales no viajan en commit normal.
- Regresiones encontradas:
  - Primer intento de tests v2 fallo por intentar escribir artefactos reales en `models/v2`; corregido con `tmp_path` + monkeypatch.
  - Primer `py_compile` fallo por permisos de cache Python; corregido con `PYTHONPYCACHEPREFIX=/tmp/wasi_pycache`.
  - Primer QA Codex Agent rechazo por imports/rutas obsoletas residuales; corregido y aprobado con riesgos en reevaluacion.
- Riesgos residuales aceptados:
  - `pipeline/` y `aws/` siguen ignorados por el repo principal; sus cambios existen localmente pero requieren decision de versionado/submodulo para ser entregables en git.
  - No se reentreno ningun modelo ni se regeneraron artefactos `.joblib`.
  - `venta_service` sigue siendo opcional/degradado; su politica queda pendiente si se decide hacerlo obligatorio.
- Decisiones tecnicas:
  - Fuente de verdad de artefactos productivos: `wasi.paths.MODELS_DIR` y `wasi.paths.MODELS_V2_DIR`.
  - Los tests negativos v2 no mutan `models/v2` real.
  - No tocar notebooks historicos salvo docs/scripts ejecutables.
- Pendientes para siguiente sprint:
  - Resolver decision de versionado de `pipeline/` y `aws/` antes de esperar que esos cambios viajen en un commit del repo principal.
  - Si se aprueba, avanzar a Sprint 4: correctness API y reglas de negocio.

## Sprint 4 - Correctness API y reglas de negocio

- Fecha inicio: 2026-07-05 18:23:58 -0500
- Fecha cierre: 2026-07-05 18:28:54 -0500
- Estado: Cerrado - APROBADO por QA Codex Agent final
- Sprint Goal: Corregir bugs funcionales de API que permiten manipular veredictos, aceptar inputs inconsistentes o exponer recursos en estados no validos.
- Areas auditadas:
  - `app/backend/routers/listings.py`
  - `app/backend/routers/auth.py`
  - `app/backend/routers/fairvalue.py`
  - `app/backend/schemas.py`
  - Tests de listings, favoritos, schemas, auth y fairvalue.
- Cambios realizados:
  - Creacion de listing ahora deriva distrito desde `lat/lng` con `geo_lookup` y rechaza `district` inconsistente.
  - `fair_value_ref` de listing se calcula con el distrito derivado, no con `payload.district`.
  - `GET /listings/{id}` oculta listings no activos para usuarios que no son dueños.
  - `POST /listings/{id}/leads` rechaza listings no activos con `409`.
  - Favoritos no aceptan ni listan listings no activos.
  - `CounterfactualIn` aplica la misma regla de `dormitorios=0` que `PredictIn`.
  - Registro/login normalizan email a lowercase y login busca case-insensitive.
  - `PATCH /me` rechaza nombres vacios tras `strip()`.
  - `LeadIn` y `ListingIn.contact_email` normalizan emails a lowercase.
  - Errores `RuntimeError` de explicación/narrativa usan mensaje publico estable y no `str(e)`.
- Archivos principales tocados:
  - `app/backend/routers/listings.py`
  - `app/backend/routers/auth.py`
  - `app/backend/routers/fairvalue.py`
  - `app/backend/schemas.py`
  - `app/backend/tests/test_auth_contract.py`
  - `app/backend/tests/test_api.py`
  - `app/backend/tests/test_listings.py`
  - `app/backend/tests/test_favorites_sort.py`
  - `app/backend/tests/test_schemas.py`
  - `src/wasi/AUDIT_LOG.md`
  - `src/wasi/CHANGELOG_AUDITORIA.md`
- Tests ejecutados:
  - `app/backend/venv/bin/pytest -q app/backend/tests/test_auth_contract.py app/backend/tests/test_schemas.py app/backend/tests/test_listings.py app/backend/tests/test_api.py -ra --tb=short`
  - `app/backend/venv/bin/pytest -q -ra --tb=short`
  - `app/backend/venv/bin/pip check`
  - `rg` de `detail=str(e)`, query email case-sensitive y patrones obsoletos.
  - `git diff --check`
- Resultado de tests:
  - Subset Sprint 4 final: `43 passed, 3 warnings`.
  - Suite backend final: `154 passed, 2 skipped, 3 warnings in 20.94s`.
  - `pip check`: `No broken requirements found`.
  - `git diff --check`: OK.
  - Scan funcional: sin `detail=str(e)` ni query auth directa `User.email == payload.email` en codigo.
- QA Codex Agent:
  - Modelo/agente: Anscombe, QA Codex Agent.
  - Prompt usado o referencia: revision final de Sprint 4 sobre listings, auth, schemas, fairvalue y tests.
  - Veredicto inicial: APROBADO CON RIESGOS.
  - Findings iniciales:
    - Medio: faltaban tests explicitos para catalogo/favoritos con pausado/alquilado.
    - Medio: faltaban tests para RuntimeError en narrative/detailed.
    - Medio: faltaban tests directos de lowercase en `LeadIn.email` y `ListingIn.contact_email`.
  - Correccion aplicada:
    - Agregados tests de `GET /api/listings` excluyendo `pausado`/`alquilado`.
    - Agregados tests de `POST /favorites` y `GET /favorites` contra listings no activos.
    - Agregados tests de errores internos en `narrative` y `narrative/detailed`.
    - Agregado test de lowercase para `contact_email` y `LeadIn.email`.
  - Veredicto final: APROBADO.
  - Findings finales:
    - Criticos: ninguno.
    - Altos: ninguno.
    - Medios: ninguno.
    - Bajos: solo cierre documental pendiente, corregido en esta bitacora/changelog.
- Regresiones encontradas:
  - Tests de favoritos que creaban listings por API con distrito artificial `TestSortZone` fallaron tras validar distrito; se corrigieron para usar `Miraflores` en creacion API.
  - QA inicial de Sprint 4 pidio cobertura adicional; tests agregados y suite final verde.
- Riesgos residuales aceptados:
  - La comparacion de distrito usa `casefold` exacto; no resuelve alias/acentos complejos.
  - Listings no activos siguen visibles para su dueño por ID.
  - Errores internos de otros subsistemas deben seguir revisandose en sprints posteriores.
- Decisiones tecnicas:
  - Preferimos rechazar `district` inconsistente con `lat/lng` en vez de sobrescribir silenciosamente.
  - `409 Inmueble no disponible` para leads sobre listings pausados/alquilados.
  - Mantener contratos publicos, salvo correcciones de validacion.
- Pendientes para siguiente sprint:
  - Si se aprueba, avanzar a Sprint 5: performance, concurrencia y abuso.

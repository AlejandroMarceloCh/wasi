# CHANGELOG_AUDITORIA - Wasi

## [2026-07-05] Ajuste - Formula Explorar v2

### Cambiado

- `POST /api/listings` usa `predict_fair_value` como fuente primaria para `fair_value_ref`.
- Se conserva fallback por comparables activos del mismo distrito si el modelo no esta disponible o devuelve una respuesta mal formada.

### Corregido

- Explorar ya no depende de una referencia basada solo en mediana USD/m2 cuando el modelo puede estimar el inmueble.
- El preview de publicacion y el listing persistido quedan alineados sobre la misma referencia predictiva base.
- El fallback de Explorar ya no cae a 500 por ausencia de `fair_value` o conversion invalida del resultado ML.

### Tests

- Listings: `21 passed, 3 warnings`.
- Suite backend: `157 passed, 2 skipped, 3 warnings in 24.51s`.
- `pip check`: `No broken requirements found`.
- `git diff --check`: OK.
- QA Codex Agent: `APROBADO CON RIESGOS`; riesgo aceptado de doble `geo_lookup` para Sprint 5/performance.

## [2026-07-05] Sprint 4 - Correctness API y reglas de negocio

### Cambiado

- `POST /api/listings` valida que `district` coincida con el distrito derivado por `lat/lng`.
- `GET /api/listings/{id}` oculta listings no activos para usuarios que no son dueños.
- Leads y favoritos bloquean listings no activos.
- Registro/login normalizan emails y login es case-insensitive.
- `PATCH /api/me` rechaza nombres vacios tras trim.
- Errores de explicación/narrativa usan mensajes publicos estables.

### Corregido

- El veredicto/ref de listings ya no puede manipularse cambiando `payload.district`.
- `CounterfactualIn` ya no acepta `dormitorios=0` con `es_estudio=false`.
- `LeadIn` y `ListingIn.contact_email` normalizan emails a lowercase.
- Se agrego cobertura explicita para `pausado`/`alquilado`, favoritos, narrative/detailed y lowercase de emails de lead/contacto.

### Seguridad

- Se reduce exposicion de recursos pausados/alquilados.
- Se evita filtrar detalles internos de `RuntimeError` en endpoints de explicacion/narrativa.

### Tests

- Subset Sprint 4 final: `43 passed, 3 warnings`.
- Suite backend final: `154 passed, 2 skipped, 3 warnings in 20.94s`.
- `pip check`: `No broken requirements found`.
- `git diff --check`: OK.
- QA Codex Agent final: `APROBADO`.

### Riesgos pendientes

- Comparacion de distrito exacta por `casefold`; aliases/acentos quedan para hardening posterior.

## [2026-07-05] Sprint 3 - Pipeline ML y rutas de modelos

### Cambiado

- Scripts ML migrados a imports `wasi.*` en lugar de imports planos rotos.
- Scripts de pipeline/regeneracion ahora usan `wasi.paths.MODELS_V2_DIR`.
- Scripts v1 de validacion fuerzan `DPD_FORCE_V1=1` antes de importar `model_service`.
- `validate_pipeline.py` permite `WASI_GATES_DIR` para escribir resultados fuera del repo en smoke/CI.
- Docs AWS/data manifest actualizados a `models/v2`.
- `.gitignore` y `model_service.py` documentan `models/` como ruta productiva.

### Corregido

- `generate_model_artefacts_v2.py` ya no apunta a `app/backend/models/v2`.
- `pipeline/run_pipeline.py`, `pipeline/rollback.py` y scripts `train_*` seleccionados ya no dependen de rutas muertas.
- `validate_build_features.py`, `validate_pipeline.py`, `seed_catalogo.py` y `audit_calibracion_distritos.py` ya no importan `ml` plano.
- Scripts legacy `generate_model_artefacts.py`, `gate3_amenities.py` y `gate6_seleccion_modelo.py` usan `MODELS_DIR`.
- Tests v2 de manifest/golden adulterado ahora cubren el modo activo sin mutar artefactos reales.

### Seguridad

- Sin cambios de seguridad directa. Se reduce riesgo operacional de regenerar/promover artefactos en una ruta no servida por runtime.

### Tests

- Subset Sprint 3 final: `6 passed, 2 skipped, 2 warnings`.
- Suite backend final: `144 passed, 2 skipped, 3 warnings in 19.51s`.
- `validate_build_features.py`: OK.
- `validate_pipeline.py` con `WASI_GATES_DIR=/tmp/wasi_gates`: OK.
- `pip check`: `No broken requirements found`.
- `py_compile` de scripts ML/pipeline tocados: OK con `PYTHONPYCACHEPREFIX=/tmp/wasi_pycache`.
- Scan de imports/rutas obsoletas: sin hits para imports planos ni `app/backend/models/v2`.
- QA Codex Agent final: `APROBADO CON RIESGOS`.

### Riesgos pendientes

- `pipeline/` y `aws/` siguen ignorados por el repo principal; sus cambios locales requieren decision de versionado/submodulo.
- No se reentreno ni regenero ningun `.joblib`.

## [2026-07-05] Sprint 2 - Seguridad y reproducibilidad critica

### Cambiado

- `seed_if_empty()` ya no crea usuarios demo por defecto; requiere `WASI_ENABLE_DEMO_SEED=1`.
- Startup ejecuta seed masivo solo en modo demo explicito y si no esta `WASI_SKIP_BULK_SEED`.
- CORS por defecto cambio de `*` a `http://localhost:5500`.
- El formulario de login ya no precarga credenciales demo.
- README documenta creacion de `app/backend/.env`, generacion de `JWT_SECRET` y modo demo explicito.
- `.env.example` y `app/backend/.env.example` documentan flags de demo/seed/CORS.

### Corregido

- Los logs de seed ya no imprimen passwords demo.
- `app/backend/.env.example` ya no incluye placeholder de Groq con forma de key real (`gsk_...`).
- Tests backend ya fijan `JWT_SECRET` propio y no dependen de `.env` local privada.

### Seguridad

- Se elimina el riesgo de desplegar una BD vacia con usuarios demo conocidos salvo que `WASI_ENABLE_DEMO_SEED=1` se active explicitamente.
- Se agregan tests para produccion sin usuarios demo y modo demo sin password en stdout.
- QA Codex Agent final aprobo Sprint 2 luego de quitar credenciales demo precargadas del frontend.

### Tests

- `cd app/backend && venv/bin/pytest -q -ra --tb=short`: `139 passed, 2 skipped, 3 warnings in 19.39s`.
- `cd app/backend && venv/bin/pip check`: `No broken requirements found`.
- Scan de patrones sensibles: sin key Groq placeholder ni credenciales demo en frontend; `demo1234` queda solo en constantes/tests/README del modo demo explicito.
- QA Codex Agent final: `APROBADO`.

### Riesgos pendientes

- Resolver decision de versionado/ownership para `pipeline/`, `aws/`, `research/` y `_backups/`.
- CORS todavia permite `*` si se configura explicitamente; no usar en staging/produccion.

## [2026-07-05] Sprint 1 - Baseline y mapa completo del sistema

### Cambiado

- Se agrego plan maestro de auditoria en `src/wasi/plan.md`.
- Se creo baseline inicial en `src/wasi/AUDIT_BASELINE.md`.
- Se creo bitacora historica en `src/wasi/AUDIT_LOG.md`.
- Se creo este changelog de auditoria.
- Se corrigio el baseline tras QA Codex inicial: endpoints con `/api`, subrepos, ignored files, tamanos, entorno Python, pytest y `pip check`.
- Se reemplazo el protocolo de QA externo por QA Codex Agent.
- Se cerro Sprint 1 con QA Codex Agent final: `APROBADO CON RIESGOS`.

### Corregido

- Solo documentacion de auditoria. Sprint 1 no modifica comportamiento funcional.

### Seguridad

- Se inventariaron archivos sensibles/generados locales: `app/backend/.env`, `app/backend/wasi.db`, caches y venvs.
- No se detectaron `.env`, `.db`, caches, venvs ni `.pyc` trackeados por git.

### Tests

- `cd app/backend && venv/bin/pytest -q -ra --tb=short`: `137 passed, 2 skipped, 1 warning in 18.20s`.
- `cd app/backend && venv/bin/pip check`: `No broken requirements found`.
- QA Codex Agent final: `APROBADO CON RIESGOS`.

### Riesgos pendientes

- Revisar repositorios anidados `pipeline/.git` y `research/eda/.git`.
- Revisar respaldo anidado `_backups/_archive/pipeline_scrapers_ale/.git` antes de cualquier limpieza.
- Clasificar archivos sin trackear previos: `PLAN_MIGRACION_MODULAR.md`, `_video_trailer/`, `entregables/`.
- Revisar warning de deprecacion de httpx.

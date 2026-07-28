# AUDIT_BASELINE - Wasi

Fecha de captura: 2026-07-05 13:12:23 -0500  
Revision Sprint 1: 2026-07-05 13:45 aprox.

## 1. Estado git inicial

- Ruta del repo: `/Users/alejandromarcelo/Desktop/PROYECTOS_2026/Proyecto_DPD`
- Rama actual repo principal: `refactor/modular`
- Ultimos commits:

```text
3975460 Add trailer link to README thumbnail and home hero
c3863f9 feat: subir foto desde dispositivo al publicar + autocompletar distrito/direccion al mover el pin + link video en README
4f08064 feat: explainability mas claro — factores ordenados por impacto + leyenda de orientacion
9694d94 feat: fotos reales de departamentos por listing (pool Unsplash verificado)
2a9f8e5 fix: reparar regex safeImageUrl roto al limpiar comentarios + imagen mockup distinta por listing
```

Archivos sin trackear visibles en repo principal:

```text
?? PLAN_MIGRACION_MODULAR.md
?? _video_trailer/
?? entregables/
?? src/wasi/AUDIT_BASELINE.md
?? src/wasi/AUDIT_LOG.md
?? src/wasi/CHANGELOG_AUDITORIA.md
?? src/wasi/PLAN_RESOLUCION_AUDITORIA.md
?? src/wasi/plan.md
```

Clasificacion:

- Archivos de auditoria creados en esta ejecucion: `src/wasi/plan.md`, `src/wasi/AUDIT_BASELINE.md`, `src/wasi/AUDIT_LOG.md`, `src/wasi/CHANGELOG_AUDITORIA.md`, `src/wasi/PLAN_RESOLUCION_AUDITORIA.md`.
- Archivos/directorios previos no tocados por esta auditoria: `PLAN_MIGRACION_MODULAR.md`, `_video_trailer/`, `entregables/`.

## 2. Estado ignored relevante

Comando:

```bash
git status --short --ignored
```

Ignored relevantes:

```text
!! .pytest_cache/
!! _backups/
!! app/backend/.audit-cache/
!! app/backend/.audit-venv/
!! app/backend/.audit-venv312/
!! app/backend/.env
!! app/backend/.pytest_cache/
!! app/backend/__pycache__/
!! app/backend/app/
!! app/backend/routers/__pycache__/
!! app/backend/tests/__pycache__/
!! app/backend/venv/
!! app/backend/wasi.db
!! aws/
!! entregables/_defensa/
!! models/v2/feature_names_item1.joblib
!! models/v2/modelo_final_item1.joblib
!! models/v2/xgb_q25_item1.joblib
!! models/v2/xgb_q50_item1.joblib
!! models/v2/xgb_q75_item1.joblib
!! pipeline/
!! research/
!! session.log
!! src/wasi.egg-info/
!! src/wasi/__pycache__/
!! src/wasi/features/__pycache__/
!! src/wasi/models/__pycache__/
```

Tamanos aproximados de ignorados/directorios relevantes:

```text
1.2G  _backups
300M  pipeline
40K   aws
196K  research
50M   models
31M   models/v2
16K   src/wasi.egg-info
16K   app/backend/app
813M  app/backend/venv
414M  app/backend/.audit-venv312
976K  app/backend/wasi.db
```

Riesgo: `pipeline/` y `aws/` estan ignorados pero son referenciados por tests, docs e infra. Deben clasificarse en Sprint 2/3 como versionados, submodulos o artefactos externos documentados.

## 3. Subrepos anidados

Repos `.git` detectados:

```text
./.git
./pipeline/.git
./research/eda/.git
./_backups/_archive/pipeline_scrapers_ale/.git
```

Estado `pipeline`:

```text
## docs/diagramas-flujo...origin/docs/diagramas-flujo
?? data/baseline_stats.json
?? data/external/
?? data/processed/inmuebles_clean_v2.csv
?? data/runs/
?? data/scraped/
?? data_manifest.yaml
?? notebooks/11_analisis_residuos.ipynb
?? notebooks/11_analisis_residuos.py
?? rollback.py
?? run_pipeline.py
?? scrapers/
?? scripts/
?? validation.py
```

Estado `research/eda`:

```text
## informe-eda...origin/informe-eda
```

Estado `_backups/_archive/pipeline_scrapers_ale`:

- Detectado por QA Codex final mediante `find . -name .git -type d -print`.
- Esta bajo `_backups/`, que esta ignorado y clasificado como respaldo local.
- Riesgo aceptado en Sprint 1: no se limpia ni versiona sin decision explicita del usuario.

Riesgo alto: cambios y archivos necesarios pueden estar fuera del repo principal y no aparecer en commits normales. No limpiar ni mover sin decision explicita.

## 4. Entorno y tests baseline

Python usado por `app/backend/venv`:

```text
Python 3.9.6
```

Comando baseline:

```bash
make test
```

Resultado inicial:

```text
137 passed, 2 skipped, 1 warning in 18.56s
```

Comando con detalle:

```bash
cd app/backend && venv/bin/pytest -q -ra --tb=short
```

Resultado detallado:

```text
137 passed, 2 skipped, 1 warning in 18.20s
```

Skips:

```text
SKIPPED [1] tests/test_startup.py:28: manifest.json no se valida en modo v2
SKIPPED [1] tests/test_startup.py:43: golden_prediction.json no se valida en modo v2
```

Warning:

```text
app/backend/tests/test_api.py::test_predict_happy_path
httpx DeprecationWarning: The 'app' shortcut is now deprecated. Use transport=WSGITransport(app=...).
```

Dependencias instaladas:

```bash
cd app/backend && venv/bin/pip check
```

Resultado:

```text
No broken requirements found.
```

Nota: `pip check` aviso que cache de pip en `~/Library/Caches/pip` no es escribible; no afecta dependencias.

## 5. Stack confirmado

- Backend: Python, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy 2, SlowAPI.
- Auth: PyJWT, passlib[bcrypt], bcrypt.
- DB: SQLite local por defecto y PostgreSQL opcional via `DATABASE_URL`.
- ML: scikit-learn 1.6.1, XGBoost 2.1.4, joblib, numpy 2.0.2, pandas 2.2.3, scipy 1.13.1.
- Frontend: HTML/CSS + React/JSX en `app/`, transpiling runtime via Babel en navegador.
- LLM opcional: Groq.
- Testing: pytest + httpx.
- CI: GitHub Actions con Python 3.9.
- Infra: Render, Vercel, AWS SAM/Lambda, aunque `aws/` esta ignorado localmente.

## 6. Mapa de estructura principal

- `app/`: frontend estatico y backend.
- `app/backend/`: API FastAPI, auth, DB, schemas, routers, seeds, rate limiting, tests.
- `app/backend/routers/`: endpoints por dominio.
- `app/backend/tests/`: suite pytest principal.
- `src/wasi/`: paquete Python principal del producto.
- `src/wasi/features/`: features geograficas, distritos, POIs y geo index.
- `src/wasi/models/`: servicios ML, venta y comparables.
- `models/`, `models/v2/`: artefactos ML productivos y manifiestos.
- `pipeline/`: pipeline historico/operativo, ignorado por repo principal y con repo git anidado.
- `ventas_model/`: extension de modelo de venta.
- `data/`: datasets y fuentes externas.
- `notebooks/`: notebooks de data/ML.
- `aws/`: infra AWS ignorada por repo principal.
- `entregables/`, `_video_trailer/`, `research/`, `_backups/`: docs, defensa, investigacion y respaldos.

## 7. Mapa real de endpoints FastAPI

Generado importando `main.app` desde `app/backend`.

```text
GET          /openapi.json
GET          /docs
GET          /docs/oauth2-redirect
GET          /redoc
POST         /api/auth/register
POST         /api/auth/login
GET          /api/me
PATCH        /api/me
GET          /api/dashboard
POST         /api/fairvalue/predict
POST         /api/fairvalue/simulate
POST         /api/fairvalue/predict-venta
POST         /api/fairvalue/counterfactual
GET          /api/fairvalue/comparables
GET          /api/analyses
GET          /api/analyses/{analysis_id}
GET          /api/fairvalue/explain/{analysis_id}
GET          /api/fairvalue/narrative/{analysis_id}
GET          /api/fairvalue/narrative/{analysis_id}/detailed
GET          /api/fairvalue/poi-importance
POST         /api/analyses/{analysis_id}/save
GET          /api/entorno/pois
GET          /api/entorno
GET          /api/distritos-zona
GET          /api/health
GET          /api/model/info
GET          /api/listings
GET          /api/listings/mine
POST         /api/listings
GET          /api/listings/{listing_id}
DELETE       /api/listings/{listing_id}
POST         /api/listings/{listing_id}/leads
GET          /api/listings/{listing_id}/leads
POST         /api/favorites
DELETE       /api/favorites/{listing_id}
GET          /api/favorites
GET          /
```

## 8. Mapa de frontend

Archivos principales en `app/`:

- `index.html`
- `landing.html`
- `app.jsx`
- `components.jsx`
- `api.js`
- `screens-core.jsx`
- `screens-fairvalue.jsx`
- `screens-home.jsx`
- `screens-listings.jsx`
- `screens-profile.jsx`
- `screens-public.jsx`
- `screens-seller.jsx`
- `styles.css`
- `aliases_lima.js`
- `stats.js`

Flujos a auditar/resolver:

- Landing/publico.
- Autenticacion y perfil.
- Fair value alquiler/venta.
- Listings y favoritos.
- Seller/publicacion.
- Dashboard.
- Manejo de errores, mobile y accesibilidad.

## 9. Mapa de artefactos ML

Artefactos raiz `models/`:

- Random Forest / XGBoost iniciales.
- `feature_names.joblib`, `feature_order.json`.
- `golden_prediction.json`.
- `manifest.json`.
- outlier caps y target encoding.

Artefactos `models/v2/`:

- Modelos lineales, Random Forest, XGBoost v2.
- `modelo_final_v2.joblib`.
- Cuantiles `xgb_q25_v2`, `xgb_q50_v2`, `xgb_q75_v2`.
- `manifest_v2.json`, `golden_prediction_v2.json`.
- `feature_names_v2.joblib`, scaler, target encoder, calibration, confidence thresholds.

Riesgo confirmado por auditoria: scripts/pipeline/AWS aun apuntan a `app/backend/models/v2` en varios lugares, mientras runtime resuelve `models/v2` via `wasi.paths`.

## 10. Hallazgos iniciales por severidad

### Critico

- `pipeline/` y `aws/` estan ignorados pero hay tests/docs/infra que dependen de ellos. Un clone limpio puede no reproducir pipeline/infra.
- Drift severo de rutas de modelos: runtime usa raiz `models/`, pipeline/scripts/AWS usan rutas antiguas.
- Seeds demo con passwords fijos se crean en startup si BD vacia; riesgo de produccion insegura.

### Alto

- Repos anidados no declarados: `pipeline/.git`, `research/eda/.git`.
- `pipeline/` tiene multiples archivos sin trackear en su propio repo.
- `.env` local requerido para reproducir backend, pero setup README no lo documenta suficientemente.
- Endpoints caros no tienen rate limit.
- Veredicto de listings manipulable por distrito declarado.
- Frontend productivo usa Babel/React dev en navegador y token en `localStorage`.

### Medio

- `app/backend/.env` y `app/backend/wasi.db` existen localmente, no trackeados.
- Warning de deprecacion httpx.
- README dice 126 tests, baseline real es 137 passed + 2 skipped.
- CI usa Python 3.9, Render usa 3.11.9 y Makefile dice 3.9-3.12.
- Tests v1 de manifest/golden estan skipped en modo v2.

### Bajo

- Caches locales y venvs grandes pueden contaminar auditorias si no se ignoran/limpian.
- Documentacion historica dispersa requiere clasificacion en sprints finales.

## 11. Estado del Sprint 1

Baseline corregido con hallazgos del QA Codex inicial y cerrado con QA Codex Agent final.

Veredicto final: APROBADO CON RIESGOS.

Riesgos aceptados:

- Existe un subrepo adicional bajo `_backups/_archive/pipeline_scrapers_ale/.git`; queda inventariado como respaldo local ignorado.
- `pipeline/`, `aws/`, `research/` y `_backups/` requieren decision explicita antes de limpiar, versionar o mover.

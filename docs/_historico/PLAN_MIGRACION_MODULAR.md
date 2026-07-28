# PLAN DE MIGRACIÓN MODULAR — WASI
> Auditado por 60 agentes (59 Sonnet + veredicto Opus) · 2026-06-30
> Suite verificada: **138 passed, 2 skipped** (los skips son test_venta — ver B3).
> **Veredicto: GO CON CONDICIONES.** Riesgo MEDIO. El riesgo es el silencio, no la
> dificultad: casi todos los fallos post-migración son soft (FileNotFoundError sin crash,
> USE_V2=False sin log, DataFrame vacío sin error). Sin CI y sin wasi/paths.py primero,
> un path roto solo se descubre en Render prod.
> **Tiempo estimado: 3–5 días de trabajo en bloque, no en sesiones fragmentadas**
> (el repo queda en estado roto entre R1 y R3 — no se puede pausar a la mitad).

---

## Bloqueantes reales (324 hallazgos crudos → 8 problemas reales)

| # | Bloqueante | Impacto | Fix |
|---|-----------|---------|-----|
| B1 | Divergencia git sin resolver — 3 commits locales vs 8 de Leo en origin/main; conflicto en `app/api.js` | Migrar encima genera conflictos de tres vías. Render deploya de origin/main | `git pull --rebase origin main`, resolver `api.js`, push limpio, confirmar con Leo |
| B2 | `Path(__file__)` en 8+ módulos (`model_service`, `geo_index`, `comparables`, `osm_lookup`, `display_pois`, `distrito_features`, `ml.py`, `venta_service`) | Al mover a `wasi/`, apuntan dentro del paquete donde no hay `data/`. Fallo silencioso: `distrito_features` devuelve DataFrame vacío sin error; `USE_V2=False` sin log | Crear `wasi/paths.py` PRIMERO antes de mover cualquier módulo ML |
| B3 | `venta_service` ya está roto HOY — path apunta a `ventas_model/models/xgb_venta.joblib` pero el `.joblib` real está en `models/v2/`. Los 2 skips de la suite son exactamente estos | `is_loaded()==False` en prod actual. CI verde mentiroso (skips en vez de fallo) | Corregir path como parte explícita de R0, no como efecto colateral. Reemplazar skips por `assert BUNDLE.exists()` |
| B4 | R3 y R4 no son atómicos — si `data/` y `models/` se mueven antes de cambiar `render.yaml`, hay ventana donde local pasa pero Render falla en runtime sin crash | Health check no lo detecta porque venta/modelo fallan soft | R3+R4 van en un único commit+deploy a Render |
| B5 | 77 imports planos + **imports lazy dentro de funciones** (`from ml_v2 import` en `ml.py:369,524,679,707`; routers entorno/fairvalue) | Solo fallan en la primera request a esa ruta — invisible en startup y en collection de pytest | Grep exhaustivo incluyendo dentro de funciones antes de mover nada. Smoke debe cubrir ruta V2, counterfactuals, /entorno, /predict-venta |
| B6 | `confidence_thresholds.json` no está en `data/` ni en `models/` — el plan original lo ignora completamente | Path roto silencioso en runtime | Incluirlo en inventario de R0, moverlo explícitamente en R3+R4 |
| B7 | Tests tienen falsos verde: los 2 skips de venta enmascaran el bug de B3; `test_pipeline_robustez.py` y `test_v2_features.py` skipean ante path roto en vez de fallar | CI pasa verde con la migración rota | Reemplazar skips por `assert Path.exists()` como precondición dura ANTES del skip |
| B8 | `database.py` carga `.env` con `BACKEND_DIR/__file__` — se rompe si migra al paquete | Fallo en startup | `database.py` SE QUEDA en `app/backend/` (no migra a `wasi/`) |

---

## Qué migra y qué se queda

**Se mueve a `src/wasi/features/`:**
- `geo_index.py`, `distrito_features.py`, `distritos_lima_features.py`, `osm_lookup.py`, `display_pois.py`

**Se mueve a `src/wasi/models/`:**
- `ml_v2.py`, `model_service.py`, `ml.py`, `venta_service.py`

**SE QUEDA en `app/backend/` (capa FastAPI — no migra):**
- `main.py`, `database.py`, `auth.py`, `models.py`, `schemas.py`, `seed.py`, `seed_listings_bulk.py`, todos los routers

> `auth.py` tiene colisión de nombre con `routers/auth.py` — si se mueve a `wasi/`
> genera ambigüedad. Se queda en `app/backend/` junto con la capa FastAPI.

**`data/` y `models/` van a la raíz** (junto con R3+R4, atómico).

**NO SE RENOMBRA `ml.py → counterfactuals.py`** — describe el 30% del archivo, son 28 puntos de import, colisiona con `test_counterfactuals.py` existente y pierde git blame. `model_service.py` ya tiene el nombre correcto.

---

## Precondiciones (no negociables — antes de crear la rama)

1. **Merge Leo** — `git pull --rebase origin main`, resolver `app/api.js` (URL prod de Leo + endpoints locales), push limpio. Revisar `git show` del commit de Leo para ver si tocó `data/` o `models/`.
2. **Rama dedicada** — `git checkout -b refactor/modular && git push -u origin refactor/modular`. No existe; sin ella `main` ES la única copia desplegable.
3. **CI** — `.github/workflows/ci.yml` corriendo la suite con `DATABASE_URL` temporal y `WASI_SKIP_BULK_SEED=1`. Sin CI un path roto solo se descubre en Render prod.
4. **Baseline verificado** — `venv/bin/python -m pytest -q` → **138 passed, 2 skipped**. Grep `Path(__file__)` en todos los módulos. Inventario completo de artefactos incluyendo `confidence_thresholds.json` y `ventas_model/xgb_venta.joblib`.
5. **Backup de render.yaml + env vars de Render** — snapshot de `JWT_SECRET`, `GROQ_API_KEY`, `PYTHON_VERSION` para poder revertir R4.
6. **Rotación de secretos** — `GROQ_API_KEY` puede estar commiteada; rotarla antes de que la rama sea pública.

---

## Sprints

### R0 — ✅ Red de seguridad (no se mueve NADA)
**Goal:** baseline reproducible + rama lista + Leo coordinado + bugs preexistentes corregidos.

Pasos verificables (no asunciones):
- Resolver divergencia con Leo (B1) — hacer esto PRIMERO
- `git checkout -b refactor/modular && git push -u origin refactor/modular`
- Crear `.github/workflows/ci.yml` (pytest con DATABASE_URL temporal + WASI_SKIP_BULK_SEED=1)
- `venv/bin/python -m pytest -q` → anotar exactamente: 138 passed, 2 skipped
- Grep exhaustivo: `grep -rn "Path(__file__)" app/backend/*.py` + `grep -rn "^from \|^import " app/backend/*.py` + `grep -rn "from [a-z]" app/backend/*.py` (imports lazy dentro de funciones)
- Inventariar artefactos: `data/`, `models/`, `confidence_thresholds.json`, `ventas_model/xgb_venta.joblib`
- Snapshot de `render.yaml` + env vars de Render
- **Corregir B3**: fix path de `venta_service` → `models/v2/xgb_venta.joblib`. Reemplazar los 2 skips por `assert BUNDLE.exists()`. Verificar que CI queda verde sin skips.
- **Corregir B7**: en `test_pipeline_robustez.py` y `test_v2_features.py`, añadir `assert Path(...).exists()` antes del skip
- `git fetch --all` + listar ramas de Leo

**Gate de cierre:** CI verde · 138 passed, 0 skipped · Leo en origin/main sin conflictos · inventario de artefactos completo

---

### R1 — ✅ Crear el paquete `wasi` (sin mover módulos ML todavía)
**Goal:** el paquete existe, está instalable, y `wasi/paths.py` centraliza todos los paths.

> **Importante (ajuste Opus):** R1 solo crea la estructura — NO mueve módulos ML aún.
> Mover `geo_index` solo ya rompe `ml`, `ml_v2`, `venta_service` y `main` simultáneamente.
> Los módulos se mueven todos juntos en R2.

- Crear `src/wasi/__init__.py` + `pyproject.toml` en la raíz:
  ```toml
  [build-system]
  requires = ["setuptools"]
  [project]
  name = "wasi"
  requires-python = ">=3.9,<3.10"
  [tool.pytest.ini_options]
  pythonpath = ["src"]
  [tool.setuptools.packages.find]
  where = ["src"]
  ```
- `pip install -e .` en el venv
- Crear `wasi/paths.py`:
  ```python
  from pathlib import Path
  import os

  def _find_root(start: Path) -> Path:
      for p in [start, *start.parents]:
          if (p / "pyproject.toml").exists():
              return p
      raise RuntimeError("REPO_ROOT no encontrado")

  REPO_ROOT = Path(os.environ.get("WASI_REPO_ROOT", "")) or _find_root(Path(__file__))
  DATA_DIR = REPO_ROOT / "data"
  MODELS_DIR = REPO_ROOT / "models"
  VENTAS_BUNDLE = REPO_ROOT / "models" / "v2" / "xgb_venta.joblib"
  CONFIDENCE_THRESHOLDS = REPO_ROOT / "models" / "v2" / "confidence_thresholds.json"
  ```
- Añadir asserts en `wasi/paths.py` que logueen (no crashean) si los dirs no existen
- Actualizar `conftest.py`: quitar `sys.path.insert`, usar `pip install -e .`

**Gate de cierre:** `python -c "from wasi.paths import REPO_ROOT; print(REPO_ROOT)"` funciona · pytest 138 passed

---

### R2 — ✅ Mover todos los módulos ML (atómico)
**Goal:** `geo_index`, `distrito_features`, `distritos_lima_features`, `osm_lookup`, `display_pois`, `ml_v2`, `model_service`, `ml`, `venta_service` en `src/wasi/`. Tests verdes.

> Todos los módulos se mueven EN UN SOLO SPRINT porque son interdependientes.
> Mover uno solo deja el repo en estado roto.

- `git mv` de cada módulo al destino correcto:
  - `wasi/features/`: geo_index, distrito_features, distritos_lima_features, osm_lookup, display_pois
  - `wasi/models/`: ml_v2, model_service, ml, venta_service
- Actualizar **todos** los imports — top-level Y lazy (dentro de funciones):
  - 77 imports planos identificados en R0
  - `from ml_v2 import` en `ml.py:369,524,679,707`
  - Imports en routers entorno/fairvalue dentro de endpoints
  - 9 callers de `import ml` (bare) → `from wasi.models import ml as ml`
  - Actualizar también `tests/` en el mismo sprint
- Reemplazar todos los `Path(__file__)` por imports de `wasi.paths`
- Añadir `asserts` explícitos: `assert MODEL_SERVICE.is_loaded()`, conteo de POIs > 0
- Smoke local: `uvicorn app.backend.main:app` + hits manuales a:
  - POST `/predict` (alquiler, ruta V2)
  - POST `/fairvalue/counterfactuals`
  - GET `/entorno` (dispara osm/display_pois lazy)
  - POST `/predict-venta`

**Gate de cierre:** pytest 138 passed, 0 skipped · smoke de las 4 rutas OK

---

### R3+R4 — ✅ Mover artefactos + reconfigurar Render (ATÓMICO)
**⚠️ Un único commit + un único deploy a Render. No subir entre R3 y R4.**

- `git mv app/backend/data → data/`
- `git mv app/backend/models → models/`
- Mover `confidence_thresholds.json` explícitamente (B6)
- Verificar que `wasi/paths.py` ya apunta a la nueva ubicación
- Cambiar `render.yaml`:
  - Quitar `rootDir: app/backend`
  - `buildCommand: pip install -e . && pip install -r app/backend/requirements.txt`
  - `startCommand: uvicorn app.backend.main:app`
- Probar en **servicio Preview de Render** primero:
  - Crear preview o segundo servicio apuntando a la rama
  - Gate de staging: GET `/health` + POST `/predict` real + POST `/predict-venta`
  - Solo tras staging verde → promover a prod
- Verificar Vercel sigue apuntando al backend correcto
- Correr pytest desde la raíz = 138 passed como parte del gate

**Gate de cierre:** staging verde · prod verde · smoke de 4 rutas en prod

---

### R5 — Limpieza opcional
**Pre-requisito:** R3+R4 cerrados con staging Y prod verdes.

- Antes de mover `pipeline/` y `ventas_model/`: arreglar `test_pipeline_robustez.py` (hoy hardcodea `parents[3]/"pipeline"`) y `test_v2_features.py` — que hagan `assert Path.exists()` antes de skipear
- Coordinar con Leo antes de mover archivos trackeados (`pipeline/`, `notebooks/`, `ventas_model/`)
- **NO renombrar `ml.py`** (ver decisión arriba)
- README de Leo: no tocar

**Gate de cierre:** 138 passed · deploy prod verde · raíz limpia según definición binaria acordada

---

## Plan de reversa
Cada sprint es uno o pocos commits en `refactor/modular`. Si R3+R4 falla, `main` sigue intacto y desplegado — se descarta la rama. El deploy viejo nunca se toca hasta que el nuevo esté probado en staging.

## Gate final
- [ ] 138 passed, 0 skipped en `refactor/modular`
- [ ] CI verde en GitHub Actions
- [ ] Deploy staging Y prod verdes (probados, no asumidos)
- [ ] Smoke de 4 rutas: /predict alquiler, /counterfactuals, /entorno, /predict-venta
- [ ] Frontend (Vercel) funciona contra backend nuevo
- [ ] Leo al tanto, origin/main sin conflictos
- [ ] README de Leo intacto
- [ ] Secretos rotados + fuera del repo
- [ ] Solo entonces: merge a `main`

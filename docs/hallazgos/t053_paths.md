# T053 — paths: portabilidad dev, Render y hardcodes

**TARGET:** `src/wasi/paths.py`  
**LENTE:** portabilidad  
**Fecha:** 2026-07-06

---

## Resumen

Centralización de rutas **lograda** — cero `Path(__file__)` en módulos wasi migrados. Auto-detecta `data/` y `models/` en raíz vs `app/backend/`. `WASI_REPO_ROOT` habilita Render. Gaps: `VENTAS_BUNDLE` sin fallback, warnings silenciosos y dependencia de `pyproject.toml` en imagen.

---

## Hallazgos

### [INFO] · Override `WASI_REPO_ROOT` · `paths.py:29-30` — env var para despliegues sin árbol estándar. · Render-friendly. · OK.

### [INFO] · Detección dual data/models · `paths.py:34-43` — raíz del repo vs `_BACKEND_DIR`. · Soporta pre/post migración R3+R4. · OK; test `test_model_paths_apuntan_a_raiz_del_repo`.

### [MEDIO] · `VENTAS_BUNDLE` solo en raíz · `paths.py:45` — `REPO_ROOT / "ventas_model" / ...` sin fallback a backend. · Deploy que solo copie `app/backend` pierde venta silenciosamente (`is_loaded=False`). · Misma heurística exists() que DATA_DIR o documentar en Dockerfile.

### [MEDIO] · `_check_paths()` solo warning · `paths.py:55-67` — bundle/thresholds/v2 ausentes loguean warning, no fallan import. · Ops puede no notar estimador de venta caído. · Elevar a error en startup para paths críticos de alquiler; warning explícito en health.

### [INFO] · Cadena de fallback `CONFIDENCE_THRESHOLDS` · `paths.py:46-50` — v2 primero, luego backend legacy. · OK.

### [BAJO] · `_find_root` exige `pyproject.toml` · `paths.py:19-27` — contenedor mínimo sin pyproject → `RuntimeError` al importar wasi. · Incluir pyproject en imagen prod (habitual). · Fallback a `WASI_REPO_ROOT` obligatorio en Docker slim.

### [INFO] · `EXTERNAL_DATA_DIR = DATA_DIR / "external"` · `paths.py:53` — OSM/display dependen de esta ruta. · Si falta carpeta, índices OSM/display cargan vacío (soft fail). · OK con monitoreo.

### [INFO] · Scripts críticos importan desde `wasi.paths` · `test_model_paths.py:test_scripts_criticos_importan_sin_rutas_muertas`. · Migración modular exitosa. · OK.

---

## Veredicto

**Portabilidad buena** para el modelo de alquiler v2. Ajustar **VENTAS_BUNDLE fallback** y **severidad de checks** antes de Postgres/Render multi-servicio.

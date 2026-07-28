# T037 — Main: arranque (lifespan, CORS, init, fallos de carga)

**TARGET:** `app/backend/main.py`  
**LENTE:** arranque  
**Fecha:** 2026-07-06

---

## Resumen

Lifespan ordenado con fail-fast en `model_service` y carga tolerante en `venta_service` y bulk seed. CORS configurable; bulk seed acoplado al flag demo.

---

## Hallazgos

### [MEDIO] · `venta_service.load()` falla en silencio · `main.py:44-47` — `except Exception as e: print(...)`. · Backend arranca sin modelo de venta; publicar/filtrar venta degrada a comparables o referencias vacías sin 503. · Fail-fast en prod (`WASI_REQUIRE_VENTA=1`) o health check que reporte `venta_loaded: false`.

### [MEDIO] · `seed_bulk()` error silenciado con print · `main.py:36-40` — excepción capturada, solo log stdout. · Catálogo vacío en demo sin alerta en monitoring; difícil diagnosticar CSV faltante o usuario catálogo ausente. · Log estructurado + métrica; en demo, re-raise o warning en `/health`.

### [MEDIO] · Bulk seed solo corre con `WASI_ENABLE_DEMO_SEED=1` · `main.py:35` + `seed.py:31-33`. · Correcto para prod (no sembrar 3.3k en Render), pero acopla catálogo masivo al flag de usuarios demo; confuso si se quiere catálogo sin credenciales conocidas. · Flag separado `WASI_ENABLE_BULK_SEED` desacoplado de demo users.

### [INFO] · `model_service.load()` fail-fast · `main.py:43` — `RuntimeError` tumba el proceso. · Coherente con tests `test_startup.py`. · OK.

### [INFO] · Orden init: BD → seed → modelos → geo · `main.py:31-48` — `create_all`, `ensure_schema`, `seed_if_empty`, bulk opcional, ML, `get_index()`. · Dependencias respetadas (geo tras modelos no bloquea). · OK.

### [INFO] · Rate limiter registrado globalmente · `main.py:54-55` — `app.state.limiter` + handler 429. · Solo endpoints decorados se benefician (ver T040). · OK infra.

### [BAJO] · CORS default `localhost:5500`; `*` si `WASI_CORS_ORIGINS=*` · `main.py:57-65` — `allow_credentials=False`. · Aceptable en dev; en prod definir orígenes explícitos. · Documentar en deploy Render.

### [BAJO] · `GET /` expone `model_version` sin auth · `main.py:75-81`. · Información de versión no crítica; superficie mínima. · Opcional: mover a `/health` o `/model/info`.

### [INFO] · `seed_if_empty()` siempre en lifespan · `main.py:33` — distritos sin flag demo; usuarios demo gated en `seed.py`. · Seguro fuera de dev para credenciales. · OK (ver T038).

---

## Veredicto

Arranque robusto para el modelo principal. Endurecer visibilidad de fallos en venta y bulk seed; considerar desacoplar flags de sembrado.

# T029 — Health: correctitud (503/200 vs estado real)

**TARGET:** `app/backend/routers/health.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

El probe refleja solo el modelo de **alquiler** (`model_service`). El modelo de **venta** y servicios auxiliares (Groq, venta) no degradan el health.

---

## Hallazgos

### [INFO] · 200 si `model_service.is_loaded`, si no 503 · `health.py:81-91` — `status: ok|degraded`, `model_mode`, `model_version`, `uptime_seconds`. · Test `test_health_sin_auth_responde_200`. · OK para liveness del modelo principal.

### [ALTO] · Health ignora `venta_service` · `health.py:83` + `main.py:44-47` — venta carga opcional (try/except en startup); health siempre verde si alquiler OK. · Uptime/K8s marca "ok" mientras `predict-venta` devuelve 503; monitor no detecta mitad del producto caída. · Incluir `venta_loaded: bool` y degradar a 503 (o `degraded` parcial) si venta es requisito de producción.

### [MEDIO] · Arranque fail-fast solo para alquiler · `main.py:43` — `model_service.load()` obligatorio; venta opcional. · Coherente con health actual pero asimétrico para producto venta. · Documentar en `/health` qué modelos se monitorean.

### [INFO] · Sin filtrar paths internos en respuesta · `health.py` — test `test_health_no_requiere_auth_ni_filtra_jerga`. · OK para probes públicos.

### [INFO] · `/model/info` siempre 200 si el proceso vive · `health.py:93-118` — métricas estáticas de `ml.MODEL_*`. · No es readiness probe; es metadata. · OK.

### [BAJO] · `distritos-zona` en mismo router sin health semantics · `health.py:72-78` — JSON estático, sin auth. · No afecta 503; mezcla observabilidad con datos públicos. · Mover a router de datos o documentar.

### [INFO] · Geo index no aparece en health · `main.py:48` — `get_index()` en startup pero no en probe. · Si geo falla, el proceso no arranca. · Aceptable.

---

## Veredicto

**503/200 honesto para el modelo de alquiler.** Para producción con venta, el health actual **sobre-reporta** disponibilidad.

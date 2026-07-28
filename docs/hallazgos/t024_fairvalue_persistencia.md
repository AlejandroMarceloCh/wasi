# T024 — Fairvalue: persistencia

**TARGET:** `app/backend/routers/fairvalue.py`  
**LENTE:** persistencia  
**Fecha:** 2026-07-06

---

## Resumen

Mapa claro de qué ensucia historial. Solo `/fairvalue/predict` y `POST /analyses/{id}/save` escriben datos de negocio duraderos.

---

## Hallazgos

### [ALTO] · `POST /fairvalue/predict` persiste Property + Analysis + Factors · `fairvalue.py:100-134` — cada llamada crea filas nuevas y actualiza `last_activity_at`. · Historial de análisis crece con cada estimación de alquiler (incl. si el frontend usa predict en vez de simulate). · UI ya usa simulate en publicar (Sprint 2); fairvalue-form alquiler sigue en predict — documentar o unificar.

### [INFO] · `POST /fairvalue/simulate` — sin persistencia · `fairvalue.py:146-167` — docstring explícito; solo CPU. · OK.

### [INFO] · `POST /fairvalue/predict-venta` — sin Analysis · `fairvalue.py:169-214` — solo `last_activity_at` + commit. · No ensucia historial de análisis. · OK.

### [INFO] · `POST /fairvalue/counterfactual` — sin persistencia · `fairvalue.py:216-230`. · OK.

### [INFO] · `GET /fairvalue/comparables` — sin persistencia · `fairvalue.py:232-253`. · OK.

### [INFO] · `GET /analyses`, `GET /analyses/{id}` — solo lectura · `fairvalue.py:255-292`. · OK.

### [INFO] · `POST /analyses/{id}/save` crea Report idempotente · `fairvalue.py:689-707` — segundo save devuelve mismo `report_id`. · OK.

### [MEDIO] · Narrativa LLM (Groq) no persiste texto · `fairvalue.py:401-491,493-675` — cada apertura re-llama API externa. · Costo/latencia repetidos; no contamina BD. · Cache por `analysis_id+mode` si se quiere ahorrar tokens.

### [INFO] · Explain/SHAP no persiste · `fairvalue.py:294-332` — recomputa desde Property. · OK.

---

## Tabla resumen

| Endpoint | Persiste | Qué escribe |
|----------|----------|-------------|
| POST `/fairvalue/predict` | **Sí** | Property, Analysis, AnalysisFactor, User.last_activity_at |
| POST `/fairvalue/simulate` | No | — |
| POST `/fairvalue/predict-venta` | Parcial | User.last_activity_at |
| POST `/fairvalue/counterfactual` | No | — |
| GET `/fairvalue/comparables` | No | — |
| POST `/analyses/{id}/save` | **Sí** | Report |
| GET narrative/* | No | — (llamada Groq efímera) |

---

## Veredicto

**Contrato de no-persistencia en simulate/venta/counterfactual respetado.** El único ensuciante deliberado del historial es `/predict`; vigilar que solo el flujo de análisis formal lo use.

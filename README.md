# Proyecto DPD — Viviendas / Alquileres Lima

Predicción del **precio de referencia** de alquiler de departamentos en Lima,
cruzado con el contexto del barrio (POIs, criminalidad). Proyecto del curso
DPD (UTEC). Fusiona la app **Justa** con el modelo de ML de **Leo**.

## Estructura

```
Proyecto_DPD/
├── PLAN.md       # plan de implementación (v6, tras 5 auditorías)
├── contexto.md   # contexto para auditoría
├── gates/        # resultados de los 6 gates pre-ejecución
├── session.log   # bitácora de hallazgos
├── app/          # "Justa" — web app (React sin build + FastAPI/SQLite)
│   ├── index.html app.jsx screens.jsx components.jsx api.js
│   └── backend/  # FastAPI: model_service, geo_index, ml, routers, tests
├── pipeline/     # modelo de Leo — notebooks + modelos .joblib + dataset
└── _archive/     # pipeline de scraping viejo (no se usa)
```

## Estado

**App funcional end-to-end.** El usuario pone un pin en el mapa, describe el
depto y recibe un precio de referencia calculado por **Random Forest**
(MAPE 15,9 %), con veredicto y contexto del barrio.

- 6 Gates cerrados (`gates/`), 8 fases completas.
- Backend: FastAPI + SQLite, modelo aislado tras `model_service.py`.
- Índice geográfico KD-tree + IDW haversine (`geo_index.py`).
- 31 tests pytest, todos pasan.

## Cómo correr

```bash
# Backend
cd app/backend && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000

# Frontend (otra terminal)
cd app && python3 -m http.server 5500
```
Abrir http://localhost:5500 · usuario demo `ana@justa.pe` / `demo1234`.

## El modelo de Leo va a cambiar

Leo mejorará el modelo en un branch aparte. La integración está desacoplada:
para cambiarlo, copiar el `.joblib` nuevo a `app/backend/models/`, correr
`scripts/generate_model_artefacts.py` y reiniciar. El startup valida el swap.

## Historial

- 2026-05-20/21: integración del modelo real de Leo a Justa. Backend reescrito
  (SQLite, geo_index, model_service), frontend con wizard + mapa Leaflet.
- 2026-05-20: se unificaron `app/` y el pipeline bajo `Proyecto_DPD/`.

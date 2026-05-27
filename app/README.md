# Justa — Proptech IA Lima

Web app que estima el **precio de referencia** de alquiler de departamentos en
Lima con un modelo de ML real (**Random Forest**, entrenado sobre 3.348 avisos)
y lo cruza con el contexto del barrio (POIs, denuncias) por ubicación exacta.

## Stack

- **Frontend**: React 18 vía `@babel/standalone` (sin build) + **Leaflet** por
  CDN — `index.html`, `app.jsx`, `screens.jsx`, `components.jsx`, `api.js`.
- **Backend**: FastAPI + SQLAlchemy 2 + JWT (HS256).
- **BD**: **SQLite** por defecto (cero setup; archivo `backend/justa.db`).
  El código es agnóstico — para PostgreSQL basta definir `DATABASE_URL`.
- **Modelo**: `04_random_forest.joblib` aislado tras `model_service.py`.
  El contexto geográfico lo sirve `geo_index.py` (KD-tree + IDW).

## Arranque rápido

### 1. Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000     # http://localhost:8000
```

El startup crea la BD SQLite, la siembra (40 distritos + usuario demo), carga
el modelo y lo valida (hash + features + golden prediction). Si el modelo no
pasa, el backend **no arranca**. Swagger: http://localhost:8000/docs

### 2. Frontend

`index.html` carga React y Leaflet por CDN; basta servirlo estático:

```bash
# desde la carpeta app/
python3 -m http.server 5500
# abrir http://localhost:5500
```

> `api.js` apunta a `http://localhost:8000` por default. Para otro puerto,
> definí `window.JUSTA_API_BASE` antes del script.

### Usuario demo

`ana@justa.pe` / `demo1234`  (el login viene prellenado).

## Flujo del producto

1. **Login** → Dashboard.
2. **Fair Value** — wizard de 3 pasos: pin en el mapa → datos del depto →
   precio → **precio de referencia** con veredicto Ganga/Justo/Inflado.
3. **Entorno** — mapa con pin arrastrable; POIs, denuncias y score del barrio
   se recalculan en vivo al mover el pin.

## Pantallas ↔ endpoints

| Pantalla | Endpoint(s) |
|---|---|
| Auth | `POST /api/auth/login`, `/register` |
| Dashboard | `GET /api/dashboard` |
| Fair Value (wizard) | `POST /api/fairvalue/predict` |
| Fair Value (resultado) | `GET /api/analyses/{id}`, `POST /api/analyses/{id}/save` |
| Entorno | `GET /api/entorno?lat=&lng=` |
| Perfil | `GET /api/me` |

## Arquitectura del backend

```
POST /api/fairvalue/predict  →  routers/fairvalue.py
   ├── geo_index.py       pin (lat,lng) → contexto geo (KD-tree + IDW haversine)
   ├── ml.py              form + geo → 74 features (build_features)
   └── model_service.py   74 features → predicción USD  (capa de aislamiento)
```

`model_service.py` es la única pieza que toca el `.joblib`. Para cambiar el
modelo: copiar el `.joblib` nuevo a `models/`, correr
`scripts/generate_model_artefacts.py` y reiniciar.

**Tablas (SQLite, generadas por el ORM):** `users`, `districts`, `properties`,
`analyses`, `analysis_factors`, `reports`. Los datos geográficos NO van a la
BD — los sirve `geo_index.py`.

## Tests

```bash
cd backend && ./venv/bin/python -m pytest tests/ -q
```

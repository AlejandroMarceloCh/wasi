# Justa — Backend (FastAPI)

Backend de Justa: sirve el **precio de referencia** de alquiler en Lima con un
modelo Random Forest real y el contexto del barrio.

## Stack
- **FastAPI** + **SQLAlchemy 2.x**
- **SQLite** por defecto (cero setup; `DATABASE_URL` para usar PostgreSQL)
- **JWT** (HS256) + bcrypt
- **scikit-learn 1.6.1** — modelo de Leo aislado tras `model_service.py`

## Setup

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

El startup crea la BD SQLite, la siembra (40 distritos + usuario demo
`ana@justa.pe` / `demo1234`), carga el modelo y lo valida. Si el modelo no
pasa las 3 validaciones (hash, n_features, golden prediction), **no arranca**.

Docs interactivas: `http://localhost:8000/docs`

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/register` | no | Crea usuario (409 si duplicado) |
| POST | `/api/auth/login` | no | `{token, user}` (401 si mal) |
| GET | `/api/me` | sí | Usuario actual |
| GET | `/api/dashboard` | sí | Stats + recientes + cobertura |
| POST | `/api/fairvalue/predict` | sí | Predicción + persiste análisis |
| GET | `/api/analyses/{id}` | sí | Detalle de un análisis |
| POST | `/api/analyses/{id}/save` | sí | Guarda como reporte |
| GET | `/api/entorno?lat=&lng=` | sí | Contexto del barrio para un pin |

### Ejemplo — predicción

```bash
curl -X POST http://localhost:8000/api/fairvalue/predict \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"lat":-12.121,"lng":-77.030,"area":90,"dormitorios":2,"banos":2,
       "es_estudio":false,"cocheras":1,"antiguedad_anios":8,
       "amenities":["ascensor","seguridad"],"precio":1100}'
```

Errores: `400` pin fuera de Lima · `422` campo fuera de rango · `401` sin token.

## Arquitectura

```
main.py            FastAPI app + lifespan (crea BD, seed, carga modelo)
database.py        engine SQLAlchemy (SQLite por defecto, agnóstico)
models.py          ORM — 6 tablas transaccionales
schemas.py         Pydantic — contrato PredictIn/PredictOut (PLAN.md §9)
auth.py            bcrypt + JWT
geo_index.py       KD-tree + IDW haversine — contexto geo por pin
model_service.py   capa de aislamiento del modelo (carga/valida/predice)
ml.py              build_features (form → 74 features) + predict_fair_value
seed.py            seed idempotente (distritos + usuario demo)
routers/           auth, dashboard, fairvalue, entorno
models/            artefactos del modelo (.joblib + .json)
scripts/           auditoría, generación de artefactos, gates, calibración
tests/             31 tests pytest
db/                README — el esquema lo genera el ORM (no hay schema.sql)
```

## Modelo

`predict_fair_value` (`ml.py`): `geo_lookup` reconstruye el contexto geo del
pin → `build_features` arma las 74 features → `model_service.predict` corre el
Random Forest → `expm1` → precio de referencia USD + veredicto.

Para cambiar el modelo de Leo: copiar el `.joblib` nuevo a `models/`, correr
`scripts/generate_model_artefacts.py`, reiniciar. El startup valida el swap.

## Tests

```bash
./venv/bin/python -m pytest tests/ -q     # 31 tests
```

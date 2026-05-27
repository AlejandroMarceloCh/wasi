# Wasi

Webapp que estima el precio de alquiler de un departamento en Lima Metropolitana
y devuelve un veredicto (Ganga / Justo / Inflado) con rango de incertidumbre y
contexto del barrio. Proyecto del curso DS3022 — Desarrollo de Productos de
Datos, UTEC.

## Cómo correr

Requisitos: Python 3.11, Git y un navegador moderno. Probado en macOS 14 y
Ubuntu 22.04.

```bash
# Clonar
git clone https://github.com/AlejandroMarceloCh/wasi.git
cd wasi

# Setup (una sola vez · crea venv e instala dependencias)
make setup

# Levantar — abrir dos terminales en paralelo
make backend     # FastAPI en http://localhost:8000
make frontend    # Estatico en http://localhost:5500
```

Demo: http://localhost:5500 · usuario `ana@wasi.pe` / `demo1234`.

El primer arranque tarda ~10 s mientras se valida el modelo y se calienta
el indice geografico (cKDTree con 11 K POIs).

## Stack

- **Frontend**: React 18 + Babel standalone + Leaflet, todo por CDN (sin build).
- **Backend**: FastAPI 0.110 + SQLAlchemy 2 + SQLite + JWT.
- **ML**: XGBoost 2.1.4. Un modelo central + tres modelos quantile (P25, P50, P75).
- **Geo**: `scipy.spatial.cKDTree` sobre esfera unitaria + distancia haversine.

## Datos

3,348 listings de AdondeVivir y Properati, cruzados con cuatro fuentes publicas:

| Fuente | Granularidad | Aporte |
|---|---|---|
| INEI ENAPRES | Manzana | Estrato socioeconomico (NSE) |
| MININTER 2024 | Distrito | Denuncias totales |
| CENACOM | Punto | 50 comisarias |
| OpenStreetMap | Punto | 11,100 POIs en 7 categorias |

En total, 101 features alimentan el modelo (incluye breakdown por tier de POIs: Wong/Vivanda vs Plaza Vea, BCP/BBVA vs banco chico, Inkafarma/MiFarma vs farmacia barrial). Cero APIs pagas.

## Metricas

| Metrica | Valor | Conjunto |
|---|---|---|
| MAPE | 15.63 % | Test (n=503) |
| R² | 0.847 | Test |
| MAE | $159 | Test |
| RMSE | $298 | Test |
| Coverage P25-P75 | 41.75 % | Test (target teorico 50 %) |

## Estructura

```
.
├── README.md
├── Makefile                · make backend / make frontend / make test
├── .env.example            · template de variables de entorno
├── app/                    · webapp end-to-end
│   ├── index.html          · entry del frontend
│   ├── app.jsx             · router
│   ├── screens.jsx         · pantallas (Login, Wizard, Result, Entorno, FAQ)
│   ├── components.jsx      · UI compartida
│   ├── api.js              · cliente fetch + JWT
│   └── backend/
│       ├── main.py         · entry FastAPI + lifespan (valida modelo)
│       ├── model_service.py · aislamiento del .joblib
│       ├── ml.py           · build_features + counterfactuals + interval
│       ├── ml_v2.py        · 101 features del modelo v2
│       ├── geo_index.py    · KD-tree esfera + IDW haversine
│       ├── osm_lookup.py   · POIs por categoria
│       ├── distrito_features.py · NSE manzana + denuncias distrito
│       ├── routers/        · auth, dashboard, fairvalue, entorno, health
│       ├── models/v2/      · .joblib del modelo XGBoost + quantile
│       ├── data/external/  · POIs, denuncias, comisarias
│       └── tests/          · 63 pytest tests
└── notebooks/              · proceso de ML reproducible
    ├── 01_limpieza.ipynb
    ├── 02_eda.ipynb
    ├── 03_feature_engineering.ipynb
    ├── 04_entrenamiento_modelos.ipynb
    ├── 05_evaluacion_seleccion.ipynb
    └── 11_analisis_residuos.ipynb
```

## Endpoints

Documentacion interactiva (Swagger UI) en http://localhost:8000/docs cuando
el backend esta corriendo.

| Metodo | Ruta | Para que |
|---|---|---|
| `GET` | `/api/health` | Liveness + estado del modelo |
| `GET` | `/api/model/info` | Version, metricas, `days_since_training` |
| `POST` | `/api/auth/login` | Login JWT |
| `POST` | `/api/fairvalue/predict` | Prediccion + veredicto + rango + counterfactuals |
| `GET` | `/api/entorno?lat&lng` | Contexto del barrio |

## Tests

```bash
make test
```

63 tests pytest: health, predict end-to-end, counterfactuals, quantile,
schemas, geo, fail-fast del modelo.

## Licencia

MIT — ver [LICENSE](LICENSE).

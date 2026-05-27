# ubIcA

Webapp que estima el precio de alquiler de un departamento en Lima Metropolitana
y devuelve un veredicto (Ganga / Justo / Inflado) con rango de incertidumbre y
contexto del barrio. Proyecto del curso DS3022 — Desarrollo de Productos de
Datos, UTEC.

## Cómo correr

Requisitos: Python 3.11 y un navegador moderno. Probado en macOS 14 y Ubuntu 22.04.

```bash
# Setup (una sola vez)
make setup

# Levantar — abre dos terminales
make backend     # FastAPI en http://localhost:8000
make frontend    # Estatico en http://localhost:5500
```

Demo: http://localhost:5500 · usuario `ana@justa.pe` / `demo1234`.

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

En total, 95 features alimentan el modelo. Cero APIs pagas.

## Metricas

| Metrica | Valor | Conjunto |
|---|---|---|
| MAPE | 15.74 % | Test (n=503) |
| R² | 0.861 | Test |
| MAE | $158 | Test |
| RMSE | $284 | Test |
| Coverage P25-P75 | 42.74 % | Test (target teorico 50 %) |

## Estructura

```
.
├── README.md                · este archivo
├── DIAGRAMAS.md             · 6 diagramas Mermaid de la arquitectura
├── Makefile                 · make backend / make frontend
├── app/
│   ├── index.html           · entry del frontend
│   ├── app.jsx              · router
│   ├── screens.jsx          · pantallas (Login, Wizard, Result, Entorno, FAQ)
│   ├── components.jsx       · UI compartida
│   ├── api.js               · cliente fetch + JWT
│   └── backend/
│       ├── main.py          · entry FastAPI + lifespan (valida modelo)
│       ├── model_service.py · aislamiento del .joblib
│       ├── ml.py            · build_features + counterfactuals + interval
│       ├── ml_v2.py         · 95 features del modelo v2
│       ├── geo_index.py     · KD-tree esfera + IDW haversine
│       ├── osm_lookup.py    · POIs por categoria
│       ├── distrito_features.py · NSE manzana + denuncias distrito
│       ├── routers/         · auth, dashboard, fairvalue, entorno, health
│       ├── models/v2/       · .joblib del modelo XGBoost + quantile
│       ├── data/external/   · POIs, denuncias, comisarias
│       └── tests/           · 63 pytest tests
├── docs/
│   ├── defensa/             · canvas, pitch, demo guiada, slides, Q&A
│   └── notebooks/           · 11_analisis_residuos.ipynb (error analysis)
└── gates/                   · evidencia de 6 gates pre-ejecucion
```

## Endpoints

Documentacion interactiva (Swagger UI) disponible en
http://localhost:8000/docs cuando el backend esta corriendo.

| Metodo | Ruta | Para que |
|---|---|---|
| `GET` | `/api/health` | Liveness + estado del modelo |
| `GET` | `/api/model/info` | Version, metricas, `days_since_training` |
| `POST` | `/api/auth/login` | Login JWT |
| `POST` | `/api/fairvalue/predict` | Prediccion + veredicto + rango + counterfactuals |
| `GET` | `/api/entorno?lat&lng` | Contexto del barrio |

## Limitaciones conocidas

1. **Sesgo geografico**: 874 listings en Miraflores vs 12 en SMP. Mitigado con
   sample weighting `1/sqrt(count_distrito)` y target encoding bayesiano (k=30),
   pero el banner "cobertura baja" sigue siendo necesario para zonas escasas.
2. **Leakage heredado**: `count_1km_*` calculado en el CSV crudo incluye el
   propio listing en su conteo. Central v2 y quantile lo heredan coherentemente.
3. **Sin reentrenamiento automatico**. Manual trimestral. `/api/model/info`
   expone `days_since_training` para monitoreo.

## Reproducir el modelo quantile

```bash
python pipeline/scripts/train_quantile_v2.py
```

Semillas fijas (`random_state=42`), split estratificado por
`categoria_distrito × estrato_nse`. Genera `xgb_q25/q50/q75_v2.joblib` y
`quantile_coverage.json` en `app/backend/models/v2/`.

## Tests

```bash
make test
```

63 tests pytest: health, predict end-to-end, counterfactuals, quantile,
schemas, geo, fail-fast del modelo.

## Defensa oral

Material completo en [docs/defensa/](docs/defensa/): Data Product Canvas,
elevator pitch de 90 s, guion de demo, slides con narracion y banco de Q&A.

## Licencia

MIT — ver [LICENSE](LICENSE). Las fuentes de datos son publicas y se citan
en la seccion Datos.

# Wasi

Webapp que estima el precio de alquiler de un departamento en Lima Metropolitana
y devuelve un veredicto (Ganga / Justo / Inflado) con rango de incertidumbre y
contexto del barrio. Proyecto del curso DS3022 — Desarrollo de Productos de
Datos, UTEC.

## Cómo correr

Requisitos: Python 3.9-3.12 (3.10 recomendado), Git y un navegador moderno.
Probado en macOS 14 y Ubuntu 22.04.

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

El primer arranque tarda ~15 s: valida el modelo, calienta el indice
geografico (cKDTree con 11 K POIs) y siembra el catalogo de Explorar
(~3.3k avisos reales de alquiler). Los arranques siguientes son rapidos.

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
| MAPE | 16.4 % | GroupKFold espacial (n=503) |
| R² | 0.847 | Test |
| MAE | $159 | Test |
| RMSE | $298 | Test |
| Coverage P25-P75 | 41.75 % | Test (target teorico 50 %) |

## Cómo funciona

### 1 · Pipeline del modelo (de los datos al precio)

```
notebooks/01_limpieza        → outliers (precio/m² fuera de rango), NaNs, dedup
notebooks/02_eda             → distribuciones, sesgo geográfico del stock
notebooks/03_features        → 101 features: físicas + geo (KD-tree POIs 1km)
                               + NSE por manzana + denuncias + target encoding distrito
notebooks/04_entrenamiento   → XGBoost con GroupKFold ESPACIAL
notebooks/05_evaluacion      → selección final → models/v2/*.joblib + manifest
```

La clave del entrenamiento es la **validación espacial**: los folds se agrupan
por celda geográfica, así un departamento nunca se evalúa con vecinos de su
propio edificio en train. El split aleatorio daba un MAPE más bonito (15.7 %)
pero inflado por leakage; el 16.4 % reportado es el honesto.

En serving, `ml_v2.py · build_features_v2()` replica exactamente la
construcción de features del notebook 03: misma fórmula, mismos artefactos
(target encoder, caps de outliers serializados junto al modelo). El backend
nunca toca el `.joblib` directo: `model_service.py` lo aísla y al arrancar
ejecuta tres validaciones fail-fast — hash SHA-256 de artefactos vs
`manifest.json`, número de features esperado, y **golden predictions** (casos
congelados con tolerancia 0.1 %). Si el modelo cambió, el servidor no levanta.

```
POST /api/fairvalue/predict
  ├─ geo_index.py      → distrito, POIs por categoría (cKDTree + haversine)
  ├─ ml_v2.py          → vector de 101 features (idéntico al notebook)
  ├─ model_service.py  → XGBoost central + 3 modelos quantile (P25/P50/P75)
  └─ respuesta         → fair_value + veredicto + rango + counterfactuals
```

El **veredicto** compara precio anunciado vs fair value: dentro de ±8 % es
Justo; por debajo, Ganga; por encima, Inflado. Los **counterfactuals** del
simulador no son heurística: cada slider re-ejecuta el modelo congelado con
una feature perturbada (`/fairvalue/simulate`).

### 2 · Explicabilidad (SHAP)

Usamos **TreeSHAP exacto**, nativo de XGBoost (`pred_contribs=True`): para
cada predicción individual devuelve cuánto aporta cada feature, con garantía
de aditividad — `precio_base + Σ contribuciones = predicción`. No es una
aproximación por sampling.

`model_service.py · shap_contributions()` agrega las 101 contribuciones en
grupos legibles (Ubicación, Tamaño y distribución, Servicios cercanos,
Amenities, Antigüedad, Seguridad) y las convierte a efecto porcentual sobre
el precio (el modelo predice en log, así que los efectos son multiplicativos).
Eso es lo que dibuja el waterfall de la UI: barras reales del modelo, no copy.

### 3 · Narrativa LLM

Capa opcional **encima** del SHAP, nunca debajo: el LLM no calcula nada.

- Proveedor: **Groq API**, modelo `llama-3.3-70b-versatile`.
- Input: los grupos SHAP ya computados + veredicto + POIs nombrados del entorno.
- Output: resumen en español (2-3 oraciones) o análisis extendido.
- El **signo de cada efecto se resuelve en Python** antes de armar el prompt:
  el LLM redacta sobre números ya calculados, no infiere direcciones (cero
  alucinación numérica).
- Degradación suave: sin `GROQ_API_KEY` el endpoint devuelve 503 y la app
  funciona igual — los números y el SHAP no dependen del LLM.

Ver `routers/fairvalue.py · _groq_chat()` y los helpers de narrativa.

## Estructura

```
.
├── README.md
├── Makefile                · make backend / make frontend / make test
├── .env.example            · template de variables de entorno
├── app/                    · webapp end-to-end
│   ├── index.html          · entry del frontend (carga los módulos en orden)
│   ├── styles.css          · hoja de estilos (tokens OKLCH + componentes)
│   ├── app.jsx             · router por rol
│   ├── screens-*.jsx       · pantallas por dominio (core, public, fairvalue,
│   │                         profile, listings, seller, home)
│   ├── components.jsx      · UI compartida
│   ├── api.js              · cliente fetch + JWT
│   ├── stats.js            · números oficiales del modelo (fuente única)
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
│       └── tests/          · 126 pytest tests
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

126 tests pytest: health, predict end-to-end, counterfactuals, quantile,
schemas, geo, fail-fast del modelo.

## Licencia

MIT — ver [LICENSE](LICENSE).

# PLAN — Modelo de precio de VENTA (Wasi v2)

> Objetivo: replicar el pipeline de alquiler para estimar **precio de venta** de
> departamentos en Lima, con un dataset propio scrapeado de InfoCasas.
> **Aislado**: vive en `ventas_model/`, NO toca el modelo de alquiler congelado
> (`app/backend/models/v2/`) ni el pipeline de alquiler. Cero riesgo para la defensa.

## Contexto verificado (2026-06-06)
- InfoCasas Perú expone **21,941 deptos en venta en Lima** (1,045 páginas × 21), sin anti-bot.
- Cada aviso (`__NEXT_DATA__ → props.pageProps.fetchResult.searchFast.data[]`) trae:
  - `price_amount_usd` (centavos USD → /100), `m2`, `address`
  - `locations.location_point` = `POINT (lng lat)` (WKT) → coordenadas
  - `technicalSheet[]`: `bedrooms`, `bathrooms`, `garage`, `constructionYear`, `construction_state_name`
  - `property_type.name`, `operation_type.name`
- Paginación: `/venta/departamentos/lima/pagina{N}`.

## Fases (ejecutar en orden, al pie de la letra)

### FASE 1 — Scraper InfoCasas → `data/raw_infocasas.csv`
- `scrape_infocasas.py`: itera páginas 1..N (objetivo ~150 páginas ≈ 3,000 avisos).
- Rate-limiting cortés (~0.6 s entre requests, UA de navegador). Reintento simple en fallo.
- Por aviso extrae: `id, title, price_usd, m2, lat, lng, address, distrito, dormitorios, banos, cocheras, antiguedad_anios, construction_state, property_type, url`.
- Parseo: precio = `price_amount_usd/100`; coords del WKT `POINT (lng lat)`; distrito por match contra la lista de distritos de Lima en el address.
- Dedup por `id`. Guarda CSV.
- **Criterio de éxito**: ≥ 2,000 filas con precio, área y coordenadas válidas.

### FASE 2 — Limpieza → `data/clean_ventas.csv`
- `clean_ventas.py`: filtra outliers (precio 20k–2M USD, área 20–600 m², dorms 0–6, baños 1–6).
- Descarta coords fuera del bbox de Lima (lng −77.3..−76.7, lat −12.5..−11.6).
- Descarta `property_type != Departamento` (foco homogéneo, como hizo alquiler).
- Dedup por (lat, lng, área, precio). Reporta cuántas filas sobreviven.

### FASE 3 — Features → `data/ventas_features.csv`
- `build_features_venta.py`: por cada coord, llamar `geo_lookup(lat,lng)` del backend
  (reusa POIs/NSE/seguridad/dist_mar/dist_centro ya calculados — mismas fuentes que alquiler).
- Features finales = geoespaciales (de geo_lookup) + del inmueble (m2, dormitorios, banos, cocheras, antiguedad).
- Target = `price_usd`. Añade `h3_index_8` por coord para el split espacial.
- Las coords fuera de cobertura de geo_lookup se descartan (registra cuántas).

### FASE 4 — Modelo → `models/xgb_venta.joblib` + `RESULTADOS.md`
- `train_venta.py`: XGBoost (log-target, como alquiler).
- **Validación HONESTA desde el día 1** (lección del leakage de alquiler):
  - Split principal aleatorio 70/15/15 para los artefactos.
  - **GroupKFold 5-fold por coordenada (h3)** para el MAPE reportado (sin leakage espacial).
- Métricas: MAPE espacial, R², MAE USD. Cuantiles P25/P75 si el tamaño lo permite.
- `RESULTADOS.md`: tabla de métricas, comparación honesta vs alquiler, # de features, # filas.

### FASE 5 — Cierre
- `RESULTADOS.md` con veredicto honesto: ¿el modelo de venta es usable o necesita más datos?
- Registrar en `session.log` (DATA/ARCH). NO integrar a la UI antes de la defensa.

## Reglas
- Aislado en `ventas_model/`. NO tocar `app/backend/models/v2/`, `pipeline/`, ni el modelo de alquiler.
- Honestidad: reportar el MAPE espacial (no el aleatorio inflado). Si sale débil, decirlo.
- Español neutro en comentarios, sin emojis.
- Scraping cortés (rate-limit), re-verificar que InfoCasas no haya puesto anti-bot.

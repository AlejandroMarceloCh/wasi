# T069 — Calidad `clean_ventas.py`

**TARGET:** `ventas_model/clean_ventas.py`  
**LENTE:** calidad (dedup, outliers, escala precio, coordenadas)  
**Fecha:** 2026-07-06

---

## Resumen

Filtros de cordura precio/m² y bbox son sólidos para InfoCasas. Hallazgo crítico: **toda la fuente Babilonia (415 filas) se elimina** por el filtro de `cocheras` con NaN. Dedup por coordenada exacta deja clones espaciales y cross-listing sin resolver.

---

## Hallazgos

### [ALTO] · Babilonia eliminada al 100% por `cocheras` NaN · `ventas_model/clean_ventas.py:36` — `df["cocheras"].between(0, 6)`; en `raw_babilonia.csv` las 415 filas tienen `cocheras` nulo (`scrape_babilonia.py:180`). · El concat de líneas 16-18 es inútil hoy: 0 filas Babilonia en `clean_ventas.csv` (6272 filas = solo InfoCasas). · `df["cocheras"] = df["cocheras"].fillna(0)` antes del filtro (misma semántica que alquiler en notebooks).

### [ALTO] · Dedup insuficiente: 3 229 filas comparten lat/lng · Verificación sobre `clean_ventas.csv`: mismo `lat`+`lng` con precios distintos en 3 229 filas; solo 378 grupos con coord redondeada + `m2` duplicados no colapsados. · `drop_duplicates(subset=["lat","lng","m2","price_usd"])` (`línea 40`) no fusiona re-publicaciones ni unidades del mismo edificio con precio distinto. · Dedup secundario por `round(lat,4)`, `round(lng,4)`, `m2` quedándose con mediana de precio; o ventana Haversine <50 m.

### [MEDIO] · `banos` NaN en Babilonia también filtra filas · `ventas_model/clean_ventas.py:35` — 3 avisos con `banos` nulo en raw; sobreviven hasta ese filtro (403 de 415). · Pérdida menor pero muestra que el schema Babilonia no está alineado. · `fillna(1)` o imputar desde dormitorios antes de `.between()`.

### [MEDIO] · Bbox lng distinto a `geo_index` y scrapers · `clean_ventas.py:38` — lng `−77.3..−76.7`; `geo_index.py:25-26` usa `−77.2..−76.7`; Babilonia scrapea `−77.25..−76.60` (`scrape_babilonia.py:55`). · Avisos en Callao oeste pueden pasar limpieza y fallar en `build_features_venta` / inferencia. · Centralizar `in_bbox()` de `geo_index` en limpieza.

### [MEDIO] · `property_type` vacío permitido · `ventas_model/clean_ventas.py:29` — `isin(["Departamento", ""])`. · Filas sin tipo pasan aunque el objetivo sea solo departamentos. · Restringir a `"Departamento"` cuando la columna exista; log de cuántos vacíos.

### [BAJO] · Sin dedup cross-fuente por URL/ID · Solo dedup físico por coord+área+precio (`línea 40`); IDs InfoCasas vs slug Babilonia no se cruzan (0 overlap de IDs verificado). · Mismo inmueble en dos portales sobrevive como dos filas si coord o precio difieren levemente. · Dedup espacial fuzzy + similitud de precio/m².

### [BAJO] · `antiguedad_anios` sin filtro ni imputación · No aparece en filtros; InfoCasas puede traer `0` si falta año de construcción (`scrape_infocasas.py:113-114`). · Feature de entrenamiento con ruido; coherente con `venta_service` que defaultea 0. · Cap razonable (0–80) o flag `antiguedad_informada`.

### [INFO] · Filtros de escala precio coherentes con scraper InfoCasas · `ventas_model/clean_ventas.py:31-33` — USD 20k–2M, m² 20–600, precio/m² 400–6000. · Alineado con `precio_usd()` (`scrape_infocasas.py:105-106`). · OK.

### [INFO] · Recalculo de `precio_m2` para Babilonia · `ventas_model/clean_ventas.py:21-25`. · Necesario porque Babilonia no exporta la columna. · OK.

---

## Veredicto

**Calidad aceptable para InfoCasas solo**, pero el merge multi-fuente está **roto** por NaN en `cocheras`. Arreglar imputación desbloquea ~400 avisos adicionales y justifica el scraper Babilonia. Dedup y bbox unificado son el siguiente ROI.

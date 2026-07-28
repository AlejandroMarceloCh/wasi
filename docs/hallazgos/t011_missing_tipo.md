# T011 — Clasificación de nulos MNAR/MAR/MCAR (missing-data)

**TARGET:** notebooks/01, 02  
**LENTE:** missing-data  
**Fecha:** 2026-07-06

---

## Resumen

Los nulos principales están **documentados** en nb01 con clasificación implícita. Evidencia en código y outputs, no solo README.

---

## Hallazgos

### [ALTO] · `tiene_*` en Properati → **MNAR estructural** · `notebooks/01_limpieza.ipynb` celda 8 (markdown): “Nulos estructurales: columnas `tiene_*` de Properati (~32.4%) → el portal no expone esa información, NaN ≠ 0”. Celda 11 output: nulos concentrados en fuente Properati (1086 listings). · Ausencia no es “no tiene amenity”, es “portal no reporta”. · Flag `es_properati` **prometida** en celda 20 pero **no implementada** en código (solo comentario celda 21).

### [MEDIO] · `dormitorios`, `banos`, `cocheras`, `antiguedad` → **MAR** · Celda 8: “Nulos de contenido — dato no informado por el anunciante”. Imputación por mediana agrupada celdas 16–18. · MCAR no asumible: missing correlacionado con tipo/área/distrito. · Imputación post-split (ver T003).

### [MEDIO] · `dist_nearest_m_*` cuando `count_1km_* = 0` → **MNAR por diseño geográfico** · Celda 22: nulo = no hay POI en 1 km (no error de scraping). · Distinto de MCAR. · Centinela P95 post-split (T004).

### [INFO] · `cocheras` NaN → **MAR** tratado como “no informado” · Celda 18: `cocheras_informadas` flag + fillna(0). · Semántica explícita. · OK con flag; documentar en schema.

### [INFO] · EDA nb02 confirma skew y nulos por fuente · `notebooks/02_eda.ipynb` — boxplots/outliers precio; conteos por `fuente`; no reclasifica MNAR/MAR pero apoya nb01. · Consistencia narrativa. · Ninguna acción.

---

## Veredicto

Clasificación **MNAR** (amenities Properati, distancias sin POI) y **MAR** (estructurales del inmueble) **soportada por evidencia**. Falta implementar `es_properati` prometida.

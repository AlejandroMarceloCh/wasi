# T018 — Calidad `clean_ventas.py` (calidad-datos)

**TARGET:** `ventas_model/clean_ventas.py`  
**LENTE:** calidad-datos  
**Fecha:** 2026-07-06

---

## Resumen

Limpieza de venta es **razonable y documentada**: filtros de precio/m², bbox Lima, dedup por coord+área+precio. Algunos bordes (tipos vacíos, antigüedad sin filtrar) merecen atención menor.

---

## Hallazgos

### [INFO] · Filtros de cordura precio/m² · `ventas_model/clean_ventas.py:31-33` — venta USD 20k–2M, m² 20–600, precio/m² 400–6000 (filtra alquiler colado). · Estrategia sólida vs outliers de scraping. · OK.

### [INFO] · Dedup por inmueble físico · Línea 40: `drop_duplicates(subset=["lat", "lng", "m2", "price_usd"])`. · Evita duplicados exactos; no dedup por URL. · Considerar dedup por coord redondeada si persisten clones con precio distinto.

### [MEDIO] · `property_type` vacío permitido · Línea 29: `isin(["Departamento", ""])`. · Filas sin tipo pasan el filtro. · Restringir a solo Departamento si objetivo es homogeneidad.

### [BAJO] · Bbox lng ligeramente distinto a alquiler · Venta: lat −12.5..−11.6, lng −77.3..−76.7 (`38`). Alquiler geo_index: `LAT_MIN/MAX`, `LNG_MIN/MAX` en `geo_index.py:25-26`. · Avisos en borde oeste pueden limpiarse en venta pero fallar en geo_lookup. · Unificar bbox con `geo_index.in_bbox()`.

### [INFO] · Merge Babilonia opcional · Líneas 16-18: concat si existe `raw_babilonia.csv`. · Extensibilidad OK. · Validar schema al añadir fuentes.

### [INFO] · Output sobrevive ~80% tras filtros · Log típico en docstring; `clean_ventas.csv` usado downstream 6271 filas. · Volumen suficiente para ML. · Ninguna acción.

---

## Veredicto

**Calidad aceptable** para v0. Ajustes menores en tipo vacío y bbox.

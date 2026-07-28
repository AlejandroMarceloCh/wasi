# T068 — Robustez `scrape_babilonia.py`

**TARGET:** `ventas_model/scrape_babilonia.py`  
**LENTE:** robustez (rate-limit, errores, cambios de estructura)  
**Fecha:** 2026-07-06

---

## Resumen

Estrategia de cobertura por combinatoria precio×dormitorios es ingeniosa dado el límite de 20 ítems server-side. Resume automático por ID es correcto. Dependencia total de **JSON-LD estático**, tipo de cambio fijo y rangos de precio truncados limitan robustez y cobertura a largo plazo.

---

## Hallazgos

### [ALTO] · Dependencia exclusiva de JSON-LD `ItemList` en HTML · `ventas_model/scrape_babilonia.py:57-60,87-94` — regex sobre `<script type="application/ld+json">`; si Babilonia migra a CSR (solo datos vía API cliente) el scraper devuelve `[]` sin error. · Pérdida silenciosa de toda la fuente (~415 avisos actuales) con corrida "exitosa". · Monitor de tasa de ítems vacíos por combo; fallback Playwright/API si >X% combos en cero.

### [MEDIO] · Tipo de cambio PEN/USD hardcodeado · `ventas_model/scrape_babilonia.py:62,108-128` — `PEN_PER_USD = 3.75` fijo. · Con TC real ~3.7–3.8+ el precio USD puede desviarse 1–3%; avisos en soles cerca del umbral precio/m² pueden filtrarse o pasar mal. · Leer TC de `priceSpecification` cuando exista ambas monedas; o fetch diario a SUNAT/BCRP con cache.

### [MEDIO] · Rangos de precio truncan ventas > USD 2M · `ventas_model/scrape_babilonia.py:36-50` — máximo `(1_000_000, 2_000_000)`; no hay bucket superior. · Departamentos premium en San Isidro/Surco quedan fuera de la malla de filtros. · Añadir rangos `2M–3M`, `3M–5M`; validar con conteo de "20 resultados" por combo (saturación).

### [MEDIO] · ID derivado del slug URL · `ventas_model/scrape_babilonia.py:167-168` — `url.rstrip("/").rsplit("-", 1)[-1]`. · Cambio de patrón URL o colisión de sufijos numéricos → dedup incorrecto o IDs duplicados. · Preferir `@id` o identificador del JSON-LD si existe; validar unicidad al cargar.

### [MEDIO] · Inconsistencia de umbral precio/m² vs pipeline downstream · `ventas_model/scrape_babilonia.py:171-172` — acepta hasta 8000 USD/m²; `clean_ventas.py:33` corta a 6000. · Avisos que pasan el scraper se pierden en limpieza sin log explícito en Babilonia. · Unificar constantes compartidas (`ventas_model/constants.py`).

### [BAJO] · Límite estructural de 20 ítems por URL · Docstring líneas 3-10; `fetch_items` no pagina. · Cobertura incompleta en combos saturados (muchas zonas/precios). · Detectar combos con exactamente 20 resultados y subdividir rango o dormitorios.

### [BAJO] · `cocheras` y `antiguedad_anios` siempre `None` · `ventas_model/scrape_babilonia.py:180-181`. · No rompe el scraper, pero alimenta un pipeline que asume enteros (ver T069). · Imputar `0` en origen o documentar campos opcionales.

### [INFO] · Resume por ID al arrancar · `ventas_model/scrape_babilonia.py:201-211,214-215` — carga CSV existente siempre (sin flag `START_PAGE`). · Mejor ergonomía que InfoCasas. · OK.

### [INFO] · Circuit breaker y checkpoint · `ventas_model/scrape_babilonia.py:225,236-238,258-260` — 5 fallos seguidos; guarda cada 10 combos. · Protección razonable ante red inestable. · OK.

### [INFO] · Bbox Lima en parseo · `ventas_model/scrape_babilonia.py:55,152-154`. · Descarta coords fuera de Lima antes de persistir. · OK; alinear lng con `geo_index` (`-77.2` vs `-77.25` aquí).

---

## Veredicto

**Scraper cortés y con resume**, pero **monocultivo JSON-LD** y **gaps de cobertura** (precio alto, 20 ítems/combo) lo hacen el eslabón más frágil del pipeline de venta. El TC fijo y los IDs por slug son deuda técnica media.

# T067 — Robustez `scrape_infocasas.py`

**TARGET:** `ventas_model/scrape_infocasas.py`  
**LENTE:** robustez (rate-limit, errores, cambios de estructura)  
**Fecha:** 2026-07-06

---

## Resumen

Scraper funcional y con buenas defensas de precio (heurística `precio_usd`) y checkpoint cada 25 páginas. Vulnerable a **pérdida de datos en re-ejecución**, a **corte prematuro** ante cambios de HTML/JSON, y a rate-limit sin backoff adaptativo ni manejo de códigos HTTP.

---

## Hallazgos

### [ALTO] · Re-ejecución desde página 1 descarta CSV previo · `ventas_model/scrape_infocasas.py:161` — `seen, rows = _cargar_existentes() if START_PAGE > 1 else (set(), [])`; al final `guardar(rows)` sobrescribe `raw_infocasas.csv` con solo lo scrapeado en la corrida. · Un operador que relanza sin `START_PAGE>1` pierde ~7k filas ya guardadas (evidencia: `data/raw_infocasas.csv` tiene 7066 filas de una corrida previa). · Cargar existentes por defecto o escribir a archivo temporal hasta confirmar éxito.

### [ALTO] · Página sin `__NEXT_DATA__` corta el scrape sin reintentos · `ventas_model/scrape_infocasas.py:44-45,175-177` — `fetch_page` devuelve `None` si no hay match del regex; el loop hace `break` inmediato ("sin data, fin") sin incrementar contador de fallos ni reintentar. · Un cambio de plantilla Next.js, bloqueo parcial o HTML corrupto termina la corrida en la primera página afectada aunque las siguientes respondan bien. · Tratar `None` como fallo transitorio (N reintentos con backoff) antes de abortar; distinguir "fin de paginación" (data vacía con JSON válido) de "parse fallido".

### [MEDIO] · Ruta JSON embebida acoplada a una versión del sitio · `ventas_model/scrape_infocasas.py:46-47` — acceso fijo a `data["props"]["pageProps"]["fetchResult"]["searchFast"]`. · Si InfoCasas renombra la clave o mueve el payload a otro nodo, cada página lanza `KeyError`/`JSONDecodeError` hasta 5 fallos y corta. · Validar esquema con mensaje explícito; fallback a otra ruta conocida; alerta si el ratio de parseo < umbral.

### [MEDIO] · Sin manejo explícito de HTTP 429/403 · `ventas_model/scrape_infocasas.py:42` — `urllib.request.urlopen` sin inspeccionar status; solo `Exception` genérica en el loop (`167-174`). · Anti-bot o rate-limit del servidor se mezcla con timeout/red; la pausa fija `PAUSA*3` puede ser insuficiente para 429. · Capturar `HTTPError`, leer `Retry-After`, backoff exponencial con jitter; rotar UA solo si ToS lo permiten.

### [MEDIO] · Rate-limit fijo sin adaptación · `ventas_model/scrape_infocasas.py:22,193` — `PAUSA=0.5` s entre requests (~120 req/min teórico en ráfaga). · Riesgo de bloqueo IP si el sitio endurece límites; no hay desaceleración progresiva tras errores leves. · Pausa base configurable por env; aumentar pausa tras N páginas o tras respuestas lentas.

### [BAJO] · Campos de ficha técnica hardcodeados · `ventas_model/scrape_infocasas.py:112-130` — `technicalSheet` mapea `bedrooms`, `bathrooms`, `garage`, `constructionYear`, `construction_state_name`. · Renombre de campos en API → ceros silenciosos en features downstream. · Log de campos faltantes por lote; test de humo contra HTML golden.

### [BAJO] · Resolución de distrito por primer match en lista · `ventas_model/scrape_infocasas.py:68-70` — `"Surco"` aparece antes que `"Santiago de Surco"` en `DISTRITOS`; direcciones ambiguas pueden etiquetarse mal. · Sesgo en `distrito_enc` del modelo de venta. · Ordenar distritos de más específico a más genérico; normalizar alias post-scrape.

### [INFO] · Checkpoint y circuit breaker de 5 fallos · `ventas_model/scrape_infocasas.py:24,170-172,188-189` — guarda cada 25 páginas; corta tras 5 errores seguidos. · Mitiga pérdida total ante anti-bot agresivo. · OK; combinar con resume por defecto (ver hallazgo ALTO).

### [INFO] · Heurística de precio robusta a escala inconsistente · `ventas_model/scrape_infocasas.py:87-107` — prueba unidades y centavos; filtra alquiler colado por rango precio/m². · Reduce outliers de scraping en origen. · OK; mantener alineado con umbrales de `clean_ventas.py`.

---

## Veredicto

**Operativo para el scrape verificado (2026-06-06)**, pero **frágil ante re-runs y cambios de front**. Priorizar resume seguro y reintentos antes de confiar en corridas programadas.

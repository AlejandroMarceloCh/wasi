# T065 — `fetch_display_pois.py` (robustez)

**TARGET:** `app/backend/scripts/fetch_display_pois.py`  
**LENTE:** robustez  
**Fecha:** 2026-07-06

---

## Resumen

Reintentos básicos ante fallos de red/HTTP, pero sin recuperación parcial ni validación del payload. Un fallo en una categoría tumba todo el batch.

---

## Hallazgos

### [MEDIO] · Fallo en una categoría aborta las restantes · `fetch_display_pois.py:52, 56-63` — `RuntimeError` tras 3 intentos; el `for` no captura. · Categorías ya bajadas quedan en disco con timestamp distinto; re-run inconsistente. · Continuar con siguiente categoría + resumen de fallos; exit code 1 al final.

### [MEDIO] · Sin escritura atómica · `fetch_display_pois.py:61` — `write_text` directo sobre `{cat}.json`. · Crash a mitad de escritura deja JSON corrupto (display_pois tolera vacío, T052, pero operador no sabe). · Escribir a `.tmp` y `rename`.

### [BAJO] · HTTP 429/503 tratados igual que otros errores · `fetch_display_pois.py:46-51` — solo espera 20 s fijos; sin backoff exponencial ni `Retry-After`. · Overpass saturado puede agotar 3 intentos en cadena. · Backoff 20/60/180 s; respetar header si viene.

### [BAJO] · No valida esquema OSM antes de guardar · `fetch_display_pois.py:58-61` — asume `elements` en respuesta 200. · Respuesta HTML de error disfrazada o JSON vacío se persiste. · Comprobar `"elements" in data` y tipo list.

### [INFO] · Separación display vs modelo · `fetch_display_pois.py:4-7` — salida en `data/external/display/`. · No rompe train/serve del modelo. · OK.

### [INFO] · User-Agent identificable · `fetch_display_pois.py:35` — buena práctica Overpass. · OK.

---

## Veredicto

**Robustez mínima aceptable para uso manual.** Para automatización recurrente faltan atomicidad, degradación parcial y manejo fino de rate-limit.

# T039 — Seed masivo: correctitud y flag

**TARGET:** `app/backend/seed_listings_bulk.py` (+ gate en `main.py`)  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

Seed masivo genera ~3.3k listings plausibles desde CSV con `fair_value_ref` por mediana distrito/m² y filtro bbox Lima. Respeta umbral de 500 y flags de entorno; no deduplica por URL del dataset.

---

## Hallazgos

### [MEDIO] · Sin deduplicación por `url` del dataset · `seed_listings_bulk.py:43-46,67-93` — itera todas las filas sin unique key. · Si el conteo baja de 500 (borrado manual) y se re-ejecuta, duplica avisos del mismo inmueble. · Guardar hash/url en columna o skip por `(lat, lng, precio)`; o subir umbral y documentar no re-seed.

### [MEDIO] · Acoplado a `WASI_ENABLE_DEMO_SEED` vía `main.py` · `main.py:35` — bulk solo si demo habilitado Y `WASI_SKIP_BULK_SEED` ausente. · En prod sin demo no hay catálogo masivo (correcto); en staging se mezclan dos concerns (demo users + catálogo). · Flag `WASI_ENABLE_BULK_SEED` independiente.

### [INFO] · Umbral idempotente 500 listings · `seed_listings_bulk.py:23,30-33` — skip si `total >= 500`. · Evita re-insert en cada restart con catálogo poblado. · OK.

### [INFO] · `WASI_SKIP_BULK_SEED` respetado · `main.py:35` + `conftest.py:23` — tests lo setean en `1`. · Suite no inserta 3k filas. · OK.

### [INFO] · `fair_value_ref` plausible (mediana USD/m² × área) · `seed_listings_bulk.py:55-71` — por distrito con fallback global. · Veredictos Ganga/Justo/Inflado con dispersión realista, no valor fijo. · OK.

### [INFO] · Filtro geográfico Lima · `seed_listings_bulk.py:52-53` — lat/lng dentro de bbox. · Coherente con cobertura del modelo. · OK.

### [INFO] · Requiere usuario catálogo previo · `seed_listings_bulk.py:35-39` — `catalogo@wasi.pe` de `seed.py`. · Orden de ejecución documentado. · OK.

### [BAJO] · No setea `operacion` ni `es_estudio` · `seed_listings_bulk.py:74-93` — default BD/ORM `alquiler`; `es_estudio=False` implícito. · Correcto para dataset de alquiler; estudios del CSV con 0 dorm quedan como no-estudio. · Inferir `es_estudio` si `dormitorios==0` (ver T042).

### [BAJO] · `add_all` + commit único de miles de filas · `seed_listings_bulk.py:96-97` — pico de memoria en arranque. · Aceptable en dev; en Render considerar batch de 500. · Insert por chunks.

### [INFO] · Contacto ficticio uniforme · `seed_listings_bulk.py:89-91` — mismo teléfono/email catálogo. · PII de demo, no real; catálogo público oculta contacto. · OK.

---

## Veredicto

Seed masivo cumple su objetivo (densidad Explorar) con flags y umbral. Priorizar dedup y flag de bulk separado del demo.

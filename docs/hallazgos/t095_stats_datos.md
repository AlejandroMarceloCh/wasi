# T095 — aliases_lima.js + stats.js: consistencia de datos

**TARGET:** `app/aliases_lima.js`, `app/stats.js`, consumo en pantallas  
**LENTE:** datos / copy  
**Fecha:** 2026-07-06

---

## Resumen

`WASI_STATS` alimenta hero, splash, perfil y FAQs con cifras de entrenamiento. `LIMA_ALIASES` mejora búsquedas Photon/Nominatim. Hay desfaces importantes entre lo que promete el copy y lo que devuelve el backend en vivo.

---

## Hallazgos

### [ALTO] · `DISTRITOS: '40'` no cuadra con el catálogo geo real · `stats.js:7` vs `data/distritos_zona.json` (29 distritos verificados en repo). · Hero y tabla de evidencia dicen “40 distritos”; el mapa del home y `/distritos-zona` operan con ~29. · Unificar: `DISTRITOS = String(distritos.length)` en runtime o corregir el literal y el copy de “Lima Metropolitana”.

### [ALTO] · `ALQ_AVISOS: '3,348'` ≠ avisos en catálogo live · `stats.js:6` — cifra del CSV de entrenamiento (`inmuebles_alquiler_clean`, n≈3348). · Catálogo activo en QA Sprint 3 reportó **3 396** alquileres sembrados; el usuario puede contar avisos en Explorar y desconfiar del hero. · Separar labels: “3 348 avisos de entrenamiento” vs “X avisos publicados hoy” (fetch `/listings?operacion=alquiler&limit=0`).

### [MEDIO] · Tres fuentes de conteo de avisos en la misma sesión · `stats.js` (3348), pie del mapa home (`distritos.reduce((s,d)=>s+d.n,0)` en `screens-home.jsx:400`), total paginado Explorar (`X-Total-Count`). · Cada superficie puede mostrar un número distinto sin explicar que uno es modelo, otro agregado geo y otro marketplace. · Una línea de glosario o un solo endpoint “stats públicas”.

### [MEDIO] · `VENTA_MAPE` / `VENTA_AVISOS` casi no se exponen · `stats.js:9-10` — venta tiene MAPE 15.8% y 6 271 avisos de training, pero publicar/estimar venta no los cita (solo alquiler en `screens-seller.jsx:930`, splash, perfil). · Quien publica venta ve métricas de alquiler en el pie del formulario. · Mostrar bloque condicional por `operacion` con `VENTA_*`.

### [MEDIO] · Aliases de distrito orientados a Photon, no al dropdown oficial · `aliases_lima.js:194-219` — ej. `"surco" → "Santiago de Surco"` (sin “Lima”), mientras el backend guarda `"Santiago de Surco"` o variantes sin tildes del JSON. · La búsqueda puede ubicar el pin bien pero el distrito del formulario no matchea hasta que Nominatim reverse alinea. · Añadir aliases que mapeen al string exacto de `distritos_zona.json`.

### [BAJO] · Faltan aliases de distritos “obvios” · `aliases_lima.js` — no hay entradas para `miraflores`, `san isidro`, `barranco`, `san borja` (Photon a veces alcanza, a veces no). · Usuarios teclean el distrito corto y obtienen cero sugerencias. · Ampliar bloque distritos con nombres coloquiales limeños.

### [BAJO] · Colisión semántica en retail · `aliases_lima.js:37` — `"mega"` → Megaplaza Norte. · Query “mega” en contexto no retail puede desviar el pin. · Quitar alias de una sola palabra o exigir más contexto.

### [INFO] · `ALQ_MAPE: '16.4%'` alineado con modelo v2 · docs/PLAN + artefactos. · OK como cifra de modelo, no de catálogo.

### [INFO] · `VARIABLES: '101'` coherente con XGBoost v2 · T009/T062. · OK.

### [INFO] · Discrepancia distritos cosmética documentada · Sprint 3 bitácora. · Sigue abierta numéricamente (40 vs 29); no cerrada.

---

## Top 3 ROI

1. **Corregir `DISTRITOS` (40 → 29 o fuente dinámica)** — mismo número en hero, mapa y evidencia.
2. **Diferenciar avisos “entrenamiento” vs “catálogo live”** — evita que Explorar contradiga el marketing.
3. **Stats de venta visibles en flujos de venta** — coherencia cuando ya hay operación venta en producto.

---

## Veredicto

Las métricas del modelo son defendibles; el problema es **mezclar dataset ML con marketplace** y un conteo de distritos desactualizado. Arreglar copy/datos antes de demos con inversionistas.

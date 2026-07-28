# T080 — Seller: bugs (publicar, editar, pausar, leads)

**TARGET:** `app/screens-seller.jsx`  
**LENTE:** bugs  
**Fecha:** 2026-07-06

---

## Resumen

Sprint 2 reescribió publicar con validación, borrador y PATCH; Sprint 4 arregló inbox agregado. Quedan borrador incompleto (operación), validación client-side ausente al editar precio, y geo reverse sin abort al desmontar.

---

## Hallazgos

### [MEDIO] · Borrador no restaura `operacion` · `screens-seller.jsx:40-46,76-79` — `localStorage` guarda `{ f, operacion }` pero al restaurar solo devuelve `d.f`; estado `operacion` queda en default `'alquiler'`. · Usuario borrador en venta ve formulario alquiler (rangos, modelo, unidad). · Al parsear draft: `if (d.operacion) setOperacion(d.operacion)`.

### [MEDIO] · Editar precio inline sin validar rango · `screens-seller.jsx:671-673,537-547` — `patch({ price_usd: Number(priceVal) })` sin chequear `OP_CFG` ni operación. · Backend puede 422 (T025: PATCH alquiler hasta 5M schema) o aceptar alquiler $200k; UX pobre. · Validar `cfg.min/max` antes de PATCH; mostrar error inline.

### [MEDIO] · `geoAbort` no aborta en unmount del form · `screens-seller.jsx:129-154` — cleanup solo `clearTimeout`; si el componente desmonta con fetch Nominatim en vuelo, puede escribir en estado muerto. · Warning React al salir rápido de publicar. · `return () => { clearTimeout(t); geoAbort.current?.abort(); }`.

### [MEDIO] · `MyListingRow.patch` no revierte UI en error de precio · `screens-seller.jsx:541-547` — mantiene `editingPrice` true; `priceVal` desincronizado si listing recargó. · Usuario cree que guardó. · Cerrar editor solo en éxito; reset `priceVal` desde `listing` en error.

### [BAJO] · Vista previa: zona con umbrales 8% hardcode distintos · `screens-seller.jsx:481-483` — `0.92` / `1.08` vs `ZONE_BAND_PCT` 8% global. · Preview tag Ganga/Justo/Inflado puede diferir del veredicto al publicar. · Importar constante compartida o usar `fair_value_ref` del backend post-simulate.

### [BAJO] · `deleteListing` éxito no pone `deleting` false · `screens-seller.jsx:528-534` — asume `onDeleted` recarga lista; si callback falla, botón queda “Borrando…”. · Edge case. · `finally(() => setDeleting(false))` o quitar row optimista.

### [BAJO] · `calcular` venta ignora amenities · `screens-seller.jsx:180-187` — coherente si modelo venta no los usa; amenities UI igual se muestran en venta. · Usuario marca piscina, referencia no cambia. · Ocultar amenities en venta o nota “no afectan referencia de venta v1”.

### [BAJO] · Leads por listing aún N+1 en `MyListingRow` · `screens-seller.jsx:552-561` — `Api.listLeads(listing.id)` al expandir cada fila. · `LeadsScreen` ya usa inbox agregado (Sprint 4); mis-publicaciones no. · Prefetch leads en `myListings` o endpoint con count.

### [INFO] · Publish form production-grade · Sprint 2 (fotos, pin, PATCH, tildes). · No re-reportar.

### [INFO] · Inbox leads agregado · Sprint 4 `LeadsScreen`. · No re-reportar.

### [INFO] · Self-lead 403 · Sprint 1 backend. · No re-reportar.

### [INFO] · Errores API humanos · Sprint 0. · No re-reportar.

---

## Veredicto

Sin bloqueantes en publicar tras Sprint 2. Fixes M de mayor ROI: **restaurar operación en borrador** y **validar precio en edición inline**. Evitan publicaciones con operación/rango equivocado.

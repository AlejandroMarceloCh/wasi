# T074 — Listings: bugs (filtros, paginación, mapa, races)

**TARGET:** `app/screens-listings.jsx`  
**LENTE:** bugs  
**Fecha:** 2026-07-06

---

## Resumen

Paginación y filtro alquiler/venta funcionan contra el API (Sprint 3). Persisten races en `load()`, desalineación mapa↔página, y contrafactual de alquiler en detalle de venta.

---

## Hallazgos

### [ALTO] · Race en `load()` sin secuenciación · `screens-listings.jsx:516-538,541-543,679-690` — cada `load(p)` dispara fetch; respuesta tardía de página N puede pisar página N+1. · Usuario en página 2 ve pins/listado de página 1 o mezcla tras clic rápido en Anterior/Siguiente o cambio de operación. · Contador de request (`reqId`) o `AbortController` por llamada; ignorar si `id !== latest`.

### [ALTO] · Mapa hace `fitBounds` solo con la página actual (24 ítems) · `screens-listings.jsx:177-196` — `useE` en `ListingsSplitMap` reajusta vista a los 24 listings de `data`. · Al paginar, el mapa “salta” a otra zona de Lima aunque el total sea 3 396; contador dice “24 de 3396 en esta zona” pero la zona es la de la página, no el filtro global. · Opción A: mapa con bounds de todo el filtro (endpoint geo); B: no re-fit en paginación; C: copy “Mapa: página actual”.

### [MEDIO] · Doble carga al montar evitada pero cambio operación/sort compite · `screens-listings.jsx:541-543` — segundo `useE` con `[sort, operacion]` llama `load(0)` si `data` truthy; primer mount solo primer effect. · Al togglear Alquiler/Venta rápido, races del punto anterior. · Mismo fix de secuenciación + `setPage(0)` antes del fetch.

### [MEDIO] · Contrafactual en detalle siempre modelo alquiler · `screens-listings.jsx:732-744` — `Api.counterfactual({...})` sin `operacion`; venta ignora amenities. · En listing `operacion: 'venta'`, panel “Qué explica este precio” usa modelo de alquiler (Sprint 2 ya limitó counterfactual a alquiler en publish). · Ocultar panel si `data.operacion === 'venta'` o endpoint venta.

### [MEDIO] · Filtros numéricos no se envían si vacíos pero sort `ganga` escala en backend · `screens-listings.jsx:519-526` + backend T025 — `sort=ganga` carga catálogo completo en RAM. · UI “Mejores gangas” puede congelar UI con ~3.4k pins procesados en cliente tras descarga completa. · Deshabilitar sort ganga hasta optimización backend o aviso de carga.

### [BAJO] · `loading` no bloquea mapa durante refetch · `screens-listings.jsx:518,675` — `setLoading(true)` pero `ListingsSplitMap` sigue mostrando `data` anterior. · Clic en página siguiente muestra mapa viejo con contador de página nuevo un instante. · Overlay skeleton o conservar página hasta respuesta.

### [BAJO] · Favoritos optimistas sin revert visual claro · `screens-listings.jsx:554-569` — revierte `Set` en error pero no banner si `onError` no montado. · Corazón parpadea. · Banner local en error de fav.

### [INFO] · Paginación `X-Total-Count` · Sprint 1+3. · No re-reportar.

### [INFO] · Banner “modelo de Wasi” · Sprint 3 corrigió copy comparables. · No re-reportar.

### [INFO] · Foto en detalle con fallback · Sprint 3. · No re-reportar.

---

## Veredicto

Bugs más impactantes: **race en paginación** y **mapa acoplado a la página**. Ambos afectan Explorar, pantalla core post-login. Secuenciación de `load()` es fix M de alto ROI.

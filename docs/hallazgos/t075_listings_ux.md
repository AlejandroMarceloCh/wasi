# T075 — Listings: UX (explorar, filtrar, detalle)

**TARGET:** `app/screens-listings.jsx`  
**LENTE:** ux  
**Fecha:** 2026-07-06

---

## Resumen

Explorar es funcional pero introduce fricción (filtros manuales, mapa vs grid), placeholders desalineados con venta, y detalle con tabs que duplican flujos de FairValue/Entorno.

---

## Hallazgos

### [MEDIO] · Filtros requieren “Aplicar filtros” · `screens-listings.jsx:644-647` — cambiar distrito, precio o dormitorios no recarga hasta clic; operación y sort sí auto-disparan `load(0)`. · Usuario cambia distrito, ve mapa viejo, cree que no hay stock. · Auto-debounce 400 ms en filtros o unificar comportamiento con sort/operación.

### [MEDIO] · Placeholder precio máximo fijo $5000 en venta · `screens-listings.jsx:629-632` — `placeholder="5000"` con venta hasta $5M (`OP_CFG` en seller). · Ancla mental errónea para compradores de venta. · Placeholder dinámico por `operacion` (p. ej. 250000 venta / 5000 alquiler).

### [MEDIO] · Contador del panel lateral vs paginación global · `screens-listings.jsx:253-258,658-662` — “Mostrando 24 de X en esta zona” (viewport mapa) vs “3396 inmuebles en alquiler · página 1 de 141”. · Dos nociones de “total” en la misma vista sin explicación. · Unificar copy: “24 en mapa visible · 3396 con estos filtros”.

### [MEDIO] · Detalle: tab FairValue solo empuja a wizard · `screens-listings.jsx:868-901` — “Analizar este precio” abre formulario con prefill; counterfactual y What-If ya cargan en la misma pestaña. · Usuario hace clic extra para ver veredicto que podría mostrarse inline con `fair_value_ref` del listing. · Mostrar veredicto congelado al publicar + CTA “Re-analizar con modelo actual”.

### [BAJO] · Contactar siempre visible · `screens-listings.jsx:786-788` — incluso para dueño viendo su propio listing (si llegara por URL). · Backend bloquea self-lead (Sprint 1); UI no oculta botón. · Ocultar si `role` es dueño o `data.is_owner`.

### [BAJO] · Empty state no resetea filtros con un clic · `screens-listings.jsx:665-673` — solo texto sugerente. · Fricción para salir de callejón sin valor. · Botón “Limpiar filtros”.

### [BAJO] · Tabs detalle sin `role="tablist"` · `screens-listings.jsx:793-799` — botones con `aria-pressed` pero sin pairing tab/panel. · Navegación por lector menos clara. · `role="tablist"`, `role="tab"`, `aria-controls`.

### [INFO] · Selector alquiler/venta · Sprint 3. · OK.

### [INFO] · Unidad precio /mes vs total en detalle · Sprint 3. · OK.

---

## Veredicto

UX aceptable post-Sprint 3; mayor fricción en **filtros inconsistentes** y **doble semántica mapa/conteo**. Ajustes de copy y auto-apply son mejoras M con retorno en exploración diaria.

# T079 — FairValue: a11y y responsive (wizard 360px)

**TARGET:** `app/screens-fairvalue.jsx` + `app/styles.css`  
**LENTE:** a11y-responsive  
**Fecha:** 2026-07-06

---

## Resumen

Sprint 5 añadió wizard responsive ≤480px (oculta labels de pasos, grid 1 col). A 360px persisten indicadores de paso sin semántica, SHAP accordion solo click, y entorno embebido con panel que tapa mapa.

---

## Hallazgos

### [MEDIO] · Indicadores de paso sin `aria` · `screens-fairvalue.jsx:187-200` — `.wizard-steps` son `div`/`span` sin `aria-current="step"` ni lista ordenada. · Lector anuncia solo “1 2 3” sin contexto de progreso. · `role="list"`, pasos con `aria-current={step===n?'step':undefined}`, `aria-label` por paso.

### [MEDIO] · Grupos SHAP expandibles solo con click · `screens-fairvalue.jsx:1251-1254` — `onClick` en fila sin `tabIndex`/`onKeyDown`. · Teclado no abre drivers del tornado. · `role="button"`, `onKeyActivate`, `aria-expanded`.

### [MEDIO] · `big-price-input` en 360px · `styles.css:2404-2408` — `max-width:100%` en ≤480px; `step3-grid` una columna ≤820px. · OK en 390px; en 360px el suffix “/ mes” puede wrap feo con precios largos venta. · `flex-wrap` en `.big-price` para pantallas <400px.

### [BAJO] · Wizard paso 1: mapa + AddressSearch altura en móvil · `screens-fairvalue.jsx:208-210` — mapa empuja botón Siguiente bajo fold. · Usuario no ve CTA sin scroll. · `min-height` mapa menor en `@media (max-width: 480px)`.

### [BAJO] · `EntornoMapScreen` panel fijo en embedded · `screens-fairvalue.jsx:1555-1758` — en detalle listing tab entorno, panel `efm-panel` ocupa ancho en móvil. · Mapa útil queda <50% viewport. · Modo embedded: panel colapsado por defecto en ≤980px.

### [BAJO] · Botón “Ver análisis completo” sin estado loading accesible · `screens-fairvalue.jsx:1201-1212` — abre modal que sí tiene Loading. · El botón no tiene `aria-busy`. · `aria-busy={detailLoading}` en trigger.

### [BAJO] · Sliders What-If: label asociado bien · `screens-fairvalue.jsx:723-726` — `htmlFor` + `aria-label` en range. · OK.

### [INFO] · Amenities pick-chip con teclado · `screens-fairvalue.jsx:255-260`. · OK.

### [INFO] · Focus visible global · Sprint 5 `styles.css`. · No re-reportar.

### [INFO] · Modal sin focus trap · deuda Sprint 5; afecta análisis detallado. · Ver T073.

---

## Veredicto

Wizard usable en 360px tras Sprint 5. Quick wins: **semántica de pasos** y **teclado en acordeón SHAP**. Entorno embebido en móvil necesita panel colapsado por defecto.

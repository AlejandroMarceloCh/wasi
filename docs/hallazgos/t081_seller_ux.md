# T081 — Seller: UX (form, feedback, preview, borrador)

**TARGET:** `app/screens-seller.jsx`  
**LENTE:** ux  
**Fecha:** 2026-07-06

---

## Resumen

El formulario de publicar es usable tras Sprint 2 (validación inline, borrador, vista previa), pero la fluidez se rompe en tres puntos: pantalla de carga full-page al publicar, preview que no refleja venta/operación, y feedback pobre cuando acciones están bloqueadas o el borrador se restaura en silencio.

---

## Hallazgos

### [MEDIO] · Publicar reemplaza todo el form por `Loading` · `screens-seller.jsx:272` — `if (submitting) return <Loading label="Publicando inmueble…"/>`. · El usuario pierde contexto visual (pasos, precio, mapa) durante el POST; en red lenta parece que “saltó” a otra pantalla. · Overlay inline en la card de contacto o spinner en el botón; mantener el wizard visible.

### [MEDIO] · Vista previa siempre muestra precio “/mes” · `screens-seller.jsx:474-484` + `components.jsx:169-170` — `ListingCard` en preview no recibe `operacion`; el componente hardcodea `/mes`. · Propietario en venta ve preview engañoso ($180k/mes) y pierde confianza antes de publicar. · Pasar `operacion` a preview o variante de card con unidad dinámica.

### [MEDIO] · `Calcular precio sugerido` deshabilitado sin explicación · `screens-seller.jsx:402-403` — `disabled={!areaOk || !pinOk || calculating}` sin mensaje adyacente. · Usuario con pin fuera de Lima o área vacía no entiende por qué el botón no responde. · Texto condicional bajo el botón (“Coloca el pin en Lima” / “Indica el área”).

### [MEDIO] · Cambiar operación borra precio y referencia sin aviso · `screens-seller.jsx:285` — `setFairRef(null); setCf(null); if(!priceUserTyped) set('price_usd','')`. · Quien alterna alquiler↔venta para comparar pierde el precio sugerido ya calculado. · Confirmación suave o conservar precio con recálculo de rango.

### [BAJO] · Borrador se restaura sin señal al usuario · `screens-seller.jsx:37-46,76-79` — al volver a Publicar, campos reaparecen desde `localStorage` sin banner. · Puede confundir (“¿ya publiqué?”) o mezclar datos de sesiones distintas. · Toast “Borrador restaurado” + enlace “Empezar de cero”.

### [BAJO] · Preview omite contacto, descripción y amenities · `screens-seller.jsx:474-484` — solo pasa precio, foto, dirección y specs básicas. · La preview no es fiel al aviso final en catálogo (falta contexto de confianza). · Ampliar payload de preview o copy “Vista parcial del catálogo”.

### [BAJO] · Form largo sin indicador de progreso · `screens-seller.jsx:298-467` — secciones 1–4 numeradas pero sin stepper/wizard-steps como FairValue. · En móvil el scroll hasta Publicar es largo; abandono probable. · Barra de pasos sticky o resumen “3 de 4 completos”.

### [BAJO] · `Publicar` deshabilitado sin checklist resumido · `screens-seller.jsx:462` — `disabled={!formOk}` sin listar qué falta hasta intentar submit. · Usuario no sabe si falta pin, precio o contacto sin tocar el botón. · Lista compacta de pendientes junto al CTA.

### [INFO] · Validación inline y borrador en `localStorage` · Sprint 2. · No re-reportar.

### [INFO] · Counterfactual solo en alquiler · coherente con endpoint. · UX de amenities en venta cubierta en T080.

---

## Veredicto

Fluidez buena en el camino feliz; mayor ROI en **preview con unidad correcta (venta)** y **no reemplazar el form entero al publicar**. Evitan sorpresas de precio y sensación de “pantalla rota” en el CTA principal.

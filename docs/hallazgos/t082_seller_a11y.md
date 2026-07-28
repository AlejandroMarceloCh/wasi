# T082 — Seller: a11y y responsive (form móvil, labels, foco)

**TARGET:** `app/screens-seller.jsx` + `app/styles.css`  
**LENTE:** a11y-responsive  
**Fecha:** 2026-07-06

---

## Resumen

Sprint 5 mejoró labels en `Input`/`Select`, foco visible y bottom-nav. En el wizard de publicar quedan campos sin asociar label↔control, tabs de operación incompletos para lectores de pantalla, y el mapa + precio grande compiten por espacio en ≤480px.

---

## Hallazgos

### [MEDIO] · Textarea “Descripción” sin `htmlFor`/`id` · `screens-seller.jsx:364-368` — `<label>Descripción (opcional)</label>` suelto; textarea sin `id`. · Clic en label no enfoca; lector anuncia campo huérfano. · `id` + `htmlFor` o reutilizar patrón `Input`.

### [MEDIO] · `Select` Distrito sin `aria-invalid` ni error visible · `screens-seller.jsx:314-316` — rama con dropdown no pasa `error` ni `onBlur`/`touched`; solo la rama fallback `Input` valida. · Con catálogo cargado, distrito inválido no se anuncia a AT. · Unificar validación en ambas ramas; `aria-invalid` cuando `touched.district && !distOk`.

### [MEDIO] · Tabs alquiler/venta sin paneles asociados · `screens-seller.jsx:281-294` — `role="tablist"` + `role="tab"` pero sin `aria-controls`/`tabpanel` ni `id` en paneles. · Patrón ARIA incompleto; lector no relaciona tab con contenido del wizard. · `id` en cards de pasos + `aria-labelledby` o simplificar a `radiogroup`.

### [MEDIO] · Mapa 380px fijo empuja formulario en móvil · `styles.css:1682-1684` — `.map-box { height: 380px }` sin reducción en `@media`. · En 390px el mapa ocupa ~1 viewport antes de distrito/dirección; scroll largo y pin difícil de afinar con teclado virtual abierto. · `height: min(380px, 45vh)` en ≤980px.

### [BAJO] · Precio grande: fuente 64px sin escala en móvil · `styles.css:1928-1937` — solo `max-width: 100%` en input (`2408`); dígitos largos (venta $1.8M) pueden recortarse visualmente. · Lectura difícil en pantallas angostas. · `font-size: clamp(36px, 12vw, 64px)` en `.big-price-input`.

### [BAJO] · Stepper usa `.sl` en lugar de `<label>` · `screens-core.jsx:181-189` — etiquetas “Dormitorios”, “Baños”, etc. son `div.sl`. · Asociación semántica débil frente a botones ± (sí tienen `aria-label`). · `<label>` o `aria-labelledby` en el contenedor stepper.

### [BAJO] · Modal vista previa sin focus-trap · `screens-seller.jsx:470-491` + `components.jsx:534-604` — Escape cierra, pero foco puede escapar al contenido detrás. · Usuario de teclado tabula fuera del diálogo. · Focus trap + foco inicial en botón Cerrar (ver T092).

### [BAJO] · Editor de precio inline sin `aria-invalid` · `screens-seller.jsx:666-668` — `<input className="input">` raw sin enlace a mensaje de error si PATCH falla. · Error solo vía banner global. · `Input` con `error` o `aria-describedby`.

### [INFO] · `Input`/`Select` con `htmlFor` autogenerado · Sprint 5 `components.jsx`. · OK en contacto y área.

### [INFO] · `pick-chip` amenities con `aria-pressed` y teclado · `screens-seller.jsx:351-356`. · OK.

### [INFO] · Bottom-nav alcanza Publicar vía Mis propiedades · Sprint 5. · No re-reportar.

---

## Veredicto

Base a11y decente post-Sprint 5. Priorizar **label en descripción**, **validación de distrito en Select** y **altura de mapa en móvil** — bajo esfuerzo, alto impacto en publicar desde celular.

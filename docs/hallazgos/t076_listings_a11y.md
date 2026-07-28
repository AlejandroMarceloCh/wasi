# T076 — Listings: a11y y responsive (móvil, leyenda mapa)

**TARGET:** `app/screens-listings.jsx` + `app/styles.css`  
**LENTE:** a11y-responsive  
**Fecha:** 2026-07-06

---

## Resumen

Layout split mapa/lista colapsa bien ≤980px (mapa 320px). La leyenda del mapa usa colores hardcodeados sobre fondo blanco fijo — ilegible en dark mode. Filtros densos en 390px y cards del grid sin nombre accesible explícito.

---

## Hallazgos

### [ALTO] · Leyenda del mapa invisible en dark mode · `screens-listings.jsx:232-249` — `background:'rgba(255,255,255,.94)'`, texto `#64748b`, sin tokens `var(--surface)`. · En `[data-theme="dark"]` la leyenda queda bloque claro sobre mapa oscuro o texto gris bajo contraste. · Clase `.ls-legend` en CSS con `var(--surface)`, `var(--ink-2)` y regla `[data-theme="dark"]`.

### [MEDIO] · Grid de cards: hover activa pin sin foco teclado · `screens-listings.jsx:261-267` — `onMouseEnter` en wrapper; `ListingCard` tiene click pero no enlaza hover de mapa con foco. · Usuario tabulando no ve resaltado de pin sincronizado. · `onFocus`/`onBlur` en card además de mouse.

### [MEDIO] · Barra de filtros: 7 controles en una fila wrap · `screens-listings.jsx:606-649` + `styles.css:2273-2277` — en 390px cada campo ~full width pero “Aplicar filtros” queda lejos del último input tras scroll. · Publicar/explorar en móvil requiere mucho scroll vertical antes del mapa. · Acordeón “Filtros” colapsable en móvil con badge de filtros activos.

### [MEDIO] · Segmento Alquiler/Venta: contraste del tab inactivo · `screens-listings.jsx:592-603` — inactivo `color: var(--ink-2)` sobre `var(--surface-2)`. · En dark puede quedar bajo contraste según tema. · Verificar ratio 4.5:1; borde en tab inactivo.

### [BAJO] · Paginador sin `aria-live` · `screens-listings.jsx:679-690` — cambio de página no se anuncia. · Usuarios de lector no saben que el listado cambió. · `aria-live="polite"` en contador de página.

### [BAJO] · Mapa 320px en móvil: clusters ilegibles con dedo grueso · `styles.css:2275` — altura fija 320px. · Difícil tocar pins sin zoom. · Aumentar a 40vh min en `@media (max-width: 980px)`.

### [BAJO] · Textarea contacto sin `htmlFor` · `screens-listings.jsx:75-80` — `<label>Mensaje` sin `id` en textarea. · Click en label no enfoca campo. · Usar componente `Input` o `id`/`htmlFor`.

### [INFO] · Bottom-nav alcanza Explorar · Sprint 5. · No re-reportar.

### [INFO] · `Input`/`Select` con labels asociados · Sprint 5 `components.jsx`. · OK en filtros principales.

---

## Veredicto

Fix más visible: **leyenda del mapa en dark** (bug de contraste real). Resto son mejoras móvil/teclado acotadas. CSS temático en leyenda es esfuerzo S.

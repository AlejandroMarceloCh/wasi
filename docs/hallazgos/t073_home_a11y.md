# T073 — Home: accesibilidad y responsive (390px)

**TARGET:** `app/screens-home.jsx` + `app/styles.css`  
**LENTE:** a11y-responsive  
**Fecha:** 2026-07-06

---

## Resumen

Sprint 5 mejoró foco visible y bottom-nav. En home persisten lista del mapa solo por mouse, carrusel sin pausa, botones sin nombre accesible y posible overflow del histograma en 390px.

---

## Hallazgos

### [MEDIO] · Filas del ranking de distritos no operables por teclado · `screens-home.jsx:371-393` — `onMouseEnter`/`onClick` sin `tabIndex`, `role`, ni `onKeyDown`. · Usuarios de teclado y lectores de pantalla no pueden enfocar distrito ni disparar `focusDistrito`. · Mismo patrón que `home-module` (590): `role="button"`, `tabIndex={0}`, `onKeyActivate`.

### [MEDIO] · Carrusel del hero sin control ni `aria-live` · `screens-home.jsx:436-441` — `setInterval` 3 s cambia precios/veredicto. · WCAG 2.2.2: contenido que se mueve solo puede marear; lectores no anuncian el cambio. · Botón pausar + `aria-live="polite"` en zona de veredicto, o respetar `prefers-reduced-motion` (Sprint 5 deuda).

### [MEDIO] · Botón flotante del mapa sin nombre accesible · `screens-home.jsx:347-358` — `<button onClick>` con texto visible pero sin `aria-label` explícito en contexto de mapa. · VoiceOver puede leer solo “Analizar un inmueble” sin rol de mapa. · `aria-label="Analizar un inmueble en el mapa"`.

### [BAJO] · Histograma SVG: etiquetas pueden recortarse en 390px · `screens-home.jsx:69-200` — `viewBox` dinámico hasta 600×320; leyenda GANGA/JUSTO/INFLADO en x=80/280/490. · En viewports estrechos el SVG escala pero labels superpuestas en el mock del hero. · Media query: ocultar leyenda duplicada o stack vertical en `styles.css` `.histogram-card`.

### [BAJO] · Mapa Leaflet: zoom solo mouse/touch · `screens-home.jsx:255-258` — sin atajo documentado para teclado en `DistrictMap` (zoomControl true pero foco entra al mapa). · Usuarios solo teclado dependen de la lista no enfocable. · Arreglar lista + instrucción “Usa +/− del mapa”.

### [BAJO] · Modal de análisis sin focus trap · `components.jsx:534-604` — usado en `screens-home.jsx:1176` — Escape y `aria-modal` sí; tab cicla fuera del dialog. · Deuda Sprint 5; afecta modal de análisis recientes en dashboard. · Focus trap al abrir + devolver foco al cerrar.

### [INFO] · Módulos home con teclado · `screens-home.jsx:590,619` — `onKeyActivate`. · OK.

### [INFO] · Bottom-nav y foco visible · Sprint 5 (`components.jsx`, `styles.css:2396-2401`). · No re-reportar.

### [INFO] · Dark mode en mocks del home · Sprint 0 (`styles.css:2065-2069`). · No re-reportar.

---

## Veredicto

Accesibilidad **parcial**: CTAs principales bien; ranking del mapa y carrusel son los huecos más visibles en 390px. Teclado en lista de distritos + pausa del hero son fixes S con buen ROI.

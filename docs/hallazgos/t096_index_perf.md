# T096 — index.html: performance (React dev, Babel, cache-busting)

**TARGET:** `app/index.html`  
**LENTE:** performance / entrega  
**Fecha:** 2026-07-06

---

## Resumen

El setup sin bundler cumple el objetivo de iterar rápido, pero cada visita paga un costo alto: React en modo desarrollo, transpilación Babel en el cliente y cero cache de assets propios. La bitácora ya marca el build de producción como decisión pendiente del usuario — acá se cuantifica el impacto.

---

## Hallazgos

### [ALTO] · React 18 **development** en producción · `index.html:43-44` — `react.development.js` y `react-dom.development.js` (~orden de magnitud más pesados y lentos que `production.min.js`). · TTI y hidratación peores en móvil; warnings de dev en consola. · Cambiar a builds `.production.min.js` aunque se mantenga Babel en runtime (ganancia rápida sin bundler).

### [ALTO] · Cache-busting con `Date.now()` en cada carga · `index.html:53-64` — `?v=` único por refresh en `api.js`, 9× `.jsx`, aliases y stats. · El navegador **nunca** cachea JS propio; cada F5 re-descarga y re-transpila todo. · En dev: bust solo si `localStorage.debug`; en prod: hash de contenido o versión fija.

### [ALTO] · Babel standalone transpila 9 JSX en el hilo principal · `index.html:60-64` — cada `.jsx` se fetch + parse + transform antes de ejecutar `app.jsx`. · En red 4G el blank screen puede superar varios segundos; main thread bloqueado (INP malo). · Build previo (esbuild/vite) o al menos precompilar pantallas a `.js` plano.

### [MEDIO] · `document.write` para inyectar scripts · `index.html:55-63` — API deprecada; bloquea el parser HTML. · Peor paralelización vs `<script defer src=…>`. · Lista estática de `<script type="module">` o bundle único.

### [MEDIO] · Cadena de dependencias CDN síncrona · `index.html:10-13,43-48` — Google Fonts + Leaflet CSS×3 + React + Babel + Leaflet JS + MarkerCluster + **d3** antes de app. · ~8 round-trips externos; fonts render-blocking. · `font-display: swap`, combinar CSS Leaflet, cargar d3 solo en pantallas que lo usan (lazy).

### [MEDIO] · Sin compresión ni HTTP/2 push asumida en hosting estático · dependencia de `unpkg.com` y `fonts.googleapis.com`. · Latencia extra si el static de Wasi está en otro origen sin CDN. · Self-host de React/Babel minificado en el mismo dominio del `index.html`.

### [BAJO] · Anti-flash de tema bien ubicado · `index.html:17-23` — corre antes del paint. · Patrón correcto. · OK.

### [BAJO] · Override `#api8001` antes de `api.js` · `index.html:29-37`. · Orden correcto. · OK.

### [INFO] · Build de producción pendiente por decisión explícita · Sprint 5 bitácora. · No es bug nuevo; es deuda conocida con impacto medido acá.

---

## Top 3 ROI

1. **React production.min** — cambio de dos líneas, ~30–40% menos JS de framework.
2. **Dejar de bustear en cada F5** (o prebuild) — segunda visita usable en móvil.
3. **Un bundle esbuild** — elimina Babel runtime y 9 fetches JSX de un plumazo.

---

## Veredicto

Aceptable para demo local; **no** para tráfico real en Lima en 4G. El camino mínimo es production React + cache con versión fija; el camino sano es un build de un solo archivo.

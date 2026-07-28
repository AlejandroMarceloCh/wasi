# Plan de migración del frontend a Vite + arquitectura por features (para Codex)

> Eres un ingeniero frontend senior con acceso de lectura/escritura al repo de
> **Wasi**. Tu misión: migrar el frontend de su forma actual (archivos JSX planos
> que comparten scope global, transpilados con Babel/esbuild) a un proyecto **Vite
> + React con estructura por features**, SIN romper nada en el camino. Trabajas
> **incremental por Sprints**: la app debe seguir funcionando al final de cada uno.

---

## 0. Reglas innegociables (todos los sprints)

### Regla 1 — Sprint Goal
Cada sprint define **un objetivo central verificable**. NO se cierra por tiempo:
se cierra cuando la app **renderiza y funciona** con lo migrado hasta ahí. Si algo
quedó roto, el sprint sigue abierto.

### Regla 2 — Protocolo Anticagadas (QA con Sonnet)
Antes de cerrar cada sprint:
1. La app arranca en Vite (`npm run dev`) **sin errores de consola** y renderiza.
2. **Prueba manual e2e** del/los flujo(s) migrado(s), comparando contra la app
   actual (que sigue viva) como referencia de comportamiento.
3. Lanza un **agente de revisión Sonnet** con: *"Revisa el diff del Sprint N
   (git diff), verifica que la feature migrada se comporta igual que en la app
   original (`app/*.jsx`), busca imports faltantes, globals no convertidos,
   efectos sin cleanup, y regresiones. Reporta con archivo:línea. No cambies
   código."*
4. Corrige todo hallazgo antes de cerrar.

### Regla 3 — Bitácora
Al cerrar cada sprint, append a `docs/BITACORA_MIGRACION_VITE.md`:
```
## Sprint VN — <título> — <fecha>
- Sprint Goal: <lo cumplido>
- Qué se migró: <archivos origen → destino>
- Decisiones: <por qué>
- QA: <arranque OK · flujos probados · hallazgos Sonnet y cómo se resolvieron>
- Deuda: <lo diferido>
- Estado: CERRADO ✅
```

### Restricciones duras
- **NO toques el backend** (`app/backend/`, `src/wasi/`). El contrato de la API
  y las rutas `/api/...` se mantienen idénticos.
- **Migración en un directorio NUEVO** (`web/`). El `app/` actual queda intacto y
  funcionando hasta el cutover final (último sprint). Así siempre hay un fallback.
- **JavaScript/JSX, NO TypeScript.** Mantener el lenguaje actual para acotar el
  riesgo. (TS es un refactor opcional posterior.)
- **Mantener Leaflet crudo** (`import L from 'leaflet'`), NO migrar a react-leaflet
  (sería reescribir los mapas; alto riesgo, cero necesidad).
- **Preservar la lógica de API base**: `#api8001`/`localStorage` para desarrollo
  local + fallback a producción. Pasar a variable de entorno de Vite
  (`import.meta.env.VITE_API_BASE`) con la misma semántica.
- Español peruano neutro en todo el copy (no tocar textos salvo bugs).
- No commitear a `main`. Trabajar en la rama actual (`refactor/modular`) o una
  rama `feat/vite`. Commit por sprint.

---

## 1. Contexto: cómo está HOY el frontend (LÉELO antes de tocar nada)

- Archivos en `app/`: `api.js`, `aliases_lima.js`, `stats.js`, `components.jsx`,
  `screens-core.jsx`, `screens-public.jsx`, `screens-home.jsx`,
  `screens-fairvalue.jsx`, `screens-profile.jsx`, `screens-listings.jsx`,
  `screens-seller.jsx`, `app.jsx`, `styles.css`.
- **Comparten scope global**: cada archivo define consts top-level (componentes,
  helpers) que los demás usan SIN importar. El orden de carga en `index.html`
  importa (`components` declara primitivas → `screens-*` las usan → `app` monta).
- **Globals implícitos que se usan sin import:**
  - `React` (hooks destructurados: `const {useState:useS, useEffect:useE, useRef:useR} = React`)
  - `ReactDOM` (para el mount)
  - `L` (Leaflet), `d3`, `L.markerCluster`
  - `window.Api` (definido en `api.js`), `window.WASI_STATS` (`stats.js`),
    aliases de `aliases_lima.js`
  - Helpers compartidos: `handleApiErr`, `onKeyActivate`, `enLima`, `AMENIDADES`,
    `safeImageUrl`, `apartmentPhoto`, `ZONE_VARIANT`, `Icon`, `Btn`, `Card`,
    `Modal`, `Input`, `Select`, `Stepper`, `Tag`, `ToggleRow`, `MapPicker`,
    `AddressSearch`, `ListingCard`, `PageHeader`, `Loading`, `Logo`,
    `CounterfactualPanel`, etc.
- **Build actual:** `scripts/build_frontend.mjs` concatena todo y esbuild lo
  minifica a `app/dist/bundle.min.js` (producción). Dev usa Babel standalone.
- **API:** `api.js` arma `BASE` desde `window.WASI_API_BASE || localStorage
  'wasi.apibase' || (localhost?8000:PROD)`. El hash `#api8001` la fija.
- **Backend vivo para probar:** `PYTHONPATH=app/backend app/backend/venv/bin/python
  -m uvicorn app.backend.main:app --port 8001`. Usuarios: `ana@wasi.pe` /
  `demo1234` (inquilino); crea un Propietario vía registro para el flujo vendedor.

**El corazón de la migración:** convertir esos globals implícitos en **exports/
imports explícitos** de módulos ES, feature por feature, sin cambiar la lógica.

---

## 2. Estructura target (`web/`)

```
web/
  index.html                 (Vite entry; NO document.write, NO CDNs de React)
  vite.config.js
  package.json
  .env / .env.example        (VITE_API_BASE)
  public/                    (assets estáticos si hacen falta)
  src/
    main.jsx                 (ReactDOM.createRoot + <App/>)
    App.jsx                  (router de estado actual + layout + TopNav)
    styles.css               (el actual, importado en main.jsx)
    shared/
      api/client.js          (ex api.js, con export; BASE desde import.meta.env)
      lib/                    (aliases_lima, stats, helpers: handleApiErr, enLima, onKeyActivate…)
      ui/                     (Icon, Btn, Card, Modal, Input, Select, Stepper, Tag, ToggleRow, Logo, PageHeader, Loading)
      map/                    (MapPicker, AddressSearch, ListingsSplitMap base — Leaflet crudo)
      listings/ListingCard.jsx
    features/
      auth/                  (LoginScreen/RegisterScreen ← screens-public)
      home/                  (HomeScreen + sub-componentes ← screens-home)
      fairvalue/             (wizard, resultado, entorno ← screens-fairvalue + screens-core parts)
      listings/              (ListingsScreen, ListingDetailScreen ← screens-listings)
      publish/               (PublishScreen, MyListings, Leads ← screens-seller)
      profile/               (ProfileScreen ← screens-profile)
```

Reglas de estructura (consenso 2025): **por feature, no por tipo**; **nesting
máx 2-3 niveles**; **sin barrel files** (`index.js` que re-exporta todo — rompe el
tree-shaking de Vite: importar directo del archivo); **sin imports cruzados entre
features** (si dos features necesitan lo mismo, va a `shared/`).

Dependencias npm (reemplazan los CDN): `react`, `react-dom`, `leaflet`,
`leaflet.markercluster`, `d3`. CSS de Leaflet: `import 'leaflet/dist/leaflet.css'`.

---

## 3. Secuencia de sprints

### Sprint V0 — Andamiaje Vite (sin migrar lógica aún)
**Goal:** un proyecto Vite en `web/` que monta un `<App/>` mínimo, con las deps de
npm instaladas y la API base por env, y `npm run dev` corriendo.
- `npm create vite@latest web -- --template react` (variante JS).
- Instalar `leaflet leaflet.markercluster d3`.
- `.env.example` con `VITE_API_BASE=` y `.env` local con `http://localhost:8001`.
- `main.jsx` monta un placeholder; importar `styles.css`.
- Verificar `npm run dev` abre y renderiza el placeholder.

### Sprint V1 — Capa `shared/`
**Goal:** todas las primitivas compartidas migradas a módulos con export, y un
cliente de API que apunta al backend real.
- `shared/api/client.js` ← `api.js`: mismo objeto `Api`, pero `export const Api`
  y `BASE` desde `import.meta.env.VITE_API_BASE || (localhost?...:PROD)`; mantener
  el override por `localStorage`/hash si se quiere para dev.
- `shared/lib/` ← `stats.js` (export `WASI_STATS`), `aliases_lima.js`, y los
  helpers sueltos (`handleApiErr`, `enLima`, `onKeyActivate`, `AMENIDADES`,
  `safeImageUrl`, `apartmentPhoto`, `ZONE_VARIANT`).
- `shared/ui/` ← primitivas de `components.jsx` (`Icon`, `Btn`, `Card`, `Modal`,
  `Input`, `Select`, `Stepper`, `Tag`, `ToggleRow`, `Logo`, `PageHeader`,
  `Loading`), cada una `export`. `React` se importa (`import React,{useState,...}`).
- `shared/map/` ← `MapPicker`, `AddressSearch` (Leaflet crudo con `import L`).
- `shared/listings/ListingCard.jsx`.
- Verificar: un `App` de prueba que renderiza un par de primitivas (Btn, Card,
  Modal) y hace un `Api.distritosZona()` real contra :8001.

### Sprint V2 — Feature `auth`
**Goal:** login/registro funcionan de punta a punta en Vite (crear cuenta, entrar,
sesión persistida).
- `features/auth/` ← `screens-public.jsx`. Importa lo que use de `shared/`.
- `App.jsx` empieza a manejar el estado de pantalla (portar el router de estado de
  `app.jsx`, pero solo con las pantallas ya migradas; el resto, placeholders).
- QA: registro con errores (password corto → mensaje en español), login, logout.

### Sprint V3 — Feature `listings` (explorar + detalle)
**Goal:** el catálogo con filtros, paginación, mapa y detalle funciona.
- `features/listings/` ← `screens-listings.jsx` (incluye `ListingsSplitMap`).
- QA: filtro alquiler/venta, paginación, abrir detalle, foto, favoritos.

### Sprint V4 — Feature `fairvalue` (+ entorno)
**Goal:** el estimador (wizard → resultado → SHAP → entorno) funciona.
- `features/fairvalue/` ← `screens-fairvalue.jsx` + las partes de `screens-core.jsx`
  que use (el mapa de entorno, etc.).
- QA: estimar alquiler y venta, ver rango P25-P75, counterfactuals, narrativa,
  tab entorno.

### Sprint V5 — Feature `publish` (+ mis propiedades + leads)
**Goal:** publicar (alquiler y venta), editar/pausar, y la bandeja de leads.
- `features/publish/` ← `screens-seller.jsx`.
- QA: publicar con foto y pin, validación inline, editar precio, pausar, ver leads.

### Sprint V6 — Features `home` y `profile`
**Goal:** home y perfil migrados; toda la app corre en Vite.
- `features/home/` ← `screens-home.jsx`; `features/profile/` ← `screens-profile.jsx`.
- QA: navegación por rol, cambio de rol refresca nav, mocks del hero con disclaimer.

### Sprint V7 — Cutover y limpieza
**Goal:** Vite es la app oficial; se elimina el setup viejo.
- Configurar deploy: Vercel con build de Vite (`npm run build` → `dist/`).
- Ajustar `VITE_API_BASE` de producción (URL del backend en Render).
- Borrar `app/*.jsx`, `app/index.html` viejo, `scripts/build_frontend.mjs`,
  `app/dist/` — SOLO cuando el usuario confirme que Vite está estable en prod.
- QA final: todos los flujos en la build de producción de Vite.

---

## 4. Cómo convertir cada archivo (guía mecánica)

Para cada `screens-X.jsx` → `features/x/`:
1. **Identifica qué DEFINE** (componentes/helpers top-level) → esos llevan `export`.
2. **Identifica qué USA de otros archivos** (globals implícitos) → agrégalos como
   `import { X } from '...'` desde `shared/` o el módulo correcto.
3. **React y hooks:** `import React, { useState, useEffect, useRef, useMemo } from 'react'`.
   Reemplaza las destructuraciones globales (`useS`, `useE`, `useR`) — o
   redefínelas localmente (`const useS = useState`) para minimizar cambios.
4. **Leaflet:** `import L from 'leaflet'; import 'leaflet/dist/leaflet.css'` (y
   markercluster/d3 análogo).
5. **No cambies la lógica ni el JSX** — solo la forma de importar/exportar. La
   migración es de *forma*, no de *comportamiento*.
6. Al terminar el archivo, la app debe seguir renderizando esa pantalla igual.

---

## 5. Arranque
1. Lee este documento completo, `app/index.html`, `app/api.js`, `app/components.jsx`
   y un `screens-*` para entender el patrón de globals compartidos.
2. Ejecuta Sprint V0 y confirma que Vite monta.
3. Continúa V1→V7 en orden, cerrando cada uno con las 3 reglas.
4. En el cutover (V7), **pide confirmación del usuario** antes de borrar el `app/`
   viejo.

**Recordatorio:** el objetivo es que a un usuario final la app se le vea y comporte
IGUAL; lo que cambia es la arquitectura interna (Vite + módulos + features) y el
DX (HMR instantáneo, build real). Cero cambios de producto en esta migración.

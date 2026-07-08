# BITACORA_MIGRACION_VITE - Wasi

## Sprint V0 — Andamiaje Vite — 2026-07-08
- Sprint Goal: crear un proyecto Vite nuevo en `web/` que monta un `<App/>` minimo, con dependencias npm instaladas, API base por entorno y placeholder renderizando sin tocar `app/` ni backend.
- Que se migro: sin migrar pantallas todavia; se copio `app/styles.css` hacia `web/src/styles.css` para que el placeholder use el lenguaje visual actual.
- Decisiones:
  - Se uso `vite@5.4.21` y `@vitejs/plugin-react@4.3.4` porque el entorno local tiene Node `20.13.1`; las versiones generadas por `create-vite` pedian Node `20.19+`.
  - Se retiraron archivos demo del scaffold (`App.css`, `index.css`, assets de React/Vite, README y oxlint) para dejar un V0 minimo.
  - Se creo `web/src/shared/api/base.js` desde V0 para preservar la semantica de API base: `VITE_API_BASE`, `#api8001`/`#api8000`, `localStorage['wasi.apibase']`, fallback localhost y fallback produccion.
- QA:
  - Arranque OK: `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort` levanto Vite en `http://127.0.0.1:5174/`.
  - Render OK: Playwright cargo la pagina y capturo `/tmp/wasi-v0-final.png`; el placeholder de Wasi se ve correctamente.
  - Build OK: `npm run build` paso con `38 modules transformed`.
  - Audit runtime OK: `npm audit --omit=dev` reporto `found 0 vulnerabilities`.
  - Protocolo Anticagadas: se uso agente Codex de revision con el prompt equivalente al de Sonnet disponible en este entorno.
  - Hallazgo QA medio: `App.jsx` habia reducido la API base a `VITE_API_BASE || localhost:8001`; se corrigio con `resolveApiBase()` preservando la logica de la app anterior.
- Deuda:
  - En Sprint V1, `resolveApiBase()` debe integrarse con `shared/api/client.js` para exportar `Api` completo.
  - `web/.env` queda local para desarrollo; no debe contener secretos.
- Estado: CERRADO ✅

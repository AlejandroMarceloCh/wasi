# Auditoría exhaustiva de Wasi — brief para Codex

> Eres un ingeniero senior auditando el repo **Wasi** (proptech Lima: FastAPI +
> XGBoost + React/Vite). Tienes acceso de lectura a TODO el repo y puedes ejecutar
> comandos. Tu misión: encontrar **todos los bugs y oportunidades de mejora**, en
> cada partecita, y entregar UN informe rankeado por ROI. **Fase 1 = auditar, NO
> tocar código.** El humano aprueba qué se corrige.

---

## 0. Reglas que te ahorran tokens (léelas primero)

1. **Audita primero, no cambies código.** Entregable = `docs/HALLAZGOS_CODEX.md`. Fin.
2. **NO re-reportes lo ya resuelto.** Lee `docs/BITACORA_FORMS.md` (18+ sprints
   cerrados) y `docs/RESULTADOS_VALIDACION_ESPACIAL.md` ANTES de empezar. Si algo
   listado como cerrado en realidad sigue roto, dilo con evidencia; si no, cállalo.
3. **"Renderiza ≠ funciona".** La lección más cara de este proyecto: un mapa se
   veía bien pero los pines estaban rotos (404 de assets tras el bundling). **No
   confíes en el grep ni en que "el componente existe".** Verifica el
   comportamiento real (corre el flujo, mira la respuesta, revisa la consola del
   navegador). Un hallazgo sin evidencia de runtime vale la mitad.
4. **No malgastes tokens redescubriendo.** La sección 2 tiene el inventario exacto
   de archivos y los comandos para levantar todo. Úsalos, no explores a ciegas.
5. **Rankea por ROI** (impacto ÷ esfuerzo), no por orden de descubrimiento.
6. Español peruano neutro. No commitees. Rama: `refactor/modular`.

---

## 2. Contexto y arnés (cópialo, no lo redescubras)

**Estado:** producto post-migración. Backend modular (`src/wasi` paquete +
`app/backend` HTTP), 170 tests verdes, frontend **migrado a Vite** (`web/`), ML
validado y reproducible. Deploy: Vercel (frontend) + Render (backend).

**Inventario de archivos (auditables):**
- Frontend Vite: `web/src/main.jsx`, `web/src/App.jsx`, `web/src/styles.css`,
  `web/src/shared/{api,ui,map,lib,listings}/*`, `web/src/features/{auth,home,fairvalue,listings,publish,profile}/*`,
  `web/index.html`, `web/vite.config.js`, `web/package.json`.
- Backend HTTP: `app/backend/main.py`, `app/backend/auth.py`, `app/backend/database.py`,
  `app/backend/models.py`, `app/backend/schemas.py`, `app/backend/seed*.py`,
  `app/backend/ratelimit.py`, `app/backend/routers/{auth,dashboard,entorno,fairvalue,health,listings}.py`.
- Paquete ML: `src/wasi/paths.py`, `src/wasi/features/{geo_index,osm_lookup,distrito_features,distritos_lima_features,display_pois}.py`,
  `src/wasi/models/{model_service,ml,ml_v2,venta_service,comparables_service}.py`.
- Pipeline ML: `notebooks/01..05,11.ipynb`, `app/backend/scripts/*.py`, `ventas_model/*.py`,
  `scripts_experimento/*.py`.
- Deploy: `render.yaml`, `vercel.json`, `Makefile`.
- Tests: `app/backend/tests/*.py`.

**Levantar todo (para verificar en runtime):**
```bash
# Backend en :8001 (Docker suele ocupar :8000). WASI_RATELIMIT=0 para no chocar con límites.
PYTHONPATH=app/backend WASI_RATELIMIT=0 app/backend/venv/bin/python -m uvicorn app.backend.main:app --port 8001
# Frontend Vite (build de producción, sirve el bundle real):
cd web && npm run build && cd dist && python3 -m http.server 5500   # http://localhost:5500
#   o dev con HMR:  cd web && npm run dev   (http://localhost:5173)
# Tests (piso: 170 passed, 2 skipped):
WASI_RATELIMIT=0 WASI_SKIP_BULK_SEED=1 app/backend/venv/bin/python -m pytest app/backend/tests/ -q
```

**Verificación de navegador (Playwright ya instalado):** en
`/private/tmp/.../scratchpad/e2e/node_modules` puede no persistir entre sesiones;
si falta, `npm i playwright-core` en un dir temporal y usa
`chromium.launch({ channel:'chrome', headless:true, args:['--no-sandbox'] })`.
Autenticación: registra vía `POST /api/auth/register` (roles: Inquilino /
Propietario), luego inyecta `localStorage` `wasi.token` + `wasi.user` y recarga.
Captura SIEMPRE: `page.on('pageerror')`, `page.on('console' type error)`,
`page.on('response' status>=400)`. Un flujo sin errores de consola/red es tu
prueba de que "funciona", no solo "renderiza".

**Usuarios/datos:** no hay seed de usuarios fijos garantizado; crea los tuyos por
API. Limpia los de prueba al final (`DELETE /api/listings/{id}`; los users no
tienen endpoint de borrado — menciónalo).

---

## 3. Áreas de auditoría (exhaustivo, con probes concretas)

Para CADA área: no solo leas el código — **corre el flujo y observa**. Reporta con
archivo:línea + evidencia de runtime (respuesta, screenshot, error de consola).

### A. Migración a Vite — MÁXIMA PRIORIDAD (lo más nuevo = lo más riesgoso)
La migración convirtió ~6,000 líneas de scope-global a módulos ES. El riesgo #1 es
que algo se haya perdido o roto en la traducción.
- **Assets que se rompen al bundlear** (como pasó con los pines de Leaflet): busca
  TODO `import ... from '....png/.svg/.css'` y CUALQUIER uso de imágenes/íconos/
  fuentes; corre el build y verifica en el navegador que NO hay 404s de assets en
  ningún flujo (publicar, fairvalue, explorar, entorno, detalle). Revisa `d3`,
  `leaflet.markercluster`, fuentes de Google.
- **Paridad de comportamiento**: compara cada feature migrada contra lo que la
  bitácora dice que debe hacer. ¿Se perdió algún handler, efecto, o guard en la
  traducción a imports? (ej. cleanup de efectos, AbortController, focus-trap).
- **Globals implícitos mal convertidos**: ¿algún componente referencia algo que ya
  no está importado y falla en runtime (no en build)? Corre CADA pantalla.
- **Env vars de Vite**: `VITE_API_BASE` se hornea en build. ¿El fallback de
  producción (`web/src/shared/api/base.js`) apunta al backend correcto de Render?
  ¿El override `#api8001`/localStorage sigue funcionando?
- **Bundle**: 658 kB en un chunk. ¿`manualChunks` para separar Leaflet/d3/React
  mejoraría el TTI? Mide.

### B. Frontend — cada feature, flujo por flujo
Recorre en el navegador, no solo leas:
- **auth**: registro/login por UI, TODOS los errores (password corto, email malo,
  duplicado) → ¿mensajes en español, nunca "[object Object]"? sesión expirada.
- **home**: hero, stats coherentes, mapa de distritos (pines OK), gangas
  plausibles (no basura $50/mes -94%), CTAs, "Ver trailer", dark mode.
- **fairvalue**: wizard completo (alquiler Y venta), gauge, rango P25-P75, SHAP
  (¿se expande?), counterfactuals (¿el slider responde?), narrativa (¿degrada sin
  GROQ_API_KEY?), tab entorno (POIs, pin). Compara números contra el backend.
- **listings**: filtros vs backend (X-Total-Count), paginación (¿el mapa NO salta?),
  detalle (foto, unidad de precio correcta por operación), favoritos (persisten),
  contactar.
- **publish**: operación, buscar dirección, autocompletar (¿pisa lo tecleado?),
  subir foto (preview + guarda en BD; prueba HEIC/no-imagen/archivo grande),
  validación inline, borrador, editar/pausar/borrar (persisten en BD).
- **profile**: editar, cambio de rol (¿refresca la nav al instante?), funcionalidad
  decorativa que miente (campana vacía, planes sin flujo).
- **Transversal**: dark mode en TODAS las pantallas (texto ilegible), responsive
  360-390px (overflow, bottom-nav 5 tabs), a11y (focus-trap, aria-live, teclado),
  historial del navegador (Atrás/F5), ErrorBoundary (¿existe? una excepción de
  render = pantalla blanca).

### C. Backend — cada router y capa
- **routers**: casos borde por endpoint (nulos, fuera de rango, fuera de Lima,
  IDs inexistentes, cross-user), coherencia de veredictos (Ganga/Justo/Inflado)
  entre catálogo/fairvalue/publicar, rate-limits (¿todos los sensibles?), PII
  (¿fuga en algún endpoint?).
- **schemas**: huecos de validación, serializers de fecha (Z), contratos vs lo que
  el frontend consume (campos que el front asume y el back puede omitir).
- **auth/db**: JWT (expiración, algoritmo, revocación), `ensure_schema`
  idempotente y retrocompatible (SQLite Y Postgres), migraciones nunca probadas
  contra Postgres real.
- **concurrencia**: singletons lazy con lock, thread-safety bajo carga.

### D. ML / pipeline
La honestidad del MAPE ya está validada (`RESULTADOS_VALIDACION_ESPACIAL.md`) — NO
la re-audites. Busca lo demás:
- Features con importancia ~0 (poda), multicolinealidad (VIF no actuado), missing
  data con sesgo (amenities=0 = "no reportado"?), sesgo de Jensen (expm1).
- Scripts que apuntan a v1 mientras producción corre v2 (auditoría/calibración).
- `ventas_model`: Babilonia descartada por NaN en `clean_ventas`, dedup espacial.
- Paridad train↔serving en `build_features_v2` / `venta_service`.
- Coverage P25-P75 (41.7% vs 50%): ¿conformal prediction?

### E. Seguridad, performance, datos
- **Seguridad**: JWT en localStorage (XSS), enumeración de emails, SRI en CDNs,
  validación de `image_url` (data:image vs javascript:), tamaño de payloads.
- **Performance**: requests redundantes (un resultado de fairvalue dispara ~6
  llamadas), N+1 restantes, índices de DB, timeouts vs cold start de Render, el
  bundle sin code-splitting.
- **Datos**: conteos inconsistentes entre superficies (hero vs catálogo vs
  comparables), integridad de los CSV/joblib versionados.

### F. Deploy e infra — BLOQUEANTES conocidos, confírmalos
- `render.yaml` NO define `WASI_CORS_ORIGINS` → el frontend de Vercel quedaría
  bloqueado por CORS. Confírmalo y dimensiona.
- SQLite efímero en Render free (Postgres pendiente). `DATABASE_URL`.
- `vercel.json` (rootDirectory `web`, rewrites SPA), CI (¿existe? ¿corre los
  tests? ¿misma versión de Python que Render 3.11?).

### G. Tests y calidad de código
- Cobertura: ¿flujos críticos sin test? ¿tests frágiles/tautológicos?
- Código muerto (`DashboardScreen` huérfano si sigue), TODOs, `console.log`
  olvidados, dependencias sin usar.
- Reproducibilidad: ¿el pipeline ML se regenera desde los notebooks?

---

## 4. Entregable (tu único output en fase 1)

`docs/HALLAZGOS_CODEX.md` con:
1. **Resumen ejecutivo** (10 líneas): estado + los 5 hallazgos de mayor ROI.
2. **Tabla priorizada** de TODOS los hallazgos:
   `| # | Área | Hallazgo | Severidad | Esfuerzo (S/M/L) | Impacto | Evidencia (archivo:línea + runtime) |`
   ordenada por ROI.
3. **Quick wins** (esfuerzo S, impacto alto) — lo primero a corregir.
4. **Lo que verificaste en runtime** (flujos corridos, con resultado) — separa lo
   probado de lo solo-leído.
5. **Lo que NO se debe tocar** y por qué (modelo congelado, contrato FairValue).
6. **Preguntas para el humano** donde haya decisión de producto/negocio.

Al entregar el informe, **DETENTE y pide aprobación** antes de escribir código.
En la fase de corrección (ya aprobada): lotes pequeños, `pytest` tras cada uno
(piso 170/2), y bitácora en `docs/BITACORA_FORMS.md` con el formato de los sprints.

---

## 5. Cómo NO malgastar los tokens del usuario
- No re-reportes los ~18 sprints cerrados (léelos primero).
- No transcribas código en el informe: cita archivo:línea.
- No propongas microservicios / reescrituras masivas / bundlers nuevos: el stack
  ya está decidido (modular monolith + Vite). Céntrate en bugs y mejoras acotadas.
- Prioriza los flujos que el usuario toca (publicar, explorar, fairvalue) sobre
  scripts internos que rara vez corren.
- Un hallazgo verificado en runtime > diez sospechas de lectura.

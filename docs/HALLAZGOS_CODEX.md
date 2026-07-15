# Hallazgos Codex — Fase 1 (auditoría, sin fixes)

**Proyecto:** Wasi (FastAPI + XGBoost + React/Vite)  
**Fecha:** 2026-07-14  
**Rama esperada:** `refactor/modular`  
**Alcance:** áreas A–G del `PLAN_AUDITORIA_EXHAUSTIVA_CODEX.md`  
**Método:** lectura estática + probes API en `:8001` + navegador MCP en `http://localhost:5500/#api8001` (Vite dev).  
**No re-reportado:** sprints 0–11 y gates V0–V7 cerrados en `BITACORA_FORMS.md` / `BITACORA_MIGRACION_VITE.md`, ni la honestidad del MAPE (`RESULTADOS_VALIDACION_ESPACIAL.md`), salvo donde la evidencia muestra que el fix quedó incompleto.

---

## 1. Resumen ejecutivo

Wasi post-migración Vite arranca y los flujos core **renderizan** (splash → home autenticado → Explorar → FairValue wizard → Perfil). El backend en `:8001` responde `model_mode: v2` con venta cargada. El riesgo #1 de deploy sigue abierto y **confirmado en runtime**: sin `WASI_CORS_ORIGINS` en Render, un origen Vercel no recibe `Access-Control-Allow-Origin`. En producto hay bugs de alto ROI aún vivos: el `Select` convierte `value: ''` en `[object Object]` y vacía el catálogo; `PATCH` de alquiler acepta `$500k` (create sí lo rechaza); el catálogo sigue mostrando **Ganga $50/mes** porque el sanity-filter solo afecta el ranking home; no hay `ErrorBoundary`; el bundle de producción es un solo chunk de **664 kB**. SQLite sin `DATABASE_URL` en Render sigue siendo pérdida de datos en free tier. ML: Babilonia sigue descartada al 100% y `build_features_venta.py` importa un `geo_index` que ya no existe en esa ruta.

**Top 5 por ROI:** (1) CORS prod, (2) Select `[object Object]`, (3) tope precio en PATCH, (4) ErrorBoundary, (5) Ganga basura en catálogo / zone label.

---

## 2. Tabla priorizada (ROI = impacto ÷ esfuerzo)

| # | Área | Hallazgo | Severidad | Esfuerzo | Impacto | Evidencia (archivo:línea + runtime) |
|---|------|----------|-----------|----------|---------|-------------------------------------|
| 1 | F | `render.yaml` no define `WASI_CORS_ORIGINS` → frontend Vercel bloqueado por CORS | crítica | S | App “desplegada” inutilizable desde el browser | `render.yaml:15-21`; `main.py:57-65` default solo `localhost:5173,5500`. Runtime: `Origin: https://wasi-xxx.vercel.app` → sin ACAO; `Origin: http://localhost:5500` → `access-control-allow-origin: http://localhost:5500`. OPTIONS Vercel → `400 Disallowed CORS origin`. |
| 2 | B/A | `Select` con `value: ''` serializa `[object Object]` (Distrito “Todos” / Orden “Más recientes”) | alta | S | Re-elegir “Todos” o default de sort manda filtro basura → **0 resultados** | `components.jsx:159-161` (`o.value \|\| o`); `ListingsScreen.jsx:602,642-647`. Runtime DOM: ambas options y `select.value` = `[object Object]`. API: `district=[object Object]` → `X-Total-Count: 0`. |
| 3 | C | `ListingUpdateIn` no aplica tope por operación: PATCH alquiler acepta hasta $5M | alta | S | Precios absurdos, veredictos basura, contamina catálogo | `schemas.py:383-388` (`le=PRICE_MAX_VENTA`, sin validator por op); create sí valida (`schemas.py:375-379`). Runtime: create `$500k` alquiler → **422**; PATCH mismo listing → **200 / 500000.0**. |
| 4 | B | No existe `ErrorBoundary` | alta | S | Cualquier excepción de render = pantalla blanca | `main.jsx:9-12`; repo `web/src` sin `ErrorBoundary`/`componentDidCatch`. Plan de producción lo lista; Vite no lo añadió. |
| 5 | B/C | Catálogo etiqueta **Ganga $50/mes** (data sucia); sanity-filter solo ranking home | alta | S | Credibilidad: “ganga” imposible visible en Explorar | Runtime Explorar: card `Ganga $ 50 /mes … Jesus Maria`. API listing `id=3395`: `price_usd=50`, `zone=Ganga`, `fair_value_ref=879`. `_ganga_score` (`listings.py:45-54`) solo reordena `sort=ganga`; `_zone_label` no aplica el tope 45%. Sprint 1 cerró basura en **home**, no en zone del catálogo. |
| 6 | F | Sin `DATABASE_URL` en Render → SQLite efímero | crítica | M | Usuarios/listings/análisis se pierden en restart free | `render.yaml` sin DB; `database.py:15-19` default SQLite. Bitácora: Postgres pendiente. |
| 7 | A | Bundle monolítico ~664 kB, sin `manualChunks` / `React.lazy` | alta | M | TTI pobre en móvil/prod; Vite ya advierte >500 kB | `vite.config.js:5-7`; build: `index-UiahHw4V.js` **664.33 kB** (gzip 199.8). Deuda V6/V7 explícita. |
| 8 | C | Rate-limit incompleto: `explain`/`narrative`/`get_analysis`/`PATCH`/`favorites` sin límite | alta | S | DoS CPU/Groq; abuso de mutaciones | Con limit: predict/simulate/venta/cf + create/lead (Sprint 6). Sin limit: `fairvalue.py` explain/narrative/get_analysis; `listings.py` update/favorites. |
| 9 | B | Router en estado React: Back/F5 no restauran pantalla | alta | L | Pierde detalle/análisis; Back sale de la app | `App.jsx:86` `useState(screen)`; sin `pushState`/`popstate`. Runtime CDP: `history.state` vacío en Perfil. Sprint 11 T094 diferido. |
| 10 | C | `LeadIn` acepta teléfono sin dígitos (`abcdef`) | media | S | Leads inútiles a propietarios | `schemas.py:463-467` (solo `min_length`); ListingIn sí exige dígitos (`:351-356`). Runtime: lead `phone=abcdef` → **201**. |
| 11 | E | `image_url` admite `data:image/svg+xml` (superficie XSS) | media | S | SVG con script si se renderiza como HTML/img inseguro | `schemas.py:310-318` + `helpers.js:11-12`. Runtime PATCH SVG onload → **200** persistido. |
| 12 | G/F | CI Python **3.9** ≠ Render **3.11.9** | media | S | Tests verdes pueden mentir vs prod | `.github/workflows/ci.yml:21` vs `render.yaml:16-17`. |
| 13 | A | Fallback localhost API → `:8000` (UTEC Gym) si no hay `.env`/hash | media | S | Requests al backend equivocado | `base.js:29`. Localmente `.env` fija `:8001` (mitiga); sin él, falla silencioso. |
| 14 | B | Borrador publicar no restaura `operacion` | media | S | Draft venta → refresh vuelve a alquiler (rangos/modelo mal) | Persiste `{f,operacion}` (`PublishScreens.jsx:179-181`); restore solo `d.f` (`:144-147`); init `operacion='alquiler'` (`:136`). |
| 15 | B | UX que miente: campana + planes Pro sin flujo real | media | S | Expectativa de alertas/billing inexistentes | Notificaciones: copy de alertas (`components` modal). Perfil: `Probar 14 días` / `Ver planes` (`ProfileScreen.jsx:196,330`). Runtime: modal “Planes Wasi” / campana vacía con promesa. |
| 16 | D | Babilonia: 415/415 descartados (`cocheras` 100% NaN) | alta | M | Modelo venta sesgado a Infocasas | `clean_ventas.py` `.between()` excluye NaN; Sprint 9→10 no lo ejecutó. |
| 17 | D | `build_features_venta.py` importa `geo_index` muerto | alta | S | Re-entrenar venta desde repo falla | `ventas_model/build_features_venta.py:14-15` → `app/backend` + `from geo_index`; real en `src/wasi/features/geo_index.py`. Serving usa paquete `wasi`. |
| 18 | E | JWT en `localStorage` + logout solo cliente (sin revocación) | alta | L | XSS = sesión robada hasta `exp` | `client.js` token/logout; backend emite JWT sin blacklist. Sprint 6 deuda. |
| 19 | C | Enumeración de emails en registro (409 explícito) | media | M | Distingue cuentas existentes | `auth.py:24-26`. Runtime: `ana@wasi.pe` → **409** `"El correo ya está registrado"`. |
| 20 | E/B | FairValue: ráfaga ~6 llamadas + `get_analysis` re-infiere | media | M | Latencia/costo; peor con cold start Render | `FairValueScreens.jsx` multi-fetch; `fairvalue.py` get_analysis re-predict. Sprint 8 diferido. |
| 21 | C | `sort=ganga`/`zone` carga catálogo entero en memoria | media | M | ~3.4k rows/request; escala mal | `listings.py:237-255`. Sprint 9 deuda. |
| 22 | D | Cobertura P25–P75 ~42.7% sin conformal | media | M | Usuario sobreconfía en el rango | `models/v2/quantile_coverage.json`; UI lo muestra como intervalo. |
| 23 | D | Gates train↔serving forzados a v1 mientras prod es v2 | media | M | No validan el artefacto servido | `validate_pipeline.py` / `validate_build_features.py` `DPD_FORCE_V1=1`; health `model_mode:v2`. |
| 24 | B | `DashboardScreen` huérfano (`operaciones`) | media | S | Código muerto en el bundle; UI dashboard inalcanzable | `App.jsx:267-275`; ningún `onGo('operaciones')` desde nav/home. |
| 25 | A/B | Duplicación Counterfactual/MarketRange/POI + import listings→fairvalue | media | M | Drift + bloquea code-split limpio | `ListingsScreen.jsx:10` importa FairValue; paneles duplicados publish/listings. Deuda V5. |
| 26 | B | AbortController incompleto post-migración (home/listings/publish/leads) | media | M | Race `setState` al navegar rápido | AddressSearch sí aborta; Publish Nominatim / Home / Listings load no. |
| 27 | B | Tras cambio de rol, `screen` puede quedar huérfana | media | S | Nav sin tab activa (Inquilino en Explorar → Propietario) | `App.jsx` `onUserChanged` solo `userVersion`; Sprint 4 QA manual. |
| 28 | B | Dark mode residual (stepper/chips superficies claras) | media | S | Contraste pobre en tema oscuro | `styles.css` overrides parciales vs chips `oklch` claros. Sprint 0 parcial. |
| 29 | D | Amenities `0` = “no tiene” vs “no reportado” (MNAR) | media | L | Sesgo sistemático | `ml_v2.py` chips→0; T012 documentado. |
| 30 | D | Sesgo Jensen: `expm1` naive (alquiler/venta) | media | M | Sobreestima USD típica | `model_service.py` / `venta_service.py` invert log. |
| 31 | C | `ensure_schema` ad-hoc; `except: pass` en ALTER PG | baja | M | Migraciones futuras frágiles; sin CI Postgres | `database.py:75-111`. |
| 32 | D | 33/101 features importancia 0 | baja | M | Deuda de poda; no bug serving inmediato | Artefacto v2 joblib (runtime conteo). |
| 33 | E | Sin índices compuestos en filtros de listings | baja | S | Filters más caros al crecer | `models.py` Listing: FKs sí, filtros status/operacion/district no. |
| 34 | A | Fuentes Google CDN (no self-host) | baja | S | FOIT / falla offline | `index.html` fonts.googleapis. |
| 35 | A | Contención global `_leaflet_pos` | baja | S | Puede enmascarar errores no relacionados | `App.jsx:100-106`; deuda V6. |
| 36 | G | Huecos de tests (CORS, tope PATCH, Lead phone, rate-limit, venta features path) | media | M | Regresiones de seguridad/negocio pasan CI | Suite fuerte en create/listings; bordes de esta auditoría sin test. |

---

## 3. Quick wins (esfuerzo S, impacto alto)

1. **Agregar `WASI_CORS_ORIGINS`** al blueprint Render (+ dashboard) con el dominio Vercel real.  
2. **Arreglar `Select`**: `value={o.value ?? ''}` / key estable — nunca `o.value || o`.  
3. **Tope de precio en `ListingUpdateIn`** según `operacion` del listing existente (misma regla que create).  
4. **`ErrorBoundary`** en `main.jsx` con UI de recuperación.  
5. **Zone/catálogo**: no etiquetar Ganga si descuento > 45% (o ocultar/flaggear data sucia); alinear con `_ganga_score`.  
6. Rate-limit en `explain`/`narrative`/`PATCH` listings.  
7. Validar dígitos en `LeadIn.phone`; restringir `data:image` a raster (jpeg/png/webp).  
8. CI `python-version: "3.11.9"`; default `base.js` localhost → `:8001`.  
9. Restaurar `operacion` del draft; ocultar/etiquetar campana y planes como “próximamente”.

---

## 4. Lo que se verificó en runtime

| Flujo | Resultado |
|-------|-----------|
| Backend `GET /api/health` | 200, `model_mode:v2`, `venta_model_loaded:true` |
| CORS Origin Vercel vs localhost:5500 | Vercel sin ACAO; 5500 con ACAO |
| Registro email existente | 409 enumeración |
| Create alquiler `$500k` | 422 tope OK |
| PATCH alquiler `$500k` | 200 / `500000` **BUG** |
| Lead `phone=abcdef` | 201 **BUG** |
| PATCH `image_url` SVG | 200 **BUG** |
| `npm run build` | OK, chunk **664.33 kB**, warning Vite |
| Leaflet markers en build | 3× `data:image/png;base64` inlined + `mergeOptions` en `map-components.jsx` — **NO hay 404 de pines** (regresión migrada bien) |
| Browser splash + `#api8001` | Render OK |
| Sesión inyectada (Inquilino) → Home | Nav rol OK, mapa distritos, gangas, stats 3348/29/16.4% |
| Explorar alquiler | Cards + mapa; **Ganga $50**; Select `[object Object]`; favoritos UI presente |
| Campana notificaciones | Modal con promesa de alertas (sin backend) |
| FairValue wizard pasos 1→2→3 | UI OK; botón calcular requiere precio (no se completó e2e UI por límites de fill; API `simulate`/`predict` OK → fair_value≈927, zone Justo) |
| Perfil + Ver planes | Modal “Planes Wasi” decorativo |
| History state | Sin `history.state.screen` |
| Usuarios de prueba | Creados por API (`audit_*@wasi.pe`); listing de prueba borrado tras PATCH. **No hay DELETE de users.** |

**Solo lectura (sin runtime completo de UI):** dark mode contraste fino, publish foto HEIC, venta wizard e2e, counterfactuals slider, SHAP expand, responsive 360px táctil, Postgres real.

---

## 5. Lo que NO se debe tocar (sin decisión explícita)

- **Artefacto `modelo_final_v2.joblib` / contrato FairValue** — golden predictions y validaciones de arranque; regenerar sin necesidad rompe el piso.  
- **MAPE / validación espacial** — ya respaldada y documentada; no reabrir.  
- **Reescritura a microservicios / cambiar bundler** — stack decidido (monolito modular + Vite).  
- **Borrar `app/` legacy** — cutover V7 dejó cleanup pendiente de confirmación humana.  
- **Cambiar umbral de zona 8%** sin alinear front/back/tests.

---

## 6. Preguntas para el humano

1. ¿Cuál es el dominio Vercel exacto a poner en `WASI_CORS_ORIGINS` (y staging)?  
2. ¿Se aprueba Postgres en Render ahora, o se acepta SQLite efímero un ciclo más?  
3. ¿Planes Pro / campana: ocultar, etiquetar “próximamente”, o implementar alertas reales?  
4. ¿Prioridad code-split (TTI) vs History API (Back/F5) vs hardening CORS+PATCH en el primer lote?  
5. ¿Se confirma borrar `app/` legacy tras estabilizar Vite en prod?  
6. Usuarios `audit_*` / `ana@wasi.pe` de QA: ¿limpiar a mano de la BD local?

---

## 7. Nota de cierre Fase 1

**Detener aquí.** No se escribió código de fixes. Pedir aprobación del lote a corregir; en fase 2: lotes pequeños, `pytest` (piso 170/2) tras cada uno, y bitácora en `docs/BITACORA_FORMS.md`.

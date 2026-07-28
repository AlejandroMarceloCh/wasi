# T040 — Rate limit: cobertura de endpoints

**TARGET:** `app/backend/ratelimit.py` + decoradores en routers  
**LENTE:** cobertura  
**Fecha:** 2026-07-06

---

## Resumen

Solo `POST /api/auth/register` (10/min) y `POST /api/auth/login` (5/min) tienen `@limiter.limit`. El resto de la API — incluyendo ML costoso y creación de leads — queda sin protección. `WASI_RATELIMIT=0` desactiva todo (usado en tests).

---

## Hallazgos

### [ALTO] · Endpoints FairValue ML sin rate-limit · `routers/fairvalue.py:85,146,169,216` — `predict`, `simulate`, `predict-venta`, `counterfactual` sin decorador. · Abuso: miles de inferencias XGBoost por IP autenticada → CPU/RAM y posible DoS. · `@limiter.limit("30/minute")` por usuario/IP; cola o cache para `simulate`.

### [ALTO] · `POST /listings/{id}/leads` sin rate-limit · `routers/listings.py:365` — creación de lead libre. · Spam de consultas a propietarios (harassment / inbox flood). · `5/minute` por IP + `20/hour` por listing_id.

### [MEDIO] · Narrativas Groq sin rate-limit · `routers/fairvalue.py:401,493` — `narrative`, `narrative/detailed` llaman API externa si hay key. · Agota cuota Groq (14.4k/día free) y genera costo. · `10/minute` por usuario; fallback template sin LLM.

### [MEDIO] · `POST /api/listings` (publicar) sin rate-limit · `routers/listings.py:279`. · Usuario autenticado puede inundar catálogo con miles de avisos. · `10/hour` por owner_id.

### [MEDIO] · `PATCH /api/me` y registro de favoritos sin límite · `routers/auth.py:104`, `listings.py:421`. · Menor impacto; aún abusable. · Límites moderados (60/min).

### [INFO] · Auth login/register limitados · `routers/auth.py:20,49` — 10/min y 5/min por IP. · Mitiga brute-force y registro masivo. · OK.

### [INFO] · Infra slowapi cableada en main · `main.py:54-55`, `ratelimit.py:14` — handler 429; frontend parsea `error` (Sprint 0). · OK donde hay decorador.

### [INFO] · Desactivación global en tests · `ratelimit.py:12-14`, `conftest.py:25`. · Necesario para pytest. · OK.

### [BAJO] · Catálogo GET `/listings` sin límite · `routers/listings.py:174`. · Lectura cacheable; riesgo bajo salvo scraping agresivo. · CDN o `100/min` en prod.

---

## Endpoints sin rate-limit (prioridad sugerida)

| Endpoint | Riesgo | Límite sugerido |
|----------|--------|-----------------|
| `POST /fairvalue/predict` | ALTO (ML + persist) | 30/min IP |
| `POST /fairvalue/simulate` | ALTO (ML) | 60/min IP |
| `POST /fairvalue/predict-venta` | ALTO | 30/min IP |
| `POST /listings/{id}/leads` | ALTO (spam) | 5/min IP |
| `GET /fairvalue/narrative/*` | MEDIO (Groq) | 10/min user |
| `POST /listings` | MEDIO | 10/hour user |
| Resto autenticado | BAJO | 120/min IP |

---

## Veredicto

Cobertura mínima (solo auth). Prioridad ROI: limitar `predict`/`simulate` y `create_lead`.

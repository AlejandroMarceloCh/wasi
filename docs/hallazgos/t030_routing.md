# T030 — Routing: registro de rutas y prefijos

**TARGET:** `app/backend/routers/__init__.py` + `main.py` include  
**LENTE:** routing  
**Fecha:** 2026-07-06

---

## Resumen

Los seis routers están registrados en `main.py`. Prefijos `/api` consistentes salvo auth en `/api/auth`. Hay endpoints públicos sin auth mezclados en routers autenticados.

---

## Hallazgos

### [INFO] · Todos los routers incluidos · `main.py:67-73` — auth (+ me_router), dashboard, fairvalue, entorno, health, listings. · `__init__.py` vacío (solo barrel implícito vía imports directos). · OK.

### [INFO] · Mapa de prefijos · ver tabla abajo. · Frontend `api.js` alinea paths. · OK.

| Router | Prefijo | Ejemplos |
|--------|---------|----------|
| auth | `/api/auth` | register, login |
| me (auth) | `/api` | GET/PATCH `/me` |
| dashboard | `/api` | `/dashboard` |
| fairvalue | `/api` | `/fairvalue/*`, `/analyses/*` |
| entorno | `/api/entorno` | `""`, `/pois` |
| health | `/api` | `/health`, `/model/info`, `/distritos-zona` |
| listings | `/api` | `/listings/*`, `/leads`, `/favorites/*` |

### [MEDIO] · Endpoints sin auth en routers mayormente autenticados · `fairvalue.py:677-687` (`GET /fairvalue/poi-importance`), `health.py:72-78,80-91,93-118`. · Diseño intencional para datos estáticos y probes. · Documentar en OpenAPI `security=[]`; evitar filtrar datos sensibles en futuros endpoints públicos.

### [INFO] · Orden de rutas listings correcto · `listings.py:174,270,335` — `/listings/mine` antes de `/listings/{id}`; `/leads` agregado separado. · Sin colisión de paths. · OK.

### [BAJO] · `me_router` separado de `router` en auth · `auth.py:17,59` — dos `APIRouter` por histórico de tags. · Funciona; leve complejidad. · Opcional: unificar bajo un solo router.

### [INFO] · CORS y rate-limit globales · `main.py:54-55,57-65`. · No afecta registro de rutas. · OK.

### [INFO] · Root `/` fuera de routers · `main.py:75-81` — metadata de servicio. · OK.

---

## Veredicto

**Registro completo y prefijos alineados con el frontend.** Sin rutas huérfanas detectadas en backend.

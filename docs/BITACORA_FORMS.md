# Bitácora — Wasi a nivel producción

Memoria histórica del trabajo por Sprints sobre los hallazgos de
`AUDITORIA_INTEGRAL_2026-07-05.md`. Cada entrada sobrevive a un compact.

Piso de calidad permanente: **pytest ≥157 passed, 2 skipped. Cero regresiones.**

---

## Sprint 0 — Cimientos — 2026-07-06
- **Sprint Goal:** que los errores del backend se entiendan, que el frontend hable siempre con SU backend, y que las fechas no salgan corridas. Cerrar los CSS rotos que afean toda la app.
- **Qué se cambió:**
  - `app/api.js` — parser `humanizeError()`: traduce el array de detail de los 422 de Pydantic a mensajes en español por campo (antes se mostraba `[object Object]`); maneja `{error}` de slowapi (429), y fallbacks por status (401/403/404/429/5xx). Mata el bug convergente citado por los 4 auditores.
  - `app/api.js` + `app/index.html` — la base del API elegida con `#api8001`/`#api8000` se persiste en `localStorage` (`wasi.apibase`); un refresh o link sin hash ya no manda requests al backend equivocado (UTEC Gym en :8000).
  - `app/backend/schemas.py` — `_iso_utc()` + `field_serializer` en `MeOut.last_activity_at`, `ListingOut.created_at`, `LeadOut.created_at`: emiten UTC con sufijo `Z`. Antes `new Date()` los leía como hora local → leads/publicaciones +5h en el futuro.
  - `app/styles.css` — agregado `.stack-8` (usado en comparables/seguridad, no existía); bloque `[data-theme="dark"]` para `.wizard-card`, `.bc-card`, `.home-module-mock`, `.home-howit`, `.hero-mock-card.fair` (tenían gradiente claro hardcodeado → texto casi blanco ilegible en dark).
  - `app/screens-fairvalue.jsx` — `banner warning` → `banner warn` (la clase real; los warnings del modelo se veían sin fondo).
  - `app/screens-home.jsx` — `var(--muted)`→`var(--ink-3)`, `var(--border)`→`var(--line)` (vars inexistentes introducidas en el link "Ver trailer").
  - Higiene: movidos 5 `.md` de auditoría fuera de `src/wasi/` a `docs/`; usuarios QA residuales borrados de `wasi.db`.
- **Decisiones técnicas:** el parser vive en el frontend (`api.js`) porque es el único punto por el que pasan TODAS las respuestas; así ninguna pantalla necesita saber de la forma del error. Los serializers UTC se pusieron por-schema (no un middleware) para no tocar el contrato congelado de FairValue.
- **Resultados de QA:** pytest 157 passed / 2 skipped (sin regresiones tras tocar schemas). Verificado en vivo: `created_at = 2026-07-06T20:13:14Z` (con Z); 422 de password corto llega como array parseable; `#api8001` persiste en localStorage.
- **Riesgos / deuda aceptada:** el mensaje de los `value_error` propios del backend aún nombra el campo en inglés dentro del texto ("name debe tener…") — es el texto del validator del backend, se pulirá en Sprint 4 con el resto de copy de auth.
- **Estado:** CERRADO ✅

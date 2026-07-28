# Plan de sprints — Puesta en producción (Wasi)

**Contexto:** el producto ya está a nivel producción en código (12 sprints cerrados,
170 tests verdes, frontend migrado a Vite, ML validado y reproducible). Lo que
falta es que **funcione desplegado de verdad** y cerrar la deuda menor.

**Continúa** la numeración de `docs/BITACORA_FORMS.md`. Rama de trabajo:
`refactor/modular` (26 commits sin pushear).

---

## Reglas innegociables (TODOS los sprints)

### Regla 1 — Sprint Goal
Cada sprint define **un objetivo central concreto y verificable**. NO se cierra
"porque pasó el tiempo": se cierra **solo cuando el Goal está cumplido y
demostrado con evidencia** (comando corrido, endpoint respondiendo, screenshot).
Si el objetivo no se cumplió, el sprint sigue abierto.

### Regla 2 — Protocolo Anticagadas (QA profundo con Sonnet)
Antes de cerrar cada sprint:

1. **Tests automáticos:**
   ```bash
   WASI_RATELIMIT=0 WASI_SKIP_BULK_SEED=1 app/backend/venv/bin/python -m pytest app/backend/tests/ -q
   ```
   Piso: **170 passed, 2 skipped**. Cero regresiones. Tests nuevos para lo nuevo.
2. **Verificación en vivo del entorno tocado.** Si el sprint toca producción, se
   verifica **contra producción** (no solo local): la app desplegada debe hacer
   login, listar y predecir de verdad.
3. **Agentes Sonnet de regresión** (uno por área tocada, en paralelo). Prompt:
   > *"Eres QA senior. Revisa TODO lo que cambió en el Sprint N (te doy el diff:
   > `git diff <commit_inicio>..HEAD --name-only`). Tarea: (a) verificar que los
   > cambios hacen lo que dicen; (b) pruebas de **regresión** sobre los flujos
   > ANTIGUOS que podrían haberse roto — auth, catálogo, publicar, FairValue,
   > leads, favoritos; (c) buscar efectos colaterales no previstos (config de
   > deploy, variables de entorno, migraciones, contratos front↔back). Reporta
   > cada riesgo con archivo:línea y cómo reproducirlo. NO cambies código.
   > Español peruano neutro."*

   Repartir por área: un agente **backend/DB**, uno **frontend/deploy**, uno de
   **regresión de flujos e2e**. El orquestador consolida.
4. **Corregir todo hallazgo antes de cerrar.** Sprint con hallazgos abiertos NO
   se cierra.

### Regla 3 — Guardado de progreso (bitácora = memoria del proyecto)
Al cerrar cada sprint, **append** a `docs/BITACORA_FORMS.md` con este formato
(pensado para sobrevivir a un autocompact):

```
## Sprint N — <título> — <fecha>
- **Sprint Goal:** <objetivo cumplido>
- **Qué se cambió:** <archivos y qué en cada uno>
- **Decisiones técnicas:** <por qué así; alternativas descartadas>
- **Resultados de QA:** <pytest X/Y · verificación en vivo (con evidencia) ·
  hallazgos de los agentes Sonnet y cómo se resolvieron>
- **Riesgos / deuda aceptada:** <lo diferido y por qué es seguro>
- **Estado:** CERRADO ✅
```

### Restricciones
- No commitear a `main` sin aprobación explícita del usuario.
- Migraciones de DB retrocompatibles (hay ~3,300 listings sembrados).
- No romper el contrato congelado de FairValue (`PredictIn/PredictOut`).
- Secretos (JWT_SECRET, GROQ_API_KEY, DATABASE_URL) **nunca** en el repo:
  van en el dashboard de Render (`sync: false`).

---

## Sprint 12 — Desbloquear producción  ·  🔴 CRÍTICO  ·  esfuerzo S
**Sprint Goal:** que la app **desplegada** funcione de verdad — el frontend de
Vercel puede hablarle al backend de Render y un usuario real puede registrarse,
explorar y estimar un precio en producción.

**Problema:** `render.yaml` no define `WASI_CORS_ORIGINS`. El default del backend
solo permite `localhost`, así que el frontend de Vercel queda **bloqueado por
CORS**. Hoy la app en producción no puede llamar al API.

**Alcance:**
1. Agregar `WASI_CORS_ORIGINS` a `render.yaml` con el dominio de Vercel (y
   `sync: false` si se prefiere gestionarlo por dashboard).
2. Confirmar/setear `VITE_API_BASE` en Vercel apuntando al backend de Render
   (hoy hay un fallback hardcodeado en `web/src/shared/api/base.js` — decidir si
   se deja o se mueve 100% a env var).
3. Re-desplegar backend y frontend.

**Evidencia de cierre (obligatoria):** desde el **dominio de producción** de
Vercel: registrarse → login → abrir Explorar (lista avisos) → correr una
estimación en FairValue. Todo sin errores de CORS en consola.

---

## Sprint 13 — Persistencia real (Postgres)  ·  🔴 CRÍTICO  ·  esfuerzo M
**Sprint Goal:** que los datos **sobrevivan a un reinicio** del servicio.

**Problema:** SQLite en el free tier de Render es **efímero** — cada redeploy o
reinicio borra usuarios, publicaciones y leads.

**Alcance:**
1. **[Acción del usuario]** Provisionar Postgres en el dashboard de Render y
   obtener el `DATABASE_URL`.
2. Cargar `DATABASE_URL` como env var (`sync: false`) — el backend ya lo soporta
   vía `database.py`.
3. Verificar que `ensure_schema()` corre correctamente contra Postgres (la
   migración de `operacion` y el `ALTER image_url TYPE TEXT` ya están escritos
   para Postgres, pero **nunca se probaron contra Postgres real**).
4. Sembrar el catálogo en la DB nueva (`WASI_ENABLE_DEMO_SEED`).

**Evidencia de cierre:** publicar un inmueble en producción → **reiniciar el
servicio** → el inmueble sigue ahí. Confirmar que la foto base64 (`image_url`
TEXT) guarda sin error en Postgres (esto era una bomba conocida).

---

## Sprint 14 — Release: push y merge a main  ·  esfuerzo S
**Sprint Goal:** que `main` refleje el estado real del producto y el deploy salga
de ahí.

**Alcance:**
1. Pushear `refactor/modular` (26 commits locales).
2. **[Decisión del usuario]** Merge a `main` (repo compartido con Leo; dispara el
   deploy de producción).
3. Verificar que el deploy automático desde `main` funciona (backend y frontend).

**Evidencia de cierre:** producción corriendo desde `main`, con los checks del
Sprint 12 pasando.

**Nota:** el diff a main es grande (~150 archivos: migración modular + 12 sprints
+ Vite). Coordinar con Leo antes de mergear.

---

## Sprint 15 — Deuda técnica menor  ·  esfuerzo M
**Sprint Goal:** cerrar la deuda documentada que no bloquea pero degrada la
experiencia.

**Alcance (por ROI):**
1. **Code-splitting** del bundle de Vite (658 kB en un solo chunk; `manualChunks`
   para separar Leaflet/d3/React → mejor TTI en móvil).
2. **Historial del navegador**: hoy la navegación es 100% por estado React — el
   botón Atrás sale de la app y F5 pierde la pantalla. Integrar con la History
   API (o un router) sin romper los flujos.
3. **ErrorBoundary** global (una excepción de render = pantalla blanca hoy).
4. Pausa del carrusel del hero (WCAG 2.2.2) y contraste de textos de 11 px.
5. Limpieza de código muerto (`DashboardScreen` huérfano si sigue).

---

## Sprint 16 — Features de producto pendientes  ·  esfuerzo M/L  ·  opcional
**Sprint Goal:** cerrar los huecos de producto que un usuario real espera.

**Alcance:**
1. **Recuperación de contraseña** (requiere email transaccional: Resend/SendGrid).
2. **Verificación de email** (cierra además la enumeración de emails del registro,
   T022, que hoy solo está mitigada con rate-limit).
3. Decidir sobre la funcionalidad decorativa: campana de notificaciones vacía y
   planes de pago sin flujo → **implementar u ocultar** (hoy prometen algo que no
   existe).

---

## Orden y cadencia
**12 → 13 → 14** son la ruta crítica a "producto vivo y confiable". **15 y 16**
son mejora continua.

Sprints 12 y 13 tienen **acciones del usuario** (dashboard de Render): el sprint
no se cierra hasta que esas acciones estén hechas y verificadas en vivo.

Cada sprint: Goal → cambios → **pytest** → **verificación en producción** →
**Protocolo Anticagadas (Sonnet)** → **bitácora** → commit.

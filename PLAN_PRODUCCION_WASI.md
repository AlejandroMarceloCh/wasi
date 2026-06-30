# PLAN MAESTRO — WASI a PRODUCCIÓN (post-auditoría 40 agentes · 2026-06-30)

> Une **Canasta 1** (cerrar el curso DS3022) + **Canasta 2** (llevar a producción real).
> Fuente C2: auditoría de 40 agentes Sonnet → 386 hallazgos crudos → 10 P0 / 15 P1 / 20 P2-P3.
> Score actual de producción: **D**. Meta: **A**.
> Protocolo: pasito a pasito. Cerrar un paso → marcar acá → validar con Alejandro → siguiente.

---

## 0. ESTADO DE EJECUCIÓN

| Fase | Paso | Estado | Cierre | Notas |
|------|------|--------|--------|-------|
| 0 | 0.1 Quitar amenities del simulador | ✅ | 2026-06-30 | `compute_counterfactuals_full` ya no emite palancas `amenity:*`. Test actualizado. 134 passed |
| 0 | 0.2 Commit sprints 1-6 + planes | ⬜ | | 18 mod + 3 nuevos sin commit |
| 1 | 1.1 Secrets (GROQ rotar, JWT fuerte, .env.example) | ⬜ | | P0-1 |
| 1 | 1.2 fair_value_ref server-side (anti-fraude) | ⬜ | | P0-7 |
| 1 | 1.3 Rate limiting (slowapi) | ⬜ | | P0-8 |
| 1 | 1.4 CORS desde env var | ⬜ | | P1 |
| 1 | 1.5 Handler global de excepciones | ⬜ | | P1 |
| 1 | 1.6 SSRF en image_url | ⬜ | | P1 |
| 1 | 1.7 Quitar credenciales demo del login | ⬜ | | P1 |
| 2 | 2.1 PATCH /listings (editar + status) | ⬜ | | P0-9 |
| 2 | 2.2 Upload de fotos real (R2/S3) | ⬜ | | P0-6 |
| 2 | 2.3 URL routing (History API) | ⬜ | | P0-5 |
| 3 | 3.1 SQLite → PostgreSQL | ⬜ | | P0-2. Render free borra el disco |
| 3 | 3.2 CI/CD (.github/workflows + pytest) | ⬜ | | P0-3 |
| 3 | 3.3 React prod builds (rápido) → Vite | ⬜ | | P0-4 |
| 3 | 3.4 Sentry + /health + error tracking | ⬜ | | P0-10 |
| 4 | P1 hardening (lote) | ⬜ | | 15 P1, ver §3 |

Estados: ⬜ pendiente · 🔄 en curso · ✅ cerrado · ⚠️ cerrado-con-deuda

---

## 1. POR QUÉ ESTE ORDEN (dependencias)

- **Fase 0 primero**: cierra el curso y deja el árbol limpio para empezar producción sobre base commiteada.
- **Fase 1 antes que infra**: los fixes de seguridad son baratos (líneas, no migraciones) y son los más graves (credenciales, fraude, DoS). Cero riesgo de romper la demo.
- **Fase 2 (funcionalidad)**: editar listing, fotos y URL routing son lo que un usuario real toca. Dependen de la base de Fase 1 (auth/validación sólida).
- **Fase 3 (infra) al final**: Postgres + CI + Vite son los más pesados y arriesgados. Se hacen cuando seguridad y features ya están firmes, para no migrar dos veces.
- **Fase 4**: hardening fino una vez que el esqueleto aguanta.

---

## 2. CANASTA 1 — Cierre de curso (Fase 0)

### Paso 0.1 — Quitar amenities del simulador what-if
- **Por qué**: amenities = 0.97% del modelo; mostrarlas como palanca implica que mueven el precio, y a veces dan delta negativo (no-monotonicidad por peso bajo + confounding con distrito). Decisión: **no mostrarlas como lever** (Opción 3). Siguen alimentando la predicción base.
- **Dónde**: `screens-fairvalue.jsx` (WhatIfSimulator) + `ml.py compute_counterfactuals` (no emitir specs de amenities).
- **Done**: el simulador solo muestra área/dormitorios/baños/cocheras/antigüedad. Test de counterfactuals sigue verde.
- **Narrativa informe**: el efecto de amenities está correlacionado con ubicación (confounding); el distrito (56%) lo absorbe. NO es "data sucia" — correlaciones crudas son positivas (walk-in r=+0.275). Esto es defendible.

### Paso 0.2 — Commit de todo
- 18 archivos modificados (sprints 1-6) + `PLAN_SPRINTS_WASI.md`, `FEEDBACK_AUDIT_WASI.md`, `test_ml_leakage.py`, este plan, `AUDITORIA_PRODUCCION_WASI.md`.
- Sin trailer Co-Authored-By. Esperar "dale" antes de push.

---

## 3. CANASTA 2 — Producción (Fases 1-4)

Ver tabla §0 para el desglose. Detalle de cada P0/P1 en `AUDITORIA_PRODUCCION_WASI.md`.

**Fase 1 — Seguridad e integridad (barato, crítico):** 1.1-1.7
**Fase 2 — Funcionalidad faltante:** 2.1-2.3
**Fase 3 — Infraestructura:** 3.1-3.4
**Fase 4 — Hardening P1:** revocación JWT · índices DB (status, district, owner_id, created_at) · N+1 en LeadsScreen (GET /leads con JOIN) · paginación real · cambio+recuperación de contraseña · DELETE cuenta (Ley 29733) · db.commit try/except+rollback · Groq timeout · batch de 14 predict() · warning de leak persistido · MeOut.last_activity_at Optional · CounterfactualIn valida dormitorios=0.

---

## 4. REPARTO CON LEO (lmontoyas)

- Sugerencia: Leo toma **Fase 3.1 (Postgres)** y **3.2 (CI)** en paralelo (infra, aislado del frontend).
- Alejandro + yo: Fases 0, 1, 2 (seguridad + features + UX).
- Confirmar con Alejandro antes de asignar.

---

## 5. GATE DE PRODUCCIÓN (cierre C2)
- [ ] Sin secretos en repo ni en archivos locales (rotados + en vault de Render).
- [ ] CI verde obligatorio antes de cada deploy.
- [ ] Postgres con backup automático (pg_dump cron).
- [ ] Rate limiting activo en login/register/predict.
- [ ] fair_value_ref calculado server-side (no inyectable).
- [ ] Lighthouse mobile > 70 (post-Vite).
- [ ] Sentry capturando errores front + back.
- [ ] Score re-auditado ≥ B.

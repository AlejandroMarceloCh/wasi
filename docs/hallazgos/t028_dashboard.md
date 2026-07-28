# T028 — Dashboard: correctitud y código muerto

**TARGET:** `app/backend/routers/dashboard.py`  
**LENTE:** correctitud  
**Fecha:** 2026-07-06

---

## Resumen

El endpoint `/api/dashboard` responde datos coherentes y está cubierto por tests de integración. La pantalla frontend que lo consume (`DashboardScreen`) quedó **inalcanzable** tras Sprint 3.

---

## Hallazgos

### [ALTO] · UI del dashboard inalcanzable (código muerto frontend) · `app.jsx:181-189` — `screen === 'operaciones'` renderiza `DashboardScreen`, pero `TAB_TO_SCREEN` no incluye `operaciones` y ningún `onGo` navega ahí (Sprint 3 removió CTA). · Usuarios nunca ven stats, cobertura, next_step ni modal de análisis recientes del dashboard. · Re-enlazar tab Inicio a `DashboardScreen` o fusionar widgets en `HomeScreen`; eliminar ruta huérfana.

### [INFO] · Endpoint backend funcional · `dashboard.py:32-103` — stats, recent (6), coverage, next_step. · `test_integration` lo ejerce. · API OK aunque UI no llegue.

### [INFO] · Conteos alineados con `/me` · `dashboard.py:35-40` vs `auth.py:67-72` — misma query. · Perfil muestra analyses/reports; dashboard duplica en `stats`. · OK para consistencia.

### [MEDIO] · `avg_savings` solo promedia análisis zona Inflado · `dashboard.py:41-44` — `Analysis.zone == "Inflado"`. · Stat puede ser 0 con muchos análisis Justo/Ganga; etiqueta "Ahorro promedio" confusa. · Renombrar a "Sobreprecio medio detectado" o incluir todos con signo.

### [INFO] · `next_step` = inflado no guardado con mayor |diff| · `dashboard.py:73-90` — outerjoin Report.id IS NULL. · Lógica de producto razonable. · OK.

### [INFO] · `last_activity_at` como string relativo · `dashboard.py:102` — `_time_ago`. · Distinto de `/me` que emite ISO UTC (Sprint 0). · Contrato dual pero cada consumidor usa su formato.

### [BAJO] · Cobertura desde tabla `District` estática · `dashboard.py:67-71` — no refleja catálogo live. · Widget informativo, puede desincronizar del mapa home. · Refresh periódico o derivar de listings activos.

---

## Veredicto

**Backend dashboard correcto; producto roto por desconexión UI.** Mayor ROI: recuperar navegación o portar métricas al home actual.

# T094 — app.jsx: navegación (estado, historial, F5, back)

**TARGET:** `app/app.jsx`  
**LENTE:** navegación  
**Fecha:** 2026-07-06

---

## Resumen

La app usa navegación por estado React (`screen`) sin URL ni History API. Funciona para el demo SPA, pero el back del navegador, F5 y pantallas “overlay” generan fricción real. Los arreglos de `entornoReturn` y `userVersion` (Sprints 3–4) ya no se re-reportan.

---

## Hallazgos

### [ALTO] · Sin sincronía con el historial del navegador · `app.jsx:53-76,295` — no hay `popstate`, `pushState` ni hash de pantalla. · Botón **Atrás** del celular/Chrome sale de Wasi o salta a la página anterior del sitio; no vuelve de detalle → catálogo ni de resultado → formulario. · Mapear `screen` + ids (`listing`, `analysis`) a `history.pushState` y restaurar en `popstate`.

### [ALTO] · F5 reinicia contexto de pantalla · `app.jsx:53` — estado inicial `computeRoleHome()` o `splash`; no se persiste `screen`, `currentListingId`, `currentAnalysisId`, `fvPrefill`. · Usuario en detalle de aviso o resultado FairValue recarga y cae en inicio/mis-propiedades perdiendo el hilo. · Persistir ruta mínima en `sessionStorage` o URL.

### [ALTO] · Pantallas overlay sin tab activo coherente · `app.jsx:13-24,145,114-118` — `SCREEN_TO_TAB` devuelve `null` para `publish`, `listing-detail`, `fairvalue-result`, `entorno-map`. · En móvil el bottom-nav puede marcar ninguna pestaña o una incorrecta mientras el usuario está en flujos críticos (publicar, contactar, ver SHAP). · Extender `SCREEN_TO_TAB` con reglas padre (detalle → explorar; resultado → analizar).

### [MEDIO] · `DashboardScreen` sigue huérfano · `app.jsx:181-189` — `screen === 'operaciones'` renderiza dashboard, pero ningún `onGo`/`TAB_TO_SCREEN` llega ahí (ver T028). · Métricas de `/api/dashboard` inaccesibles; código muerto que confunde auditorías de nav. · Eliminar ruta o re-enlazar “Inicio” vendedor al dashboard.

### [MEDIO] · Post-publicar no abre el aviso creado · `app.jsx:249` — `onPublished` fuerza `mis-publicaciones`, no `listing-detail` con el `id` nuevo. · El vendedor no ve confirmación visual del aviso publicado ni el veredicto en contexto; tiene que buscarlo en la lista. · `onPublished(id)` → `onOpenListing(id)` o detalle con toast “Publicado”.

### [MEDIO] · Tab huérfano tras cambio de rol · `app.jsx:150-157,286` — `userVersion` actualiza tabs, pero si un Inquilino estaba en `explorar` y pasa a Propietario, `activeTab` puede quedar `explorar` (tab inexistente en nav vendedor). · Sprint 4 lo dejó como QA manual; en código sigue posible. · Al cambiar rol, `setScreen(roleHome)` si `SCREEN_TO_TAB(screen)` no aplica al nuevo rol.

### [BAJO] · `fairvalue-result` siempre vuelve al formulario · `app.jsx:208` — `onBack={() => setScreen('fairvalue-form')}` ignora si llegaste desde detalle de listing o home. · Back lógico debería usar pila o `detailReturn` análogo. · Guardar `fvReturn` como `entornoReturn`.

### [BAJO] · `ErrorBanner` global no tiene `role="alert"` ni `aria-live` · `app.jsx:28-42` — errores de API visibles pero fáciles de perder para lectores de pantalla. · Añadir `role="alert"` (deuda a11y Sprint 5).

### [INFO] · `entornoReturn` desde home/resultado · Sprint 3. · No re-reportar.

### [INFO] · `userVersion` tras editar perfil · Sprint 4. · No re-reportar.

### [INFO] · CTA “Operaciones” eliminado del home · Sprint 3. · No re-reportar.

---

## Top 3 ROI

1. **History API mínima** (screen + ids en URL) — arregla back del navegador y F5 de un solo golpe.
2. **Tabs coherentes en overlays** — el bottom-nav deja de mentir en publicar/detalle/análisis.
3. **Post-publicar → detalle del aviso** — cierra el loop emocional del vendedor sin buscar en la lista.

---

## Veredicto

La navegación interna por botones Wasi es usable; la del **navegador** y la **recarga** no. Es la deuda SPA más visible antes de producción real.

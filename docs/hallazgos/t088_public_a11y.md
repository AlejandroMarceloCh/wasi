# T088 — Public: a11y y responsive (anchors sin href, foco, móvil)

**TARGET:** `app/screens-public.jsx` + `app/components.jsx` + `app/styles.css`  
**LENTE:** a11y-responsive  
**Fecha:** 2026-07-06

---

## Resumen

Sprint 5 añadió foco visible global. En flujos públicos persisten enlaces falsos (`<a>` sin `href`), tabs de auth sin roles ARIA completos, y layout auth que prioriza marketing sobre el formulario en viewports pequeños.

---

## Hallazgos

### [ALTO] · Enlace “Regístrate / Inicia sesión” sin `href` · `screens-public.jsx:163-165` — `<a style=... onClick={()=>setMode(...)}>` sin `href` ni `role="button"`. · No focusable como enlace en algunos AT; Space no activa; antipatrón. · `<button type="button" className="link">` o `<a href="#" onClick={preventDefault}>`.

### [MEDIO] · Logo TopNav público: `<a onClick>` sin `href` · `components.jsx:444-453` — misma clase de problema en splash/auth. · Teclado y lector tratan distinto a tabs reales. · `<button type="button" className="logo">` o `href="/"` con preventDefault.

### [MEDIO] · Tabs Iniciar sesión / Crear cuenta sin `tablist` · `screens-public.jsx:139-141` — botones con clase `active` pero sin `role="tab"` ni `aria-selected`. · Estado del formulario no expuesto a AT al cambiar modo. · `role="tablist"`, `aria-selected={mode==='login'}`.

### [MEDIO] · Errores de auth sin `role="alert"` · `screens-public.jsx:157` — `field-err banner danger` estático. · Lector no anuncia error al fallar login. · `role="alert"` o `aria-live="assertive"` en contenedor de `err`.

### [BAJO] · Splash: CTAs sin landmark de navegación principal · `screens-public.jsx:3-80` — contenido largo sin `main`/`h1` único semántico en shell (el `h1` está en splash). · Estructura aceptable; mejorable con `main` en `app.jsx` para público. · Envolver splash en landmark.

### [BAJO] · `auth-tabs` contraste tab inactivo · `styles.css:293-302` — inactivo sobre fondo `var(--line)`; verificar en dark. · Posible ratio &lt; 4.5:1. · Token `--ink-2` con borde en inactivo.

### [BAJO] · Feature cards del splash no focusables · `screens-public.jsx:22-46` — solo decorativas. · OK si son informativas; sin problema si no son interactivas.

### [INFO] · `:focus-visible` global · Sprint 5 `styles.css:2397-2400`. · OK en Btn del splash/auth.

### [INFO] · Bottom-nav no muestra en público · `components.jsx:497` — `!isPublic`. · Correcto.

---

## Veredicto

Fix más barato y visible: **reemplazar `<a onClick>` del toggle auth por `button`**. Alinea foco, teclado y lectores en el primer contacto con la app.

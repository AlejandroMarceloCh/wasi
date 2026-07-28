# T085 — Profile: a11y y responsive (modales foco/escape, móvil)

**TARGET:** `app/screens-profile.jsx` + `app/components.jsx` + `app/styles.css`  
**LENTE:** a11y-responsive  
**Fecha:** 2026-07-06

---

## Resumen

Cinco modales comparten el componente `Modal` (Escape + scroll lock). En perfil, el patrón FAQ y las filas de menú son operables por teclado; faltan focus-trap, `aria-labelledby` en diálogos y ajustes del grid de planes en móvil estrecho.

---

## Hallazgos

### [ALTO] · `Modal` sin focus-trap ni foco inicial · `components.jsx:534-604` — solo listener `Escape`; no `focus()` al abrir ni ciclo Tab dentro. · En “Editar perfil” o “Ayuda”, Tab escapa al contenido de fondo; incumple patrón dialog accesible. · Trap con ref al modal + restore focus al cerrar (compartido T092).

### [MEDIO] · Diálogo sin `aria-labelledby` / `aria-describedby` · `components.jsx:566-567` — `role="dialog"` + `aria-modal="true"` pero título `h3` no enlazado. · Lector anuncia “dialog” sin nombre. · `aria-labelledby={titleId}` en `h3.modal-title`.

### [MEDIO] · FAQ: `aria-expanded` sin `aria-controls` · `screens-profile.jsx:277-281` — acordeón accesible parcialmente. · Relación pregunta↔respuesta menos clara para AT. · `id` en `.faq-a` + `aria-controls` en `.faq-q`.

### [MEDIO] · Modal planes: `grid-2` apretado en 390px · `screens-profile.jsx:332` + `styles.css:2170` — dos columnas hasta 600px; cards Free/Pro muy estrechas. · Texto de features con scroll horizontal o truncado. · Forzar `grid-template-columns: 1fr` en modal planes ≤480px.

### [BAJO] · Varios modales, un `document.body.style.overflow` · `components.jsx:539-542` — si en el futuro se apilan modales, el cleanup del primero restaura scroll con el segundo abierto. · Hoy solo uno en perfil; riesgo bajo. · Contador de modales abiertos o stack.

### [BAJO] · `menu-row` como `role="button"` en lugar de `<button>` · `screens-profile.jsx:123-146` — funciona con `onKeyActivate` pero no es foco nativo de formulario. · Menos consistente con resto de nav. · `<button className="menu-row">` con reset CSS.

### [BAJO] · Cerrar sesión sin confirmación accesible · `screens-profile.jsx:150-152` — `Btn danger` directo. · Accidental en móvil; sin `aria-describedby` de consecuencia. · `confirm()` o modal de confirmación con foco gestionado.

### [INFO] · Escape cierra modales de perfil · `components.jsx:537-538`. · OK.

### [INFO] · `profile-grid` a 1 columna ≤980px · `styles.css:2156`. · OK en móvil.

---

## Veredicto

El gap principal es **focus-trap en `Modal`** (afecta perfil y toda la app). En perfil, enlazar títulos ARIA y apilar planes en una columna en móvil son fixes S con beneficio inmediato.

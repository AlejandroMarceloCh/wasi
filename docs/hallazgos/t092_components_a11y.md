# T092 — Components: a11y (modales focus-trap, ErrorBanner aria-live, labels)

**TARGET:** `app/components.jsx` + `app/app.jsx` (ErrorBanner)  
**LENTE:** a11y  
**Fecha:** 2026-07-06

---

## Resumen

Sprint 5 cubrió labels en `Input`/`Select` y foco visible. `Modal` implementa Escape y scroll-lock pero no trap de foco ni título enlazado. `ErrorBanner` global carece de región live. `Switch`/`ToggleRow` y gauges están razonablemente etiquetados.

---

## Hallazgos

### [ALTO] · `Modal` sin focus-trap · `components.jsx:534-604` — Tab sale al contenido detrás; foco no vuelve al disparador al cerrar. · Afecta notificaciones, contacto, perfil, preview publicar. · Trap focus + `returnFocusRef` (compartido T085).

### [ALTO] · `ErrorBanner` sin `aria-live` · `app.jsx:28-42` — banner fixed con mensaje de error API; no `role="alert"`. · Usuarios de lector no escuchan errores globales (solo los inline por pantalla). · `role="alert"` o `aria-live="assertive"`; botón cerrar con `aria-label`.

### [MEDIO] · `Modal` sin `aria-labelledby` · `components.jsx:566-567,590` — `h3` con título no referenciado. · Diálogo anónimo para AT. · `const tid = useId();` + `aria-labelledby={tid}` en `h3`.

### [MEDIO] · `ErrorBanner` cierra con clic en todo el banner · `app.jsx:32` — `onClick={onClose}` en contenedor sin botón dedicado. · Accidental para usuarios motores; sin teclado explícito salvo ignorar. · Botón “Cerrar” focusable + `aria-label`.

### [MEDIO] · `Switch` sin `aria-labelledby` al label visible · `components.jsx:241-244,247-254` — `aria-label={label}` duplica texto del `ToggleRow` pero el label no está en DOM asociado al switch. · Redundante pero aceptable; mejorable con `id` en label + `aria-labelledby`. · Enlazar label `.toggle-row .label` con switch.

### [BAJO] · `ListingCard` `role="button"` sin `aria-label` · `components.jsx:146-147` — dirección está en cuerpo pero no como nombre accesible del control. · Lector anuncia “button” genérico. · `aria-label={`Ver ${listing.address}, ${listing.district}`}`.

### [BAJO] · `TopNav` notificaciones: modal hereda gaps de `Modal` · `components.jsx:511-528` — mismo componente sin trap. · Cubierto por fix global Modal.

### [BAJO] · `GaugeChart` / `ScoreCircle`: texto animado no en `aria-live` · `components.jsx:339-350,377` — valores animan visualmente; aria-label estático al montar. · Diferencia menor; valor final en label al terminar animación. · Actualizar `aria-label` al final de `useAnimatedNumber`.

### [BAJO] · `PageHeader` botón Volver sin `type="button"` explícito · `components.jsx:610` — en formularios podría submitir. · Fuera de forms hoy; bajo riesgo. · `type="button"`.

### [INFO] · `Input`/`Select` labels asociados · Sprint 5. · No re-reportar.

### [INFO] · `:focus-visible` en controles · Sprint 5 `styles.css`. · No re-reportar.

---

## Veredicto

Dos fixes transversales de máximo ROI: **focus-trap en `Modal`** y **`aria-live` en `ErrorBanner`**. Un solo cambio en cada componente mejora perfil, publicar, listings y errores de API en toda la app.

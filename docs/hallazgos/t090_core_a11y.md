# T090 — Core: a11y (buscador teclado, foco visible)

**TARGET:** `app/screens-core.jsx` + `app/styles.css`  
**LENTE:** a11y  
**Fecha:** 2026-07-06

---

## Resumen

El buscador de dirección usa botones reales en el dropdown (Enter/Space tras Sprint 5). Faltan atributos combobox en el input, foco visible en sugerencias custom, y navegación por flechas entre resultados.

---

## Hallazgos

### [MEDIO] · Input de búsqueda sin `aria-expanded` / `aria-controls` · `screens-core.jsx:140-146,158-176` — lista de sugerencias aparece/desaparece sin relación ARIA. · Lector no informa cuántas sugerencias hay ni si el listbox está abierto. · Patrón combobox: `aria-expanded={open}`, `aria-controls="addr-sug-list"`, `role="listbox"` en contenedor.

### [MEDIO] · Sin navegación ArrowUp/Down en sugerencias · `screens-core.jsx:162-174` — solo clic o tab a cada botón. · Usuario de teclado debe tabular N veces. · `aria-activedescendant` + handler de flechas en el input.

### [MEDIO] · Sugerencias: sin estilo `:focus-visible` dedicado · `screens-core.jsx:163-167` — botones con estilos inline; foco depende del outline global. · En dropdown sobre mapa, outline puede quedar recortado por `overflow:hidden`. · Clase `.addr-sug-item:focus-visible` con fondo `var(--primary-soft)`.

### [BAJO] · Spinner de carga sin texto para AT · `screens-core.jsx:151-154` — solo div animado en botón submit. · `aria-busy="true"` en form o `aria-label="Buscando"` en botón. · Atributos live en submit.

### [BAJO] · `MapPicker` `role="application"` · `screens-core.jsx:78` — patrón válido para mapas pero anuncia poco sobre estado del pin. · Usuarios AT dependen de coords textuales en seller. · `aria-live="polite"` en span de coordenadas al mover pin (en pantalla padre).

### [BAJO] · Botón submit búsqueda: solo `aria-label="Buscar"` · `screens-core.jsx:147` — OK; podría duplicar estado loading en label. · Menor.

### [INFO] · `onMouseDown preventDefault` evita blur prematuro · `screens-core.jsx:164`. · Patrón correcto.

### [INFO] · Foco visible global en inputs/buttons · Sprint 5 `styles.css:2397-2400`. · OK.

### [INFO] · `Stepper` con `aria-label` en ± · `screens-core.jsx:185-187`. · OK.

---

## Veredicto

Teclado básico resuelto en Sprint 5; siguiente paso es **combobox ARIA completo** en `AddressSearch` (expanded, listbox, flechas). Mejora publicar y todos los wizards que reutilizan el buscador.

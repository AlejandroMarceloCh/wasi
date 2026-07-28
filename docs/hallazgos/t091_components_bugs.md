# T091 — Components: bugs (Icon/Modal/Input/TopNav/gauges, contratos)

**TARGET:** `app/components.jsx`  
**LENTE:** bugs  
**Fecha:** 2026-07-06

---

## Resumen

Componentes compartidos son estables en uso nominal. Los contratos se rompen en listings de venta (`ListingCard`), IDs SVG duplicados en gauges múltiples, y enlaces del TopNav sin semántica de navegación.

---

## Hallazgos

### [ALTO] · `ListingCard` siempre muestra “/mes” · `components.jsx:169-170` — `lcz-per` hardcodeado; ignora `listing.operacion`. · Venta en Explorar, Guardados y vista previa de publicar muestran unidad incorrecta. · `{listing.operacion === 'venta' ? '' : '/mes'}` o suffix por operación.

### [MEDIO] · `GaugeChart`: `id="gaugeArcGrad"` fijo · `components.jsx:314-320` — gradiente SVG con id constante. · Splash + resultado FairValue en misma sesión DOM: segundo gauge puede perder gradiente (referencia rota). · `id` único con `useId()` o sufijo aleatorio por instancia.

### [MEDIO] · Logo TopNav: `<a onClick>` sin `href` · `components.jsx:444-453` — navegación por handler solo. · Comportamiento de enlace inconsistente; ver T088. · `button` estilizado o `href` real.

### [MEDIO] · `Icon` desconocido renderiza SVG vacío · `components.jsx:45-46` — `paths[name] || null` sin warning. · Typo en `name` → UI sin icono silencioso (p. ej. histórico ícono delete). · Fallback a `alert` o `console.warn` en dev.

### [BAJO] · `ListingCard.onToggleFav(id, next)` vs consumidores · `components.jsx:143` vs `screens-seller.jsx:953` — SavedScreen ignora arg `next`; ListingsScreen lo usa. · Contrato asimétrico; confuso al extender. · Documentar o unificar firma `(id)`.

### [BAJO] · `Modal` overlay cierra con cualquier clic · `components.jsx:561` — incluso drag desde dentro hacia fuera. · Cierre accidental al seleccionar texto que sale del modal. · Cerrar solo en mousedown target === overlay.

### [BAJO] · `Select` no soporta `error` / `aria-invalid` · `components.jsx:228-238` — a diferencia de `Input`. · Pantallas con Select no pueden mostrar validación uniforme (distrito en seller). · Props `error` espejo de `Input`.

### [BAJO] · `useFieldId` global `_fieldSeq` · `components.jsx:210-212` — ids únicos en runtime; remount no reinicia. · Riesgo teórico de colisión con miles de campos en SPA larga. · `React.useId()` si disponible.

### [INFO] · `Input` con `htmlFor` y `aria-invalid` · Sprint 5. · OK.

### [INFO] · `ZONE_VARIANT` coherente con backend · usado en cards y tags. · OK.

---

## Veredicto

Bug de mayor impacto visible: **`ListingCard` /mes en venta** — afecta catálogo, guardados y preview. Segundo: **id SVG duplicado en GaugeChart** en rutas con demo + análisis.

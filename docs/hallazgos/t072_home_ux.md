# T072 — Home: UX y copy (mock vs real)

**TARGET:** `app/screens-home.jsx`  
**LENTE:** ux-copy  
**Fecha:** 2026-07-06

---

## Resumen

El home mezcla datos reales (mapa de distritos, gangas del API, POI importance) con mocks y cifras de marketing sin etiquetar. Eso erosiona confianza justo donde el producto promete “evidencia, no opiniones”.

---

## Hallazgos

### [ALTO] · Hero carousel usa avisos ficticios sin disclaimer · `screens-home.jsx:42-53,512-541` — `HERO_LISTINGS` hardcodeado (direcciones, precios, veredictos) rota cada 3 s como si fuera análisis real. · El usuario ve “Tu anuncio $900” y veredicto Ganga/Inflado que no provienen del modelo ni del catálogo. · Etiquetar “Ejemplo ilustrativo” o sustituir por 1–2 gangas reales del endpoint ya usado abajo.

### [ALTO] · Histograma titulado “Distribución real” con datos del mock · `screens-home.jsx:571-577` — cabecera `Distribución real · {dist} · {area} m²` alimenta `HomeHistogram` con `current.fair` / `current.anuncio` del mock. · Copy afirma realidad; la curva es gaussiana sintética, no histograma de mercado. · Renombrar (“Ejemplo de distribución”) o calcular bins desde comparables del distrito.

### [MEDIO] · Tarjeta del mock dice “Analizar precio” en el valor justo · `screens-home.jsx:527-529` — label `k` = “Analizar precio” sobre `$700` (fair value). · Confunde acción (CTA) con resultado del modelo; parece botón o precio ya calculado. · Usar “Precio de referencia” o “Fair value”.

### [MEDIO] · `HomeOSMMock` presenta score y POIs inventados · `screens-home.jsx:203-234,630-632` — “Score 72 · Medio-Alto”, “Parque 150m” fijos; mapa no interactivo. · En módulo “Entorno y Seguridad” parece dato vivo del producto. · Badge “Vista de ejemplo” o screenshot real de `EntornoMapScreen`.

### [MEDIO] · Estadísticas de problema sin fuente (+28%, 0 fuentes) · `screens-home.jsx:559-567` — cifras contundentes sin enlace ni metodología. · Riesgo de percepción de exageración frente a `WASI_STATS` auditables más abajo. · Añadir nota al pie o alinear con métricas del modelo.

### [MEDIO] · Conteo de distritos inconsistente · `stats.js:7` (`DISTRITOS: '40'`) vs `screens-home.jsx:400,1090` — pie del mapa suma `distritos.reduce`; hero dice 40. · Sprint 3 documentó discrepancia cosmética; sigue confundiendo en la misma página. · Unificar número desde `distritos_zona.json` en runtime.

### [BAJO] · Eyebrow “Lima en tiempo real” con mediana estática · `screens-home.jsx:328` — datos de `Api.distritosZona()`, no streaming. · Expectativa de actualización en vivo. · “Lima · datos del catálogo 2026”.

### [BAJO] · Dashboard saludo fijo femenino · `screens-home.jsx:972` — “Bienvenida” para todos los roles/nombres. · Fricción menor de inclusividad. · “Hola” / “Bienvenido/a” según preferencia o neutro.

### [BAJO] · CTA “Probar 14 días gratis” Plan Pro sin flujo · `screens-home.jsx:1130-1135` — lleva a perfil sin onboarding de plan. · Expectativa de trial no cumplida. · Ocultar hasta tener billing o copy “Próximamente”.

### [INFO] · CTA Operaciones eliminado · Sprint 3. · No re-reportar.

### [INFO] · Banner comparables vs modelo en catálogo · Sprint 3 corrigió listings; home no tenía ese bug. · OK.

---

## Veredicto

El mayor riesgo de UX es **presentar mocks como datos reales** en hero e histograma. Corregir copy/etiquetas o reemplazar por datos del API tiene alto retorno en credibilidad con esfuerzo acotado.

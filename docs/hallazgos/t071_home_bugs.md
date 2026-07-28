# T071 — Home: bugs (crashes, fetch, estados)

**TARGET:** `app/screens-home.jsx`  
**LENTE:** bugs  
**Fecha:** 2026-07-06

---

## Resumen

`HomeScreen` y `DashboardScreen` son estables en el camino feliz (null-guards razonables, cleanup en mapas Leaflet). Quedan races en fetches sin cancelación y un modal de análisis que puede aplicar datos fuera de orden.

---

## Hallazgos

### [MEDIO] · Modal de análisis sin cancelación de fetch · `screens-home.jsx:949-960` — `openAnalysesModal` llama `Api.listAnalyses()` sin flag `cancel` ni `AbortController`. · Si el usuario abre y cierra el modal rápido, o abre dos veces, `setAnaAll` puede ejecutarse con respuesta vieja o tras desmontar el efecto padre. · Añadir `let alive = true` + cleanup, o ignorar si `!anaOpen`.

### [MEDIO] · `explain` / `narrative` del dashboard no aplican aquí; gangas y POI sin cleanup · `screens-home.jsx:417-421,443-445` — `Api.listListings` y `Api.poiImportance()` sin cancelación. · Cambio rápido de sesión o navegación away puede provocar `setState` en componente desmontado (warning React) o flash de gangas vacías tras error silenciado. · Patrón `let cancel = false` + `return () => { cancel = true }` como en `DashboardScreen:912-924`.

### [BAJO] · Filtro de zona en modal usa casing exacto · `screens-home.jsx:944,1194` — `anaAll.filter(a => a.zone === anaFilter)` con keys `'Inflado'|'Ganga'|'Justo'`. · Si el backend devolviera otra capitalización, el filtro mostraría 0 resultados con contador global > 0. · Normalizar zona al cargar o comparar case-insensitive.

### [BAJO] · `setActive` en hover del mapa tras unmount · `screens-home.jsx:275-276,293` — `circle.on('mouseover', () => setActive(d))` sin desregistrar listeners antes de `map.remove()`. · En navegación rápida fuera del home puede aparecer warning de setState en componente desmontado. · En cleanup del efecto Leaflet, hacer `circle.off()` o comprobar montaje con ref.

### [INFO] · Dashboard fetch con cancel · `screens-home.jsx:912-924` — patrón correcto con `cancel`. · OK.

### [INFO] · Guards en render del dashboard · `screens-home.jsx:931-934` — `data.user`, `stats`, arrays con fallback. · Evita crash por null. · OK.

### [INFO] · Gangas basura / sanity-filter · backend Sprint 1. · No re-reportar.

### [INFO] · Vars CSS `--muted` / `--border` en trailer · Sprint 0. · No re-reportar.

---

## Veredicto

Sin crashes bloqueantes en home/dashboard. Priorizar cancelación de fetches en modal de análisis y sección gangas/POI para eliminar races y warnings en navegación rápida.

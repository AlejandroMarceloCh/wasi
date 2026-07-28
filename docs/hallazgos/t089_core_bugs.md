# T089 — Core: bugs (MapPicker/AddressSearch races, cleanup, geocoding)

**TARGET:** `app/screens-core.jsx`  
**LENTE:** bugs  
**Fecha:** 2026-07-06

---

## Resumen

`MapPicker` limpia el mapa Leaflet al desmontar y sincroniza pin por props. `AddressSearch` debouncea sugerencias pero no cancela fetches en vuelo; el reverse geocode de `screens-seller.jsx` (Nominatim) es aparte y ya reportado en T080. Aquí el riesgo principal es dirección equivocada por race en Photon.

---

## Hallazgos

### [ALTO] · `AddressSearch`: fetches sin `AbortController` · `screens-core.jsx:122-131,114-118` — debounce cancela `setTimeout` pero no el `fetch` ya disparado. · Usuario escribe “Larco”, luego “Benavides”; respuesta lenta de “Larco” puede pisar sugerencias o `pick()` del resultado viejo en submit. · `AbortController` por request; ignorar respuestas abortadas.

### [MEDIO] · Sugerencias Photon sin filtrar bbox Lima en cliente · `screens-core.jsx:87-99,114-116` — bbox en URL pero `parse` no descarta features fuera de `enLima`. · Si Photon devuelve match fuera del bbox, `onPick` ubica pin fuera de Lima → 422 al publicar. · Filtrar `enLima(lat,lng)` post-parse; toast si 0 resultados.

### [MEDIO] · `onSubmit` autocomplete: race con efecto de sugerencias · `screens-core.jsx:107-118,122-131` — Enter con query manual dispara fetch paralelo al del debounce. · Dos `pick()` posibles en orden aleatorio. · Reutilizar un solo controller + flag de “última query”.

### [MEDIO] · `flyTo` en `MapPicker` siempre llama `onMove` · `screens-core.jsx:45-52` — al elegir dirección, `cbRef.current(flyTo.lat, flyTo.lng)` dispara reverse geocode en seller. · Puede ser deseado; si `onMove` tiene efectos costosos, doble trabajo con setState de pin. · Opción `silent` en flyTo para no emitir si coords ya iguales.

### [BAJO] · `MapPicker` mount: `useEffect([])` ignora props iniciales si cambian antes de mount · `screens-core.jsx:14-42` — edge en Strict Mode / navegación rápida. · Pin visual desincronizado un frame. · Incluir `lat,lng` en deps con guard de mapa ya creado.

### [BAJO] · `AddressSearch` `onBlur` + `setTimeout(150)` · `screens-core.jsx:142` — patrón frágil si delay del SO &gt; 150ms al elegir sugerencia. · Mitigado por `onMouseDown preventDefault` en items. · `pointerdown` en sugerencia o aumentar delay a 200ms.

### [BAJO] · Errores de Photon tragados · `screens-core.jsx:117,129` — `.catch(() => {})` silencioso. · Usuario no sabe si falló red o no hay resultados. · Estado `searchErr` opcional.

### [INFO] · `MapPicker` cleanup `map.remove()` · `screens-core.jsx:41`. · OK.

### [INFO] · Reverse Nominatim en seller sin abort en unmount · T080. · No duplicar fix aquí.

### [INFO] · Sugerencias operables por teclado · Sprint 5 (`onClick` + `onMouseDown`). · OK.

---

## Veredicto

Prioridad **AbortController en AddressSearch** — afecta publicar, FairValue y Entorno. Evita pins y distritos incorrectos por respuestas obsoletas de Photon.

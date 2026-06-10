/* Wasi — screens (web app) */
const { useState: useS, useEffect: useE, useRef: useR } = React;

/* bbox de Lima Metropolitana (igual que el backend) */
const LIMA_BBOX = { latMin:-12.5, latMax:-11.7, lngMin:-77.2, lngMax:-76.7 };
const enLima = (lat,lng) =>
  lat>=LIMA_BBOX.latMin && lat<=LIMA_BBOX.latMax &&
  lng>=LIMA_BBOX.lngMin && lng<=LIMA_BBOX.lngMax;
const LIMA_CENTRO = { lat:-12.0908, lng:-77.0270 };  // Lima centro aprox.

/* MapPicker — mapa Leaflet con pin arrastrable. El pin es la fuente de
   verdad de lat/lng; onMove(lat,lng) se dispara al arrastrar o clickear.
   flyTo={lat,lng} mueve el mapa + pin programáticamente (para geocoding). */
const MapPicker = ({ lat, lng, onMove, className, pois, flyTo, showRadius }) => {
  const elRef = useR(null), mapRef = useR(null), cbRef = useR(onMove), poiLayerRef = useR(null);
  const markerRef = useR(null), radiusRef = useR(null);
  cbRef.current = onMove;
  useE(() => {
    if (!elRef.current || mapRef.current || !window.L) return;
    const map = L.map(elRef.current).setView([lat, lng], 14);
    // Basemap Carto Voyager: limpio y premium (vs OSM crudo, saturado y ruidoso).
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);
    // Anillo de 1 km: el radio real que el modelo usa para contar servicios.
    // Hace visible el concepto del producto en la pantalla de entorno.
    if (showRadius) {
      radiusRef.current = L.circle([lat, lng], {
        radius: 1000, color: '#2563eb', weight: 1.5, dashArray: '6 6',
        fill: true, fillColor: '#2563eb', fillOpacity: 0.04, interactive: false,
      }).addTo(map);
    }
    poiLayerRef.current = L.layerGroup().addTo(map);   // capa de POIs (debajo del pin)
    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    markerRef.current = marker;
    const emit = () => {
      const p = marker.getLatLng();
      if (radiusRef.current) radiusRef.current.setLatLng(p);
      if (cbRef.current) cbRef.current(+p.lat.toFixed(6), +p.lng.toFixed(6));
    };
    marker.on('dragend', emit);
    map.on('click', (e) => { marker.setLatLng(e.latlng); emit(); });
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 120);  // Leaflet necesita esto
    return () => { clearTimeout(t); map.remove(); mapRef.current = null; poiLayerRef.current = null; markerRef.current = null; radiusRef.current = null; };
  }, []);

  // Vuela al punto cuando flyTo cambia (geocoding search).
  useE(() => {
    if (!flyTo || !mapRef.current || !markerRef.current || !window.L) return;
    const ll = L.latLng(flyTo.lat, flyTo.lng);
    mapRef.current.flyTo(ll, 16, { animate: true, duration: 0.8 });
    markerRef.current.setLatLng(ll);
    if (radiusRef.current) radiusRef.current.setLatLng(ll);
    if (cbRef.current) cbRef.current(flyTo.lat, flyTo.lng);
  }, [flyTo]);

  // Resync si el padre cambia lat/lng por fuera del mapa (no re-emite onMove → sin loop).
  useE(() => {
    const m = markerRef.current;
    if (!m || typeof lat !== 'number' || typeof lng !== 'number') return;
    const cur = m.getLatLng();
    if (Math.abs(cur.lat - lat) < 1e-7 && Math.abs(cur.lng - lng) < 1e-7) return;
    m.setLatLng([lat, lng]);
    if (radiusRef.current) radiusRef.current.setLatLng([lat, lng]);
  }, [lat, lng]);

  // Pinta/actualiza los POIs cuando cambia la prop. interactive:false → los
  // puntos no roban el click al pin (clickear "a través" de ellos mueve el pin).
  useE(() => {
    const layer = poiLayerRef.current;
    if (!layer || !window.L) return;
    layer.clearLayers();
    (pois || []).forEach(p => {
      L.circleMarker([p.lat, p.lng], {
        radius: 4, color: p.color, weight: 1.5, opacity: 0.9,
        fillColor: p.color, fillOpacity: 0.55, interactive: false,
      }).addTo(layer);
    });
  }, [pois]);

  return <div ref={elRef} className={className || 'map-box'} role="application" aria-label="Mapa interactivo. Haz clic o arrastra el pin para seleccionar la ubicación del inmueble."/>;
};

/* Stepper — control numérico +/− */
const Stepper = ({ label, value, set, min = 0, max = 20, suffix }) => (
  <div className="stepper-field">
    <div className="sl">{label}</div>
    <div className="stepper">
      <button type="button" onClick={()=>set(Math.max(min, value-1))} disabled={value<=min} aria-label={`Disminuir ${label}`}>−</button>
      <span className="val">{value}{suffix ? ` ${suffix}` : ''}</span>
      <button type="button" onClick={()=>set(Math.min(max, value+1))} disabled={value>=max} aria-label={`Aumentar ${label}`}>+</button>
    </div>
  </div>
);

/* Helper común: maneja 401 → forzar logout */
const handleApiErr = (ex, { setErr, onAuthExpired }) => {
  const msg = (ex && ex.message) ? ex.message : 'Error de conexión con el servidor';
  if (ex && ex.status === 401 && typeof onAuthExpired === 'function') {
    onAuthExpired();
    return msg;
  }
  if (typeof setErr === 'function') setErr(msg);
  return msg;
};


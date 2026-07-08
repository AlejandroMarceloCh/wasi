import { useEffect as useE, useRef as useR, useState as useS } from 'react';
import L from 'leaflet';
import { LIMA_ALIASES } from '../lib/aliases_lima.js';
import { LIMA_BBOX, LIMA_CENTRO, enLima, handleApiErr } from '../lib/helpers.js';
import { Icon } from '../ui/components.jsx';

export { LIMA_BBOX, LIMA_CENTRO, enLima };

export const MapPicker = ({ lat, lng, onMove, className, pois, flyTo, showRadius }) => {
  const elRef = useR(null), mapRef = useR(null), cbRef = useR(onMove), poiLayerRef = useR(null);
  const markerRef = useR(null), radiusRef = useR(null);
  cbRef.current = onMove;
  useE(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current).setView([lat, lng], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);


    if (showRadius) {
      radiusRef.current = L.circle([lat, lng], {
        radius: 1000, color: '#2563eb', weight: 1.5, dashArray: '6 6',
        fill: true, fillColor: '#2563eb', fillOpacity: 0.04, interactive: false,
      }).addTo(map);
    }
    poiLayerRef.current = L.layerGroup().addTo(map);
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
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => { clearTimeout(t); map.remove(); mapRef.current = null; poiLayerRef.current = null; markerRef.current = null; radiusRef.current = null; };
  }, []);


  useE(() => {
    if (!flyTo || !mapRef.current || !markerRef.current) return;
    const ll = L.latLng(flyTo.lat, flyTo.lng);
    mapRef.current.flyTo(ll, 16, { animate: true, duration: 0.8 });
    markerRef.current.setLatLng(ll);
    if (radiusRef.current) radiusRef.current.setLatLng(ll);
    if (cbRef.current) cbRef.current(flyTo.lat, flyTo.lng);
  }, [flyTo]);


  useE(() => {
    const m = markerRef.current;
    if (!m || typeof lat !== 'number' || typeof lng !== 'number') return;
    const cur = m.getLatLng();
    if (Math.abs(cur.lat - lat) < 1e-7 && Math.abs(cur.lng - lng) < 1e-7) return;
    m.setLatLng([lat, lng]);
    if (radiusRef.current) radiusRef.current.setLatLng([lat, lng]);
  }, [lat, lng]);



  useE(() => {
    const layer = poiLayerRef.current;
    if (!layer) return;
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

export const AddressSearch = ({ onPick, placeholder }) => {
  const [q, setQ] = useS('');
  const [loading, setLoading] = useS(false);
  const [sug, setSug] = useS([]);
  const [open, setOpen] = useS(false);

  const PHOTON = (query, limit) =>
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}&bbox=-77.2,-12.3,-76.7,-11.8`;
  const resolveAlias = (s) =>
    LIMA_ALIASES[s.toLowerCase().trim()] || s;
  const parse = (data) =>
    (data.features || []).map(ft => {
      const p = ft.properties;
      const name = p.name || p.street || '';
      const cityPart  = p.city  && p.city  !== name ? p.city  : null;
      const statePart = p.state && p.state !== name ? p.state : null;
      const context = [...new Set([cityPart, statePart].filter(Boolean))].join(', ');
      return { name, context, lat: ft.geometry.coordinates[1], lng: ft.geometry.coordinates[0] };
    }).filter(s => s.name);

  const pick = (s) => {
    setQ(s.name + (s.context ? ', ' + s.context : ''));
    setSug([]); setOpen(false);
    if (onPick) onPick(s.lat, s.lng);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setOpen(false);
    if (sug.length > 0) { pick(sug[0]); return; }
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    fetch(PHOTON(resolveAlias(query), 1))
      .then(r => r.json())
      .then(data => { const s = parse(data); if (s.length > 0) pick(s[0]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };


  useE(() => {
    const query = q.trim();
    if (query.length < 3) { setSug([]); setOpen(false); return; }
    const ctrl = new AbortController();
    const tid = setTimeout(() => {
      fetch(PHOTON(resolveAlias(query), 5), { signal: ctrl.signal })
        .then(r => r.json())
        .then(data => { const s = parse(data); setSug(s); setOpen(s.length > 0); })
        .catch(() => {});
    }, 400);
    // Cancela el request en vuelo al re-teclear o desmontar (evita que una
    // respuesta vieja pise las sugerencias nuevas).
    return () => { clearTimeout(tid); ctrl.abort(); };
  }, [q]);

  return (
    <div className="addr-search" style={{position:'relative', marginBottom:10}}>
      <form onSubmit={onSubmit} role="search"
        style={{display:'flex', alignItems:'center', gap:8, border:'1px solid var(--line)',
                borderRadius:10, padding:'9px 12px', background:'var(--surface)'}}>
        <Icon name="pin" size={14} stroke="var(--ink-3)"/>
        <input type="text" value={q} onChange={e => setQ(e.target.value)}
          onFocus={() => sug.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder || 'Buscar dirección en Lima…'}
          aria-label="Buscar dirección"
          style={{flex:1, background:'none', border:'none', outline:'none',
                  fontSize:13, color:'var(--ink)', fontFamily:'inherit'}}/>
        <button type="submit" disabled={loading} aria-label="Buscar"
          style={{background:'none', border:'none', cursor:'pointer', padding:'0 2px',
                  color:'var(--primary)', display:'flex', alignItems:'center',
                  opacity: loading ? 0.5 : 1}}>
          {loading
            ? <div style={{width:14, height:14, border:'2px solid var(--primary)',
                           borderTopColor:'transparent', borderRadius:'50%',
                           animation:'spin .6s linear infinite'}}/>
            : <Icon name="arrow" size={14}/>}
        </button>
      </form>
      {open && sug.length > 0 && (
        <div style={{position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:1000,
                     background:'var(--surface)', border:'1px solid var(--line)', borderRadius:10,
                     boxShadow:'0 8px 24px rgba(0,0,0,.10)', overflow:'hidden'}}>
          {sug.map((s, i) => (
            <button key={i} type="button"
              onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}
              style={{display:'flex', gap:8, alignItems:'center', width:'100%', textAlign:'left',
                      padding:'9px 12px', background:'none', border:'none', cursor:'pointer',
                      borderTop: i ? '1px solid var(--line)' : 'none'}}>
              <Icon name="pin" size={14} stroke="var(--ink-3)"/>
              <div style={{minWidth:0}}>
                <span style={{display:'block', fontSize:13, color:'var(--ink)'}}>{s.name}</span>
                {s.context && <span style={{display:'block', fontSize:11, color:'var(--ink-3)'}}>{s.context}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export { handleApiErr };

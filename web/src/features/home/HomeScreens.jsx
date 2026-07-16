import { useEffect as useE, useRef as useR, useState as useS } from 'react';
import L from 'leaflet';
import { Api } from '../../shared/api/client.js';
import { onKeyActivate } from '../../shared/lib/helpers.js';
import { WASI_STATS } from '../../shared/lib/stats.js';
import { ListingCard } from '../../shared/listings/ListingCard.jsx';
import { PoiImportanceD3 } from '../../shared/charts.jsx';
import { Btn, Glossary, Icon, Tag } from '../../shared/ui/components.jsx';

const HomeMiniGauge = ({ pct = 0.78 }) => {
  const CX = 90, CY = 78, R = 60;
  const polar = (p, r = R) => {
    const th = Math.PI * (1 - p);
    return { x: CX + r * Math.cos(th), y: CY - r * Math.sin(th) };
  };
  const arc = (p1, p2) => {
    const a = polar(p1), b = polar(p2);
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 ${(p2-p1)>0.5?1:0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  };
  const p = Math.max(0, Math.min(1, pct));
  const angle = -90 + 180 * p;
  return (
    <svg viewBox="0 0 180 100" style={{ width: '100%', maxWidth: 180, display: 'block' }}>
      <defs>
        <linearGradient id="heroGaugeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="oklch(0.66 0.18 155)"/>
          <stop offset="22%"  stopColor="oklch(0.70 0.17 120)"/>
          <stop offset="50%"  stopColor="oklch(0.74 0.16 70)"/>
          <stop offset="78%"  stopColor="oklch(0.67 0.20 35)"/>
          <stop offset="100%" stopColor="oklch(0.61 0.22 25)"/>
        </linearGradient>
      </defs>
      <path d={arc(0, 1)} fill="none" stroke="url(#heroGaugeGrad)"
            strokeWidth="13" strokeLinecap="round"/>
      <g style={{
        transform: `rotate(${angle.toFixed(2)}deg)`,
        transformOrigin: `${CX}px ${CY}px`,
        transition: 'transform 1.2s cubic-bezier(.4,.0,.2,1)',
      }}>
        <line x1={CX} y1={CY} x2={CX} y2={CY - R} stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx={CX} cy={CY - R} r="5" fill="#fff" stroke="var(--ink)" strokeWidth="2"/>
      </g>
      <circle cx={CX} cy={CY} r="7" fill="var(--ink)"/>
      <circle cx={CX} cy={CY} r="3" fill="#fff"/>
    </svg>
  );
};

const HERO_LISTINGS = [
  { addr: 'Av. Pardo 245',           dist: 'Miraflores',   area: 60, dorm: 2, piso: 4,  fair: 700,  anuncio: 900  },
  { addr: 'Calle Berlín 980',        dist: 'Miraflores',   area: 45, dorm: 1, piso: 7,  fair: 650,  anuncio: 560  },
  { addr: 'Av. Conquistadores 1234', dist: 'San Isidro',   area: 85, dorm: 3, piso: 9,  fair: 1450, anuncio: 1500 },
  { addr: 'Jr. Las Camelias 320',    dist: 'San Borja',    area: 70, dorm: 2, piso: 5,  fair: 850,  anuncio: 720  },
  { addr: 'Av. Brasil 2890',         dist: 'Pueblo Libre', area: 55, dorm: 2, piso: 3,  fair: 520,  anuncio: 690  },
  { addr: 'Calle Schell 410',        dist: 'Miraflores',   area: 38, dorm: 1, piso: 6,  fair: 580,  anuncio: 590  },
  { addr: 'Av. La Encalada 1700',    dist: 'Surco',        area: 95, dorm: 3, piso: 11, fair: 1250, anuncio: 1180 },
  { addr: 'Calle Roma 145',          dist: 'Miraflores',   area: 50, dorm: 1, piso: 2,  fair: 720,  anuncio: 950  },
  { addr: 'Av. Petit Thouars 4520',  dist: 'Lince',        area: 65, dorm: 2, piso: 8,  fair: 600,  anuncio: 540  },
  { addr: 'Calle Tutumo 220',        dist: 'San Borja',    area: 75, dorm: 2, piso: 4,  fair: 920,  anuncio: 1090 },
];
const HERO_ZONE_BAND_PCT  = 8;    
const HERO_GAUGE_RANGE    = 35;   
                                  
                                  
const heroZoneOf = (diffPct) => {
  if (Math.abs(diffPct) <= HERO_ZONE_BAND_PCT) return 'justo';
  return diffPct > 0 ? 'inflado' : 'ganga';
};
const HERO_ZONE_LABEL = { ganga: 'Ganga', justo: 'Justo', inflado: 'Inflado' };
const HERO_ZONE_COPY  = {
  ganga:   'por debajo del mercado',
  justo:   'alineado con la zona',
  inflado: 'sobre el justo',
};

const HomeHistogram = ({ fair = 700, anuncio = 900 }) => {
  const PAD_X = 30, BAR_W = 36, GAP = 6;
  const Y_BASE = 200, Y_MAX = 150;
  const SVG_W  = 600;

  
  const xMin = Math.max(50, Math.round((fair * 0.55) / 50) * 50);
  const xMax = 2 * fair - xMin;
  const span = xMax - xMin;
  const priceToBar = (p) => Math.round((p - xMin) / span * 12);
  const xOfBar = (i) => PAD_X + i * (BAR_W + GAP) + BAR_W / 2;
  const xOfPrice = (p) => {
    const t = Math.max(0, Math.min(1, (p - xMin) / span));
    return PAD_X + BAR_W / 2 + t * 12 * (BAR_W + GAP);
  };

  const fairBar = priceToBar(fair);                              
  const annBar  = Math.max(0, Math.min(12, priceToBar(anuncio))); 
  const diffPct = (anuncio / fair - 1) * 100;
  const annZone = Math.abs(diffPct) <= HERO_ZONE_BAND_PCT
    ? 'justo' : (diffPct > 0 ? 'inflado' : 'ganga');
  const ZONE_FILL = {
    ganga:   'var(--success)',
    justo:   'oklch(0.55 0.16 60)',
    inflado: 'var(--danger)',
  };
  const annFill = ZONE_FILL[annZone];

  const bars = Array.from({ length: 13 }, (_, i) => {
    const h = 100 * Math.exp(-Math.pow((i - 6) / 3.2, 2));
    let color;
    if (i <= 3)      color = 'oklch(0.65 0.16 155)';
    else if (i <= 7) color = 'oklch(0.72 0.14 60)';
    else             color = 'oklch(0.63 0.20 25)';
    const opacity = (i === fairBar || i === annBar) ? 1 : 0.55;
    return { i, h, color, opacity };
  });

  
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const price = Math.round((xMin + t * span) / 50) * 50;
    return { price, x: xOfPrice(price) };
  });

  const fmt$ = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
  const annLabel  = `ANUNCIO · ${fmt$(anuncio)}`;
  const fairLabel = `FAIR · ${fmt$(fair)}`;
  
  const labelW = (s) => Math.max(80, s.length * 7.2 + 18);

  
  
  
  
  const fairX = xOfPrice(fair);
  const annX  = xOfPrice(anuncio);
  const minSep  = (labelW(fairLabel) + labelW(annLabel)) / 2 + 10;
  const overlap = Math.abs(annX - fairX) < minSep;

  const annBarH = 100 * Math.exp(-Math.pow((annBar - 6) / 3.2, 2)) / 100 * Y_MAX;
  const annBarTopY = Y_BASE - annBarH;
  
  
  const ANN_Y_NORMAL  = 12;
  const ANN_Y_STACKED = -34;
  const gapToBar = annBarTopY - (ANN_Y_NORMAL + 34);
  const farFromBar = gapToBar > 30;
  const useLeader = overlap || farFromBar;

  
  
  const annY = overlap ? ANN_Y_STACKED : ANN_Y_NORMAL;
  const leaderY2 = annBarTopY - 4 - annY;   

  const viewBox = overlap ? `0 -40 ${SVG_W} 320` : `0 0 ${SVG_W} 280`;

  return (
    <svg viewBox={viewBox} style={{ width: '100%', display: 'block' }}>
      {bars.map(b => {
        const x = PAD_X + b.i * (BAR_W + GAP);
        const h = b.h / 100 * Y_MAX;
        return (
          <rect key={b.i} x={x} y={Y_BASE - h} width={BAR_W} height={Math.max(h, 3)}
                rx="3" fill={b.color} opacity={b.opacity}
                style={{ transition: 'opacity .6s ease, fill .6s ease' }}/>
        );
      })}
      <line x1={PAD_X} y1={Y_BASE + 6} x2={PAD_X + 13 * BAR_W + 12 * GAP}
            y2={Y_BASE + 6} stroke="var(--line)" strokeWidth="1"/>
      {ticks.map(t => (
        <text key={t.price} x={t.x} y={224} textAnchor="middle" fontSize="11"
              fill="var(--ink-3)" fontFamily="Space Grotesk">{fmt$(t.price)}</text>
      ))}
      <g transform="translate(80, 258)">
        <circle cx="0" cy="0" r="4" fill="var(--success)"/>
        <text x="9" y="4" fontSize="11" fontWeight="700" fill="var(--success)"
              fontFamily="Space Grotesk" letterSpacing=".07em">GANGA</text>
      </g>
      <g transform="translate(280, 258)">
        <circle cx="0" cy="0" r="4" fill="var(--warning)"/>
        <text x="9" y="4" fontSize="11" fontWeight="700" fill="oklch(0.45 0.14 60)"
              fontFamily="Space Grotesk" letterSpacing=".07em">JUSTO</text>
      </g>
      <g transform="translate(490, 258)">
        <circle cx="0" cy="0" r="4" fill="var(--danger)"/>
        <text x="9" y="4" fontSize="11" fontWeight="700" fill="var(--danger)"
              fontFamily="Space Grotesk" letterSpacing=".07em">INFLADO</text>
      </g>
      {}
      <g transform={`translate(${fairX.toFixed(1)}, 12)`}>
        <rect x={-labelW(fairLabel)/2} y="0" width={labelW(fairLabel)} height="26"
              rx="13" fill="var(--primary)"/>
        <text x="0" y="17" textAnchor="middle" fill="#fff" fontSize="12"
              fontWeight="700" fontFamily="Space Grotesk">{fairLabel}</text>
        <polygon points="-6,26 6,26 0,34" fill="var(--primary)"/>
      </g>
      {}
      <g transform={`translate(${annX.toFixed(1)}, ${annY})`}>
        <rect x={-labelW(annLabel)/2} y="0" width={labelW(annLabel)} height="26"
              rx="13" fill={annFill}/>
        <text x="0" y="17" textAnchor="middle" fill="#fff" fontSize="12"
              fontWeight="700" fontFamily="Space Grotesk">{annLabel}</text>
        {useLeader ? (
          <line x1="0" y1="26" x2="0" y2={leaderY2}
                stroke={annFill} strokeWidth="2"
                strokeDasharray="3 3" strokeLinecap="round" opacity="0.75"/>
        ) : (
          <polygon points="-6,26 6,26 0,34" fill={annFill}/>
        )}
      </g>
    </svg>
  );
};

const HomeOSMMock = () => {
  const elRef = useR(null);
  const mapRef = useR(null);
  useE(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, {
      dragging: false, touchZoom: false, scrollWheelZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false,
      zoomControl: false, attributionControl: false,
      fadeAnimation: false, zoomAnimation: false, markerZoomAnimation: false,
    }).setView([-12.1180, -77.0300], 15);
    
    
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
    }).addTo(map);
    const pinIcon = L.divIcon({
      className: 'home-osm-pin',
      html: '<div class="ring"></div><div class="dot"></div>',
      iconSize: [22, 22], iconAnchor: [11, 11],
    });
    L.marker([-12.1180, -77.0300], { icon: pinIcon, interactive: false }).addTo(map);
    mapRef.current = map;
    return () => {
      map.stop();
      map.off();
      map.remove();
      mapRef.current = null;
    };
  }, []);
  return (
    <div className="home-osm">
      <div className="home-osm-map" ref={elRef}/>
      <div className="score-badge"><span className="dot"/>Score 72 · Medio-Alto</div>
      <div className="poi-chips"><span>Parque 150m</span><span>Paradero 300m</span><span>Tienda 600m</span></div>
    </div>
  );
};

const ZONA_COLOR = { ganga: '#22c55e', justo: '#f59e0b', inflado: '#ef4444' };
const ZONA_LABEL = { ganga: 'Precio bajo', justo: 'Precio justo', inflado: 'Precio alto' };

const DistrictMap = ({ onGo }) => {
  const elRef = useR(null), mapRef = useR(null), markersRef = useR({});
  const flyTimerRef = useR(null), lastFocusRef = useR(null);
  const [distritos, setDistritos] = useS([]);
  const [active, setActive] = useS(null); 

  useE(() => {
    const ctrl = new AbortController();
    Api.distritosZona({ signal: ctrl.signal })
      .then(r => { if (!ctrl.signal.aborted) setDistritos(r); })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  
  const markerR = (d, maxN) => 5 + (d.n / maxN) * 9;

  useE(() => {
    if (!elRef.current || mapRef.current || distritos.length === 0) return;
    const map = L.map(elRef.current, {
      scrollWheelZoom: false, doubleClickZoom: false, zoomControl: true,
      attributionControl: false,
      fadeAnimation: false, zoomAnimation: false, markerZoomAnimation: false,
    }).setView([-12.05, -77.02], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
    }).addTo(map);

    const maxN = Math.max(...distritos.map(d => d.n));
    distritos.forEach(d => {
      const col = ZONA_COLOR[d.zona] || '#94a3b8';
      const circle = L.circleMarker([d.lat, d.lng], {
        radius: markerR(d, maxN), color: '#fff', weight: 2,
        fillColor: col, fillOpacity: 0.9,
      }).addTo(map);
      circle.bindTooltip(
        `<b>${d.distrito}</b> · <span style="color:${col};font-weight:700">${ZONA_LABEL[d.zona]}</span><br/>` +
        `$${d.precio_mediano_usd}/mes · $${d.precio_m2}/m² · ${d.n} avisos`,
        { sticky: true, className: 'dist-tip' }
      );
      circle.on('mouseover', () => setActive(d));
      circle.on('mouseout',  () => setActive(null));
      markersRef.current[d.distrito] = { circle, baseR: markerR(d, maxN) };
    });
    mapRef.current = map;
    
    
    requestAnimationFrame(() => map.invalidateSize());
    let ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => { if (mapRef.current) mapRef.current.invalidateSize(); });
      ro.observe(elRef.current);
    }
    return () => {
      if (ro) ro.disconnect();
      if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
      map.stop();
      map.off();
      map.remove();
      mapRef.current = null; markersRef.current = {}; lastFocusRef.current = null;
    };
  }, [distritos]);

  
  const setDotStyle = (distrito, on) => {
    const m = markersRef.current[distrito];
    if (!m || !m.circle._map) return;   
    if (on) m.circle.setStyle({ weight: 4, radius: m.baseR + 4 }).bringToFront();
    else m.circle.setStyle({ weight: 2, radius: m.baseR });
  };

  
  const focusDistrito = (d) => {
    setActive(d);
    if (lastFocusRef.current && lastFocusRef.current !== d.distrito) setDotStyle(lastFocusRef.current, false);
    setDotStyle(d.distrito, true);
    lastFocusRef.current = d.distrito;
    if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
    flyTimerRef.current = setTimeout(() => {
      if (mapRef.current) mapRef.current.flyTo([d.lat, d.lng], 13, { duration: 0.5 });
    }, 130);   
  };
  const blurDistrito = (d) => {
    setActive(null);
    setDotStyle(d.distrito, false);
    if (lastFocusRef.current === d.distrito) lastFocusRef.current = null;
    if (flyTimerRef.current) { clearTimeout(flyTimerRef.current); flyTimerRef.current = null; }
  };

  const counts = { ganga: 0, justo: 0, inflado: 0 };
  distritos.forEach(d => { if (counts[d.zona] !== undefined) counts[d.zona]++; });
  
  const ranked = [...distritos].sort((a, b) => a.precio_m2 - b.precio_m2);

  return (
    <div className="home-section">
      <div className="home-eyebrow">Lima en tiempo real</div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', flexWrap:'wrap', gap:12, marginBottom:20 }}>
        <h2 className="home-h2" style={{ margin:0 }}>
          ¿En qué distritos conviene alquilar?
        </h2>
        <div style={{ display:'flex', gap:16 }}>
          {Object.entries(ZONA_COLOR).map(([zona, col]) => (
            <div key={zona} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'var(--ink-2)' }}>
              <span style={{ width:10, height:10, borderRadius:'50%', background:col, display:'inline-block' }}/>
              {ZONA_LABEL[zona]} <span style={{ color:'var(--ink-3)', fontWeight:400 }}>({counts[zona]})</span>
            </div>
          ))}
        </div>
      </div>

      {}
      <div style={{ display:'flex', flexWrap:'wrap', borderRadius:20, overflow:'hidden', border:'1px solid var(--line)', boxShadow:'var(--shadow-md)', background:'var(--surface)' }}>
        <div style={{ position:'relative', flex:'1 1 460px', minWidth:0 }}>
          <div ref={elRef} style={{ height:480 }}/>
          <button
            onClick={() => onGo('fairvalue-form')}
            style={{
              position:'absolute', bottom:16, right:16, zIndex:500,
              background:'var(--primary)', color:'#fff',
              border:'none', borderRadius:12, padding:'10px 18px',
              fontSize:13, fontWeight:700, cursor:'pointer',
              boxShadow:'0 4px 14px -4px oklch(0.42 0.15 250 / .55)',
              display:'flex', alignItems:'center', gap:8,
            }}>
            Analizar un inmueble <Icon name="arrow" size={14}/>
          </button>
        </div>

        <div style={{ flex:'1 1 300px', minWidth:0, maxWidth:380, borderLeft:'1px solid var(--line)', display:'flex', flexDirection:'column', maxHeight:480 }}>
          <div style={{ padding:'14px 18px 10px', borderBottom:'1px solid var(--line-2)' }}>
            <div style={{ fontWeight:700, fontSize:15 }}>Dónde conviene alquilar</div>
            <div className="tiny muted" style={{ marginTop:2 }}>Ordenado por $/m² · pasa el mouse y el mapa vuela</div>
          </div>
          <div style={{ overflowY:'auto' }}>
            {ranked.map((d, i) => {
              const col = ZONA_COLOR[d.zona] || '#94a3b8';
              const on = active && active.distrito === d.distrito;
              return (
                <div
                  key={d.distrito}
                  onMouseEnter={() => focusDistrito(d)}
                  onMouseLeave={() => blurDistrito(d)}
                  onClick={() => onGo('fairvalue-form')}
                  style={{
                    display:'flex', alignItems:'center', gap:12, padding:'10px 18px', cursor:'pointer',
                    background: on ? 'var(--bg-tint)' : 'transparent',
                    borderBottom:'1px solid var(--line-2)', transition:'background .15s',
                  }}>
                  <span className="numeric" style={{ fontSize:12, color:'var(--ink-3)', width:18, textAlign:'right' }}>{i + 1}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13.5, color:'var(--ink)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.distrito}</div>
                    <div className="tiny muted" style={{ marginTop:1 }}>{d.n} avisos · ${d.precio_mediano_usd}/mes</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div className="numeric" style={{ fontWeight:700, fontSize:14, color:'var(--ink)' }}>${d.precio_m2}<span className="tiny muted" style={{ fontWeight:400 }}>/m²</span></div>
                    <div style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:2, fontSize:11, fontWeight:600, color:col }}>
                      <span style={{ width:7, height:7, borderRadius:'50%', background:col }}/>{ZONA_LABEL[d.zona]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p style={{ fontSize:12, color:'var(--ink-3)', marginTop:10 }}>
        Precio por m² relativo a la mediana de Lima. Basado en {distritos.reduce((s,d)=>s+d.n,0)} avisos reales recolectados en 2026.
        Verde = por debajo del promedio · Rojo = por encima del promedio.
      </p>
    </div>
  );
};

export const HomeScreen = ({ onGo, onOpenListing, role, onPublish, user }) => {
  const isSeller = role === 'Propietario' || role === 'Agente inmobiliario';
  

  const [heroIdx, setHeroIdx] = useS(0);
  const [animatedPct, setAnimatedPct] = useS(0);
  const [poiData, setPoiData] = useS(null);

  const [gangas, setGangas] = useS(null);          

  useE(() => {
    const ctrl = new AbortController();
    Api.listListings({ zone: 'Ganga', sort: 'ganga', limit: 3 }, { signal: ctrl.signal })
      .then(r => { if (!ctrl.signal.aborted) setGangas(Array.isArray(r) ? r : []); })
      .catch(() => { if (!ctrl.signal.aborted) setGangas([]); });
    return () => ctrl.abort();
  }, []);

  const current = HERO_LISTINGS[heroIdx];
  const diffPct = (current.anuncio / current.fair - 1) * 100;
  const pct = Math.max(0, Math.min(1, 0.5 + diffPct / (2 * HERO_GAUGE_RANGE)));
  const zone = heroZoneOf(diffPct);
  const delta = current.anuncio - current.fair;
  const fmtDelta = (n) => `${n >= 0 ? '+' : '−'}$${Math.abs(n)}`;
  const fmtPct   = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

  useE(() => {
    const t = setTimeout(() => setAnimatedPct(pct), 80);
    return () => clearTimeout(t);
  }, [pct]);

  useE(() => {
    const id = setInterval(() => {
      setHeroIdx((i) => (i + 1) % HERO_LISTINGS.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  useE(() => {
    const ctrl = new AbortController();
    Api.poiImportance({ signal: ctrl.signal })
      .then(r => { if (!ctrl.signal.aborted) setPoiData(r.data); })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  return (
  <div className="container fade-in">

    {}
    <div className="home-hero">
      <div>
        <div className="home-eyebrow">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}/>
          Proptech con IA · Lima, Perú
        </div>
        <h1 className="home-h1">
          El precio justo de tu alquiler,{' '}
          <span className="home-grad">sin adivinar.</span>
        </h1>
        <p className="home-hero-lead">
          Wasi entrena modelos de IA con miles de avisos reales para decirte si un
          alquiler en Lima está <b>inflado, justo</b> o es una <b>oportunidad</b>{' '}
          — y cómo es el barrio alrededor.
        </p>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          {isSeller ? (
            <>
              <Btn variant="primary" size="lg" onClick={() => (onPublish ? onPublish() : onGo('publish'))}>
                Publicar inmueble <Icon name="arrow" size={16}/>
              </Btn>
              <Btn variant="outline" size="lg" onClick={() => onGo('fairvalue-form')}>
                Analizar un precio
              </Btn>
            </>
          ) : (
            <>
              <Btn variant="primary" size="lg" onClick={() => onGo('fairvalue-form')}>
                Probar una estimación <Icon name="arrow" size={16}/>
              </Btn>
              <Btn variant="outline" size="lg" onClick={() => onGo('listings')}>
                Explorar inmuebles
              </Btn>
            </>
          )}
        </div>
        <div style={{ margin: '20px 0 4px' }}>
          <a href="https://youtu.be/kPfQ3xvLldw" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', textDecoration: 'none' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
              <Icon name="play" size={12}/>
            </span>
            Ver trailer
          </a>
        </div>
        <div className="home-hero-stats">
          <div>
            <div className="v">{WASI_STATS.ALQ_AVISOS}</div>
            <div className="k">Avisos analizados</div>
          </div>
          <div>
            <div className="v">{WASI_STATS.DISTRITOS}</div>
            <div className="k">Distritos</div>
          </div>
          <div>
            <div className="v">{WASI_STATS.ALQ_MAPE}%</div>
            <div className="k"><Glossary term="Error medio"/></div>
          </div>
        </div>
      </div>

      <div className="hero-mock">
        <div className="hero-mock-head">
          <div key={'h-' + heroIdx} className="hero-mock-head-info">
            <div className="hero-mock-addr">{current.addr}, {current.dist}</div>
            <div className="hero-mock-meta">
              {current.area} m² · {current.dorm} hab · Piso {current.piso}
            </div>
          </div>
        </div>
        <div className="hero-mock-gauge"><HomeMiniGauge pct={animatedPct}/></div>
        <div key={'c-' + heroIdx} className="hero-mock-cards">
          <div className="hero-mock-card">
            <div className="k">Tu anuncio</div>
            <div className="v">${current.anuncio}</div>
          </div>
          <div className="hero-mock-card fair">
            <div className="k">Analizar precio</div>
            <div className="v">${current.fair}</div>
          </div>
        </div>
        <div key={'s-' + heroIdx} className={`hero-mock-status status-${zone}`}>
          <span className="dot"/>
          <div className="text">
            <span className="zone">{HERO_ZONE_LABEL[zone]}</span>
            <span className="sep">·</span>
            <span className="delta">
              {fmtDelta(delta)} ({fmtPct(diffPct)}) {HERO_ZONE_COPY[zone]}
            </span>
          </div>
        </div>
      </div>
    </div>

    {}
    <DistrictMap onGo={onGo}/>

    {}
    <div className="home-section">
      <div className="home-split">
        <div>
          <div className="home-eyebrow">El problema</div>
          <h2 className="home-h2" style={{ fontSize: 38 }}>Alquilar en Lima es decidir a ciegas.</h2>
          <p className="home-lead">
            No existe un precio de referencia público para los alquileres en el Perú.
            El inquilino no sabe si paga de más; el propietario no sabe cuánto pedir.
            La decisión termina siendo <b>intuición contra el precio del aviso</b>.
          </p>
          <div className="home-stats-pair">
            <div>
              <div className="v">+28%</div>
              <div className="k">Sobreprecio promedio detectado en anuncios</div>
            </div>
            <div>
              <div className="v">0</div>
              <div className="k">Fuentes públicas de precios en Perú</div>
            </div>
          </div>
        </div>

        <div className="histogram-card">
          <div key={'hh-head-' + heroIdx} className="head">
            Ejemplo ilustrativo · {current.dist} · {current.area} m²
          </div>
          <div key={'hh-' + heroIdx} className="histogram-anim">
            <HomeHistogram fair={current.fair} anuncio={current.anuncio}/>
          </div>
          <div className="tiny muted" style={{marginTop:6, textAlign:'center'}}>
            Demostración del veredicto. Analiza tu inmueble para ver datos reales.
          </div>
        </div>
      </div>
    </div>

    {}
    <div className="home-section">
      <div className="home-eyebrow">Qué hacemos</div>
      <h2 className="home-h2" style={{ fontSize: 38 }}>Dos módulos, una decisión informada.</h2>
      <p className="home-lead">
        Estimación de precio + análisis de entorno, conectados sobre los mismos datos.
      </p>
      <div className="home-modules">
        <div className="home-module" role="button" tabIndex={0} aria-label="Ir a Analizar precio: estimación de precio de referencia" onClick={() => onGo('fairvalue-form')} onKeyDown={onKeyActivate(() => onGo('fairvalue-form'))}>
          <div className="top">
            <div className="feat-ico ico-fv">
              <Icon name="key" size={26}/>
            </div>
          </div>
          <h3>Analizar precio</h3>
          <p className="desc">
            El modelo Wasi estima el precio de referencia comparando {WASI_STATS.VARIABLES} atributos
            contra {WASI_STATS.ALQ_AVISOS} avisos reales de Lima.
          </p>
          <div className="home-module-mock">
            <div className="row" style={{ gap: 16, alignItems: 'center' }}>
              <div style={{ width: 130, flexShrink: 0 }}>
                <HomeMiniGauge pct={0.78}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>Analizar precio</div>
                <div style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 700, color: 'var(--primary)', lineHeight: 1.1, marginTop: 4 }}>
                  $700 <span className="small muted" style={{ fontWeight: 500 }}>/mes</span>
                </div>
                <div className="tiny muted" style={{ marginTop: 4 }}>Confianza alta · error medio {WASI_STATS.ALQ_MAPE}%</div>
                <Tag variant="danger" style={{ marginTop: 8 }}>+28% inflado</Tag>
              </div>
            </div>
          </div>
          <span className="cta">Probar estimación <Icon name="fwd" size={14}/></span>
        </div>

        <div className="home-module" role="button" tabIndex={0} aria-label="Ir a Entorno y Seguridad: explorador de contexto del barrio" onClick={() => onGo('entorno-map')} onKeyDown={onKeyActivate(() => onGo('entorno-map'))}>
          <div className="top">
            <div className="feat-ico ico-en">
              <Icon name="shield" size={26}/>
            </div>
          </div>
          <h3>Entorno y Seguridad</h3>
          <p className="desc">
            Cruza criminalidad, POIs y servicios cercanos en un radio de 1 km para
            darte un score contextual del barrio.
          </p>
          <div className="home-module-mock accent">
            <HomeOSMMock/>
          </div>
          <span className="cta" style={{ color: 'oklch(0.40 0.10 195)' }}>Explorar mapa <Icon name="fwd" size={14}/></span>
        </div>
      </div>
    </div>

    {}
    <div className="home-howit">
      <div className="home-howit-inner">
        <div className="home-eyebrow">Cómo funciona</div>
        <h2 className="home-h2" style={{ fontSize: 38 }}>De una ubicación a un veredicto, en segundos.</h2>
        <div className="home-howit-grid">
          <div className="home-step-big">
            <div className="num">1</div>
            <h4>Ubicación y datos</h4>
            <p>Marcas el inmueble en el mapa e ingresas área, dormitorios, baños y amenities.</p>
            <div className="home-step-chip">
              <Icon name="pin" size={14} stroke="var(--primary)"/>
              Miraflores · 60 m² · 2 hab
            </div>
          </div>
          <div className="home-step-big">
            <div className="num">2</div>
            <h4>El modelo compara</h4>
            <p>El modelo Wasi cruza los datos contra {WASI_STATS.ALQ_AVISOS} avisos reales de alquiler en Lima.</p>
            <div className="home-step-chip">
              <Icon name="chart" size={14} stroke="var(--primary)"/>
              Modelo Wasi · error medio {WASI_STATS.ALQ_MAPE}%
            </div>
          </div>
          <div className="home-step-big">
            <div className="num">3</div>
            <h4>Veredicto claro</h4>
            <p>Obtienes el precio de referencia y si el anuncio está inflado, justo o es ganga.</p>
            <div className="home-step-chip">
              <Icon name="check" size={14} stroke="var(--success)"/>
              <span>Analizar precio:&nbsp;<b style={{ color: 'var(--primary)' }}>$700</b></span>
              <Tag variant="success" style={{ marginLeft: 'auto' }}>Ganga</Tag>
            </div>
          </div>
        </div>
      </div>
    </div>

    {}
    <div className="home-section">
      <div className="home-split">
        <div>
          <div className="home-eyebrow">Cómo nacimos</div>
          <h2 className="home-h2" style={{ fontSize: 38 }}>De un proyecto universitario a una herramienta real.</h2>
          <p className="home-lead">
            Wasi nació en el curso de <b>Diseño y Proyectos de Datos (DPD)</b> de UTEC.
            Fusiona dos trabajos: una aplicación de estimación de precios y un pipeline
            de machine learning entrenado sobre el mercado de alquiler limeño.
          </p>
          <p className="home-lead" style={{ marginTop: 12 }}>
            El reto no era solo entrenar un modelo — era llevarlo a un producto que{' '}
            <b>cualquier persona</b> pueda usar para tomar una mejor decisión.
          </p>
        </div>
        <div className="bc-card">
          <div className="bc-head">Bajo el capot</div>
          {[
            ['layers', 'fv', 'Modelo + producto',    'Pipeline de ML integrado a una app usable'],
            ['map',    'en', 'Datos reales de Lima', 'Avisos de Urbania, AdondeVivir y Properati'],
            ['check',  'ok', 'Curso DPD · UTEC',     'Diseño y Proyectos de Datos'],
          ].map(([ic, variant, t, d]) => (
            <div key={t} className="bc-item">
              <div className={`bc-ico bc-ico-${variant}`}>
                <Icon name={ic} size={20}/>
              </div>
              <div>
                <div className="bc-t">{t}</div>
                <div className="bc-d">{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {}
    <div className="home-section">
      <div className="home-eyebrow">Misión y objetivos</div>
      <div className="home-quote">
        Democratizar el acceso a información de precios de alquiler en Lima, para que{' '}
        <span className="home-grad">inquilinos y propietarios decidan con datos</span>{' '}
        y no con intuición.
      </div>
      <div className="home-objectives">
        {[
          ['Precio de referencia confiable',    'Por ubicación exacta, no por distrito promedio'],
          ['Reducir la asimetría de información', 'El inquilino sabe tanto como el agente'],
          ['Contexto del barrio integrado',     'Seguridad y servicios, no solo precio'],
          ['Honestos sobre el margen de error', `Error medio ${WASI_STATS.ALQ_MAPE}%, comunicado en cada predicción`],
        ].map(([t, d]) => (
          <div key={t} className="home-obj">
            <span className="check"><Icon name="check" size={16}/></span>
            <div>
              <div className="t">{t}</div>
              <div className="d">{d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {}
    <div className="home-data-section">
      <div className="home-data-inner">
        <div className="home-eyebrow on-dark">La data detrás</div>
        <h2 className="home-h2 on-dark" style={{ fontSize: 38 }}>
          Construido sobre <span className="home-grad-cyan">evidencia</span>, no opiniones.
        </h2>
        <div className="home-data-row">
          {[
            [WASI_STATS.ALQ_AVISOS, null, 'Avisos de alquiler analizados de Urbania, AdondeVivir y Properati'],
            [WASI_STATS.DISTRITOS,  null, 'Distritos de Lima Metropolitana con cobertura'],
            [WASI_STATS.ALQ_MAPE,   '%',  'Error medio del modelo, validación espacial — Modelo Wasi v2'],
            [WASI_STATS.VARIABLES,  null, 'Variables por inmueble — físicas, geográficas, NSE y de seguridad'],
          ].map(([v, suf, k], i) => (
            <div key={i}>
              <div className="v">{v}{suf && <span className="sm">{suf}</span>}</div>
              <div className="bar"/>
              <div className="k">{k}</div>
            </div>
          ))}
        </div>

        {}
        <p style={{
          marginTop: 32, color: 'rgba(255,255,255,.65)',
          fontSize: 14, lineHeight: 1.65, maxWidth: 880,
        }}>
          <strong style={{color:'#fff'}}>Sobre la cobertura:</strong>{' '}
          el mercado de alquiler en Lima está centralizado: el 41% de los avisos vienen
          de Miraflores y San Isidro. Para zonas residenciales premium con pocos avisos
          (La Molina, San Borja Alto, Surco Las Casuarinas), complementamos la
          predicción con datos socioeconómicos del INEI/APEIM y de seguridad del MININTER.
          Cuando una zona tiene menos de 20 comparables cercanos, el modelo te lo avisa
          y amplía el rango de error.
        </p>
      </div>
    </div>

    {}
    {poiData && poiData.length > 0 && (
      <div className="home-section">
        <div className="home-split" style={{ alignItems: 'flex-start', gap: 48 }}>
          <div style={{ flex: '0 0 340px' }}>
            <div className="home-eyebrow">Entorno y precio</div>
            <h2 className="home-h2" style={{ fontSize: 32, marginBottom: 12 }}>
              ¿Qué tipo de entorno impacta más el precio?
            </h2>
            <p className="home-lead" style={{ marginTop: 0 }}>
              Importancia real de cada tipo de entorno dentro del modelo, sobre 101
              variables. Los POIs representan{' '}
              <b>{poiData.reduce((s, d) => s + d.pct, 0).toFixed(1)}%</b> del poder
              predictivo total — el resto lo explican la ubicación, el área y los amenities.
            </p>
            <p className="home-lead" style={{ marginTop: 8, fontSize: 13 }}>
              Parques y parqueos lideran: su presencia o ausencia mueve el precio
              más que la proximidad a supermercados o malls.
            </p>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <PoiImportanceD3 data={poiData}/>
            <p style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-3)' }}>
              Importancia agregada por categoría — suma de todas las features POI
              de cada tipo dividida entre la importancia total del modelo.
            </p>
          </div>
        </div>
      </div>
    )}

    {}
    <div className="home-section">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <div className="home-eyebrow">Oportunidades</div>
            <h2 className="home-h2" style={{ fontSize: 38, marginBottom: 0 }}>Las mejores gangas ahora.</h2>
          </div>
          <Btn variant="outline" onClick={() => onGo('listings')}>
            Ver todos <Icon name="fwd" size={14}/>
          </Btn>
        </div>
      {gangas === null ? (
        <p className="muted small">Buscando las mejores oportunidades…</p>
      ) : gangas.length === 0 ? (
        <p className="muted small">No hay gangas disponibles ahora mismo. Vuelve a revisar pronto.</p>
      ) : (
        <div className="home-gangas-grid">
          {gangas.map(l => (
            <ListingCard key={l.id} listing={l} onOpen={onOpenListing}/>
          ))}
        </div>
      )}
    </div>

    {}
    <div className="home-section" style={{ marginBottom: 12 }}>
      <div className="home-cta-final">
        <div>
          <h2>¿Listo para ver un precio justo?</h2>
          <p>
            Haz tu primera estimación. Tarda menos de un minuto
            y no necesitas registrarte de nuevo.
          </p>
        </div>
        <div className="btns">
          <button className="btn btn-light btn-lg" onClick={() => onGo('fairvalue-form')}>
            Probar estimación <Icon name="arrow" size={16}/>
          </button>
          <button className="btn btn-ghost btn-lg" onClick={() => onGo('entorno-map')}>
            Ver el mapa primero
          </button>
        </div>
      </div>
    </div>

  </div>
  );
};

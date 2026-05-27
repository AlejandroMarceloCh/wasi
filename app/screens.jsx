/* Justa — screens (web app) */
const { useState: useS, useEffect: useE, useRef: useR } = React;

/* bbox de Lima Metropolitana (igual que el backend) */
const LIMA_BBOX = { latMin:-12.5, latMax:-11.7, lngMin:-77.2, lngMax:-76.7 };
const enLima = (lat,lng) =>
  lat>=LIMA_BBOX.latMin && lat<=LIMA_BBOX.latMax &&
  lng>=LIMA_BBOX.lngMin && lng<=LIMA_BBOX.lngMax;
const LIMA_CENTRO = { lat:-12.0908, lng:-77.0270 };  // Lima centro aprox.

/* MapPicker — mapa Leaflet con pin arrastrable. El pin es la fuente de
   verdad de lat/lng; onMove(lat,lng) se dispara al arrastrar o clickear. */
const MapPicker = ({ lat, lng, onMove, className }) => {
  const elRef = useR(null), mapRef = useR(null), cbRef = useR(onMove);
  cbRef.current = onMove;
  useE(() => {
    if (!elRef.current || mapRef.current || !window.L) return;
    const map = L.map(elRef.current).setView([lat, lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map);
    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    const emit = () => {
      const p = marker.getLatLng();
      if (cbRef.current) cbRef.current(+p.lat.toFixed(6), +p.lng.toFixed(6));
    };
    marker.on('dragend', emit);
    map.on('click', (e) => { marker.setLatLng(e.latlng); emit(); });
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 120);  // Leaflet necesita esto
    return () => { map.remove(); mapRef.current = null; };
  }, []);
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

/* ============== 1. SPLASH / LANDING ============== */
const SplashScreen = ({ onStart, onLogin }) => (
  <div className="fade-in">
    <div className="splash">
      <div className="container">
        <div>
          <Tag variant="primary" style={{marginBottom: 18, display:'inline-flex'}}>
            <span style={{width:6, height:6, borderRadius:'50%', background:'currentColor'}}/>
            Proptech con IA · Lima, Perú
          </Tag>
          <h1>Decide tu alquiler con un <em>precio de referencia</em> y datos reales.</h1>
          <p className="lede">
            ubIcA estima el valor de mercado de cualquier departamento en Lima usando modelos de IA, y lo cruza con el contexto de seguridad y servicios del barrio. Para inquilinos, propietarios, agentes e inversionistas.
          </p>
          <div className="cta-row">
            <Btn variant="primary" size="lg" onClick={onStart}>
              Comenzar gratis <Icon name="arrow" size={16}/>
            </Btn>
            <Btn variant="outline" size="lg" onClick={onLogin}>Ya tengo cuenta</Btn>
          </div>
          <div className="features">
            <div className="feature-card">
              <div className="icowrap"><Icon name="key" size={20}/></div>
              <div>
                <div className="t">Fair Value</div>
                <div className="d">Precio de referencia con XGBoost v2 · MAPE 15,7%</div>
              </div>
            </div>
            <div className="feature-card">
              <div className="icowrap"><Icon name="shield" size={20}/></div>
              <div>
                <div className="t">Seguridad</div>
                <div className="d">Score de entorno y análisis de criminalidad en 1 km</div>
              </div>
            </div>
            <div className="feature-card span-2">
              <div className="row" style={{gap:14}}>
                <div className="icowrap"><Icon name="map" size={20}/></div>
                <div className="grow">
                  <div className="t">Mapa geoespacial de POIs</div>
                  <div className="d">Parques, transporte, salud, comercios — todos los servicios cercanos en una capa.</div>
                </div>
                <Tag variant="outline">Geo</Tag>
              </div>
            </div>
          </div>
        </div>

        <div className="splash-visual">
          <div className="row" style={{justifyContent:'space-between'}}>
            <Tag variant="primary">Demo</Tag>
            <span className="tiny muted">Av. Pardo 245 · Miraflores</span>
          </div>
          <Card className="compact" style={{padding: 16}}>
            <GaugeChart fairValue={700} diffPct={28.6} zone="Inflado"/>
          </Card>
          <div className="grid-2">
            <Card className="compact" style={{padding:14}}>
              <div className="tiny muted" style={{textTransform:'uppercase', letterSpacing:'.08em', fontWeight:600}}>Tu anuncio</div>
              <div className="numeric" style={{fontSize: 22, fontWeight:700, marginTop:4}}>$900</div>
            </Card>
            <Card className="compact" style={{padding:14, borderColor:'oklch(0.42 0.15 250 / .2)'}}>
              <div className="tiny" style={{color:'var(--primary)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:600}}>Precio ref.</div>
              <div className="numeric" style={{fontSize: 22, fontWeight:700, marginTop:4, color:'var(--primary)'}}>$700</div>
            </Card>
          </div>
          <Card accent="danger" className="compact" style={{padding:14}}>
            <div className="row">
              <div className="grow">
                <div className="tiny muted">Diferencia</div>
                <div style={{fontWeight:700, color:'var(--danger)'}}>+$200 · 28.6% por encima</div>
              </div>
              <Tag variant="danger">Negociable</Tag>
            </div>
          </Card>
        </div>
      </div>
    </div>
  </div>
);

/* ============== 2. AUTH ============== */
const AuthScreen = ({ onAuth, initialMode = 'login', onError }) => {
  const [mode, setMode] = useS(initialMode);
  useE(() => setMode(initialMode), [initialMode]);
  // Pre-rellena credenciales demo en login
  const [form, setForm] = useS({ email:'ana@ubica.pe', password:'demo1234', name:'', role:'Inquilino' });
  const [submitting, setSubmitting] = useS(false);
  const [err, setErr] = useS('');

  const onSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSubmitting(true); setErr('');
    try {
      if (mode === 'login') await Api.login({ email: form.email, password: form.password });
      else await Api.register({ email: form.email, name: form.name, password: form.password });
      onAuth();
    } catch (ex) {
      const msg = (ex && ex.message) || 'Error al autenticar';
      setErr(msg);
      if (typeof onError === 'function') onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell fade-in">
      <div className="auth-side">
        <Logo/>
        <div>
          <h2>Datos en lugar de corazonadas para tu próximo alquiler.</h2>
          <p className="quote">
            ubIcA cruza miles de listings, índices de criminalidad y POIs para darte una sola lectura: el precio de referencia de la zona y si vale la pena el barrio.
          </p>
          <div className="quote-cite">
            <div className="avatar">M</div>
            <div>
              <div style={{fontWeight:600}}>María Fernández</div>
              <div style={{opacity:.8}}>Agente Inmobiliaria · San Isidro</div>
            </div>
          </div>
        </div>
        <div className="row" style={{gap:24, opacity:.85, fontSize:12}}>
          <span>● XGBoost v2</span>
          <span>● 3.348 avisos Lima</span>
          <span>● MAPE 15,7%</span>
        </div>
      </div>
      <div className="auth-form">
        <form className="auth-form-inner" onSubmit={onSubmit}>
          <h2 style={{margin:'0 0 6px', fontFamily:'Space Grotesk', fontSize:24, letterSpacing:'-0.02em'}}>
            {mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta gratis'}
          </h2>
          <p className="small muted" style={{margin:'0 0 22px'}}>
            {mode === 'login' ? 'Accede a tus análisis y reportes guardados.' : 'Comienza a evaluar precios y entornos en segundos.'}
          </p>
          <div className="auth-tabs">
            <button type="button" className={mode==='login' ? 'active':''} onClick={()=>setMode('login')}>Login</button>
            <button type="button" className={mode==='register' ? 'active':''} onClick={()=>setMode('register')}>Registro</button>
          </div>
          <div className="stack-12">
            {mode==='register' && (
              <Input label="Nombre completo" placeholder="Ana García" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})}/>
            )}
            <Input label="Email" type="email" placeholder="tu@correo.com" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})}/>
            <Input label="Contraseña" type="password" placeholder="••••••••" value={form.password} onChange={(e)=>setForm({...form, password:e.target.value})}/>
            {mode==='register' && (
              <Select
                label="Tipo de usuario"
                value={form.role}
                onChange={(v)=>setForm({...form, role:v})}
                options={['Inquilino','Propietario / Arrendador','Agente Inmobiliario','Inversionista']}
              />
            )}
            {mode==='login' && (
              <div style={{textAlign:'right', marginTop:-4}}>
                <a style={{fontSize:12, color:'var(--primary)', fontWeight:600, textDecoration:'none', cursor:'pointer'}}>¿Olvidaste tu contraseña?</a>
              </div>
            )}
            {err && <div className="field-err banner danger"><Icon name="alert" size={14}/> {err}</div>}
            <Btn variant="primary" block size="lg" type="submit" disabled={submitting} onClick={onSubmit}>
              {submitting ? 'Procesando…' : (mode==='login' ? 'Iniciar Sesión' : 'Crear cuenta')}
            </Btn>
            <div style={{textAlign:'center', fontSize: 13, color:'var(--ink-3)', padding:'4px'}}>
              {mode==='login' ? '¿Nuevo en ubIcA? ' : '¿Ya tienes cuenta? '}
              <a style={{color:'var(--primary)', fontWeight:600, cursor:'pointer'}} onClick={()=>setMode(mode==='login' ? 'register' : 'login')}>
                {mode==='login' ? 'Regístrate' : 'Inicia sesión'}
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============== 2.5 HOME — landing del producto (rediseño Claude Design) ============== */

/* Mini-gauge usado dentro del hero-mock y del card de Fair Value del Home.
   La aguja apunta arriba en su forma base (de (CX,CY) a (CX,CY-R)) y se
   rota según pct: pct=0 → -90° (Ganga, izquierda), pct=0.5 → 0° (Justo),
   pct=1 → +90° (Inflado, derecha). La transición CSS hace la animación. */
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

/* Diccionario rotativo del hero. 10 entradas mezclando Ganga / Justo / Inflado
   para que el hero muestre la diversidad del producto. La zona se calcula en
   runtime con el mismo ZONE_BAND_PCT=8 que usa el backend (ml.py). */
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
const HERO_ZONE_BAND_PCT  = 8;    // == backend ml.ZONE_BAND_PCT
const HERO_GAUGE_RANGE    = 35;   // ±35% → mapea a [0,1] del gauge (rango
                                  // visual; permite diferenciar inflados
                                  // fuertes entre sí sin saturarse en +90°)
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

/* Histograma bell-curve para la sección "El problema". Recibe el listing
   actual y deriva: rango del eje X centrado en `fair`, en qué barra cae
   `anuncio`, y los badges flotantes FAIR / ANUNCIO con sus posiciones x. */
const HomeHistogram = ({ fair = 700, anuncio = 900 }) => {
  const PAD_X = 30, BAR_W = 36, GAP = 6;
  const Y_BASE = 200, Y_MAX = 150;
  const SVG_W  = 600;

  // Rango simétrico alrededor de fair, redondeado a $50.
  const xMin = Math.max(50, Math.round((fair * 0.55) / 50) * 50);
  const xMax = 2 * fair - xMin;
  const span = xMax - xMin;
  const priceToBar = (p) => Math.round((p - xMin) / span * 12);
  const xOfBar = (i) => PAD_X + i * (BAR_W + GAP) + BAR_W / 2;
  const xOfPrice = (p) => {
    const t = Math.max(0, Math.min(1, (p - xMin) / span));
    return PAD_X + BAR_W / 2 + t * 12 * (BAR_W + GAP);
  };

  const fairBar = priceToBar(fair);                              // ~6
  const annBar  = Math.max(0, Math.min(12, priceToBar(anuncio))); // clamp
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

  // 5 ticks equidistantes en el eje X, redondeados a $50.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const price = Math.round((xMin + t * span) / 50) * 50;
    return { price, x: xOfPrice(price) };
  });

  const fmt$ = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
  const annLabel  = `ANUNCIO · ${fmt$(anuncio)}`;
  const fairLabel = `FAIR · ${fmt$(fair)}`;
  // Ancho dinámico del rect según largo del label (caracteres × ancho aprox).
  const labelW = (s) => Math.max(80, s.length * 7.2 + 18);

  // Dos motivos para reemplazar el triangle por leader line dashed:
  //   1. overlap horizontal entre badges (precios cercanos → ANUNCIO sube).
  //   2. la barra del anuncio es chica (cola de la distribución) y el triangle
  //      flotaría en el aire antes de llegar a ella.
  const fairX = xOfPrice(fair);
  const annX  = xOfPrice(anuncio);
  const minSep  = (labelW(fairLabel) + labelW(annLabel)) / 2 + 10;
  const overlap = Math.abs(annX - fairX) < minSep;

  const annBarH = 100 * Math.exp(-Math.pow((annBar - 6) / 3.2, 2)) / 100 * Y_MAX;
  const annBarTopY = Y_BASE - annBarH;
  // Distancia entre el tip del triangle (y=46 si está a nivel normal) y el top
  // de la barra. Si supera ~30 px, el tip se ve "suelto" → mejor leader line.
  const ANN_Y_NORMAL  = 12;
  const ANN_Y_STACKED = -34;
  const gapToBar = annBarTopY - (ANN_Y_NORMAL + 34);
  const farFromBar = gapToBar > 30;
  const useLeader = overlap || farFromBar;

  // ANUNCIO sube de nivel solo si hay overlap; si solo es "lejos de la barra",
  // se queda al nivel normal pero con leader line en vez de triangle.
  const annY = overlap ? ANN_Y_STACKED : ANN_Y_NORMAL;
  const leaderY2 = annBarTopY - 4 - annY;   // en coords locales del <g>

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
      {/* Badge FAIR — siempre primary, siempre en nivel normal con triangle */}
      <g transform={`translate(${fairX.toFixed(1)}, 12)`}>
        <rect x={-labelW(fairLabel)/2} y="0" width={labelW(fairLabel)} height="26"
              rx="13" fill="var(--primary)"/>
        <text x="0" y="17" textAnchor="middle" fill="#fff" fontSize="12"
              fontWeight="700" fontFamily="Space Grotesk">{fairLabel}</text>
        <polygon points="-6,26 6,26 0,34" fill="var(--primary)"/>
      </g>
      {/* Badge ANUNCIO — sube un nivel cuando hay overlap y conecta con leader line */}
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

/* Mini-mapa Leaflet (read-only) sobre Miraflores con un pin pulsante y los
   overlays de score + POI chips encima. Reemplaza al mock CSS que se veía mal.
   Se monta una sola vez, queda quieto (todos los gestos desactivados). */
const HomeOSMMock = () => {
  const elRef = useR(null);
  const mapRef = useR(null);
  useE(() => {
    if (!elRef.current || mapRef.current || !window.L) return;
    const map = L.map(elRef.current, {
      dragging: false, touchZoom: false, scrollWheelZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false,
      zoomControl: false, attributionControl: false,
    }).setView([-12.1180, -77.0300], 15);
    // Carto Positron: tiles construidos sobre el mismo dato de OSM pero con
    // styling minimalista (blanco / gris / azul muy suave). Mejor combina con
    // la estética editorial del Home que el tile raw de osm.org.
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
    return () => { map.remove(); mapRef.current = null; };
  }, []);
  return (
    <div className="home-osm">
      <div className="home-osm-map" ref={elRef}/>
      <div className="score-badge"><span className="dot"/>Score 72 · Medio-Alto</div>
      <div className="poi-chips"><span>🌳 150m</span><span>🚌 300m</span><span>🏪 600m</span></div>
    </div>
  );
};

const HomeScreen = ({ onGo }) => {
  /* Rotación del hero-mock: cada 5,5 s salta al siguiente listing.
     animatedPct arranca en 0 y al primer paint salta al pct real → la
     transición CSS del SVG hace la animación de entrada de la aguja. */
  const [heroIdx, setHeroIdx] = useS(0);
  const [animatedPct, setAnimatedPct] = useS(0);

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

  return (
  <div className="container fade-in">

    {/* HERO */}
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
          ubIcA entrena modelos de IA con miles de avisos reales para decirte si un
          alquiler en Lima está <b>inflado, justo</b> o es una <b>oportunidad</b>{' '}
          — y cómo es el barrio alrededor.
        </p>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <Btn variant="primary" size="lg" onClick={() => onGo('fairvalue-form')}>
            Probar una estimación <Icon name="arrow" size={16}/>
          </Btn>
          <Btn variant="outline" size="lg" onClick={() => onGo('entorno-map')}>
            Explorar el mapa
          </Btn>
        </div>
        <div className="home-hero-stats">
          <div>
            <div className="v">3,348</div>
            <div className="k">Avisos analizados</div>
          </div>
          <div>
            <div className="v">40</div>
            <div className="k">Distritos</div>
          </div>
          <div>
            <div className="v">15.7%</div>
            <div className="k"><Glossary term="MAPE"/></div>
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
            <div className="k">Fair Value</div>
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

    {/* EL PROBLEMA */}
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
            Distribución real · {current.dist} · {current.area} m²
          </div>
          <div key={'hh-' + heroIdx} className="histogram-anim">
            <HomeHistogram fair={current.fair} anuncio={current.anuncio}/>
          </div>
        </div>
      </div>
    </div>

    {/* QUÉ HACEMOS */}
    <div className="home-section">
      <div className="home-eyebrow">Qué hacemos</div>
      <h2 className="home-h2" style={{ fontSize: 38 }}>Dos módulos, una decisión informada.</h2>
      <p className="home-lead">
        Estimación de precio + análisis de entorno, conectados sobre los mismos datos.
      </p>
      <div className="home-modules">
        <div className="home-module" role="button" tabIndex={0} aria-label="Ir a Fair Value: estimación de precio de referencia" onClick={() => onGo('fairvalue-form')} onKeyDown={onKeyActivate(() => onGo('fairvalue-form'))}>
          <div className="top">
            <div className="feat-ico ico-fv">
              <Icon name="key" size={26}/>
            </div>
          </div>
          <h3>Fair Value</h3>
          <p className="desc">
            XGBoost v2 estima el precio de referencia comparando 74 atributos
            contra 3,348 avisos reales de Lima.
          </p>
          <div className="home-module-mock">
            <div className="row" style={{ gap: 16, alignItems: 'center' }}>
              <div style={{ width: 130, flexShrink: 0 }}>
                <HomeMiniGauge pct={0.78}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>Fair Value</div>
                <div style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 700, color: 'var(--primary)', lineHeight: 1.1, marginTop: 4 }}>
                  $700 <span className="small muted" style={{ fontWeight: 500 }}>/mes</span>
                </div>
                <div className="tiny muted" style={{ marginTop: 4 }}>Confianza alta · MAPE 15.7%</div>
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

    {/* CÓMO FUNCIONA — full-bleed */}
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
            <p>XGBoost v2 cruza los datos contra 3,348 avisos reales de alquiler en Lima.</p>
            <div className="home-step-chip">
              <Icon name="chart" size={14} stroke="var(--primary)"/>
              XGBoost v2 · MAPE 15.7%
            </div>
          </div>
          <div className="home-step-big">
            <div className="num">3</div>
            <h4>Veredicto claro</h4>
            <p>Obtienes el precio de referencia y si el anuncio está inflado, justo o es ganga.</p>
            <div className="home-step-chip">
              <Icon name="check" size={14} stroke="var(--success)"/>
              <span>Fair Value:&nbsp;<b style={{ color: 'var(--primary)' }}>$700</b></span>
              <Tag variant="success" style={{ marginLeft: 'auto' }}>Ganga</Tag>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* CÓMO NACIMOS */}
    <div className="home-section">
      <div className="home-split">
        <div>
          <div className="home-eyebrow">Cómo nacimos</div>
          <h2 className="home-h2" style={{ fontSize: 38 }}>De un proyecto universitario a una herramienta real.</h2>
          <p className="home-lead">
            ubIcA nació en el curso de <b>Diseño y Proyectos de Datos (DPD)</b> de UTEC.
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

    {/* MISIÓN Y OBJETIVOS — quote + grid 2x2 */}
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
          ['Honestos sobre el margen de error', 'MAPE 15.7%, comunicado en cada predicción'],
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

    {/* LA DATA DETRÁS — sección full-bleed con fondo oscuro y números masivos */}
    <div className="home-data-section">
      <div className="home-data-inner">
        <div className="home-eyebrow on-dark">La data detrás</div>
        <h2 className="home-h2 on-dark" style={{ fontSize: 38 }}>
          Construido sobre <span className="home-grad-cyan">evidencia</span>, no opiniones.
        </h2>
        <div className="home-data-row">
          {[
            ['3,348',  null, 'Avisos de alquiler analizados de Urbania, AdondeVivir y Properati'],
            ['40',     null, 'Distritos de Lima Metropolitana con cobertura'],
            ['15.7',   '%',  'Error medio del modelo (MAPE) en test — XGBoost v2'],
            ['95',     null, 'Variables por inmueble — físicas, geográficas, NSE y de seguridad'],
          ].map(([v, suf, k], i) => (
            <div key={i}>
              <div className="v">{v}{suf && <span className="sm">{suf}</span>}</div>
              <div className="bar"/>
              <div className="k">{k}</div>
            </div>
          ))}
        </div>

        {/* Honestidad sobre el desbalance del mercado limeño */}
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

    {/* CTA FINAL — gradiente azul oscuro grande */}
    <div className="home-section" style={{ marginBottom: 12 }}>
      <div className="home-cta-final">
        <div>
          <h2>¿Listo para ver un precio justo?</h2>
          <p>
            Entra a Operaciones y haz tu primera estimación. Tarda menos de un minuto
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

/* ============== 3. DASHBOARD / OPERACIONES ============== */
// Info de cada módulo para la isla flotante de confirmación
const MODULE_INFO = {
  fairvalue: {
    screen: 'fairvalue-form',
    icon: 'key',
    iconVariant: 'primary',
    title: 'Fair Value',
    subtitle: 'Estimador de precio de referencia',
    intro: 'Vas a estimar cuánto debería costar el alquiler de un inmueble según el mercado real de Lima.',
    points: [
      'Marca la ubicación exacta del inmueble en el mapa',
      'Ingresa área, dormitorios, baños y amenities',
      'El modelo XGBoost v2 calcula el precio de referencia',
      'Descubre si el precio anunciado está Inflado, Justo o es Ganga',
    ],
    cta: 'Iniciar estimación',
  },
  entorno: {
    screen: 'entorno-map',
    icon: 'shield',
    iconVariant: 'accent',
    title: 'Entorno y Seguridad',
    subtitle: 'Explorador de contexto del barrio',
    intro: 'Vas a explorar la seguridad y los servicios de cualquier zona de Lima Metropolitana.',
    points: [
      'Coloca un pin en cualquier punto del mapa',
      'Consulta el score de seguridad de la zona',
      'Revisa los puntos de interés en un radio de 1 km',
      'Compara colegios, hospitales, bancos y parques cercanos',
    ],
    cta: 'Explorar mapa',
  },
};

// Modal de "Análisis recientes": filtros y paginación
const ANA_PER_PAGE = 8;
const ANA_FILTERS = [
  { key: 'all',     label: 'Todos' },
  { key: 'Inflado', label: 'Inflados' },
  { key: 'Ganga',   label: 'Gangas' },
  { key: 'Justo',   label: 'Justos' },
];

const DashboardScreen = ({ onGo, onOpenAnalysis, onError, onAuthExpired }) => {
  const [data, setData] = useS(null);
  const [loading, setLoading] = useS(true);
  const [err, setErr] = useS('');
  const [confirm, setConfirm] = useS(null);   // 'fairvalue' | 'entorno' | null
  const [covPage, setCovPage] = useS(0);      // página de cobertura por distrito
  // Modal de análisis recientes
  const [anaOpen, setAnaOpen]     = useS(false);
  const [anaAll, setAnaAll]       = useS([]);
  const [anaLoading, setAnaLoading] = useS(false);
  const [anaPage, setAnaPage]     = useS(0);
  const [anaFilter, setAnaFilter] = useS('all');

  useE(() => {
    let cancel = false;
    setLoading(true);
    Api.dashboard()
      .then(r => { if (!cancel) { setData(r); setLoading(false); } })
      .catch(ex => {
        if (cancel) return;
        const msg = handleApiErr(ex, { setErr, onAuthExpired });
        if (typeof onError === 'function') onError(msg);
        setLoading(false);
      });
    return () => { cancel = true; };
  }, []);

  if (loading) return <Loading label="Cargando dashboard…"/>;
  if (err || !data) return (
    <div className="container"><div className="banner danger"><Icon name="alert" size={14}/> {err || 'Sin datos'}</div></div>
  );

  const user = data.user || {};
  const stats = data.stats || { analyses_count: 0, reports_count: 0, avg_savings: 0 };
  const recent = Array.isArray(data.recent) ? data.recent : [];
  const coverage = Array.isArray(data.coverage) ? data.coverage : [];
  const COV_PER_PAGE = 5;
  const covTotalPages = Math.max(1, Math.ceil(coverage.length / COV_PER_PAGE));
  const covPageSafe = Math.min(covPage, covTotalPages - 1);
  const covSlice = coverage.slice(covPageSafe * COV_PER_PAGE, covPageSafe * COV_PER_PAGE + COV_PER_PAGE);
  const nextStep = data.next_step;
  const levelToVar = (lvl) => lvl === 'alta' ? 'success' : lvl === 'media' ? 'warning' : 'danger';
  const levelLabel = (lvl) => lvl === 'alta' ? 'Alta' : lvl === 'media' ? 'Media' : 'Baja';

  // ----- Análisis recientes (modal) -----
  const anaFiltered = anaFilter === 'all' ? anaAll : anaAll.filter(a => a.zone === anaFilter);
  const anaTotalPages = Math.max(1, Math.ceil(anaFiltered.length / ANA_PER_PAGE));
  const anaPageSafe = Math.min(anaPage, anaTotalPages - 1);
  const anaSlice = anaFiltered.slice(anaPageSafe * ANA_PER_PAGE, anaPageSafe * ANA_PER_PAGE + ANA_PER_PAGE);

  const openAnalysesModal = () => {
    setAnaOpen(true);
    if (anaAll.length === 0 && !anaLoading) {
      setAnaLoading(true);
      Api.listAnalyses()
        .then(r => setAnaAll(Array.isArray(r) ? r : []))
        .catch(ex => {
          const msg = handleApiErr(ex, { setErr, onAuthExpired });
          if (typeof onError === 'function') onError(msg);
        })
        .finally(() => setAnaLoading(false));
    }
  };
  const openAnalysisRow = (r) => {
    setAnaOpen(false);
    if (onOpenAnalysis && r && r.id) onOpenAnalysis(r.id, { address: r.address });
  };

  return (
    <div className="container fade-in">
      <div className="hero">
        <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div className="greet">Bienvenida</div>
            <h1>Hola, {user.name || 'Usuario'} 👋</h1>
            <div style={{fontSize:14, opacity:.85, marginTop:6, maxWidth:480}}>
              Lima, Perú · Plan {user.plan || data.plan || 'Free'} · Última actividad {data.last_activity_at || 'reciente'}
            </div>
          </div>
          <div className="row" style={{gap:10}}>
            <Btn variant="secondary" onClick={() => onGo('fairvalue-form')}>
              <Icon name="plus" size={14}/> Nuevo análisis
            </Btn>
          </div>
        </div>
        <div className="stats-strip">
          <div><div className="v">{stats.analyses_count}</div><div className="k">Análisis realizados</div></div>
          <div><div className="v">{stats.reports_count}</div><div className="k">Reportes guardados</div></div>
          <div><div className="v">${Math.round(stats.avg_savings)}</div><div className="k">Ahorro promedio</div></div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="stack-24">
          <div>
            <div className="row" style={{justifyContent:'space-between', marginBottom:12}}>
              <div className="section-h" style={{margin:0}}>Acciones principales</div>
              <span className="small muted">Selecciona un módulo para comenzar</span>
            </div>
            <div className="grid-2">
              <div className="action-card fv" role="button" tabIndex={0} aria-label="Iniciar estimación de Fair Value" onClick={()=>setConfirm('fairvalue')} onKeyDown={onKeyActivate(()=>setConfirm('fairvalue'))}>
                <div className="top-row">
                  <div className="feat-ico"><Icon name="key" size={24}/></div>
                </div>
                <div className="t">Fair Value</div>
                <div className="d">Estimación del precio de referencia con XGBoost v2. Identifica sobreprecios y oportunidades.</div>
                <span className="arr">Iniciar estimación <Icon name="fwd" size={14}/></span>
              </div>
              <div className="action-card en" role="button" tabIndex={0} aria-label="Explorar mapa de Entorno y Seguridad" onClick={()=>setConfirm('entorno')} onKeyDown={onKeyActivate(()=>setConfirm('entorno'))}>
                <div className="top-row">
                  <div className="feat-ico"><Icon name="shield" size={24}/></div>
                </div>
                <div className="t">Entorno y Seguridad</div>
                <div className="d">Score contextual basado en criminalidad y POIs cercanos en radio de 1 km.</div>
                <span className="arr">Explorar mapa <Icon name="fwd" size={14}/></span>
              </div>
            </div>
          </div>

          {/* Entrada al modal de análisis recientes — reemplaza la tabla grande */}
          <div className="ana-entry" role="button" tabIndex={0} aria-label="Ver análisis recientes" onClick={openAnalysesModal} onKeyDown={onKeyActivate(openAnalysesModal)}>
            <div className="ana-entry-ico"><Icon name="chart" size={22}/></div>
            <div className="ana-entry-body">
              <div style={{fontWeight:700, fontSize:15, fontFamily:'Space Grotesk'}}>Análisis recientes</div>
              <div className="small muted" style={{marginTop:2}}>
                {stats.analyses_count > 0
                  ? (<><b>{stats.analyses_count}</b> análisis{recent[0]?.time ? (<> · último <b>{recent[0].time}</b></>) : null}</>)
                  : 'Aún no tienes análisis. Crea uno nuevo para empezar.'}
              </div>
            </div>
            {stats.analyses_count > 0 && (
              <Tag variant="outline">Ver todos</Tag>
            )}
            <Icon name="fwd" size={16} stroke="var(--ink-3)"/>
          </div>
        </div>

        {/* Sidebar */}
        <div className="stack-24">
          <Card>
            <div className="section-h">Tu próximo paso</div>
            {nextStep && nextStep.analysis_id ? (
              <>
                <div style={{fontSize:14, lineHeight:1.5, marginTop:4}}>
                  Tienes una <b>negociación pendiente</b> en {nextStep.address}.
                </div>
                <div className="banner danger" style={{marginTop:12}}>
                  <Icon name="flag" size={14}/>
                  <span>Sobreprecio detectado: <b>+${nextStep.sobreprecio_amount} / mes</b></span>
                </div>
                <Btn
                  variant="primary"
                  block
                  style={{marginTop:14}}
                  onClick={() => onOpenAnalysis && onOpenAnalysis(nextStep.analysis_id, { address: nextStep.address })}
                >
                  Ver evaluación completa
                </Btn>
              </>
            ) : (
              <div className="small muted" style={{marginTop:6}}>Sin pendientes 🎉</div>
            )}
          </Card>

          <Card>
            <div className="row" style={{justifyContent:'space-between'}}>
              <div className="section-h" style={{margin:0}}>Cobertura por distrito</div>
              <span className="tiny muted">{coverage.length} distritos</span>
            </div>
            <div style={{marginTop:10}}>
              {covSlice.map((d,i)=>{
                const rank = covPageSafe * COV_PER_PAGE + i + 1;
                return (
                  <div key={d.name || i} className="cov-row">
                    <div className="row" style={{gap:8, minWidth:0}}>
                      <span className="cov-rank">{rank}</span>
                      <span style={{fontSize:13}}>{d.name}</span>
                    </div>
                    <div className="row" style={{gap:8}}>
                      <span className="numeric small muted">{d.listings} listings</span>
                      <Tag variant={levelToVar(d.level)}>{levelLabel(d.level)}</Tag>
                    </div>
                  </div>
                );
              })}
            </div>
            {covTotalPages > 1 && (
              <div className="pager">
                <button
                  disabled={covPageSafe === 0}
                  onClick={()=>setCovPage(Math.max(0, covPageSafe - 1))}
                  aria-label="Distritos anteriores"
                >
                  <Icon name="back" size={14}/>
                </button>
                <span className="pinfo">Página {covPageSafe + 1} de {covTotalPages}</span>
                <button
                  disabled={covPageSafe >= covTotalPages - 1}
                  onClick={()=>setCovPage(Math.min(covTotalPages - 1, covPageSafe + 1))}
                  aria-label="Distritos siguientes"
                >
                  <Icon name="fwd" size={14}/>
                </button>
              </div>
            )}
          </Card>

          <Card style={{background:'linear-gradient(135deg, var(--primary-soft), var(--accent-soft))', border:'1px solid var(--primary-soft)'}}>
            <Tag variant="primary">Plan Pro</Tag>
            <div style={{fontFamily:'Space Grotesk', fontSize:18, fontWeight:700, marginTop:8}}>Análisis ilimitados + alertas</div>
            <p className="small muted" style={{marginTop:4}}>Notificaciones cuando bajan precios en tus zonas favoritas.</p>
            <Btn variant="primary" size="sm" style={{marginTop:8}} onClick={() => onGo('profile')}>Probar 14 días gratis</Btn>
          </Card>
        </div>
      </div>

      {/* ---- Isla flotante: confirmación antes de entrar al módulo ---- */}
      {(() => {
        const info = confirm ? MODULE_INFO[confirm] : null;
        const isAccent = !!(info && info.iconVariant === 'accent');
        return (
          <Modal
            open={!!info}
            onClose={()=>setConfirm(null)}
            hero
            accent={isAccent}
            icon={info && <Icon name={info.icon} size={28}/>}
            title={info ? info.title : ''}
            subtitle={info ? info.subtitle : ''}
            footer={info && <>
              <Btn variant="outline" onClick={()=>setConfirm(null)}>Cancelar</Btn>
              <Btn variant="primary" onClick={()=>{ const s = info.screen; setConfirm(null); onGo(s); }}>
                {info.cta} <Icon name="arrow" size={15}/>
              </Btn>
            </>}
          >
            {info && <>
              <p className="modal-intro">{info.intro}</p>
              <div className="modal-steps-h">Qué vas a ver</div>
              <div className="modal-steps">
                {info.points.map((p,i)=>(
                  <div className={`modal-step ${isAccent ? 'accent' : ''}`} key={i}>
                    <span className="num">{i+1}</span>
                    <span className="txt">{p}</span>
                  </div>
                ))}
              </div>
            </>}
          </Modal>
        );
      })()}

      {/* ---- Modal: análisis recientes — filtros por zona + paginación 8/pág ---- */}
      <Modal
        open={anaOpen}
        onClose={() => setAnaOpen(false)}
        icon={<Icon name="chart" size={20}/>}
        title="Análisis recientes"
        subtitle={anaLoading ? 'Cargando…' : `${anaAll.length} análisis · ordenados por fecha`}
        maxWidth={640}
        footer={<Btn variant="outline" onClick={() => setAnaOpen(false)}>Cerrar</Btn>}
      >
        {anaLoading ? (
          <div className="small muted text-center" style={{padding:'40px 0'}}>Cargando análisis…</div>
        ) : (
          <>
            {/* Filtros por zona */}
            <div className="row" style={{gap:8, flexWrap:'wrap'}}>
              {ANA_FILTERS.map(f => {
                const count = f.key === 'all'
                  ? anaAll.length
                  : anaAll.filter(a => a.zone === f.key).length;
                const active = anaFilter === f.key;
                return (
                  <button
                    key={f.key}
                    className={`pick-chip ${active ? 'on' : ''}`}
                    aria-pressed={active}
                    aria-label={`Filtrar por ${f.label}`}
                    onClick={() => { setAnaFilter(f.key); setAnaPage(0); }}
                  >
                    {f.label} <span className="numeric" style={{opacity:.7, marginLeft:4}}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Lista compacta */}
            <div className="ana-list" style={{marginTop:14}}>
              {anaSlice.map(r => {
                const neg = r.zone === 'Inflado';
                const ganga = r.zone === 'Ganga';
                const color = neg ? 'var(--danger)' : ganga ? 'var(--success)' : 'oklch(0.45 0.14 60)';
                const bg = neg ? 'var(--danger-soft)' : ganga ? 'var(--success-soft)' : 'var(--warning-soft)';
                const sign = r.diff_pct > 0 ? '+' : '';
                const iconName = neg ? 'flag' : ganga ? 'sparkle' : 'check';
                return (
                  <div className="ana-row" key={r.id} role="button" tabIndex={0} aria-label={r.address ? `Ver análisis: ${r.address}` : 'Ver análisis'} onClick={() => openAnalysisRow(r)} onKeyDown={onKeyActivate(() => openAnalysisRow(r))}>
                    <div className="ico" style={{background: bg, color}}>
                      <Icon name={iconName} size={14}/>
                    </div>
                    <div className="body">
                      <div className="addr">{r.address}</div>
                      <div className="time">{r.time}</div>
                    </div>
                    <div className="diff" style={{color}}>{sign}{r.diff_pct}% {r.zone}</div>
                    <div className="price">${r.fair_value}</div>
                    <Icon name="fwd" size={14} stroke="var(--ink-3)"/>
                  </div>
                );
              })}
              {anaSlice.length === 0 && anaAll.length > 0 && (
                <div className="small muted text-center" style={{padding:'34px 0'}}>
                  No hay análisis en este filtro.
                </div>
              )}
              {anaAll.length === 0 && (
                <div className="small muted text-center" style={{padding:'34px 0'}}>
                  Aún no tienes análisis.
                </div>
              )}
            </div>

            {/* Paginador */}
            {anaTotalPages > 1 && (
              <div className="pager" style={{marginTop:14}}>
                <button
                  disabled={anaPageSafe === 0}
                  onClick={() => setAnaPage(Math.max(0, anaPageSafe - 1))}
                  aria-label="Página anterior"
                ><Icon name="back" size={14}/></button>
                <span className="pinfo">Página {anaPageSafe + 1} de {anaTotalPages}</span>
                <button
                  disabled={anaPageSafe >= anaTotalPages - 1}
                  onClick={() => setAnaPage(Math.min(anaTotalPages - 1, anaPageSafe + 1))}
                  aria-label="Página siguiente"
                ><Icon name="fwd" size={14}/></button>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

/* ============== 4. FAIR VALUE FORM (wizard 3 pasos) ============== */
const AMENIDADES = [
  { key:'ascensor',       label:'Ascensor' },
  { key:'seguridad',      label:'Seguridad' },
  { key:'cocina',         label:'Cocina equipada' },
  { key:'amoblado',       label:'Amoblado' },
  { key:'piscina',        label:'Piscina' },
  { key:'terraza',        label:'Terraza' },
  { key:'walk_in_closet', label:'Walk-in closet' },
  { key:'exteriores',     label:'Áreas exteriores' },
];

const FairValueForm = ({ onBack, onSubmit, onError, onAuthExpired }) => {
  const [step, setStep] = useS(1);
  const [submitting, setSubmitting] = useS(false);
  const [err, setErr] = useS('');
  const [f, setF] = useS({
    lat: -12.121, lng: -77.030,
    area: '80', dormitorios: 2, banos: 2, cocheras: 1, antiguedad_anios: 5,
    es_estudio: false, amenities: [], precio: '',
  });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const toggleAmenity = (k) => setF(prev => ({
    ...prev,
    amenities: prev.amenities.includes(k)
      ? prev.amenities.filter(x => x !== k)
      : [...prev.amenities, k],
  }));

  const pinOk = enLima(f.lat, f.lng);
  const areaNum = Number(f.area);
  const areaOk = f.area && areaNum >= 10 && areaNum <= 1000;
  // Cap del precio: rango razonable de alquiler en Lima USD/mes.
  const PRECIO_MIN = 50, PRECIO_MAX = 50000;
  const precioNum = Number(f.precio);
  const precioOk = f.precio && precioNum >= PRECIO_MIN && precioNum <= PRECIO_MAX;

  // Reverse geocoding (Nominatim/OSM) para mostrar "Avenida X, Miraflores"
  // en el resumen del step 3, en lugar de las coordenadas crudas.
  const [locLabel, setLocLabel] = useS('');
  const [locLoading, setLocLoading] = useS(false);
  const locCache = useR({});
  useE(() => {
    if (step !== 3 || !pinOk) return;
    const key = `${f.lat.toFixed(4)},${f.lng.toFixed(4)}`;
    if (locCache.current[key]) { setLocLabel(locCache.current[key]); return; }
    setLocLoading(true); setLocLabel('');
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${f.lat}&lon=${f.lng}&format=jsonv2&accept-language=es&zoom=17`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const a = data.address || {};
        const dist = a.suburb || a.city_district || a.neighbourhood || a.city || a.town || 'Lima';
        const street = a.road || a.pedestrian;
        const label = street ? `${street}, ${dist}` : dist;
        locCache.current[key] = label;
        setLocLabel(label);
      })
      .catch(() => setLocLabel('Ubicación marcada'))
      .finally(() => setLocLoading(false));
  }, [step, f.lat, f.lng, pinOk]);

  const submit = async () => {
    if (!precioOk) {
      setErr(`Ingresa un precio anunciado entre $${PRECIO_MIN} y $${PRECIO_MAX.toLocaleString('en-US')} USD/mes.`);
      return;
    }
    const precio = precioNum;
    setErr(''); setSubmitting(true);
    try {
      const res = await Api.predict({
        lat: f.lat, lng: f.lng, area: areaNum,
        dormitorios: f.dormitorios, banos: f.banos, cocheras: f.cocheras,
        antiguedad_anios: f.antiguedad_anios, es_estudio: f.es_estudio,
        amenities: f.amenities, precio,
      });
      onSubmit && onSubmit(res.analysis_id, { lat: f.lat, lng: f.lng });
    } catch (ex) {
      const msg = handleApiErr(ex, { setErr, onAuthExpired });
      if (typeof onError === 'function') onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitting) return <Loading label="Calculando precio de referencia…"/>;

  const steps = ['Ubicación', 'Características', 'Precio'];
  return (
    <div className="container fade-in" style={{maxWidth: 880}}>
      <PageHeader
        title="Estimación de precio de referencia"
        subtitle={step === 1
          ? '3 pasos: ubicación en el mapa, datos del depto y precio'
          : undefined}
        onBack={onBack}
      />
      <div className="wizard-steps">
        {steps.map((s, i) => {
          const n = i + 1;
          return (
            <React.Fragment key={s}>
              {i > 0 && <div className={`bar ${step>i?'done':''}`}/>}
              <div className={`step ${step===n?'active':''} ${step>n?'done':''}`}>
                <div className="dot">{step>n ? '✓' : n}</div>
                <span className="lbl">{s}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {step === 1 && (
        <Card className="wizard-card">
          <div className="section-h">1 · Ubicación del inmueble</div>
          <p className="small muted" style={{marginTop:-4, marginBottom:12}}>
            Arrastra el pin (o haz click) en la ubicación exacta del departamento.
          </p>
          <MapPicker lat={f.lat} lng={f.lng}
            onMove={(lat,lng)=>setF(p=>({...p, lat, lng}))}/>
          <div className="row" style={{justifyContent:'space-between', marginTop:12}}>
            <span className="small muted numeric">📍 {f.lat.toFixed(5)}, {f.lng.toFixed(5)}</span>
            {pinOk
              ? <Tag variant="success">Dentro de Lima</Tag>
              : <Tag variant="danger">Fuera de Lima Metropolitana</Tag>}
          </div>
          <div className="row" style={{justifyContent:'flex-end', marginTop:16}}>
            <Btn variant="primary" onClick={()=>setStep(2)} disabled={!pinOk}>
              Siguiente <Icon name="fwd" size={14}/>
            </Btn>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="wizard-card">
          <div className="section-h">2 · Características del departamento</div>
          <ToggleRow label="Es un estudio (monoambiente)" checked={f.es_estudio}
            onChange={(v)=>setF(p=>({
              ...p, es_estudio:v,
              dormitorios: v ? 0 : p.dormitorios,
              banos: v ? p.banos : Math.max(1, p.banos),
            }))}/>
          <div className="grid-2" style={{marginTop:12, gap:14}}>
            <Input label="Área" value={f.area} inputMode="numeric" suffix="m²"
              onChange={(e)=>set('area', e.target.value.replace(/[^0-9]/g,''))}/>
            <Stepper label="Antigüedad" value={f.antiguedad_anios}
              set={(v)=>set('antiguedad_anios',v)} min={0} max={100} suffix="años"/>
            <Stepper label="Dormitorios" value={f.dormitorios}
              set={(v)=>set('dormitorios',v)} min={0} max={20}/>
            <Stepper label="Baños" value={f.banos}
              set={(v)=>set('banos',v)} min={f.es_estudio?0:1} max={20}/>
            <Stepper label="Cocheras" value={f.cocheras}
              set={(v)=>set('cocheras',v)} min={0} max={20}/>
          </div>
          <div className="section-h" style={{marginTop:18}}>Amenities</div>
          <div className="row" style={{flexWrap:'wrap', gap:8}}>
            {AMENIDADES.map(a=>(
              <div key={a.key}
                className={`pick-chip ${f.amenities.includes(a.key)?'on':''}`}
                role="button"
                tabIndex={0}
                aria-pressed={f.amenities.includes(a.key)}
                aria-label={a.label}
                onClick={()=>toggleAmenity(a.key)}
                onKeyDown={onKeyActivate(()=>toggleAmenity(a.key))}>{a.label}</div>
            ))}
          </div>
          {f.area && !areaOk && (
            <div className="small" style={{color:'var(--danger)', marginTop:10}}>
              El área debe estar entre 10 y 1000 m².
            </div>
          )}
          <div className="row" style={{justifyContent:'space-between', marginTop:18}}>
            <Btn variant="outline" onClick={()=>setStep(1)}>
              <Icon name="back" size={14}/> Atrás
            </Btn>
            <Btn variant="primary" onClick={()=>setStep(3)} disabled={!areaOk}>
              Siguiente <Icon name="fwd" size={14}/>
            </Btn>
          </div>
        </Card>
      )}

      {step === 3 && (
        <div className="step3-grid">
          {/* Columna izquierda: input de precio grande tipo editorial */}
          <Card className="wizard-card price-card">
            <div className="price-card-head">
              <div className="section-h">3 · Precio anunciado</div>
              <p className="price-card-sub">
                El precio del aviso que quieres evaluar contra el modelo.
              </p>
            </div>
            <div className="big-price">
              <span className="big-price-prefix">$</span>
              <input
                className="big-price-input"
                value={f.precio}
                inputMode="numeric"
                placeholder="900"
                aria-label="Precio anunciado en USD por mes"
                onChange={(e)=>set('precio', e.target.value.replace(/[^0-9]/g,''))}
              />
              <span className="big-price-suffix">
                <span className="sl">/</span> mes
              </span>
            </div>
            <div className="big-price-foot">
              <span className="muted">USD por mes</span>
              <span className="muted">
                Rango aceptado: ${PRECIO_MIN}–${PRECIO_MAX.toLocaleString('en-US')}
              </span>
            </div>
            {f.precio && !precioOk && (
              <div className="small" style={{color:'var(--danger)', marginTop:10}}>
                El precio debe estar entre ${PRECIO_MIN} y ${PRECIO_MAX.toLocaleString('en-US')} USD/mes.
              </div>
            )}
            {err && (
              <div className="banner danger" style={{marginTop:10}}>
                <Icon name="alert" size={14}/> {err}
              </div>
            )}
            <div className="row" style={{justifyContent:'space-between', marginTop:20}}>
              <Btn variant="outline" onClick={()=>setStep(2)}>
                <Icon name="back" size={14}/> Atrás
              </Btn>
              <Btn variant="primary" size="lg" onClick={submit}
                   disabled={!precioOk || submitting}>
                <Icon name="sparkle" size={16}/> Calcular precio de referencia
              </Btn>
            </div>
          </Card>

          {/* Columna derecha: resumen del depto en tabla limpia */}
          <Card className="wizard-card summary-card">
            <div className="section-h">Resumen del depto</div>
            <div className="summary-rows">
              <div className="srow">
                <span className="k">Ubicación</span>
                <span className="v">
                  {locLoading ? <span className="muted">Cargando…</span>
                   : (locLabel || 'Ubicación marcada')}
                </span>
              </div>
              <div className="srow">
                <span className="k">Área</span>
                <span className="v">{f.area} m²</span>
              </div>
              <div className="srow">
                <span className="k">Distribución</span>
                <span className="v">
                  {f.es_estudio
                    ? `Estudio · ${f.banos} ${f.banos===1?'baño':'baños'}`
                    : `${f.dormitorios} dorm · ${f.banos} ${f.banos===1?'baño':'baños'}`}
                </span>
              </div>
              <div className="srow">
                <span className="k">Cocheras</span>
                <span className="v">{f.cocheras}</span>
              </div>
              <div className="srow">
                <span className="k">Antigüedad</span>
                <span className="v">
                  {f.antiguedad_anios} {f.antiguedad_anios===1?'año':'años'}
                </span>
              </div>
              <div className="srow">
                <span className="k">Amenities</span>
                <span className="v">{f.amenities.length}</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

/* ============== 5. FAIR VALUE RESULT ============== */
const FairValueResult = ({ analysisId, onBack, onContext, onError, onAuthExpired }) => {
  const [data, setData] = useS(null);
  const [loading, setLoading] = useS(true);
  const [err, setErr] = useS('');
  const [saved, setSaved] = useS(false);
  const [saving, setSaving] = useS(false);

  useE(() => {
    if (!analysisId) {
      setErr('No hay análisis seleccionado. Genera uno desde el formulario.');
      setLoading(false);
      return;
    }
    let cancel = false;
    setLoading(true);
    Api.getAnalysis(analysisId)
      .then(r => { if (!cancel) { setData(r); setLoading(false); } })
      .catch(ex => {
        if (cancel) return;
        const msg = handleApiErr(ex, { setErr, onAuthExpired });
        if (typeof onError === 'function') onError(msg);
        setLoading(false);
      });
    return () => { cancel = true; };
  }, [analysisId]);

  const saveReport = async () => {
    if (!analysisId || saving || saved) return;
    setSaving(true);
    try {
      await Api.saveReport(analysisId);
      setSaved(true);
    } catch (ex) {
      const msg = handleApiErr(ex, { setErr, onAuthExpired });
      if (typeof onError === 'function') onError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading label="Cargando análisis…"/>;
  if (err || !data) {
    const noSel = !analysisId;
    return (
      <div className="container fade-in">
        <PageHeader title="Precio de referencia" subtitle="Estimación de inmueble"
                    onBack={onBack}/>
        <Card style={{textAlign:'center', padding:'52px 24px'}}>
          <div style={{width:60, height:60, borderRadius:16, margin:'0 auto 18px',
                       display:'flex', alignItems:'center', justifyContent:'center',
                       background: noSel ? 'var(--primary-soft)' : 'var(--danger-soft)',
                       color: noSel ? 'var(--primary)' : 'var(--danger)'}}>
            <Icon name={noSel ? 'chart' : 'alert'} size={26}/>
          </div>
          <div style={{fontFamily:'Space Grotesk', fontSize:21, fontWeight:700}}>
            {noSel ? 'Todavía no hay un análisis' : 'No se pudo cargar el análisis'}
          </div>
          <p className="small muted" style={{maxWidth:400, margin:'8px auto 0', lineHeight:1.6}}>
            {noSel
              ? 'Estima el precio de referencia de un inmueble: marca su ubicación en el mapa e ingresa sus características.'
              : (err || 'Ocurrió un error inesperado al traer los datos.')}
          </p>
          <Btn variant="primary" style={{marginTop:22}} onClick={onBack}>
            <Icon name="plus" size={15}/> {noSel ? 'Crear un análisis' : 'Volver al formulario'}
          </Btn>
        </Card>
      </div>
    );
  }

  const fair = data.fair_value;
  const anuncio = data.announced_price;
  const diff = data.diff;
  const pct = data.diff_pct;
  const zona = data.zone || 'Justo';
  const isInflado = zona === 'Inflado';
  const isGanga = zona === 'Ganga';
  const accentVar = isInflado ? 'danger' : 'success';
  const diffColor = isInflado ? 'var(--danger)' : 'var(--success)';
  const confTag = (data.confidence || '').includes('Alta') ? 'success'
                : (data.confidence || '').includes('Baja') ? 'danger'
                : 'warning';
  const factors = Array.isArray(data.factors) ? data.factors : [];
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];

  return (
    <div className="container fade-in">
      <PageHeader
        title="Precio de referencia"
        subtitle={`Análisis #${analysisId} · ${data.distrito || ''}`}
        onBack={onBack}
        actions={
          <Btn variant="secondary" size="sm" onClick={saveReport} disabled={saving || saved}>
            <Icon name="bookmark" size={14}/> {saved ? '✓ Guardado' : saving ? 'Guardando…' : 'Guardar reporte'}
          </Btn>
        }
      />

      {warnings.length > 0 && (
        <div className="banner warning" style={{marginBottom:14}}>
          <Icon name="alert" size={14}/> <span>{warnings.join(' · ')}</span>
        </div>
      )}

      {/* Banner honesto de baja cobertura. Se activa cuando el backend marca
          confianza Baja (< 27 comparables internos calibrados por backtest LOO).
          Antes el trigger era < 20 hard-coded, lo que dejaba una zona gris
          20-27 donde la confianza era Baja pero el banner no aparecía. */}
      {data.confidence === 'Baja' && (
        <div className="banner banner-coverage" style={{marginBottom:14}}>
          <Icon name="info" size={14}/>
          <div>
            <strong>Cobertura baja en esta zona.</strong> Tenemos pocos avisos cercanos para comparar, por eso el rango de precio puede ser más ancho de lo habitual. Tómalo como referencia, no como precio exacto.
          </div>
        </div>
      )}

      <div className="result-grid">
        <Card>
          <div className="row" style={{justifyContent:'space-between'}}>
            <div className="section-h" style={{margin:0}}>Precio de referencia de mercado</div>
            <Tag variant={confTag}>
              <Glossary term={`Confianza ${data.confidence}`} custom={GLOSSARY[`Confianza ${data.confidence}`] || 'Indica qué tan estable es la predicción según cuántos avisos comparables hay cerca del pin.'}>
                Confianza: {data.confidence}
              </Glossary>
            </Tag>
          </div>
          <div style={{marginTop:18}}>
            <GaugeChart fairValue={fair} diffPct={pct} zone={zona}/>
          </div>
          <div style={{display:'flex', justifyContent:'center', gap:8, marginTop:14, flexWrap:'wrap'}}>
            {data.predicted_in_seconds > 0 && (
              <Tag variant="accent">Predicción en {data.predicted_in_seconds}s</Tag>
            )}
          </div>
          <div style={{marginTop:14, padding:'10px 12px', background:'var(--bg-tint)', borderRadius:10, fontSize:12, color:'var(--ink-2)', lineHeight:1.55}}>
            <Icon name="info" size={13} stroke="var(--primary)"/> Basado en precios de <b>avisos</b> del
            mercado, no en precios de cierre reales. Error medio del modelo: ±{data.mae_pct}%.
          </div>
        </Card>

        <div className="stack-20">
          <Card accent={accentVar}>
            <div className="section-h" style={{margin:0}}>Comparativa con tu anuncio</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16, marginTop:14}}>
              <div>
                <div className="small muted">Precio anunciado</div>
                <div className="numeric" style={{fontSize: 28, fontWeight:700}}>${anuncio}</div>
                <div className="tiny muted" style={{marginTop:2}}>USD / mes</div>
              </div>
              <div>
                <div className="small muted">Precio de referencia</div>
                <div className="numeric" style={{fontSize: 28, fontWeight:700, color:'var(--primary)'}}>${fair}</div>
                <div className="tiny muted" style={{marginTop:2}}>USD / mes</div>
              </div>
            </div>
            <div className={`verdict verdict-${isInflado?'inflado':isGanga?'ganga':'justo'}`}>
              <span className="dot"/>
              <div className="grow">
                <div className="lbl">Veredicto: {isInflado ? '↑ ' : isGanga ? '↓ ' : '= '}{zona}</div>
                <div className="numeric val">
                  {diff >= 0 ? '+' : ''}${diff} <span className="pct">({pct}%)</span>
                </div>
              </div>
              <Tag variant={isInflado ? 'danger' : isGanga ? 'success' : 'warning'}>
                {isInflado ? 'Negociable' : isGanga ? 'Oportunidad' : 'Precio alineado'}
              </Tag>
            </div>
          </Card>

          <Card>
            <div className="row" style={{justifyContent:'space-between'}}>
              <div className="section-h" style={{margin:0}}>Factores de influencia</div>
              <Tag variant="outline">XGBoost v2</Tag>
            </div>
            <div style={{marginTop:8}}>
              {factors.map((fac, i) => (
                <AnimBar key={i} label={fac.label} value={fac.score} delay={120 + i*100} positive={!!fac.positive}/>
              ))}
              {factors.length === 0 && <div className="small muted">Sin factores disponibles.</div>}
            </div>
          </Card>

          {/* Contrafactuales ligeros (Sprint 2.2) — sensibilidad a cambios
              chicos en las features accionables. NO es DiCE; es perturbación
              numérica simple para que el usuario vea qué impulsa el precio. */}
          {Array.isArray(data.counterfactuals) && data.counterfactuals.length > 0 && (
            <Card>
              <div className="row" style={{justifyContent:'space-between'}}>
                <div className="section-h" style={{margin:0}}>¿Cómo cambiaría tu precio?</div>
                <Tag variant="outline">Top {data.counterfactuals.length}</Tag>
              </div>
              <div className="tiny muted" style={{marginTop:4, marginBottom:10}}>
                Sensibilidad del precio a un cambio chico en cada característica.
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {data.counterfactuals.map((cf, i) => {
                  const positive = cf.pct_change > 0;
                  const arrow = positive ? '↑' : '↓';
                  const color = positive ? 'var(--success)' : 'var(--danger)';
                  return (
                    <div key={i} className="row" style={{justifyContent:'space-between', padding:'8px 12px', background:'var(--bg-tint)', borderRadius:10}}>
                      <span className="small">{cf.label}</span>
                      <span className="numeric" style={{fontWeight:600, color}}>
                        ${cf.new_price.toFixed(0)} <span className="tiny" style={{marginLeft:6, opacity:.8}}>{arrow} {Math.abs(cf.pct_change)}%</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="row" style={{marginTop:24, justifyContent:'space-between'}}>
        <span className="small muted">Modelo: <Glossary term="XGBoost v2"/> · <Glossary term="R²"/> {data.model_r2} · <Glossary term="MAPE"/> {data.mae_pct}%</span>
        <Btn variant="primary" size="lg" onClick={onContext}>
          <Icon name="shield" size={16}/> Ver contexto del barrio
        </Btn>
      </div>
    </div>
  );
};


/* ============== 6. ENTORNO (mapa + pin en vivo) ============== */
const EntornoMapScreen = ({ lat, lng, onBack, onError, onAuthExpired }) => {
  const start = (typeof lat === 'number' && typeof lng === 'number')
    ? { lat, lng } : { lat: -12.121, lng: -77.030 };
  const [pin, setPin] = useS(start);
  const [data, setData] = useS(null);
  const [loading, setLoading] = useS(true);
  const [err, setErr] = useS('');

  // Recalcula el entorno cada vez que el pin cambia (debounce 250 ms).
  useE(() => {
    let cancel = false;
    const t = setTimeout(() => {
      setLoading(true);
      Api.entorno({ lat: pin.lat, lng: pin.lng })
        .then(r => { if (!cancel) { setData(r); setErr(''); setLoading(false); } })
        .catch(ex => {
          if (cancel) return;
          // Limpia data vieja para no mostrar mixed state (banner error + score viejo).
          setData(null);
          const msg = handleApiErr(ex, { setErr, onAuthExpired });
          if (typeof onError === 'function') onError(msg);
          setLoading(false);
        });
    }, 250);
    return () => { cancel = true; clearTimeout(t); };
  }, [pin.lat, pin.lng]);

  const score = data ? data.score : 0;
  const levelVar = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger';

  return (
    <div className="container fade-in">
      <PageHeader
        title="Contexto del barrio"
        subtitle="Arrastra el pin — los datos del entorno se recalculan en vivo"
        onBack={onBack}
      />
      <div className="map-grid">
        <div className="stack-20">
          <MapPicker lat={start.lat} lng={start.lng}
            onMove={(la, lo)=>setPin({ lat: la, lng: lo })}/>
          <div className="row" style={{justifyContent:'space-between'}}>
            <span className="small muted numeric">📍 {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</span>
            {data && <Tag variant="outline">{data.distrito}</Tag>}
          </div>

          {err && (
            <div className="banner warning" style={{marginBottom:0}}>
              <Icon name="alert" size={14}/>
              <span>{err}</span>
            </div>
          )}

          {data && (
            <Card>
              <div className="row" style={{justifyContent:'space-between', marginBottom:10}}>
                <div className="section-h" style={{margin:0}}>Servicios cercanos (1 km)</div>
                <Tag variant="accent">{data.pois.length} tipos</Tag>
              </div>
              <div className="poi-grid">
                {data.pois.map(p=>(
                  <div className="poi-tile" key={p.kind}>
                    <span className="emo">{p.emoji}</span>
                    <div className="grow">
                      <div className="pn">{p.label}</div>
                      <div className="pd">{p.count_1km} en 1 km · más cerca {Math.round(p.dist_nearest_m)} m</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="stack-16">
          <Card>
            <div className="row" style={{justifyContent:'space-between'}}>
              <div className="section-h" style={{margin:0}}>Score del entorno</div>
              {data && <Tag variant={levelVar}>{data.level}</Tag>}
            </div>
            {loading && !data && <div className="small muted" style={{marginTop:12}}>Calculando…</div>}
            {data && (
              <>
                <div className="row" style={{gap:16, marginTop:14}}>
                  <ScoreCircle value={score} size={104} stroke={10} label="Score"/>
                  <div className="stack-12" style={{flex:1}}>
                    <div>
                      <div className="tiny muted" style={{textTransform:'uppercase', letterSpacing:'.06em', fontWeight:600}}>Seguridad</div>
                      <div className="numeric" style={{fontSize:18, fontWeight:700, color: data.security>=70?'var(--success)':'var(--warning)'}}>{data.security} / 100</div>
                    </div>
                    <div>
                      <div className="tiny muted" style={{textTransform:'uppercase', letterSpacing:'.06em', fontWeight:600}}>Servicios</div>
                      <div className="numeric" style={{fontSize:18, fontWeight:700, color: data.services>=70?'var(--success)':'var(--warning)'}}>{data.services} / 100</div>
                    </div>
                  </div>
                </div>
                <div style={{marginTop:14, padding:'12px 14px', background:'var(--bg-tint)', borderRadius:12, fontSize:13, color:'var(--ink-2)', lineHeight:1.55}}>
                  {data.summary}
                </div>

                {/* Breakdown del score (Sprint 1.3) — qué impulsa Seguridad y Servicios.
                    Datos vienen del mismo /api/entorno: n_comisarias_distrito,
                    denuncias_vs_lima_pct, y data.pois. */}
                <div className="score-breakdown" style={{marginTop:16, paddingTop:14, borderTop:'1px solid var(--border)'}}>
                  <div className="tiny muted" style={{textTransform:'uppercase', letterSpacing:'.06em', fontWeight:600, marginBottom:10}}>¿Qué impulsa este score?</div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
                    {/* Seguridad */}
                    <div>
                      <div className="small" style={{fontWeight:600, marginBottom:6}}>🛡️ Seguridad</div>
                      <div className="tiny muted" style={{lineHeight:1.5}}>
                        Denuncias del distrito:
                        <b className="numeric" style={{color:'var(--ink)', marginLeft:4}}>{data.denuncias_distrito_total}</b>
                      </div>
                      <div className="tiny muted" style={{marginTop:4, lineHeight:1.5}}>
                        vs promedio Lima:
                        <b className="numeric" style={{
                          color: data.denuncias_vs_lima_pct <= 1.0 ? 'var(--success)' : data.denuncias_vs_lima_pct <= 1.5 ? 'var(--warning)' : 'var(--danger)',
                          marginLeft:4
                        }}>
                          {typeof data.denuncias_vs_lima_pct === 'number' ? `${data.denuncias_vs_lima_pct}×` : '—'}
                        </b>
                      </div>
                      {/* Barra relativa: 100% = igual al promedio Lima; capeada a 200% */}
                      <div style={{height:6, background:'var(--bg-tint)', borderRadius:3, marginTop:6, overflow:'hidden'}}>
                        <div style={{
                          height:'100%',
                          width: `${Math.min(100, (data.denuncias_vs_lima_pct || 0) * 50)}%`,
                          background: data.denuncias_vs_lima_pct <= 1.0 ? 'var(--success)' : data.denuncias_vs_lima_pct <= 1.5 ? 'var(--warning)' : 'var(--danger)',
                          transition:'width .3s'
                        }}/>
                      </div>
                      <div className="tiny muted" style={{marginTop:8, lineHeight:1.5}}>
                        Comisarías en distrito:
                        <b className="numeric" style={{color:'var(--ink)', marginLeft:4}}>{data.n_comisarias_distrito}</b>
                      </div>
                    </div>
                    {/* Servicios */}
                    <div>
                      <div className="small" style={{fontWeight:600, marginBottom:6}}>🏘️ Servicios (1 km)</div>
                      <div style={{display:'flex', flexDirection:'column', gap:4}}>
                        {data.pois.map(p => (
                          <div key={p.kind} className="tiny" style={{display:'flex', justifyContent:'space-between', color:'var(--ink-2)'}}>
                            <span>{p.emoji} {p.label}</span>
                            <b className="numeric" style={{color: p.count_1km > 0 ? 'var(--ink)' : 'var(--ink-2)'}}>{p.count_1km}</b>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </Card>

          {data && (
            <Card>
              <div className="section-h" style={{margin:0}}>Indicadores</div>
              <div className="stack-12" style={{marginTop:10}}>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span className="small muted">Denuncias registradas</span>
                  <b className="numeric">{data.cantidad_denuncias}</b>
                </div>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <span className="small muted">Distancia al mar</span>
                  <b className="numeric">{data.dist_mar_km} km</b>
                </div>
              </div>
            </Card>
          )}

          {data && Array.isArray(data.warnings) && data.warnings.length > 0 && (
            <Card accent="warning">
              <div className="section-h" style={{margin:0}}>Alertas</div>
              <div className="stack-12" style={{marginTop:8}}>
                {data.warnings.map((w, i)=>(
                  <div key={i} className="small" style={{color:'var(--ink-2)'}}>⚠ {w}</div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============== 7. PROFILE ============== */
const PROFILE_ROLES = ['Inquilino', 'Propietario', 'Agente inmobiliario'];

const PROFILE_FAQS = [
  { q: '¿Cómo calcula ubIcA el precio de referencia?',
    a: 'Un modelo XGBoost v2 entrenado con 3.348 avisos reales de alquiler en Lima estima el precio de mercado según ubicación, área, dormitorios y entorno. El error medio (MAPE) de validación es 15,7 %.' },
  { q: '¿Qué significan "Inflado", "Justo" y "Ganga"?',
    a: 'Comparamos el precio anunciado contra el precio de referencia estimado. Muy por encima es "Inflado", cerca del estimado es "Justo", y por debajo es "Ganga".' },
  { q: '¿De dónde salen los datos de seguridad?',
    a: 'El score de entorno usa denuncias reales de la PNP/INEI agregadas por distrito y la densidad de puntos de interés (colegios, hospitales, bancos) en un radio de 1 km.' },
  { q: '¿Puedo confiar en zonas con cobertura "Baja"?',
    a: 'En distritos con pocos avisos el modelo tiene menos comparables y la confianza de la predicción baja. Revisa el indicador de confianza que aparece en cada análisis.' },
];

const ProfileScreen = ({ onLogout, onError, onOpenAnalysis, onAuthExpired }) => {
  // Datos rápidos desde localStorage
  const cached = (window.Api && window.Api.getUser()) || {};
  const [me, setMe] = useS(null);
  const [err, setErr] = useS('');
  const [modal, setModal] = useS(null);          // edit | config | help | lang | plans

  // form de edición de perfil
  const [form, setForm] = useS({ name: '', role: 'Inquilino' });
  const [saving, setSaving] = useS(false);
  const [formErr, setFormErr] = useS('');

  // preferencias locales (persisten en este navegador)
  const [prefs, setPrefs] = useS(() => ({
    notif:   localStorage.getItem('ubica.pref.notif')   !== '0',
    gangas:  localStorage.getItem('ubica.pref.gangas')  !== '0',
    resumen: localStorage.getItem('ubica.pref.resumen') === '1',
  }));
  const setPref = (k, v) => {
    setPrefs(p => ({ ...p, [k]: v }));
    localStorage.setItem('ubica.pref.' + k, v ? '1' : '0');
  };

  const [faqOpen, setFaqOpen] = useS(-1);

  useE(() => {
    let cancel = false;
    if (!window.Api) return;
    Api.me()
      .then(r => { if (!cancel) setMe(r); })
      .catch(ex => {
        if (cancel) return;
        const msg = handleApiErr(ex, { setErr, onAuthExpired });
        if (typeof onError === 'function') onError(msg);
      });
    return () => { cancel = true; };
  }, []);

  const user = (me && me.user) || cached || {};
  const plan = (me && me.plan) || user.plan || 'Free';
  const name = user.name || 'Usuario';
  const email = user.email || '—';
  const role = user.role || 'Inquilino';
  const initial = (name[0] || 'U').toUpperCase();
  const reports = (me && Array.isArray(me.reports)) ? me.reports : [];
  const analysesCount = (me && me.analyses_count) ?? 0;
  const reportsCount  = (me && me.reports_count) ?? 0;
  const isPro = String(plan).toLowerCase() === 'pro';

  const openEdit = () => {
    setForm({ name, role });
    setFormErr('');
    setModal('edit');
  };
  const saveEdit = () => {
    const nm = (form.name || '').trim();
    if (nm.length < 2) { setFormErr('El nombre debe tener al menos 2 caracteres.'); return; }
    setSaving(true); setFormErr('');
    Api.updateMe({ name: nm, role: form.role })
      .then(r => { setMe(r); setModal(null); })
      .catch(ex => setFormErr((ex && ex.message) || 'No se pudo guardar el perfil.'))
      .finally(() => setSaving(false));
  };
  const openReport = (r) => {
    if (!r || !r.analysis_id) return;
    setModal(null);
    if (onOpenAnalysis) onOpenAnalysis(r.analysis_id);
  };

  return (
    <div className="container fade-in">
      <PageHeader title="Mi Perfil" subtitle="Gestiona tu cuenta, reportes y preferencias"/>
      {err && <div className="banner danger" style={{marginBottom:14}}><Icon name="alert" size={14}/> {err}</div>}
      <div className="profile-grid">
        <div className="stack-20">
          <Card>
            <div className="text-center">
              <div className="avatar lg" style={{margin:'0 auto'}}>{initial}</div>
              <div style={{fontSize: 22, fontWeight:700, fontFamily:'Space Grotesk', marginTop:14}}>{name}</div>
              <div className="small muted">{email}</div>
              <div className="row" style={{gap:6, marginTop:12, justifyContent:'center'}}>
                <Tag variant="primary">{role}</Tag>
                <Tag variant="outline">Plan {plan}</Tag>
              </div>
            </div>
            <div className="mt-20" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding: 14, background:'var(--bg-tint)', borderRadius: 12}}>
              <div className="text-center">
                <div className="numeric" style={{fontSize:20, fontWeight:700}}>{analysesCount}</div>
                <div className="tiny muted">Análisis</div>
              </div>
              <div className="text-center" style={{borderLeft:'1px solid var(--line)'}}>
                <div className="numeric" style={{fontSize:20, fontWeight:700}}>{reportsCount}</div>
                <div className="tiny muted">Reportes</div>
              </div>
            </div>
            <Btn variant="outline" block style={{marginTop:14}} onClick={openEdit}>
              <Icon name="edit" size={14}/> Editar perfil
            </Btn>
          </Card>

          <div>
            <div className="section-h">Opciones</div>
            <div className="stack-12">
              <div className="menu-row" role="button" tabIndex={0} aria-label="Configuración" onClick={()=>setModal('config')} onKeyDown={onKeyActivate(()=>setModal('config'))}>
                <Icon name="settings" size={18} stroke="var(--ink-2)"/> Configuración
                <Icon name="fwd" size={14} stroke="var(--ink-3)" className="arr"/>
              </div>
              <div className="menu-row" role="button" tabIndex={0} aria-label="Ayuda y soporte" onClick={()=>setModal('help')} onKeyDown={onKeyActivate(()=>setModal('help'))}>
                <Icon name="help" size={18} stroke="var(--ink-2)"/> Ayuda y soporte
                <Icon name="fwd" size={14} stroke="var(--ink-3)" className="arr"/>
              </div>
              <div className="menu-row" role="button" tabIndex={0} aria-label="Cambiar idioma" onClick={()=>setModal('lang')} onKeyDown={onKeyActivate(()=>setModal('lang'))}>
                <Icon name="globe" size={18} stroke="var(--ink-2)"/> Idioma
                <span className="muted small" style={{marginLeft:'auto'}}>Español</span>
                <Icon name="fwd" size={14} stroke="var(--ink-3)"/>
              </div>
            </div>
          </div>

          <Btn variant="danger" block onClick={onLogout}>
            <Icon name="logout" size={16}/> Cerrar Sesión
          </Btn>
        </div>

        <div className="stack-20">
          <div>
            <div className="row" style={{justifyContent:'space-between', marginBottom:12}}>
              <div className="section-h" style={{margin:0}}>Reportes Guardados</div>
              <Tag variant="outline">{reports.length} reportes</Tag>
            </div>
            <div className="stack-12">
              {reports.map((r,i)=>(
                <div className="report-row" key={r.id || i} role="button" tabIndex={0} aria-label={r.address ? `Abrir reporte: ${r.address}` : 'Abrir reporte'} onClick={()=>openReport(r)} onKeyDown={onKeyActivate(()=>openReport(r))}>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:14, fontWeight:600}}>{r.address}</div>
                    <div className="small muted" style={{marginTop:2}}>Reporte · {r.date}</div>
                  </div>
                  <Tag variant={r.status === 'Archivado' ? 'default' : 'success'}>{r.status || 'Activo'}</Tag>
                  <Btn variant="outline" size="sm" onClick={(e)=>{e.stopPropagation(); openReport(r);}}>Abrir</Btn>
                </div>
              ))}
              {reports.length === 0 && (
                <div className="small muted">No tienes reportes guardados todavía.</div>
              )}
            </div>
          </div>

          <Card style={{background:'linear-gradient(135deg, var(--primary-soft), var(--accent-soft))', border:'1px solid var(--primary-soft)'}}>
            <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
              <div>
                <Tag variant="primary">{isPro ? 'Plan Pro activo' : 'Plan Pro'}</Tag>
                <div style={{fontFamily:'Space Grotesk', fontSize:22, fontWeight:700, marginTop:10}}>Análisis ilimitados · Alertas geoespaciales</div>
                <p className="small muted" style={{marginTop:6, maxWidth: 440}}>
                  {isPro
                    ? 'Tu plan Pro está activo: análisis ilimitados y alertas cuando aparezcan gangas o cambien los precios en tus zonas.'
                    : 'Recibe notificaciones cuando aparezcan gangas en tus zonas favoritas o cuando los precios cambien.'}
                </p>
              </div>
              <Icon name="sparkle" size={32} stroke="var(--primary)"/>
            </div>
            <div className="row mt-16" style={{gap:10}}>
              <Btn variant="primary" onClick={()=>setModal('plans')}>
                {isPro ? 'Gestionar plan' : 'Probar 14 días gratis'}
              </Btn>
              <Btn variant="outline" onClick={()=>setModal('plans')}>Ver planes</Btn>
            </div>
          </Card>
        </div>
      </div>

      {/* ---- Modal: editar perfil ---- */}
      <Modal
        open={modal === 'edit'}
        onClose={()=>setModal(null)}
        icon={<Icon name="edit" size={20}/>}
        title="Editar perfil"
        subtitle="Actualiza tu nombre y tu rol"
        footer={<>
          <Btn variant="outline" onClick={()=>setModal(null)}>Cancelar</Btn>
          <Btn variant="primary" onClick={saveEdit} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Btn>
        </>}
      >
        <div className="stack-16">
          <Input
            label="Nombre completo"
            value={form.name}
            onChange={(e)=>setForm(f=>({...f, name:e.target.value}))}
            placeholder="Tu nombre"
          />
          <Select
            label="Rol"
            value={form.role}
            onChange={(v)=>setForm(f=>({...f, role:v}))}
            options={PROFILE_ROLES}
          />
          <div className="field">
            <label>Correo</label>
            <div className="small muted" style={{padding:'2px 0'}}>{email} · no editable</div>
          </div>
          {formErr && <div className="banner danger"><Icon name="alert" size={14}/> {formErr}</div>}
        </div>
      </Modal>

      {/* ---- Modal: configuración ---- */}
      <Modal
        open={modal === 'config'}
        onClose={()=>setModal(null)}
        icon={<Icon name="settings" size={20}/>}
        title="Configuración"
        subtitle="Preferencias de notificaciones"
        footer={<Btn variant="primary" onClick={()=>setModal(null)}>Listo</Btn>}
      >
        <ToggleRow
          label="Notificaciones por email"
          checked={prefs.notif}
          onChange={(v)=>setPref('notif', v)}
        />
        <ToggleRow
          label="Alertas de gangas en mis zonas"
          checked={prefs.gangas}
          onChange={(v)=>setPref('gangas', v)}
        />
        <ToggleRow
          label="Resumen semanal del mercado"
          checked={prefs.resumen}
          onChange={(v)=>setPref('resumen', v)}
        />
        <div className="small muted" style={{marginTop:14}}>
          Las preferencias se guardan en este navegador.
        </div>
      </Modal>

      {/* ---- Modal: ayuda y soporte ---- */}
      <Modal
        open={modal === 'help'}
        onClose={()=>setModal(null)}
        icon={<Icon name="help" size={20}/>}
        title="Ayuda y soporte"
        subtitle="Preguntas frecuentes y contacto"
        footer={<Btn variant="outline" onClick={()=>setModal(null)}>Cerrar</Btn>}
      >
        <div>
          {PROFILE_FAQS.map((f,i)=>(
            <div className="faq-item" key={i}>
              <div className="faq-q" role="button" tabIndex={0} aria-expanded={faqOpen===i} aria-label={f.q} onClick={()=>setFaqOpen(o=>o===i?-1:i)} onKeyDown={onKeyActivate(()=>setFaqOpen(o=>o===i?-1:i))}>
                {f.q}
                <Icon name={faqOpen===i ? 'back' : 'fwd'} size={14} stroke="var(--ink-3)"/>
              </div>
              {faqOpen===i && <div className="faq-a">{f.a}</div>}
            </div>
          ))}
        </div>
        <div className="row" style={{gap:10, marginTop:16, padding:14, background:'var(--bg-tint)', borderRadius:12}}>
          <Icon name="mail" size={18} stroke="var(--primary)"/>
          <div>
            <div style={{fontSize:13, fontWeight:600}}>soporte@ubica.pe</div>
            <div className="tiny muted">Te respondemos en 24-48 h</div>
          </div>
        </div>
        <div className="tiny muted text-center" style={{marginTop:14}}>ubIcA · versión 2.0.0</div>
      </Modal>

      {/* ---- Modal: idioma ---- */}
      <Modal
        open={modal === 'lang'}
        onClose={()=>setModal(null)}
        icon={<Icon name="globe" size={20}/>}
        title="Idioma"
        subtitle="Idioma de la interfaz"
        footer={<Btn variant="outline" onClick={()=>setModal(null)}>Cerrar</Btn>}
      >
        <div className="stack-12">
          <div className="opt-row on">
            <div className="grow">
              <div style={{fontSize:14, fontWeight:600}}>Español</div>
              <div className="tiny muted">Idioma actual</div>
            </div>
            <div className="opt-radio"/>
          </div>
          <div className="opt-row disabled">
            <div className="grow">
              <div style={{fontSize:14, fontWeight:600}}>English</div>
              <div className="tiny muted">Disponible próximamente</div>
            </div>
            <Tag variant="outline">Pronto</Tag>
          </div>
        </div>
      </Modal>

      {/* ---- Modal: planes ---- */}
      <Modal
        open={modal === 'plans'}
        onClose={()=>setModal(null)}
        icon={<Icon name="sparkle" size={20}/>}
        title="Planes ubIcA"
        subtitle="Compara y elige tu plan"
        maxWidth={540}
        footer={<Btn variant="outline" onClick={()=>setModal(null)}>Cerrar</Btn>}
      >
        <div className="grid-2">
          <div className="card compact" style={{border: !isPro ? '2px solid var(--primary)' : '1px solid var(--line)'}}>
            <div className="row" style={{justifyContent:'space-between'}}>
              <b>Free</b>
              {!isPro && <Tag variant="primary">Tu plan</Tag>}
            </div>
            <div style={{fontFamily:'Space Grotesk', fontSize:24, fontWeight:700, marginTop:8}}>$0</div>
            <div className="stack-12" style={{marginTop:12}}>
              <div className="modal-point"><span className="pico"><Icon name="check" size={12}/></span> 5 análisis al mes</div>
              <div className="modal-point"><span className="pico"><Icon name="check" size={12}/></span> Score de entorno</div>
              <div className="modal-point"><span className="pico"><Icon name="check" size={12}/></span> Mapa de cobertura</div>
            </div>
          </div>
          <div className="card compact" style={{border: isPro ? '2px solid var(--primary)' : '1px solid var(--line)'}}>
            <div className="row" style={{justifyContent:'space-between'}}>
              <b>Pro</b>
              {isPro && <Tag variant="primary">Tu plan</Tag>}
            </div>
            <div style={{fontFamily:'Space Grotesk', fontSize:24, fontWeight:700, marginTop:8}}>$12<span className="tiny muted"> /mes</span></div>
            <div className="stack-12" style={{marginTop:12}}>
              <div className="modal-point"><span className="pico"><Icon name="check" size={12}/></span> Análisis ilimitados</div>
              <div className="modal-point"><span className="pico"><Icon name="check" size={12}/></span> Alertas geoespaciales</div>
              <div className="modal-point"><span className="pico"><Icon name="check" size={12}/></span> Reportes exportables</div>
              <div className="modal-point"><span className="pico"><Icon name="check" size={12}/></span> Resumen semanal</div>
            </div>
          </div>
        </div>
        {isPro && (
          <div className="banner info" style={{marginTop:14}}>
            <Icon name="check" size={14}/>
            <span>Ya tienes el plan Pro activo. ¡Gracias por apoyar a ubIcA!</span>
          </div>
        )}
      </Modal>
    </div>
  );
};

/* ============== Loading Overlay ============== */
const Loading = ({ label = 'Calculando precio de referencia…' }) => (
  <div className="container fade-in" style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight: 'calc(100vh - var(--nav-h) - 80px)', flexDirection:'column', gap:24}}>
    <Logo/>
    <div style={{width:'100%', maxWidth: 320}}>
      <div className="loadbar"/>
    </div>
    <div className="text-center">
      <div style={{fontWeight:600, color:'var(--ink-2)', fontSize:15}}>{label}</div>
      <div className="small muted" style={{marginTop:6}}>XGBoost v2 · MAPE 15,7 % · 3.348 avisos</div>
    </div>
  </div>
);

Object.assign(window, {
  SplashScreen, AuthScreen, HomeScreen, DashboardScreen,
  FairValueForm, FairValueResult,
  EntornoMapScreen,
  ProfileScreen, Loading,
});

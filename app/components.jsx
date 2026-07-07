
const { useState, useEffect, useRef, useMemo } = React;

const Icon = ({ name, size = 20, stroke = "currentColor", strokeWidth = 1.8, fill = "none", ...rest }) => {
  const paths = {
    home: <><path d="M3 11.5L12 4l9 7.5"/><path d="M5 10v10h14V10"/></>,
    chart: <><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></>,
    pin: <><path d="M12 22s7-7.5 7-13a7 7 0 0 0-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></>,
    back: <><path d="M15 18l-6-6 6-6"/></>,
    fwd: <><path d="M9 6l6 6-6 6"/></>,
    bookmark: <><path d="M6 4h12v18l-6-4-6 4z"/></>,
    save: <><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v6h7V4"/></>,
    key: <><circle cx="8" cy="14" r="4"/><path d="M11 11l9-9"/><path d="M17 5l3 3"/></>,
    shield: <><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></>,
    map: <><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14"/><path d="M15 6v14"/></>,
    alert: <><path d="M12 3l10 17H2z"/><path d="M12 10v5"/><circle cx="12" cy="18" r="0.5" fill="currentColor"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8L4.2 7A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.5c-1 .5-1 1.5-1 2"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 3 2.5 15 0 18"/><path d="M12 3c-2.5 3-2.5 15 0 18"/></>,
    logout: <><path d="M14 4h5v16h-5"/><path d="M9 16l-4-4 4-4"/><path d="M5 12h12"/></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9z"/><path d="M10 21h4"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    download: <><path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/></>,
    layers: <><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></>,
    check: <><path d="M5 12l5 5L20 7"/></>,
    sparkle: <><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 8v.5"/><path d="M12 11v6"/></>,
    wifi: <><path d="M2 9c5-5 15-5 20 0"/><path d="M5 13c4-4 10-4 14 0"/><path d="M8.5 16.5c2-2 5-2 7 0"/><circle cx="12" cy="20" r=".5" fill="currentColor"/></>,
    battery: <><rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2"/><rect x="4" y="9" width="14" height="6" rx="1" fill="currentColor" stroke="none"/></>,
    signal: <><path d="M3 18h2v-2H3z" fill="currentColor" stroke="none"/><path d="M7 18h2v-5H7z" fill="currentColor" stroke="none"/><path d="M11 18h2V9h-2z" fill="currentColor" stroke="none"/><path d="M15 18h2V5h-2z" fill="currentColor" stroke="none"/></>,
    arrow: <><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></>,
    edit: <><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14 6l4 4"/></>,
    flag: <><path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/></>,
    close: <><path d="M6 6l12 12"/><path d="M18 6L6 18"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.93 19.07l1.41-1.41"/><path d="M17.66 6.34l1.41-1.41"/></>,
    moon: <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>,
    nav: <><polygon points="12,3 20,21 12,17 4,21" strokeLinejoin="round"/></>,
    bus: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18"/><path d="M8 19v2"/><path d="M16 19v2"/><circle cx="7.5" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="16.5" cy="15" r="1" fill="currentColor" stroke="none"/><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/></>,
    heart: <><path d="M12 21s-7-4.6-9.5-9A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.5 6c-2.5 4.4-9.5 9-9.5 9z"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {paths[name] || null}
    </svg>
  );
};

const StatusBar = ({ dark = false }) => (
  <div className={`statusbar ${dark ? 'on-dark' : ''}`}>
    <div className="numeric">9:41</div>
    <div className="right">
      <Icon name="signal" size={14} strokeWidth={0} fill="currentColor"/>
      <Icon name="wifi" size={14}/>
      <Icon name="battery" size={20}/>
    </div>
  </div>
);

const Header = ({ title, subtitle, onBack, right }) => (
  <div className="topbar">
    {onBack && (
      <button className="btn btn-icon" onClick={onBack} aria-label="Atrás">
        <Icon name="back" size={18}/>
      </button>
    )}
    <div className="grow">
      <h1>{title}</h1>
      {subtitle && <div className="sub">{subtitle}</div>}
    </div>
    {right}
  </div>
);

const Logo = ({ size = "md" }) => (
  <div className="logo">
    <div className={`logo-mark ${size === 'lg' ? 'lg' : ''}`}>
      <svg width={size==='lg'?32:20} height={size==='lg'?32:20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20V10l8-6 8 6v10"/>
        <circle cx="15" cy="14" r="2.2" fill="currentColor"/>
        <path d="M15 16.2v2.8" stroke="white" strokeWidth="1.4"/>
      </svg>
    </div>
    <span style={{ fontSize: size==='lg' ? 30 : 20, color: 'var(--ink)'}}>Wasi</span>
  </div>
);

const Btn = ({ variant = 'primary', children, onClick, block, size, type='button', disabled, ...rest }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`btn btn-${variant} ${block ? 'btn-block' : ''} ${size==='sm' ? 'btn-sm' : ''} ${size==='lg' ? 'btn-lg' : ''}`}
    {...rest}
  >
    {children}
  </button>
);

const Card = ({ children, accent, hover, className = '', style }) => (
  <div className={`card ${hover ? 'hover':''} ${accent ? `card-accent-left ${accent}`:''} ${className}`} style={style}>
    {children}
  </div>
);

const Tag = ({ variant = 'default', children, className = '', ...rest }) => (
  <span className={`tag tag-${variant} ${className}`} {...rest}>{children}</span>
);

const ZONE_VARIANT = { Ganga: 'success', Justo: 'warning', Inflado: 'danger' };

const safeImageUrl = (url) =>
  (typeof url === 'string' && /^(https?:\/\/|data:image\/)/i.test(url.trim())) ? url : null;

const WASI_PHOTOS = [
  '1522708323590-d24dbb6b0267','1502672260266-1c1ef2d93688','1493809842364-78817add7ffb',
  '1560448204-e02f11c3d0e2','1560185007-cde436f6a4d0','1554995207-c18c203602cb',
  '1505691938895-1758d7feb511','1484154218962-a197022b5858','1556912172-45b7abe8b7e1',
  '1502005229762-cf1b2da7c5d6','1522444195799-478538b28823','1567767292278-a4f21aa2d36e',
  '1545324418-cc1a3fa10c00','1502672023488-70e25813eb80','1416339306562-f3d12fefd36f',
  '1486304873000-235643847519','1560184897-ae75f418493e','1538688525198-9b88f6f53126',
  '1583847268964-b28dc8f51f92',
];
const apartmentPhoto = (id) => {
  const i = ((id % WASI_PHOTOS.length) + WASI_PHOTOS.length) % WASI_PHOTOS.length;
  return `https://images.unsplash.com/photo-${WASI_PHOTOS[i]}?w=640&h=400&fit=crop&q=70`;
};

const ListingCard = ({ listing, onOpen, isFav, onToggleFav }) => {
  const z = listing.zone;
  const open = () => onOpen && onOpen(listing.id);
  const price = Math.round(listing.price_usd).toLocaleString('en-US');
  const priceUnit = listing.operacion === 'venta' ? ' total' : ' /mes';
  const specs = listing.es_estudio ? 'Estudio' : `${listing.dormitorios} dorm`;
  const imgSrc = safeImageUrl(listing.image_url)
    || (listing.id != null ? apartmentPhoto(listing.id) : null);
  
  
  const showFav = typeof onToggleFav === 'function';
  const toggleFav = (e) => {
    e.stopPropagation();   
    onToggleFav(listing.id, !isFav);
  };
  return (
    <div className="listing-card-z card hover" role="button" tabIndex={0}
         onClick={open} onKeyDown={onKeyActivate(open)}>
      <div className="lcz-media">
        <div className={`lcz-placeholder lcz-ph-${ZONE_VARIANT[z] || 'default'}`}>
          <Icon name="home" size={28} stroke="#fff"/>
        </div>
        {imgSrc && <img src={imgSrc} alt={listing.address} loading="lazy"
               onError={(e)=>{ e.target.style.display='none'; }}/>}
        {z && <span className={`lcz-verdict tag tag-${ZONE_VARIANT[z] || 'default'}`}>{z}</span>}
        {showFav && (
          <button
            type="button"
            className={`lcz-fav ${isFav ? 'on' : ''}`}
            aria-pressed={isFav}
            aria-label={isFav ? 'Quitar de guardados' : 'Guardar inmueble'}
            title={isFav ? 'Quitar de guardados' : 'Guardar inmueble'}
            onClick={toggleFav}
          >
            <Icon name="heart" size={17} fill={isFav ? 'currentColor' : 'none'}/>
          </button>
        )}
      </div>
      <div className="lcz-body">
        <div className="lcz-price numeric">
          ${price}<span className="lcz-per">{priceUnit}</span>
        </div>
        <div className="lcz-addr">{listing.address}</div>
        <div className="lcz-dist small muted">{listing.district}</div>
        <div className="lcz-specs tiny muted">
          {specs} · {listing.banos} {listing.banos === 1 ? 'baño' : 'baños'} · {Math.round(listing.area_m2)} m²
        </div>
      </div>
    </div>
  );
};

const GLOSSARY = {
  'Error medio': 'En promedio, qué tan lejos cae la estimación del modelo respecto al precio real, expresado en %. Más bajo es mejor.',
  'Confianza Alta': 'Muchos avisos comparables cerca del pin: la predicción es más estable.',
  'Confianza Media': 'Algunos avisos comparables: la predicción es razonable pero con más margen.',
  'Confianza Baja': 'Pocos avisos comparables cerca: el rango puede ser amplio, tómalo como referencia general.',
  'Veredicto': 'Comparación entre el precio anunciado y el precio de referencia del modelo: Inflado, Justo o Ganga.',
};

const onKeyActivate = (handler) => (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (typeof handler === 'function') handler(e);
  }
};

const Glossary = ({ term, children, custom }) => {
  const explicacion = custom || GLOSSARY[term] || term;
  return (
    <abbr
      title={explicacion}
      aria-label={`${term}: ${explicacion}`}
      style={{textDecoration:'underline dotted', textUnderlineOffset:'2px', cursor:'help'}}
    >
      {children || term}
    </abbr>
  );
};

let _fieldSeq = 0;
const useFieldId = (rest) => useMemo(
  () => (rest && rest.id) || `fld-${++_fieldSeq}`, []);

const Input = ({ label, suffix, error, ...rest }) => {
  const id = useFieldId(rest);
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      <div className="input-wrap">
        <input id={id} aria-invalid={error ? 'true' : undefined} {...rest}/>
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
      {error && <div className="field-err">{error}</div>}
    </div>
  );
};

const Select = ({ label, options, value, onChange, placeholder }) => {
  const id = useFieldId({});
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      <select id={id} value={value || ''} onChange={(e)=>onChange(e.target.value)}>
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
      </select>
    </div>
  );
};

const Switch = ({ checked, onChange, label }) => (
  <div className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}
       role="switch" aria-checked={checked} aria-label={label}
       tabIndex={0} onKeyDown={onKeyActivate(() => onChange(!checked))}/>
);

const ToggleRow = ({ label, icon, checked, onChange }) => (
  <div className="toggle-row">
    <div className="label">
      {icon && <span style={{display:'inline-flex'}}>{icon}</span>}
      {label}
    </div>
    <Switch checked={checked} onChange={onChange} label={label}/>
  </div>
);

const useAnimatedNumber = (target, dur = 1100, trigger = true) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let raf, start;
    const from = 0;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start)/dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from)*eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, trigger]);
  return val;
};

const GaugeChart = ({ fairValue = 0, diffPct = 0, zone = 'Justo', seller = false, sellerPos = null, unitLabel = '/ mes', perMes = true, chip = true }) => {
  const SCALE = 24;                                        
  const markP = Math.max(0, Math.min(1, (diffPct + SCALE) / (2 * SCALE)));
  const animP = useAnimatedNumber(markP, 1100);
  const animVal = useAnimatedNumber(fairValue, 1200);

  const CX = 130, CY = 134, R = 100;
  const polar = (p, r = R) => {
    const th = Math.PI * (1 - p);                          
    return { x: CX + r * Math.cos(th), y: CY - r * Math.sin(th) };
  };
  const arc = (p1, p2) => {
    const a = polar(p1), b = polar(p2);
    const large = (p2 - p1) > 0.5 ? 1 : 0;
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  };

  
  
  const posColor = sellerPos === 'Competitivo' ? 'var(--success)'
                 : sellerPos === 'Agresivo' ? 'var(--warning)'
                 : 'var(--primary)';   
  const zoneColor = seller ? posColor
                  : zone === 'Inflado' ? 'var(--danger)'
                  : zone === 'Ganga'  ? 'var(--success)'
                  : 'var(--warning)';
  const tip = polar(animP);
  const sign = diffPct > 0 ? '+' : '';
  
  const diffLabel = Math.abs(diffPct) >= 10 ? Math.round(diffPct) : Math.round(diffPct * 10) / 10;

  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 260 182" style={{ width: '100%', maxWidth: 300, display: 'block', margin: '0 auto' }} role="img" aria-label={`Indicador de precio: ${zone}. Precio de referencia $${Math.round(fairValue).toLocaleString('en-US')}. Diferencia ${sign}${diffLabel}%.`}>
        <defs>
          {

}
          <linearGradient id="gaugeArcGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="oklch(0.66 0.18 155)"/>
            <stop offset="22%"  stopColor="oklch(0.70 0.17 120)"/>
            <stop offset="50%"  stopColor="oklch(0.74 0.16 70)"/>
            <stop offset="78%"  stopColor="oklch(0.67 0.20 35)"/>
            <stop offset="100%" stopColor="oklch(0.61 0.22 25)"/>
          </linearGradient>
        </defs>

        {}
        <path d={arc(0, 1)} fill="none" stroke="url(#gaugeArcGrad)"
              strokeWidth="22" strokeLinecap="round"/>

        {}
        <text x="24"  y="172" fontSize="10" fontWeight="700" fontFamily="Space Grotesk" fill="var(--success)">{seller ? 'CONSERVADOR' : 'GANGA'}</text>
        <text x="130" y="17"  fontSize="10" fontWeight="700" fontFamily="Space Grotesk" fill="oklch(0.48 0.13 60)" textAnchor="middle">{seller ? 'MERCADO' : 'JUSTO'}</text>
        <text x="236" y="172" fontSize="10" fontWeight="700" fontFamily="Space Grotesk" fill="var(--danger)" textAnchor="end">{seller ? 'AGRESIVO' : 'INFLADO'}</text>

        {}
        <line x1={CX} y1={CY} x2={tip.x} y2={tip.y} stroke="var(--ink)" strokeWidth="4" strokeLinecap="round"/>
        <circle cx={tip.x} cy={tip.y} r="7.5" fill="#fff" stroke={zoneColor} strokeWidth="3.5"/>
        <circle cx={CX} cy={CY} r="11" fill="var(--ink)"/>
        <circle cx={CX} cy={CY} r="4.5" fill="#fff"/>
      </svg>

      <div style={{ marginTop: 4 }}>
        <div style={{ fontFamily: 'Space Grotesk', fontSize: 34, fontWeight: 700, color: 'var(--ink)' }}>
          ${Math.round(animVal).toLocaleString('en-US')}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: -2 }}>Precio de referencia {unitLabel}</div>
        {chip && (seller ? sellerPos : true) && (
          <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 7,
                        background: 'var(--line-2)', padding: '6px 13px', borderRadius: 999,
                        fontSize: 12, fontWeight: 700, color: zoneColor }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: zoneColor }}/>
            {seller ? `Tu precio: ${sellerPos}` : `Tu anuncio: ${zone} (${sign}${diffLabel}%)`}
          </div>
        )}
      </div>
    </div>
  );
};

const ScoreCircle = ({ value = 72, max = 100, size = 140, stroke = 12, label, sub, color }) => {
  const animV = useAnimatedNumber(value, 1200);
  const pct = Math.max(0, Math.min(1, animV/max));
  const R = (size - stroke)/2;
  const C = 2*Math.PI*R;
  const off = C*(1 - pct);

  const auto = value >= 75 ? 'var(--success)' : value >= 50 ? 'var(--warning)' : 'var(--danger)';
  const c = color || auto;

  return (
    <div style={{position:'relative', width: size, height: size}}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)'}} role="img" aria-label={`${label || 'Score'}: ${Math.round(value)} de ${max}${sub ? '. ' + sub : ''}`}>
        <circle cx={size/2} cy={size/2} r={R} stroke="var(--line-2)" strokeWidth={stroke} fill="none"/>
        <circle cx={size/2} cy={size/2} r={R} stroke={c} strokeWidth={stroke} fill="none"
                strokeDasharray={C} strokeDashoffset={off}
                strokeLinecap="round"
                style={{transition:'stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)'}}/>
      </svg>
      <div style={{position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
        <div style={{fontFamily:'Space Grotesk', fontWeight:700, fontSize: size*0.28, color: 'var(--ink)', lineHeight:1}}>{Math.round(animV)}</div>
        {label && <div style={{fontSize:10, color:'var(--ink-3)', marginTop:4, textTransform:'uppercase', letterSpacing:'.08em'}}>{label}</div>}
        {sub && <div style={{fontSize:12, fontWeight:600, color:c, marginTop:2}}>{sub}</div>}
      </div>
    </div>
  );
};

const AnimBar = ({ label, value, max = 100, positive = true, delay = 0, suffix = '', tooltip = '' }) => {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(()=> setW(Math.max(2, (value/max)*100)), delay);
    return () => clearTimeout(t);
  }, [value, max, delay]);
  const labelEl = tooltip
    ? <abbr title={tooltip} aria-label={`${label}: ${tooltip}`} style={{textDecoration:'underline dotted', textUnderlineOffset:'2px', cursor:'help'}}>{label}</abbr>
    : label;
  return (
    <div className={`xai-row ${positive ? 'pos' : 'neg'}`}>
      <div className="label">
        {positive
          ? <span style={{color:'var(--success)', fontWeight:700}}>+</span>
          : <span style={{color:'var(--danger)', fontWeight:700}}>−</span>}
        {labelEl}
      </div>
      <div className="value">{value}{suffix}/100</div>
      <div className="bar-wrap"><div className="bar" style={{width: `${w}%`}}/></div>
    </div>
  );
};

const TopNav = ({ active, onNavigate, onLogo, user, isPublic }) => {
  
  
  
  const isSeller = user?.role === 'Propietario' || user?.role === 'Agente inmobiliario';
  const tabs = isSeller ? [
    { key: 'inicio', label: 'Inicio', short: 'Inicio', icon: 'home' },
    { key: 'mis-propiedades', label: 'Mis propiedades', short: 'Avisos', icon: 'map' },
    { key: 'fairvalue', label: 'Analizar precio', short: 'Analizar', icon: 'chart' },
    { key: 'leads', label: 'Leads', short: 'Leads', icon: 'mail' },
    { key: 'profile', label: 'Perfil', short: 'Perfil', icon: 'user' },
  ] : [
    { key: 'inicio', label: 'Inicio', short: 'Inicio', icon: 'home' },
    { key: 'explorar', label: 'Explorar', short: 'Explorar', icon: 'map' },
    { key: 'fairvalue', label: 'Analizar precio', short: 'Analizar', icon: 'chart' },
    { key: 'guardados', label: 'Guardados', short: 'Guardados', icon: 'heart' },
    { key: 'profile', label: 'Perfil', short: 'Perfil', icon: 'user' },
  ];
  const [notifOpen, setNotifOpen] = useState(false);

  const getStoredTheme = () => {
    try { return localStorage.getItem('wasi.theme') || 'light'; } catch(e) { return 'light'; }
  };
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('wasi.theme', theme); } catch(e) {}
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <>
      <nav className={`topnav ${isPublic ? 'public' : ''}`}>
        <div className="container">
          <a className="logo" onClick={onLogo} style={{cursor:'pointer'}}>
            <div className="logo-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20V10l8-6 8 6v10"/>
                <circle cx="15" cy="14" r="2.2" fill="currentColor"/>
                <path d="M15 16.2v2.8" stroke="white" strokeWidth="1.4"/>
              </svg>
            </div>
            <span className="logo-text">Wasi</span>
          </a>

          {!isPublic && (
            <div className="nav-links">
              {tabs.map(t => (
                <button key={t.key} className={active === t.key ? 'active' : ''} onClick={() => onNavigate(t.key)}>
                  <Icon name={t.icon} size={16}/> {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="right">
            <button
              className="icon-btn"
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16}/>
            </button>
            {isPublic ? (
              <>
                <Btn variant="outline" size="sm" onClick={() => onNavigate('login')}>Iniciar sesión</Btn>
                <Btn variant="primary" size="sm" onClick={() => onNavigate('signup')}>Comenzar gratis</Btn>
              </>
            ) : (
              <>
                <button className="icon-btn" aria-label="Notificaciones" onClick={() => setNotifOpen(true)}>
                  <Icon name="bell" size={16}/>
                </button>
                <button className="icon-btn" aria-label="Configuración" onClick={() => onNavigate('profile')}>
                  <Icon name="settings" size={16}/>
                </button>
                <div className="user-pill" role="button" tabIndex={0} aria-label={`Ver perfil de ${user?.name || 'Ana'}`} onClick={() => onNavigate('profile')} onKeyDown={onKeyActivate(() => onNavigate('profile'))}>
                  <div className="avatar" style={{width:32, height:32, fontSize:13, border:'2px solid #fff'}}>{(user?.name || 'A').charAt(0)}</div>
                  <span className="name">{user?.name || 'Ana'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {!isPublic && (
        <nav className="bottom-nav" aria-label="Navegación principal">
          {tabs.map(t => (
            <button key={t.key} className={active === t.key ? 'active' : ''}
              aria-current={active === t.key ? 'page' : undefined}
              onClick={() => onNavigate(t.key)}>
              <Icon name={t.icon} size={20}/>
              <span>{t.short || t.label}</span>
            </button>
          ))}
        </nav>
      )}

      {}
      <Modal
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        icon={<Icon name="bell" size={20}/>}
        title="Notificaciones"
        subtitle="Centro de avisos de Wasi"
        footer={<Btn variant="outline" onClick={() => setNotifOpen(false)}>Cerrar</Btn>}
      >
        <div className="text-center" style={{padding:'14px 0 6px'}}>
          <div style={{width:56, height:56, borderRadius:16, margin:'0 auto 14px',
                       background:'var(--line-2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-3)'}}>
            <Icon name="bell" size={24}/>
          </div>
          <div style={{fontWeight:700, fontFamily:'Space Grotesk', fontSize:16}}>Sin notificaciones nuevas</div>
          <p className="small muted" style={{maxWidth:340, margin:'6px auto 0', lineHeight:1.55}}>
            Te avisaremos cuando aparezca una ganga en tus zonas favoritas o cambien los precios de los inmuebles que analizaste.
          </p>
        </div>
      </Modal>
    </>
  );
};

const Modal = ({ open, onClose, hero, accent, icon, iconVariant, title, subtitle, tag, children, footer, maxWidth }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const closeBtn = onClose && (
    <button
      className={`modal-close ${hero ? 'on-hero' : ''}`}
      onClick={onClose}
      aria-label="Cerrar"
    >
      <Icon name="close" size={16}/>
    </button>
  );

  
  
  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {hero ? (
          <div className={`modal-hero ${accent ? 'accent' : ''}`}>
            {icon && <div className="modal-hero-ico">{icon}</div>}
            <div className="grow">
              <div className="row" style={{ gap: 10 }}>
                <h3>{title}</h3>
                {tag}
              </div>
              {subtitle && <div className="modal-hero-sub">{subtitle}</div>}
            </div>
            {closeBtn}
          </div>
        ) : (
          <div className="modal-head">
            {icon && (
              <div className={`modal-ico ${iconVariant === 'accent' ? 'accent' : ''}`}>
                {icon}
              </div>
            )}
            <div className="grow">
              <div className="row" style={{ gap: 8 }}>
                <h3 className="modal-title">{title}</h3>
                {tag}
              </div>
              {subtitle && <div className="modal-sub">{subtitle}</div>}
            </div>
            {closeBtn}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

const PageHeader = ({ title, subtitle, onBack, actions, tag }) => (
  <div className="page-head">
    <div>
      {onBack && (
        <button className="back-btn" onClick={onBack}>
          <Icon name="back" size={14}/> Volver
        </button>
      )}
      <div className="row" style={{gap:10}}>
        <h1>{title}</h1>
        {tag}
      </div>
      {subtitle && <div className="sub">{subtitle}</div>}
    </div>
    {actions && <div className="actions">{actions}</div>}
  </div>
);

Object.assign(window, {
  Icon, StatusBar, Header, Logo, Btn, Card, Tag, ListingCard,
  Input, Select, Switch, ToggleRow,
  GaugeChart, ScoreCircle, AnimBar,
  TopNav, PageHeader, Modal,
  Glossary, GLOSSARY, onKeyActivate,
  useAnimatedNumber, ZONE_VARIANT,
});

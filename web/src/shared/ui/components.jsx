import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { WASI_STATS } from '../lib/stats.js';
import { onKeyActivate } from '../lib/helpers.js';
import { Api } from '../api/client.js';

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

const GLOSSARY = {
  'Error medio': 'En promedio, qué tan lejos cae la estimación del modelo respecto al precio real, expresado en %. Más bajo es mejor.',
  'Confianza Alta': 'Muchos avisos comparables cerca del pin: la predicción es más estable.',
  'Confianza Media': 'Algunos avisos comparables: la predicción es razonable pero con más margen.',
  'Confianza Baja': 'Pocos avisos comparables cerca: el rango puede ser amplio, tómalo como referencia general.',
  'Veredicto': 'Comparación entre el precio anunciado y el precio de referencia del modelo: Inflado, Justo o Ganga.',
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
        {options.map((o) => {
          // Soporta opciones {value,label} y strings sueltos. OJO: `o.value || o`
          // rompía cuando value === '' (option "Todos") → renderizaba el objeto
          // entero como "[object Object]" y mandaba filtro basura al backend.
          const isObj = o != null && typeof o === 'object';
          const val = isObj ? (o.value ?? '') : o;
          const lbl = isObj ? (o.label ?? o.value ?? '') : o;
          return <option key={String(val)} value={val}>{lbl}</option>;
        })}
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

const MarketRangeD3 = ({ p25, p50, p75, fair, announced, zone }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const draw = () => {
      d3.select(el).selectAll('*').remove();
      const vals = [p25, p50, p75, fair, announced].filter(v => typeof v === 'number' && isFinite(v));
      if (vals.length < 3) return;
      const W = el.clientWidth || 460, H = 104, m = { l: 14, r: 14 };
      const innerW = W - m.l - m.r;
      const center = typeof fair === 'number' ? fair : p50;
      const lo = Math.min(p25 * 0.85, (typeof center === 'number' ? center : p25) * 0.95);
      const hi = Math.max(p75 * 1.15, (typeof center === 'number' ? center : p75) * 1.05);
      const x = d3.scaleLinear().domain([lo, hi]).range([m.l, m.l + innerW]);
      const yMid = 52;
      const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);

      svg.append('line').attr('x1', m.l).attr('x2', m.l + innerW).attr('y1', yMid).attr('y2', yMid)
        .attr('stroke', 'var(--line)').attr('stroke-width', 2).attr('stroke-linecap', 'round');

      if (typeof p25 === 'number' && typeof p75 === 'number') {
        svg.append('rect').attr('x', x(p25)).attr('y', yMid - 7).attr('height', 14).attr('rx', 7)
          .attr('fill', 'rgba(37,99,235,.16)').attr('stroke', 'rgba(37,99,235,.45)')
          .attr('width', 0).transition().duration(600).attr('width', Math.max(2, x(p75) - x(p25)));
      }

      if (typeof center === 'number') {
        svg.append('line').attr('x1', x(center)).attr('x2', x(center)).attr('y1', yMid - 13).attr('y2', yMid + 13)
          .attr('stroke', 'var(--primary)').attr('stroke-width', 2.5);
        svg.append('text').attr('x', x(center)).attr('y', yMid - 20).attr('text-anchor', 'middle')
          .attr('class', 'd3-lbl').attr('fill', 'var(--primary)').text('Justo $' + Math.round(center).toLocaleString('en-US'));
      }

      if (typeof announced === 'number') {
        const col = zone === 'Ganga' ? '#15803d' : zone === 'Inflado' ? '#b91c1c' : '#b45309';
        const out = announced < lo ? 'left' : announced > hi ? 'right' : null;
        const ax = out === 'left' ? m.l + 10 : out === 'right' ? m.l + innerW - 10 : x(announced);
        svg.append('circle').attr('cx', ax).attr('cy', yMid).attr('r', 7.5)
          .attr('fill', col).attr('stroke', '#fff').attr('stroke-width', 2.5);
        if (out) {
          const dir = out === 'right' ? 1 : -1;
          svg.append('path')
            .attr('d', `M ${ax + dir * 12},${yMid - 5} L ${ax + dir * 12},${yMid + 5} L ${ax + dir * 19},${yMid} Z`)
            .attr('fill', col);
        }
        const pctOut = (typeof center === 'number' && center > 0)
          ? Math.round((announced - center) / center * 100) : null;
        const label = 'Tu precio $' + Math.round(announced).toLocaleString('en-US')
          + (out && pctOut !== null ? ` · fuera de rango (${pctOut > 0 ? '+' : ''}${pctOut}%)` : '');
        svg.append('text').attr('x', ax).attr('y', yMid + 28)
          .attr('text-anchor', out === 'right' ? 'end' : out === 'left' ? 'start' : 'middle')
          .attr('class', 'd3-lbl').attr('fill', col).text(label);
      }
    };
    draw();
    let ro;
    if (window.ResizeObserver) { ro = new ResizeObserver(draw); ro.observe(el); }
    return () => { if (ro) ro.disconnect(); };
  }, [p25, p50, p75, fair, announced, zone]);
  return <div ref={ref} className="d3-marketrange" style={{ width: '100%' }}/>;
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
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);

  // Badge de no leídas: fetch al montar (usuario logueado) + refresco cada 60s
  // para captar leads nuevos sin recargar. Silencioso ante errores de red.
  useEffect(() => {
    if (isPublic) return;
    let vivo = true;
    const refrescar = () => {
      Api.unreadCount().then((r) => { if (vivo) setUnread(r.unread || 0); }).catch(() => {});
    };
    refrescar();
    const id = setInterval(refrescar, 60000);
    return () => { vivo = false; clearInterval(id); };
  }, [isPublic]);

  // Al abrir la campana: trae la lista y marca todo como leído (limpia el badge).
  const abrirNotifs = () => {
    setNotifOpen(true);
    Api.notifications().then((rows) => setNotifs(rows || [])).catch(() => {});
    Api.markNotificationsRead().then(() => setUnread(0)).catch(() => {});
  };

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
          <a className="logo" onClick={onLogo} style={{cursor:'pointer'}}
            role="button" tabIndex={0} aria-label="Ir al inicio"
            onKeyDown={onKeyActivate(onLogo)}>
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
                <button className="icon-btn" aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'} onClick={abrirNotifs} style={{position:'relative'}}>
                  <Icon name="bell" size={16}/>
                  {unread > 0 && (
                    <span aria-hidden="true" style={{
                      position:'absolute', top:2, right:2, minWidth:16, height:16, padding:'0 4px',
                      borderRadius:8, background:'#ef4444', color:'#fff', fontSize:10, fontWeight:700,
                      lineHeight:'16px', textAlign:'center', boxShadow:'0 0 0 2px var(--bg, #fff)'}}>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
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
        {notifs.length === 0 ? (
          <div className="text-center" style={{padding:'14px 0 6px'}}>
            <div style={{width:56, height:56, borderRadius:16, margin:'0 auto 14px',
                         background:'var(--line-2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-3)'}}>
              <Icon name="bell" size={24}/>
            </div>
            <div style={{fontWeight:700, fontFamily:'Space Grotesk', fontSize:16}}>Sin notificaciones nuevas</div>
            <p className="small muted" style={{maxWidth:340, margin:'6px auto 0', lineHeight:1.55}}>
              Te avisaremos cuando alguien se interese en tus inmuebles publicados.
            </p>
          </div>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:8, padding:'4px 0'}}>
            {notifs.map((n) => (
              <div key={n.id} style={{display:'flex', gap:10, padding:'10px 12px', borderRadius:12,
                     background:'var(--line-2)', alignItems:'flex-start'}}>
                <div style={{width:34, height:34, borderRadius:10, flexShrink:0,
                       background:'var(--brand-weak, #ccfbf1)', color:'var(--brand, #0d9488)',
                       display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <Icon name="mail" size={16}/>
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700, fontSize:13.5}}>{n.title}</div>
                  <div className="small muted" style={{lineHeight:1.5, marginTop:2}}>{n.body}</div>
                  <div className="small muted" style={{fontSize:11, marginTop:4}}>
                    {new Date(n.created_at).toLocaleString('es-PE', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
};

const Modal = ({ open, onClose, hero, accent, icon, iconVariant, title, subtitle, tag, children, footer, maxWidth }) => {
  const modalRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape' && onClose) { onClose(); return; }
      if (e.key !== 'Tab') return;
      // Focus-trap: mantener el foco dentro del modal.
      const box = modalRef.current;
      if (!box) return;
      const foc = box.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!foc.length) return;
      const first = foc[0], last = foc[foc.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // Foco inicial dentro del modal.
    const t = setTimeout(() => {
      const box = modalRef.current;
      if (box) {
        const f = box.querySelector(
          'input, select, textarea, button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
        if (f) f.focus();
      }
    }, 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimeout(t);
      if (prevFocus && prevFocus.focus) prevFocus.focus();  // restaurar foco al cerrar
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



  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal"
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Ventana'}
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

const Loading = ({ label = 'Calculando precio de referencia…' }) => (
  <div className="container fade-in" style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight: 'calc(100vh - var(--nav-h) - 80px)', flexDirection:'column', gap:24}}>
    <Logo/>
    <div style={{width:'100%', maxWidth: 320}}>
      <div className="loadbar"/>
    </div>
    <div className="text-center">
      <div style={{fontWeight:600, color:'var(--ink-2)', fontSize:15}}>{label}</div>
      <div className="small muted" style={{marginTop:6}}>Modelo Wasi v2 · error medio {WASI_STATS.ALQ_MAPE}% · {WASI_STATS.ALQ_AVISOS} avisos</div>
    </div>
  </div>
);

export {
  AnimBar,
  Btn,
  Card,
  GLOSSARY,
  GaugeChart,
  Glossary,
  Header,
  Icon,
  Input,
  Loading,
  Logo,
  MarketRangeD3,
  Modal,
  PageHeader,
  ScoreCircle,
  Select,
  StatusBar,
  Stepper,
  Switch,
  Tag,
  ToggleRow,
  TopNav,
  onKeyActivate,
  useAnimatedNumber,
};

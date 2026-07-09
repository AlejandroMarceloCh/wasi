import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Api } from '../../shared/api/client.js';
import { AMENIDADES } from '../../shared/lib/amenities.js';
import { LIMA_ALIASES } from '../../shared/lib/aliases_lima.js';
import { enLima, handleApiErr, onKeyActivate } from '../../shared/lib/helpers.js';
import { WASI_STATS } from '../../shared/lib/stats.js';
import { AddressSearch, MapPicker } from '../../shared/map/map-components.jsx';
import {
  Btn,
  Card,
  GaugeChart,
  GLOSSARY,
  Glossary,
  Icon,
  Input,
  Loading,
  MarketRangeD3,
  Modal,
  PageHeader,
  ScoreCircle,
  Stepper,
  Switch,
  Tag,
  ToggleRow,
} from '../../shared/ui/components.jsx';

const useS = useState;
const useE = useEffect;
const useR = useRef;

export const FairValueForm = ({ role, prefill, onBack, onSubmit, onError, onAuthExpired }) => {
  const isSeller = role === 'Propietario' || role === 'Agente inmobiliario';
  
  
  const [operacion, setOperacion] = useS('alquiler');
  const isVenta = operacion === 'venta';
  const [step, setStep] = useS(1);
  const [submitting, setSubmitting] = useS(false);
  const [err, setErr] = useS('');
  
  
  const [f, setF] = useS(() => {
    const p = prefill || {};
    const amen = Array.isArray(p.amenities) ? p.amenities
      : (typeof p.amenities === 'string' && p.amenities
          ? p.amenities.split(',').map(s => s.trim()).filter(Boolean) : []);
    return {
      lat: typeof p.lat === 'number' ? p.lat : -12.121,
      lng: typeof p.lng === 'number' ? p.lng : -77.030,
      area: p.area != null ? String(p.area) : '80',
      dormitorios: p.dormitorios ?? 2, banos: p.banos ?? 2,
      cocheras: p.cocheras ?? 1, antiguedad_anios: p.antiguedad_anios ?? 5,
      es_estudio: !!p.es_estudio, amenities: amen,
      precio: p.precio != null ? String(p.precio) : '',
    };
  });
  
  
  
  
  
  const [fromCatalog, setFromCatalog] = useS(!!(prefill && prefill.from_catalog));
  const set = (k, v) => { setFromCatalog(false); setF(prev => ({ ...prev, [k]: v })); };
  const toggleAmenity = (k) => { setFromCatalog(false); setF(prev => ({
    ...prev,
    amenities: prev.amenities.includes(k)
      ? prev.amenities.filter(x => x !== k)
      : [...prev.amenities, k],
  })); };

  
  const [flyTo, setFlyTo] = useS(null);

  const pinOk = enLima(f.lat, f.lng);
  const areaNum = Number(f.area);
  const areaOk = f.area && areaNum >= 10 && areaNum <= 1000;
  
  const PRECIO_MIN = isVenta ? 10000 : 50;
  const PRECIO_MAX = isVenta ? 5000000 : 50000;
  const precioNum = Number(f.precio);
  const precioOk = f.precio && precioNum >= PRECIO_MIN && precioNum <= PRECIO_MAX;

  
  
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
      const unidad = isVenta ? 'USD' : 'USD/mes';
      setErr(`Ingresa un precio ${isVenta ? 'de venta' : 'anunciado'} entre $${PRECIO_MIN.toLocaleString('en-US')} y $${PRECIO_MAX.toLocaleString('en-US')} ${unidad}.`);
      return;
    }
    const precio = precioNum;
    setErr(''); setSubmitting(true);
    try {
      if (isVenta) {
        
        
        const res = await Api.predictVenta({
          lat: f.lat, lng: f.lng, area: areaNum,
          dormitorios: f.dormitorios, banos: f.banos, cocheras: f.cocheras,
          antiguedad_anios: f.antiguedad_anios, precio,
        });
        onSubmit && onSubmit(null, { lat: f.lat, lng: f.lng }, { operacion: 'venta', ventaData: res });
        return;
      }
      
      const res = await Api.predict({
        lat: f.lat, lng: f.lng, area: areaNum,
        dormitorios: f.dormitorios, banos: f.banos, cocheras: f.cocheras,
        antiguedad_anios: f.antiguedad_anios, es_estudio: f.es_estudio,
        amenities: f.amenities, precio,
        from_catalog: fromCatalog,   
      });
      
      
      onSubmit && onSubmit(res.analysis_id, { lat: f.lat, lng: f.lng }, {
        predictData: res,
        form: { lat: f.lat, lng: f.lng, area: areaNum, dormitorios: f.dormitorios,
                banos: f.banos, cocheras: f.cocheras, antiguedad_anios: f.antiguedad_anios,
                es_estudio: f.es_estudio, amenities: f.amenities, precio },
      });
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

      {
}
      {fromCatalog && (
        <div style={{
          margin:'0 0 16px', padding:'12px 14px', borderRadius:10,
          background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.35)',
          display:'flex', gap:10, alignItems:'flex-start',
        }}>
          <Icon name="info" size={16} stroke="var(--warning)"/>
          <p style={{margin:0, fontSize:12.5, lineHeight:1.55, color:'var(--ink-2)'}}>
            Este aviso forma parte del catálogo con el que se entrenó el modelo.
            Si lo analizas sin cambiar nada, el modelo lo reconocerá y el veredicto
            tenderá a <b>Justo</b>. Para una estimación imparcial, modifica algún
            dato o ingresa un inmueble nuevo.
          </p>
        </div>
      )}

      {

}
      {step === 1 && (
        <div className="row" style={{gap:8, marginBottom:16}}>
          <span className="small muted" style={{marginRight:4}}>Operación:</span>
          <Btn
            variant={operacion === 'alquiler' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => { if (operacion !== 'alquiler') { setOperacion('alquiler'); setFromCatalog(false); setF(p => ({...p, precio: ''})); setErr(''); } }}
            aria-pressed={operacion === 'alquiler'}
          >Alquiler</Btn>
          <Btn
            variant={operacion === 'venta' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => { if (operacion !== 'venta') { setOperacion('venta'); setFromCatalog(false); setF(p => ({...p, precio: ''})); setErr(''); } }}
            aria-pressed={operacion === 'venta'}
          >Venta</Btn>
        </div>
      )}

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
            Busca la dirección o arrastra el pin en la ubicación exacta del departamento.
          </p>
          <AddressSearch onPick={(lat,lng)=>setFlyTo({lat,lng})}/>
          <MapPicker lat={f.lat} lng={f.lng} flyTo={flyTo}
            onMove={(lat,lng)=>setF(p=>({...p, lat, lng}))}/>
          <div className="row" style={{justifyContent:'space-between', marginTop:12}}>
            <span className="small muted numeric">{f.lat.toFixed(5)}, {f.lng.toFixed(5)}</span>
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
          {!isVenta && (
            <ToggleRow label="Es un estudio (monoambiente)" checked={f.es_estudio}
              onChange={(v)=>setF(p=>({
                ...p, es_estudio:v,
                dormitorios: v ? 0 : Math.max(1, p.dormitorios),   
                banos: v ? p.banos : Math.max(1, p.banos),
              }))}/>
          )}
          <div className="grid-2" style={{marginTop:12, gap:14}}>
            <Input label="Área" value={f.area} inputMode="numeric" suffix="m²"
              onChange={(e)=>set('area', e.target.value.replace(/[^0-9]/g,''))}/>
            <Stepper label="Antigüedad" value={f.antiguedad_anios}
              set={(v)=>set('antiguedad_anios',v)} min={0} max={100} suffix="años"/>
            <Stepper label="Dormitorios" value={f.dormitorios}
              set={(v)=>set('dormitorios',v)} min={f.es_estudio?0:1} max={20}/>
            <Stepper label="Baños" value={f.banos}
              set={(v)=>set('banos',v)} min={f.es_estudio?0:1} max={20}/>
            <Stepper label="Cocheras" value={f.cocheras}
              set={(v)=>set('cocheras',v)} min={0} max={20}/>
          </div>
          {!isVenta && (
            <>
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
            </>
          )}
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
          {}
          <Card className="wizard-card price-card">
            <div className="price-card-head">
              <div className="section-h">3 · {isVenta ? 'Precio de venta (USD)' : (isSeller ? '¿Cuánto piensas pedir?' : 'Precio anunciado')}</div>
              <p className="price-card-sub">
                {isVenta
                  ? 'El precio de venta del aviso que quieres evaluar contra el modelo.'
                  : isSeller
                  ? 'Tu precio en mente. Te decimos si vas conservador, competitivo o agresivo frente al mercado.'
                  : 'El precio del aviso que quieres evaluar contra el modelo.'}
              </p>
            </div>
            <div className="big-price">
              <span className="big-price-prefix">$</span>
              <input
                className="big-price-input"
                value={f.precio}
                inputMode="numeric"
                placeholder={isVenta ? '180000' : '900'}
                aria-label={isVenta ? 'Precio de venta en USD' : (isSeller ? 'Precio que piensas pedir en USD por mes' : 'Precio anunciado en USD por mes')}
                onChange={(e)=>set('precio', e.target.value.replace(/[^0-9]/g,''))}
              />
              {!isVenta && (
                <span className="big-price-suffix">
                  <span className="sl">/</span> mes
                </span>
              )}
            </div>
            <div className="big-price-foot">
              <span className="muted">{isVenta ? 'USD (total)' : 'USD por mes'}</span>
              <span className="muted">
                Rango aceptado: ${PRECIO_MIN.toLocaleString('en-US')}–${PRECIO_MAX.toLocaleString('en-US')}
              </span>
            </div>
            {f.precio && !precioOk && (
              <div className="small" style={{color:'var(--danger)', marginTop:10}}>
                El precio debe estar entre ${PRECIO_MIN.toLocaleString('en-US')} y ${PRECIO_MAX.toLocaleString('en-US')} {isVenta ? 'USD' : 'USD/mes'}.
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

          {}
          <Card className="wizard-card summary-card">
            <div className="section-h">Resumen del depto</div>
            <div className="summary-rows">
              <div className="srow">
                <span className="k">Operación</span>
                <span className="v">{isVenta ? 'Venta' : 'Alquiler'}</span>
              </div>
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
              {!isVenta && (
                <div className="srow">
                  <span className="k">Amenities</span>
                  <span className="v">{f.amenities.length}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

const renderNarrative = (text) => {
  const lines = String(text || '').split('\n');
  const out = [];
  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const head = line.match(/^\*\*(.+?)\*\*\s*:?\s*$/);
    if (head) {
      out.push(
        <div key={out.length} style={{
          fontSize:11.5, fontWeight:700, color:'var(--primary)',
          marginTop: out.length ? 16 : 0, marginBottom:6,
          textTransform:'uppercase', letterSpacing:.4,
        }}>{head[1]}</div>
      );
      return;
    }
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((seg, j) => {
      const m = seg.match(/^\*\*(.+)\*\*$/);
      
      
      return m ? <b key={j}>{m[1]}</b> : <span key={j}>{seg.replace(/\*/g, '')}</span>;
    });
    out.push(
      <p key={out.length} style={{margin:'0 0 8px', fontSize:13.5, lineHeight:1.65, color:'var(--ink)'}}>{parts}</p>
    );
  });
  return out;
};

const VentaResult = ({ data, role, onBack, onContext }) => {
  const isSeller = role === 'Propietario' || role === 'Agente inmobiliario';
  const fair = data.fair_value;
  const anuncio = data.announced_price;
  const diff = data.diff;
  const pct = data.diff_pct;
  const zona = data.zone || 'Justo';
  const isInflado = zona === 'Inflado';
  const isGanga = zona === 'Ganga';
  const accentVar = isInflado ? 'danger' : 'success';
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  
  const bandMin = data.min;
  const bandMax = data.max;
  
  
  
  const pocosComparables = (data.n_comparables || 0) < 27;

  
  const sellerPos = (anuncio == null) ? null
    : anuncio < bandMin ? 'Conservador'
    : anuncio > bandMax ? 'Agresivo'
    : 'Competitivo';
  const SELLER_POS_COPY = {
    Conservador: 'Por debajo del mercado: venderás más rápido, pero dejas margen sobre la mesa.',
    Competitivo: 'Alineado al mercado: buen equilibrio entre margen y rapidez de venta.',
    Agresivo: 'Por encima del mercado: más margen, pero puede tardar en venderse.',
  };
  const POS_VARIANT = { Conservador: 'accent', Competitivo: 'success', Agresivo: 'warning' };
  const sellerPosTag = sellerPos ? POS_VARIANT[sellerPos] : 'accent';
  const barLo = Math.min(bandMin, anuncio || bandMin) * 0.95;
  const barHi = Math.max(bandMax, anuncio || bandMax) * 1.05;
  const barPct = (v) => Math.max(0, Math.min(100, (v - barLo) / (barHi - barLo) * 100));
  const usd = (v) => '$' + Math.round(v).toLocaleString('en-US');

  return (
    <div className="container fade-in">
      <PageHeader
        title={isSeller ? 'Precio de venta sugerido' : 'Precio de venta de referencia'}
        subtitle={`Venta · ${data.distrito || ''}`}
        onBack={onBack}
      />

      {warnings.length > 0 && (
        <div className="banner warn" style={{marginBottom:14}}>
          <Icon name="alert" size={14}/> <span>{warnings.join(' · ')}</span>
        </div>
      )}

      {pocosComparables && (
        <div className="banner banner-coverage" style={{marginBottom:14}}>
          <Icon name="info" size={14}/>
          <div>
            <strong>Cobertura baja en esta zona.</strong> Hay pocos avisos de venta cercanos para comparar, por eso el rango puede ser más ancho de lo habitual. Tómalo como referencia, no como precio exacto.
          </div>
        </div>
      )}

      <div className="result-grid">
        <Card>
          <div className="row" style={{justifyContent:'space-between'}}>
            <div className="section-h" style={{margin:0}}>{isSeller ? 'Tu precio sugerido' : 'Precio de venta de referencia'}</div>
            <Tag variant="accent">Venta · v1</Tag>
          </div>
          <div style={{marginTop:18}}>
            <GaugeChart fairValue={fair} diffPct={pct} zone={zona} seller={isSeller} sellerPos={sellerPos}
              unitLabel="total" perMes={false}/>
          </div>
          <div style={{marginTop:14, padding:'10px 12px', background:'var(--bg-tint)', borderRadius:10, fontSize:12, color:'var(--ink-2)', lineHeight:1.55}}>
            <Icon name="info" size={13} stroke="var(--primary)"/> Basado en precios de <b>avisos</b> de venta del
            mercado, no en precios de cierre reales. Error medio del modelo: ±{data.mae_pct}%.
          </div>
        </Card>

        <div className="stack-20">
          {isSeller ? (
            <Card accent={sellerPos ? POS_VARIANT[sellerPos] : 'success'}>
              <div className="row" style={{justifyContent:'space-between'}}>
                <div className="section-h" style={{margin:0}}>Tu posicionamiento</div>
                {sellerPos && <Tag variant={sellerPosTag}>{sellerPos}</Tag>}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:14}}>
                <div>
                  <div className="small muted">Tu precio en mente</div>
                  <div className="numeric" style={{fontSize:26, fontWeight:700}}>{usd(anuncio)}</div>
                  <div className="tiny muted" style={{marginTop:2}}>USD</div>
                </div>
                <div>
                  <div className="small muted">Precio sugerido</div>
                  <div className="numeric" style={{fontSize:26, fontWeight:700, color:'var(--primary)'}}>{usd(fair)}</div>
                  <div className="tiny muted" style={{marginTop:2}}>USD</div>
                </div>
              </div>
              <div style={{marginTop:18}}>
                <div style={{position:'relative', height:8, background:'var(--bg-tint)', borderRadius:4}}>
                  <div style={{position:'absolute', left:`${barPct(bandMin)}%`, width:`${barPct(bandMax)-barPct(bandMin)}%`, top:0, bottom:0, background:'var(--success-soft)', borderRadius:4}}/>
                  <div style={{position:'absolute', left:`${barPct(fair)}%`, top:-3, width:2, height:14, background:'var(--primary)', transform:'translateX(-50%)'}} title="Precio sugerido"/>
                  <div style={{position:'absolute', left:`${barPct(anuncio)}%`, top:-5, width:3, height:18, background:'var(--ink)', borderRadius:2, transform:'translateX(-50%)'}} title="Tu precio"/>
                </div>
                <div className="tiny muted" style={{marginTop:6}}>
                  Rango sugerido {usd(bandMin)}–{usd(bandMax)} · la barra negra es tu precio, la azul el sugerido
                </div>
              </div>
              {sellerPos && (
                <div className="tiny" style={{marginTop:10, color:'var(--ink-2)', lineHeight:1.55}}>
                  {SELLER_POS_COPY[sellerPos]}
                </div>
              )}
            </Card>
          ) : (
            <Card accent={accentVar}>
              <div className="section-h" style={{margin:0}}>Comparativa con tu anuncio</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16, marginTop:14}}>
                <div>
                  <div className="small muted">Precio anunciado</div>
                  <div className="numeric" style={{fontSize: 26, fontWeight:700}}>{usd(anuncio)}</div>
                  <div className="tiny muted" style={{marginTop:2}}>USD</div>
                </div>
                <div>
                  <div className="small muted">Precio de referencia</div>
                  <div className="numeric" style={{fontSize: 26, fontWeight:700, color:'var(--primary)'}}>{usd(fair)}</div>
                  <div className="tiny muted" style={{marginTop:2}}>USD</div>
                </div>
              </div>
              <div className={`verdict verdict-${isInflado?'inflado':isGanga?'ganga':'justo'}`}>
                <span className="dot"/>
                <div className="grow">
                  <div className="lbl">Veredicto: {isInflado ? '↑ ' : isGanga ? '↓ ' : '= '}{zona}</div>
                  <div className="numeric val">
                    {diff >= 0 ? '+' : '−'}{usd(Math.abs(diff))} <span className="pct">({pct}%)</span>
                  </div>
                </div>
                <Tag variant={isInflado ? 'danger' : isGanga ? 'success' : 'warning'}>
                  {isInflado ? 'Negociable' : isGanga ? 'Oportunidad' : 'Precio alineado'}
                </Tag>
              </div>
            </Card>
          )}

          {}
          <Card>
            <div className="section-h" style={{margin:0}}>Rango de referencia</div>
            <div style={{display:'flex', alignItems:'baseline', justifyContent:'center', gap:8, marginTop:12}}>
              <span className="numeric" style={{fontSize:22, fontWeight:700, color:'var(--primary)'}}>{usd(bandMin)}</span>
              <span className="tiny muted" style={{fontSize:13}}>—</span>
              <span className="numeric" style={{fontSize:22, fontWeight:700, color:'var(--primary)'}}>{usd(bandMax)}</span>
            </div>
            <div className="tiny muted" style={{textAlign:'center', marginTop:6}}>
              {data.n_comparables} avisos comparables · radio {data.coverage_radius_km} km · ±{data.mae_pct}% del modelo
            </div>
          </Card>

          {}
          <div style={{padding:'10px 12px', background:'var(--bg-tint)', borderRadius:10, fontSize:12, color:'var(--ink-3)', lineHeight:1.55}}>
            <Icon name="info" size={13} stroke="var(--ink-3)"/> El análisis detallado (SHAP, contrafactuales y narrativa con IA) está disponible para alquiler. Venta es v1: precio justo, veredicto y rango.
          </div>
        </div>
      </div>

      <div className="row" style={{marginTop:24, justifyContent:'flex-end'}}>
        <Btn variant="primary" size="lg" onClick={onContext}>
          <Icon name="shield" size={16}/> Ver contexto del barrio
        </Btn>
      </div>
    </div>
  );
};

const SimBarsD3 = ({ base, sim }) => {
  const ref = useR(null);
  const prev = useR({ base: 0, sim: 0 });
  useE(() => {
    const el = ref.current;
    if (!el || !isFinite(base) || !isFinite(sim) || base <= 0) return;
    const draw = () => {
      d3.select(el).selectAll('*').remove();
      const W = el.clientWidth || 420, H = 84, m = { l: 84, r: 74 };
      const innerW = Math.max(60, W - m.l - m.r);
      const maxV = Math.max(base, sim) * 1.08;
      const bw = (v) => Math.max(3, v / maxV * innerW);
      const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
      const rows = [
        { v: base, from: prev.current.base || 0, y: 12, color: 'var(--ink-3)', label: 'Hoy' },
        { v: sim,  from: prev.current.sim  || 0, y: 48, color: 'var(--primary)', label: 'Simulado' },
      ];
      rows.forEach(r => {
        svg.append('text').attr('x', m.l - 10).attr('y', r.y + 12).attr('text-anchor', 'end')
          .attr('class', 'd3-cat').text(r.label);
        svg.append('rect').attr('x', m.l).attr('y', r.y).attr('height', 18).attr('rx', 9)
          .attr('fill', r.color).attr('opacity', .85)
          .attr('width', bw(r.from)).transition().duration(450).attr('width', bw(r.v));
        svg.append('text').attr('y', r.y + 13).attr('class', 'd3-val')
          .attr('x', m.l + bw(r.from) + 8).transition().duration(450).attr('x', m.l + bw(r.v) + 8)
          .text('$' + Math.round(r.v).toLocaleString('en-US'));
      });
      prev.current = { base, sim };
    };
    draw();
    let ro;
    if (window.ResizeObserver) { ro = new ResizeObserver(draw); ro.observe(el); }
    return () => { if (ro) ro.disconnect(); };
  }, [base, sim]);
  return <div ref={ref} className="d3-simbars" style={{ width: '100%' }}/>;
};

export const WhatIfSimulator = ({ baseForm, onAuthExpired }) => {
  
  const [f, setF] = useS(() => ({
    area: Math.round(baseForm.area),
    dormitorios: baseForm.dormitorios, banos: baseForm.banos,
    cocheras: baseForm.cocheras || 0, antiguedad_anios: baseForm.antiguedad_anios || 0,
  }));
  const [baseFair, setBaseFair] = useS(null);   
  const [sim, setSim] = useS(null);             
  const [busy, setBusy] = useS(false);
  const [err, setErr] = useS('');
  const tRef = useR(null);
  const reqId = useR(0);

  const payload = (nf) => ({
    lat: baseForm.lat, lng: baseForm.lng,
    es_estudio: !!baseForm.es_estudio,
    amenities: Array.isArray(baseForm.amenities) ? baseForm.amenities : [],
    precio: Number(baseForm.precio) > 0 ? Number(baseForm.precio) : 1,
    area: nf.area, dormitorios: nf.dormitorios,
    banos: baseForm.es_estudio ? nf.banos : Math.max(1, nf.banos),
    cocheras: nf.cocheras, antiguedad_anios: nf.antiguedad_anios,
  });

  
  useE(() => {
    let alive = true;
    Api.simulate(payload(f))
      .then(r => { if (alive) { setBaseFair(r.fair_value); setSim(r); } })
      .catch(ex => {
        if (!alive) return;
        if (ex && ex.status === 401 && onAuthExpired) return onAuthExpired();
        setErr('El simulador no está disponible en este momento.');
      });
    return () => { alive = false; clearTimeout(tRef.current); };
  }, []);

  const run = (nf) => {
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => {
      const id = ++reqId.current;
      setBusy(true);
      Api.simulate(payload(nf))
        .then(r => { if (id === reqId.current) { setSim(r); setBusy(false); setErr(''); } })
        .catch(ex => {
          if (id !== reqId.current) return;
          setBusy(false);
          if (ex && ex.status === 401 && onAuthExpired) return onAuthExpired();
          setErr('No se pudo recalcular; intenta de nuevo.');
        });
    }, 350);
  };
  const set = (k, v) => { const nf = { ...f, [k]: Number(v) }; setF(nf); run(nf); };
  const reset = () => {
    const nf = {
      area: Math.round(baseForm.area), dormitorios: baseForm.dormitorios,
      banos: baseForm.banos, cocheras: baseForm.cocheras || 0,
      antiguedad_anios: baseForm.antiguedad_anios || 0,
    };
    setF(nf); run(nf);
  };

  if (err && baseFair === null) return null;   
  const simFair = sim ? sim.fair_value : baseFair;
  const delta = (simFair != null && baseFair != null) ? simFair - baseFair : 0;
  const deltaPct = baseFair ? (delta / baseFair * 100) : 0;
  const deltaColor = delta > 0 ? 'var(--success)' : delta < 0 ? 'var(--danger)' : 'var(--ink-3)';
  const SLIDERS = [
    { k: 'area', label: 'Área (m²)', min: 20, max: Math.max(300, Math.round(baseForm.area * 1.5)), step: 5 },
    { k: 'dormitorios', label: 'Dormitorios', min: 0, max: 6, step: 1 },
    { k: 'banos', label: 'Baños', min: baseForm.es_estudio ? 0 : 1, max: 5, step: 1 },
    { k: 'cocheras', label: 'Cocheras', min: 0, max: 4, step: 1 },
    { k: 'antiguedad_anios', label: 'Antigüedad (años)', min: 0, max: 50, step: 1 },
  ];
  return (
    <Card>
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="section-h" style={{margin:0}}>Simula tu inmueble</div>
        <Tag variant="accent">Modelo en vivo</Tag>
      </div>
      <p className="tiny muted" style={{marginTop:4, marginBottom:10}}>
        Mueve las barras y el modelo recalcula el precio de referencia al instante.
      </p>
      {baseFair === null ? (
        <div className="tiny muted">Cargando simulador…</div>
      ) : (
        <>
          <SimBarsD3 base={baseFair} sim={simFair}/>
          <div className="row" style={{justifyContent:'space-between', marginTop:6}}>
            <span className="tiny muted">{busy ? 'Recalculando…' : err ? err : 'Diferencia vs tu inmueble actual:'}</span>
            <span className="numeric small" style={{fontWeight:700, color:deltaColor}}>
              {delta >= 0 ? '+' : '−'}${Math.round(Math.abs(delta)).toLocaleString('en-US')}
              {' '}({deltaPct >= 0 ? '+' : '−'}{Math.abs(deltaPct) >= 10 ? Math.round(Math.abs(deltaPct)) : Math.abs(deltaPct).toFixed(1)}%)
            </span>
          </div>
          <div style={{marginTop:8}}>
            {SLIDERS.map(s => (
              <div key={s.k} className="whatif-row">
                <label className="small" htmlFor={`wif-${s.k}`}>{s.label}</label>
                <input id={`wif-${s.k}`} type="range" min={s.min} max={s.max} step={s.step}
                       value={f[s.k]} onChange={(e)=>set(s.k, e.target.value)}
                       aria-label={s.label}/>
                <span className="whatif-val numeric small">{f[s.k]}</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:12, textAlign:'right'}}>
            <Btn variant="outline" size="sm" onClick={reset}>Restablecer</Btn>
          </div>
        </>
      )}
    </Card>
  );
};

const ComparablesCard = ({ data }) => {
  const [items, setItems] = useS(null);
  const [loading, setLoading] = useS(true);
  const lat = data && data.lat, lng = data && data.lng;
  useE(() => {
    if (lat == null || lng == null) { setLoading(false); return; }
    let alive = true;
    Api.comparables({ lat, lng, area: data.area, dormitorios: data.dormitorios })
      .then(r => { if (alive) { setItems((r && r.items) || []); setLoading(false); } })
      .catch(() => { if (alive) { setItems([]); setLoading(false); } });
    return () => { alive = false; };
  }, [lat, lng]);

  if (lat == null || lng == null) return null;            
  if (loading) return null;                                
  if (!items || items.length === 0) return null;

  const precios = items.map(i => i.precio_usd).sort((a, b) => a - b);
  const mid = precios[Math.floor(precios.length / 2)];
  return (
    <Card>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="section-h" style={{ margin: 0 }}>Avisos similares en la zona</div>
        <Tag variant="outline">{items.length} comparables</Tag>
      </div>
      <p className="tiny muted" style={{ marginTop: 4, marginBottom: 10 }}>
        Avisos reales cercanos y de tamaño parecido — la evidencia contra la que se
        contrasta tu precio. Mediana del grupo: <strong>${mid.toLocaleString('en-US')}/mes</strong>.
      </p>
      <div className="stack-8">
        {items.map((it, i) => (
          <div key={i} className="row" style={{
            justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>${it.precio_usd.toLocaleString('en-US')}<span className="tiny muted"> /mes</span></div>
              <div className="tiny muted">
                {it.area_m2} m² · {it.dormitorios} dorm · {it.banos} baños
                {it.antiguedad_anios > 0 ? ` · ${it.antiguedad_anios} años` : ''}
              </div>
            </div>
            <div className="tiny muted" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              {it.distrito}<br/>a {it.distancia_km} km
            </div>
          </div>
        ))}
      </div>
      <p className="tiny muted" style={{ marginTop: 8 }}>
        Fuente: avisos del dataset de Wasi. Se omite la dirección exacta por privacidad.
      </p>
    </Card>
  );
};

const PoiImportanceD3 = ({ data }) => {
  const ref = useR(null);
  useE(() => {
    const el = ref.current;
    if (!el || !Array.isArray(data) || !data.length) return;
    const draw = () => {
      d3.select(el).selectAll('*').remove();
      const rows = data.slice(0, 10);
      const W = el.clientWidth || 480, rowH = 30, m = { l: 132, r: 52, t: 8, b: 8 };
      const H = rows.length * rowH + m.t + m.b;
      const x = d3.scaleLinear().domain([0, d3.max(rows, d => d.pct) || 1]).range([m.l, W - m.r]);
      const color = d3.scaleSequential().domain([rows.length - 1, 0]).interpolator(d3.interpolateRgb('#9ec5fe', '#1d4ed8'));
      const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
      const g = svg.selectAll('g').data(rows).enter().append('g')
        .attr('transform', (d, i) => `translate(0,${m.t + i * rowH + rowH / 2})`);
      g.append('text').attr('x', m.l - 10).attr('dy', '.32em').attr('text-anchor', 'end')
        .attr('class', 'd3-cat').text(d => d.category);
      g.append('line').attr('x1', m.l).attr('y1', 0).attr('y2', 0)
        .attr('stroke', (d, i) => color(i)).attr('stroke-width', 3).attr('stroke-linecap', 'round')
        .attr('x2', m.l).transition().duration(650).delay((d, i) => i * 45).attr('x2', d => x(d.pct));
      g.append('circle').attr('cx', m.l).attr('cy', 0).attr('r', 5).attr('fill', (d, i) => color(i))
        .transition().duration(700).delay((d, i) => i * 45).attr('cx', d => x(d.pct));
      g.append('text').attr('x', d => x(d.pct) + 10).attr('dy', '.32em')
        .attr('class', 'd3-val')
        .text(d => d.pct_of_env_total != null
          ? `${d.pct_of_env_total.toFixed(0)}% (${d.pct.toFixed(2)})`
          : d.pct.toFixed(2) + '%');
    };
    draw();
    let ro;
    if (window.ResizeObserver) { ro = new ResizeObserver(draw); ro.observe(el); }
    return () => { if (ro) ro.disconnect(); };
  }, [data]);
  return <div ref={ref} className="d3-poi" style={{ width: '100%' }}/>;
};

const PoiInsightCard = () => {
  const [data, setData] = useS(null);
  useE(() => {
    let alive = true;
    Api.poiImportance().then(r => { if (alive) setData((r && r.data) || []); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!data || data.length === 0) return null;
  const totalPct = data.reduce((s, d) => s + (d.pct || 0), 0);
  return (
    <Card>
      <div className="section-h">Qué tipo de entorno pesa más en el precio</div>
      <p className="tiny muted" style={{ marginTop: -4, marginBottom: 8 }}>
        De todo el peso que el modelo da al entorno, así se reparte entre categorías
        (el número grande es el peso relativo dentro del entorno; entre paréntesis, el
        % sobre el modelo completo de {WASI_STATS.VARIABLES} variables, que el entorno
        aporta ~{totalPct.toFixed(1)}% en total).
      </p>
      <PoiImportanceD3 data={data}/>
      <p className="tiny muted" style={{ marginTop: 8 }}>
        Fuentes: servicios cercanos de OpenStreetMap · denuncias del MININTER ·
        comisarías del CENACOM.
      </p>
    </Card>
  );
};

export const FairValueResult = ({ analysisId, ventaData, liveData, simForm, role, onBack, onContext, onError, onAuthExpired }) => {
  
  
  
  
  if (ventaData) {
    return <VentaResult data={ventaData} role={role} onBack={onBack} onContext={onContext}/>;
  }
  const isSeller = role === 'Propietario' || role === 'Agente inmobiliario';
  const narrativeMode = isSeller ? 'seller' : 'buyer';
  const [data, setData] = useS(null);
  const [loading, setLoading] = useS(true);
  const [err, setErr] = useS('');
  const [saved, setSaved] = useS(false);
  const [saving, setSaving] = useS(false);
  
  const [explain, setExplain] = useS(null);
  const [explainFailed, setExplainFailed] = useS(false);
  
  const [openGroup, setOpenGroup] = useS(null);
  
  const [narrative, setNarrative] = useS(null);
  const [narrativeLoading, setNarrativeLoading] = useS(false);
  
  const [detailOpen, setDetailOpen] = useS(false);
  const [detail, setDetail] = useS(null);
  const [detailLoading, setDetailLoading] = useS(false);
  const [detailErr, setDetailErr] = useS('');
  
  const curId = useR(analysisId);

  useE(() => {
    if (!analysisId) {
      setErr('No hay análisis seleccionado. Genera uno desde el formulario.');
      setLoading(false);
      return;
    }
    let cancel = false;
    curId.current = analysisId;
    setLoading(true);
    setExplain(null);
    setOpenGroup(null);
    setNarrative(null);
    setDetail(null);
    setDetailErr('');
    setDetailLoading(false);
    setDetailOpen(false);
    
    
    
    if (liveData && liveData.analysis_id === analysisId) {
      setData(liveData);
      setLoading(false);
    } else {
      Api.getAnalysis(analysisId)
        .then(r => { if (!cancel) { setData(r); setLoading(false); } })
        .catch(ex => {
          if (cancel) return;
          const msg = handleApiErr(ex, { setErr, onAuthExpired });
          if (typeof onError === 'function') onError(msg);
          setLoading(false);
        });
    }
    
    setExplainFailed(false);
    Api.explain(analysisId)
      .then(r => { if (!cancel) setExplain(r); })
      .catch(() => { if (!cancel) setExplainFailed(true); });
    
    setNarrativeLoading(true);
    Api.narrative(analysisId, narrativeMode)
      .then(r => { if (!cancel) { setNarrative(r); setNarrativeLoading(false); } })
      .catch(() => { if (!cancel) setNarrativeLoading(false); });
    return () => { cancel = true; };
  }, [analysisId]);

  
  
  
  const openDetail = (retry) => {
    setDetailOpen(true);
    if (!retry && (detail || detailLoading || detailErr)) return;
    setDetailLoading(true);
    setDetailErr('');
    const reqId = analysisId;
    Api.narrativeDetailed(analysisId, narrativeMode)
      .then(r => { if (curId.current === reqId) { setDetail(r); setDetailLoading(false); } })
      .catch(() => {
        if (curId.current !== reqId) return;
        setDetailErr('No se pudo generar el análisis detallado. Intenta de nuevo en un momento.');
        setDetailLoading(false);
      });
  };

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
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  
  
  const usd0 = (v) => '$' + Math.round(v).toLocaleString('en-US');
  const pctFmt = (v) => (Math.abs(v) >= 10 ? Math.round(Math.abs(v)) : Math.abs(v).toFixed(1)) + '%';

  
  
  
  
  
  const CONF_WIDEN = { Alta: 1.0, Media: 1.3, Baja: 1.8 };
  const wf = CONF_WIDEN[data.confidence] || 1.0;
  const effMaePct = (data.mae_pct || 0) * wf;
  const bandMin = wf > 1 ? Math.round(fair - fair * effMaePct / 100) : data.min;
  const bandMax = wf > 1 ? Math.round(fair + fair * effMaePct / 100) : data.max;
  const lowConf = data.confidence === 'Baja' || data.confidence === 'Media';

  
  
  
  const sellerPos = (anuncio == null) ? null
    : anuncio < bandMin ? 'Conservador'
    : anuncio > bandMax ? 'Agresivo'
    : 'Competitivo';
  const SELLER_POS_COPY = {
    Conservador: 'Por debajo del mercado: rentarás rápido, pero dejas margen sobre la mesa.',
    Competitivo: 'Alineado al mercado: buen equilibrio entre margen y rapidez de colocación.',
    Agresivo: 'Por encima del mercado: más margen por mes, pero puede tardar en colocarse.',
  };
  
  const POS_VARIANT = { Conservador: 'accent', Competitivo: 'success', Agresivo: 'warning' };
  const sellerPosTag = sellerPos ? POS_VARIANT[sellerPos] : 'accent';
  
  const barLo = Math.min(bandMin, anuncio || bandMin) * 0.95;
  const barHi = Math.max(bandMax, anuncio || bandMax) * 1.05;
  const barPct = (v) => Math.max(0, Math.min(100, (v - barLo) / (barHi - barLo) * 100));

  return (
    <div className="container fade-in">
      <PageHeader
        title={isSeller ? 'Precio sugerido para tu inmueble' : 'Precio de referencia'}
        subtitle={`Análisis #${analysisId} · ${data.distrito || ''}`}
        onBack={onBack}
        actions={
          <Btn variant="secondary" size="sm" onClick={saveReport} disabled={saving || saved}>
            <Icon name="bookmark" size={14}/> {saved ? '✓ Guardado' : saving ? 'Guardando…' : 'Guardar reporte'}
          </Btn>
        }
      />

      {warnings.length > 0 && (
        <div className="banner warn" style={{marginBottom:14}}>
          <Icon name="alert" size={14}/> <span>{warnings.join(' · ')}</span>
        </div>
      )}

      {

}
      {data.confidence === 'Baja' && (
        <div className="banner banner-coverage" style={{marginBottom:14}}>
          <Icon name="info" size={14}/>
          <div>
            <strong>Cobertura baja en esta zona.</strong> Tenemos pocos avisos cercanos para comparar, por eso el rango de precio puede ser más ancho de lo habitual. Tómalo como referencia, no como precio exacto.
          </div>
        </div>
      )}

      <div className="result-grid">
        {
}
        <div className="stack-20">
        <Card>
          <div className="row" style={{justifyContent:'space-between'}}>
            <div className="section-h" style={{margin:0}}>{isSeller ? 'Tu precio sugerido' : 'Precio de referencia de mercado'}</div>
            <Tag variant={confTag}>
              <Glossary term={`Confianza ${data.confidence}`} custom={GLOSSARY[`Confianza ${data.confidence}`] || 'Indica qué tan estable es la predicción según cuántos avisos comparables hay cerca del pin.'}>
                Confianza: {data.confidence}
              </Glossary>
            </Tag>
          </div>
          {lowConf && (
            <div className="tiny muted" style={{marginTop:4, textAlign:'right'}}>
              Estimación de {data.confidence === 'Baja' ? 'baja' : 'media'} confianza · {data.n_comparables} avisos comparables cerca. Tómalo como referencia, no como precio exacto.
            </div>
          )}

          {

}
          {!isSeller && (
            <>
              <div className={`verdict verdict-${isInflado?'inflado':isGanga?'ganga':'justo'}`} style={{marginTop:14}}>
                <span className="dot"/>
                <div className="grow">
                  <div className="lbl">Veredicto: {isInflado ? '↑ ' : isGanga ? '↓ ' : '= '}{zona}</div>
                  <div className="numeric val">
                    {diff >= 0 ? '+' : '−'}{usd0(Math.abs(diff))} <span className="pct">({diff >= 0 ? '+' : '−'}{pctFmt(pct)})</span>
                  </div>
                </div>
                <Tag variant={isInflado ? 'danger' : isGanga ? 'success' : 'warning'}>
                  {isInflado ? 'Negociable' : isGanga ? 'Oportunidad' : 'Precio alineado'}
                </Tag>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:14}}>
                <div>
                  <div className="small muted">Precio anunciado</div>
                  <div className="numeric" style={{fontSize:28, fontWeight:700}}>{usd0(anuncio)}</div>
                  <div className="tiny muted" style={{marginTop:2}}>USD / mes</div>
                </div>
                <div>
                  <div className="small muted">Precio de referencia</div>
                  <div className="numeric" style={{fontSize:28, fontWeight:700, color:'var(--primary)'}}>{usd0(fair)}</div>
                  <div className="tiny muted" style={{marginTop:2}}>USD / mes</div>
                </div>
              </div>
            </>
          )}

          <div style={{marginTop:18}}>
            <GaugeChart fairValue={fair} diffPct={pct} zone={zona} seller={isSeller} sellerPos={sellerPos} chip={isSeller}/>
          </div>

          {
}
          {data.prediction_interval && (
            <div style={{marginTop:14, padding:'12px 14px', background:'linear-gradient(90deg, rgba(59,130,246,.05), rgba(59,130,246,.10), rgba(59,130,246,.05))', borderRadius:12, border:'1px solid rgba(59,130,246,.18)'}}>
              <div className="tiny muted" style={{textTransform:'uppercase', letterSpacing:'.06em', fontWeight:600, marginBottom:2}}>Tu precio frente al rango de mercado</div>
              <MarketRangeD3
                p25={data.prediction_interval.p25}
                p50={data.prediction_interval.p50}
                p75={data.prediction_interval.p75}
                fair={typeof fair === 'number' ? fair : data.prediction_interval.p50}
                announced={data.announced_price}
                zone={zona}/>
              <div className="tiny muted" style={{textAlign:'center', marginTop:2}}>
                Banda azul = rango intercuartil del modelo (${Math.round(data.prediction_interval.p25).toLocaleString('en-US')}–${Math.round(data.prediction_interval.p75).toLocaleString('en-US')}); ahí cae la mayoría de inmuebles similares.
              </div>
            </div>
          )}

          <div style={{marginTop:14, padding:'10px 12px', background:'var(--bg-tint)', borderRadius:10, fontSize:12, color:'var(--ink-2)', lineHeight:1.55}}>
            <Icon name="info" size={13} stroke="var(--primary)"/> Basado en precios de <b>avisos</b> del
            mercado, no en precios de cierre reales. Error medio del modelo: ±{data.mae_pct}%.
            {data.predicted_in_seconds > 0 && <span className="muted"> · Predicción en {data.predicted_in_seconds}s</span>}
          </div>
        </Card>

          {
}
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
                {(() => {
                  
                  const maxAbs = Math.max(...data.counterfactuals.map(c => Math.abs(c.pct_change)), 0.1);
                  return data.counterfactuals.map((cf, i) => {
                    const positive = cf.pct_change > 0;
                    const arrow = positive ? '↑' : '↓';
                    const color = positive ? 'var(--success)' : 'var(--danger)';
                    const w = Math.max(6, Math.abs(cf.pct_change) / maxAbs * 100);
                    return (
                      <div key={i} style={{padding:'8px 12px', background:'var(--bg-tint)', borderRadius:10}}>
                        <div className="row" style={{justifyContent:'space-between'}}>
                          <span className="small">{cf.label}</span>
                          <span className="numeric" style={{fontWeight:600, color}}>
                            {usd0(cf.new_price)} <span className="tiny" style={{marginLeft:6, opacity:.8}}>{arrow} {pctFmt(cf.pct_change)}</span>
                          </span>
                        </div>
                        <div style={{height:3, borderRadius:2, background:'var(--line-2)', marginTop:6}}>
                          <div style={{height:'100%', width:`${w}%`, borderRadius:2, background:color, opacity:.55}}/>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </Card>
          )}

          {
}
          {simForm && <WhatIfSimulator baseForm={simForm} onAuthExpired={onAuthExpired}/>}
        </div>

        <div className="stack-20">
          {isSeller ? (
            
            <Card accent={sellerPos ? POS_VARIANT[sellerPos] : 'success'}>
              <div className="row" style={{justifyContent:'space-between'}}>
                <div className="section-h" style={{margin:0}}>Tu posicionamiento</div>
                {sellerPos && <Tag variant={sellerPosTag}>{sellerPos}</Tag>}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:14}}>
                <div>
                  <div className="small muted">Tu precio en mente</div>
                  <div className="numeric" style={{fontSize:28, fontWeight:700}}>{usd0(anuncio)}</div>
                  <div className="tiny muted" style={{marginTop:2}}>USD / mes</div>
                </div>
                <div>
                  <div className="small muted">Precio sugerido</div>
                  <div className="numeric" style={{fontSize:28, fontWeight:700, color:'var(--primary)'}}>{usd0(fair)}</div>
                  <div className="tiny muted" style={{marginTop:2}}>USD / mes</div>
                </div>
              </div>
              {}
              <div style={{marginTop:18}}>
                <div style={{position:'relative', height:8, background:'var(--bg-tint)', borderRadius:4}}>
                  <div style={{position:'absolute', left:`${barPct(bandMin)}%`, width:`${barPct(bandMax)-barPct(bandMin)}%`, top:0, bottom:0, background:'var(--success-soft)', borderRadius:4}}/>
                  <div style={{position:'absolute', left:`${barPct(fair)}%`, top:-3, width:2, height:14, background:'var(--primary)', transform:'translateX(-50%)'}} title="Precio sugerido"/>
                  <div style={{position:'absolute', left:`${barPct(anuncio)}%`, top:-5, width:3, height:18, background:'var(--ink)', borderRadius:2, transform:'translateX(-50%)'}} title="Tu precio"/>
                </div>
                <div className="tiny muted" style={{marginTop:6}}>
                  Rango sugerido {usd0(bandMin)}–{usd0(bandMax)}/mes · la barra negra es tu precio, la azul el sugerido
                </div>
              </div>
              {sellerPos && (
                <div className="tiny" style={{marginTop:10, color:'var(--ink-2)', lineHeight:1.55}}>
                  {SELLER_POS_COPY[sellerPos]}
                </div>
              )}
            </Card>
          ) : null}

          <PoiInsightCard/>

          <ComparablesCard data={data}/>

          <Card>
            <div className="row" style={{justifyContent:'space-between'}}>
              <div className="section-h" style={{margin:0}}>{isSeller ? 'Qué hace valioso tu inmueble' : 'Qué explica este precio'}</div>
              <Tag variant="accent">SHAP · Modelo Wasi v2</Tag>
            </div>

            {}
            {(narrativeLoading || narrative) && (
              <div style={{
                margin:'14px 0 0', padding:'14px 16px',
                background:'var(--surface-2,#f4f5f7)', borderRadius:10,
                borderLeft:'3px solid var(--primary)'
              }}>
                {narrativeLoading && !narrative && (
                  <span className="small muted">Generando explicación con IA…</span>
                )}
                {narrative && (
                  <>
                    <p style={{margin:0, fontSize:13, lineHeight:1.6, color:'var(--ink)'}}>
                      {String(narrative.narrative).replace(/\*\*/g, '')}
                    </p>
                    <button
                      type="button"
                      onClick={() => openDetail()}
                      style={{
                        marginTop:10, padding:0, background:'none', border:'none',
                        color:'var(--primary)', fontSize:13, fontWeight:600,
                        cursor:'pointer', display:'inline-flex', alignItems:'center', gap:5,
                      }}
                    >
                      Ver análisis completo
                      <Icon name="arrow" size={13} stroke="var(--primary)"/>
                    </button>
                  </>
                )}
              </div>
            )}

            {!explain && (
              <div className="small muted" style={{marginTop:12}}>
                {explainFailed ? 'Explicación no disponible para este análisis.' : 'Calculando explicación del modelo…'}
              </div>
            )}

            {explain && (() => {
              const grupos = (explain.groups || []).filter(g => Math.abs(g.pct_effect) >= 0.1)
                .sort((a, b) => Math.abs(b.contribution_log) - Math.abs(a.contribution_log));
              const maxAbs = grupos.reduce((m, g) => Math.max(m, Math.abs(g.contribution_log)), 0.0001);
              return (
                <>
                  {}
                  <div className="row" style={{justifyContent:'space-between', marginTop:12, paddingBottom:10, borderBottom:'1px dashed var(--line)'}}>
                    <span className="small muted">Precio base del modelo</span>
                    <b className="numeric">${Math.round(explain.base_price)}</b>
                  </div>

                  {}
                  <div className="row" style={{justifyContent:'space-between', marginTop:12, fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', fontWeight:700}}>
                    <span style={{color:'var(--danger)'}}>← Baja el precio</span>
                    <span style={{color:'var(--success)'}}>Sube el precio →</span>
                  </div>

                  {}
                  <div style={{marginTop:12, display:'flex', flexDirection:'column', gap:12}}>
                    {grupos.map((g, i) => {
                      const w = Math.max(4, Math.round(Math.abs(g.contribution_log) / maxAbs * 100));
                      const col = g.positive ? 'var(--success)' : 'var(--danger)';
                      const drivers = g.drivers || [];
                      const hasDrivers = drivers.length > 0;
                      const isOpen = openGroup === i;
                      return (
                        <div key={i} title={g.description}>
                          <div
                            className="row"
                            onClick={hasDrivers ? () => setOpenGroup(isOpen ? null : i) : undefined}
                            style={{
                              justifyContent:'space-between', marginBottom:5, gap:8,
                              cursor: hasDrivers ? 'pointer' : 'default',
                              userSelect:'none',
                            }}
                          >
                            <span className="small row" style={{fontWeight:600, gap:5, minWidth:0}}>
                              {hasDrivers && (
                                <span style={{
                                  display:'inline-block', transition:'transform .2s',
                                  transform:isOpen ? 'rotate(90deg)' : 'none',
                                  color:'var(--ink-3)', fontSize:10,
                                }}>▶</span>
                              )}
                              <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{g.label}</span>
                            </span>
                            <b className="numeric" style={{color:col, fontSize:13, flexShrink:0}}>
                              {g.positive ? '+' : '−'}{Math.abs(g.pct_effect).toFixed(1)}%
                            </b>
                          </div>
                          {}
                          <div style={{display:'flex', alignItems:'center', height:8}}>
                            <div style={{flex:1, display:'flex', justifyContent:'flex-end'}}>
                              {!g.positive && <div style={{height:8, width:`${w}%`, background:col, borderRadius:'4px 0 0 4px', opacity:.85, transition:'width .3s'}}/>}
                            </div>
                            <div style={{width:1, height:12, background:'var(--ink-3)', opacity:.4}}/>
                            <div style={{flex:1}}>
                              {g.positive && <div style={{height:8, width:`${w}%`, background:col, borderRadius:'0 4px 4px 0', opacity:.85, transition:'width .3s'}}/>}
                            </div>
                          </div>
                          {}
                          {isOpen && hasDrivers && (
                            <div style={{
                              marginTop:8, marginLeft:15, paddingLeft:11,
                              borderLeft:'2px solid var(--line)',
                              display:'flex', flexDirection:'column', gap:6,
                            }}>
                              {drivers.map((d, j) => {
                                const dcol = d.positive ? 'var(--success)' : 'var(--danger)';
                                return (
                                  <div key={j} className="row" style={{justifyContent:'space-between', gap:8}}>
                                    <span className="tiny" style={{color:'var(--ink-2)', minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                                      {d.label} <span style={{color:'var(--ink-3)'}}>· {d.value}</span>
                                    </span>
                                    <b className="numeric tiny" style={{color:dcol, flexShrink:0}}>
                                      {d.positive ? '+' : '−'}{Math.abs(d.pct_effect).toFixed(1)}%
                                    </b>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {}
                  <div className="row" style={{justifyContent:'space-between', marginTop:14, paddingTop:10, borderTop:'1px solid var(--line)'}}>
                    <span className="small" style={{fontWeight:700}}>Precio estimado</span>
                    <b className="numeric" style={{fontSize:16, color:'var(--primary)'}}>${Math.round(explain.predicted_price)}</b>
                  </div>

                  <p style={{margin:'12px 0 0', fontSize:12, color:'var(--ink-3)', lineHeight:1.55}}>
                    Cada barra es la contribución real del modelo (TreeSHAP) a <i>esta</i> predicción.
                    Toca un grupo para ver los factores concretos que lo explican. Los efectos son
                    <b> multiplicativos</b> sobre el precio base, no se suman entre sí.
                  </p>
                </>
              );
            })()}
          </Card>
        </div>
      </div>

      <div className="row" style={{marginTop:24, justifyContent:'flex-end'}}>
        <Btn variant="primary" size="lg" onClick={onContext}>
          <Icon name="shield" size={16}/> Ver contexto del barrio
        </Btn>
      </div>

      {}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        icon={<Icon name="chart" size={20}/>}
        iconVariant="accent"
        title={isSeller ? 'Cómo posicionar tu precio' : 'Análisis completo del precio'}
        subtitle={detail
          ? `${detail.distrito} · Modelo Wasi v2 · ±${detail.mae_pct}% error`
          : 'Generado con IA sobre la descomposición del modelo'}
        tag={<Tag variant="accent">IA + SHAP</Tag>}
        maxWidth={680}
        footer={<Btn variant="outline" onClick={() => setDetailOpen(false)}>Cerrar</Btn>}
      >
        {detailLoading && <Loading label="Generando análisis con IA…"/>}
        {detailErr && !detailLoading && (
          <div style={{padding:'8px 0'}}>
            <div className="small muted">{detailErr}</div>
            <Btn variant="outline" size="sm" style={{marginTop:8}} onClick={() => openDetail(true)}>
              Reintentar
            </Btn>
          </div>
        )}
        {detail && (
          <div>
            {}
            <div style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:18}}>
              {[
                [isSeller ? 'Sugerido' : 'Referencia', `$${Math.round(detail.fair_value)}/mes`, null],
                detail.announced_price != null
                  ? (isSeller
                      ? ['Tu precio', `$${Math.round(detail.announced_price)}/mes`,
                          detail.announced_price < detail.price_min ? 'Conservador'
                          : detail.announced_price > detail.price_max ? 'Agresivo' : 'Competitivo']
                      : ['Aviso', `$${Math.round(detail.announced_price)}/mes`, detail.zone])
                  : null,
                ['Confianza', detail.confidence || '—', `${detail.n_comparables} comparables`],
                ['Margen del modelo', `$${Math.round(detail.price_min)}–$${Math.round(detail.price_max)}`, `±${detail.mae_pct}% error`],
              ].filter(Boolean).map(([k, v, s], i) => (
                <div key={i} style={{flex:'1 1 130px', padding:'10px 12px', background:'var(--bg-tint)', borderRadius:10}}>
                  <div className="tiny muted" style={{textTransform:'uppercase', letterSpacing:.3}}>{k}</div>
                  <div className="numeric" style={{fontSize:15, fontWeight:700, color:'var(--ink)', marginTop:2}}>{v}</div>
                  {s && <div className="tiny muted" style={{marginTop:1}}>{s}</div>}
                </div>
              ))}
            </div>

            {}
            <div>{renderNarrative(detail.narrative)}</div>

            {}
            {Array.isArray(detail.poi_highlights) && detail.poi_highlights.length > 0 && (
              <div style={{marginTop:18}}>
                <div style={{fontSize:11.5, fontWeight:700, color:'var(--primary)', textTransform:'uppercase', letterSpacing:.4, marginBottom:8}}>
                  Entorno inmediato
                </div>
                <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
                  {detail.poi_highlights.map((h, i) => (
                    <div key={i} style={{display:'inline-flex', alignItems:'center', gap:6, padding:'6px 10px', background:'var(--bg-tint)', borderRadius:8, fontSize:12}}>
                      <span style={{fontWeight:600, color:'var(--ink)'}}>{h.name}</span>
                      <span className="muted">· {h.kind} · {h.dist_m} m</span>
                      {h.tier && <Tag variant={h.tier === 'gama alta' ? 'accent' : h.tier === 'gama masiva' ? 'warning' : 'outline'}>{h.tier}</Tag>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{margin:'18px 0 0', fontSize:11, color:'var(--ink-3)', lineHeight:1.55}}>
              Resumen generado automáticamente a partir del análisis del modelo, el veredicto
              y los servicios reales del entorno. Los porcentajes indican cuánto pesa cada factor en el precio.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

const POI_COLORS = {
  supermercados: '#2563eb',
  conveniencia:  '#f59e0b',
  farmacias:     '#10b981',
  colegios:      '#8b5cf6',
  hospitales:    '#ef4444',
  bancos:        '#0891b2',
  universidades: '#db2777',
  parqueos:      '#64748b',
};

export const EntornoMapScreen = ({ lat, lng, onBack, onError, onAuthExpired, embedded = false }) => {
  const start = (typeof lat === 'number' && typeof lng === 'number')
    ? { lat, lng } : { lat: -12.121, lng: -77.030 };
  const [pin, setPin] = useS(start);
  const [data, setData] = useS(null);
  const [loading, setLoading] = useS(true);
  const [err, setErr] = useS('');
  const [panelOpen, setPanelOpen] = useS(true);
  
  const [showPois, setShowPois] = useS(true);
  const [hiddenCats, setHiddenCats] = useS(() => new Set());
  const [poiLayers, setPoiLayers] = useS([]);
  
  const [searchQ, setSearchQ] = useS('');
  const [searchLoading, setSearchLoading] = useS(false);
  const [flyTo, setFlyTo] = useS(null);
  const [suggestions, setSuggestions] = useS([]);
  const [sugOpen, setSugOpen] = useS(false);

  
  const PHOTON_URL = (q, limit) =>
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit}&bbox=-77.2,-12.3,-76.7,-11.8`;

  const resolveAlias = (q) =>
    LIMA_ALIASES[q.toLowerCase().trim()] || q;

  const parsePhoton = (data) =>
    (data.features || []).map(f => {
      const p = f.properties;
      const name = p.name || p.street || '';
      const cityPart  = p.city  && p.city  !== name ? p.city  : null;
      const statePart = p.state && p.state !== name ? p.state : null;
      const context = [...new Set([cityPart, statePart].filter(Boolean))].join(', ');
      return { name, context, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
    }).filter(s => s.name);

  const handleSearch = (e) => {
    e.preventDefault();
    setSugOpen(false);
    if (suggestions.length > 0) {
      const s = suggestions[0];
      setSearchQ(s.name + (s.context ? ', ' + s.context : ''));
      setFlyTo({ lat: s.lat, lng: s.lng });
      setSuggestions([]);
      return;
    }
    const q = searchQ.trim();
    if (!q) return;
    setSearchLoading(true);
    fetch(PHOTON_URL(resolveAlias(q), 1))
      .then(r => r.json())
      .then(data => {
        const sug = parsePhoton(data);
        if (sug.length > 0) setFlyTo({ lat: sug[0].lat, lng: sug[0].lng });
      })
      .catch(() => {})
      .finally(() => setSearchLoading(false));
  };

  
  useE(() => {
    const q = searchQ.trim();
    if (q.length < 3) { setSuggestions([]); setSugOpen(false); return; }
    const tid = setTimeout(() => {
      fetch(PHOTON_URL(resolveAlias(q), 5))
        .then(r => r.json())
        .then(data => {
          const sug = parsePhoton(data);
          setSuggestions(sug);
          setSugOpen(sug.length > 0);
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(tid);
  }, [searchQ]);

  const handleSelectSuggestion = (s) => {
    setSearchQ(s.name + (s.context ? ', ' + s.context : ''));
    setFlyTo({ lat: s.lat, lng: s.lng });
    setSuggestions([]);
    setSugOpen(false);
  };

  
  useE(() => {
    let cancel = false;
    const t = setTimeout(() => {
      setLoading(true);
      Api.entorno({ lat: pin.lat, lng: pin.lng })
        .then(r => { if (!cancel) { setData(r); setErr(''); setLoading(false); } })
        .catch(ex => {
          if (cancel) return;
          
          setData(null);
          const msg = handleApiErr(ex, { setErr, onAuthExpired });
          if (typeof onError === 'function') onError(msg);
          setLoading(false);
        });
    }, 250);
    return () => { cancel = true; clearTimeout(t); };
  }, [pin.lat, pin.lng]);

  
  useE(() => {
    if (!showPois) { setPoiLayers([]); return; }
    let cancel = false;
    const t = setTimeout(() => {
      Api.entornoPois({ lat: pin.lat, lng: pin.lng })
        .then(r => { if (!cancel) setPoiLayers(r.layers || []); })
        .catch(() => {});
    }, 300);
    return () => { cancel = true; clearTimeout(t); };
  }, [showPois, pin.lat, pin.lng]);

  const score = data ? data.score : 0;
  const levelVar = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger';

  
  const mapPois = !showPois ? [] : poiLayers.flatMap(l =>
    hiddenCats.has(l.kind) ? []
      : l.points.map(([la, lo]) => ({ lat: la, lng: lo, color: POI_COLORS[l.kind] || '#64748b' }))
  );
  const toggleCat = (kind) => setHiddenCats(s => {
    const n = new Set(s);
    n.has(kind) ? n.delete(kind) : n.add(kind);
    return n;
  });

  return (
    <div className={`entorno-fullmap ${embedded ? 'embedded' : ''} fade-in`}>
      {

}
      <MapPicker lat={start.lat} lng={start.lng} className="map-full" pois={mapPois}
        onMove={(la, lo)=>setPin({ lat: la, lng: lo })} flyTo={flyTo} showRadius/>

      {

}
      <div className="efm-topbar">
        {!embedded && (
          <button className="efm-glass efm-back" onClick={onBack} aria-label="Volver">
            <Icon name="back" size={16}/> Volver
          </button>
        )}
        <div className="efm-glass efm-title">
          <div className="t">Contexto del barrio</div>
          <div className="s">Arrastra el pin — los datos se recalculan en vivo</div>
        </div>
        <div className="efm-search-wrap">
          <form onSubmit={handleSearch} className="efm-glass efm-search" role="search">
            <Icon name="pin" size={14} stroke="var(--ink-3)"/>
            <input
              type="text"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onFocus={() => suggestions.length > 0 && setSugOpen(true)}
              onBlur={() => setTimeout(() => setSugOpen(false), 150)}
              placeholder="Buscar dirección en Lima…"
              aria-label="Buscar dirección"
              style={{flex:1, background:'none', border:'none', outline:'none',
                      fontSize:13, color:'var(--ink)', fontFamily:'inherit'}}
            />
            <button type="submit" disabled={searchLoading} aria-label="Buscar"
              style={{background:'none', border:'none', cursor:'pointer', padding:'0 2px',
                      color:'var(--primary)', display:'flex', alignItems:'center',
                      opacity: searchLoading ? 0.5 : 1}}>
              {searchLoading
                ? <div style={{width:14, height:14, border:'2px solid var(--primary)',
                               borderTopColor:'transparent', borderRadius:'50%',
                               animation:'spin .6s linear infinite'}}/>
                : <Icon name="arrow" size={14}/>}
            </button>
          </form>
          {sugOpen && suggestions.length > 0 && (
            <div className="efm-suggestions">
              {suggestions.map((s, i) => (
                <button key={i} className="efm-sug-item"
                  onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelectSuggestion(s)}>
                  <Icon name="pin" size={14} stroke="var(--ink-3)"/>
                  <div style={{minWidth:0}}>
                    <span className="efm-sug-name">{s.name}</span>
                    {s.context && <span className="efm-sug-ctx">{s.context}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {}
      <div className="efm-glass efm-coords">
        <span className="small muted numeric">{pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</span>
        {data && <Tag variant="outline">{data.distrito}</Tag>}
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}&travelmode=transit`}
           target="_blank" rel="noopener noreferrer" title="Google Maps — transporte público"
           style={{display:'inline-flex', alignItems:'center', padding:'3px 8px', borderRadius:6,
                   background:'rgba(255,255,255,.18)', color:'var(--ink-2)', textDecoration:'none',
                   fontSize:11, fontWeight:600, gap:4, border:'1px solid rgba(255,255,255,.3)'}}>
          <Icon name="bus" size={12}/> Maps
        </a>
        <a href={`https://waze.com/ul?ll=${pin.lat},${pin.lng}&navigate=yes`}
           target="_blank" rel="noopener noreferrer" title="Waze — en auto"
           style={{display:'inline-flex', alignItems:'center', padding:'3px 8px', borderRadius:6,
                   background:'rgba(255,255,255,.18)', color:'var(--ink-2)', textDecoration:'none',
                   fontSize:11, fontWeight:600, gap:4, border:'1px solid rgba(255,255,255,.3)'}}>
          <Icon name="nav" size={12}/> Waze
        </a>
      </div>

      {err && (
        <div className="banner danger" style={{position:'absolute', top:72, left:'50%', transform:'translateX(-50%)', zIndex:11, marginBottom:0, maxWidth:420}}>
          <Icon name="alert" size={14}/>
          <span>{err}</span>
        </div>
      )}

      {}
      {!panelOpen ? (
        <button className="efm-glass efm-reopen" onClick={()=>setPanelOpen(true)} aria-label="Mostrar métricas">
          {data && <ScoreCircle value={score} size={36} stroke={5}/>}
          <div className="grow">
            <div className="rt">{data ? `Score ${score}` : 'Métricas'}</div>
            <div className="rs">Ver entorno del barrio</div>
          </div>
          <Icon name="layers" size={16}/>
        </button>
      ) : (
      <div className="efm-panel">
        <div className="efm-glass efm-panel-bar">
          <span className="lbl">Métricas del entorno</span>
          <button className="efm-iconbtn" onClick={()=>setPanelOpen(false)} aria-label="Ocultar panel" title="Ocultar panel">
            <Icon name="close" size={16}/>
          </button>
        </div>
        <div className="efm-panel-scroll">
          <Card>
            <div className="row" style={{justifyContent:'space-between'}}>
              <div className="section-h" style={{margin:0}}>POIs en el mapa</div>
              <Switch checked={showPois} onChange={setShowPois} label="Mostrar POIs en el mapa"/>
            </div>
            {showPois && (
              <div className="poi-legend">
                {poiLayers.map(l => {
                  const on = !hiddenCats.has(l.kind);
                  const col = POI_COLORS[l.kind] || '#64748b';
                  return (
                    <button key={l.kind} className="poi-chip" data-on={on}
                      onClick={()=>toggleCat(l.kind)} aria-pressed={on}>
                      <span className="poi-chip-dot" style={{background: on ? col : 'transparent', borderColor: col}}/>
                      {l.label} <span className="poi-chip-n">{l.points.length}</span>
                    </button>
                  );
                })}
                {poiLayers.length === 0 && <div className="tiny muted" style={{marginTop:8}}>Cargando puntos…</div>}
              </div>
            )}
          </Card>

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

                {

}
                <div className="section-h" style={{margin:'16px 0 8px', fontSize:13}}>Seguridad del entorno</div>
                <div className="stack-8">
                  {data.cantidad_denuncias != null && (
                    <div className="row" style={{justifyContent:'space-between', fontSize:13}}>
                      <span className="muted">Denuncias cerca del punto</span>
                      <strong>{data.cantidad_denuncias.toLocaleString('es-PE')}</strong>
                    </div>
                  )}
                  {data.denuncias_vs_lima_pct ? (
                    <div className="row" style={{justifyContent:'space-between', fontSize:13}}>
                      <span className="muted">Vs. promedio de Lima</span>
                      <strong style={{color: data.denuncias_vs_lima_pct > 1.15 ? 'var(--warning)' : data.denuncias_vs_lima_pct < 0.85 ? 'var(--success)' : 'var(--ink)'}}>
                        {data.denuncias_vs_lima_pct > 1.15
                          ? `${Math.round((data.denuncias_vs_lima_pct - 1) * 100)}% más denuncias`
                          : data.denuncias_vs_lima_pct < 0.85
                            ? `${Math.round((1 - data.denuncias_vs_lima_pct) * 100)}% menos denuncias`
                            : 'En el promedio'}
                      </strong>
                    </div>
                  ) : null}
                  {data.n_comisarias_distrito ? (
                    <div className="row" style={{justifyContent:'space-between', fontSize:13}}>
                      <span className="muted">Comisarías en el distrito</span>
                      <strong>{data.n_comisarias_distrito}</strong>
                    </div>
                  ) : null}
                  {data.serenazgo && data.serenazgo.label ? (
                    <div className="row" style={{justifyContent:'space-between', fontSize:13}}>
                      <span className="muted">Serenazgo</span>
                      <strong>{data.serenazgo.label}</strong>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </Card>

          <p className="tiny muted" style={{margin:'2px 4px 0', lineHeight:1.5}}>
            Fuentes: servicios cercanos de OpenStreetMap · denuncias del MININTER ·
            comisarías del CENACOM. Distancias calculadas dentro de 1 km del punto.
          </p>

        </div>
      </div>
      )}
    </div>
  );
};

import { useEffect as useE, useRef as useR, useState as useS } from 'react';
import * as d3 from 'd3';
import { Api } from '../../shared/api/client.js';
import { AMENIDADES } from '../../shared/lib/amenities.js';
import { ZONE_VARIANT, enLima, handleApiErr, onKeyActivate } from '../../shared/lib/helpers.js';
import { AddressSearch, MapPicker } from '../../shared/map/map-components.jsx';
import { ListingCard } from '../../shared/listings/ListingCard.jsx';
import {
  Btn,
  Card,
  Icon,
  Input,
  Loading,
  Modal,
  PageHeader,
  Select,
  Stepper,
  Tag,
  ToggleRow,
} from '../../shared/ui/components.jsx';

const PUBLISH_DRAFT_KEY = 'wasi.publishDraft';
const MAX_PHOTO_BYTES = 12 * 1024 * 1024; // 12 MB de archivo original
const OP_CFG = {
  alquiler: { label: 'Alquiler', unit: '/mes', min: 50, max: 50000, phPrice: '900' },
  venta:    { label: 'Venta',    unit: 'total', min: 20000, max: 5000000, phPrice: '180000' },
};

const CounterfactualTornadoD3 = ({ items }) => {
  const ref = useR(null);
  useE(() => {
    const el = ref.current;
    if (!el || !Array.isArray(items) || !items.length) return;
    const draw = () => {
      d3.select(el).selectAll('*').remove();
      const rows = items.slice(0, 8);
      const W = el.clientWidth || 480, rowH = 34, m = { l: 148, r: 64, t: 6, b: 6 };
      const H = rows.length * rowH + m.t + m.b;
      const maxAbs = Math.max(1, d3.max(rows, d => Math.abs(d.delta_pct)));
      const halfW = (W - m.l - m.r) / 2;
      const cx = m.l + halfW;
      const x = d3.scaleLinear().domain([0, maxAbs]).range([0, halfW]);
      const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
      svg.append('line').attr('x1', cx).attr('x2', cx).attr('y1', m.t).attr('y2', H - m.b)
        .attr('stroke', 'var(--line)').attr('stroke-width', 1);
      const g = svg.selectAll('g').data(rows).enter().append('g')
        .attr('transform', (d, i) => `translate(0,${m.t + i * rowH + rowH / 2})`);
      g.append('text').attr('x', m.l - 12).attr('dy', '.32em').attr('text-anchor', 'end')
        .attr('class', 'd3-cat').text(d => d.label);
      g.append('rect').attr('y', -9).attr('height', 18).attr('rx', 5)
        .attr('x', d => d.direction === 'baja' ? cx - x(Math.abs(d.delta_pct)) : cx)
        .attr('fill', d => d.direction === 'sube' ? '#16a34a' : d.direction === 'baja' ? '#dc2626' : '#94a3b8')
        .attr('width', 0).transition().duration(600).delay((d, i) => i * 45)
        .attr('width', d => Math.max(2, x(Math.abs(d.delta_pct))));
      g.append('text').attr('dy', '.32em').attr('class', 'd3-val')
        .attr('x', d => d.direction === 'baja' ? cx - x(Math.abs(d.delta_pct)) - 8 : cx + x(Math.abs(d.delta_pct)) + 8)
        .attr('text-anchor', d => d.direction === 'baja' ? 'end' : 'start')
        .attr('fill', d => d.direction === 'sube' ? '#15803d' : d.direction === 'baja' ? '#b91c1c' : '#64748b')
        .text(d => (d.direction === 'sube' ? '+' : d.direction === 'baja' ? '−' : '') + '$' + Math.abs(Math.round(d.delta)).toLocaleString('en-US'));
    };
    draw();
    let ro;
    if (window.ResizeObserver) { ro = new ResizeObserver(draw); ro.observe(el); }
    return () => { if (ro) ro.disconnect(); };
  }, [items]);
  return <div ref={ref} className="d3-cf" style={{ width: '100%' }}/>;
};

const CounterfactualPanel = ({ cf, loading, error, isSeller }) => {
  if (loading) {
    return (
      <Card>
        <div className="section-h">{isSeller ? 'Cómo subir tu precio sugerido' : 'Qué explica este precio'}</div>
        <p className="tiny muted" style={{ marginTop: 8 }}>Calculando palancas con el modelo…</p>
      </Card>
    );
  }
  if (error || !cf || !cf.items || cf.items.length === 0) {
    if (error) {
      return (
        <Card>
          <div className="section-h">{isSeller ? 'Cómo subir tu precio sugerido' : 'Qué explica este precio'}</div>
          <p className="tiny muted" style={{ marginTop: 8 }}>No se pudieron calcular las palancas de precio.</p>
        </Card>
      );
    }
    return null;
  }

  const items = isSeller
    ? cf.items.filter(i => i.kind !== 'informativo' && i.direction === 'sube')
    : cf.items;
  if (items.length === 0) return null;
  const title = isSeller ? 'Cómo subir tu precio sugerido' : 'Qué explica este precio';
  const sub = isSeller
    ? 'Cambios accionables ordenados por impacto en la referencia del modelo.'
    : 'Cuánto aporta o resta cada característica, según el modelo.';
  return (
    <Card>
      <div className="section-h">{title}</div>
      <p className="tiny muted" style={{ marginTop: -4, marginBottom: 8 }}>{sub}</p>
      <CounterfactualTornadoD3 items={items}/>
      <p className="tiny muted" style={{ marginTop: 10 }}>
        Estimaciones del modelo Wasi: reflejan <strong>correlaciones del mercado limeño</strong>, no
        causalidad. Algún efecto puede ser contraintuitivo (p. ej. baños en zonas donde
        los avisos con más baños son más antiguos); es una limitación conocida del enfoque.
      </p>
    </Card>
  );
};

export const PublishScreen = ({ role, prefill, onBack, onPublished, onError, onAuthExpired }) => {
  const isSeller = role === 'Propietario' || role === 'Agente inmobiliario';
  const [submitting, setSubmitting] = useS(false);
  const [calculating, setCalculating] = useS(false);
  const [photoErr, setPhotoErr] = useS('');
  const [photoLoading, setPhotoLoading] = useS(false);
  const [priceUserTyped, setPriceUserTyped] = useS(!!(prefill && prefill.price_usd != null));
  const [flyTo, setFlyTo] = useS(null);
  const [fairRef, setFairRef] = useS(prefill && prefill.fair_value ? prefill.fair_value : null);
  const [err, setErr] = useS('');
  const [distritos, setDistritos] = useS([]);
  const [touched, setTouched] = useS({});
  const [cf, setCf] = useS(null);
  const [cfLoading, setCfLoading] = useS(false);
  const [cfError, setCfError] = useS(false);
  const [previewOpen, setPreviewOpen] = useS(false);

  // El pin arranca "sin ubicar": no fabricamos una dirección desde un pin
  // por defecto. El usuario debe colocar el inmueble (mapa o buscador).
  const [pinSet, setPinSet] = useS(!!(prefill && prefill.lat));
  // Campos que el usuario editó a mano → el autocompletado ya no los pisa.
  const manual = useR({ district: false, address: false });
  const geoAbort = useR(null);

  const [operacion, setOperacion] = useS(() => {
    // Restaurar la operación del borrador (antes se guardaba pero al recargar
    // un draft de venta volvía a alquiler → rango/modelo/unidad equivocados).
    if (!prefill) {
      try {
        const d = JSON.parse(localStorage.getItem(PUBLISH_DRAFT_KEY) || 'null');
        if (d && (d.operacion === 'venta' || d.operacion === 'alquiler')) return d.operacion;
      } catch (_) {}
    }
    return 'alquiler';
  });
  const cfg = OP_CFG[operacion];

  const [f, setF] = useS(() => {
    // Restaurar borrador si no venimos con prefill (evita perder el form ante
    // un back accidental o una sesión expirada).
    if (!prefill) {
      try {
        const raw = localStorage.getItem(PUBLISH_DRAFT_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d && d.f) return d.f;
        }
      } catch (_) {}
    }
    return {
      district: (prefill && prefill.district) || '',
      address: '',
      lat: (prefill && prefill.lat) || -12.09,
      lng: (prefill && prefill.lng) || -77.03,
      area: (prefill && prefill.area != null) ? String(prefill.area) : '80',
      dormitorios: (prefill && prefill.dormitorios) || 2,
      banos: (prefill && prefill.banos) || 2,
      cocheras: (prefill && prefill.cocheras) || 1,
      antiguedad_anios: (prefill && prefill.antiguedad_anios) || 5,
      es_estudio: (prefill && prefill.es_estudio) || false,
      amenities: (prefill && Array.isArray(prefill.amenities)) ? prefill.amenities : [],
      price_usd: (prefill && prefill.price_usd != null) ? String(prefill.price_usd) : '',
      description: '',
      image_url: '',
      contact_name: '', contact_phone: '', contact_email: '',
    };
  });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const blur = (k) => setTouched(prev => ({ ...prev, [k]: true }));
  const toggleAmenity = (k) => setF(prev => ({
    ...prev,
    amenities: prev.amenities.includes(k)
      ? prev.amenities.filter(x => x !== k)
      : [...prev.amenities, k],
  }));

  // Persistir borrador (operación + campos) mientras se edita.
  useE(() => {
    try { localStorage.setItem(PUBLISH_DRAFT_KEY, JSON.stringify({ f, operacion })); } catch (_) {}
  }, [f, operacion]);

  const onPickFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    setPhotoErr('');
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setPhotoErr('Ese archivo no es una imagen. Sube un JPG o PNG.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoErr('La imagen pesa demasiado (máximo 12 MB). Prueba con otra.');
      return;
    }
    setPhotoLoading(true);
    const reader = new FileReader();
    reader.onerror = () => { setPhotoLoading(false); setPhotoErr('No se pudo leer el archivo.'); };
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => {
        setPhotoLoading(false);
        setPhotoErr('No pudimos procesar esa foto. Si es de iPhone (HEIC), conviértela a JPG primero.');
      };
      img.onload = () => {
        const maxW = 1024;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        // Fondo blanco: evita que los PNG con transparencia queden con fondo negro al pasar a JPEG.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        set('image_url', canvas.toDataURL('image/jpeg', 0.78));
        setPhotoLoading(false);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  useE(() => {
    Api.distritosZona().then(r => setDistritos(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  // Autocompletado por pin: SOLO cuando el usuario ya ubicó el inmueble, y sin
  // pisar lo que escribió a mano. Cancela requests viejos (evita desorden).
  useE(() => {
    if (!pinSet || !enLima(f.lat, f.lng)) return;
    const t = setTimeout(() => {
      if (geoAbort.current) geoAbort.current.abort();
      const ctrl = new AbortController();
      geoAbort.current = ctrl;
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${f.lat}&lon=${f.lng}&format=jsonv2&accept-language=es&zoom=18`;
      fetch(url, { signal: ctrl.signal }).then(r => r.json()).then(data => {
        const a = data.address || {};
        const rawDist = a.suburb || a.city_district || a.neighbourhood || a.city || a.town || '';
        const street = a.road || a.pedestrian || '';
        const num = a.house_number ? ` ${a.house_number}` : '';
        setF(prev => {
          const next = { ...prev };
          if (rawDist && !manual.current.district) {
            const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
            const match = distritos.find(d => d.distrito && norm(d.distrito) === norm(rawDist));
            next.district = match ? match.distrito : rawDist;
          }
          if (street && !manual.current.address) next.address = `${street}${num}`;
          return next;
        });
      }).catch(() => {});
    }, 650);
    return () => clearTimeout(t);
  }, [f.lat, f.lng, distritos, pinSet]);

  const onPinMove = (lat, lng) => { setPinSet(true); setF(p => ({ ...p, lat, lng })); };

  const pinOk = pinSet && enLima(f.lat, f.lng);
  const areaNum = Number(f.area);
  const areaOk = f.area && areaNum >= 10 && areaNum <= (operacion === 'venta' ? 2000 : 1000);
  const priceNum = Number(f.price_usd);
  const priceOk = f.price_usd && priceNum >= cfg.min && priceNum <= cfg.max;
  const distOptions = distritos.map(d => ({ value: d.distrito, label: d.distrito }));
  const nameOk = f.contact_name.trim().length >= 2;
  const phoneOk = (f.contact_phone.match(/\d/g) || []).length >= 6;
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.contact_email.trim());
  const distOk = f.district.trim().length >= 2;
  const addrOk = f.address.trim().length >= 3;
  const formOk = pinOk && areaOk && priceOk && distOk && addrOk && nameOk && phoneOk && emailOk;

  const fmtMoney = (n) => '$' + Math.round(n).toLocaleString('en-US');

  // Precio sugerido: usa el modelo correcto según operación y NO persiste
  // análisis (simulate para alquiler; predict-venta ya es no-persistente).
  const calcular = async () => {
    if (!areaOk || !pinOk || calculating) return;
    setErr(''); setCalculating(true);
    try {
      let fv;
      if (operacion === 'venta') {
        const res = await Api.predictVenta({
          lat: f.lat, lng: f.lng, area: areaNum,
          dormitorios: f.dormitorios, banos: Math.max(1, f.banos), cocheras: f.cocheras,
          antiguedad_anios: f.antiguedad_anios, precio: priceNum || 1,
        });
        fv = res.fair_value;
        setCf(null);
      } else {
        const res = await Api.simulate({
          lat: f.lat, lng: f.lng, area: areaNum,
          dormitorios: f.dormitorios, banos: f.banos, cocheras: f.cocheras,
          antiguedad_anios: f.antiguedad_anios, es_estudio: f.es_estudio,
          amenities: f.amenities, precio: priceNum || 1,
        });
        fv = res.fair_value;
        setCf(null); setCfError(false); setCfLoading(true);
        Api.counterfactual({
          lat: f.lat, lng: f.lng, area: areaNum,
          dormitorios: f.dormitorios, banos: f.banos, cocheras: f.cocheras,
          antiguedad_anios: f.antiguedad_anios, es_estudio: f.es_estudio,
          amenities: f.amenities,
        }).then(r => { setCf(r); setCfLoading(false); })
          .catch(() => { setCfError(true); setCfLoading(false); });
      }
      setFairRef(fv);
      if (fv != null && !priceUserTyped) set('price_usd', String(Math.round(fv)));
    } catch (ex) {
      const msg = handleApiErr(ex, { setErr, onAuthExpired });
      if (typeof onError === 'function') onError(msg);
    } finally {
      setCalculating(false);
    }
  };

  const submit = async () => {
    if (submitting) return;
    if (!formOk) {
      // Marca todo como tocado para que salgan los errores por campo.
      setTouched({ district: true, address: true, area: true, price: true,
        contact_name: true, contact_phone: true, contact_email: true });
      setErr('Revisa los campos marcados antes de publicar.');
      return;
    }
    setErr(''); setSubmitting(true);
    try {
      const listing = await Api.createListing({
        operacion,
        district: f.district.trim(), address: f.address.trim(),
        lat: f.lat, lng: f.lng, area_m2: areaNum,
        dormitorios: f.dormitorios, banos: f.banos, cocheras: f.cocheras,
        antiguedad_anios: f.antiguedad_anios, es_estudio: f.es_estudio,
        price_usd: priceNum,
        description: f.description.trim(),
        image_url: f.image_url.trim() || null,
        amenities: f.amenities,
        contact_name: f.contact_name.trim(),
        contact_phone: f.contact_phone.trim(),
        contact_email: f.contact_email.trim(),
      });
      try { localStorage.removeItem(PUBLISH_DRAFT_KEY); } catch (_) {}
      if (onPublished && listing && listing.id) onPublished(listing.id);
    } catch (ex) {
      const msg = handleApiErr(ex, { setErr, onAuthExpired });
      if (typeof onError === 'function') onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSeller) {
    return (
      <div className="container fade-in">
        <PageHeader title="Publicar inmueble" subtitle="Solo para propietarios y agentes" onBack={onBack}/>
        <Card style={{textAlign:'center', padding:'52px 24px'}}>
          <div style={{width:60, height:60, borderRadius:16, margin:'0 auto 18px',
                       display:'flex', alignItems:'center', justifyContent:'center',
                       background:'var(--primary-soft)', color:'var(--primary)'}}>
            <Icon name="key" size={26}/>
          </div>
          <div style={{fontFamily:'Space Grotesk', fontSize:21, fontWeight:700}}>Necesitas un perfil de propietario</div>
          <p className="small muted" style={{maxWidth:420, margin:'8px auto 0', lineHeight:1.6}}>
            Solo los propietarios o agentes inmobiliarios pueden publicar inmuebles. Cambia tu rol en tu perfil para empezar a publicar.
          </p>
          <Btn variant="primary" style={{marginTop:22}} onClick={onBack}>
            <Icon name="back" size={15}/> Volver
          </Btn>
        </Card>
      </div>
    );
  }

  if (submitting) return <Loading label="Publicando inmueble…"/>;

  return (
    <div className="container fade-in" style={{maxWidth:880}}>
      <PageHeader title="Publicar inmueble"
        subtitle={`Crea el aviso de tu inmueble en ${cfg.label.toLowerCase()}`} onBack={onBack}/>

      <Card className="wizard-card">
        <div className="section-h">Tipo de operación</div>
        <div className="seg" role="tablist" aria-label="Tipo de operación"
          style={{display:'inline-flex', gap:4, padding:4, background:'var(--surface-2)', borderRadius:12, marginTop:8}}>
          {['alquiler','venta'].map(op=>(
            <button key={op} type="button" role="tab" aria-selected={operacion===op}
              onClick={()=>{ setOperacion(op); setFairRef(null); setCf(null); if(!priceUserTyped) set('price_usd',''); }}
              style={{
                padding:'8px 20px', borderRadius:9, border:'none', cursor:'pointer',
                fontSize:14, fontWeight:700, fontFamily:'inherit',
                background: operacion===op ? 'var(--primary)' : 'transparent',
                color: operacion===op ? '#fff' : 'var(--ink-2)',
              }}>
              {OP_CFG[op].label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="wizard-card" style={{marginTop:16}}>
        <div className="section-h">1 · Ubicación</div>
        <p className="small muted" style={{marginTop:-4, marginBottom:12}}>
          Busca la dirección o arrastra el pin en la ubicación exacta del inmueble.
        </p>
        <AddressSearch onPick={(lat,lng)=>{ setPinSet(true); setFlyTo({lat,lng}); }}/>
        <MapPicker lat={f.lat} lng={f.lng} flyTo={flyTo} onMove={onPinMove}/>
        <div className="row" style={{justifyContent:'space-between', marginTop:12}}>
          <span className="small muted numeric">{f.lat.toFixed(5)}, {f.lng.toFixed(5)}</span>
          {!pinSet
            ? <Tag variant="warning">Coloca el pin en tu inmueble</Tag>
            : (pinOk
              ? <Tag variant="success">Dentro de Lima</Tag>
              : <Tag variant="danger">Fuera de Lima Metropolitana</Tag>)}
        </div>
        <div className="grid-2" style={{gap:14, marginTop:14}}>
          {distOptions.length > 0
            ? <Select label="Distrito" options={[{value:'',label:'Selecciona un distrito'}].concat(distOptions)}
                value={f.district} onChange={(v)=>{ manual.current.district = true; set('district', v); }}/>
            : <Input label="Distrito" placeholder="Miraflores" value={f.district}
                onChange={(e)=>{ manual.current.district = true; set('district', e.target.value); }}
                onBlur={()=>blur('district')}
                error={touched.district && !distOk ? 'Indica el distrito.' : ''}/>}
          <Input label="Dirección" placeholder="Av. Larco 345" value={f.address}
            onChange={(e)=>{ manual.current.address = true; set('address', e.target.value); }}
            onBlur={()=>blur('address')}
            error={touched.address && !addrOk ? 'Escribe la dirección (calle y número).' : ''}/>
        </div>
      </Card>

      <Card className="wizard-card" style={{marginTop:16}}>
        <div className="section-h">2 · Características</div>
        <ToggleRow label="Es un estudio (monoambiente)" checked={f.es_estudio}
          onChange={(v)=>setF(p=>({
            ...p, es_estudio:v,
            dormitorios: v ? 0 : Math.max(1, p.dormitorios),   
            banos: v ? p.banos : Math.max(1, p.banos),
          }))}/>
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
        <div className="section-h" style={{marginTop:18}}>Amenities</div>
        <div className="row" style={{flexWrap:'wrap', gap:8}}>
          {AMENIDADES.map(a=>(
            <div key={a.key}
              className={`pick-chip ${f.amenities.includes(a.key)?'on':''}`}
              role="button" tabIndex={0}
              aria-pressed={f.amenities.includes(a.key)} aria-label={a.label}
              onClick={()=>toggleAmenity(a.key)}
              onKeyDown={onKeyActivate(()=>toggleAmenity(a.key))}>{a.label}</div>
          ))}
        </div>
        {f.area && !areaOk && (
          <div className="small" style={{color:'var(--danger)', marginTop:10}}>
            El área debe estar entre 10 y {operacion === 'venta' ? 2000 : 1000} m².
          </div>
        )}
        <div className="field" style={{marginTop:16}}>
          <label>Descripción (opcional)</label>
          <div className="input-wrap">
            <textarea rows={3} maxLength={2000} placeholder="Departamento luminoso a pasos del parque…"
              value={f.description} onChange={(e)=>set('description', e.target.value)}/>
          </div>
          <div className="tiny muted" style={{textAlign:'right', marginTop:2}}>{f.description.length}/2000</div>
        </div>
        <div style={{marginTop:14}}>
          <label style={{display:'block', marginBottom:6, fontWeight:600, fontSize:13, color:'var(--ink-2)'}}>Foto del inmueble (opcional)</label>
          <div className="row" style={{gap:10, flexWrap:'wrap', alignItems:'center'}}>
            <label style={{display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px', border:'1px solid var(--line)', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:600, background:'var(--surface)'}}>
              <Icon name="plus" size={14}/> {photoLoading ? 'Procesando…' : 'Subir foto'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPickFile} style={{display:'none'}}/>
            </label>
            {f.image_url && /^(https?:\/\/|data:image\/)/i.test(f.image_url.trim()) && (
              <span className="row" style={{gap:8, alignItems:'center'}}>
                <img src={f.image_url} alt="Vista previa" style={{width:54, height:40, objectFit:'cover', borderRadius:6, border:'1px solid var(--line)'}}/>
                <button type="button" onClick={()=>{ set('image_url',''); setPhotoErr(''); }} style={{fontSize:12, color:'var(--danger)', background:'none', border:'none', cursor:'pointer', padding:0}}>Quitar</button>
              </span>
            )}
          </div>
          {photoErr && <div className="field-err" style={{marginTop:6}}>{photoErr}</div>}
          <p className="tiny muted" style={{margin:'6px 0 8px'}}>
            JPG, PNG o WebP (máx. 12 MB). También puedes pegar el enlace de una imagen.
          </p>
          <Input label="" placeholder="https://…/foto.jpg"
            value={/^data:/i.test(f.image_url) ? '' : f.image_url}
            onChange={(e)=>set('image_url', e.target.value)}/>
        </div>
      </Card>

      <Card className="wizard-card" style={{marginTop:16}}>
        <div className="section-h">3 · Precio</div>
        <p className="small muted" style={{marginTop:-4, marginBottom:12}}>
          Calcula un precio sugerido con el modelo y publícalo, o fija tu propio precio.
        </p>
        <div className="row" style={{justifyContent:'space-between', flexWrap:'wrap', gap:10}}>
          <Btn variant="outline" onClick={calcular} disabled={!areaOk || !pinOk || calculating}>
            <Icon name="sparkle" size={14}/> {calculating ? 'Calculando…' : 'Calcular precio sugerido'}
          </Btn>
          {fairRef != null && (
            <Tag variant="accent">
              Referencia del modelo: {fmtMoney(fairRef)} {cfg.unit}
            </Tag>
          )}
        </div>
        <div className="big-price" style={{marginTop:14}}>
          <span className="big-price-prefix">$</span>
          <input className="big-price-input" value={f.price_usd} inputMode="numeric"
            placeholder={cfg.phPrice} aria-label={`Precio publicado en USD ${cfg.unit}`}
            onChange={(e)=>{ setPriceUserTyped(true); set('price_usd', e.target.value.replace(/[^0-9]/g,'')); }}
            onBlur={()=>blur('price')}/>
          <span className="big-price-suffix"><span className="sl">{cfg.unit==='/mes'?'/':''}</span> {cfg.unit==='/mes'?'mes':'total'}</span>
        </div>
        <div className="big-price-foot">
          <span className="muted">USD {cfg.unit==='/mes'?'por mes':'total'}</span>
          <span className="muted">Rango: {fmtMoney(cfg.min)}–{fmtMoney(cfg.max)}</span>
        </div>
        {(touched.price || f.price_usd) && !priceOk && (
          <div className="field-err" style={{marginTop:10}}>
            El precio debe estar entre {fmtMoney(cfg.min)} y {fmtMoney(cfg.max)} USD {cfg.unit==='/mes'?'/mes':'total'}.
          </div>
        )}
      </Card>

      {operacion === 'alquiler' && fairRef != null && (
        <div style={{marginTop:16}}>
          <CounterfactualPanel cf={cf} loading={cfLoading} error={cfError} isSeller/>
        </div>
      )}

      <Card className="wizard-card" style={{marginTop:16}}>
        <div className="section-h">4 · Contacto</div>
        <div className="grid-2" style={{gap:14, marginTop:6}}>
          <Input label="Nombre de contacto" placeholder="Roberto Pérez" value={f.contact_name}
            onChange={(e)=>set('contact_name', e.target.value)} onBlur={()=>blur('contact_name')}
            error={touched.contact_name && !nameOk ? 'Ingresa el nombre de contacto.' : ''}/>
          <Input label="Teléfono" placeholder="+51 999 888 777" inputMode="tel" value={f.contact_phone}
            onChange={(e)=>set('contact_phone', e.target.value)} onBlur={()=>blur('contact_phone')}
            error={touched.contact_phone && !phoneOk ? 'El teléfono debe tener al menos 6 dígitos.' : ''}/>
          <Input label="Correo" placeholder="roberto@correo.com" inputMode="email" value={f.contact_email}
            onChange={(e)=>set('contact_email', e.target.value)} onBlur={()=>blur('contact_email')}
            error={touched.contact_email && !emailOk ? 'Ingresa un correo válido.' : ''}/>
        </div>
        {err && (
          <div className="banner danger" style={{marginTop:14}} role="alert">
            <Icon name="alert" size={14}/> {err}
          </div>
        )}
        <div className="row" style={{justifyContent:'space-between', marginTop:18}}>
          <Btn variant="outline" onClick={onBack}>
            <Icon name="back" size={14}/> Cancelar
          </Btn>
          <div className="row" style={{gap:10}}>
            <Btn variant="outline" size="lg" onClick={()=>setPreviewOpen(true)}>
              <Icon name="eye" size={15}/> Vista previa
            </Btn>
            <Btn variant="primary" size="lg" onClick={submit} disabled={submitting || !formOk}>
              <Icon name="check" size={16}/> Publicar inmueble
            </Btn>
          </div>
        </div>
      </Card>

      {}
      <Modal open={previewOpen} onClose={()=>setPreviewOpen(false)}
        title="Vista previa del aviso"
        subtitle="Así se verá tu publicación en el catálogo. Cierra para seguir editando.">
        <div style={{maxWidth:320, margin:'0 auto'}}>
          <ListingCard listing={{
            id: 0,
            operacion,
            price_usd: priceNum || parseFloat(f.price_usd) || 0,
            image_url: f.image_url.trim() || null,
            address: f.address.trim() || 'Dirección del inmueble',
            district: f.district.trim() || '—',
            dormitorios: f.dormitorios, banos: f.banos, area_m2: areaNum,
            zone: (fairRef && priceNum)
              ? (priceNum < fairRef * 0.92 ? 'Ganga' : priceNum > fairRef * 1.08 ? 'Inflado' : 'Justo')
              : null,
          }}/>
        </div>
        {(!f.image_url.trim()) && (
          <p className="tiny muted" style={{textAlign:'center', marginTop:12}}>
            Sin foto, tu aviso muestra un color por zona. Agregar una foto mejora el interés.
          </p>
        )}
      </Modal>
    </div>
  );
};

const fmtLeadDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return d.toISOString().slice(0, 10);
  }
};

const MyListingRow = ({ listing, onOpenListing, onDeleted, onChanged, onError, onAuthExpired }) => {
  const [open, setOpen] = useS(false);
  const [leads, setLeads] = useS(null);
  const [loading, setLoading] = useS(false);
  const [err, setErr] = useS('');
  const [loaded, setLoaded] = useS(false);
  const [deleting, setDeleting] = useS(false);
  const [busy, setBusy] = useS(false);
  const [editingPrice, setEditingPrice] = useS(false);
  const [priceVal, setPriceVal] = useS(String(Math.round(Number(listing.price_usd) || 0)));

  const isVenta = listing.operacion === 'venta';
  const unit = isVenta ? 'total' : '/mes';

  const del = (e) => {
    e.stopPropagation();
    if (deleting) return;
    const ok = window.confirm(`¿Borrar la publicación de "${listing.address}"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    setDeleting(true);
    Api.deleteListing(listing.id)
      .then(() => { if (typeof onDeleted === 'function') onDeleted(); })
      .catch(ex => {
        setDeleting(false);
        const msg = handleApiErr(ex, { setErr, onAuthExpired });
        if (typeof onError === 'function') onError(msg);
      });
  };

  const patch = (body, e) => {
    if (e) e.stopPropagation();
    if (busy) return;
    setBusy(true);
    Api.updateListing(listing.id, body)
      .then(() => { setEditingPrice(false); if (typeof onChanged === 'function') onChanged(); })
      .catch(ex => {
        const msg = handleApiErr(ex, { setErr, onAuthExpired });
        if (typeof onError === 'function') onError(msg);
      })
      .finally(() => setBusy(false));
  };
  const toggleStatus = (e) => patch(
    { status: listing.status === 'activo' ? 'pausado' : 'activo' }, e);

  const loadLeads = (retry) => {
    if ((loaded || loading) && !retry) return;
    setLoading(true); setErr('');
    Api.listLeads(listing.id)
      .then(r => { setLeads(Array.isArray(r) ? r : []); setLoaded(true); })
      .catch(ex => {
        const msg = handleApiErr(ex, { setErr, onAuthExpired });
        if (typeof onError === 'function') onError(msg);
      })
      .finally(() => setLoading(false));
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadLeads(false);
  };

  const price = Math.round(Number(listing.price_usd) || 0).toLocaleString('en-US');
  const count = leads ? leads.length : null;

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div
        className="ana-entry"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`Inmueble en ${listing.address}, ver consultas`}
        onClick={toggle}
        onKeyDown={onKeyActivate(toggle)}
        style={{ margin: 0, borderRadius: 0, border: 'none' }}
      >
        <div className="ana-entry-ico"><Icon name="home" size={22}/></div>
        <div className="ana-entry-body" style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, fontFamily: 'Space Grotesk' }}>{listing.address}</div>
          <div className="small muted" style={{ marginTop: 2 }}>
            {listing.district} · <b>${price}</b> {unit}
            {count != null && (
              <> · {count} {count === 1 ? 'consulta' : 'consultas'}</>
            )}
          </div>
        </div>
        {listing.status === 'pausado' && <Tag variant="warning">Pausado</Tag>}
        {listing.zone && <Tag variant={ZONE_VARIANT[listing.zone] || 'default'}>{listing.zone}</Tag>}
        <Icon name={open ? 'back' : 'fwd'} size={16} stroke="var(--ink-3)"
              style={open ? { transform: 'rotate(-90deg)' } : undefined}/>
      </div>

      {open && (
        <div style={{ padding: '4px 16px 16px', borderTop: '1px solid var(--line)' }}>
          {loading && (
            <p className="small muted" style={{ padding: '16px 0', margin: 0 }}>Cargando consultas…</p>
          )}

          {!loading && err && (
            <div className="banner danger" style={{ marginTop: 12 }}>
              <Icon name="alert" size={14}/>
              <span>No se pudieron cargar las consultas.</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); loadLeads(true); }}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
              >
                Reintentar
              </button>
            </div>
          )}

          {!loading && !err && leads && leads.length === 0 && (
            <div className="text-center" style={{ padding: '28px 12px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>Aún no recibes consultas</div>
              <p className="small muted" style={{ marginTop: 4 }}>
                Cuando un interesado te contacte por este inmueble, aparecerá aquí.
              </p>
            </div>
          )}

          {!loading && !err && leads && leads.length > 0 && (
            <div className="stack-12" style={{ marginTop: 12 }}>
              {leads.map((lead) => (
                <div key={lead.id} className="lead-card">
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        <Icon name="user" size={14} stroke="var(--ink-2)"/> {lead.name}
                      </div>
                      <div className="small muted" style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                        <a href={`tel:${lead.phone}`} style={{ color: 'var(--ink-2)', textDecoration: 'none' }}>
                          {lead.phone}
                        </a>
                        <a href={`mailto:${lead.email}`} style={{ color: 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icon name="mail" size={13} stroke="var(--primary)"/> {lead.email}
                        </a>
                      </div>
                    </div>
                    {lead.created_at && (
                      <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>{fmtLeadDate(lead.created_at)}</span>
                    )}
                  </div>
                  {lead.message && (
                    <p className="small" style={{ marginTop: 8, marginBottom: 0, lineHeight: 1.55, color: 'var(--ink-2)' }}>
                      “{lead.message}”
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {editingPrice && (
            <div className="row" style={{ gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}
                 onClick={(e) => e.stopPropagation()}>
              <span style={{ fontWeight: 700 }}>$</span>
              <input className="input" value={priceVal} inputMode="numeric"
                aria-label="Nuevo precio"
                onChange={(e) => setPriceVal(e.target.value.replace(/[^0-9]/g, ''))}
                style={{ width: 130, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 8 }}/>
              <span className="small muted">{unit}</span>
              <Btn variant="primary" size="sm" disabled={busy || !priceVal}
                onClick={() => patch({ price_usd: Number(priceVal) })}>
                {busy ? 'Guardando…' : 'Guardar'}
              </Btn>
              <button type="button" onClick={() => setEditingPrice(false)}
                style={{ background: 'none', border: 'none', color: 'var(--ink-3)', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          )}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {onOpenListing && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenListing(listing.id); }}
                style={{ padding: 0, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                Ver inmueble <Icon name="fwd" size={13} stroke="var(--primary)"/>
              </button>
            )}
            {!editingPrice && (
              <button type="button" onClick={(e) => { e.stopPropagation(); setEditingPrice(true); }}
                style={{ padding: 0, background: 'none', border: 'none', color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Editar precio
              </button>
            )}
            <button type="button" onClick={toggleStatus} disabled={busy}
              style={{ padding: 0, background: 'none', border: 'none', color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}>
              {listing.status === 'activo' ? 'Pausar' : 'Activar'}
            </button>
            <button
              type="button"
              onClick={del}
              disabled={deleting}
              style={{ marginLeft: 'auto', padding: 0, background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13, fontWeight: 600, cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Icon name="close" size={13} stroke="var(--danger)"/> {deleting ? 'Borrando…' : 'Borrar'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};

export const MyListingsScreen = ({ onBack, onOpenListing, onPublish, onError, onAuthExpired }) => {
  const [listings, setListings] = useS(null);
  const [loading, setLoading] = useS(true);
  const [err, setErr] = useS('');

  const load = () => {
    setLoading(true); setErr('');
    Api.myListings()
      .then(r => setListings(Array.isArray(r) ? r : []))
      .catch(ex => {
        const msg = handleApiErr(ex, { setErr, onAuthExpired });
        if (typeof onError === 'function') onError(msg);
      })
      .finally(() => setLoading(false));
  };

  useE(() => {
    let cancel = false;
    setLoading(true); setErr('');
    Api.myListings()
      .then(r => { if (!cancel) setListings(Array.isArray(r) ? r : []); })
      .catch(ex => {
        if (cancel) return;
        const msg = handleApiErr(ex, { setErr, onAuthExpired });
        if (typeof onError === 'function') onError(msg);
      })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  if (loading) return <Loading label="Cargando tus publicaciones…"/>;

  return (
    <div className="container fade-in">
      <PageHeader
        title="Mis propiedades"
        subtitle="Tus inmuebles y las consultas que has recibido"
        onBack={onBack}
        actions={onPublish && (
          <Btn variant="primary" size="sm" onClick={onPublish}>
            <Icon name="plus" size={14}/> Publicar inmueble
          </Btn>
        )}
      />

      {err && (
        <Card style={{ textAlign: 'center', padding: '52px 24px' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            <Icon name="alert" size={26}/>
          </div>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 21, fontWeight: 700 }}>No se pudieron cargar tus publicaciones</div>
          <p className="small muted" style={{ maxWidth: 400, margin: '8px auto 0', lineHeight: 1.6 }}>{err}</p>
          <Btn variant="primary" style={{ marginTop: 22 }} onClick={load}>
            <Icon name="arrow" size={15}/> Reintentar
          </Btn>
        </Card>
      )}

      {!err && listings && listings.length === 0 && (
        <Card style={{ textAlign: 'center', padding: '52px 24px' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-soft)', color: 'var(--primary)' }}>
            <Icon name="home" size={26}/>
          </div>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 21, fontWeight: 700 }}>Aún no tienes inmuebles publicados</div>
          <p className="small muted" style={{ maxWidth: 400, margin: '8px auto 0', lineHeight: 1.6 }}>
            Publica tu primer inmueble para empezar a recibir consultas de interesados.
          </p>
          {onPublish && (
            <Btn variant="primary" style={{ marginTop: 22 }} onClick={onPublish}>
              <Icon name="plus" size={15}/> Publicar inmueble
            </Btn>
          )}
        </Card>
      )}

      {!err && listings && listings.length > 0 && (
        <div className="stack-16" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {listings.map((l) => (
            <MyListingRow
              key={l.id}
              listing={l}
              onOpenListing={onOpenListing}
              onDeleted={load}
              onChanged={load}
              onError={onError}
              onAuthExpired={onAuthExpired}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const LeadsScreen = ({ onOpenListing, onGo, onError, onAuthExpired }) => {
  const [items, setItems] = useS(null);   
  const [loading, setLoading] = useS(true);
  const [err, setErr] = useS('');

  const load = () => {
    setLoading(true); setErr('');
    // Un solo request agregado (antes era N+1: un fetch por propiedad, y los
    // fallos parciales se tragaban en silencio ocultando leads reales).
    Api.inboxLeads()
      .then((rows) => {
        const arr = Array.isArray(rows) ? rows : [];
        setItems(arr.map((r) => ({
          lead: { id: r.id, name: r.name, phone: r.phone, email: r.email,
                  message: r.message, created_at: r.created_at },
          listing: { id: r.listing_id, address: r.listing_address,
                     district: r.listing_district, operacion: r.listing_operacion },
        })));
      })
      .catch((ex) => {
        const msg = handleApiErr(ex, { setErr, onAuthExpired });
        if (typeof onError === 'function') onError(msg);
      })
      .finally(() => setLoading(false));
  };

  useE(() => { load(); }, []);

  if (loading) return <Loading label="Cargando tus consultas…"/>;

  return (
    <div className="container fade-in">
      <PageHeader
        title="Leads"
        subtitle="Todas las consultas que has recibido, de la más reciente a la más antigua"
      />

      {err && (
        <Card style={{ textAlign: 'center', padding: '52px 24px' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            <Icon name="alert" size={26}/>
          </div>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 21, fontWeight: 700 }}>No se pudieron cargar tus consultas</div>
          <p className="small muted" style={{ maxWidth: 400, margin: '8px auto 0', lineHeight: 1.6 }}>{err}</p>
          <Btn variant="primary" style={{ marginTop: 22 }} onClick={load}>
            <Icon name="arrow" size={15}/> Reintentar
          </Btn>
        </Card>
      )}

      {!err && items && items.length === 0 && (
        <Card style={{ textAlign: 'center', padding: '52px 24px' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-soft)', color: 'var(--primary)' }}>
            <Icon name="mail" size={26}/>
          </div>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 21, fontWeight: 700 }}>Aún no recibes consultas</div>
          <p className="small muted" style={{ maxWidth: 420, margin: '8px auto 0', lineHeight: 1.6 }}>
            Cuando un interesado contacte por alguno de tus inmuebles, su mensaje aparecerá aquí.
          </p>
          {onGo && (
            <Btn variant="outline" style={{ marginTop: 22 }} onClick={() => onGo('mis-publicaciones')}>
              <Icon name="home" size={15}/> Ver mis publicaciones
            </Btn>
          )}
        </Card>
      )}

      {!err && items && items.length > 0 && (
        <div className="stack-12" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(({ lead, listing }) => (
            <div key={`${listing.id}-${lead.id}`} className="lead-card">
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    <Icon name="user" size={14} stroke="var(--ink-2)"/> {lead.name}
                  </div>
                  <div className="small muted" style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                    <a href={`tel:${lead.phone}`} style={{ color: 'var(--ink-2)', textDecoration: 'none' }}>
                      {lead.phone}
                    </a>
                    <a href={`mailto:${lead.email}`} style={{ color: 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="mail" size={13} stroke="var(--primary)"/> {lead.email}
                    </a>
                  </div>
                </div>
                {lead.created_at && (
                  <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>{fmtLeadDate(lead.created_at)}</span>
                )}
              </div>

              {lead.message && (
                <p className="small" style={{ marginTop: 8, marginBottom: 0, lineHeight: 1.55, color: 'var(--ink-2)' }}>
                  “{lead.message}”
                </p>
              )}

              <button
                type="button"
                onClick={() => onOpenListing && onOpenListing(listing.id)}
                style={{ marginTop: 10, padding: 0, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <Icon name="home" size={13} stroke="var(--primary)"/> {listing.address} · {listing.district}
                <Icon name="fwd" size={13} stroke="var(--primary)"/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const SavedScreen = ({ onOpenListing, onGo, onError, onAuthExpired }) => {
  const [data, setData] = useS(null);
  const [loading, setLoading] = useS(true);
  const [err, setErr] = useS('');

  useE(() => {
    setLoading(true); setErr('');
    Api.favorites()
      .then(r => { setData(Array.isArray(r) ? r : []); setLoading(false); })
      .catch(ex => {
        const msg = handleApiErr(ex, { setErr, onAuthExpired });
        if (typeof onError === 'function') onError(msg);
        setLoading(false);
      });
  }, []);

  
  
  const onToggleFav = (id ) => {
    const prev = data;
    setData(d => (d || []).filter(l => l.id !== id));
    Api.removeFavorite(id).catch(ex => {
      setData(prev);                                 
      const msg = handleApiErr(ex, { setErr, onAuthExpired });
      if (typeof onError === 'function') onError(msg);
    });
  };

  if (loading) return <Loading label="Cargando guardados…"/>;

  return (
    <div className="container fade-in">
      <PageHeader
        title="Guardados"
        subtitle="Los inmuebles que marcaste con el corazón"/>

      {err && (
        <div className="banner danger" style={{marginBottom:14}}>
          <Icon name="alert" size={14}/> {err}
        </div>
      )}

      {(!data || data.length === 0) ? (
        <Card style={{textAlign:'center', padding:'52px 24px'}}>
          <div style={{width:60, height:60, borderRadius:16, margin:'0 auto 18px',
                       display:'flex', alignItems:'center', justifyContent:'center',
                       background:'var(--danger-soft)', color:'var(--danger)'}}>
            <Icon name="heart" size={26}/>
          </div>
          <div style={{fontFamily:'Space Grotesk', fontSize:21, fontWeight:700}}>Todavía no guardas nada</div>
          <p className="small muted" style={{maxWidth:420, margin:'8px auto 0', lineHeight:1.6}}>
            Toca el corazón de cualquier inmueble en Explorar para guardarlo y volver a verlo aquí.
          </p>
          <Btn variant="primary" style={{marginTop:22}} onClick={()=> onGo && onGo('listings')}>
            <Icon name="map" size={15}/> Explorar inmuebles
          </Btn>
        </Card>
      ) : (
        <div className="home-gangas-grid">
          {data.map(l => (
            <ListingCard key={l.id} listing={l} onOpen={onOpenListing}
              isFav={true} onToggleFav={onToggleFav}/>
          ))}
        </div>
      )}
    </div>
  );
};

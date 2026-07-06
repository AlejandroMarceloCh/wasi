

const ContactModal = ({ open, onClose, listingId, onError, onAuthExpired }) => {
  const [f, setF] = useS({ name: '', phone: '', email: '', message: '' });
  const [submitting, setSubmitting] = useS(false);
  const [sent, setSent] = useS(false);
  const [err, setErr] = useS('');
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  
  useE(() => {
    if (open) { setF({ name: '', phone: '', email: '', message: '' }); setSent(false); setErr(''); }
  }, [open]);

  const nameOk = f.name.trim().length >= 2;
  const phoneOk = f.phone.trim().length >= 6;
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim());
  const formOk = nameOk && phoneOk && emailOk;

  const submit = async () => {
    if (!formOk || submitting) return;
    setErr(''); setSubmitting(true);
    try {
      await Api.createLead(listingId, {
        name: f.name.trim(), phone: f.phone.trim(),
        email: f.email.trim(), message: f.message.trim(),
      });
      setSent(true);
    } catch (ex) {
      const msg = handleApiErr(ex, { setErr, onAuthExpired });
      if (typeof onError === 'function') onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<Icon name="mail" size={20}/>}
      title="Contactar al propietario"
      subtitle="Enviaremos tus datos para que se comunique contigo"
      footer={sent
        ? <Btn variant="primary" onClick={onClose}>Cerrar</Btn>
        : <>
            <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
            <Btn variant="primary" onClick={submit} disabled={!formOk || submitting}>
              {submitting ? 'Enviando…' : 'Enviar mensaje'}
            </Btn>
          </>}
    >
      {sent ? (
        <div className="text-center" style={{padding:'14px 0 6px'}}>
          <div style={{width:56, height:56, borderRadius:16, margin:'0 auto 14px',
                       background:'var(--success-soft)', color:'var(--success)',
                       display:'flex', alignItems:'center', justifyContent:'center'}}>
            <Icon name="check" size={26}/>
          </div>
          <div style={{fontWeight:700, fontFamily:'Space Grotesk', fontSize:16}}>Mensaje enviado</div>
          <p className="small muted" style={{maxWidth:340, margin:'6px auto 0', lineHeight:1.55}}>
            El propietario recibió tus datos. Te contactará pronto.
          </p>
        </div>
      ) : (
        <div className="stack-16" style={{display:'flex', flexDirection:'column', gap:12}}>
          <Input label="Nombre" placeholder="Ana García" value={f.name}
            onChange={(e)=>set('name', e.target.value)}/>
          <div className="grid-2" style={{gap:12}}>
            <Input label="Teléfono" placeholder="+51 999 888 777" inputMode="tel" value={f.phone}
              onChange={(e)=>set('phone', e.target.value)}/>
            <Input label="Correo" placeholder="ana@correo.com" inputMode="email" value={f.email}
              onChange={(e)=>set('email', e.target.value)}/>
          </div>
          <div className="field">
            <label>Mensaje (opcional)</label>
            <div className="input-wrap">
              <textarea rows={3} placeholder="Hola, ¿el inmueble sigue disponible?"
                value={f.message} onChange={(e)=>set('message', e.target.value)}/>
            </div>
          </div>
          {err && (
            <div className="banner danger"><Icon name="alert" size={14}/> {err}</div>
          )}
        </div>
      )}
    </Modal>
  );
};

const VERDICT_PIN = { Ganga: 'price-pin-ganga', Justo: 'price-pin-justo', Inflado: 'price-pin-inflado' };

const priceIcon = (listing, active) => {
  
  
  
  
  const p = Number(listing.price_usd);
  let label = '$0';
  if (Number.isFinite(p)) {
    label = p < 1000
      ? '$' + Math.round(p).toLocaleString('en-US')
      : '$' + (p / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return L.divIcon({
    className: 'price-pin',
    html: `<div class="price-pin-body ${VERDICT_PIN[listing.zone] || 'price-pin-none'}${active ? ' is-active' : ''}">${label}</div>`,
    iconSize: null, iconAnchor: [24, 30],
  });
};

const ListingsSplitMap = ({ listings, onOpen, favIds, onToggleFav }) => {
  const elRef = useR(null), mapRef = useR(null), layerRef = useR(null), markersRef = useR({});
  const [active, setActive] = useS(null);
  
  const [bounds, setBounds] = useS(null);

  
  useE(() => {
    if (!elRef.current || mapRef.current || !window.L) return;
    const map = L.map(elRef.current, {
      scrollWheelZoom: true, doubleClickZoom: true, zoomControl: true,
      attributionControl: false,
    }).setView([-12.09, -77.03], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
    }).addTo(map);
    
    
    
    layerRef.current = (L.markerClusterGroup
      ? L.markerClusterGroup({
          
          
          maxClusterRadius: (zoom) => (zoom >= 15 ? 18 : zoom >= 14 ? 30 : zoom >= 13 ? 44 : 60),
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: false,
          chunkedLoading: true,
          disableClusteringAtZoom: 16,
          iconCreateFunction: (cluster) => {
            const n = cluster.getChildCount();
            const label = n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'K' : String(n);
            
            const tier = n >= 250 ? 'xl' : n >= 50 ? 'lg' : n >= 10 ? 'md' : 'sm';
            const size = tier === 'xl' ? 58 : tier === 'lg' ? 50 : tier === 'md' ? 42 : 36;
            return L.divIcon({
              html: `<div class="cl cl-${tier}" title="${n} avisos en esta zona — acerca el zoom para ver precios"><span>${label}</span></div>`,
              className: 'cluster-pin',
              iconSize: [size, size],
            });
          },
        })
      : L.layerGroup()).addTo(map);
    mapRef.current = map;
    
    
    requestAnimationFrame(() => { map.invalidateSize(); setBounds(map.getBounds()); });
    
    
    const syncBounds = () => { if (mapRef.current) setBounds(mapRef.current.getBounds()); };
    map.on('moveend', syncBounds);
    let ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => { if (mapRef.current) mapRef.current.invalidateSize(); });
      ro.observe(elRef.current);
    }
    return () => {
      if (ro) ro.disconnect();
      map.off('moveend', syncBounds);
      map.remove(); mapRef.current = null; layerRef.current = null; markersRef.current = {};
    };
  }, []);

  
  
  
  useE(() => {
    if (!mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers(); markersRef.current = {};
    const ms = [];
    const pts = [];
    for (const l of (listings || [])) {
      if (typeof l.lat !== 'number' || typeof l.lng !== 'number') continue;
      const m = L.marker([l.lat, l.lng], { icon: priceIcon(l, false) });
      m.on('mouseover', () => setActive(l.id));
      m.on('mouseout', () => setActive(null));
      m.on('click', () => onOpen && onOpen(l.id));
      markersRef.current[l.id] = { marker: m, listing: l };
      ms.push(m);
      pts.push([l.lat, l.lng]);
    }
    if (layerRef.current.addLayers) layerRef.current.addLayers(ms);  
    else ms.forEach(m => layerRef.current.addLayer(m));
    if (pts.length) mapRef.current.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
    else setBounds(mapRef.current.getBounds());
  }, [listings]);

  
  const setPinActive = (id, on) => {
    const e = markersRef.current[id];
    if (!e || !e.marker._map) return;   
    e.marker.setIcon(priceIcon(e.listing, on));
    e.marker.setZIndexOffset(on ? 1000 : 0);
  };
  
  const prevActiveRef = useR(null);
  useE(() => {
    const prev = prevActiveRef.current;
    if (prev != null && String(prev) !== String(active)) setPinActive(prev, false);
    if (active != null) setPinActive(active, true);
    prevActiveRef.current = active;
  }, [active]);

  
  
  const GRID_CAP = 60;
  const all = listings || [];
  const inView = (l) => {
    if (!bounds) return true;
    if (typeof l.lat !== 'number' || typeof l.lng !== 'number') return true;
    return bounds.contains([l.lat, l.lng]);
  };
  const visible = all.filter(inView);
  const shown = visible.slice(0, GRID_CAP);

  return (
    <div className="listings-split">
      <div className="ls-map">
        <div ref={elRef}/>
        {
}
        <div style={{position:'absolute', bottom:14, left:14, zIndex:500, height:'auto',
                     width:'auto', maxWidth:'calc(100% - 28px)',
                     background:'rgba(255,255,255,.94)', backdropFilter:'blur(6px)',
                     border:'1px solid rgba(0,0,0,.08)', borderRadius:10,
                     padding:'8px 11px', fontSize:11, lineHeight:1.6,
                     boxShadow:'0 2px 10px rgba(0,0,0,.12)'}}>
          <div style={{display:'flex', gap:10, flexWrap:'wrap', alignItems:'center'}}>
            <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
              <span style={{width:9, height:9, borderRadius:'50%', background:'#15803d'}}/>Ganga
            </span>
            <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
              <span style={{width:9, height:9, borderRadius:'50%', background:'#b45309'}}/>Justo
            </span>
            <span style={{display:'inline-flex', alignItems:'center', gap:5}}>
              <span style={{width:9, height:9, borderRadius:'50%', background:'#b91c1c'}}/>Inflado
            </span>
          </div>
          <div style={{color:'#64748b', marginTop:3}}>El número en un grupo = avisos en esa zona · acerca el zoom para ver precios</div>
        </div>
      </div>
      <div className="ls-panel">
        <div className="ls-count">
          {all.length === 0
            ? 'Sin inmuebles'
            : visible.length > GRID_CAP
              ? <>Mostrando <strong>{GRID_CAP}</strong> de {visible.length} en esta zona · acerca el zoom para afinar</>
              : <><strong>{visible.length}</strong> de {all.length} {all.length === 1 ? 'inmueble' : 'inmuebles'} en esta zona</>}
        </div>
        <div className="ls-grid">
          {shown.map(l => (
            <div key={l.id}
                 onMouseEnter={() => setActive(l.id)} onMouseLeave={() => setActive(null)}>
              <ListingCard listing={l} onOpen={onOpen}
                isFav={favIds ? favIds.has(l.id) : undefined}
                onToggleFav={onToggleFav}/>
            </div>
          ))}
          {all.length === 0 && (
            <div className="muted small" style={{ gridColumn: '1 / -1', padding: '40px 8px', textAlign: 'center' }}>
              No hay inmuebles que coincidan. Ajusta los filtros.
            </div>
          )}
          {all.length > 0 && visible.length === 0 && (
            <div className="muted small" style={{ gridColumn: '1 / -1', padding: '40px 8px', textAlign: 'center' }}>
              No hay inmuebles en esta zona del mapa. Aleja el zoom o muévete a otra área.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MarketRangeD3 = ({ p25, p50, p75, fair, announced, zone }) => {
  const ref = useR(null);
  useE(() => {
    const d3 = window.d3, el = ref.current;
    if (!d3 || !el) return;
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

const PoiImportanceD3 = ({ data }) => {
  const ref = useR(null);
  useE(() => {
    const d3 = window.d3, el = ref.current;
    if (!d3 || !el || !Array.isArray(data) || !data.length) return;
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

const CounterfactualTornadoD3 = ({ items }) => {
  const ref = useR(null);
  useE(() => {
    const d3 = window.d3, el = ref.current;
    if (!d3 || !el || !Array.isArray(items) || !items.length) return;
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

const ListingsScreen = ({ onOpenListing, onError, onAuthExpired }) => {
  const [data, setData] = useS(null);
  const [loading, setLoading] = useS(true);
  const [err, setErr] = useS('');
  const [distritos, setDistritos] = useS([]);
  const [filters, setFilters] = useS({ district: '', min_price: '', max_price: '', min_area: '', max_area: '', dormitorios: 0 });
  const [operacion, setOperacion] = useS('alquiler');
  const [sort, setSort] = useS('');
  const [page, setPage] = useS(0);
  const [total, setTotal] = useS(0);
  const PAGE_SIZE = 24;
  const [favIds, setFavIds] = useS(() => new Set());

  const load = (toPage) => {
    const p = toPage != null ? toPage : page;
    setLoading(true); setErr('');
    const params = { operacion, limit: PAGE_SIZE, offset: p * PAGE_SIZE };
    if (filters.district) params.district = filters.district;
    if (filters.min_price) params.min_price = filters.min_price;
    if (filters.max_price) params.max_price = filters.max_price;
    if (filters.min_area) params.min_area = filters.min_area;
    if (filters.max_area) params.max_area = filters.max_area;
    if (filters.dormitorios > 0) params.dormitorios = filters.dormitorios;
    if (sort) params.sort = sort;
    Api.listListingsPaged(params)
      .then(r => {
        setData(Array.isArray(r.data) ? r.data : []);
        setTotal(r.total || 0);
        setPage(p);
        setLoading(false);
      })
      .catch(ex => {
        const msg = handleApiErr(ex, { setErr, onAuthExpired });
        if (typeof onError === 'function') onError(msg);
        setLoading(false);
      });
  };

  useE(() => { load(0); }, []);
  // Reordenar, cambiar operación o filtros vuelve a la página 0.
  useE(() => { if (data) load(0); }, [sort, operacion]);
  useE(() => {                                       
    Api.distritosZona().then(r => setDistritos(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);
  useE(() => {                                       
    Api.favorites()
      .then(r => setFavIds(new Set((Array.isArray(r) ? r : []).map(l => l.id))))
      .catch(() => {});
  }, []);

  
  const onToggleFav = (id, next) => {
    setFavIds(prev => {
      const s = new Set(prev);
      if (next) s.add(id); else s.delete(id);
      return s;
    });
    const req = next ? Api.addFavorite(id) : Api.removeFavorite(id);
    req.catch(ex => {
      setFavIds(prev => {                            
        const s = new Set(prev);
        if (next) s.delete(id); else s.add(id);
        return s;
      });
      const msg = handleApiErr(ex, { setErr, onAuthExpired });
      if (typeof onError === 'function') onError(msg);
    });
  };

  const set = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));
  const distOptions = [{ value: '', label: 'Todos los distritos' }]
    .concat(distritos.map(d => ({ value: d.distrito, label: d.distrito })));

  if (loading && !data) return <Loading label="Cargando inmuebles…"/>;

  return (
    <div className="container fade-in">
      <PageHeader
        title="Explorar inmuebles"
        subtitle="Avisos publicados con el veredicto de precio de Wasi"/>

      <div className="banner info" style={{marginBottom:14, display:'flex', alignItems:'flex-start', gap:9}}>
        <Icon name="info" size={15}/>
        <span className="small">
          El veredicto de cada aviso lo calcula el <strong>modelo de Wasi</strong> al publicarse.
          Abre <strong>Analizar precio</strong> para estimar cualquier inmueble tú mismo.
        </span>
      </div>

      <div className="seg" role="tablist" aria-label="Tipo de operación"
        style={{display:'inline-flex', gap:4, padding:4, background:'var(--surface-2)', borderRadius:12, marginBottom:14}}>
        {[['alquiler','Alquiler'],['venta','Venta']].map(([op,lbl])=>(
          <button key={op} type="button" role="tab" aria-selected={operacion===op}
            onClick={()=>setOperacion(op)}
            style={{padding:'7px 18px', borderRadius:9, border:'none', cursor:'pointer',
              fontSize:13.5, fontWeight:700, fontFamily:'inherit',
              background: operacion===op ? 'var(--primary)' : 'transparent',
              color: operacion===op ? '#fff' : 'var(--ink-2)'}}>
            {lbl}
          </button>
        ))}
      </div>

      <Card className="compact" style={{marginBottom:16}}>
        <div className="row" style={{gap:14, alignItems:'flex-end', flexWrap:'wrap'}}>
          <div style={{flex:'1 1 200px', minWidth:160}}>
            <Select label="Distrito" options={distOptions} value={filters.district}
              onChange={(v)=>set('district', v)}/>
          </div>
          <div style={{flex:'1 1 180px', minWidth:160}}>
            <Select label="Ordenar por" value={sort} onChange={setSort} options={[
              { value: '', label: 'Más recientes' },
              { value: 'ganga', label: 'Mejores gangas' },
              { value: 'precio_asc', label: 'Precio: menor a mayor' },
              { value: 'precio_desc', label: 'Precio: mayor a menor' },
            ]}/>
          </div>
          <div style={{flex:'0 0 auto'}}>
            <Stepper label="Dormitorios (mín.)" value={filters.dormitorios}
              set={(v)=>set('dormitorios', v)} min={0} max={10}/>
          </div>
          <div style={{flex:'1 1 130px', minWidth:120}}>
            <Input label="Precio mínimo" inputMode="numeric" suffix="USD" placeholder="0"
              value={filters.min_price}
              onChange={(e)=>set('min_price', e.target.value.replace(/[^0-9]/g,''))}/>
          </div>
          <div style={{flex:'1 1 130px', minWidth:120}}>
            <Input label="Precio máximo" inputMode="numeric" suffix="USD" placeholder="5000"
              value={filters.max_price}
              onChange={(e)=>set('max_price', e.target.value.replace(/[^0-9]/g,''))}/>
          </div>
          <div style={{flex:'1 1 120px', minWidth:110}}>
            <Input label="Área mínima" inputMode="numeric" suffix="m²" placeholder="0"
              value={filters.min_area}
              onChange={(e)=>set('min_area', e.target.value.replace(/[^0-9]/g,''))}/>
          </div>
          <div style={{flex:'1 1 120px', minWidth:110}}>
            <Input label="Área máxima" inputMode="numeric" suffix="m²" placeholder="300"
              value={filters.max_area}
              onChange={(e)=>set('max_area', e.target.value.replace(/[^0-9]/g,''))}/>
          </div>
          <div style={{flex:'0 0 auto'}}>
            <Btn variant="primary" onClick={()=>load(0)} disabled={loading}>
              <Icon name="eye" size={14}/> Aplicar filtros
            </Btn>
          </div>
        </div>
      </Card>

      {err && (
        <div className="banner danger" style={{marginBottom:14}}>
          <Icon name="alert" size={14}/> {err}
        </div>
      )}

      <div className="row" style={{justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:8}}>
        <span className="small muted">
          {total} {total === 1 ? 'inmueble' : 'inmuebles'} en {operacion}
          {total > PAGE_SIZE && <> · página {page + 1} de {Math.ceil(total / PAGE_SIZE)}</>}
        </span>
      </div>

      {!loading && data && data.length === 0 ? (
        <Card style={{textAlign:'center', padding:'48px 24px'}}>
          <div style={{fontFamily:'Space Grotesk', fontSize:19, fontWeight:700}}>
            No hay inmuebles con estos filtros
          </div>
          <p className="small muted" style={{marginTop:6}}>
            Prueba con otro distrito, rango de precio, o cambia entre alquiler y venta.
          </p>
        </Card>
      ) : (
        <ListingsSplitMap listings={data || []} onOpen={onOpenListing}
          favIds={favIds} onToggleFav={onToggleFav}/>
      )}

      {total > PAGE_SIZE && (
        <div className="row" style={{justifyContent:'center', gap:12, marginTop:18}}>
          <Btn variant="outline" disabled={page === 0 || loading} onClick={()=>load(page - 1)}>
            <Icon name="back" size={14}/> Anterior
          </Btn>
          <span className="small muted" style={{alignSelf:'center'}}>
            {page + 1} / {Math.ceil(total / PAGE_SIZE)}
          </span>
          <Btn variant="outline" disabled={(page + 1) * PAGE_SIZE >= total || loading} onClick={()=>load(page + 1)}>
            Siguiente <Icon name="fwd" size={14}/>
          </Btn>
        </div>
      )}
    </div>
  );
};

const ListingDetailScreen = ({ listingId, role, onBack, onAnalyze, onError, onAuthExpired }) => {
  const isSeller = role === 'Propietario' || role === 'Agente inmobiliario';
  const [data, setData] = useS(null);
  const [loading, setLoading] = useS(true);
  const [err, setErr] = useS('');
  const [contactOpen, setContactOpen] = useS(false);
  
  const [cf, setCf] = useS(null);
  const [cfLoading, setCfLoading] = useS(false);
  const [cfError, setCfError] = useS(false);
  
  
  
  const [tab, setTab] = useS('inmueble');
  
  
  useE(() => { setTab('inmueble'); }, [listingId]);

  useE(() => {
    if (!listingId) { setErr('No hay inmueble seleccionado.'); setLoading(false); return; }
    let cancel = false;
    setLoading(true); setErr('');
    Api.getListing(listingId)
      .then(r => { if (!cancel) { setData(r); setLoading(false); } })
      .catch(ex => {
        if (cancel) return;
        const msg = handleApiErr(ex, { setErr, onAuthExpired });
        if (typeof onError === 'function') onError(msg);
        setLoading(false);
      });
    return () => { cancel = true; };
  }, [listingId]);

  
  
  
  useE(() => {
    if (!data || typeof data.lat !== 'number' || typeof data.lng !== 'number') return;
    let cancel = false;
    setCf(null); setCfError(false); setCfLoading(true);
    Api.counterfactual({
      lat: data.lat, lng: data.lng, area: data.area_m2,
      dormitorios: data.dormitorios, banos: data.banos, cocheras: data.cocheras,
      antiguedad_anios: data.antiguedad_anios, es_estudio: data.es_estudio,
      amenities: data.amenities || [],
    })
      .then(r => { if (!cancel) { setCf(r); setCfLoading(false); } })
      .catch(() => { if (!cancel) { setCfError(true); setCfLoading(false); } });
    return () => { cancel = true; };
  }, [data]);

  if (loading) return <Loading label="Cargando inmueble…"/>;
  if (err || !data) return (
    <div className="container fade-in">
      <PageHeader title="Inmueble" subtitle="Detalle del aviso" onBack={onBack}/>
      <Card style={{textAlign:'center', padding:'52px 24px'}}>
        <div style={{width:60, height:60, borderRadius:16, margin:'0 auto 18px',
                     display:'flex', alignItems:'center', justifyContent:'center',
                     background:'var(--danger-soft)', color:'var(--danger)'}}>
          <Icon name="alert" size={26}/>
        </div>
        <div style={{fontFamily:'Space Grotesk', fontSize:21, fontWeight:700}}>No se pudo cargar el inmueble</div>
        <p className="small muted" style={{maxWidth:400, margin:'8px auto 0', lineHeight:1.6}}>
          {err || 'Ocurrió un error inesperado al traer los datos.'}
        </p>
        <Btn variant="primary" style={{marginTop:22}} onClick={onBack}>
          <Icon name="back" size={15}/> Volver a explorar
        </Btn>
      </Card>
    </div>
  );

  const z = data.zone;
  const unit = data.operacion === 'venta' ? 'total' : '/mes';
  const unitLong = data.operacion === 'venta' ? 'USD total' : 'USD por mes';
  const detailImg = (typeof safeImageUrl === 'function' && safeImageUrl(data.image_url))
    || (typeof apartmentPhoto === 'function' && data.id != null ? apartmentPhoto(data.id) : null);
  const amenities = Array.isArray(data.amenities) ? data.amenities : [];
  const amenityLabel = (k) => {
    const found = AMENIDADES.find(a => a.key === k);
    return found ? found.label : k;
  };

  return (
    <div className="container fade-in">
      <PageHeader
        title={data.address}
        subtitle={data.district}
        onBack={onBack}
        actions={
          <Btn variant="primary" size="sm" onClick={()=>setContactOpen(true)}>
            <Icon name="mail" size={14}/> Contactar
          </Btn>
        }
      />

      {}
      <div className="row" style={{gap:8, marginBottom:18, flexWrap:'wrap'}}>
        {[['inmueble','Inmueble','home'], ['fairvalue','Analizar precio','chart'], ['entorno','Entorno','pin']].map(([k, label, icon]) => (
          <Btn key={k} variant={tab===k ? 'primary' : 'outline'} size="sm"
            onClick={()=>setTab(k)} aria-pressed={tab===k}>
            <Icon name={icon} size={14}/> {label}
          </Btn>
        ))}
      </div>

      {tab === 'inmueble' && (
        <div className="result-grid">
          {detailImg && (
            <img src={detailImg} alt={`Foto de ${data.address}`} loading="lazy"
              onError={(e)=>{ e.target.style.display='none'; }}
              style={{gridColumn:'1 / -1', width:'100%', maxHeight:340, objectFit:'cover',
                borderRadius:14, border:'1px solid var(--line)', marginBottom:4}}/>
          )}
          <Card>
            <div className="row" style={{justifyContent:'space-between', alignItems:'flex-start'}}>
              <div>
                <div className="numeric" style={{fontFamily:'Space Grotesk', fontWeight:700, fontSize:32}}>
                  ${Math.round(data.price_usd).toLocaleString('en-US')}
                  <span style={{fontSize:14, color:'var(--ink-3)', fontWeight:500}}> {unit}</span>
                </div>
                <div className="small muted" style={{marginTop:2}}>{unitLong}</div>
              </div>
              {z && <Tag variant={ZONE_VARIANT[z] || 'default'}>{z}</Tag>}
            </div>

            {typeof data.lat === 'number' && typeof data.lng === 'number' && (
              <div style={{marginTop:16}}>
                <MapPicker lat={data.lat} lng={data.lng} onMove={()=>{}} showRadius/>
              </div>
            )}
          </Card>

          <div className="stack-20" style={{display:'flex', flexDirection:'column', gap:20}}>
            <Card>
              <div className="section-h">Características</div>
              <div className="summary-rows">
                <div className="srow"><span className="k">Distribución</span>
                  <span className="v">
                    {data.es_estudio
                      ? `Estudio · ${data.banos} ${data.banos===1?'baño':'baños'}`
                      : `${data.dormitorios} dorm · ${data.banos} ${data.banos===1?'baño':'baños'}`}
                  </span></div>
                <div className="srow"><span className="k">Área</span>
                  <span className="v">{Math.round(data.area_m2)} m²</span></div>
                <div className="srow"><span className="k">Cocheras</span>
                  <span className="v">{data.cocheras}</span></div>
                <div className="srow"><span className="k">Antigüedad</span>
                  <span className="v">{data.antiguedad_anios} {data.antiguedad_anios===1?'año':'años'}</span></div>
              </div>
              {amenities.length > 0 && (
                <>
                  <div className="section-h" style={{marginTop:16}}>Amenities</div>
                  <div className="row" style={{flexWrap:'wrap', gap:8}}>
                    {amenities.map(a => (
                      <span key={a} className="pick-chip on" style={{cursor:'default'}}>{amenityLabel(a)}</span>
                    ))}
                  </div>
                </>
              )}
            </Card>

            {data.description && (
              <Card>
                <div className="section-h">Descripción</div>
                <p className="small" style={{lineHeight:1.6, color:'var(--ink-2)'}}>{data.description}</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'fairvalue' && (
        <div className="stack-20" style={{display:'flex', flexDirection:'column', gap:20}}>
          <Card>
            <div className="section-h">Analiza este precio</div>
            <p className="small muted" style={{lineHeight:1.6, marginTop:4}}>
              Corre el modelo de Wasi con las características de este inmueble
              para ver si el precio anunciado está sobre o bajo el mercado.
            </p>
            <Btn variant="primary" style={{marginTop:14}}
              onClick={()=> onAnalyze && onAnalyze({
                lat: data.lat, lng: data.lng, area: data.area_m2,
                dormitorios: data.dormitorios, banos: data.banos,
                cocheras: data.cocheras, antiguedad_anios: data.antiguedad_anios,
                es_estudio: data.es_estudio, amenities: data.amenities,
                precio: data.price_usd,
                from_catalog: true,   
              })}>
              <Icon name="chart" size={14}/> Analizar este precio
            </Btn>
          </Card>

          <CounterfactualPanel cf={cf} loading={cfLoading} error={cfError} isSeller={isSeller}/>

          {}
          {(typeof data.lat === 'number' && typeof data.lng === 'number') && (
            <WhatIfSimulator
              baseForm={{ lat: data.lat, lng: data.lng, area: data.area_m2,
                          dormitorios: data.dormitorios, banos: data.banos,
                          cocheras: data.cocheras || 0,
                          antiguedad_anios: data.antiguedad_anios || 0,
                          es_estudio: !!data.es_estudio, amenities: data.amenities || [],
                          precio: data.price_usd }}
              onAuthExpired={onAuthExpired}/>
          )}
        </div>
      )}

      {tab === 'entorno' && (
        (typeof data.lat === 'number' && typeof data.lng === 'number') ? (
          <EntornoMapScreen
            embedded
            lat={data.lat}
            lng={data.lng}
            onError={onError}
            onAuthExpired={onAuthExpired}
          />
        ) : (
          <Card style={{textAlign:'center', padding:'40px 24px'}}>
            <div className="small muted">Este inmueble no tiene coordenadas para mostrar el entorno.</div>
          </Card>
        )
      )}

      <ContactModal open={contactOpen} onClose={()=>setContactOpen(false)}
        listingId={listingId} onError={onError} onAuthExpired={onAuthExpired}/>
    </div>
  );
};


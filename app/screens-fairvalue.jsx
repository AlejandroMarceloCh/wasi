/* Wasi — Fair Value: wizard, resultado alquiler/venta, Entorno.
   Scripts clásicos con scope global compartido: los aliases useS/useE/useR
   se declaran en screens-core y el orden de carga lo fija index.html. */
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

const FairValueForm = ({ role, prefill, onBack, onSubmit, onError, onAuthExpired }) => {
  const isSeller = role === 'Propietario' || role === 'Agente inmobiliario';
  // Operación: 'alquiler' (default = comportamiento actual, INTACTO) | 'venta'.
  // En venta el modelo v1 ignora amenities/es_estudio y el precio es total en USD.
  const [operacion, setOperacion] = useS('alquiler');
  const isVenta = operacion === 'venta';
  const [step, setStep] = useS(1);
  const [submitting, setSubmitting] = useS(false);
  const [err, setErr] = useS('');
  // "Analizar este precio" pre-carga las características del inmueble abierto;
  // sin prefill el form arranca con los defaults.
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
  // Cap del precio según operación: alquiler = USD/mes; venta = USD total.
  const PRECIO_MIN = isVenta ? 10000 : 50;
  const PRECIO_MAX = isVenta ? 5000000 : 50000;
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
      const unidad = isVenta ? 'USD' : 'USD/mes';
      setErr(`Ingresa un precio ${isVenta ? 'de venta' : 'anunciado'} entre $${PRECIO_MIN.toLocaleString('en-US')} y $${PRECIO_MAX.toLocaleString('en-US')} ${unidad}.`);
      return;
    }
    const precio = precioNum;
    setErr(''); setSubmitting(true);
    try {
      if (isVenta) {
        // Modelo de venta v1: SIN amenities ni es_estudio. Devuelve el resultado
        // directo (no hay analysis_id), por lo que se pasa el data a la pantalla.
        const res = await Api.predictVenta({
          lat: f.lat, lng: f.lng, area: areaNum,
          dormitorios: f.dormitorios, banos: f.banos, cocheras: f.cocheras,
          antiguedad_anios: f.antiguedad_anios, precio,
        });
        onSubmit && onSubmit(null, { lat: f.lat, lng: f.lng }, { operacion: 'venta', ventaData: res });
        return;
      }
      // Alquiler — flujo original INTACTO.
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

      {/* Toggle Operación: Alquiler (default) | Venta. Al cambiar se limpia el
          precio porque los rangos de alquiler (USD/mes) y venta (USD total) son
          disjuntos. Solo se ofrece en el paso 1 para no cambiar el modelo a
          mitad del flujo. */}
      {step === 1 && (
        <div className="row" style={{gap:8, marginBottom:16}}>
          <span className="small muted" style={{marginRight:4}}>Operación:</span>
          <Btn
            variant={operacion === 'alquiler' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => { if (operacion !== 'alquiler') { setOperacion('alquiler'); setF(p => ({...p, precio: ''})); setErr(''); } }}
            aria-pressed={operacion === 'alquiler'}
          >Alquiler</Btn>
          <Btn
            variant={operacion === 'venta' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => { if (operacion !== 'venta') { setOperacion('venta'); setF(p => ({...p, precio: ''})); setErr(''); } }}
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
            Arrastra el pin (o haz click) en la ubicación exacta del departamento.
          </p>
          <MapPicker lat={f.lat} lng={f.lng}
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
                dormitorios: v ? 0 : p.dormitorios,
                banos: v ? p.banos : Math.max(1, p.banos),
              }))}/>
          )}
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
          {/* Columna izquierda: input de precio grande tipo editorial */}
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

          {/* Columna derecha: resumen del depto en tabla limpia */}
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

/* Renderiza el informe LLM: líneas tipo **Título** se vuelven encabezados de
   sección; el resto, párrafos con **negritas** inline. Sin librería markdown. */
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
      // Resto: limpia asteriscos sueltos (** sin cerrar, viñetas *) para no
      // mostrar ruido markdown en una UI utility.
      return m ? <b key={j}>{m[1]}</b> : <span key={j}>{seg.replace(/\*/g, '')}</span>;
    });
    out.push(
      <p key={out.length} style={{margin:'0 0 8px', fontSize:13.5, lineHeight:1.65, color:'var(--ink)'}}>{parts}</p>
    );
  });
  return out;
};

/* ============== 5b. VENTA RESULT (modelo de venta v1) ==============
   Resultado del modelo de compra/venta. Reusa el gauge, las cards y el
   veredicto de alquiler, pero en USD TOTAL (sin "/mes"). El modelo v1 NO
   devuelve analysis_id, SHAP, intervalo P25-P75 ni narrativa LLM: esas
   secciones se omiten con un aviso discreto, no se muestran vacías. */
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
  // Banda de referencia directa del backend (fair ± MAPE, ya calculada).
  const bandMin = data.min;
  const bandMax = data.max;
  // Confianza derivada de cobertura: el modelo de venta no devuelve `confidence`,
  // así que la inferimos de n_comparables para el aviso honesto (mismo umbral
  // conceptual que alquiler: pocos comparables → tómalo como referencia).
  const pocosComparables = (data.n_comparables || 0) < 27;

  // Posicionamiento del vendedor (Conservador/Competitivo/Agresivo) vs la banda.
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
        <div className="banner warning" style={{marginBottom:14}}>
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

          {/* Banda de referencia (min–max) */}
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

          {/* Aviso discreto: el análisis profundo es solo para alquiler en v1. */}
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

/* ============== 5. FAIR VALUE RESULT ============== */
const FairValueResult = ({ analysisId, ventaData, role, onBack, onContext, onError, onAuthExpired }) => {
  // Venta v1: el modelo no devuelve analysis_id, llega el data directo desde el
  // form. Delegamos a un componente propio ANTES de cualquier hook, dejando el
  // path de alquiler (debajo) idéntico. La rama es estable por render (depende
  // de la pantalla, no de eventos), así que no rompe las reglas de hooks.
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
  // Explicación SHAP (TreeSHAP real del modelo). Carga en paralelo al análisis.
  const [explain, setExplain] = useS(null);
  const [explainFailed, setExplainFailed] = useS(false);
  // Narrativa LLM (Groq/Llama). Carga después del explain; falla silenciosamente.
  const [narrative, setNarrative] = useS(null);
  const [narrativeLoading, setNarrativeLoading] = useS(false);
  // Análisis completo (modal). Fetch lazy: solo al abrir, una vez.
  const [detailOpen, setDetailOpen] = useS(false);
  const [detail, setDetail] = useS(null);
  const [detailLoading, setDetailLoading] = useS(false);
  const [detailErr, setDetailErr] = useS('');
  // Id del análisis vigente: descarta respuestas de detalle de un análisis previo.
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
    setNarrative(null);
    setDetail(null);
    setDetailErr('');
    setDetailLoading(false);
    setDetailOpen(false);
    Api.getAnalysis(analysisId)
      .then(r => { if (!cancel) { setData(r); setLoading(false); } })
      .catch(ex => {
        if (cancel) return;
        const msg = handleApiErr(ex, { setErr, onAuthExpired });
        if (typeof onError === 'function') onError(msg);
        setLoading(false);
      });
    // SHAP — si falla (ej. modelo v1), el panel muestra "no disponible".
    setExplainFailed(false);
    Api.explain(analysisId)
      .then(r => { if (!cancel) setExplain(r); })
      .catch(() => { if (!cancel) setExplainFailed(true); });
    // Narrativa LLM — falla silenciosamente si GROQ_API_KEY no está configurado.
    setNarrativeLoading(true);
    Api.narrative(analysisId, narrativeMode)
      .then(r => { if (!cancel) { setNarrative(r); setNarrativeLoading(false); } })
      .catch(() => { if (!cancel) setNarrativeLoading(false); });
    return () => { cancel = true; };
  }, [analysisId]);

  // Abre el modal y dispara el fetch del detalle una sola vez. Tras un error NO
  // se re-dispara al reabrir (el guard corta por detailErr); solo el botón
  // "Reintentar" pasa retry=true. Descarta respuestas de un análisis ya cambiado.
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

  // Confidence gating: la banda heurística [min, max] (= fair ± MAPE) se
  // ensancha cuando hay pocos comparables. Usa data.confidence (single source
  // of truth, ya calibrada por backtest LOO en el backend). El prediction_interval
  // P25-P75 NO se toca: ese viene del modelo de cuantiles y mentir sobre él sería
  // deshonesto.
  const CONF_WIDEN = { Alta: 1.0, Media: 1.3, Baja: 1.8 };
  const wf = CONF_WIDEN[data.confidence] || 1.0;
  const effMaePct = (data.mae_pct || 0) * wf;
  const bandMin = wf > 1 ? Math.round(fair - fair * effMaePct / 100) : data.min;
  const bandMax = wf > 1 ? Math.round(fair + fair * effMaePct / 100) : data.max;
  const lowConf = data.confidence === 'Baja' || data.confidence === 'Media';

  // Posicionamiento del vendedor: su precio tentativo vs la banda de referencia
  // [min, max] (= fair ± MAPE, ensanchada según confianza). No es veredicto
  // Ganga/Inflado: es estrategia.
  const sellerPos = (anuncio == null) ? null
    : anuncio < bandMin ? 'Conservador'
    : anuncio > bandMax ? 'Agresivo'
    : 'Competitivo';
  const SELLER_POS_COPY = {
    Conservador: 'Por debajo del mercado: rentarás rápido, pero dejas margen sobre la mesa.',
    Competitivo: 'Alineado al mercado: buen equilibrio entre margen y rapidez de colocación.',
    Agresivo: 'Por encima del mercado: más margen por mes, pero puede tardar en colocarse.',
  };
  // Una sola fuente de color por estado: Card, Tag y gauge quedan consistentes.
  const POS_VARIANT = { Conservador: 'accent', Competitivo: 'success', Agresivo: 'warning' };
  const sellerPosTag = sellerPos ? POS_VARIANT[sellerPos] : 'accent';
  // Escala de la barra de posicionamiento: la banda + el precio del vendedor, con aire.
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
          <div style={{marginTop:18}}>
            <GaugeChart fairValue={fair} diffPct={pct} zone={zona} seller={isSeller} sellerPos={sellerPos}/>
          </div>

          {/* Rango P25-P75 del modelo de cuantiles (Sprint 3.1). Solo cuando
              el modelo tiene quantile cargado (v2 + xgb_q*_v2.joblib). */}
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
          {isSeller ? (
            /* Vista vendedor (Roberto): posicionamiento, no veredicto Ganga/Inflado. */
            <Card accent={sellerPos ? POS_VARIANT[sellerPos] : 'success'}>
              <div className="row" style={{justifyContent:'space-between'}}>
                <div className="section-h" style={{margin:0}}>Tu posicionamiento</div>
                {sellerPos && <Tag variant={sellerPosTag}>{sellerPos}</Tag>}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:14}}>
                <div>
                  <div className="small muted">Tu precio en mente</div>
                  <div className="numeric" style={{fontSize:28, fontWeight:700}}>${anuncio}</div>
                  <div className="tiny muted" style={{marginTop:2}}>USD / mes</div>
                </div>
                <div>
                  <div className="small muted">Precio sugerido</div>
                  <div className="numeric" style={{fontSize:28, fontWeight:700, color:'var(--primary)'}}>${fair}</div>
                  <div className="tiny muted" style={{marginTop:2}}>USD / mes</div>
                </div>
              </div>
              {/* Barra de posicionamiento: banda sugerida (verde) + marcador del precio */}
              <div style={{marginTop:18}}>
                <div style={{position:'relative', height:8, background:'var(--bg-tint)', borderRadius:4}}>
                  <div style={{position:'absolute', left:`${barPct(bandMin)}%`, width:`${barPct(bandMax)-barPct(bandMin)}%`, top:0, bottom:0, background:'var(--success-soft)', borderRadius:4}}/>
                  <div style={{position:'absolute', left:`${barPct(fair)}%`, top:-3, width:2, height:14, background:'var(--primary)', transform:'translateX(-50%)'}} title="Precio sugerido"/>
                  <div style={{position:'absolute', left:`${barPct(anuncio)}%`, top:-5, width:3, height:18, background:'var(--ink)', borderRadius:2, transform:'translateX(-50%)'}} title="Tu precio"/>
                </div>
                <div className="tiny muted" style={{marginTop:6}}>
                  Rango sugerido ${Math.round(bandMin)}–${Math.round(bandMax)}/mes · la barra negra es tu precio, la azul el sugerido
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
                    {diff >= 0 ? '+' : '−'}${Math.abs(diff).toLocaleString('en-US')} <span className="pct">({pct}%)</span>
                  </div>
                </div>
                <Tag variant={isInflado ? 'danger' : isGanga ? 'success' : 'warning'}>
                  {isInflado ? 'Negociable' : isGanga ? 'Oportunidad' : 'Precio alineado'}
                </Tag>
              </div>
            </Card>
          )}

          <PoiInsightCard/>

          <Card>
            <div className="row" style={{justifyContent:'space-between'}}>
              <div className="section-h" style={{margin:0}}>{isSeller ? 'Qué hace valioso tu inmueble' : 'Qué explica este precio'}</div>
              <Tag variant="accent">SHAP · Modelo Wasi v2</Tag>
            </div>

            {/* Narrativa LLM */}
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
              const grupos = (explain.groups || []).filter(g => Math.abs(g.pct_effect) >= 0.1);
              const maxAbs = grupos.reduce((m, g) => Math.max(m, Math.abs(g.contribution_log)), 0.0001);
              return (
                <>
                  {/* Precio base del modelo */}
                  <div className="row" style={{justifyContent:'space-between', marginTop:12, paddingBottom:10, borderBottom:'1px dashed var(--line)'}}>
                    <span className="small muted">Precio base del modelo</span>
                    <b className="numeric">${Math.round(explain.base_price)}</b>
                  </div>

                  {/* Waterfall por grupo */}
                  <div style={{marginTop:12, display:'flex', flexDirection:'column', gap:12}}>
                    {grupos.map((g, i) => {
                      const w = Math.max(4, Math.round(Math.abs(g.contribution_log) / maxAbs * 100));
                      const col = g.positive ? 'var(--success)' : 'var(--danger)';
                      return (
                        <div key={i} title={g.description}>
                          <div className="row" style={{justifyContent:'space-between', marginBottom:5}}>
                            <span className="small" style={{fontWeight:600}}>{g.label}</span>
                            <b className="numeric" style={{color:col, fontSize:13}}>
                              {g.positive ? '+' : '−'}{Math.abs(g.pct_effect).toFixed(1)}%
                            </b>
                          </div>
                          {/* Barra centrada: positivos a la derecha, negativos a la izquierda */}
                          <div style={{display:'flex', alignItems:'center', height:8}}>
                            <div style={{flex:1, display:'flex', justifyContent:'flex-end'}}>
                              {!g.positive && <div style={{height:8, width:`${w}%`, background:col, borderRadius:'4px 0 0 4px', opacity:.85, transition:'width .3s'}}/>}
                            </div>
                            <div style={{width:1, height:12, background:'var(--ink-3)', opacity:.4}}/>
                            <div style={{flex:1}}>
                              {g.positive && <div style={{height:8, width:`${w}%`, background:col, borderRadius:'0 4px 4px 0', opacity:.85, transition:'width .3s'}}/>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Precio estimado */}
                  <div className="row" style={{justifyContent:'space-between', marginTop:14, paddingTop:10, borderTop:'1px solid var(--line)'}}>
                    <span className="small" style={{fontWeight:700}}>Precio estimado</span>
                    <b className="numeric" style={{fontSize:16, color:'var(--primary)'}}>${Math.round(explain.predicted_price)}</b>
                  </div>

                  <p style={{margin:'12px 0 0', fontSize:12, color:'var(--ink-3)', lineHeight:1.55}}>
                    Cada barra es la contribución real del modelo (TreeSHAP) a <i>esta</i> predicción.
                    Los efectos son <b>multiplicativos</b> sobre el precio base, no se suman entre sí.
                  </p>
                </>
              );
            })()}
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

      <div className="row" style={{marginTop:24, justifyContent:'flex-end'}}>
        <Btn variant="primary" size="lg" onClick={onContext}>
          <Icon name="shield" size={16}/> Ver contexto del barrio
        </Btn>
      </div>

      {/* Modal: análisis completo generado por IA sobre todo el espectro del modelo */}
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
            {/* Tira de métricas clave */}
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

            {/* Informe LLM estructurado */}
            <div>{renderNarrative(detail.narrative)}</div>

            {/* Entorno nombrado con tier */}
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
              Texto generado por IA (Llama 3.3) a partir de la descomposición TreeSHAP del modelo,
              el veredicto y los POIs reales del entorno. Los porcentajes son multiplicativos.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};


/* ============== 6. ENTORNO (mapa + pin en vivo) ============== */
/* Color por categoría de POI — compartido entre los puntos del mapa y los chips. */
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

const EntornoMapScreen = ({ lat, lng, onBack, onError, onAuthExpired, embedded = false }) => {
  const start = (typeof lat === 'number' && typeof lng === 'number')
    ? { lat, lng } : { lat: -12.121, lng: -77.030 };
  const [pin, setPin] = useS(start);
  const [data, setData] = useS(null);
  const [loading, setLoading] = useS(true);
  const [err, setErr] = useS('');
  const [panelOpen, setPanelOpen] = useS(true);
  // POIs pintados en el mapa: ON por defecto (el anillo + POIs explican el producto).
  const [showPois, setShowPois] = useS(true);
  const [hiddenCats, setHiddenCats] = useS(() => new Set());
  const [poiLayers, setPoiLayers] = useS([]);
  // Geocoding search
  const [searchQ, setSearchQ] = useS('');
  const [searchLoading, setSearchLoading] = useS(false);
  const [flyTo, setFlyTo] = useS(null);
  const [suggestions, setSuggestions] = useS([]);
  const [sugOpen, setSugOpen] = useS(false);

  // Photon (komoot) — mejor typeahead que Nominatim para POIs. bbox filtra Lima Metropolitana.
  const PHOTON_URL = (q, limit) =>
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit}&bbox=-77.2,-12.3,-76.7,-11.8`;

  const resolveAlias = (q) =>
    (window.LIMA_ALIASES && window.LIMA_ALIASES[q.toLowerCase().trim()]) || q;

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

  // Autocomplete: llama Photon con debounce mientras el usuario escribe.
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

  // POIs del mapa: solo se piden cuando el switch está prendido (y al mover el pin).
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

  // Puntos a pintar: aplanados, filtrados por las categorías visibles, coloreados.
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
      {/* Mapa protagonista. En modo standalone ocupa toda la pantalla; embebido
          (dentro del detalle de un inmueble) vive contenido en su pestaña.
          showRadius dibuja el anillo de 1 km que el modelo cruza. */}
      <MapPicker lat={start.lat} lng={start.lng} className="map-full" pois={mapPois}
        onMove={(la, lo)=>setPin({ lat: la, lng: lo })} flyTo={flyTo} showRadius/>

      {/* Barra flotante: volver + título + búsqueda por dirección.
          El botón Volver solo aparece standalone: embebido, las pestañas del
          detalle ya gobiernan la navegación. */}
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
                <button key={i} className="efm-sug-item" onMouseDown={() => handleSelectSuggestion(s)}>
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

      {/* Chip de coordenadas (abajo-izquierda) */}
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

      {/* Panel flotante de métricas (derecha), colapsable */}
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
              </>
            )}
          </Card>

        </div>
      </div>
      )}
    </div>
  );
};


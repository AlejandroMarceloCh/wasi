/* Wasi — vendedor: publicar, mis propiedades, leads, guardados + exports.
   Scripts clásicos con scope global compartido: los aliases useS/useE/useR
   se declaran en screens-core y el orden de carga lo fija index.html. */
const PublishScreen = ({ role, prefill, onBack, onPublished, onError, onAuthExpired }) => {
  const isSeller = role === 'Propietario' || role === 'Agente inmobiliario';
  const [submitting, setSubmitting] = useS(false);
  const [calculating, setCalculating] = useS(false);
  // El usuario ya escribió su propio precio → no lo pisamos con el sugerido (P-04).
  const [priceUserTyped, setPriceUserTyped] = useS(
    !!(prefill && prefill.price_usd != null));
  // Destino del buscador de dirección → MapPicker vuela el pin (S4).
  const [flyTo, setFlyTo] = useS(null);
  const [fairRef, setFairRef] = useS(prefill && prefill.fair_value ? prefill.fair_value : null);
  const [err, setErr] = useS('');
  const [distritos, setDistritos] = useS([]);
  // Contrafactuales del simulador: se cargan junto al precio sugerido. Solo se
  // muestran tras calcular (fairRef != null). Reusa CounterfactualPanel.
  const [cf, setCf] = useS(null);
  const [cfLoading, setCfLoading] = useS(false);
  const [cfError, setCfError] = useS(false);
  // Vista previa del aviso antes de publicar (FR-14): reusa ListingCard tal cual
  // se verá en el catálogo, para que el propietario valide antes de lanzar.
  const [previewOpen, setPreviewOpen] = useS(false);
  const [f, setF] = useS({
    district: (prefill && prefill.district) || '',
    address: '',
    lat: (prefill && prefill.lat) || -12.121,
    lng: (prefill && prefill.lng) || -77.030,
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
  });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const toggleAmenity = (k) => setF(prev => ({
    ...prev,
    amenities: prev.amenities.includes(k)
      ? prev.amenities.filter(x => x !== k)
      : [...prev.amenities, k],
  }));

  useE(() => {
    Api.distritosZona().then(r => setDistritos(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const pinOk = enLima(f.lat, f.lng);
  const areaNum = Number(f.area);
  const areaOk = f.area && areaNum >= 10 && areaNum <= 1000;
  const PRECIO_MIN = 50, PRECIO_MAX = 50000;
  const priceNum = Number(f.price_usd);
  const priceOk = f.price_usd && priceNum >= PRECIO_MIN && priceNum <= PRECIO_MAX;
  const distOptions = distritos.map(d => ({ value: d.distrito, label: d.distrito }));
  const formOk = pinOk && areaOk && priceOk
    && f.district.trim().length >= 2 && f.address.trim().length >= 3
    && f.contact_name.trim().length >= 2 && f.contact_phone.trim().length >= 6
    && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.contact_email.trim());

  // Lista legible de lo que falta para publicar — alimenta el aviso del submit
  // (P-03): antes el botón quedaba mudo y el usuario no sabía qué corregir.
  const camposFaltantes = () => {
    const m = [];
    if (!pinOk) m.push('ubica el pin dentro de Lima');
    if (f.district.trim().length < 2) m.push('Distrito');
    if (f.address.trim().length < 3) m.push('Dirección');
    if (!areaOk) m.push('Área (10–1000 m²)');
    if (!priceOk) m.push(`Precio ($${PRECIO_MIN}–$${PRECIO_MAX.toLocaleString('en-US')}/mes)`);
    if (f.contact_name.trim().length < 2) m.push('Nombre de contacto');
    if (f.contact_phone.trim().length < 6) m.push('Teléfono (mín. 6 dígitos)');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.contact_email.trim())) m.push('Correo válido');
    return m;
  };

  // Reusa el contrato congelado: precio gt=0 obligatorio aunque el usuario aún
  // no fije el precio publicado, por eso el fallback a 1.
  const calcular = async () => {
    if (!areaOk || !pinOk || calculating) return;
    setErr(''); setCalculating(true);
    try {
      const res = await Api.predict({
        lat: f.lat, lng: f.lng, area: areaNum,
        dormitorios: f.dormitorios, banos: f.banos, cocheras: f.cocheras,
        antiguedad_anios: f.antiguedad_anios, es_estudio: f.es_estudio,
        amenities: f.amenities, precio: priceNum || 1,
      });
      const fv = res.fair_value;
      setFairRef(fv);
      // Solo pre-rellena si el usuario aún no escribió su propio precio (P-04):
      // si ya puso uno, se respeta y la referencia se muestra aparte en el Tag.
      if (fv != null && !priceUserTyped) set('price_usd', String(Math.round(fv)));
      // Simulador de palancas: mismo form SIN `precio` (re-serving del modelo
      // congelado). Error silencioso: el panel maneja su propio estado.
      setCf(null); setCfError(false); setCfLoading(true);
      Api.counterfactual({
        lat: f.lat, lng: f.lng, area: areaNum,
        dormitorios: f.dormitorios, banos: f.banos, cocheras: f.cocheras,
        antiguedad_anios: f.antiguedad_anios, es_estudio: f.es_estudio,
        amenities: f.amenities,
      })
        .then(r => { setCf(r); setCfLoading(false); })
        .catch(() => { setCfError(true); setCfLoading(false); });
    } catch (ex) {
      const msg = handleApiErr(ex, { setErr, onAuthExpired });
      if (typeof onError === 'function') onError(msg);
    } finally {
      setCalculating(false);
    }
  };

  const submit = async () => {
    if (submitting) return;
    // P-03: en vez de no hacer nada, decir qué falta.
    if (!formOk) {
      const faltan = camposFaltantes();
      setErr('Para publicar, completa: ' + faltan.join(' · '));
      return;
    }
    setErr(''); setSubmitting(true);
    try {
      const listing = await Api.createListing({
        district: f.district.trim(), address: f.address.trim(),
        lat: f.lat, lng: f.lng, area_m2: areaNum,
        dormitorios: f.dormitorios, banos: f.banos, cocheras: f.cocheras,
        antiguedad_anios: f.antiguedad_anios, es_estudio: f.es_estudio,
        price_usd: priceNum,
        fair_value_ref: fairRef != null ? fairRef : null,
        description: f.description.trim(),
        image_url: f.image_url.trim() || null,
        amenities: f.amenities,
        contact_name: f.contact_name.trim(),
        contact_phone: f.contact_phone.trim(),
        contact_email: f.contact_email.trim(),
      });
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
        subtitle="Crea el aviso de tu inmueble en alquiler" onBack={onBack}/>

      <Card className="wizard-card">
        <div className="section-h">1 · Ubicación</div>
        <p className="small muted" style={{marginTop:-4, marginBottom:12}}>
          Busca la dirección o arrastra el pin en la ubicación exacta del inmueble.
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
        <div className="grid-2" style={{gap:14, marginTop:14}}>
          {distOptions.length > 0
            ? <Select label="Distrito" options={[{value:'',label:'Selecciona un distrito'}].concat(distOptions)}
                value={f.district} onChange={(v)=>set('district', v)}/>
            : <Input label="Distrito" placeholder="Miraflores" value={f.district}
                onChange={(e)=>set('district', e.target.value)}/>}
          <Input label="Dirección" placeholder="Av. Larco 345" value={f.address}
            onChange={(e)=>set('address', e.target.value)}/>
        </div>
      </Card>

      <Card className="wizard-card" style={{marginTop:16}}>
        <div className="section-h">2 · Características</div>
        <ToggleRow label="Es un estudio (monoambiente)" checked={f.es_estudio}
          onChange={(v)=>setF(p=>({
            ...p, es_estudio:v,
            dormitorios: v ? 0 : Math.max(1, p.dormitorios),   // no-estudio nunca 0 dorm (P-07)
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
            El área debe estar entre 10 y 1000 m².
          </div>
        )}
        <div className="field" style={{marginTop:16}}>
          <label>Descripción (opcional)</label>
          <div className="input-wrap">
            <textarea rows={3} placeholder="Departamento luminoso a pasos del parque…"
              value={f.description} onChange={(e)=>set('description', e.target.value)}/>
          </div>
        </div>
        <div style={{marginTop:14}}>
          <div>
            <Input label="Foto del inmueble (URL, opcional)" placeholder="https://…/foto.jpg"
              value={f.image_url} onChange={(e)=>set('image_url', e.target.value)}/>
            <p className="tiny muted" style={{marginTop:4}}>
              Pega el enlace de una imagen (clic derecho → “Copiar dirección de la imagen”).
              La subida de fotos desde el dispositivo llegará pronto.
            </p>
          </div>
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
              Referencia del modelo: ${Math.round(fairRef).toLocaleString('en-US')} /mes
            </Tag>
          )}
        </div>
        <div className="big-price" style={{marginTop:14}}>
          <span className="big-price-prefix">$</span>
          <input className="big-price-input" value={f.price_usd} inputMode="numeric"
            placeholder="900" aria-label="Precio publicado en USD por mes"
            onChange={(e)=>{ setPriceUserTyped(true); set('price_usd', e.target.value.replace(/[^0-9]/g,'')); }}/>
          <span className="big-price-suffix"><span className="sl">/</span> mes</span>
        </div>
        <div className="big-price-foot">
          <span className="muted">USD por mes</span>
          <span className="muted">Rango aceptado: ${PRECIO_MIN}–${PRECIO_MAX.toLocaleString('en-US')}</span>
        </div>
        {f.price_usd && !priceOk && (
          <div className="small" style={{color:'var(--danger)', marginTop:10}}>
            El precio debe estar entre ${PRECIO_MIN} y ${PRECIO_MAX.toLocaleString('en-US')} USD/mes.
          </div>
        )}
      </Card>

      {/* Simulador de precio — palancas para subir el precio sugerido. Solo
          aparece tras calcular el precio (fairRef != null). Reusa el componente
          y el copy de vendedor de ListingDetailScreen. */}
      {fairRef != null && (
        <div style={{marginTop:16}}>
          <CounterfactualPanel cf={cf} loading={cfLoading} error={cfError} isSeller/>
        </div>
      )}

      <Card className="wizard-card" style={{marginTop:16}}>
        <div className="section-h">4 · Contacto</div>
        <div className="grid-2" style={{gap:14, marginTop:6}}>
          <Input label="Nombre de contacto" placeholder="Roberto Pérez" value={f.contact_name}
            onChange={(e)=>set('contact_name', e.target.value)}/>
          <Input label="Teléfono" placeholder="+51 999 888 777" inputMode="tel" value={f.contact_phone}
            onChange={(e)=>set('contact_phone', e.target.value)}/>
          <Input label="Correo" placeholder="roberto@correo.com" inputMode="email" value={f.contact_email}
            onChange={(e)=>set('contact_email', e.target.value)}/>
        </div>
        {err && (
          <div className="banner danger" style={{marginTop:14}}>
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
            <Btn variant="primary" size="lg" onClick={submit} disabled={submitting}>
              <Icon name="check" size={16}/> Publicar inmueble
            </Btn>
          </div>
        </div>
      </Card>

      {/* FR-14: vista previa del aviso tal como se verá en el catálogo. */}
      <Modal open={previewOpen} onClose={()=>setPreviewOpen(false)}
        title="Vista previa del aviso"
        subtitle="Así se verá tu publicación en el catálogo. Cierra para seguir editando.">
        <div style={{maxWidth:320, margin:'0 auto'}}>
          <ListingCard listing={{
            id: 0,
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

/* ===== MyListingsScreen (propietario/agente) — cierra el flywheel =====
   Lista los inmuebles del usuario (Api.myListings) y, por cada uno, las
   consultas (leads) recibidas (Api.listLeads). Solo tiene sentido para sellers.
   Reusa el patrón de fetch del resto de pantallas: handleApiErr + onAuthExpired,
   estados loading/error/empty independientes por sección. */

// Formatea un created_at ISO a fecha legible en es-PE. Tolera valores inválidos.
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

// Tarjeta de un inmueble con sus leads. Carga los leads de forma diferida (lazy)
// la primera vez que se expande, para no disparar N peticiones de golpe.
const MyListingRow = ({ listing, onOpenListing, onDeleted, onError, onAuthExpired }) => {
  const [open, setOpen] = useS(false);
  const [leads, setLeads] = useS(null);
  const [loading, setLoading] = useS(false);
  const [err, setErr] = useS('');
  const [loaded, setLoaded] = useS(false);
  const [deleting, setDeleting] = useS(false);

  // Borrar publicación (P-14). confirm nativo: el cascade del backend limpia
  // leads/favoritos. Tras borrar, el padre recarga la lista vía onDeleted.
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
            {listing.district} · <b>${price}</b> /mes
            {count != null && (
              <> · {count} {count === 1 ? 'consulta' : 'consultas'}</>
            )}
          </div>
        </div>
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

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
            {!loading && !err && leads && leads.length > 0 && onOpenListing && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenListing(listing.id); }}
                style={{ padding: 0, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                Ver inmueble <Icon name="fwd" size={13} stroke="var(--primary)"/>
              </button>
            )}
            <button
              type="button"
              onClick={del}
              disabled={deleting}
              style={{ marginLeft: 'auto', padding: 0, background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13, fontWeight: 600, cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Icon name="alert" size={13} stroke="var(--danger)"/> {deleting ? 'Borrando…' : 'Borrar'}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};

const MyListingsScreen = ({ onBack, onOpenListing, onPublish, onError, onAuthExpired }) => {
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
              onError={onError}
              onAuthExpired={onAuthExpired}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ===== LeadsScreen (vendedor) — bandeja unificada de TODAS las consultas
   recibidas a través de todos los inmuebles del usuario. Reúne myListings +
   listLeads por inmueble y los aplana en un inbox cronológico (más reciente
   primero). Complementa a "Mis propiedades" (que muestra leads anidados por
   inmueble): aquí se ve el flujo completo de demanda de un vistazo. Mismo patrón
   de fetch del resto de pantallas. */
const LeadsScreen = ({ onOpenListing, onGo, onError, onAuthExpired }) => {
  const [items, setItems] = useS(null);   // [{ lead, listing }]
  const [loading, setLoading] = useS(true);
  const [err, setErr] = useS('');

  const load = () => {
    setLoading(true); setErr('');
    Api.myListings()
      .then((listings) => {
        const arr = Array.isArray(listings) ? listings : [];
        if (arr.length === 0) return [];
        // Un fetch de leads por inmueble, en paralelo. Un fallo individual no
        // tumba la bandeja: ese inmueble simplemente aporta 0 consultas.
        return Promise.all(arr.map((l) =>
          Api.listLeads(l.id)
            .then((leads) => (Array.isArray(leads) ? leads : []).map((lead) => ({ lead, listing: l })))
            .catch(() => [])
        )).then((groups) => groups.flat());
      })
      .then((flat) => {
        // ts() normaliza fecha ausente o inválida a 0 → esos leads caen al final
        // del orden descendente (más reciente primero), sin ambigüedad.
        const ts = (v) => {
          if (!v) return 0;
          const t = new Date(v).getTime();
          return isNaN(t) ? 0 : t;
        };
        flat.sort((a, b) => ts(b.lead.created_at) - ts(a.lead.created_at));
        setItems(flat);
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

/* ===== SavedScreen (Guardados) — inmuebles que el usuario marcó con el corazón.
   Lista Api.favorites() en un grid de ListingCard. El corazón sigue activo y al
   quitarlo se remueve la card de inmediato (optimista). Mismo patrón de fetch
   que el resto de pantallas. */
const SavedScreen = ({ onOpenListing, onGo, onError, onAuthExpired }) => {
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

  // En Guardados, todas las cards están guardadas. Quitar = DELETE + remover de
  // la lista local de inmediato; si la API falla, se restaura la card.
  const onToggleFav = (id /*, next siempre false aquí */) => {
    const prev = data;
    setData(d => (d || []).filter(l => l.id !== id));
    Api.removeFavorite(id).catch(ex => {
      setData(prev);                                 // restaurar si falla
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

Object.assign(window, {
  SplashScreen, AuthScreen, HomeScreen, DashboardScreen,
  FairValueForm, FairValueResult, VentaResult,
  EntornoMapScreen,
  ListingsScreen, ListingDetailScreen, PublishScreen, ContactModal,
  MyListingsScreen, MyListingRow, LeadsScreen,
  ProfileScreen, SavedScreen, Loading,
});

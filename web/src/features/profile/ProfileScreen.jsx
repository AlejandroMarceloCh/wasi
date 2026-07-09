import { useEffect as useE, useState as useS } from 'react';
import { Api } from '../../shared/api/client.js';
import { handleApiErr, onKeyActivate } from '../../shared/lib/helpers.js';
import { WASI_STATS } from '../../shared/lib/stats.js';
import { Btn, Card, Icon, Input, Modal, PageHeader, Select, Tag, ToggleRow } from '../../shared/ui/components.jsx';

const PROFILE_ROLES = ['Inquilino', 'Propietario', 'Agente inmobiliario'];

const PROFILE_FAQS = [
  { q: '¿Cómo calcula Wasi el precio de referencia?',
    a: `Un modelo entrenado con ${WASI_STATS.ALQ_AVISOS} avisos reales de alquiler en Lima estima el precio de mercado según ubicación, área, dormitorios y entorno. El error medio es ${WASI_STATS.ALQ_MAPE}% medido con una validación que separa por zonas (un inmueble nunca se evalúa con vecinos de su propio edificio en el entrenamiento); con una división aleatoria daba ${WASI_STATS.ALQ_MAPE_RANDOM}%, pero ese número está inflado por esa cercanía.` },
  { q: '¿Qué significan "Inflado", "Justo" y "Ganga"?',
    a: 'Comparamos el precio anunciado contra el precio de referencia estimado. Muy por encima es "Inflado", cerca del estimado es "Justo", y por debajo es "Ganga".' },
  { q: '¿De dónde salen los datos de seguridad?',
    a: 'El score de entorno usa denuncias reales de la PNP/INEI agregadas por distrito y la densidad de puntos de interés (colegios, hospitales, bancos) en un radio de 1 km.' },
  { q: '¿Puedo confiar en zonas con cobertura "Baja"?',
    a: 'En distritos con pocos avisos el modelo tiene menos comparables y la confianza de la predicción baja. Revisa el indicador de confianza que aparece en cada análisis.' },
  { q: '¿La estimación puede quedar debajo de avisos premium recientes?',
    a: `Puede pasar. Auditamos la calibración por distrito y el sesgo mediano está dentro de ±2% en las zonas premium: el modelo es fiel a los ${WASI_STATS.ALQ_AVISOS} avisos con los que se entrenó, pero el stock premium más nuevo está subrepresentado en esa muestra. La siguiente versión de datos prioriza justamente ese segmento.` },
];

export const ProfileScreen = ({ onLogout, onError, onOpenAnalysis, onMyListings, onSaved, onUserChanged, onAuthExpired }) => {
  
  const cached = Api.getUser() || {};
  const [me, setMe] = useS(null);
  const [err, setErr] = useS('');
  const [modal, setModal] = useS(null);          

  
  const [form, setForm] = useS({ name: '', role: 'Inquilino' });
  const [saving, setSaving] = useS(false);
  const [formErr, setFormErr] = useS('');

  
  const [prefs, setPrefs] = useS(() => ({
    notif:   localStorage.getItem('wasi.pref.notif')   !== '0',
    gangas:  localStorage.getItem('wasi.pref.gangas')  !== '0',
    resumen: localStorage.getItem('wasi.pref.resumen') === '1',
  }));
  const setPref = (k, v) => {
    setPrefs(p => ({ ...p, [k]: v }));
    localStorage.setItem('wasi.pref.' + k, v ? '1' : '0');
  };

  const [faqOpen, setFaqOpen] = useS(-1);

  useE(() => {
    let cancel = false;
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
  const isSeller = role === 'Propietario' || role === 'Agente inmobiliario';
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
      .then(r => { setMe(r); setModal(null); if (typeof onUserChanged === 'function') onUserChanged(); })
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
              {onSaved && (
                <div className="menu-row" role="button" tabIndex={0} aria-label="Inmuebles guardados" onClick={onSaved} onKeyDown={onKeyActivate(onSaved)}>
                  <Icon name="heart" size={18} stroke="var(--ink-2)"/> Guardados
                  <Icon name="fwd" size={14} stroke="var(--ink-3)" className="arr"/>
                </div>
              )}
              {isSeller && onMyListings && (
                <div className="menu-row" role="button" tabIndex={0} aria-label="Mis propiedades y consultas" onClick={onMyListings} onKeyDown={onKeyActivate(onMyListings)}>
                  <Icon name="home" size={18} stroke="var(--ink-2)"/> Mis propiedades
                  <Icon name="fwd" size={14} stroke="var(--ink-3)" className="arr"/>
                </div>
              )}
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

      {}
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

      {}
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

      {}
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
            <div style={{fontSize:13, fontWeight:600}}>soporte@wasi.pe</div>
            <div className="tiny muted">Te respondemos en 24-48 h</div>
          </div>
        </div>
        <div className="tiny muted text-center" style={{marginTop:14}}>Wasi · versión 2.0.0</div>
      </Modal>

      {}
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

      {}
      <Modal
        open={modal === 'plans'}
        onClose={()=>setModal(null)}
        icon={<Icon name="sparkle" size={20}/>}
        title="Planes Wasi"
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
            <span>Ya tienes el plan Pro activo. ¡Gracias por apoyar a Wasi!</span>
          </div>
        )}
      </Modal>
    </div>
  );
};

/* Wasi — pantallas publicas: Splash + Auth.
   Scripts clásicos con scope global compartido: los aliases useS/useE/useR
   se declaran en screens-core y el orden de carga lo fija index.html. */
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
            Wasi estima el valor de mercado de cualquier departamento en Lima usando modelos de IA, y lo cruza con el contexto de seguridad y servicios del barrio. Para inquilinos, propietarios, agentes e inversionistas.
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
                <div className="t">Analizar precio</div>
                <div className="d">Precio de referencia · error medio {WASI_STATS.ALQ_MAPE}%</div>
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
  const [form, setForm] = useS({ email:'ana@wasi.pe', password:'demo1234', name:'', role:'Inquilino' });
  const [submitting, setSubmitting] = useS(false);
  const [err, setErr] = useS('');

  const onSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSubmitting(true); setErr('');
    try {
      if (mode === 'login') await Api.login({ email: form.email, password: form.password });
      else await Api.register({ email: form.email, name: form.name, password: form.password, role: form.role });
      // isNew=true tras registro → aterriza en la pantalla accionable según rol
      // (onboarding FR-09), no en el landing de marketing.
      onAuth(mode === 'register');
    } catch (ex) {
      const msg = (ex && ex.message) || 'Error al autenticar';
      setErr(msg);   // el banner local del form ya muestra el error
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
            Wasi cruza miles de listings, índices de criminalidad y POIs para darte una sola lectura: el precio de referencia de la zona y si vale la pena el barrio.
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
          <span>● Modelo Wasi v2</span>
          <span>● {WASI_STATS.ALQ_AVISOS} avisos Lima</span>
          <span>● Error medio {WASI_STATS.ALQ_MAPE}%</span>
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
            <button type="button" className={mode==='login' ? 'active':''} onClick={()=>setMode('login')}>Iniciar sesión</button>
            <button type="button" className={mode==='register' ? 'active':''} onClick={()=>setMode('register')}>Crear cuenta</button>
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
                options={['Inquilino','Propietario','Agente inmobiliario']}
              />
            )}
            {err && <div className="field-err banner danger"><Icon name="alert" size={14}/> {err}</div>}
            <Btn variant="primary" block size="lg" type="submit" disabled={submitting} onClick={onSubmit}>
              {submitting ? 'Procesando…' : (mode==='login' ? 'Iniciar sesión' : 'Crear cuenta')}
            </Btn>
            <div style={{textAlign:'center', fontSize: 13, color:'var(--ink-3)', padding:'4px'}}>
              {mode==='login' ? '¿Nuevo en Wasi? ' : '¿Ya tienes cuenta? '}
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


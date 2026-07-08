import { useEffect as useE, useState as useS } from 'react';
import { Api } from '../../shared/api/client.js';
import { WASI_STATS } from '../../shared/lib/stats.js';
import { Btn, Icon, Input, Logo, Select } from '../../shared/ui/components.jsx';

export const AuthScreen = ({ onAuth, initialMode = 'login' }) => {
  const [mode, setMode] = useS(initialMode);
  useE(() => setMode(initialMode), [initialMode]);

  const [form, setForm] = useS({ email:'', password:'', name:'', role:'Inquilino' });
  const [submitting, setSubmitting] = useS(false);
  const [err, setErr] = useS('');

  const onSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSubmitting(true); setErr('');
    try {
      if (mode === 'login') await Api.login({ email: form.email, password: form.password });
      else await Api.register({ email: form.email, name: form.name, password: form.password, role: form.role });

      onAuth(mode === 'register');
    } catch (ex) {
      const msg = (ex && ex.message) || 'Error al autenticar';
      setErr(msg);
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
            {err && (
              <div className="field-err banner danger" role="alert" aria-live="assertive">
                <Icon name="alert" size={14}/> {err}
              </div>
            )}
            <Btn variant="primary" block size="lg" type="submit" disabled={submitting}>
              {submitting ? 'Procesando…' : (mode==='login' ? 'Iniciar sesión' : 'Crear cuenta')}
            </Btn>
            <div style={{textAlign:'center', fontSize: 13, color:'var(--ink-3)', padding:'4px'}}>
              {mode==='login' ? '¿Nuevo en Wasi? ' : '¿Ya tienes cuenta? '}
              <button type="button" className="linklike"
                style={{color:'var(--primary)', fontWeight:600, cursor:'pointer', background:'none', border:'none', padding:0, font:'inherit'}}
                onClick={()=>setMode(mode==='login' ? 'register' : 'login')}>
                {mode==='login' ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

import { WASI_STATS } from '../../shared/lib/stats.js';
import { Btn, Card, GaugeChart, Icon, Tag } from '../../shared/ui/components.jsx';

export const SplashScreen = ({ onStart, onLogin }) => (
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

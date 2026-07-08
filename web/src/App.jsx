import { useEffect, useState } from 'react';
import { Api } from './shared/api/client.js';
import { Btn, Card, Icon, Modal, Tag } from './shared/ui/components.jsx';

function App() {
  const [modalOpen, setModalOpen] = useState(false);
  const [apiState, setApiState] = useState({ status: 'loading', count: 0, message: 'Consultando distritos...' });

  useEffect(() => {
    let alive = true;
    Api.distritosZona()
      .then((rows) => {
        if (!alive) return;
        setApiState({
          status: 'ok',
          count: Array.isArray(rows) ? rows.length : 0,
          message: 'API conectada',
        });
      })
      .catch((err) => {
        if (!alive) return;
        setApiState({
          status: 'error',
          count: 0,
          message: err?.message || 'No se pudo conectar al backend',
        });
      });
    return () => { alive = false; };
  }, []);

  return (
    <div className="app-shell" data-screen-label="Wasi · Vite">
      <main>
        <section className="container" style={{ paddingTop: 48, paddingBottom: 48 }}>
          <div className="stack-16" style={{ maxWidth: 820 }}>
            <div className="logo">
              <div className="logo-mark lg">
                <Icon name="home" size={24} stroke="#fff" />
              </div>
              <span style={{ fontSize: 30, color: 'var(--ink)' }}>Wasi</span>
            </div>

            <Card style={{ padding: 24 }}>
              <Tag variant="primary" style={{ marginBottom: 16 }}>Sprint V1</Tag>
              <h1 style={{ marginTop: 0 }}>Capa shared migrada</h1>
              <p className="lede">
                Vite ya renderiza primitivas compartidas y usa el cliente API modular contra el backend real.
              </p>
              <div className="grid-2" style={{ marginTop: 20 }}>
                <Card className="compact" style={{ padding: 16 }}>
                  <div className="tiny muted">API base</div>
                  <div className="numeric" style={{ fontWeight: 700 }}>{Api.BASE}</div>
                </Card>
                <Card className="compact" style={{ padding: 16 }}>
                  <div className="tiny muted">Distritos zona</div>
                  <div style={{ fontWeight: 700 }}>
                    {apiState.status === 'ok' ? `${apiState.count} cargados` : apiState.message}
                  </div>
                </Card>
              </div>
              <div className="row" style={{ marginTop: 20 }}>
                <Btn variant="primary" onClick={() => setModalOpen(true)}>
                  Probar modal <Icon name="arrow" size={16} />
                </Btn>
                <Btn variant="outline" onClick={() => Api.clearSession()}>
                  Probar botón
                </Btn>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        icon={<Icon name="check" size={20} />}
        title="Modal compartido"
        subtitle="Renderizado desde shared/ui/components.jsx"
        footer={<Btn variant="primary" onClick={() => setModalOpen(false)}>Cerrar</Btn>}
      >
        <p className="small muted" style={{ margin: 0 }}>
          Este modal valida portal, foco, botones e iconos dentro de Vite.
        </p>
      </Modal>
    </div>
  );
}

export default App;

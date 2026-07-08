import { resolveApiBase } from './shared/api/base.js';

function App() {
  const apiBase = resolveApiBase();

  return (
    <div className="app-shell" data-screen-label="Wasi · Vite">
      <main>
        <section className="container" style={{ paddingTop: 48, paddingBottom: 48 }}>
          <div className="stack-16" style={{ maxWidth: 760 }}>
            <div className="logo">
              <div className="logo-mark lg">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 20V10l8-6 8 6v10" />
                  <circle cx="15" cy="14" r="2.2" fill="currentColor" />
                  <path d="M15 16.2v2.8" stroke="white" strokeWidth="1.4" />
                </svg>
              </div>
              <span style={{ fontSize: 30, color: 'var(--ink)' }}>Wasi</span>
            </div>

            <div className="card" style={{ padding: 24 }}>
              <div className="tag tag-primary" style={{ marginBottom: 16 }}>
                Sprint V0
              </div>
              <h1 style={{ marginTop: 0 }}>Frontend Vite en construcción</h1>
              <p className="lede">
                Este nuevo frontend vive en <code>web/</code>. La app anterior en <code>app/</code> sigue intacta hasta el cutover.
              </p>
              <div className="grid-2" style={{ marginTop: 20 }}>
                <div className="card compact" style={{ padding: 16 }}>
                  <div className="tiny muted">API local configurada</div>
                  <div className="numeric" style={{ fontWeight: 700 }}>{apiBase}</div>
                </div>
                <div className="card compact" style={{ padding: 16 }}>
                  <div className="tiny muted">Estado</div>
                  <div style={{ fontWeight: 700 }}>Vite renderizando</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

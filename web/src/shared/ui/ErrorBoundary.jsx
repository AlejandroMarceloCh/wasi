import React from 'react';

/* Atrapa cualquier excepción de render en el árbol. Sin esto, un error en una
   pantalla dejaba la app en blanco total (sin mensaje ni recuperación). */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Log para diagnóstico; no rompe la UI de recuperación.
    console.error('ErrorBoundary atrapó:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
        textAlign: 'center', fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 22, fontWeight: 700 }}>
          Algo salió mal
        </div>
        <p style={{ color: '#64748b', maxWidth: 420, lineHeight: 1.6, margin: 0 }}>
          Ocurrió un error inesperado en la aplicación. Recarga la página para
          continuar; si el problema persiste, vuelve a intentarlo en un momento.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 14,
          }}>
          Recargar
        </button>
      </div>
    );
  }
}

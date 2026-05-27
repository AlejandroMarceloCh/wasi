/* Justa — App router (web app) */
const { useState: uS } = React;

const TAB_TO_SCREEN = {
  home: 'home',
  operaciones: 'operaciones',
  fairvalue: 'fairvalue-form',
  entorno: 'entorno-map',
  profile: 'profile',
};
const SCREEN_TO_TAB = (s) => {
  if (s === 'home') return 'home';
  if (s === 'operaciones') return 'operaciones';
  if (s.startsWith('fairvalue')) return 'fairvalue';
  if (s.startsWith('entorno')) return 'entorno';
  if (s === 'profile') return 'profile';
  return null;
};

const PUBLIC_SCREENS = new Set(['splash', 'auth-login', 'auth-register']);

/* Banner de error global — se cierra al click */
const ErrorBanner = ({ msg, onClose }) => {
  if (!msg) return null;
  return (
    <div
      onClick={onClose}
      className="banner danger"
      style={{
        position:'fixed', top:70, left:'50%', transform:'translateX(-50%)',
        zIndex:9999, cursor:'pointer', maxWidth:560, boxShadow:'0 8px 24px rgba(0,0,0,.15)'
      }}
      title="Click para cerrar"
    >
      <span>⚠ {msg}</span>
    </div>
  );
};

function App() {
  const [screen, setScreen] = uS(window.Api && window.Api.isAuthed() ? 'home' : 'splash');
  const [currentAnalysisId, setCurrentAnalysisId] = uS(null);
  // contexto geográfico (lat/lng del último análisis) para la pantalla Entorno
  const [geoCtx, setGeoCtx] = uS({ lat: null, lng: null });
  const [errorMsg, setErrorMsg] = uS('');

  const go = (s) => setScreen(s);

  // FairValueForm dispara esto cuando ya tiene analysis_id
  const onSubmitForm = (analysisId, ctx) => {
    if (analysisId) setCurrentAnalysisId(analysisId);
    if (ctx) setGeoCtx({ lat: ctx.lat ?? null, lng: ctx.lng ?? null });
    setScreen('fairvalue-result');
  };

  const onOpenAnalysis = (id, ctx) => {
    setCurrentAnalysisId(id);
    if (ctx) setGeoCtx({ lat: ctx.lat ?? null, lng: ctx.lng ?? null });
    setScreen('fairvalue-result');
  };

  const onLogout = () => {
    try { window.Api && window.Api.logout(); } catch (_) {}
    setCurrentAnalysisId(null);
    setGeoCtx({ lat: null, lng: null });
    setScreen('splash');
  };

  const onTopNavNav = (key) => {
    if (key === 'login') return setScreen('auth-login');
    if (key === 'signup') return setScreen('auth-register');
    const target = TAB_TO_SCREEN[key];
    if (target) setScreen(target);
  };

  const isPublic = PUBLIC_SCREENS.has(screen);
  const activeTab = SCREEN_TO_TAB(screen);

  return (
    <div className="app-shell" data-screen-label={`ubIcA · ${screen}`}>
      <ErrorBanner msg={errorMsg} onClose={() => setErrorMsg('')}/>
      <TopNav
        active={activeTab}
        onNavigate={onTopNavNav}
        onLogo={() => setScreen(isPublic ? 'splash' : 'home')}
        user={(window.Api && window.Api.getUser()) || { name: 'Ana' }}
        isPublic={isPublic}
      />
      <main className={(screen === 'splash' || screen.startsWith('auth')) ? 'no-pad' : ''}>
        {screen === 'splash' && (
          <SplashScreen onStart={() => setScreen('auth-register')} onLogin={() => setScreen('auth-login')}/>
        )}
        {(screen === 'auth-login' || screen === 'auth-register') && (
          <AuthScreen
            initialMode={screen === 'auth-login' ? 'login' : 'register'}
            onAuth={() => setScreen('home')}
            onError={setErrorMsg}
          />
        )}
        {screen === 'home' && <HomeScreen onGo={go}/>}
        {screen === 'operaciones' && (
          <DashboardScreen
            onGo={go}
            onOpenAnalysis={onOpenAnalysis}
            onError={setErrorMsg}
            onAuthExpired={onLogout}
          />
        )}
        {screen === 'fairvalue-form' && (
          <FairValueForm
            onBack={() => setScreen('operaciones')}
            onSubmit={onSubmitForm}
            onError={setErrorMsg}
            onAuthExpired={onLogout}
          />
        )}
        {screen === 'fairvalue-result' && (
          <FairValueResult
            analysisId={currentAnalysisId}
            onBack={() => setScreen('fairvalue-form')}
            onContext={() => setScreen('entorno-map')}
            onError={setErrorMsg}
            onAuthExpired={onLogout}
          />
        )}
        {screen === 'entorno-map' && (
          <EntornoMapScreen
            lat={geoCtx.lat}
            lng={geoCtx.lng}
            onBack={() => setScreen('operaciones')}
            onError={setErrorMsg}
            onAuthExpired={onLogout}
          />
        )}
        {screen === 'profile' && (
          <ProfileScreen
            onLogout={onLogout}
            onError={setErrorMsg}
            onOpenAnalysis={onOpenAnalysis}
            onAuthExpired={onLogout}
          />
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);

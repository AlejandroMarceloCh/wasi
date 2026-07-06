
const { useState: uS } = React;

const TAB_TO_SCREEN = {
  inicio: 'home',
  explorar: 'listings',
  guardados: 'saved',
  'mis-propiedades': 'mis-publicaciones',
  leads: 'leads',
  fairvalue: 'fairvalue-form',
  profile: 'profile',
};
const SCREEN_TO_TAB = (s) => {
  if (s === 'home') return 'inicio';
  if (s.startsWith('fairvalue')) return 'fairvalue';
  if (s.startsWith('listing')) return 'explorar';   
  if (s === 'saved') return 'guardados';
  if (s === 'mis-publicaciones') return 'mis-propiedades';
  if (s === 'leads') return 'leads';
  if (s === 'profile') return 'profile';
  
  
  return null;
};

const PUBLIC_SCREENS = new Set(['splash', 'auth-login', 'auth-register']);

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

const computeRoleHome = (isNew) => {
  if (!isNew) return 'home';
  const u = (window.Api && window.Api.getUser()) || {};
  const seller = u.role === 'Propietario' || u.role === 'Agente inmobiliario';
  return seller ? 'mis-publicaciones' : 'listings';
};

function App() {
  const [screen, setScreen] = uS(window.Api && window.Api.isAuthed() ? computeRoleHome() : 'splash');
  const [currentAnalysisId, setCurrentAnalysisId] = uS(null);
  
  
  const [ventaResult, setVentaResult] = uS(null);
  
  const [geoCtx, setGeoCtx] = uS({ lat: null, lng: null });
  const [errorMsg, setErrorMsg] = uS('');
  // Pantalla a la que vuelve el mapa de Entorno según de dónde se abrió
  // (desde el home no hay análisis previo, así que volver a fairvalue-result
  // caía en "no hay análisis").
  const [entornoReturn, setEntornoReturn] = uS(null);

  const [currentListingId, setCurrentListingId] = uS(null);
  const [publishPrefill, setPublishPrefill] = uS(null);


  const [fvPrefill, setFvPrefill] = uS(null);
  const [userVersion, setUserVersion] = uS(0);

  const go = (s) => {
    if (s === 'entorno-map') setEntornoReturn(screen);
    setScreen(s);
  };

  
  
  
  
  
  
  const [fvLive, setFvLive] = uS(null);
  const [fvForm, setFvForm] = uS(null);

  const onSubmitForm = (analysisId, ctx, extra) => {
    if (extra && extra.operacion === 'venta') {
      setVentaResult(extra.ventaData || null);
      setCurrentAnalysisId(null);
      setFvLive(null);
      setFvForm(null);
    } else {
      setVentaResult(null);
      setFvLive((extra && extra.predictData) || null);
      setFvForm((extra && extra.form) || null);
      if (analysisId) setCurrentAnalysisId(analysisId);
    }
    if (ctx) setGeoCtx({ lat: ctx.lat ?? null, lng: ctx.lng ?? null });
    setScreen('fairvalue-result');
  };

  const onOpenAnalysis = (id, ctx) => {
    setVentaResult(null);
    setFvLive(null);
    setFvForm(null);
    setCurrentAnalysisId(id);
    if (ctx) setGeoCtx({ lat: ctx.lat ?? null, lng: ctx.lng ?? null });
    setScreen('fairvalue-result');
  };

  
  
  const [detailReturn, setDetailReturn] = uS(null);
  const onOpenListing = (id) => {
    setDetailReturn(screen === 'listing-detail' ? detailReturn : screen);
    setCurrentListingId(id);
    setScreen('listing-detail');
  };

  const onPublish = (prefill) => {
    setPublishPrefill(prefill || null);
    setScreen('publish');
  };

  const onLogout = () => {
    try { window.Api && window.Api.logout(); } catch (_) {}
    setCurrentAnalysisId(null);
    setVentaResult(null);
    setGeoCtx({ lat: null, lng: null });
    setCurrentListingId(null);
    setPublishPrefill(null);
    setScreen('splash');
  };

  const onTopNavNav = (key) => {
    if (key === 'login') return setScreen('auth-login');
    if (key === 'signup') return setScreen('auth-register');
    if (key === 'fairvalue') setFvPrefill(null); 
    const target = TAB_TO_SCREEN[key];
    if (target) setScreen(target);
  };

  const isPublic = PUBLIC_SCREENS.has(screen);
  const activeTab = SCREEN_TO_TAB(screen);

  // userVersion (declarado arriba) fuerza re-leer el usuario cuando el perfil
  // cambia (p. ej. el rol), para que la navegación del TopNav se actualice al
  // instante en vez de quedar stale hasta la siguiente interacción.
  void userVersion;
  const currentUser = (window.Api && window.Api.getUser()) || { name: 'Ana' };
  const userRole = currentUser.role || 'Inquilino';
  const isSeller = userRole === 'Propietario' || userRole === 'Agente inmobiliario';
  
  
  
  const roleHome = isSeller ? 'mis-publicaciones' : 'listings';

  return (
    <div className="app-shell" data-screen-label={`Wasi · ${screen}`}>
      <ErrorBanner msg={errorMsg} onClose={() => setErrorMsg('')}/>
      <TopNav
        active={activeTab}
        onNavigate={onTopNavNav}
        onLogo={() => setScreen(isPublic ? 'splash' : roleHome)}
        user={currentUser}
        isPublic={isPublic}
      />
      <main className={(screen === 'splash' || screen.startsWith('auth')) ? 'no-pad' : ''}>
        {screen === 'splash' && (
          <SplashScreen onStart={() => setScreen('auth-register')} onLogin={() => setScreen('auth-login')}/>
        )}
        {(screen === 'auth-login' || screen === 'auth-register') && (
          <AuthScreen
            initialMode={screen === 'auth-login' ? 'login' : 'register'}
            onAuth={(isNew) => setScreen(computeRoleHome(isNew))}
            onError={setErrorMsg}
          />
        )}
        {screen === 'home' && <HomeScreen role={userRole} onGo={go} onOpenListing={onOpenListing} onPublish={() => onPublish(null)} user={currentUser}/>}
        {screen === 'operaciones' && (
          <DashboardScreen
            role={userRole}
            onGo={go}
            onOpenAnalysis={onOpenAnalysis}
            onPublish={() => onPublish(null)}
            onError={setErrorMsg}
            onAuthExpired={onLogout}
          />
        )}
        {screen === 'fairvalue-form' && (
          <FairValueForm
            role={userRole}
            prefill={fvPrefill}
            onBack={() => setScreen(roleHome)}
            onSubmit={onSubmitForm}
            onError={setErrorMsg}
            onAuthExpired={onLogout}
          />
        )}
        {screen === 'fairvalue-result' && (
          <FairValueResult
            analysisId={currentAnalysisId}
            ventaData={ventaResult}
            liveData={fvLive}
            simForm={fvForm}
            role={userRole}
            onBack={() => setScreen('fairvalue-form')}
            onContext={() => { setEntornoReturn('fairvalue-result'); setScreen('entorno-map'); }}
            onError={setErrorMsg}
            onAuthExpired={onLogout}
          />
        )}
        {screen === 'entorno-map' && (
          <EntornoMapScreen
            lat={geoCtx.lat != null ? geoCtx.lat : -12.09}
            lng={geoCtx.lng != null ? geoCtx.lng : -77.03}
            onBack={() => setScreen(entornoReturn || roleHome)}
            onError={setErrorMsg}
            onAuthExpired={onLogout}
          />
        )}
        {screen === 'listings' && (
          <ListingsScreen
            onOpenListing={onOpenListing}
            onError={setErrorMsg}
            onAuthExpired={onLogout}
          />
        )}
        {screen === 'listing-detail' && (
          <ListingDetailScreen
            listingId={currentListingId}
            role={userRole}
            onBack={() => setScreen(detailReturn || roleHome)}
            onAnalyze={(ctx) => {
              if (ctx) setGeoCtx({ lat: ctx.lat ?? null, lng: ctx.lng ?? null });
              setFvPrefill(ctx || null);
              setScreen('fairvalue-form');
            }}
            onError={setErrorMsg}
            onAuthExpired={onLogout}
          />
        )}
        {screen === 'publish' && (
          <PublishScreen
            role={userRole}
            prefill={publishPrefill}
            onBack={() => setScreen(roleHome)}
            onPublished={(id) => { setDetailReturn(null); setCurrentListingId(id); setScreen('mis-publicaciones'); }}
            onError={setErrorMsg}
            onAuthExpired={onLogout}
          />
        )}
        {screen === 'mis-publicaciones' && (
          <MyListingsScreen
            onBack={() => setScreen(roleHome)}
            onOpenListing={onOpenListing}
            onPublish={() => onPublish(null)}
            onError={setErrorMsg}
            onAuthExpired={onLogout}
          />
        )}
        {screen === 'leads' && (
          <LeadsScreen
            onOpenListing={onOpenListing}
            onGo={go}
            onError={setErrorMsg}
            onAuthExpired={onLogout}
          />
        )}
        {screen === 'saved' && (
          <SavedScreen
            onOpenListing={onOpenListing}
            onGo={go}
            onError={setErrorMsg}
            onAuthExpired={onLogout}
          />
        )}
        {screen === 'profile' && (
          <ProfileScreen
            onLogout={onLogout}
            onError={setErrorMsg}
            onOpenAnalysis={onOpenAnalysis}
            onMyListings={() => setScreen('mis-publicaciones')}
            onSaved={() => setScreen('saved')}
            onUserChanged={() => setUserVersion(v => v + 1)}
            onAuthExpired={onLogout}
          />
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);

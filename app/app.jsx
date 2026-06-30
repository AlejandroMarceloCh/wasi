/* Wasi — App router (web app) */
const { useState: uS } = React;

// Tab (nav por rol) -> screen. Las claves dependen del rol pero el mapa es común:
// un comprador nunca dispara 'mis-propiedades'/'leads' y un vendedor nunca
// dispara 'explorar'/'guardados', así que conviven sin colisión.
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
  if (s.startsWith('listing')) return 'explorar';   // cubre 'listings' y 'listing-detail'
  if (s === 'saved') return 'guardados';
  if (s === 'mis-publicaciones') return 'mis-propiedades';
  if (s === 'leads') return 'leads';
  if (s === 'profile') return 'profile';
  // 'home'/'operaciones'/'entorno-map'/'publish' devuelven null: pantallas
  // residuales o acciones contextuales, sin tab activo en la nav nueva.
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

// Home según rol leyendo el usuario vigente (localStorage). Se usa en los
// puntos donde el `roleHome` del render quedó desactualizado (justo tras login).
// Pantalla de aterrizaje tras login / al abrir la app autenticado: el Home
// reconectado (resumen + accesos directos), común a ambos roles. Los "volver"
// de los flujos internos usan `roleHome` (listings / mis-publicaciones), no esto.
const computeRoleHome = () => 'home';

function App() {
  const [screen, setScreen] = uS(window.Api && window.Api.isAuthed() ? computeRoleHome() : 'splash');
  const [currentAnalysisId, setCurrentAnalysisId] = uS(null);
  // Resultado de VENTA: el modelo v1 no devuelve analysis_id, así que el data
  // se pasa directo a FairValueResult (sin fetch). null = flujo de alquiler.
  const [ventaResult, setVentaResult] = uS(null);
  // contexto geográfico (lat/lng del último análisis) para la pantalla Entorno
  const [geoCtx, setGeoCtx] = uS({ lat: null, lng: null });
  const [errorMsg, setErrorMsg] = uS('');
  // Flywheel de oferta: inmueble abierto + pre-carga del form de publicación
  const [currentListingId, setCurrentListingId] = uS(null);
  const [publishPrefill, setPublishPrefill] = uS(null);
  // "Analizar este precio" desde el detalle: características del inmueble que
  // pre-cargan el form de Analizar precio. null = form en blanco (entrada por nav).
  const [fvPrefill, setFvPrefill] = uS(null);

  const go = (s) => setScreen(s);

  // FairValueForm dispara esto al terminar. Alquiler: llega analysis_id (flujo
  // original). Venta: extra = { operacion:'venta', ventaData } con el resultado
  // directo (no hay analysis_id).
  // Respuesta viva del último /predict de alquiler (incluye prediction_interval,
  // que no se persiste en BD) + el form que la generó (alimenta el simulador
  // what-if). Solo aplican viniendo del wizard; el historial re-consulta.
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

  // Detalle de inmueble: recuerda desde dónde se abrió (Explorar, Guardados,
  // Leads, Mis propiedades) para que "Volver" regrese al origen, no al home.
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
    if (key === 'fairvalue') setFvPrefill(null); // entrada por nav = form en blanco
    const target = TAB_TO_SCREEN[key];
    if (target) setScreen(target);
  };

  const isPublic = PUBLIC_SCREENS.has(screen);
  const activeTab = SCREEN_TO_TAB(screen);
  // Rol del usuario: decide vista comprador (Inquilino) vs vendedor (Propietario/Agente).
  const currentUser = (window.Api && window.Api.getUser()) || { name: 'Ana' };
  const userRole = currentUser.role || 'Inquilino';
  const isSeller = userRole === 'Propietario' || userRole === 'Agente inmobiliario';
  // Pantalla "home" según rol: a dónde vuelve un flujo que termina (form, detalle,
  // publicación). El comprador aterriza en Explorar; el vendedor en Mis Propiedades.
  // Reemplaza al viejo 'operaciones', que ya no está en la nav por rol.
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
            onAuth={() => setScreen(computeRoleHome())}
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
            onContext={() => setScreen('entorno-map')}
            onError={setErrorMsg}
            onAuthExpired={onLogout}
          />
        )}
        {screen === 'entorno-map' && (
          <EntornoMapScreen
            lat={geoCtx.lat}
            lng={geoCtx.lng}
            onBack={() => setScreen('fairvalue-result')}
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
            onAuthExpired={onLogout}
          />
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);

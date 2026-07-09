import { useEffect, useState } from 'react';
import { Api } from './shared/api/client.js';
import { Btn, Card, Icon, PageHeader, TopNav } from './shared/ui/components.jsx';
import { AuthScreen } from './features/auth/AuthScreen.jsx';
import { SplashScreen } from './features/auth/SplashScreen.jsx';
import { EntornoMapScreen, FairValueForm, FairValueResult } from './features/fairvalue/FairValueScreens.jsx';
import { DashboardScreen, HomeScreen } from './features/home/HomeScreens.jsx';
import { ListingDetailScreen, ListingsScreen } from './features/listings/ListingsScreen.jsx';
import { ProfileScreen } from './features/profile/ProfileScreen.jsx';
import { LeadsScreen, MyListingsScreen, PublishScreen, SavedScreen } from './features/publish/PublishScreens.jsx';

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
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose && onClose(); } }}
      role="alert"
      aria-live="assertive"
      tabIndex={0}
      className="banner danger"
      style={{
        position: 'fixed',
        top: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        cursor: 'pointer',
        maxWidth: 560,
        boxShadow: '0 8px 24px rgba(0,0,0,.15)',
      }}
      title="Click para cerrar"
    >
      <span>⚠ {msg}</span>
    </div>
  );
};

const computeRoleHome = (isNew) => {
  if (!isNew) return 'home';
  const u = Api.getUser() || {};
  const seller = u.role === 'Propietario' || u.role === 'Agente inmobiliario';
  return seller ? 'mis-publicaciones' : 'listings';
};

const PlaceholderScreen = ({ screen, userRole, onLogout }) => (
  <div className="container fade-in" style={{ paddingTop: 32 }}>
    <PageHeader
      title="Pantalla pendiente de migración"
      subtitle={`Sprint V2 mantiene auth funcional. Siguiente pantalla: ${screen}.`}
      tag={<span className="tag tag-outline">{userRole}</span>}
      actions={<Btn variant="outline" onClick={onLogout}><Icon name="logout" size={15}/> Cerrar sesión</Btn>}
    />
    <Card style={{ padding: 20 }}>
      <p className="small muted" style={{ margin: 0 }}>
        Esta ruta queda como placeholder hasta su sprint correspondiente. La app vieja en <code>app/</code> sigue siendo el fallback funcional.
      </p>
    </Card>
  </div>
);

function App() {
  const [screen, setScreen] = useState(Api.isAuthed() ? computeRoleHome() : 'splash');
  const [userVersion, setUserVersion] = useState(0);
  const [currentListingId, setCurrentListingId] = useState(null);
  const [detailReturn, setDetailReturn] = useState(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState(null);
  const [ventaResult, setVentaResult] = useState(null);
  const [geoCtx, setGeoCtx] = useState({ lat: null, lng: null });
  const [entornoReturn, setEntornoReturn] = useState(null);
  const [fvPrefill, setFvPrefill] = useState(null);
  const [fvLive, setFvLive] = useState(null);
  const [fvForm, setFvForm] = useState(null);
  const [publishPrefill, setPublishPrefill] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const suppressLeafletTeardown = (event) => {
      if (String(event.message || '').includes("_leaflet_pos")) event.preventDefault();
    };
    window.addEventListener('error', suppressLeafletTeardown);
    return () => window.removeEventListener('error', suppressLeafletTeardown);
  }, []);

  const onAuth = (isNew) => {
    setUserVersion((v) => v + 1);
    setScreen(computeRoleHome(isNew));
  };

  const onLogout = () => {
    Api.logout();
    setCurrentListingId(null);
    setDetailReturn(null);
    setCurrentAnalysisId(null);
    setVentaResult(null);
    setGeoCtx({ lat: null, lng: null });
    setEntornoReturn(null);
    setFvPrefill(null);
    setFvLive(null);
    setFvForm(null);
    setPublishPrefill(null);
    setUserVersion((v) => v + 1);
    setScreen('splash');
  };

  const onOpenListing = (id) => {
    setDetailReturn(screen === 'listing-detail' ? detailReturn : screen);
    setCurrentListingId(id);
    setScreen('listing-detail');
  };

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

  const onPublish = (prefill) => {
    setPublishPrefill(prefill || null);
    setScreen('publish');
  };

  const go = (target) => {
    if (target === 'entorno-map') setEntornoReturn(screen);
    setScreen(target);
  };

  const onTopNavNav = (key) => {
    if (key === 'login') return setScreen('auth-login');
    if (key === 'signup') return setScreen('auth-register');
    if (key === 'fairvalue') setFvPrefill(null);
    const target = TAB_TO_SCREEN[key];
    if (target) setScreen(target);
  };

  void userVersion;
  const isPublic = PUBLIC_SCREENS.has(screen);
  const currentUser = Api.getUser() || { name: 'Ana' };
  const userRole = currentUser.role || 'Inquilino';
  const isSeller = userRole === 'Propietario' || userRole === 'Agente inmobiliario';
  const roleHome = isSeller ? 'mis-publicaciones' : 'listings';

  return (
    <div className="app-shell" data-screen-label={`Wasi · ${screen}`}>
      <ErrorBanner msg={errorMsg} onClose={() => setErrorMsg('')}/>
      <TopNav
        active={SCREEN_TO_TAB(screen)}
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
            onAuth={onAuth}
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
        {screen === 'home' && (
          <HomeScreen
            role={userRole}
            onGo={go}
            onOpenListing={onOpenListing}
            onPublish={() => onPublish(null)}
            user={currentUser}
          />
        )}
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
        {screen === 'publish' && (
          <PublishScreen
            role={userRole}
            prefill={publishPrefill}
            onBack={() => setScreen(roleHome)}
            onPublished={(id) => {
              setDetailReturn(null);
              setCurrentListingId(id);
              setScreen('mis-publicaciones');
            }}
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
            onUserChanged={() => setUserVersion((v) => v + 1)}
            onAuthExpired={onLogout}
          />
        )}
        {!isPublic && !['home', 'operaciones', 'listings', 'listing-detail', 'fairvalue-form', 'fairvalue-result', 'entorno-map', 'publish', 'mis-publicaciones', 'leads', 'saved', 'profile'].includes(screen) && (
          <PlaceholderScreen screen={screen} userRole={userRole} onLogout={onLogout}/>
        )}
      </main>
    </div>
  );
}

export default App;

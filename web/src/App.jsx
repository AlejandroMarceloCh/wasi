import { useState } from 'react';
import { Api } from './shared/api/client.js';
import { Btn, Card, Icon, PageHeader, TopNav } from './shared/ui/components.jsx';
import { AuthScreen } from './features/auth/AuthScreen.jsx';
import { SplashScreen } from './features/auth/SplashScreen.jsx';

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

  const onAuth = (isNew) => {
    setUserVersion((v) => v + 1);
    setScreen(computeRoleHome(isNew));
  };

  const onLogout = () => {
    Api.logout();
    setUserVersion((v) => v + 1);
    setScreen('splash');
  };

  const onTopNavNav = (key) => {
    if (key === 'login') return setScreen('auth-login');
    if (key === 'signup') return setScreen('auth-register');
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
        {!isPublic && (
          <PlaceholderScreen screen={screen} userRole={userRole} onLogout={onLogout}/>
        )}
      </main>
    </div>
  );
}

export default App;

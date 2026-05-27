/* Wasi — cliente API (frontend) */
(function(){
  const BASE = (window.WASI_API_BASE || 'http://localhost:8000') + '/api';
  const TOKEN_KEY = 'wasi.token';
  const USER_KEY = 'wasi.user';

  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const setSession = (token, user) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  };
  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };
  const getUser = () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  };

  async function request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const t = getToken();
      if (t) headers['Authorization'] = `Bearer ${t}`;
    }
    let res;
    try {
      res = await fetch(BASE + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new ApiError(0, 'No se pudo conectar al backend. ¿Está corriendo en ' + BASE + '?');
    }
    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch { data = { detail: text }; }
    }
    if (!res.ok) {
      const msg = (data && (data.detail || data.message)) || `Error ${res.status}`;
      throw new ApiError(res.status, msg, data);
    }
    return data;
  }

  class ApiError extends Error {
    constructor(status, message, data) {
      super(message);
      this.status = status;
      this.data = data;
    }
  }

  const Api = {
    BASE,
    ApiError,
    getToken,
    getUser,
    isAuthed: () => !!getToken(),
    clearSession,

    // Auth
    async register({ email, name, password }) {
      const r = await request('/auth/register', {
        method: 'POST',
        body: { email, name, password },
        auth: false,
      });
      setSession(r.token, r.user);
      return r;
    },
    async login({ email, password }) {
      const r = await request('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      setSession(r.token, r.user);
      return r;
    },
    async me() {
      return request('/me');
    },
    // Actualiza nombre/rol del perfil. Sincroniza localStorage para que
    // el TopNav refleje el cambio sin re-login.
    async updateMe(payload) {
      const r = await request('/me', { method: 'PATCH', body: payload });
      if (r && r.user) localStorage.setItem(USER_KEY, JSON.stringify(r.user));
      return r;
    },
    logout() { clearSession(); },

    // Dashboard
    dashboard: () => request('/dashboard'),

    // Fair Value — payload: {lat,lng,area,dormitorios,banos,es_estudio,
    //                         cocheras,antiguedad_anios,amenities[],precio}
    predict: (payload) => request('/fairvalue/predict', { method: 'POST', body: payload }),
    getAnalysis: (id) => request('/analyses/' + id),
    listAnalyses: () => request('/analyses'),
    saveReport: (id) => request('/analyses/' + id + '/save', { method: 'POST' }),

    // Entorno — contexto del barrio para un pin (lat, lng)
    entorno: ({ lat, lng }) => {
      const q = new URLSearchParams({ lat: String(lat), lng: String(lng) });
      return request('/entorno?' + q.toString());
    },
  };

  window.Api = Api;
})();

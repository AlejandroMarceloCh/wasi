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

  // Timeout duro de red (ms): si el servidor no responde, abortamos la petición
  // para no dejar spinners infinitos en la UI.
  const REQUEST_TIMEOUT_MS = 10000;

  async function request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const t = getToken();
      if (t) headers['Authorization'] = `Bearer ${t}`;
    }
    // AbortController corta la petición a los 10 s. timedOut distingue un abort
    // por timeout de un fallo de red normal, para dar un mensaje claro.
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(BASE + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      if (timedOut) {
        throw new ApiError(0, 'El servidor no respondió a tiempo. Intenta de nuevo en un momento.');
      }
      throw new ApiError(0, 'No se pudo conectar al backend. ¿Está corriendo en ' + BASE + '?');
    } finally {
      clearTimeout(timer);
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
    async register({ email, name, password, role }) {
      const r = await request('/auth/register', {
        method: 'POST',
        body: { email, name, password, role },
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
    // Venta — modelo v1 de compra/venta. payload: {lat,lng,area,dormitorios,banos,
    //   cocheras,antiguedad_anios,precio} (precio = venta anunciada en USD; SIN
    //   amenities ni es_estudio). Devuelve fair_value + veredicto + banda, sin
    //   analysis_id, SHAP, intervalo P25-P75 ni narrativa.
    predictVenta: (body) => request('/fairvalue/predict-venta', { method: 'POST', body }),
    // Contrafactuales — payload igual a predict PERO sin `precio` (solo re-sirve
    // el modelo congelado variando palancas).
    counterfactual: (payload) => request('/fairvalue/counterfactual', { method: 'POST', body: payload }),
    getAnalysis: (id) => request('/analyses/' + id),
    explain: (id) => request('/fairvalue/explain/' + id),
    narrative: (id, mode) => request('/fairvalue/narrative/' + id + (mode ? '?mode=' + mode : '')),
    narrativeDetailed: (id, mode) => request('/fairvalue/narrative/' + id + '/detailed' + (mode ? '?mode=' + mode : '')),
    poiImportance: () => request('/fairvalue/poi-importance'),
    listAnalyses: () => request('/analyses'),
    saveReport: (id) => request('/analyses/' + id + '/save', { method: 'POST' }),

    // Listings (oferta) + Leads (demanda) — flywheel
    listListings: (params) => {
      const q = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => {
        if (v !== '' && v != null) q.append(k, String(v));
      });
      const qs = q.toString();
      return request('/listings' + (qs ? '?' + qs : ''));
    },
    myListings: () => request('/listings/mine'),
    getListing: (id) => request('/listings/' + id),
    createListing: (body) => request('/listings', { method: 'POST', body }),
    createLead: (id, body) => request('/listings/' + id + '/leads', { method: 'POST', body }),
    listLeads: (id) => request('/listings/' + id + '/leads'),

    // Favoritos (guardados) — el backend devuelve [ListingOut] en GET.
    favorites: () => request('/favorites'),
    addFavorite: (listingId) => request('/favorites', { method: 'POST', body: { listing_id: listingId } }),
    removeFavorite: (listingId) => request('/favorites/' + listingId, { method: 'DELETE' }),

    // Entorno — contexto del barrio para un pin (lat, lng)
    entorno: ({ lat, lng }) => {
      const q = new URLSearchParams({ lat: String(lat), lng: String(lng) });
      return request('/entorno?' + q.toString());
    },
    // POIs individuales (lat/lng por categoría) en 1 km, para pintar en el mapa
    entornoPois: ({ lat, lng }) => {
      const q = new URLSearchParams({ lat: String(lat), lng: String(lng) });
      return request('/entorno/pois?' + q.toString());
    },
    // Zonas de precio por distrito (no requiere auth)
    distritosZona: () => request('/distritos-zona'),
  };

  window.Api = Api;
})();

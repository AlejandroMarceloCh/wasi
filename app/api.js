
(function(){
  
  
  const PROD_BACKEND = 'https://wasi-ei84.onrender.com';
  /* La base del API se puede fijar con #api8001 (ver index.html) y queda
     persistida en localStorage: un refresh o un link sin hash ya no mandan
     los requests a otro backend. */
  let storedBase = null;
  try { storedBase = localStorage.getItem('wasi.apibase'); } catch {}
  const BASE = (window.WASI_API_BASE
    || storedBase
    || (location.hostname === 'localhost' ? 'http://localhost:8000' : PROD_BACKEND)) + '/api';
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

  
  
  const REQUEST_TIMEOUT_MS = 10000;

  async function request(path, { method = 'GET', body, auth = true, meta = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const t = getToken();
      if (t) headers['Authorization'] = `Bearer ${t}`;
    }
    
    
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
      throw new ApiError(res.status, humanizeError(res.status, data), data);
    }
    if (meta) {
      const total = parseInt(res.headers.get('X-Total-Count') || '', 10);
      return { data, total: Number.isNaN(total) ? (Array.isArray(data) ? data.length : 0) : total };
    }
    return data;
  }

  /* ── Traducción de errores del backend a mensajes humanos ─────────────
     FastAPI devuelve los 422 de validación como detail = ARRAY de objetos
     Pydantic; sin esto, el banner mostraba "[object Object]". */

  const FIELD_ES = {
    email: 'correo', password: 'contraseña', name: 'nombre',
    address: 'dirección', district: 'distrito', description: 'descripción',
    contact_name: 'nombre de contacto', contact_phone: 'teléfono de contacto',
    contact_email: 'correo de contacto', price_usd: 'precio', precio: 'precio',
    area_m2: 'área', area: 'área', dormitorios: 'dormitorios', banos: 'baños',
    cocheras: 'cocheras', antiguedad_anios: 'antigüedad', image_url: 'foto',
    message: 'mensaje', phone: 'teléfono', role: 'rol', amenities: 'comodidades',
  };

  function msgFromPydantic(err) {
    const loc = Array.isArray(err.loc) ? err.loc.filter((p) => p !== 'body') : [];
    const field = FIELD_ES[loc[0]] || loc[0] || 'un campo';
    const t = err.type || '';
    const ctx = err.ctx || {};
    if (t === 'string_too_short') return `"${field}" es muy corto (mínimo ${ctx.min_length} caracteres).`;
    if (t === 'string_too_long') return `"${field}" es muy largo (máximo ${ctx.max_length} caracteres).`;
    if (t === 'greater_than_equal') return `"${field}" debe ser al menos ${ctx.ge}.`;
    if (t === 'less_than_equal') return `"${field}" debe ser como máximo ${ctx.le}.`;
    if (t === 'greater_than') return `"${field}" debe ser mayor que ${ctx.gt}.`;
    if (t === 'less_than') return `"${field}" debe ser menor que ${ctx.lt}.`;
    if (t === 'missing') return `Falta completar "${field}".`;
    if (t === 'int_parsing' || t === 'float_parsing' || t === 'int_from_float')
      return `"${field}" debe ser un número.`;
    if (/email/.test(t) || /valid email/i.test(err.msg || ''))
      return `El ${field} no es un correo válido.`;
    if (t === 'value_error') {
      /* Validators propios del backend — ya vienen en español tras el prefijo. */
      const m = (err.msg || '').replace(/^Value error,\s*/, '');
      return m || `Revisa el campo "${field}".`;
    }
    return `Revisa el campo "${field}".`;
  }

  function humanizeError(status, data) {
    if (data) {
      const d = data.detail;
      if (Array.isArray(d) && d.length) {
        const msgs = d.map(msgFromPydantic);
        return msgs.slice(0, 3).join(' ') + (msgs.length > 3 ? ` (+${msgs.length - 3} más)` : '');
      }
      if (typeof d === 'string' && d) {
        if (/valid email/i.test(d)) return 'El correo no es válido.';
        return d;
      }
      /* slowapi responde {"error": "Rate limit exceeded: ..."} */
      if (typeof data.error === 'string') {
        if (/rate limit/i.test(data.error)) return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
        return data.error;
      }
      if (typeof data.message === 'string' && data.message) return data.message;
    }
    if (status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    if (status === 403) return 'No tienes permiso para hacer esto.';
    if (status === 404) return 'No encontramos lo que buscas.';
    if (status === 429) return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
    if (status >= 500) return 'Algo falló en el servidor. Intenta de nuevo en un momento.';
    return `Error ${status}`;
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
    
    
    async updateMe(payload) {
      const r = await request('/me', { method: 'PATCH', body: payload });
      if (r && r.user) localStorage.setItem(USER_KEY, JSON.stringify(r.user));
      return r;
    },
    logout() { clearSession(); },

    
    dashboard: () => request('/dashboard'),

    
    
    predict: (payload) => request('/fairvalue/predict', { method: 'POST', body: payload }),
    
    
    simulate: (payload) => request('/fairvalue/simulate', { method: 'POST', body: payload }),
    
    
    
    
    predictVenta: (body) => request('/fairvalue/predict-venta', { method: 'POST', body }),
    
    
    counterfactual: (payload) => request('/fairvalue/counterfactual', { method: 'POST', body: payload }),
    
    
    comparables: ({ lat, lng, area, dormitorios }) => {
      const q = new URLSearchParams({ lat: String(lat), lng: String(lng) });
      if (area != null) q.append('area', String(area));
      if (dormitorios != null) q.append('dormitorios', String(dormitorios));
      return request('/fairvalue/comparables?' + q.toString());
    },
    getAnalysis: (id) => request('/analyses/' + id),
    explain: (id) => request('/fairvalue/explain/' + id),
    narrative: (id, mode) => request('/fairvalue/narrative/' + id + (mode ? '?mode=' + mode : '')),
    narrativeDetailed: (id, mode) => request('/fairvalue/narrative/' + id + '/detailed' + (mode ? '?mode=' + mode : '')),
    poiImportance: () => request('/fairvalue/poi-importance'),
    listAnalyses: () => request('/analyses'),
    saveReport: (id) => request('/analyses/' + id + '/save', { method: 'POST' }),

    
    listListings: (params) => {
      const q = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => {
        if (v !== '' && v != null) q.append(k, String(v));
      });
      const qs = q.toString();
      return request('/listings' + (qs ? '?' + qs : ''));
    },
    // Devuelve { data, total } leyendo X-Total-Count para paginar en la UI.
    listListingsPaged: (params) => {
      const q = new URLSearchParams();
      if (params) Object.entries(params).forEach(([k, v]) => {
        if (v !== '' && v != null) q.append(k, String(v));
      });
      const qs = q.toString();
      return request('/listings' + (qs ? '?' + qs : ''), { meta: true });
    },
    myListings: () => request('/listings/mine'),
    getListing: (id) => request('/listings/' + id),
    createListing: (body) => request('/listings', { method: 'POST', body }),
    updateListing: (id, body) => request('/listings/' + id, { method: 'PATCH', body }),
    deleteListing: (id) => request('/listings/' + id, { method: 'DELETE' }),
    createLead: (id, body) => request('/listings/' + id + '/leads', { method: 'POST', body }),
    listLeads: (id) => request('/listings/' + id + '/leads'),
    inboxLeads: () => request('/leads'),

    
    favorites: () => request('/favorites'),
    addFavorite: (listingId) => request('/favorites', { method: 'POST', body: { listing_id: listingId } }),
    removeFavorite: (listingId) => request('/favorites/' + listingId, { method: 'DELETE' }),

    
    entorno: ({ lat, lng }) => {
      const q = new URLSearchParams({ lat: String(lat), lng: String(lng) });
      return request('/entorno?' + q.toString());
    },
    
    entornoPois: ({ lat, lng }) => {
      const q = new URLSearchParams({ lat: String(lat), lng: String(lng) });
      return request('/entorno/pois?' + q.toString());
    },
    
    distritosZona: () => request('/distritos-zona'),
  };

  window.Api = Api;
})();

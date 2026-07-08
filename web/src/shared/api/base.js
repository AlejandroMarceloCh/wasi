const PROD_BACKEND = 'https://wasi-ei84.onrender.com';

const isLocalhost = () =>
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const normalizeBase = (base) => (base || '').replace(/\/+$/, '');

export function resolveApiBase() {
  let storedBase = null;
  let hashBase = null;
  try {
    const hash = window.location.hash || '';
    if (hash.includes('api8001')) {
      hashBase = 'http://localhost:8001';
      window.localStorage.setItem('wasi.apibase', hashBase);
    } else if (hash.includes('api8000')) {
      hashBase = 'http://localhost:8000';
      window.localStorage.setItem('wasi.apibase', hashBase);
    } else {
      storedBase = window.localStorage.getItem('wasi.apibase');
    }
  } catch (_) {}

  return normalizeBase(
    hashBase
      || window.WASI_API_BASE
      || storedBase
      || import.meta.env.VITE_API_BASE
      || (isLocalhost() ? 'http://localhost:8000' : PROD_BACKEND),
  );
}

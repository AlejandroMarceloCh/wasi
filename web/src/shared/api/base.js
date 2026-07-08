const PROD_BACKEND = 'https://wasi-ei84.onrender.com';

const isLocalhost = () =>
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const normalizeBase = (base) => (base || '').replace(/\/+$/, '');

export function resolveApiBase() {
  let storedBase = null;
  try {
    const hash = window.location.hash || '';
    if (hash.includes('api8001')) {
      storedBase = 'http://localhost:8001';
      window.localStorage.setItem('wasi.apibase', storedBase);
    } else if (hash.includes('api8000')) {
      storedBase = 'http://localhost:8000';
      window.localStorage.setItem('wasi.apibase', storedBase);
    } else {
      storedBase = window.localStorage.getItem('wasi.apibase');
    }
  } catch (_) {}

  return normalizeBase(
    import.meta.env.VITE_API_BASE
      || storedBase
      || (isLocalhost() ? 'http://localhost:8000' : PROD_BACKEND),
  );
}

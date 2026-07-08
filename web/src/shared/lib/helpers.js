export const LIMA_BBOX = { latMin:-12.5, latMax:-11.7, lngMin:-77.2, lngMax:-76.7 };

export const enLima = (lat,lng) =>
  lat>=LIMA_BBOX.latMin && lat<=LIMA_BBOX.latMax &&
  lng>=LIMA_BBOX.lngMin && lng<=LIMA_BBOX.lngMax;

export const LIMA_CENTRO = { lat:-12.0908, lng:-77.0270 };

export const ZONE_VARIANT = { Ganga: 'success', Justo: 'warning', Inflado: 'danger' };

export const safeImageUrl = (url) =>
  (typeof url === 'string' && /^(https?:\/\/|data:image\/)/i.test(url.trim())) ? url : null;

const WASI_PHOTOS = [
  '1522708323590-d24dbb6b0267','1502672260266-1c1ef2d93688','1493809842364-78817add7ffb',
  '1560448204-e02f11c3d0e2','1560185007-cde436f6a4d0','1554995207-c18c203602cb',
  '1505691938895-1758d7feb511','1484154218962-a197022b5858','1556912172-45b7abe8b7e1',
  '1502005229762-cf1b2da7c5d6','1522444195799-478538b28823','1567767292278-a4f21aa2d36e',
  '1545324418-cc1a3fa10c00','1502672023488-70e25813eb80','1416339306562-f3d12fefd36f',
  '1486304873000-235643847519','1560184897-ae75f418493e','1538688525198-9b88f6f53126',
  '1583847268964-b28dc8f51f92',
];

export const apartmentPhoto = (id) => {
  const i = ((id % WASI_PHOTOS.length) + WASI_PHOTOS.length) % WASI_PHOTOS.length;
  return `https://images.unsplash.com/photo-${WASI_PHOTOS[i]}?w=640&h=400&fit=crop&q=70`;
};

export const onKeyActivate = (handler) => (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (typeof handler === 'function') handler(e);
  }
};

export const handleApiErr = (ex, { setErr, onAuthExpired }) => {
  const msg = (ex && ex.message) ? ex.message : 'Error de conexión con el servidor';
  if (ex && ex.status === 401 && typeof onAuthExpired === 'function') {
    onAuthExpired();
    return msg;
  }
  if (typeof setErr === 'function') setErr(msg);
  return msg;
};

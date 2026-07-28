// Conversión a soles.
//
// El modelo trabaja en dólares porque los avisos de los portales se publican en
// dólares, pero el usuario peruano razona en soles: en las pruebas de usabilidad
// un propietario abrió la calculadora para multiplicar el precio a mano
// (ver docs/FEEDBACK_AUDIT_WASI.md §3.3). Mostrar el equivalente le ahorra ese paso.
//
// El tipo de cambio es una constante y no una consulta en vivo: una cotización
// exacta no aporta nada a una estimación cuyo margen de error es ~16%, y una API
// externa agregaría una dependencia que puede caerse. A cambio, la cifra se
// presenta siempre como aproximada y con su fecha a la vista, para que nadie la
// tome por una conversión al día.
//
// Para actualizarlo: cambiar los dos valores de abajo. Es el único lugar.
export const TIPO_CAMBIO_USD_PEN = 3.40;
export const TIPO_CAMBIO_FECHA = 'julio 2026';

/** Convierte dólares a soles. Devuelve null si el monto no es un número. */
export function aSoles(usd) {
  const n = Number(usd);
  if (!Number.isFinite(n)) return null;
  return n * TIPO_CAMBIO_USD_PEN;
}

/** Formatea un monto en soles con separador de miles: "S/ 2,915". */
export function formatSoles(usd, { decimales = 0 } = {}) {
  const pen = aSoles(usd);
  if (pen === null) return '';
  return `S/ ${pen.toLocaleString('es-PE', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}`;
}

/** Texto de apoyo para aclarar que es referencial y de cuándo es el tipo de cambio. */
export const NOTA_TIPO_CAMBIO =
  `Referencial, a S/ ${TIPO_CAMBIO_USD_PEN.toFixed(2)} por dólar (${TIPO_CAMBIO_FECHA}).`;

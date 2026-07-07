/**
 * Build de producción del frontend de Wasi.
 *
 * Los archivos de app/ NO usan imports ES: comparten globals por scope de script
 * (múltiples <script> comparten el mismo entorno léxico top-level). Por eso NO se
 * puede usar el bundling de módulos de esbuild. En su lugar:
 *   1. Se concatenan los archivos en el MISMO orden que index.html los carga.
 *   2. Se transforma el JSX (React clásico, con el React global) y se minifica.
 *   3. Se escribe un único app/dist/bundle.min.js.
 *
 * En producción, index.html carga React min + este bundle (sin Babel en cliente).
 * En desarrollo (localhost) index.html sigue cargando los .jsx con Babel standalone.
 *
 * Uso: node scripts/build_frontend.mjs   (o: npm run build)
 */
import { build } from 'esbuild';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'app');

// Orden EXACTO de carga de index.html (ver el bloque de document.write).
const FILES = [
  'api.js', 'aliases_lima.js', 'stats.js',
  'components.jsx', 'screens-core.jsx', 'screens-public.jsx', 'screens-home.jsx',
  'screens-fairvalue.jsx', 'screens-profile.jsx', 'screens-listings.jsx',
  'screens-seller.jsx', 'app.jsx',
];

const banner = '/* Wasi bundle de producción — generado por scripts/build_frontend.mjs. NO editar a mano. */\n';
const source = FILES
  .map((f) => `\n/* ===== ${f} ===== */\n` + readFileSync(join(APP, f), 'utf8'))
  .join('\n');

mkdirSync(join(APP, 'dist'), { recursive: true });

const result = await build({
  stdin: { contents: source, loader: 'jsx', resolveDir: APP, sourcefile: 'wasi-concat.jsx' },
  outfile: join(APP, 'dist', 'bundle.min.js'),
  bundle: false,            // sin bundling de módulos: es un solo script concatenado
  minify: true,
  target: 'es2018',
  jsx: 'transform',         // JSX clásico → React.createElement (usa el React global)
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  banner: { js: banner },
  legalComments: 'none',
  logLevel: 'info',
});

console.log('Build OK → app/dist/bundle.min.js');
if (result.warnings?.length) console.log(`${result.warnings.length} warnings`);

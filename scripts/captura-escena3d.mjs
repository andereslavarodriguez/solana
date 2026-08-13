// Verificación visual de la escena 3D (Fase 6), mismo patrón que
// captura-pantalla.mjs: servidor de Vite efímero, Chromium real, espera a
// `[data-cargado="true"]` en <html> (main-escena3d.js lo marca tras el
// primer render), captura de pantalla.
//
// Uso: node scripts/captura-escena3d.mjs <salida.png> [queryString]
// Ejemplo con override de depuración:
//   node scripts/captura-escena3d.mjs captura.png "debugNubes=80"

import { createServer } from 'vite';
import { chromium } from 'playwright';

const [, , salida = 'captura-escena3d.png', query = ''] = process.argv;

const servidor = await createServer({ server: { port: 0 }, logLevel: 'warn' });
await servidor.listen();
const puerto = servidor.config.server.port;
const url = `http://localhost:${puerto}/solana/escena3d.html${query ? `?${query}` : ''}`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1024, height: 768 } });

const erroresConsola = [];
pagina.on('console', (msg) => {
  if (msg.type() === 'error') erroresConsola.push(msg.text());
});
pagina.on('pageerror', (err) => erroresConsola.push(String(err)));

let fallo = null;
try {
  await pagina.goto(url, { waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('html[data-cargado="true"]', { timeout: 20000 });
  await pagina.screenshot({ path: salida });
  console.log(`Captura guardada en ${salida} (${url})`);
} catch (error) {
  fallo = error;
} finally {
  await navegador.close();
  await servidor.close();
}

if (erroresConsola.length > 0) {
  console.error('Errores de consola detectados:');
  erroresConsola.forEach((e) => console.error(' -', e));
}

if (fallo) {
  console.error(fallo);
  process.exit(1);
}
if (erroresConsola.length > 0) {
  process.exit(1);
}

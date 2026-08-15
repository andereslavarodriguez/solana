// Verificación visual de la escena 3D (Fase 6), mismo patrón que
// captura-pantalla.mjs: servidor de Vite efímero, Chromium real, espera a
// `[data-cargado="true"]` en <html> (main-escena3d.js lo marca tras el
// primer render), captura de pantalla.
//
// Uso: node scripts/captura-escena3d.mjs <salida.png> [queryString] [esperaMs] [anchoxalto]
// Ejemplos:
//   node scripts/captura-escena3d.mjs captura.png "debugNubes=80"
//   node scripts/captura-escena3d.mjs captura.png "debugLluvia=3" 1500        # tras 1.5s de animación
//   node scripts/captura-escena3d.mjs captura.png "" 0 393x852               # viewport de móvil

import { createServer } from 'vite';
import { chromium } from 'playwright';

const [, , salida = 'captura-escena3d.png', query = '', esperaMsArg = '0', viewportArg = '1024x768'] = process.argv;
const esperaMs = Number(esperaMsArg) || 0;
const [viewportAncho, viewportAlto] = viewportArg.split('x').map(Number);

const servidor = await createServer({ server: { port: 0 }, logLevel: 'warn' });
await servidor.listen();
const puerto = servidor.config.server.port;
const url = `http://localhost:${puerto}/solana/escena3d.html${query ? `?${query}` : ''}`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: viewportAncho, height: viewportAlto } });

const erroresConsola = [];
pagina.on('console', (msg) => {
  if (msg.type() === 'error') erroresConsola.push(msg.text());
});
pagina.on('pageerror', (err) => erroresConsola.push(String(err)));

let fallo = null;
try {
  await pagina.goto(url, { waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('html[data-cargado="true"]', { timeout: 20000 });
  if (esperaMs > 0) await pagina.waitForTimeout(esperaMs);
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

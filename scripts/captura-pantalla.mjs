// Verificación visual reutilizable con Playwright (decisión de Fase 5, ver
// docs/estado.md). Levanta un servidor de dev de Vite efímero, abre la
// ruta pedida en Chromium con un viewport de móvil Android (el target de
// instalación de la PWA), espera a que la propia pantalla se marque como
// cargada (`[data-cargado="true"]`, en vez de un timeout fijo o
// `networkidle`), comprueba que no haya errores de consola y guarda una
// captura para revisión manual.
//
// Uso: node scripts/captura-pantalla.mjs <ruta> <archivo-salida.png>
// <ruta> debe incluir el `base` configurado en vite.config.js (/solana/):
// Ejemplo: node scripts/captura-pantalla.mjs /solana/parametros.html captura.png
// La raíz ("/") es la única excepción — el dev server de Vite la redirige
// automáticamente a /solana/.

import { createServer } from 'vite';
import { chromium } from 'playwright';

const [, , ruta = '/', salida = 'captura.png'] = process.argv;

const servidor = await createServer({ server: { port: 0 }, logLevel: 'warn' });
await servidor.listen();
const puerto = servidor.config.server.port;
const url = `http://localhost:${puerto}${ruta}`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 393, height: 852 } });

const erroresConsola = [];
pagina.on('console', (msg) => {
  if (msg.type() === 'error') erroresConsola.push(msg.text());
});
pagina.on('pageerror', (err) => erroresConsola.push(String(err)));

let fallo = null;
try {
  await pagina.goto(url, { waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('[data-cargado="true"]', { timeout: 20000 });
  await pagina.screenshot({ path: salida, fullPage: true });
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

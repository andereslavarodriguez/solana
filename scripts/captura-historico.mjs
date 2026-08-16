// Verificación visual de la pantalla de Histórico (Fase 7), mismo patrón que
// scripts/captura-pantalla.mjs pero con datos sintéticos: a diferencia del
// dashboard (que trae clima real por red), historico.js solo lee
// localStorage, así que hace falta sembrar anotaciones de prueba antes de
// navegar — con page.addInitScript(), que se ejecuta antes que cualquier
// script de la propia página, para que dashboard.js/historico.js encuentren
// los datos ya puestos.
//
// Uso: node scripts/captura-historico.mjs <archivo-salida.png> [ancho] [alto]

import { createServer } from 'vite';
import { chromium } from 'playwright';

const [, , salida = 'captura-historico.png', anchoArg, altoArg] = process.argv;
const viewport = anchoArg
  ? { width: Number(anchoArg), height: Number(altoArg ?? anchoArg) }
  : { width: 393, height: 852 };

function anotacionesSinteticas() {
  const ahora = Date.now();
  const horas = (h) => new Date(ahora - h * 3600 * 1000).toISOString();
  // Serie descendente con algo de ruido entre predicho y real, y dos
  // anotaciones etiquetadas (deben verse marcadas distinto y no contar en
  // el error medio).
  return [
    { id: '1', version: 1, timestamp: horas(48), temperatura: 24.0, etiquetas: [], predicho: null, avgConduccion: null, avgSolarVent: null },
    { id: '2', version: 1, timestamp: horas(44), temperatura: 23.6, etiquetas: [], predicho: 23.9, avgConduccion: -2.1, avgSolarVent: 12 },
    { id: '3', version: 1, timestamp: horas(40), temperatura: 23.1, etiquetas: [], predicho: 23.4, avgConduccion: -2.4, avgSolarVent: 8 },
    { id: '4', version: 1, timestamp: horas(36), temperatura: 24.8, etiquetas: ['cocinando'], predicho: 22.9, avgConduccion: -1.9, avgSolarVent: 5 },
    { id: '5', version: 1, timestamp: horas(30), temperatura: 22.7, etiquetas: [], predicho: 23.0, avgConduccion: -3.0, avgSolarVent: 20 },
    { id: '6', version: 1, timestamp: horas(24), temperatura: 22.0, etiquetas: [], predicho: 22.5, avgConduccion: -3.4, avgSolarVent: 0 },
    { id: '7', version: 1, timestamp: horas(18), temperatura: 21.4, etiquetas: [], predicho: 21.9, avgConduccion: -3.6, avgSolarVent: 0 },
    { id: '8', version: 1, timestamp: horas(12), temperatura: 23.9, etiquetas: ['masGente'], predicho: 21.1, avgConduccion: -1.0, avgSolarVent: 60 },
    { id: '9', version: 1, timestamp: horas(6), temperatura: 22.9, etiquetas: [], predicho: 23.3, avgConduccion: -1.5, avgSolarVent: 40 },
    { id: '10', version: 1, timestamp: horas(1), temperatura: 22.5, etiquetas: [], predicho: 22.7, avgConduccion: -1.8, avgSolarVent: 30 },
  ];
}

const servidor = await createServer({ server: { port: 0 }, logLevel: 'warn' });
await servidor.listen();
const puerto = servidor.config.server.port;
const url = `http://localhost:${puerto}/solana/historico.html`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport });

await pagina.addInitScript((anotaciones) => {
  window.localStorage.setItem('solana:anotaciones', JSON.stringify(anotaciones));
}, anotacionesSinteticas());

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

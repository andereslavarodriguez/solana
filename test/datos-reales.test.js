// Verificación manual de la Fase 2 (datos reales): pide clima real a
// Open-Meteo y posición solar real a SunCalc para la ubicación del piso, y
// los pasa —sin tocar su lógica— por el modelo puro de la Fase 1, para
// comprobar a ojo que los números tienen sentido para el momento actual.
//
// Depende de red. No forma parte de `npm test` (que verifica solo el modelo
// puro, sin red); se ejecuta aparte con `npm run test:datos`.

import assert from 'node:assert/strict';
import { UBICACION_PISO } from '../src/data/ubicacion.js';
import { posicionSolar } from '../src/data/sol.js';
import { obtenerDatosReales } from '../src/data/adaptador.js';
import { qSolarVentana, simularHorizonte } from '../src/model/termico.js';
import { recomendarVentana, recomendarPersiana } from '../src/model/recomendacion.js';

// Piso de prueba (spec.md §3.4: orientaciones y geometría de edificios
// enfrente reales; ancho de ventana y parámetros ajustables son valores de
// prueba, igual que en test/model.test.js — los defaults reales se deciden
// en la Fase 4).
const piso = {
  superficie: 30,
  alturaTecho: 2.5,
  UA: 60,
  factorCapacidad: 6,
  SHGC: 0.6,
  renovacionesHora: 3,
  ventanas: [
    { nombre: 'A', orientacion: 248, ancho: 2.0, alturaEdificioEnfrente: 15, distanciaEdificioEnfrente: 45 },
    { nombre: 'B', orientacion: 68, ancho: 1.8, alturaEdificioEnfrente: 12, distanciaEdificioEnfrente: 20 },
  ],
};

const estadosVentanas = {
  A: { abierta: false, persianaArriba: true },
  B: { abierta: false, persianaArriba: true },
};

async function main() {
  const { lat, lon } = UBICACION_PISO;

  console.log(`\nUbicación: ${lat}, ${lon} (Pamplona, valor de partida — editable en Fase 4)`);
  console.log(`Hora local del sistema: ${new Date().toString()}\n`);

  console.log('--- posicionSolar (SunCalc, §3.3) ---');
  const sol = posicionSolar(new Date(), lat, lon);
  console.log(`  elevación = ${sol.elevacion.toFixed(2)}°, azimut = ${sol.azimut.toFixed(2)}°`);
  assert.ok(sol.elevacion >= -90 && sol.elevacion <= 90, 'elevación fuera de rango físico');
  assert.ok(sol.azimut >= 0 && sol.azimut < 360, 'azimut fuera de rango físico');

  console.log('\n--- obtenerDatosReales (Open-Meteo minutely_15, §3.2) ---');
  const { actual, pronostico } = await obtenerDatosReales(lat, lon, 8);
  console.log(`  hora del dato actual = ${actual.hora}`);
  console.log(
    `  T_out = ${actual.tOut}°C, nubes = ${actual.sol.nubesPct}%, ` +
      `precipitación = ${actual.precipitacion}mm, humedad = ${actual.humedad}%, viento = ${actual.viento}km/h`
  );
  console.log(`  sol en el instante actual: elevación=${actual.sol.elevacion.toFixed(2)}°, azimut=${actual.sol.azimut.toFixed(2)}°`);
  console.log(`  pasos de pronóstico recibidos = ${pronostico.length} (esperado 32, 8h a 15min)`);
  assert.equal(pronostico.length, 32);
  assert.ok(actual.tOut > -30 && actual.tOut < 50, 'T_out fuera de rango físico razonable');
  assert.ok(actual.sol.nubesPct >= 0 && actual.sol.nubesPct <= 100, 'nubosidad fuera de [0,100]');

  console.log('\n--- qSolarVentana con datos reales (§4) ---');
  for (const ventana of piso.ventanas) {
    const q = qSolarVentana(ventana, estadosVentanas[ventana.nombre], actual.sol, piso);
    console.log(`  ventana ${ventana.nombre}: Q_solar = ${q.toFixed(1)} W`);
    assert.ok(q >= 0, `Q_solar de ${ventana.nombre} no puede ser negativo`);
  }

  console.log('\n--- simularHorizonte con pronóstico real (§4) ---');
  const tInActual = 24; // placeholder: la anotación manual real llega en la Fase 3
  const trayectoria = simularHorizonte(tInActual, pronostico, estadosVentanas, piso);
  console.log(
    `  T_in parte de ${tInActual}°C, tras 8h (todo cerrado, persianas arriba) = ${trayectoria[trayectoria.length - 1].toFixed(2)}°C`
  );
  assert.equal(trayectoria.length, pronostico.length + 1);

  console.log('\n--- recomendarVentana / recomendarPersiana con datos reales (§5) ---');
  for (const ventana of piso.ventanas) {
    const rVentana = recomendarVentana(ventana.nombre, tInActual, pronostico, estadosVentanas, piso);
    const rPersiana = recomendarPersiana(ventana.nombre, tInActual, pronostico, estadosVentanas, piso);
    console.log(`  ventana ${ventana.nombre}: ventana → ${rVentana.accion}, persiana → ${rPersiana.accion} (${rPersiana.motivo})`);
  }

  console.log('\nOK — datos reales fluyen por el modelo puro sin errores y con valores dentro de rango físico.\n');
}

main().catch((err) => {
  console.error('\nFALLO en la verificación de datos reales:', err);
  process.exitCode = 1;
});

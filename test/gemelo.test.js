// Casos de prueba manuales para el gemelo en vivo (Fase 7, src/model/gemelo.js).

import assert from 'node:assert/strict';
import {
  estadoGemeloInicial,
  pasoGemelo,
  regresoresPromedio,
} from '../src/model/gemelo.js';
import { derivadaTemperatura, capacidadTermica } from '../src/model/termico.js';

let ok = 0;
function caso(nombre, fn) {
  fn();
  ok += 1;
  console.log(`OK  ${nombre}`);
}

const cerca = (a, b, tol = 0.01) => Math.abs(a - b) < tol;

const piso = {
  superficie: 30,
  alturaTecho: 2.5,
  UA: 60,
  factorCapacidad: 6,
  SHGC: 0.6,
  renovacionesHora: 3,
  fraccionVentPersianaBajada: 0.15,
  bandaConfort: { min: 21, max: 25 },
  ventanas: [
    { nombre: 'A', orientacion: 248, ancho: 2.0, alturaEdificioEnfrente: 15, distanciaEdificioEnfrente: 45 },
    { nombre: 'B', orientacion: 68, ancho: 1.8, alturaEdificioEnfrente: 12, distanciaEdificioEnfrente: 20 },
  ],
};

const ventanasCerradas = {
  A: { abierta: false, persianaArriba: false },
  B: { abierta: false, persianaArriba: false },
};

const solNoche = { elevacion: -10, azimut: 180, nubesPct: 50 };

console.log('\n--- estadoGemeloInicial ---');

caso('estado inicial tiene acumuladores a cero', () => {
  const t0 = new Date('2026-01-01T10:00:00Z');
  const estado = estadoGemeloInicial(20, t0.toISOString());
  assert.equal(estado.tIn, 20);
  assert.equal(estado.sumConduccionSeg, 0);
  assert.equal(estado.sumSolarVentSeg, 0);
  assert.equal(estado.segundosAcumulados, 0);
  assert.equal(regresoresPromedio(estado), null);
});

console.log('\n--- pasoGemelo: caso trivial (gap <= 0) ---');

caso('sin tiempo transcurrido, el estado no cambia', () => {
  const t0 = new Date('2026-01-01T10:00:00Z');
  const estado = estadoGemeloInicial(20, t0.toISOString());
  const resultado = pasoGemelo(estado, t0, { tOut: 5, sol: solNoche }, ventanasCerradas, piso);
  assert.equal(resultado.tIn, 20);
  assert.equal(resultado.segundosAcumulados, 0);
});

console.log('\n--- pasoGemelo: un único paso de 15 min, solo conducción ---');

caso('coincide con un paso manual de derivadaTemperatura', () => {
  const t0 = new Date('2026-01-01T10:00:00Z');
  const ahora = new Date(t0.getTime() + 900 * 1000);
  const actual = { tOut: 10, sol: solNoche };
  const estado = estadoGemeloInicial(20, t0.toISOString());

  const resultado = pasoGemelo(estado, ahora, actual, ventanasCerradas, piso);

  const dTdt = derivadaTemperatura(20, 10, solNoche, ventanasCerradas, piso);
  const esperado = 20 + dTdt * 900;
  console.log(`  tIn esperado=${esperado.toFixed(4)} obtenido=${resultado.tIn.toFixed(4)}`);
  assert.ok(cerca(resultado.tIn, esperado, 0.001));
});

caso('acumula el regresor de conducción ponderado por el tiempo', () => {
  const t0 = new Date('2026-01-01T10:00:00Z');
  const ahora = new Date(t0.getTime() + 900 * 1000);
  const actual = { tOut: 10, sol: solNoche };
  const estado = estadoGemeloInicial(20, t0.toISOString());

  const resultado = pasoGemelo(estado, ahora, actual, ventanasCerradas, piso);
  const prom = regresoresPromedio(resultado);

  assert.equal(resultado.segundosAcumulados, 900);
  assert.ok(cerca(prom.avgConduccion, 10 - 20, 0.001));
  assert.ok(cerca(prom.avgSolarVent, 0, 0.001)); // noche, ventanas cerradas
});

console.log('\n--- pasoGemelo: sol y ventilación reales ---');

caso('con persiana subida y sol de día, el regresor solar+vent no es cero', () => {
  const t0 = new Date('2026-01-01T10:00:00Z');
  const ahora = new Date(t0.getTime() + 900 * 1000);
  const solDia = { elevacion: 40, azimut: 248, nubesPct: 0 }; // de frente a la ventana A
  const actual = { tOut: 15, sol: solDia };
  const estadosVentanas = {
    A: { abierta: true, persianaArriba: true },
    B: { abierta: false, persianaArriba: false },
  };
  const estado = estadoGemeloInicial(20, t0.toISOString());

  const resultado = pasoGemelo(estado, ahora, actual, estadosVentanas, piso);
  const prom = regresoresPromedio(resultado);

  assert.ok(prom.avgSolarVent > 0, `avgSolarVent debería ser > 0, fue ${prom.avgSolarVent}`);
});

console.log('\n--- pasoGemelo: hueco grande (app cerrada varios días) ---');

caso('un hueco de 3 días converge hacia T_out sin divergir', () => {
  const t0 = new Date('2026-01-01T10:00:00Z');
  const ahora = new Date(t0.getTime() + 3 * 24 * 3600 * 1000);
  const actual = { tOut: 10, sol: solNoche };
  const estado = estadoGemeloInicial(20, t0.toISOString());

  const tau = capacidadTermica(piso) / piso.UA;
  console.log(`  constante de tiempo del piso ≈ ${(tau / 3600).toFixed(2)} h`);

  const resultado = pasoGemelo(estado, ahora, actual, ventanasCerradas, piso);
  console.log(`  tIn tras 3 días con T_out=10 constante: ${resultado.tIn.toFixed(3)}`);

  assert.ok(resultado.tIn >= 9.9 && resultado.tIn <= 20, 'tIn debe quedarse en el rango físico [T_out, T_in inicial]');
  assert.ok(cerca(resultado.tIn, 10, 0.05), 'con 3 días (≫ constante de tiempo) debería estar prácticamente en T_out');
});

console.log('\n--- pasoGemelo: dos ticks consecutivos, promedio ponderado ---');

caso('el promedio pondera cada tick por su duración real', () => {
  const t0 = new Date('2026-01-01T10:00:00Z');
  const t1 = new Date(t0.getTime() + 900 * 1000); // tick corto, 15 min
  const t2 = new Date(t1.getTime() + 2700 * 1000); // tick largo, 45 min

  let estado = estadoGemeloInicial(20, t0.toISOString());
  estado = pasoGemelo(estado, t1, { tOut: 10, sol: solNoche }, ventanasCerradas, piso);
  const tInTrasPrimero = estado.tIn;
  estado = pasoGemelo(estado, t2, { tOut: 0, sol: solNoche }, ventanasCerradas, piso);

  const prom = regresoresPromedio(estado);
  const esperado = ((10 - 20) * 900 + (0 - tInTrasPrimero) * 2700) / (900 + 2700);
  console.log(`  avgConduccion esperado=${esperado.toFixed(4)} obtenido=${prom.avgConduccion.toFixed(4)}`);
  assert.ok(cerca(prom.avgConduccion, esperado, 0.001));
  assert.equal(estado.segundosAcumulados, 3600);
});

console.log(`\n${ok} casos OK (gemelo.test.js)`);

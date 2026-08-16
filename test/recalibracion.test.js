// Casos de prueba manuales para la recalibración (Fase 7, src/model/recalibracion.js).

import assert from 'node:assert/strict';
import {
  construirFilasRegresion,
  recalibrar,
  MINIMO_FILAS_RECALIBRACION,
} from '../src/model/recalibracion.js';
import { capacidadTermica } from '../src/model/termico.js';

let ok = 0;
function caso(nombre, fn) {
  fn();
  ok += 1;
  console.log(`OK  ${nombre}`);
}

const cerca = (a, b, tol) => Math.abs(a - b) < tol;

console.log('\n--- construirFilasRegresion ---');

caso('la primera anotación nunca genera fila (no hay anterior)', () => {
  const anotaciones = [
    { timestamp: '2026-01-01T10:00:00Z', temperatura: 20, etiquetas: [], avgConduccion: null, avgSolarVent: null },
  ];
  assert.deepEqual(construirFilasRegresion(anotaciones), []);
});

caso('anotaciones etiquetadas no generan fila, las no etiquetadas sí', () => {
  const anotaciones = [
    { timestamp: '2026-01-01T10:00:00Z', temperatura: 20, etiquetas: [] },
    { timestamp: '2026-01-01T11:00:00Z', temperatura: 19, etiquetas: ['cocinando'], avgConduccion: -5, avgSolarVent: 0 },
    { timestamp: '2026-01-01T12:00:00Z', temperatura: 18, etiquetas: [], avgConduccion: -4, avgSolarVent: 10 },
  ];
  const filas = construirFilasRegresion(anotaciones);
  assert.equal(filas.length, 1);
  assert.equal(filas[0].timestamp, '2026-01-01T12:00:00Z');
});

caso('anotaciones sin regresores calculados (dos anotaciones sin tick de por medio) se ignoran', () => {
  const anotaciones = [
    { timestamp: '2026-01-01T10:00:00Z', temperatura: 20, etiquetas: [] },
    { timestamp: '2026-01-01T10:00:05Z', temperatura: 20, etiquetas: [], avgConduccion: null, avgSolarVent: null },
  ];
  assert.deepEqual(construirFilasRegresion(anotaciones), []);
});

caso('la pendiente observada usa el delta real de temperatura y tiempo', () => {
  const anotaciones = [
    { timestamp: '2026-01-01T10:00:00Z', temperatura: 20, etiquetas: [] },
    { timestamp: '2026-01-01T11:00:00Z', temperatura: 18, etiquetas: [], avgConduccion: -3, avgSolarVent: 5 },
  ];
  const filas = construirFilasRegresion(anotaciones);
  assert.equal(filas.length, 1);
  // (18-20) / 3600s
  assert.ok(cerca(filas[0].pendienteObservada, -2 / 3600, 1e-9));
});

console.log('\n--- recalibrar: recupera UA/factorCapacidad reales de datos sintéticos sin ruido ---');

caso('recupera un UA/factorCapacidad reales distintos de los del piso de partida', () => {
  const pisoReal = { superficie: 30, alturaTecho: 2.5, UA: 80, factorCapacidad: 8 };
  const C = capacidadTermica(pisoReal);
  const a = pisoReal.UA / C;
  const b = 1 / C;

  const filas = [];
  for (let i = 0; i < 15; i += 1) {
    // Variación amplia y no colineal entre los dos regresores, para que el
    // sistema de mínimos cuadrados no sea degenerado.
    const x1 = -5 + i * 0.7; // conducción: de -5 a ~4.8
    const x2 = (i % 3) * 40 + i * 2; // solar+vent: no proporcional a x1
    filas.push({ avgConduccion: x1, avgSolarVent: x2, pendienteObservada: a * x1 + b * x2 });
  }

  // El piso "actual" (antes de recalibrar) tiene valores de partida
  // distintos a los reales — solo aporta superficie/alturaTecho/factorCapacidad
  // para derivar la constante volumen·densidad·calorEspecífico.
  const pisoActual = { superficie: 30, alturaTecho: 2.5, UA: 60, factorCapacidad: 6 };
  const resultado = recalibrar(filas, pisoActual);

  console.log(`  UA esperado=${pisoReal.UA} obtenido=${resultado.UA.toFixed(3)}`);
  console.log(`  factorCapacidad esperado=${pisoReal.factorCapacidad} obtenido=${resultado.factorCapacidad.toFixed(3)}`);
  assert.ok(resultado);
  assert.ok(cerca(resultado.UA, pisoReal.UA, 0.01));
  assert.ok(cerca(resultado.factorCapacidad, pisoReal.factorCapacidad, 0.01));
});

console.log('\n--- recalibrar: guardas de seguridad ---');

caso('con menos filas que el mínimo, no recalibra', () => {
  const filas = Array.from({ length: MINIMO_FILAS_RECALIBRACION - 1 }, (_, i) => ({
    avgConduccion: -1 - i,
    avgSolarVent: i * 10,
    pendienteObservada: -0.0001 * (i + 1),
  }));
  const piso = { superficie: 30, alturaTecho: 2.5, UA: 60, factorCapacidad: 6 };
  assert.equal(recalibrar(filas, piso), null);
});

caso('sistema degenerado (sin variación en un regresor) no recalibra', () => {
  const filas = Array.from({ length: 15 }, (_, i) => ({
    avgConduccion: -1 - i,
    avgSolarVent: 0, // siempre cero: persiana bajada/ventana cerrada todo el histórico
    pendienteObservada: -0.0001 * (i + 1),
  }));
  const piso = { superficie: 30, alturaTecho: 2.5, UA: 60, factorCapacidad: 6 };
  assert.equal(recalibrar(filas, piso), null);
});

caso('un ajuste físicamente implausible (fuera de rango) se rechaza', () => {
  // pendienteObservada mucho mayor que lo que la conducción real podría
  // explicar → UA ajustado dispararía muy por encima de RANGOS.UA.max (300).
  const filas = Array.from({ length: 15 }, (_, i) => ({
    avgConduccion: -1 - i * 0.3,
    avgSolarVent: (i % 4) * 15,
    pendienteObservada: -0.5 - i * 0.01, // enorme para una casa real
  }));
  const piso = { superficie: 30, alturaTecho: 2.5, UA: 60, factorCapacidad: 6 };
  assert.equal(recalibrar(filas, piso), null);
});

console.log(`\n${ok} casos OK (recalibracion.test.js)`);

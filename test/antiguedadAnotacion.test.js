// Casos de prueba manuales para src/ui/antiguedadAnotacion.js (Fase 5,
// umbrales y motivo en docs/estado.md). `ahora` fijo para que los casos
// sean deterministas.

import assert from 'node:assert/strict';
import {
  horasDesde,
  estadoAntiguedad,
  formatoAntiguedad,
  UMBRAL_AVISO_HORAS,
  UMBRAL_CADUCA_HORAS,
} from '../src/ui/antiguedadAnotacion.js';

let ok = 0;
function caso(nombre, fn) {
  fn();
  ok += 1;
  console.log(`OK  ${nombre}`);
}

const ahora = new Date('2026-08-13T18:00:00Z');
const hace = (horas) => new Date(ahora.getTime() - horas * 60 * 60 * 1000).toISOString();

console.log('\n--- horasDesde ---');

caso('hace 2 horas -> horasDesde ≈ 2', () => {
  const horas = horasDesde(hace(2), ahora);
  console.log(`    horas = ${horas}`);
  assert.ok(Math.abs(horas - 2) < 0.001);
});

console.log('\n--- estadoAntiguedad (umbrales 3h / 12h) ---');

caso('recién anotada (0h) -> fresca', () => {
  assert.equal(estadoAntiguedad(hace(0), ahora), 'fresca');
});

caso('justo por debajo del umbral de aviso -> fresca', () => {
  assert.equal(estadoAntiguedad(hace(UMBRAL_AVISO_HORAS - 0.01), ahora), 'fresca');
});

caso('justo en el umbral de aviso -> aviso', () => {
  assert.equal(estadoAntiguedad(hace(UMBRAL_AVISO_HORAS), ahora), 'aviso');
});

caso('a mitad de camino entre los dos umbrales -> aviso', () => {
  assert.equal(estadoAntiguedad(hace(7), ahora), 'aviso');
});

caso('justo por debajo del umbral de caducidad -> aviso', () => {
  assert.equal(estadoAntiguedad(hace(UMBRAL_CADUCA_HORAS - 0.01), ahora), 'aviso');
});

caso('justo en el umbral de caducidad -> caducada', () => {
  assert.equal(estadoAntiguedad(hace(UMBRAL_CADUCA_HORAS), ahora), 'caducada');
});

caso('un día entero -> caducada', () => {
  assert.equal(estadoAntiguedad(hace(24), ahora), 'caducada');
});

console.log('\n--- formatoAntiguedad ---');

caso('menos de un minuto -> "hace 1 minuto"', () => {
  assert.equal(formatoAntiguedad(0.001), 'hace 1 minuto');
});

caso('20 minutos -> "hace 20 minutos"', () => {
  assert.equal(formatoAntiguedad(20 / 60), 'hace 20 minutos');
});

caso('1 hora exacta -> "hace 1 hora"', () => {
  assert.equal(formatoAntiguedad(1), 'hace 1 hora');
});

caso('5 horas -> "hace 5 horas"', () => {
  assert.equal(formatoAntiguedad(5), 'hace 5 horas');
});

console.log(`\n${ok} casos OK\n`);

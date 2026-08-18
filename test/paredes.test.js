// Casos de prueba manuales para orientacionDeFachada (src/model/paredes.js).
// Mismo patrón que el resto de test/*.test.js: funciones puras, sin DOM.

import assert from 'node:assert/strict';
import { PAREDES, orientacionDeFachada } from '../src/model/paredes.js';

let ok = 0;
function caso(nombre, fn) {
  fn();
  ok += 1;
  console.log(`OK  ${nombre}`);
}

console.log('\n--- orientacionDeFachada ---');

caso('frontal coincide exactamente con orientacionCasa', () => {
  assert.equal(orientacionDeFachada(248, 'frontal'), 248);
});

caso('trasera es la opuesta exacta (180°)', () => {
  assert.equal(orientacionDeFachada(248, 'trasera'), 68);
});

caso('derecha es +90°', () => {
  assert.equal(orientacionDeFachada(0, 'derecha'), 90);
});

caso('izquierda es +270° (-90°)', () => {
  assert.equal(orientacionDeFachada(0, 'izquierda'), 270);
});

caso('normaliza la vuelta completa (orientacionCasa cerca de 360°)', () => {
  assert.equal(orientacionDeFachada(350, 'derecha'), 80);
});

caso('las 4 facetas están todas presentes en PAREDES', () => {
  assert.deepEqual([...PAREDES].sort(), ['derecha', 'frontal', 'izquierda', 'trasera']);
});

console.log(`\n${ok} casos OK (paredes.test.js)\n`);

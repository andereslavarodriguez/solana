// Casos de prueba manuales para categoriaTiempo (src/data/openMeteo.js) —
// mapea el código WMO real a una categoría de icono para el pronóstico
// extendido del dashboard (docs/estado.md, "widget estilo Google
// Weather"). esTormenta() ya tenía verificación indirecta con red en
// test/datos-reales.test.js; aquí se prueba sin red, y de paso se
// comprueba que categoriaTiempo coincide con esTormenta() en los códigos
// de tormenta.

import assert from 'node:assert/strict';
import { categoriaTiempo, esTormenta } from '../src/data/openMeteo.js';

let ok = 0;
function caso(nombre, fn) {
  fn();
  ok += 1;
  console.log(`OK  ${nombre}`);
}

console.log('\n--- categoriaTiempo ---');

caso('0 (despejado) -> despejado', () => {
  assert.equal(categoriaTiempo(0), 'despejado');
});

caso('1 y 2 (poco/parcialmente nublado) -> parcial', () => {
  assert.equal(categoriaTiempo(1), 'parcial');
  assert.equal(categoriaTiempo(2), 'parcial');
});

caso('3 (cubierto) y 45/48 (niebla) -> nublado', () => {
  assert.equal(categoriaTiempo(3), 'nublado');
  assert.equal(categoriaTiempo(45), 'nublado');
  assert.equal(categoriaTiempo(48), 'nublado');
});

caso('códigos de lluvia/llovizna/chubascos -> lluvia', () => {
  for (const c of [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]) {
    assert.equal(categoriaTiempo(c), 'lluvia', `código ${c}`);
  }
});

caso('códigos de nieve -> nieve', () => {
  for (const c of [71, 73, 75, 77, 85, 86]) {
    assert.equal(categoriaTiempo(c), 'nieve', `código ${c}`);
  }
});

caso('95/96/99 (tormenta) -> tormenta, coincide con esTormenta()', () => {
  for (const c of [95, 96, 99]) {
    assert.equal(categoriaTiempo(c), 'tormenta');
    assert.equal(esTormenta(c), true);
  }
});

caso('código no reconocido -> nublado (fallback conservador)', () => {
  assert.equal(categoriaTiempo(999), 'nublado');
});

console.log(`\n${ok} casos OK (openMeteo.test.js)\n`);

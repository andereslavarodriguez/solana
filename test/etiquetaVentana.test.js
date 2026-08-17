// Casos de prueba manuales para etiquetaCompass (src/ui/etiquetaVentana.js).
// Mismo patrón que test/validacion.test.js: funciones puras, sin DOM.

import assert from 'node:assert/strict';
import { etiquetaCompass } from '../src/ui/etiquetaVentana.js';
import { PARAMETROS_PISO_POR_DEFECTO } from '../src/persistencia/piso.js';

let ok = 0;
function caso(nombre, fn) {
  fn();
  ok += 1;
  console.log(`OK  ${nombre}`);
}

console.log('\n--- etiquetaCompass ---');

caso('las dos orientaciones reales del piso dan las etiquetas de spec.md (SO/NE)', () => {
  const [ventanaA, ventanaB] = PARAMETROS_PISO_POR_DEFECTO.ventanas;
  assert.equal(etiquetaCompass(ventanaA.orientacion), 'Suroeste');
  assert.equal(etiquetaCompass(ventanaB.orientacion), 'Noreste');
});

caso('0° -> Norte', () => {
  assert.equal(etiquetaCompass(0), 'Norte');
});

caso('44° -> todavía Norte (bin de 45° arrancando en el propio grado)', () => {
  assert.equal(etiquetaCompass(44), 'Norte');
});

caso('45° -> Noreste', () => {
  assert.equal(etiquetaCompass(45), 'Noreste');
});

caso('180° -> Sur', () => {
  assert.equal(etiquetaCompass(180), 'Sur');
});

caso('359° -> Noroeste', () => {
  assert.equal(etiquetaCompass(359), 'Noroeste');
});

caso('360° -> Norte (normaliza la vuelta completa)', () => {
  assert.equal(etiquetaCompass(360), 'Norte');
});

caso('-10° -> Noroeste (normaliza negativos)', () => {
  assert.equal(etiquetaCompass(-10), 'Noroeste');
});

console.log(`\n${ok} casos OK (etiquetaVentana.test.js)\n`);

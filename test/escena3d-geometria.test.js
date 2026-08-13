// Casos de prueba manuales para geometria.js (Fase 6, checkpoint 1). Mismo
// patrón que test/model.test.js: cada caso imprime valores intermedios y los
// compara con un cálculo hecho a mano.

import assert from 'node:assert/strict';
import { calcularGeometria } from '../src/escena3d/geometria.js';
import { PARAMETROS_PISO_POR_DEFECTO as piso } from '../src/persistencia/piso.js';

let ok = 0;
function caso(nombre, fn) {
  fn();
  ok += 1;
  console.log(`OK  ${nombre}`);
}

const cerca = (a, b, tol = 0.01) => Math.abs(a - b) < tol;

console.log('\n--- calcularGeometria (piso por defecto: ventanas 2.0m/1.8m, superficie 30m², techo 2.5m) ---');

const geo = calcularGeometria(piso);
console.log('geo:', JSON.stringify(geo, null, 2));

caso('anchoLateral = parametrosPiso.anchoHabitacion (parámetro editable, no un ratio inventado)', () => {
  assert.equal(geo.anchoLateral, piso.anchoHabitacion);
});

caso('profundidad = superficie / anchoHabitacion', () => {
  assert.ok(cerca(geo.profundidad, piso.superficie / piso.anchoHabitacion));
});

caso('altura = alturaTecho', () => {
  assert.equal(geo.altura, 2.5);
});

caso('ejeProfundidad y ejeLateral son unitarios', () => {
  const magProf = Math.hypot(geo.ejeProfundidad.x, geo.ejeProfundidad.z);
  const magLat = Math.hypot(geo.ejeLateral.x, geo.ejeLateral.z);
  assert.ok(cerca(magProf, 1));
  assert.ok(cerca(magLat, 1));
});

caso('ejeProfundidad y ejeLateral son perpendiculares (producto escalar 0)', () => {
  const dot = geo.ejeProfundidad.x * geo.ejeLateral.x + geo.ejeProfundidad.z * geo.ejeLateral.z;
  assert.ok(cerca(dot, 0));
});

caso('4 paredes: A, B opuestas + dos laterales', () => {
  assert.equal(geo.paredes.length, 4);
  assert.deepEqual(geo.paredes.map((p) => p.id), ['A', 'B', 'lateral1', 'lateral2']);
});

caso('pared A y pared B son de cristal; laterales no', () => {
  const [A, B, lateral1, lateral2] = geo.paredes;
  assert.equal(A.cristal, true);
  assert.equal(B.cristal, true);
  assert.equal(lateral1.cristal, false);
  assert.equal(lateral2.cristal, false);
});

caso('normal de la pared A es la dirección de brújula de orientacion=248°', () => {
  const [A] = geo.paredes;
  const rad = (248 * Math.PI) / 180;
  assert.ok(cerca(A.normal.x, Math.sin(rad)));
  assert.ok(cerca(A.normal.z, Math.cos(rad)));
});

caso('la pared B es la opuesta exacta de A (normal y centro invertidos)', () => {
  const [A, B] = geo.paredes;
  assert.ok(cerca(B.normal.x, -A.normal.x));
  assert.ok(cerca(B.normal.z, -A.normal.z));
  assert.ok(cerca(B.centro.x, -A.centro.x));
  assert.ok(cerca(B.centro.z, -A.centro.z));
});

caso('las paredes laterales son perpendiculares al eje A-B y opuestas entre sí', () => {
  const [, , lateral1, lateral2] = geo.paredes;
  assert.ok(cerca(lateral1.normal.x, -lateral2.normal.x));
  assert.ok(cerca(lateral1.normal.z, -lateral2.normal.z));
  const dot = lateral1.normal.x * geo.ejeProfundidad.x + lateral1.normal.z * geo.ejeProfundidad.z;
  assert.ok(cerca(dot, 0));
});

caso('anchoVentana de cada pared de cristal coincide con ventanas[i].ancho', () => {
  const [A, B] = geo.paredes;
  assert.equal(A.anchoVentana, piso.ventanas[0].ancho);
  assert.equal(B.anchoVentana, piso.ventanas[1].ancho);
});

caso('las esquinas del suelo coinciden con las esquinas de las paredes (mismo sistema rotado)', () => {
  const [A, B, lateral1, lateral2] = geo.paredes;
  const [s1, s2, s3, s4] = geo.esquinasSuelo;
  // s1 debe estar en la esquina compartida por la pared A y la lateral1.
  const distAaS1 = Math.hypot(s1.x - A.centro.x, s1.z - A.centro.z);
  assert.ok(cerca(distAaS1, geo.anchoLateral / 2, 0.05));
  // Las 4 esquinas del suelo forman el mismo rectángulo que envuelven las paredes.
  assert.equal(new Set([s1, s2, s3, s4].map((p) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`)).size, 4);
});

console.log(`\n${ok} casos OK (geometria.js)`);

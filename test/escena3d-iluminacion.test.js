// Casos de prueba manuales para iluminacion.js (Fase 6, checkpoint 3). Mismo
// patrón que test/model.test.js: cada caso imprime valores intermedios y los
// compara con un cálculo hecho a mano.

import assert from 'node:assert/strict';
import { direccionSol, factorIntensidadSol } from '../src/escena3d/iluminacion.js';
import { iProxy } from '../src/model/irradiancia.js';
import { I_MAX } from '../src/model/constantes.js';

let ok = 0;
function caso(nombre, fn) {
  fn();
  ok += 1;
  console.log(`OK  ${nombre}`);
}

const cerca = (a, b, tol = 0.01) => Math.abs(a - b) < tol;

console.log('\n--- direccionSol ---');

caso('sol en el cénit (elevación 90°) -> dirección (0,1,0)', () => {
  const d = direccionSol({ elevacion: 90, azimut: 123 });
  assert.ok(cerca(d.x, 0));
  assert.ok(cerca(d.y, 1));
  assert.ok(cerca(d.z, 0));
});

caso('sol en el horizonte al norte (elevación 0, azimut 0) -> dirección (0,0,1)', () => {
  const d = direccionSol({ elevacion: 0, azimut: 0 });
  assert.ok(cerca(d.x, 0));
  assert.ok(cerca(d.y, 0));
  assert.ok(cerca(d.z, 1));
});

caso('sol en el horizonte al este (elevación 0, azimut 90) -> dirección (1,0,0)', () => {
  const d = direccionSol({ elevacion: 0, azimut: 90 });
  assert.ok(cerca(d.x, 1));
  assert.ok(cerca(d.y, 0));
  assert.ok(cerca(d.z, 0));
});

caso('mismo azimut/elevación que usa geometria.js para orientación de ventana (248°): coherente con direccionAzimut', () => {
  const d = direccionSol({ elevacion: 0, azimut: 248 });
  const rad = (248 * Math.PI) / 180;
  assert.ok(cerca(d.x, Math.sin(rad)));
  assert.ok(cerca(d.z, Math.cos(rad)));
});

console.log('\n--- factorIntensidadSol ---');

caso('sol bajo el horizonte (elevación negativa) -> factor 0', () => {
  assert.equal(factorIntensidadSol({ elevacion: -5, azimut: 0, nubesPct: 0 }), 0);
});

caso('sol en el cénit sin nubes -> factor 1 (I_MAX exacto)', () => {
  const factor = factorIntensidadSol({ elevacion: 90, azimut: 0, nubesPct: 0 });
  assert.ok(cerca(factor, 1));
});

caso('reutiliza iProxy real, no una curva propia', () => {
  const sol = { elevacion: 35, azimut: 200, nubesPct: 40 };
  const esperado = Math.min(1, iProxy(sol.elevacion, sol.nubesPct) / I_MAX);
  assert.ok(cerca(factorIntensidadSol(sol), esperado));
});

caso('más nubes -> menor factor, para la misma elevación', () => {
  const sol = { elevacion: 35, azimut: 200 };
  const factorClaro = factorIntensidadSol({ ...sol, nubesPct: 0 });
  const factorNublado = factorIntensidadSol({ ...sol, nubesPct: 80 });
  assert.ok(factorNublado < factorClaro);
});

console.log(`\n${ok} casos OK (iluminacion.js)\n`);

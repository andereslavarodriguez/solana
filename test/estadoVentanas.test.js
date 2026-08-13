// Casos de prueba manuales para src/persistencia/estadoVentanas.js
// (Fase 5, ver docs/estado.md). Mismo patrón que test/persistencia.test.js:
// storage falso en memoria, sin depender del navegador.

import assert from 'node:assert/strict';
import { cargarEstadoVentanas, guardarEstadoVentanas } from '../src/persistencia/estadoVentanas.js';

let ok = 0;
function caso(nombre, fn) {
  fn();
  ok += 1;
  console.log(`OK  ${nombre}`);
}

function storageFalso() {
  const datos = new Map();
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, valor),
  };
}

const ventanas = [{ nombre: 'A' }, { nombre: 'B' }];

console.log('\n--- estadoVentanas (Fase 5) ---');

caso('sin nada guardado -> por defecto ambas cerradas y persianas abajo', () => {
  const storage = storageFalso();
  assert.deepEqual(cargarEstadoVentanas(storage, ventanas), {
    A: { abierta: false, persianaArriba: false },
    B: { abierta: false, persianaArriba: false },
  });
});

caso('guardar y volver a cargar -> se recupera el mismo estado', () => {
  const storage = storageFalso();
  const estado = {
    A: { abierta: true, persianaArriba: false },
    B: { abierta: false, persianaArriba: true },
  };
  guardarEstadoVentanas(storage, estado);
  assert.deepEqual(cargarEstadoVentanas(storage, ventanas), estado);
});

caso('lo guardado en el storage incluye version: 1', () => {
  const storage = storageFalso();
  guardarEstadoVentanas(storage, { A: { abierta: false, persianaArriba: false } });
  const crudo = JSON.parse(storage.getItem('solana:estadoVentanas'));
  assert.equal(crudo.version, 1);
});

caso('ventana nueva sin estado guardado -> se rellena con el valor por defecto', () => {
  const storage = storageFalso();
  guardarEstadoVentanas(storage, { A: { abierta: true, persianaArriba: true } });
  const cargado = cargarEstadoVentanas(storage, [{ nombre: 'A' }, { nombre: 'C' }]);
  assert.deepEqual(cargado, {
    A: { abierta: true, persianaArriba: true },
    C: { abierta: false, persianaArriba: false },
  });
});

console.log(`\n${ok} casos OK\n`);

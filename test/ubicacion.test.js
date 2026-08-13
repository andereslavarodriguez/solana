// Casos de prueba manuales para la persistencia de ubicación (spec.md §3.1),
// añadida en la Fase 4. Mismo patrón que test/persistencia.test.js: storage
// falso en memoria, sin depender del navegador.

import assert from 'node:assert/strict';
import { UBICACION_PISO } from '../src/data/ubicacion.js';
import { guardarUbicacion, cargarUbicacion } from '../src/persistencia/ubicacion.js';

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

console.log('\n--- ubicacion (§3.1) ---');

caso('sin nada guardado -> devuelve UBICACION_PISO por defecto', () => {
  const storage = storageFalso();
  assert.deepEqual(cargarUbicacion(storage), UBICACION_PISO);
});

caso('guardar y volver a cargar -> se recupera la misma ubicación', () => {
  const storage = storageFalso();
  const ubicacion = { lat: 40.4168, lon: -3.7038 };
  guardarUbicacion(storage, ubicacion);
  assert.deepEqual(cargarUbicacion(storage), ubicacion);
});

caso('lo guardado en el storage incluye version: 1', () => {
  const storage = storageFalso();
  guardarUbicacion(storage, UBICACION_PISO);
  const crudo = JSON.parse(storage.getItem('solana:ubicacion'));
  assert.equal(crudo.version, 1);
});

console.log(`\n${ok} casos OK\n`);

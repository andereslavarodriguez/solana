// Casos de prueba manuales para la Fase 3 (persistencia). Usa un storage
// falso en memoria (misma interfaz que localStorage: getItem/setItem) para
// no depender del navegador, igual que test/model.test.js no depende de red.

import assert from 'node:assert/strict';
import {
  PARAMETROS_PISO_POR_DEFECTO,
  guardarParametrosPiso,
  cargarParametrosPiso,
} from '../src/persistencia/piso.js';
import { guardarAnotacion, listarAnotaciones } from '../src/persistencia/anotaciones.js';

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

console.log('\n--- parametrosPiso (§3.4, §6.3) ---');

caso('sin nada guardado -> devuelve los valores por defecto', () => {
  const storage = storageFalso();
  const piso = cargarParametrosPiso(storage);
  assert.deepEqual(piso, PARAMETROS_PISO_POR_DEFECTO);
});

caso('guardar y volver a cargar -> se recuperan los mismos valores', () => {
  const storage = storageFalso();
  const piso = { ...PARAMETROS_PISO_POR_DEFECTO, UA: 75 };
  guardarParametrosPiso(storage, piso);
  const cargado = cargarParametrosPiso(storage);
  console.log(`    UA cargado = ${cargado.UA}`);
  assert.deepEqual(cargado, piso);
});

caso('lo guardado en el storage incluye version: 1', () => {
  const storage = storageFalso();
  guardarParametrosPiso(storage, PARAMETROS_PISO_POR_DEFECTO);
  const crudo = JSON.parse(storage.getItem('solana:parametrosPiso'));
  assert.equal(crudo.version, 1);
});

console.log('\n--- anotaciones (§3.5) ---');

caso('sin nada guardado -> lista vacía', () => {
  const storage = storageFalso();
  assert.deepEqual(listarAnotaciones(storage), []);
});

caso('guardar una anotación sin etiquetas -> id, timestamp y version generados, etiquetas = []', () => {
  const storage = storageFalso();
  const anotacion = guardarAnotacion(storage, { temperatura: 23.5 });
  console.log(`    anotacion = ${JSON.stringify(anotacion)}`);
  assert.equal(anotacion.temperatura, 23.5);
  assert.deepEqual(anotacion.etiquetas, []);
  assert.equal(anotacion.version, 1);
  assert.equal(typeof anotacion.id, 'string');
  assert.equal(typeof anotacion.timestamp, 'string');

  const lista = listarAnotaciones(storage);
  assert.equal(lista.length, 1);
  assert.deepEqual(lista[0], anotacion);
});

caso('guardar una anotación con etiquetas (§3.5: cocinando / climatizacion / masGente)', () => {
  const storage = storageFalso();
  const anotacion = guardarAnotacion(storage, {
    temperatura: 26,
    etiquetas: ['cocinando', 'climatizacion'],
  });
  assert.deepEqual(anotacion.etiquetas, ['cocinando', 'climatizacion']);
});

caso('dos anotaciones seguidas -> ids distintos, ambas conservadas en orden', () => {
  const storage = storageFalso();
  const a1 = guardarAnotacion(storage, { temperatura: 22 });
  const a2 = guardarAnotacion(storage, { temperatura: 22.5 });
  assert.notEqual(a1.id, a2.id);
  const lista = listarAnotaciones(storage);
  assert.equal(lista.length, 2);
  assert.deepEqual(lista, [a1, a2]);
});

console.log(`\n${ok} casos OK\n`);

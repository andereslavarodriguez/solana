// Casos de prueba manuales para la Fase 3 (persistencia). Usa un storage
// falso en memoria (misma interfaz que localStorage: getItem/setItem) para
// no depender del navegador, igual que test/model.test.js no depende de red.

import assert from 'node:assert/strict';
import {
  PARAMETROS_PISO_POR_DEFECTO,
  guardarParametrosPiso,
  cargarParametrosPiso,
} from '../src/persistencia/piso.js';
import {
  guardarAnotacion,
  listarAnotaciones,
  borrarAnotacion,
} from '../src/persistencia/anotaciones.js';
import { guardarGemelo, cargarGemelo } from '../src/persistencia/gemelo.js';
import { estadoGemeloInicial } from '../src/model/gemelo.js';

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

caso('sin predicho/regresores (Fase 7) -> quedan a null, no undefined', () => {
  const storage = storageFalso();
  const anotacion = guardarAnotacion(storage, { temperatura: 21 });
  assert.equal(anotacion.predicho, null);
  assert.equal(anotacion.avgConduccion, null);
  assert.equal(anotacion.avgSolarVent, null);
});

caso('con predicho/regresores (Fase 7) -> se guardan y se recuperan tal cual', () => {
  const storage = storageFalso();
  const anotacion = guardarAnotacion(storage, {
    temperatura: 21,
    predicho: 21.8,
    avgConduccion: -3.2,
    avgSolarVent: 45.6,
  });
  assert.equal(anotacion.predicho, 21.8);
  const lista = listarAnotaciones(storage);
  assert.equal(lista[0].predicho, 21.8);
  assert.equal(lista[0].avgConduccion, -3.2);
  assert.equal(lista[0].avgSolarVent, 45.6);
});

caso('borrarAnotacion: quita la anotación con ese id, conserva el resto en orden', () => {
  const storage = storageFalso();
  const a1 = guardarAnotacion(storage, { temperatura: 21 });
  const a2 = guardarAnotacion(storage, { temperatura: 22 });
  const a3 = guardarAnotacion(storage, { temperatura: 23 });

  borrarAnotacion(storage, a2.id);

  const lista = listarAnotaciones(storage);
  assert.equal(lista.length, 2);
  assert.deepEqual(
    lista.map((a) => a.id),
    [a1.id, a3.id],
  );
});

caso('borrarAnotacion: id que no existe -> no cambia nada', () => {
  const storage = storageFalso();
  guardarAnotacion(storage, { temperatura: 21 });
  borrarAnotacion(storage, 'no-existe');
  assert.equal(listarAnotaciones(storage).length, 1);
});

caso('borrarAnotacion: invalida el predicho/regresores de la siguiente anotación (Fase 7), ya no describen el hueco real', () => {
  const storage = storageFalso();
  const a1 = guardarAnotacion(storage, { temperatura: 21 });
  const a2 = guardarAnotacion(storage, {
    temperatura: 22,
    predicho: 21.8,
    avgConduccion: -1.5,
    avgSolarVent: 10,
  });
  guardarAnotacion(storage, {
    temperatura: 23,
    predicho: 22.1,
    avgConduccion: -1.2,
    avgSolarVent: 5,
  });

  borrarAnotacion(storage, a1.id);

  const lista = listarAnotaciones(storage);
  const a2Restante = lista.find((a) => a.id === a2.id);
  assert.equal(a2Restante.predicho, null);
  assert.equal(a2Restante.avgConduccion, null);
  assert.equal(a2Restante.avgSolarVent, null);
  // La tercera anotación no estaba justo después de la borrada -> no se toca.
  assert.equal(lista[1].predicho, 22.1);
});

caso('borrarAnotacion: borrar la última anotación no invalida nada (no hay siguiente)', () => {
  const storage = storageFalso();
  guardarAnotacion(storage, { temperatura: 21 });
  const a2 = guardarAnotacion(storage, {
    temperatura: 22,
    predicho: 21.8,
    avgConduccion: -1.5,
    avgSolarVent: 10,
  });

  borrarAnotacion(storage, a2.id);

  const lista = listarAnotaciones(storage);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].predicho, null); // no tocado, ya era null desde el principio
});

console.log('\n--- gemelo en vivo (Fase 7) ---');

caso('sin nada guardado -> cargarGemelo devuelve null', () => {
  const storage = storageFalso();
  assert.equal(cargarGemelo(storage), null);
});

caso('guardar y volver a cargar -> se recupera el mismo estado', () => {
  const storage = storageFalso();
  const estado = estadoGemeloInicial(21.5, '2026-01-01T10:00:00.000Z');
  guardarGemelo(storage, estado);
  const cargado = cargarGemelo(storage);
  assert.deepEqual(cargado, estado);
});

caso('lo guardado en el storage incluye version: 1', () => {
  const storage = storageFalso();
  guardarGemelo(storage, estadoGemeloInicial(20, '2026-01-01T10:00:00.000Z'));
  const crudo = JSON.parse(storage.getItem('solana:gemelo'));
  assert.equal(crudo.version, 1);
});

console.log(`\n${ok} casos OK\n`);

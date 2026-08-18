// Casos de prueba manuales para src/persistencia/plano.js (Fase 1 de la
// generalización a cualquier casa, ver docs/estado.md). Mismo patrón que
// test/persistencia.test.js: storage falso en memoria, sin navegador.

import assert from 'node:assert/strict';
import { guardarPlano, cargarPlano } from '../src/persistencia/plano.js';
import { validarPlano, ventanasDelModelo } from '../src/model/plano.js';

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

console.log('\n--- persistencia/plano.js ---');

caso('sin nada guardado -> plano por defecto válido, equivalente al piso real de spec.md §3.4', () => {
  const storage = storageFalso();
  const plano = cargarPlano(storage);
  assert.ok(validarPlano(plano).valido);
  assert.equal(plano.orientacionCasa, 248);
  assert.equal(ventanasDelModelo(plano).length, 2);
});

caso('guardarPlano + cargarPlano -> round-trip exacto (salvo el envoltorio version)', () => {
  const storage = storageFalso();
  const original = cargarPlano(storage); // plano por defecto, como base
  guardarPlano(storage, original);
  const recargado = cargarPlano(storage);
  assert.deepEqual(recargado, original);
});

caso('migración: datos del esquema anterior (anchoHabitacion + ventanas fijas) sin plano guardado', () => {
  const storage = storageFalso();
  storage.setItem(
    'solana:parametrosPiso',
    JSON.stringify({
      version: 1,
      superficie: 22,
      anchoHabitacion: 4,
      alturaTecho: 2.6,
      ventanas: [
        { nombre: 'A', orientacion: 200, ancho: 1.6, alturaEdificioEnfrente: 10, distanciaEdificioEnfrente: 15 },
        { nombre: 'B', orientacion: 20, ancho: 1.4, alturaEdificioEnfrente: 6, distanciaEdificioEnfrente: 12 },
      ],
    }),
  );

  const plano = cargarPlano(storage);
  assert.ok(validarPlano(plano).valido);
  assert.equal(plano.orientacionCasa, 200);
  const ventanas = ventanasDelModelo(plano);
  assert.equal(ventanas.length, 2);
  assert.ok(ventanas.some((v) => v.orientacion === 200));
  assert.ok(ventanas.some((v) => v.orientacion === 20));
});

caso('sin plano guardado NI datos del esquema anterior (localStorage vacío de verdad) -> plano por defecto', () => {
  const storage = storageFalso();
  storage.setItem('solana:otraCosa', 'x'); // ruido irrelevante, no debe confundir la migración
  const plano = cargarPlano(storage);
  assert.equal(plano.orientacionCasa, 248);
});

caso('plano guardado tiene prioridad sobre cualquier dato antiguo que quede en parametrosPiso', () => {
  const storage = storageFalso();
  storage.setItem(
    'solana:parametrosPiso',
    JSON.stringify({ version: 1, superficie: 22, anchoHabitacion: 4, ventanas: [{ orientacion: 0, ancho: 1, alturaEdificioEnfrente: 0, distanciaEdificioEnfrente: 10 }] }),
  );
  const planoNuevo = cargarPlano(storage);
  planoNuevo.orientacionCasa = 315;
  guardarPlano(storage, planoNuevo);

  const recargado = cargarPlano(storage);
  assert.equal(recargado.orientacionCasa, 315);
});

console.log(`\n${ok} casos OK (persistencia-plano.test.js)\n`);

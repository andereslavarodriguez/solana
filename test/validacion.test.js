// Casos de prueba manuales para la validación de la pantalla de parámetros
// (Fase 4). Funciones puras, sin DOM — mismo patrón que test/model.test.js.

import assert from 'node:assert/strict';
import { PARAMETROS_PISO_POR_DEFECTO } from '../src/persistencia/piso.js';
import { UBICACION_PISO } from '../src/data/ubicacion.js';
import { validarParametrosPiso, validarUbicacion, validarCampoNumerico, RANGOS } from '../src/ui/validacion.js';

let ok = 0;
function caso(nombre, fn) {
  fn();
  ok += 1;
  console.log(`OK  ${nombre}`);
}

console.log('\n--- validarCampoNumerico ---');

caso('valor dentro de rango -> null', () => {
  assert.equal(validarCampoNumerico(50, { min: 5, max: 200 }), null);
});

caso('vacío -> error "Introduce un número"', () => {
  assert.equal(validarCampoNumerico('', { min: 5, max: 200 }), 'Introduce un número');
});

caso('no numérico -> error "Introduce un número"', () => {
  assert.equal(validarCampoNumerico('abc', { min: 5, max: 200 }), 'Introduce un número');
});

caso('por debajo del mínimo -> error de rango', () => {
  assert.equal(validarCampoNumerico(1, { min: 5, max: 200 }), 'Debe estar entre 5 y 200');
});

caso('por encima del máximo -> error de rango', () => {
  assert.equal(validarCampoNumerico(500, { min: 5, max: 200 }), 'Debe estar entre 5 y 200');
});

caso('límites inclusive -> válidos', () => {
  assert.equal(validarCampoNumerico(5, { min: 5, max: 200 }), null);
  assert.equal(validarCampoNumerico(200, { min: 5, max: 200 }), null);
});

console.log('\n--- validarParametrosPiso (§3.4, §6.3) ---');

caso('valores por defecto -> válido, sin errores', () => {
  const { valido, errores } = validarParametrosPiso(PARAMETROS_PISO_POR_DEFECTO);
  console.log(`    errores = ${JSON.stringify(errores)}`);
  assert.equal(valido, true);
  assert.deepEqual(errores, {});
});

caso('superficie fuera de rango -> inválido con error en "superficie"', () => {
  const datos = { ...PARAMETROS_PISO_POR_DEFECTO, superficie: 500 };
  const { valido, errores } = validarParametrosPiso(datos);
  assert.equal(valido, false);
  assert.equal(errores.superficie, `Debe estar entre ${RANGOS.superficie.min} y ${RANGOS.superficie.max}`);
});

caso('SHGC no numérico -> inválido con error en "SHGC"', () => {
  const datos = { ...PARAMETROS_PISO_POR_DEFECTO, SHGC: 'mucho' };
  const { valido, errores } = validarParametrosPiso(datos);
  assert.equal(valido, false);
  assert.equal(errores.SHGC, 'Introduce un número');
});

caso('bandaConfort.min >= bandaConfort.max -> inválido con error en "bandaConfort.max"', () => {
  const datos = { ...PARAMETROS_PISO_POR_DEFECTO, bandaConfort: { min: 25, max: 21 } };
  const { valido, errores } = validarParametrosPiso(datos);
  assert.equal(valido, false);
  assert.equal(errores['bandaConfort.max'], 'Debe ser mayor que el mínimo de la banda');
});

caso('bandaConfort.min == bandaConfort.max -> inválido (no basta con no ser menor)', () => {
  const datos = { ...PARAMETROS_PISO_POR_DEFECTO, bandaConfort: { min: 22, max: 22 } };
  const { valido } = validarParametrosPiso(datos);
  assert.equal(valido, false);
});

caso('ventana con orientación fuera de rango -> error indexado "ventanas.0.orientacion"', () => {
  const datos = {
    ...PARAMETROS_PISO_POR_DEFECTO,
    ventanas: [
      { ...PARAMETROS_PISO_POR_DEFECTO.ventanas[0], orientacion: 400 },
      PARAMETROS_PISO_POR_DEFECTO.ventanas[1],
    ],
  };
  const { valido, errores } = validarParametrosPiso(datos);
  assert.equal(valido, false);
  assert.equal(errores['ventanas.0.orientacion'], `Debe estar entre ${RANGOS.ventanaOrientacion.min} y ${RANGOS.ventanaOrientacion.max}`);
  assert.equal(errores['ventanas.1.orientacion'], undefined);
});

caso('ventana con distancia a edificio = 0 -> inválido (evita división por cero en sombra.js)', () => {
  const datos = {
    ...PARAMETROS_PISO_POR_DEFECTO,
    ventanas: [
      { ...PARAMETROS_PISO_POR_DEFECTO.ventanas[0], distanciaEdificioEnfrente: 0 },
      PARAMETROS_PISO_POR_DEFECTO.ventanas[1],
    ],
  };
  const { valido, errores } = validarParametrosPiso(datos);
  assert.equal(valido, false);
  assert.equal(errores['ventanas.0.distanciaEdificioEnfrente'], `Debe estar entre ${RANGOS.distanciaEdificioEnfrente.min} y ${RANGOS.distanciaEdificioEnfrente.max}`);
});

caso('anchoHabitacion fuera de rango -> inválido con error en "anchoHabitacion"', () => {
  const datos = { ...PARAMETROS_PISO_POR_DEFECTO, anchoHabitacion: 1 };
  const { valido, errores } = validarParametrosPiso(datos);
  assert.equal(valido, false);
  assert.equal(errores.anchoHabitacion, `Debe estar entre ${RANGOS.anchoHabitacion.min} y ${RANGOS.anchoHabitacion.max}`);
});

caso('ventana más ancha que anchoHabitacion -> inválido con error en "ventanas.0.ancho"', () => {
  const datos = {
    ...PARAMETROS_PISO_POR_DEFECTO,
    anchoHabitacion: 3,
    ventanas: [
      { ...PARAMETROS_PISO_POR_DEFECTO.ventanas[0], ancho: 4 },
      PARAMETROS_PISO_POR_DEFECTO.ventanas[1],
    ],
  };
  const { valido, errores } = validarParametrosPiso(datos);
  assert.equal(valido, false);
  assert.equal(errores['ventanas.0.ancho'], 'Debe ser menor que el ancho de la habitación');
});

console.log('\n--- validarUbicacion (§3.1) ---');

caso('UBICACION_PISO por defecto -> válido', () => {
  const { valido, errores } = validarUbicacion(UBICACION_PISO);
  assert.equal(valido, true);
  assert.deepEqual(errores, {});
});

caso('lat fuera de rango -> inválido con error en "lat"', () => {
  const { valido, errores } = validarUbicacion({ lat: 95, lon: 0 });
  assert.equal(valido, false);
  assert.equal(errores.lat, `Debe estar entre ${RANGOS.lat.min} y ${RANGOS.lat.max}`);
});

caso('lon fuera de rango -> inválido con error en "lon"', () => {
  const { valido, errores } = validarUbicacion({ lat: 0, lon: -200 });
  assert.equal(valido, false);
  assert.equal(errores.lon, `Debe estar entre ${RANGOS.lon.min} y ${RANGOS.lon.max}`);
});

console.log(`\n${ok} casos OK\n`);

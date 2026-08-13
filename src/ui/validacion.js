// Validación de los formularios de la pantalla de parámetros (Fase 4,
// spec.md §3.4, §6.3). Funciones puras (sin DOM) para poder testear con
// assert, igual que src/model/ y src/persistencia/.
//
// Rechazo estricto en submit: fuera de rango o no numérico no se guarda
// (sin redondeo/clamp silencioso — el usuario controla el valor a
// propósito). Los rangos son también la fuente de min/max de los <input
// type="number"> en la UI, para no duplicarlos.

export const RANGOS = {
  superficie: { min: 5, max: 200 },
  alturaTecho: { min: 2.0, max: 4.0 },
  UA: { min: 5, max: 300 },
  factorCapacidad: { min: 1, max: 20 },
  SHGC: { min: 0, max: 1 },
  renovacionesHora: { min: 0, max: 20 },
  bandaConfortMin: { min: 10, max: 30 },
  bandaConfortMax: { min: 10, max: 30 },
  ventanaOrientacion: { min: 0, max: 360 },
  ventanaAncho: { min: 0.3, max: 10 },
  alturaEdificioEnfrente: { min: 0, max: 200 },
  distanciaEdificioEnfrente: { min: 1, max: 500 },
  lat: { min: -90, max: 90 },
  lon: { min: -180, max: 180 },
  // Temperatura interior anotada a mano (spec.md §3.5, Fase 5). Rango
  // generoso de plausibilidad para un interior habitado, no una banda de
  // confort (esa es bandaConfort, un parámetro aparte).
  temperaturaInterior: { min: 0, max: 45 },
};

export function validarCampoNumerico(valor, rango) {
  const n = Number(valor);
  if (valor === '' || valor === null || valor === undefined || Number.isNaN(n)) {
    return 'Introduce un número';
  }
  if (n < rango.min || n > rango.max) {
    return `Debe estar entre ${rango.min} y ${rango.max}`;
  }
  return null;
}

function validarCampo(errores, clave, valor, rango) {
  const error = validarCampoNumerico(valor, rango);
  if (error) errores[clave] = error;
}

export function validarParametrosPiso(datos) {
  const errores = {};

  validarCampo(errores, 'superficie', datos.superficie, RANGOS.superficie);
  validarCampo(errores, 'alturaTecho', datos.alturaTecho, RANGOS.alturaTecho);
  validarCampo(errores, 'UA', datos.UA, RANGOS.UA);
  validarCampo(errores, 'factorCapacidad', datos.factorCapacidad, RANGOS.factorCapacidad);
  validarCampo(errores, 'SHGC', datos.SHGC, RANGOS.SHGC);
  validarCampo(errores, 'renovacionesHora', datos.renovacionesHora, RANGOS.renovacionesHora);
  validarCampo(errores, 'bandaConfort.min', datos.bandaConfort?.min, RANGOS.bandaConfortMin);
  validarCampo(errores, 'bandaConfort.max', datos.bandaConfort?.max, RANGOS.bandaConfortMax);

  if (!errores['bandaConfort.min'] && !errores['bandaConfort.max']) {
    if (Number(datos.bandaConfort.min) >= Number(datos.bandaConfort.max)) {
      errores['bandaConfort.max'] = 'Debe ser mayor que el mínimo de la banda';
    }
  }

  (datos.ventanas || []).forEach((ventana, i) => {
    validarCampo(errores, `ventanas.${i}.orientacion`, ventana.orientacion, RANGOS.ventanaOrientacion);
    validarCampo(errores, `ventanas.${i}.ancho`, ventana.ancho, RANGOS.ventanaAncho);
    validarCampo(
      errores,
      `ventanas.${i}.alturaEdificioEnfrente`,
      ventana.alturaEdificioEnfrente,
      RANGOS.alturaEdificioEnfrente,
    );
    validarCampo(
      errores,
      `ventanas.${i}.distanciaEdificioEnfrente`,
      ventana.distanciaEdificioEnfrente,
      RANGOS.distanciaEdificioEnfrente,
    );
  });

  return { valido: Object.keys(errores).length === 0, errores };
}

export function validarUbicacion(datos) {
  const errores = {};
  validarCampo(errores, 'lat', datos.lat, RANGOS.lat);
  validarCampo(errores, 'lon', datos.lon, RANGOS.lon);
  return { valido: Object.keys(errores).length === 0, errores };
}

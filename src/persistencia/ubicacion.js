// Persistencia de la ubicación del piso (spec.md §3.1: se introduce una vez
// y queda fija). Módulo separado de piso.js porque es un concepto distinto
// en la spec (§3.1 vs §3.4) y ya vivía en su propio módulo de datos
// (src/data/ubicacion.js), del que se toma el valor de partida.

import { UBICACION_PISO } from '../data/ubicacion.js';

const CLAVE = 'solana:ubicacion';

export function guardarUbicacion(storage, ubicacion) {
  storage.setItem(CLAVE, JSON.stringify({ version: 1, ...ubicacion }));
}

export function cargarUbicacion(storage) {
  const guardado = storage.getItem(CLAVE);
  if (!guardado) return { ...UBICACION_PISO };

  const { version, ...ubicacion } = JSON.parse(guardado);
  return ubicacion;
}

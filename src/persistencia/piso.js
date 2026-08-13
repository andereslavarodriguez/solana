// Persistencia de los parámetros del piso (spec.md §3.4, §6.3).
//
// `storage` se recibe como parámetro (interfaz getItem/setItem, igual que
// localStorage) en vez de leer `window.localStorage` directamente, para
// poder testear con un storage falso en memoria sin depender del navegador.

import { BANDA_CONFORT } from '../model/constantes.js';

const CLAVE = 'solana:parametrosPiso';

// Valores de partida cuando no hay nada guardado todavía (primer arranque).
// Geometría de ventanas y edificios enfrente: valores reales de spec.md
// §3.4. UA/factorCapacidad/SHGC/renovacionesHora: mismos valores de prueba
// que test/model.test.js — no son los defaults "finales", eso lo decide la
// pantalla de parámetros de la Fase 4.
export const PARAMETROS_PISO_POR_DEFECTO = {
  superficie: 30,
  alturaTecho: 2.5,
  UA: 60,
  factorCapacidad: 6,
  SHGC: 0.6,
  renovacionesHora: 3,
  bandaConfort: { ...BANDA_CONFORT },
  ventanas: [
    { nombre: 'A', orientacion: 248, ancho: 2.0, alturaEdificioEnfrente: 15, distanciaEdificioEnfrente: 45 },
    { nombre: 'B', orientacion: 68, ancho: 1.8, alturaEdificioEnfrente: 12, distanciaEdificioEnfrente: 20 },
  ],
};

export function guardarParametrosPiso(storage, parametrosPiso) {
  storage.setItem(CLAVE, JSON.stringify({ version: 1, ...parametrosPiso }));
}

export function cargarParametrosPiso(storage) {
  const guardado = storage.getItem(CLAVE);
  if (!guardado) return JSON.parse(JSON.stringify(PARAMETROS_PISO_POR_DEFECTO));

  const { version, ...parametrosPiso } = JSON.parse(guardado);
  return parametrosPiso;
}

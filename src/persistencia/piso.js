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
  // Ancho lateral de la habitación (m), perpendicular al eje ventana A-B —
  // parametrosPiso no tenía ninguna dimensión de planta, solo `superficie`
  // total (spec.md §3.4, sin editor visual de planta en v1). La escena 3D
  // (Fase 6) necesita separar esa área en ancho×profundidad para dibujar
  // una caja, y en vez de inventar un ratio fijo en el código de la escena,
  // se expone como parámetro editable aquí: profundidad se deriva siempre
  // como `superficie / anchoHabitacion` (superficie sigue siendo la única
  // fuente de verdad para la capacidad térmica en termico.js). Default
  // 4.8m: con superficie=30 da una proporción ~1.3:1, verificada
  // visualmente en el checkpoint 1 de la Fase 6 antes de exponerla como
  // parámetro.
  anchoHabitacion: 4.8,
  UA: 60,
  factorCapacidad: 6,
  SHGC: 0.6,
  renovacionesHora: 3,
  // Fracción del caudal de aire nominal (renovacionesHora) que sigue
  // entrando con la persiana bajada, respecto a con la persiana subida
  // (mejora post-lanzamiento, 2026-08-17, ver docs/estado.md — antes
  // termico.js ignoraba la persiana al calcular la ventilación). 0.15
  // porque una persiana enrollable normal, bajada del todo, deja pasar
  // algo de aire por los huecos pero corta la mayor parte del caudal —
  // elegido a ojo, sin base empírica todavía.
  fraccionVentPersianaBajada: 0.15,
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

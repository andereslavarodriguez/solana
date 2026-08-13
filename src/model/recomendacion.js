// Motor de recomendación por ventana (spec.md §5)
//
// Para cada ventana, dos decisiones independientes que reutilizan la misma
// simulación de horizonte (§4): abrir/cerrar la ventana y subir/bajar la
// persiana.

import { simularHorizonte } from './termico.js';

function distanciaABanda(tIn, banda) {
  if (tIn < banda.min) return banda.min - tIn;
  if (tIn > banda.max) return tIn - banda.max;
  return 0;
}

function distanciaAcumulada(trayectoria, banda) {
  return trayectoria.reduce((acc, t) => acc + distanciaABanda(t, banda), 0);
}

function clonarEstados(estadosVentanas) {
  return JSON.parse(JSON.stringify(estadosVentanas));
}

// Abrir/cerrar: simula el horizonte con la ventana abierta todo el rato y con
// la ventana cerrada todo el rato (el resto de estados —persianas, la otra
// ventana— se dejan como están ahora mismo), y compara cuál de las dos
// trayectorias queda más cerca de la banda de confort en conjunto.
// Empate -> se recomienda cerrar (decisión de diseño: por defecto no abrir si
// no hay beneficio claro, anotada en docs/estado.md).
export function recomendarVentana(
  nombreVentana,
  tInActual,
  pronostico,
  estadosVentanasActuales,
  parametrosPiso
) {
  const banda = parametrosPiso.bandaConfort;
  const estadosAbierta = clonarEstados(estadosVentanasActuales);
  estadosAbierta[nombreVentana].abierta = true;

  const estadosCerrada = clonarEstados(estadosVentanasActuales);
  estadosCerrada[nombreVentana].abierta = false;

  const trayAbierta = simularHorizonte(tInActual, pronostico, estadosAbierta, parametrosPiso);
  const trayCerrada = simularHorizonte(tInActual, pronostico, estadosCerrada, parametrosPiso);

  const distAbierta = distanciaAcumulada(trayAbierta, banda);
  const distCerrada = distanciaAcumulada(trayCerrada, banda);

  return {
    accion: distAbierta < distCerrada ? 'abrir' : 'cerrar',
    trayectorias: { abierta: trayAbierta, cerrada: trayCerrada },
  };
}

// Subir/bajar persiana (regla acordada, ver docs/estado.md):
// - Si T_in ya supera el límite superior de confort ahora mismo -> bajar,
//   sin mirar T_out.
// - Si no, simula T_in en el horizonte con la persiana arriba (el resto de
//   estados como están ahora). Si esa trayectoria se mantiene dentro de la
//   banda sin superar el límite superior en ningún punto -> arriba.
//   Si lo supera en algún punto -> bajar.
export function recomendarPersiana(
  nombreVentana,
  tInActual,
  pronostico,
  estadosVentanasActuales,
  parametrosPiso
) {
  const banda = parametrosPiso.bandaConfort;
  if (tInActual > banda.max) {
    return {
      accion: 'bajar',
      motivo: 'T_in ya supera el límite de confort ahora mismo',
      trayectoria: null,
    };
  }

  const estadosArriba = clonarEstados(estadosVentanasActuales);
  estadosArriba[nombreVentana].persianaArriba = true;

  const trayectoria = simularHorizonte(tInActual, pronostico, estadosArriba, parametrosPiso);
  const superaLimite = trayectoria.some((t) => t > banda.max);

  return {
    accion: superaLimite ? 'bajar' : 'arriba',
    motivo: superaLimite
      ? 'con la persiana arriba se supera el límite superior de confort en el horizonte'
      : 'con la persiana arriba T_in se mantiene dentro de la banda de confort',
    trayectoria,
  };
}

// Pendiente explícito para Fase 2+: histéresis / banda muerta en ambas
// recomendaciones para evitar oscilación cuando se alimenten con datos en
// vivo (anotado en docs/estado.md).

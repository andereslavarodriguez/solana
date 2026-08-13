// Modelo térmico RC de un nodo (spec.md §4)
//
// dT_in/dt = (1/C) · [UA·(T_out−T_in) + Q_solar(t) + Q_vent(t)]

import { iProxy, cosIncidencia } from './irradiancia.js';
import { ventanaSombreada, elevacionLimiteSombra } from './sombra.js';
import { DENSIDAD_AIRE, CALOR_ESPECIFICO_AIRE } from './constantes.js';

// Altura de referencia de la ventana para el cálculo de sombra: punto medio
// vertical del hueco (las ventanas son suelo-a-techo, decisión anotada en
// docs/estado.md — ni el alféizar ni el techo, el punto medio).
function alturaVentanaMedia(parametrosPiso) {
  return parametrosPiso.alturaTecho / 2;
}

function areaVentana(ventana, parametrosPiso) {
  return ventana.ancho * parametrosPiso.alturaTecho;
}

function volumenZona(parametrosPiso) {
  return parametrosPiso.superficie * parametrosPiso.alturaTecho;
}

export function capacidadTermica(parametrosPiso) {
  return (
    volumenZona(parametrosPiso) *
    DENSIDAD_AIRE *
    CALOR_ESPECIFICO_AIRE *
    parametrosPiso.factorCapacidad
  );
}

// Q_solar de una ventana concreta en el instante t. 0 si la persiana está
// bajada, si está en sombra (§4.1) o si el sol no incide de frente (§4.1/irradiancia.js).
export function qSolarVentana(ventana, estadoVentana, sol, parametrosPiso) {
  if (!estadoVentana.persianaArriba) return 0;

  const alturaVentana = alturaVentanaMedia(parametrosPiso);
  const elevLimite = elevacionLimiteSombra(
    ventana.alturaEdificioEnfrente,
    alturaVentana,
    ventana.distanciaEdificioEnfrente
  );
  if (ventanaSombreada(sol.elevacion, elevLimite)) return 0;

  const cosInc = cosIncidencia(sol.elevacion, sol.azimut, ventana.orientacion);
  if (cosInc <= 0) return 0;

  const irr = iProxy(sol.elevacion, sol.nubesPct);
  const area = areaVentana(ventana, parametrosPiso);
  return area * parametrosPiso.SHGC * irr * cosInc;
}

export function qSolarTotal(ventanas, estadosVentanas, sol, parametrosPiso) {
  return ventanas.reduce(
    (acc, v) => acc + qSolarVentana(v, estadosVentanas[v.nombre], sol, parametrosPiso),
    0
  );
}

// Q_vent de una ventana concreta: 0 si está cerrada.
export function qVentVentana(ventana, estadoVentana, tIn, tOut, parametrosPiso) {
  if (!estadoVentana.abierta) return 0;

  const caudalM3s = (parametrosPiso.renovacionesHora * volumenZona(parametrosPiso)) / 3600;
  return caudalM3s * DENSIDAD_AIRE * CALOR_ESPECIFICO_AIRE * (tOut - tIn);
}

export function qVentTotal(ventanas, estadosVentanas, tIn, tOut, parametrosPiso) {
  return ventanas.reduce(
    (acc, v) => acc + qVentVentana(v, estadosVentanas[v.nombre], tIn, tOut, parametrosPiso),
    0
  );
}

export function derivadaTemperatura(tIn, tOut, sol, estadosVentanas, parametrosPiso) {
  const C = capacidadTermica(parametrosPiso);
  const qConduccion = parametrosPiso.UA * (tOut - tIn);
  const qSolar = qSolarTotal(parametrosPiso.ventanas, estadosVentanas, sol, parametrosPiso);
  const qVent = qVentTotal(parametrosPiso.ventanas, estadosVentanas, tIn, tOut, parametrosPiso);
  return (qConduccion + qSolar + qVent) / C;
}

export function pasoEuler(tIn, tOut, sol, estadosVentanas, parametrosPiso, dtSegundos) {
  const dTdt = derivadaTemperatura(tIn, tOut, sol, estadosVentanas, parametrosPiso);
  return tIn + dTdt * dtSegundos;
}

// Simula la trayectoria de T_in a lo largo de un pronóstico. `pronostico` es un
// array de puntos { tOut, sol: { elevacion, azimut, nubesPct } }, uno por paso
// de dtSegundos (900s = 15min por defecto, igual que minutely_15 de Open-Meteo).
// `estadosVentanas` se mantiene fijo durante todo el horizonte: cada llamada
// simula una única estrategia de control (p.ej. "ventana A abierta todo el rato").
export function simularHorizonte(
  tInInicial,
  pronostico,
  estadosVentanas,
  parametrosPiso,
  dtSegundos = 900
) {
  let tIn = tInInicial;
  const trayectoria = [tIn];
  for (const punto of pronostico) {
    tIn = pasoEuler(tIn, punto.tOut, punto.sol, estadosVentanas, parametrosPiso, dtSegundos);
    trayectoria.push(tIn);
  }
  return trayectoria;
}

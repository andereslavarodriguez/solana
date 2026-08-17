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

// Mejora post-lanzamiento (2026-08-17, docs/estado.md): la ventilación por
// una ventana abierta no es un caudal fijo — depende de si la persiana deja
// pasar el aire y de si hace viento de verdad.
//
// Viento real: con más viento entra más aire que en calma, para el mismo
// hueco abierto. `velocidadViento` (km/h, mismo dato ya pedido a Open-Meteo,
// wind_speed_10m) escala `renovacionesHora` linealmente por encima de 1,
// con un tope para no disparar el resultado con viento de temporal.
// Simplificación deliberada: solo se tiene en cuenta la VELOCIDAD, no la
// dirección relativa a la fachada (viento de cara vs. de espaldas a la
// ventana) — matiz real pero que añadiría un parámetro más sin base
// empírica clara, fuera de alcance de esta mejora. Sin dato de viento
// (`velocidadViento` null/undefined, p.ej. en tests o simulaciones que no
// lo pasan) el factor es 1: caudal nominal, sin escalar — no se asume ni
// calma ni viento.
// V_REF_VIENTO_KMH/FACTOR_VIENTO_MAX elegidos a ojo, documentados en
// docs/estado.md, pendientes de ajustar con uso real (mismo criterio que
// otros parámetros del proyecto sin base empírica todavía).
const V_REF_VIENTO_KMH = 15;
const FACTOR_VIENTO_MAX = 3;

function factorViento(velocidadViento) {
  if (velocidadViento == null) return 1;
  return Math.min(1 + velocidadViento / V_REF_VIENTO_KMH, FACTOR_VIENTO_MAX);
}

// Q_vent de una ventana concreta: 0 si está cerrada. Con la persiana bajada
// entra bastante menos aire que con ella subida — `fraccionVentPersianaBajada`
// (parametrosPiso, 0-1) es la fracción del caudal nominal que sigue entrando
// con la persiana bajada (una persiana enrollable normal deja pasar algo de
// aire por los huecos, no lo bloquea del todo).
export function qVentVentana(ventana, estadoVentana, tIn, tOut, parametrosPiso, velocidadViento = null) {
  if (!estadoVentana.abierta) return 0;

  const factorPersiana = estadoVentana.persianaArriba
    ? 1
    : parametrosPiso.fraccionVentPersianaBajada;

  const renovacionesEfectivas =
    parametrosPiso.renovacionesHora * factorPersiana * factorViento(velocidadViento);

  const caudalM3s = (renovacionesEfectivas * volumenZona(parametrosPiso)) / 3600;
  return caudalM3s * DENSIDAD_AIRE * CALOR_ESPECIFICO_AIRE * (tOut - tIn);
}

export function qVentTotal(ventanas, estadosVentanas, tIn, tOut, parametrosPiso, velocidadViento = null) {
  return ventanas.reduce(
    (acc, v) => acc + qVentVentana(v, estadosVentanas[v.nombre], tIn, tOut, parametrosPiso, velocidadViento),
    0
  );
}

export function derivadaTemperatura(tIn, tOut, sol, estadosVentanas, parametrosPiso, velocidadViento = null) {
  const C = capacidadTermica(parametrosPiso);
  const qConduccion = parametrosPiso.UA * (tOut - tIn);
  const qSolar = qSolarTotal(parametrosPiso.ventanas, estadosVentanas, sol, parametrosPiso);
  const qVent = qVentTotal(parametrosPiso.ventanas, estadosVentanas, tIn, tOut, parametrosPiso, velocidadViento);
  return (qConduccion + qSolar + qVent) / C;
}

export function pasoEuler(tIn, tOut, sol, estadosVentanas, parametrosPiso, dtSegundos, velocidadViento = null) {
  const dTdt = derivadaTemperatura(tIn, tOut, sol, estadosVentanas, parametrosPiso, velocidadViento);
  return tIn + dTdt * dtSegundos;
}

// Simula la trayectoria de T_in a lo largo de un pronóstico. `pronostico` es un
// array de puntos { tOut, sol: { elevacion, azimut, nubesPct }, viento? }, uno
// por paso de dtSegundos (900s = 15min por defecto, igual que minutely_15 de
// Open-Meteo). `viento` (km/h) es opcional — sin él, la ventilación usa el
// caudal nominal sin escalar por viento real (ver factorViento arriba).
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
    tIn = pasoEuler(tIn, punto.tOut, punto.sol, estadosVentanas, parametrosPiso, dtSegundos, punto.viento);
    trayectoria.push(tIn);
  }
  return trayectoria;
}

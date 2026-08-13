// Irradiancia proxy y geometría solar respecto a una ventana (spec.md §4)

import { I_MAX } from './constantes.js';

export function gradosARadianes(deg) {
  return (deg * Math.PI) / 180;
}

// Atenuación lineal por nubosidad: 0% nubes -> factor 1, 100% nubes -> factor 0.
export function factorNubosidad(nubesPct) {
  const f = 1 - nubesPct / 100;
  return Math.max(0, Math.min(1, f));
}

// cos(ángulo de incidencia) sobre una ventana vertical, a partir de la posición
// solar (elevación, azimut) y la orientación (azimut) de la ventana.
// Recortado a 0 cuando el sol queda detrás de la fachada o es geometría rasante.
export function cosIncidencia(elevacionSolarDeg, azimutSolarDeg, azimutVentanaDeg) {
  const elevRad = gradosARadianes(elevacionSolarDeg);
  const diffAzimutRad = gradosARadianes(azimutSolarDeg - azimutVentanaDeg);
  const cos = Math.cos(elevRad) * Math.cos(diffAzimutRad);
  return Math.max(0, cos);
}

// I_proxy(t) = I_max · sin(elevación) modulado por nubosidad real.
export function iProxy(elevacionSolarDeg, nubesPct) {
  const elevRad = gradosARadianes(elevacionSolarDeg);
  const senElev = Math.max(0, Math.sin(elevRad)); // sol bajo el horizonte no aporta
  return I_MAX * senElev * factorNubosidad(nubesPct);
}

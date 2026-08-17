// Irradiancia proxy y geometría solar respecto a una ventana (spec.md §4)

import { I_MAX, FACTOR_NUBES_MINIMO } from './constantes.js';

export function gradosARadianes(deg) {
  return (deg * Math.PI) / 180;
}

// Atenuación lineal por nubosidad, con suelo (§4). 0% nubes -> factor 1;
// baja en línea recta hasta FACTOR_NUBES_MINIMO en 100% nubes, en vez de a
// 0 exacto — corrección real (docs/estado.md, 2026-08-17): con cielo
// totalmente cubierto sigue entrando luz difusa notable, un 100% de nubes
// no equivale a "sin sol" para efectos de ganancia solar.
export function factorNubosidad(nubesPct) {
  const f = 1 - ((1 - FACTOR_NUBES_MINIMO) * nubesPct) / 100;
  return Math.max(FACTOR_NUBES_MINIMO, Math.min(1, f));
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

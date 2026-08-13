// Posición solar real (spec.md §3.3), cálculo puro en cliente vía SunCalc.

import { getPosition } from 'suncalc';

// SunCalc (v2) ya devuelve azimut en convención de brújula (0=N, 90=E,
// 180=S, 270=O) y elevación en grados (negativa bajo el horizonte) — las
// mismas convenciones que usan irradiancia.js/sombra.js del modelo puro, así
// que no hace falta ninguna conversión de unidades ni de referencia.
export function posicionSolar(fecha, lat, lon) {
  const { azimuth, altitude } = getPosition(fecha, lat, lon);
  return { elevacion: altitude, azimut: azimuth };
}

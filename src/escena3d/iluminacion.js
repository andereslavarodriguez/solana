// Traduce datos de sol (mismo objeto {elevacion, azimut} que devuelve
// posicionSolar() de src/data/sol.js) a lo que necesita la escena 3D:
// dirección de la luz y un factor de intensidad 0-1. Función pura — no
// importa Three.js, solo números — para poder testear con assert igual que
// geometria.js.
//
// direccionSol() usa la misma convención de ejes que geometria.js (+X=Este,
// +Z=Norte, +Y=arriba), así que la luz de la escena y la física del modelo
// térmico quedan atadas a la misma posición solar sin ninguna conversión
// aparte.

import { iProxy } from '../model/irradiancia.js';
import { I_MAX } from '../model/constantes.js';

const DEG2RAD = Math.PI / 180;

export function direccionSol(sol) {
  const azRad = sol.azimut * DEG2RAD;
  const elevRad = sol.elevacion * DEG2RAD;
  return {
    x: Math.sin(azRad) * Math.cos(elevRad),
    y: Math.sin(elevRad),
    z: Math.cos(azRad) * Math.cos(elevRad),
  };
}

// Reutiliza iProxy (irradiancia.js), la misma función que ya modula
// Q_solar en el modelo térmico — así la escena no se oscurece/aclara con
// una curva distinta a la que usa la física real. Bajo el horizonte, 0.
export function factorIntensidadSol(sol) {
  if (sol.elevacion <= 0) return 0;
  return Math.min(1, iProxy(sol.elevacion, sol.nubesPct) / I_MAX);
}

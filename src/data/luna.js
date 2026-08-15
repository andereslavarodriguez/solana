// Fase lunar real, mismo patrón que sol.js: cálculo puro en cliente vía
// SunCalc, sin API ni red. Puramente visual (checkpoint 18 de la escena 3D,
// Fase 6) — no alimenta el modelo térmico, a diferencia de sol.js.
//
// `fraction` (SunCalc) ya es la fracción iluminada real (0 = luna nueva,
// 1 = luna llena); `waxing` ya indica si crece o mengua sin tener que
// derivarlo de `phase` a mano. No hace falta la posición real de la luna
// (azimut/altitud) — spec del checkpoint: "la luna tampoco tiene que estar
// en el sitio exacto".

import { getMoonIllumination } from 'suncalc';

export function faseLunar(fecha) {
  const { fraction, phase, waxing } = getMoonIllumination(fecha);
  return { fraccionIluminada: fraction, fase: phase, creciente: waxing };
}

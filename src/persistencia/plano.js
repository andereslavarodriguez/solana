// Persistencia del plano de la casa (ver docs/estado.md, "Editor de plano
// en cuadrícula"). Mismo patrón que piso.js/ubicacion.js: `storage`
// inyectado (getItem/setItem, igual que localStorage), envoltura
// `version: 1`.

import { planoDesdeRectangulo } from '../model/plano.js';

const CLAVE = 'solana:plano';
const CLAVE_PISO_ANTIGUA = 'solana:parametrosPiso';

// Plano por defecto para una instalación nueva de verdad (sin ningún dato
// previo, ni siquiera del esquema anterior a esta fase) — reproduce la
// geometría real de spec.md §3.4 (piso de referencia del proyecto).
function planoPorDefecto() {
  return planoDesdeRectangulo({
    anchoHabitacion: 4.8,
    superficie: 30,
    ventanas: [
      { orientacion: 248, ancho: 2.0, alturaEdificioEnfrente: 15, distanciaEdificioEnfrente: 45 },
      { orientacion: 68, ancho: 1.8, alturaEdificioEnfrente: 12, distanciaEdificioEnfrente: 20 },
    ],
  });
}

export function guardarPlano(storage, plano) {
  storage.setItem(CLAVE, JSON.stringify({ version: 1, ...plano }));
}

// Sin plano guardado todavía: si hay datos del esquema anterior a esta
// fase (parametrosPiso.ventanas/anchoHabitacion, Fases 1-8) se migran a un
// plano rectangular equivalente con planoDesdeRectangulo, para no perder
// la configuración real de un usuario ya en producción al actualizar. Sin
// nada de nada (instalación nueva de verdad), se usa el plano de
// referencia del proyecto.
export function cargarPlano(storage) {
  const guardado = storage.getItem(CLAVE);
  if (guardado) {
    const { version, ...plano } = JSON.parse(guardado);
    return plano;
  }

  const pisoAntiguo = storage.getItem(CLAVE_PISO_ANTIGUA);
  if (pisoAntiguo) {
    const datos = JSON.parse(pisoAntiguo);
    if (Array.isArray(datos.ventanas) && datos.ventanas.length > 0 && datos.anchoHabitacion) {
      return planoDesdeRectangulo(datos);
    }
  }

  return planoPorDefecto();
}

// Estado físico real de cada ventana (¿está abierta?, ¿persiana arriba?),
// declarado a mano por el usuario porque no hay sensores. Es el
// `estadosVentanasActuales` que exigen `recomendarVentana`/
// `recomendarPersiana` (src/model/recomendacion.js, Fase 1) como punto de
// partida de la simulación: sin este dato no se puede tener en cuenta el
// efecto conjunto de las dos ventanas sobre la única zona térmica.
// Decisión y umbrales relacionados en docs/estado.md, sección Fase 5.
//
// Mismo patrón que piso.js/ubicacion.js: `storage` inyectado, envoltura
// `version: 1`. Keyed por `ventana.nombre` (no hardcoded "A"/"B") para no
// romper si la pantalla de parámetros cambia los nombres de las ventanas.

const CLAVE = 'solana:estadoVentanas';

function estadoPorDefecto() {
  return { abierta: false, persianaArriba: false };
}

export function cargarEstadoVentanas(storage, ventanas) {
  const guardado = storage.getItem(CLAVE);
  const { version, ...estadoGuardado } = guardado ? JSON.parse(guardado) : {};

  const estado = {};
  ventanas.forEach((ventana) => {
    estado[ventana.nombre] = estadoGuardado[ventana.nombre] ?? estadoPorDefecto();
  });
  return estado;
}

export function guardarEstadoVentanas(storage, estadoVentanas) {
  storage.setItem(CLAVE, JSON.stringify({ version: 1, ...estadoVentanas }));
}

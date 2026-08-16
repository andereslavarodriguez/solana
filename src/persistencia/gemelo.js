// Persistencia del estado del gemelo en vivo (Fase 7, src/model/gemelo.js).
// Mismo patrón que el resto de src/persistencia/: `storage` inyectado,
// envoltura `version: 1`.
//
// A diferencia de piso.js/ubicacion.js, no hay ningún valor por defecto
// razonable sin datos: el gemelo necesita un T_in real de partida (la
// primera anotación del usuario) para poder empezar a simular. Sin nada
// guardado, cargarGemelo devuelve null — es responsabilidad de quien lo usa
// (dashboard.js) crearlo con estadoGemeloInicial() la primera vez que haya
// una anotación real disponible.

const CLAVE = 'solana:gemelo';

export function guardarGemelo(storage, estadoGemelo) {
  storage.setItem(CLAVE, JSON.stringify({ version: 1, ...estadoGemelo }));
}

export function cargarGemelo(storage) {
  const guardado = storage.getItem(CLAVE);
  if (!guardado) return null;

  const { version, ...estadoGemelo } = JSON.parse(guardado);
  return estadoGemelo;
}

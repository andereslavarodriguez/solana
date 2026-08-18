// Conversión entre la "faceta" de un tramo de pared del plano (relativa a
// la rotación de la casa: frontal/trasera/izquierda/derecha) y su
// orientación real en grados de brújula (spec.md §3.1, misma convención
// que sol.js/irradiancia.js: 0°=N, 90°=E, 180°=S, 270°=O).
//
// Único sitio donde vive esta tabla de offsets — reutilizado por
// src/model/plano.js (para producir la orientación real de cada ventana)
// y por src/escena3d/geometria.js (Fase 3, para orientar la caja 3D según
// `orientacionCasa`), en vez de duplicarla en los dos sitios.
export const PAREDES = ['frontal', 'trasera', 'izquierda', 'derecha'];

// derecha=270/izquierda=90 (no 90/270): bug real corregido (2026-08-18,
// ver docs/estado.md) — entrando por la fachada frontal (mirando hacia
// dentro), la mano derecha de quien entra apunta a orientacionCasa+270°,
// no +90°. La primera corrección (solo en plano.js#clasificarSegmento)
// se quedó a medias: dejaba las paredes de esta fachada con la normal
// apuntando hacia DENTRO de la casa, porque este offset y el signo usado
// en escena3d/geometria.js tienen que cambiar los TRES a la vez para
// seguir siendo consistentes entre sí.
const OFFSET_PARED = { frontal: 0, trasera: 180, derecha: 270, izquierda: 90 };

export function orientacionDeFachada(orientacionCasa, faceta) {
  return (orientacionCasa + OFFSET_PARED[faceta] + 360) % 360;
}

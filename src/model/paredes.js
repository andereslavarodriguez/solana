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

const OFFSET_PARED = { frontal: 0, trasera: 180, derecha: 90, izquierda: 270 };

export function orientacionDeFachada(orientacionCasa, faceta) {
  return (orientacionCasa + OFFSET_PARED[faceta] + 360) % 360;
}

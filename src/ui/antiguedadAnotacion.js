// Antigüedad de la última anotación de temperatura interior, y qué estado
// de recomendación le corresponde. No estaba resuelto en spec.md — decisión
// de la Fase 5, con los umbrales y su justificación en docs/estado.md.
//
// Funciones puras (sin DOM, `ahora` como parámetro) para poder testear con
// casos deterministas, igual que src/model/ y src/persistencia/.

export const UMBRAL_AVISO_HORAS = 3;
export const UMBRAL_CADUCA_HORAS = 12;

export function horasDesde(timestampISO, ahora = new Date()) {
  return (ahora.getTime() - new Date(timestampISO).getTime()) / (1000 * 60 * 60);
}

// 'fresca': se usa sin más. 'aviso': se usa pero se avisa de que puede
// estar desactualizada. 'caducada': no se calcula recomendación.
export function estadoAntiguedad(timestampISO, ahora = new Date()) {
  const horas = horasDesde(timestampISO, ahora);
  if (horas < UMBRAL_AVISO_HORAS) return 'fresca';
  if (horas < UMBRAL_CADUCA_HORAS) return 'aviso';
  return 'caducada';
}

export function formatoAntiguedad(horas) {
  if (horas < 1) {
    const minutos = Math.max(1, Math.round(horas * 60));
    return minutos === 1 ? 'hace 1 minuto' : `hace ${minutos} minutos`;
  }
  const horasRedondeadas = Math.round(horas);
  return horasRedondeadas === 1 ? 'hace 1 hora' : `hace ${horasRedondeadas} horas`;
}

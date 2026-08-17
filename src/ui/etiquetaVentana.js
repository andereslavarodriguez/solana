// Etiqueta legible por ventana, para sustituir "Ventana A"/"Ventana B" en la
// interfaz (confuso: el usuario no sabe de memoria qué letra es qué ventana
// física). Se deriva de `ventana.orientacion` (spec.md §3.4, ya editable en
// parámetros) en vez de guardar un nombre aparte — una sola fuente de
// verdad, no puede quedar desincronizada si se corrige la orientación real.
//
// Bins de 45° que arrancan en el propio grado de cada dirección
// (`floor(orientacion/45)`), no bins centrados en cada dirección
// (`round(orientacion/45)`) — decisión no obvia, ver docs/estado.md: con
// bins centrados, las dos orientaciones reales de este piso (248°/68°,
// spec.md §3.4) caen justo al otro lado del límite y salen "Oeste"/"Este"
// en vez de "Suroeste"/"Noreste" (el nombre que el propio spec.md ya usa
// para ellas). Con bins que arrancan en el grado exacto de cada dirección,
// ambas orientaciones reales caen donde se espera.
const DIRECCIONES = [
  'Norte',
  'Noreste',
  'Este',
  'Sureste',
  'Sur',
  'Suroeste',
  'Oeste',
  'Noroeste',
];

export function etiquetaCompass(orientacionGrados) {
  const normalizado = ((orientacionGrados % 360) + 360) % 360;
  const indice = Math.floor(normalizado / 45) % 8;
  return DIRECCIONES[indice];
}

// Sombra proyectada por el edificio de enfrente sobre una ventana (spec.md §4.1)
//
// Simplificación deliberada: solo se considera la elevación solar límite, no el
// ancho angular del edificio. El filtro de orientación (si el sol da de frente a
// la fachada) ya lo aporta cosIncidencia() en irradiancia.js.

export function elevacionLimiteSombra(alturaEdificio, alturaVentana, distancia) {
  return (Math.atan2(alturaEdificio - alturaVentana, distancia) * 180) / Math.PI;
}

export function ventanaSombreada(elevacionSolarDeg, elevacionLimiteDeg) {
  return elevacionSolarDeg < elevacionLimiteDeg;
}

// Persistencia de anotaciones de temperatura interior (spec.md §3.5).
// Se guardan indefinidamente; filtrar las últimas ~30 no etiquetadas para
// la recalibración (§4.2) es responsabilidad de src/model/recalibracion.js
// (Fase 7), no de este módulo.
//
// `id` identifica la anotación (crypto.randomUUID(), independiente de su
// contenido); `timestamp` es el dato de cuándo ocurrió y podría corregirse
// en el futuro sin que eso cambie la identidad de la anotación.
//
// `predicho`/`avgConduccion`/`avgSolarVent` (Fase 7, opcionales): lo que el
// gemelo en vivo (src/model/gemelo.js) predecía justo antes de esta
// anotación, y los promedios de sus dos regresores desde la anotación
// anterior — calculados en dashboard.js con el estado del gemelo en el
// momento de anotar, null en la primera anotación (no hay gemelo previo con
// el que comparar) o si no hubo ningún tick del gemelo desde la anotación
// anterior.

const CLAVE = 'solana:anotaciones';

export function guardarAnotacion(
  storage,
  { temperatura, etiquetas = [], predicho = null, avgConduccion = null, avgSolarVent = null },
) {
  const anotacion = {
    version: 1,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    temperatura,
    etiquetas,
    predicho,
    avgConduccion,
    avgSolarVent,
  };

  const anotaciones = listarAnotaciones(storage);
  anotaciones.push(anotacion);
  storage.setItem(CLAVE, JSON.stringify(anotaciones));

  return anotacion;
}

export function listarAnotaciones(storage) {
  const guardado = storage.getItem(CLAVE);
  return guardado ? JSON.parse(guardado) : [];
}

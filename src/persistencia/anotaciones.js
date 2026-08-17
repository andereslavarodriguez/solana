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

// Borra una anotación por id (p.ej. un dato metido por error). La siguiente
// anotación cronológica, si la había, guardaba predicho/avgConduccion/
// avgSolarVent calculados por el gemelo en vivo para el intervalo que
// arrancaba justo en la anotación borrada (Fase 7) — al desaparecer esa
// anotación, el hueco real hasta la anterior superviviente es distinto (más
// largo) del que esos regresores describen, así que dejan de ser
// coherentes con el nuevo hueco y se invalidan a null en vez de dejarlos
// apuntando a un intervalo que ya no existe. `construirFilasRegresion`
// (recalibracion.js) ya ignora las filas sin regresores, así que
// invalidarlas basta para que no contaminen ni el histórico ni la
// recalibración.
export function borrarAnotacion(storage, id) {
  const anotaciones = listarAnotaciones(storage);
  const idx = anotaciones.findIndex((a) => a.id === id);
  if (idx === -1) return anotaciones;

  const restantes = anotaciones.filter((a) => a.id !== id);

  const siguiente = anotaciones[idx + 1];
  if (siguiente && siguiente.predicho !== null) {
    const pos = restantes.findIndex((a) => a.id === siguiente.id);
    restantes[pos] = { ...siguiente, predicho: null, avgConduccion: null, avgSolarVent: null };
  }

  storage.setItem(CLAVE, JSON.stringify(restantes));
  return restantes;
}

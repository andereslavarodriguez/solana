// Persistencia de anotaciones de temperatura interior (spec.md §3.5).
// Se guardan indefinidamente; filtrar las últimas ~30 no etiquetadas para
// la recalibración (§4.2) es responsabilidad de la Fase 7, no de este
// módulo.
//
// `id` identifica la anotación (crypto.randomUUID(), independiente de su
// contenido); `timestamp` es el dato de cuándo ocurrió y podría corregirse
// en el futuro sin que eso cambie la identidad de la anotación.

const CLAVE = 'solana:anotaciones';

export function guardarAnotacion(storage, { temperatura, etiquetas = [] }) {
  const anotacion = {
    version: 1,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    temperatura,
    etiquetas,
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

// Override de depuración visual para la escena 3D (decisión de Fase 6,
// pedida explícitamente para poder verificar sol/nubes/lluvia en capturas
// Playwright sin esperar a que el clima real coincida).
//
// Puramente visual: esta función solo LEE query params y devuelve valores
// planos. No toca localStorage ni ningún módulo de src/persistencia/ — el
// override nunca puede alterar estadoVentanas, anotaciones ni parametrosPiso
// reales, solo qué datos de sol/clima "ve" la escena al dibujarse.

export function leerOverrideDebug(searchParams) {
  const horaRaw = searchParams.get('debugHora');
  const nubesRaw = searchParams.get('debugNubes');
  const lluviaRaw = searchParams.get('debugLluvia');

  const activo = horaRaw !== null || nubesRaw !== null || lluviaRaw !== null;
  if (!activo) return { activo: false };

  return {
    activo: true,
    hora: horaRaw !== null ? new Date(horaRaw) : null,
    nubesPct: nubesRaw !== null ? Number(nubesRaw) : null,
    precipitacion: lluviaRaw !== null ? Number(lluviaRaw) : null,
  };
}

// Frontera entre datos reales (Open-Meteo + SunCalc) y el modelo puro de la
// Fase 1 (src/model/). El modelo no cambia: este módulo solo produce, con
// datos reales, las mismas formas que ya usaban los datos de prueba
// (sol: {elevacion, azimut, nubesPct}, pronóstico: [{tOut, sol}, ...]).

import { posicionSolar } from './sol.js';
import { obtenerClimaMinutely15 } from './openMeteo.js';

function puntoModelo(minutely15, i, lat, lon) {
  const fecha = new Date(minutely15.time[i]);
  const sol = posicionSolar(fecha, lat, lon);
  return {
    tOut: minutely15.temperature_2m[i],
    sol: { ...sol, nubesPct: minutely15.cloud_cover[i] },
    // Viento real (km/h) para cada paso del pronóstico, no solo el instante
    // presente — mejora post-lanzamiento (2026-08-17, docs/estado.md):
    // termico.js lo usa para escalar la ventilación por ventana abierta.
    viento: minutely15.wind_speed_10m[i],
  };
}

// Datos reales listos para el modelo puro: `actual` (el punto más cercano al
// instante presente, con las variables adicionales que necesitará el
// dashboard de la Fase 5 — precipitación, humedad, viento) y `pronostico`,
// un array en la forma exacta que espera simularHorizonte() de termico.js.
export async function obtenerDatosReales(lat, lon, horasHorizonte = 8) {
  const pasos = Math.round((horasHorizonte * 60) / 15);
  const minutely15 = await obtenerClimaMinutely15(lat, lon, pasos);

  const pronostico = minutely15.time.map((_, i) => puntoModelo(minutely15, i, lat, lon));

  const actual = {
    ...pronostico[0],
    hora: minutely15.time[0],
    precipitacion: minutely15.precipitation[0],
    humedad: minutely15.relative_humidity_2m[0],
    viento: minutely15.wind_speed_10m[0],
    // vientoDireccion: de dónde SOPLA el viento (convención meteorológica
    // estándar, grados de brújula) — no hacia dónde va. codigoTiempo: WMO
    // weather_code, para detectar tormenta de verdad (ver esTormenta() en
    // openMeteo.js) en vez de aproximarla con lluvia+nubes.
    vientoDireccion: minutely15.wind_direction_10m[0],
    codigoTiempo: minutely15.weather_code[0],
  };

  return { actual, pronostico };
}

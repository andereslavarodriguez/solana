// Cliente de Open-Meteo (spec.md §3.2), API pública sin clave.

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

const VARIABLES_MINUTELY_15 = [
  'temperature_2m',
  'precipitation',
  'relative_humidity_2m',
  'wind_speed_10m',
  'wind_direction_10m',
  'cloud_cover',
  'weather_code',
];

// Códigos WMO (weather_code) de tormenta eléctrica — los únicos 3 códigos
// que Open-Meteo usa para "thunderstorm" (95 leve/moderada, 96 y 99 con
// granizo). Antes (Fase 6, checkpoint 5) la escena 3D aproximaba "hay
// tormenta" con lluvia fuerte + mucha nube porque no se pedía este dato;
// ahora que se pide, es el dato real el que decide, no una heurística.
const CODIGOS_TORMENTA = new Set([95, 96, 99]);
export function esTormenta(codigoTiempo) {
  return CODIGOS_TORMENTA.has(codigoTiempo);
}

// Categorías de icono para el pronóstico extendido del dashboard (widget
// estilo Google Weather, docs/estado.md) — más granular que esTormenta(),
// pero mismo dato de origen (weather_code) y mismo criterio de "el código
// real decide, no una heurística". 45/48 (niebla) se pliegan dentro de
// "nublado": una categoría propia de niebla sumaría un icono más para un
// caso que en Pamplona es poco frecuente, y CLAUDE.md pide evitar
// densidad técnica innecesaria.
const CODIGOS_LLUVIA = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const CODIGOS_NIEVE = new Set([71, 73, 75, 77, 85, 86]);

export function categoriaTiempo(codigoTiempo) {
  if (CODIGOS_TORMENTA.has(codigoTiempo)) return 'tormenta';
  if (CODIGOS_NIEVE.has(codigoTiempo)) return 'nieve';
  if (CODIGOS_LLUVIA.has(codigoTiempo)) return 'lluvia';
  if (codigoTiempo === 0) return 'despejado';
  if (codigoTiempo === 1 || codigoTiempo === 2) return 'parcial';
  return 'nublado'; // 3 (cubierto), 45/48 (niebla) y cualquier código no reconocido
}

// Pide clima real en resolución de 15 minutos. Con past_minutely_15 por
// defecto (0), el primer punto devuelto es el más cercano al instante
// actual, y los siguientes `pasos` cubren el pronóstico
// (`pasos`=32 → 8h, igual al horizonte de §3.2).
export async function obtenerClimaMinutely15(lat, lon, pasos) {
  const url = new URL(BASE_URL);
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('minutely_15', VARIABLES_MINUTELY_15.join(','));
  url.searchParams.set('forecast_minutely_15', String(pasos));
  url.searchParams.set('timezone', 'auto');

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo respondió ${res.status}: ${await res.text()}`);
  }
  const datos = await res.json();
  return datos.minutely_15;
}

// Pronóstico extendido (horas cada 3h a 21h vista + 7 días) para el widget
// estilo Google Weather del dashboard (docs/estado.md) — puramente
// informativo, no alimenta el modelo térmico (que sigue usando solo
// obtenerClimaMinutely15/adaptador.js, con su horizonte de 6-8h). Llamada
// aparte en vez de ensanchar minutely_15: son datos que ningún otro
// consumidor necesita, y minutely_15 no tiene resolución horaria/diaria.
export async function obtenerPronosticoExtendido(lat, lon) {
  const url = new URL(BASE_URL);
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('hourly', 'temperature_2m,weather_code');
  url.searchParams.set('forecast_hours', '24');
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('timezone', 'auto');

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo respondió ${res.status}: ${await res.text()}`);
  }
  const datos = await res.json();
  return { hourly: datos.hourly, daily: datos.daily };
}

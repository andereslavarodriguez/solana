// Cliente de Open-Meteo (spec.md §3.2), API pública sin clave.

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

const VARIABLES_MINUTELY_15 = [
  'temperature_2m',
  'precipitation',
  'relative_humidity_2m',
  'wind_speed_10m',
  'cloud_cover',
];

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

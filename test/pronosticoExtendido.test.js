// Casos de prueba manuales para las funciones puras de
// src/ui/pronosticoExtendido.js (selección de horas/días del pronóstico
// extendido y el trazado SVG de la línea de temperatura) — sin DOM, mismo
// patrón que test/etiquetaVentana.test.js.

import assert from 'node:assert/strict';
import { seleccionarHoras, seleccionarDias, trazadoTemperatura } from '../src/ui/pronosticoExtendido.js';

let ok = 0;
function caso(nombre, fn) {
  fn();
  ok += 1;
  console.log(`OK  ${nombre}`);
}

// Formatea en hora LOCAL (no toISOString(), que es UTC y desalinearía el
// test con seleccionarHoras() según el huso horario de quien lo ejecute) —
// mismo formato "AAAA-MM-DDTHH:mm" que devuelve Open-Meteo con
// timezone=auto.
function formatoLocal(fecha) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
}

function hourlyDeserie(inicio, horas, temps, codigos) {
  const time = Array.from({ length: horas }, (_, i) => formatoLocal(new Date(inicio.getTime() + i * 3600 * 1000)));
  return { time, temperature_2m: temps, weather_code: codigos };
}

// Pamplona, misma ubicación de partida que el resto del proyecto
// (src/data/ubicacion.js) — para las aserciones de nocturno más abajo.
const LAT = 42.8125;
const LON = -1.6458;

console.log('\n--- seleccionarHoras ---');

caso('coge 7 puntos, cada uno el más cercano a +3h,+6h,...+21h', () => {
  const ahora = new Date('2026-08-18T12:00');
  const temps = Array.from({ length: 24 }, (_, i) => 10 + i);
  const codigos = Array.from({ length: 24 }, () => 0);
  const hourly = hourlyDeserie(ahora, 24, temps, codigos);
  const horas = seleccionarHoras(hourly, ahora, LAT, LON);
  assert.equal(horas.length, 7);
  assert.equal(horas[0].temp, 13); // índice 3 (ahora+3h) -> 10+3
  assert.equal(horas[6].temp, 31); // índice 21 (ahora+21h) -> 10+21
});

caso('mapea el weather_code de cada punto a su categoría', () => {
  const ahora = new Date('2026-08-18T12:00');
  const temps = Array.from({ length: 24 }, () => 20);
  const codigos = Array.from({ length: 24 }, (_, i) => (i === 3 ? 95 : 0));
  const hourly = hourlyDeserie(ahora, 24, temps, codigos);
  const horas = seleccionarHoras(hourly, ahora, LAT, LON);
  assert.equal(horas[0].categoria, 'tormenta');
  assert.equal(horas[1].categoria, 'despejado');
});

caso('marca "nocturno" con la elevación solar real (mediodía de agosto en Pamplona)', () => {
  // ahora=12:00 -> puntos a las 15h,18h,21h,00h,03h,06h,09h. Elevaciones
  // reales verificadas aparte con posicionSolar(): 15h=58°, 18h=33°,
  // 21h=0.4° (justo tras la puesta, sigue siendo >0 -> día), 00h=-26°,
  // 03h=-33°, 06h=-13°, 09h=18°.
  const ahora = new Date('2026-08-18T12:00');
  const temps = Array.from({ length: 24 }, () => 20);
  const codigos = Array.from({ length: 24 }, () => 0);
  const hourly = hourlyDeserie(ahora, 24, temps, codigos);
  const horas = seleccionarHoras(hourly, ahora, LAT, LON);
  assert.equal(horas[0].nocturno, false); // +3h -> 15:00
  assert.equal(horas[1].nocturno, false); // +6h -> 18:00
  assert.equal(horas[2].nocturno, false); // +9h -> 21:00
  assert.equal(horas[3].nocturno, true); // +12h -> 00:00
  assert.equal(horas[4].nocturno, true); // +15h -> 03:00
  assert.equal(horas[5].nocturno, true); // +18h -> 06:00
  assert.equal(horas[6].nocturno, false); // +21h -> 09:00
});

console.log('\n--- seleccionarDias ---');

caso('deriva fecha/máx/mín/categoría de cada día, en el mismo orden', () => {
  const daily = {
    time: ['2026-08-18', '2026-08-19'],
    temperature_2m_max: [30, 25],
    temperature_2m_min: [18, 15],
    weather_code: [0, 61],
  };
  const dias = seleccionarDias(daily);
  assert.equal(dias.length, 2);
  assert.equal(dias[0].tempMax, 30);
  assert.equal(dias[1].categoria, 'lluvia');
  assert.equal(dias[0].fecha.getDate(), 18); // parseo en hora local, no medianoche UTC
});

console.log('\n--- trazadoTemperatura ---');

caso('temperatura constante -> línea recta a media altura', () => {
  const d = trazadoTemperatura([20, 20, 20], 26, 4);
  const puntos = d.slice(1).split(' L');
  assert.equal(puntos.length, 3);
  const y0 = Number(puntos[0].split(',')[1]);
  assert.ok(Math.abs(y0 - 13) < 0.5); // punto medio del rango 4..22
});

caso('más caliente -> Y más pequeño (arriba del todo en el SVG)', () => {
  const d = trazadoTemperatura([10, 30], 26, 4);
  const puntos = d
    .slice(1)
    .split(' L')
    .map((p) => Number(p.split(',')[1]));
  assert.ok(puntos[1] < puntos[0]);
});

caso('array vacío -> string vacío', () => {
  assert.equal(trazadoTemperatura([]), '');
});

console.log(`\n${ok} casos OK (pronosticoExtendido.test.js)\n`);

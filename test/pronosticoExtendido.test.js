// Casos de prueba manuales para las funciones puras de
// src/ui/pronosticoExtendido.js (marcador de 3h, selección de horas/días
// del pronóstico extendido y el trazado SVG de la línea de temperatura) —
// sin DOM, mismo patrón que test/etiquetaVentana.test.js.

import assert from 'node:assert/strict';
import {
  proximoMarcadorTresHoras,
  seleccionarHoras,
  seleccionarHorasDelDia,
  seleccionarDias,
  trazadoTemperatura,
} from '../src/ui/pronosticoExtendido.js';

// Fijo a propósito: los "ahora"/horas de este fichero se escriben como
// hora LOCAL de Pamplona (mismo supuesto que ya asume toda la app —
// dispositivo en el mismo huso horario que el piso, ver docs/estado.md
// Fase 2). Sin esto, el test de "nocturno" da resultados distintos según
// el huso horario de quien lo ejecute (falló en CI, que corre en UTC,
// aunque pasaba en local en horario de Madrid) — un bug real del test,
// no del código que verifica.
process.env.TZ = 'Europe/Madrid';

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

// Serie horaria (una entrada por hora) desde `inicio` (debe caer en una
// hora en punto), con temp[i]=temps[i] y weather_code[i]=codigos[i].
function serieHoraria(inicio, horas, temps, codigos) {
  const time = Array.from({ length: horas }, (_, i) => formatoLocal(new Date(inicio.getTime() + i * 3600 * 1000)));
  return { time, temperature_2m: temps, weather_code: codigos };
}

// Pamplona, misma ubicación de partida que el resto del proyecto
// (src/data/ubicacion.js) — para las aserciones de nocturno más abajo.
const LAT = 42.8125;
const LON = -1.6458;

console.log('\n--- proximoMarcadorTresHoras ---');

caso('17:45 -> 18:00 (bug real reportado: "ahora+3h" caía en 20:45 y el punto más cercano salía 21:00)', () => {
  const marcador = proximoMarcadorTresHoras(new Date('2026-08-18T17:45'));
  assert.equal(marcador.getDate(), 18);
  assert.equal(marcador.getHours(), 18);
  assert.equal(marcador.getMinutes(), 0);
});

caso('justo en una marca (18:00:00 exacto) -> salta a la SIGUIENTE (21:00), no se queda en la actual', () => {
  const marcador = proximoMarcadorTresHoras(new Date('2026-08-18T18:00:00'));
  assert.equal(marcador.getHours(), 21);
});

caso('cruza la medianoche cuando hace falta (22:10 -> 00:00 del día siguiente)', () => {
  const marcador = proximoMarcadorTresHoras(new Date('2026-08-18T22:10'));
  assert.equal(marcador.getDate(), 19);
  assert.equal(marcador.getHours(), 0);
});

console.log('\n--- seleccionarHoras ---');

caso('el primer punto es el próximo marcador de 3h, no "ahora+3h" (regresión del bug real)', () => {
  const ahora = new Date('2026-08-18T17:45');
  const inicio = new Date('2026-08-18T00:00');
  const temps = Array.from({ length: 48 }, (_, i) => 10 + i);
  const codigos = Array.from({ length: 48 }, () => 0);
  const hourly = serieHoraria(inicio, 48, temps, codigos);
  const horas = seleccionarHoras(hourly, ahora, LAT, LON);
  assert.equal(horas.length, 7);
  assert.equal(horas[0].hora.getHours(), 18); // no 21:00, el bug ya corregido
  assert.equal(horas[0].temp, 28); // índice 18 -> 10+18
  assert.equal(horas[6].hora.getDate(), 19); // 7º punto cruza a mañana
  assert.equal(horas[6].hora.getHours(), 12);
});

caso('mapea el weather_code de cada punto a su categoría', () => {
  const ahora = new Date('2026-08-18T12:00');
  const inicio = new Date('2026-08-18T00:00');
  const temps = Array.from({ length: 24 }, () => 20);
  const codigos = Array.from({ length: 24 }, (_, i) => (i === 15 ? 95 : 0));
  const hourly = serieHoraria(inicio, 24, temps, codigos);
  const horas = seleccionarHoras(hourly, ahora, LAT, LON);
  assert.equal(horas[0].hora.getHours(), 15);
  assert.equal(horas[0].categoria, 'tormenta');
  assert.equal(horas[1].categoria, 'despejado');
});

caso('marca "nocturno" con la elevación solar real (mediodía de agosto en Pamplona)', () => {
  // ahora=12:00 (ya alineado a la rejilla de 3h) -> puntos en
  // 15h,18h,21h,00h,03h,06h,09h. Elevaciones reales verificadas aparte con
  // posicionSolar(): 15h=58°, 18h=33°, 21h=0.4° (justo tras la puesta,
  // sigue siendo >0 -> día), 00h=-26°, 03h=-33°, 06h=-13°, 09h=18°.
  const ahora = new Date('2026-08-18T12:00');
  const inicio = new Date('2026-08-18T00:00');
  const temps = Array.from({ length: 48 }, () => 20);
  const codigos = Array.from({ length: 48 }, () => 0);
  const hourly = serieHoraria(inicio, 48, temps, codigos);
  const horas = seleccionarHoras(hourly, ahora, LAT, LON);
  assert.equal(horas[0].nocturno, false); // 15:00
  assert.equal(horas[1].nocturno, false); // 18:00
  assert.equal(horas[2].nocturno, false); // 21:00
  assert.equal(horas[3].nocturno, true); // 00:00
  assert.equal(horas[4].nocturno, true); // 03:00
  assert.equal(horas[5].nocturno, true); // 06:00
  assert.equal(horas[6].nocturno, false); // 09:00
});

console.log('\n--- seleccionarHorasDelDia ---');

caso('devuelve las 8 marcas fijas (00,03,...,21) del día dado, sin depender de "ahora"', () => {
  const inicio = new Date('2026-08-19T00:00');
  const temps = Array.from({ length: 24 }, (_, i) => 10 + i);
  const codigos = Array.from({ length: 24 }, () => 0);
  const hourly = serieHoraria(inicio, 24, temps, codigos);
  const fechaDia = new Date('2026-08-19T00:00');
  const horas = seleccionarHorasDelDia(hourly, fechaDia, LAT, LON);
  assert.equal(horas.length, 8);
  assert.deepEqual(
    horas.map((h) => h.hora.getHours()),
    [0, 3, 6, 9, 12, 15, 18, 21],
  );
  assert.equal(horas[0].temp, 10);
  assert.equal(horas[7].temp, 31); // índice 21 -> 10+21
});

console.log('\n--- seleccionarDias ---');

caso('deriva fecha/máx/mín/categoría de cada día, en el mismo orden', () => {
  const daily = {
    time: ['2026-08-18', '2026-08-19'],
    temperature_2m_max: [30, 25],
    temperature_2m_min: [18, 15],
    weather_code: [0, 61],
    precipitation_sum: [0, 3.2],
  };
  const dias = seleccionarDias(daily);
  assert.equal(dias.length, 2);
  assert.equal(dias[0].tempMax, 30);
  assert.equal(dias[1].categoria, 'lluvia');
  assert.equal(dias[0].fecha.getDate(), 18); // parseo en hora local, no medianoche UTC
});

caso('bug real corregido: código de lluvia sin precipitación real -> categoría nublado, no lluvia', () => {
  const daily = {
    time: ['2026-08-19'],
    temperature_2m_max: [25],
    temperature_2m_min: [15],
    weather_code: [55], // llovizna densa
    precipitation_sum: [0], // pero sin lluvia real ese día (caso real visto en producción)
  };
  const dias = seleccionarDias(daily);
  assert.equal(dias[0].categoria, 'nublado');
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

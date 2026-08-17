// Gemelo en vivo (Fase 7, decisión de arquitectura anotada en docs/estado.md):
// un T_in simulado que avanza solo, un paso cada vez que hay clima real
// disponible (normalmente cada 15 min, el mismo ciclo de refresco del
// dashboard), y se corrige al valor real cada vez que el usuario anota una
// temperatura. La diferencia entre el gemelo justo antes de esa corrección y
// el valor real anotado es el "predicho vs. real" de spec.md §6.4.
//
// No hay ningún histórico de clima ni de estado de ventanas guardado — si ha
// pasado mucho tiempo desde el último paso (la app estuvo cerrada), se
// reconstruye repitiendo el ÚLTIMO clima real conocido en pasos de 15 min
// (reutilizando simularHorizonte, no un único salto de Euler con un dt
// enorme, que sería numéricamente inestable) hasta alcanzar el instante
// actual. Es una aproximación deliberada, no una reconstrucción real de lo
// que pasó mientras la app estaba cerrada.

import { simularHorizonte, qSolarTotal, qVentTotal } from './termico.js';

const DT_NOMINAL_SEGUNDOS = 900; // 15 min, mismo paso que minutely_15 (Fase 2)

// Estado inicial (primer arranque, o justo después de que el usuario anote
// una temperatura real — el gemelo "se corrige" reiniciándose ahí).
export function estadoGemeloInicial(tIn, timestamp) {
  return {
    tIn,
    timestamp,
    sumConduccionSeg: 0,
    sumSolarVentSeg: 0,
    segundosAcumulados: 0,
  };
}

// Avanza el gemelo desde estadoGemelo.timestamp hasta `ahora`, con el clima
// real `actual` ({tOut, sol}) y el estado de ventanas reales del instante
// presente mantenidos constantes durante todo el hueco (no sabemos cómo
// variaron durante ese tiempo, así que se asume el valor con el que se llama
// a esta función). Acumula, ponderado por los segundos reales de cada
// llamada, los dos regresores que usará la recalibración (src/model/
// recalibracion.js): conducción (T_out−T_in) y ganancia (Q_solar+Q_vent).
export function pasoGemelo(estadoGemelo, ahora, actual, estadosVentanas, piso) {
  const gapSegundos = (ahora.getTime() - new Date(estadoGemelo.timestamp).getTime()) / 1000;
  if (gapSegundos <= 0) return estadoGemelo;

  const pasos = Math.max(1, Math.round(gapSegundos / DT_NOMINAL_SEGUNDOS));
  const dtPaso = gapSegundos / pasos;
  const pronosticoRepetido = Array.from({ length: pasos }, () => ({
    tOut: actual.tOut,
    sol: actual.sol,
    viento: actual.viento,
  }));

  const trayectoria = simularHorizonte(
    estadoGemelo.tIn,
    pronosticoRepetido,
    estadosVentanas,
    piso,
    dtPaso,
  );

  const qSolar = qSolarTotal(piso.ventanas, estadosVentanas, actual.sol, piso);
  const qVent = qVentTotal(
    piso.ventanas,
    estadosVentanas,
    estadoGemelo.tIn,
    actual.tOut,
    piso,
    actual.viento,
  );

  return {
    tIn: trayectoria[trayectoria.length - 1],
    timestamp: ahora.toISOString(),
    sumConduccionSeg:
      estadoGemelo.sumConduccionSeg + (actual.tOut - estadoGemelo.tIn) * gapSegundos,
    sumSolarVentSeg: estadoGemelo.sumSolarVentSeg + (qSolar + qVent) * gapSegundos,
    segundosAcumulados: estadoGemelo.segundosAcumulados + gapSegundos,
  };
}

// Promedios ponderados por tiempo de los regresores acumulados desde el
// último reinicio — null si no ha pasado ningún tick todavía (no hay nada
// que promediar, p.ej. dos anotaciones seguidas sin refresco de clima entre
// medias).
export function regresoresPromedio(estadoGemelo) {
  if (estadoGemelo.segundosAcumulados <= 0) return null;
  return {
    avgConduccion: estadoGemelo.sumConduccionSeg / estadoGemelo.segundosAcumulados,
    avgSolarVent: estadoGemelo.sumSolarVentSeg / estadoGemelo.segundosAcumulados,
  };
}

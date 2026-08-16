// Motor de recomendación por ventana (spec.md §5)
//
// Para cada ventana, dos decisiones independientes que reutilizan la misma
// simulación de horizonte (§4): abrir/cerrar la ventana y subir/bajar la
// persiana.

import { simularHorizonte } from './termico.js';

function distanciaABanda(tIn, banda) {
  if (tIn < banda.min) return banda.min - tIn;
  if (tIn > banda.max) return tIn - banda.max;
  return 0;
}

// Peso de cada paso del horizonte al comparar "abierta todo el rato" contra
// "cerrada todo el rato": decae exponencialmente en vez de sumar la distancia
// a la banda a peso constante en las 6-8h enteras del pronóstico.
//
// Bug real que motivó esto (revisado a petición del usuario, que veía
// recomendaciones "absurdas" — p.ej. de noche, con T_in muy por encima de la
// banda y T_out ya dentro de ella, la app recomendaba CERRAR): con peso
// constante, si el pronóstico sigue enfriándose varias horas más (algo
// habitual de madrugada), la trayectoria "abierta" acaba pasándose por abajo
// de la banda ANTES que la "cerrada" (se enfría más rápido) — y esa
// infracción futura, sumada a peso completo junto con el resto de los pasos,
// pesaba más que el beneficio real e inmediato de abrir ahora mismo. Con peso
// constante ni siquiera acortar el horizonte de golpe es robusto (el
// resultado cambia de forma brusca según dónde se corte, verificado a mano).
// Con vida media corta, lo que pase dentro de un rato (que la propia app
// puede corregir en el siguiente refresco automático de clima, cada 15min —
// Fase 5) pesa mucho más que lo que pase dentro de 4-8h, sin dejar de
// anticipar del todo (spec.md §5: "abrir ahora O EN LAS PRÓXIMAS HORAS").
// VIDA_MEDIA_PASOS_VENTANA=3 (45min, con pasos de 15min) elegido a ojo,
// verificado contra varios escenarios sintéticos (pronóstico plano, bajando
// fuerte, bajando moderado) antes de fijarlo — igual que otros parámetros del
// proyecto sin base empírica todavía (docs/estado.md), pendiente de ajustar
// con uso real.
const VIDA_MEDIA_PASOS_VENTANA = 3;
const DECAY_PASO_VENTANA = Math.pow(0.5, 1 / VIDA_MEDIA_PASOS_VENTANA);

function distanciaPonderada(trayectoria, banda) {
  let peso = 1;
  let acc = 0;
  for (const t of trayectoria) {
    acc += peso * distanciaABanda(t, banda);
    peso *= DECAY_PASO_VENTANA;
  }
  return acc;
}

function clonarEstados(estadosVentanas) {
  return JSON.parse(JSON.stringify(estadosVentanas));
}

// Abrir/cerrar: simula el horizonte con la ventana abierta todo el rato y con
// la ventana cerrada todo el rato (el resto de estados —persianas, la otra
// ventana— se dejan como están ahora mismo), y compara cuál de las dos
// trayectorias queda más cerca de la banda de confort en conjunto (con más
// peso en los pasos cercanos, ver `distanciaPonderada` arriba).
// Empate -> se recomienda cerrar (decisión de diseño: por defecto no abrir si
// no hay beneficio claro, anotada en docs/estado.md).
export function recomendarVentana(
  nombreVentana,
  tInActual,
  pronostico,
  estadosVentanasActuales,
  parametrosPiso
) {
  const banda = parametrosPiso.bandaConfort;
  const estadosAbierta = clonarEstados(estadosVentanasActuales);
  estadosAbierta[nombreVentana].abierta = true;

  const estadosCerrada = clonarEstados(estadosVentanasActuales);
  estadosCerrada[nombreVentana].abierta = false;

  const trayAbierta = simularHorizonte(tInActual, pronostico, estadosAbierta, parametrosPiso);
  const trayCerrada = simularHorizonte(tInActual, pronostico, estadosCerrada, parametrosPiso);

  const distAbierta = distanciaPonderada(trayAbierta, banda);
  const distCerrada = distanciaPonderada(trayCerrada, banda);

  return {
    accion: distAbierta < distCerrada ? 'abrir' : 'cerrar',
    trayectorias: { abierta: trayAbierta, cerrada: trayCerrada },
  };
}

// Subir/bajar persiana (regla acordada, ver docs/estado.md):
// - Si no hay NINGÚN sol (ni ahora ni en todo el horizonte) que pueda entrar
//   por esta ventana, la persiana es térmicamente indiferente (spec.md §5:
//   "sin sol... persiana indiferente térmicamente") -> no se toca, se
//   recomienda dejarla como está.
// - Si no, y T_in ya supera el límite superior de confort ahora mismo ->
//   bajar, sin mirar T_out.
// - Si no, simula T_in en el horizonte con la persiana arriba (el resto de
//   estados como están ahora). Si esa trayectoria se mantiene dentro de la
//   banda sin superar el límite superior en ningún punto -> arriba.
//   Si lo supera en algún punto -> bajar.
export function recomendarPersiana(
  nombreVentana,
  tInActual,
  pronostico,
  estadosVentanasActuales,
  parametrosPiso
) {
  const banda = parametrosPiso.bandaConfort;

  const estadosArriba = clonarEstados(estadosVentanasActuales);
  estadosArriba[nombreVentana].persianaArriba = true;
  const estadosAbajo = clonarEstados(estadosVentanasActuales);
  estadosAbajo[nombreVentana].persianaArriba = false;

  const trayArriba = simularHorizonte(tInActual, pronostico, estadosArriba, parametrosPiso);
  const trayAbajo = simularHorizonte(tInActual, pronostico, estadosAbajo, parametrosPiso);

  // Bug real que motivó este chequeo (revisado a petición del usuario): de
  // noche, sin nada de sol en todo el horizonte, la persiana arriba o abajo
  // da EXACTAMENTE la misma trayectoria (Q_solar siempre 0) — pero la regla
  // "T_in ya supera el máximo -> bajar" de más abajo se disparaba igual
  // (incluso sin ese atajo, `trayectoria.some(t => t > banda.max)` sigue
  // siendo `true` porque el primer elemento de la trayectoria es la propia
  // `tInActual` ya por encima del máximo), recomendando bajar la persiana
  // por una razón (el sol) que ni siquiera está en juego. Se detecta
  // comparando las dos trayectorias en vez de mirar solo si hay sol AHORA
  // MISMO, porque lo relevante es si hay sol en CUALQUIER punto del
  // horizonte simulado. `accion: 'arriba'` fijo (no depende de nada más)
  // porque de verdad da igual — es el mismo default que ya usaba el resto
  // del algoritmo para "no hace falta bajarla" (ver más abajo).
  const indiferente = trayArriba.every((t, i) => Math.abs(t - trayAbajo[i]) < 1e-9);
  if (indiferente) {
    return {
      accion: 'arriba',
      motivo: 'sin sol en todo el horizonte, la persiana no afecta a la temperatura',
      trayectoria: trayArriba,
    };
  }

  if (tInActual > banda.max) {
    return {
      accion: 'bajar',
      motivo: 'T_in ya supera el límite de confort ahora mismo',
      trayectoria: null,
    };
  }

  const trayectoria = trayArriba;
  const superaLimite = trayectoria.some((t) => t > banda.max);

  return {
    accion: superaLimite ? 'bajar' : 'arriba',
    motivo: superaLimite
      ? 'con la persiana arriba se supera el límite superior de confort en el horizonte'
      : 'con la persiana arriba T_in se mantiene dentro de la banda de confort',
    trayectoria,
  };
}

// Pendiente explícito para Fase 2+: histéresis / banda muerta en ambas
// recomendaciones para evitar oscilación cuando se alimenten con datos en
// vivo (anotado en docs/estado.md).

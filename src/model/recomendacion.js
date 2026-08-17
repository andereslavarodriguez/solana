// Motor de recomendación por ventana (spec.md §5)
//
// Para cada ventana, dos decisiones independientes que reutilizan la misma
// simulación de horizonte (§4): abrir/cerrar la ventana y subir/bajar la
// persiana.
//
// Rediseño post-lanzamiento (2026-08-17, ver docs/estado.md): el diseño
// original (Fase 1) comparaba "estado fijo todo el horizonte de 6-8h" contra
// el otro estado fijo todo el horizonte — pero abrir/cerrar una ventana no es
// una decisión que se tome para las próximas 8h de un tirón, se puede volver
// a tocar en cualquier momento (y el dashboard, de hecho, recalcula la
// recomendación sola cada 15 min, Fase 5). En vez de eso, se busca el MEJOR
// INSTANTE DE CAMBIO dentro del horizonte: "¿cuál es el único momento en el
// que conviene pasar del estado actual al contrario, si es que conviene
// alguno?". Esto sustituye el caso especial "indiferente" que tenía
// recomendarPersiana (sin sol, cualquier cambio da la misma trayectoria,
// ahora resuelto solo por la propia búsqueda) — pero NO elimina la necesidad
// de ponderar el horizonte, como se pensó al principio de este rediseño: con
// distancia sin ponderar, la búsqueda puede "esconder" un mal desenlace justo
// más allá del final del horizonte retrasando el cambio (un pronóstico donde
// el sol calienta sin parar y la persiana arriba nunca deja de subir la
// temperatura "gana" aplazando bajarla, porque cuanto más tarde se baje,
// menos pasos de la posterior bajada de temperatura caben dentro del
// horizonte visible) — un problema clásico de optimizar con horizonte finito
// sin ningún descuento temporal. Se soluciona igual que en el intento previo:
// pesando cada paso con un decaimiento exponencial, para que lo próximo
// cuente mucho más que lo lejano.

import { simularHorizonte } from './termico.js';

// VIDA_MEDIA_PASOS=1.5 (22.5 min con pasos de 15min) elegido a ojo,
// verificado contra varios escenarios sintéticos (incluido el que motivó
// este comentario: sol muy fuerte y sostenido con fuera helando, donde sin
// ponderar la búsqueda aplazaba bajar la persiana sin motivo real) antes de
// fijarlo. Pendiente de ajustar con uso real, mismo criterio que otros
// parámetros del proyecto sin base empírica todavía (docs/estado.md).
const VIDA_MEDIA_PASOS = 1.5;
const DECAY_PASO = Math.pow(0.5, 1 / VIDA_MEDIA_PASOS);

function distanciaABanda(tIn, banda) {
  if (tIn < banda.min) return banda.min - tIn;
  if (tIn > banda.max) return tIn - banda.max;
  return 0;
}

function distanciaAcumulada(trayectoria, banda) {
  let peso = 1;
  let acc = 0;
  for (const t of trayectoria) {
    acc += peso * distanciaABanda(t, banda);
    peso *= DECAY_PASO;
  }
  return acc;
}

function clonarEstados(estadosVentanas) {
  return JSON.parse(JSON.stringify(estadosVentanas));
}

function estadoEnPaso(estadoInicial, pasoCambio, paso) {
  return paso < pasoCambio ? estadoInicial : !estadoInicial;
}

// Simula la trayectoria de una ventana con uno o varios campos (`abierta`,
// `persianaArriba`) que cambian de forma independiente cada uno en su propio
// instante — cada entrada de `cambios` es { campo, estadoInicial, pasoCambio }
// (0 = cambia desde ya, pronostico.length = no cambia nunca dentro del
// horizonte). El resto de campos/ventanas se dejan como están ahora mismo
// durante todo el horizonte. Con un solo cambio, es exactamente el diseño
// original de un único instante de cambio; con dos (ver mejorEstrategiaUnCambio
// más abajo, parámetro `fondo`) permite que la búsqueda de la persiana tenga
// en cuenta CUÁNDO estará abierta la ventana, en vez de asumir fijo su
// estado físico actual (ver docs/estado.md, mejora del 17-08).
function trayectoriaConCambios(tInActual, pronostico, estadosBase, nombreVentana, cambios, parametrosPiso) {
  const N = pronostico.length;
  const puntos = [...new Set([0, N, ...cambios.map((c) => Math.max(0, Math.min(c.pasoCambio, N)))])].sort(
    (a, b) => a - b
  );

  let tIn = tInActual;
  const trayectoriaCompleta = [tIn];
  for (let i = 0; i < puntos.length - 1; i += 1) {
    const inicio = puntos[i];
    const fin = puntos[i + 1];
    if (fin <= inicio) continue;

    const estados = clonarEstados(estadosBase);
    for (const c of cambios) {
      estados[nombreVentana][c.campo] = estadoEnPaso(c.estadoInicial, c.pasoCambio, inicio);
    }

    const segmento = simularHorizonte(tIn, pronostico.slice(inicio, fin), estados, parametrosPiso);
    trayectoriaCompleta.push(...segmento.slice(1));
    tIn = segmento[segmento.length - 1];
  }
  return trayectoriaCompleta;
}

// Por debajo de esta mejora (mismas unidades que distanciaAcumulada: °C de
// distancia a la banda, ponderados) un candidato no cuenta como "mejor" de
// verdad. Sin esto, con el horizonte tan ponderado hacia lo próximo
// (DECAY_PASO arriba), un cambio a 6-8h vista pesa casi nada pero no es
// exactamente cero — y sin un umbral, la búsqueda podía acabar
// recomendando un cambio "óptimo" a los 30 min que en realidad no suponía
// ninguna diferencia real apreciable (encontrado verificando el caso real
// del usuario: 26°C dentro, 22°C fuera bajando toda la noche — "abrir" salía
// bien, pero el "próximo cambio" sugerido no era significativo, solo ruido
// numérico de la cola del pronóstico). Elegido a ojo, con margen de sobra
// por debajo de diferencias reales (~0.1 o más en los escenarios probados) y
// por encima del ruido observado (~0.0005) — pendiente de ajustar con uso
// real, mismo criterio que el resto de parámetros sin base empírica.
const MEJORA_MINIMA = 0.01;

// Busca, entre los `estadosIniciales` candidatos (p.ej. [false, true] para
// "empezar cerrada" o "empezar abierta"), y para cada uno todos los instantes
// de cambio posibles, la combinación que menos distancia acumulada a la banda
// de confort produce en el horizonte completo.
//
// Empate (o mejora por debajo de MEJORA_MINIMA) -> gana el candidato
// evaluado ANTES en la lista, y dentro de cada candidato, el paso de cambio
// más tardío (recorrido de mayor a menor) — o sea, por defecto no cambiar
// nada si no hay un beneficio claro, mismo sesgo que ya tenía el diseño
// anterior ("empate -> cerrar").
// `fondo`: cambios ya decididos de antemano en OTRO campo de la MISMA
// ventana (p.ej. el horario de "abierta" que ya calculó recomendarVentana),
// que se mantienen fijos mientras se busca el mejor instante de cambio para
// `campo`. Opcional — sin él, el comportamiento es el mismo de antes.
function mejorEstrategiaUnCambio(
  tInActual,
  pronostico,
  estadosVentanasActuales,
  nombreVentana,
  campo,
  parametrosPiso,
  estadosIniciales,
  fondo = []
) {
  const banda = parametrosPiso.bandaConfort;
  let mejor = null;

  for (const estadoInicial of estadosIniciales) {
    for (let pasoCambio = pronostico.length; pasoCambio >= 0; pasoCambio -= 1) {
      const trayectoria = trayectoriaConCambios(
        tInActual,
        pronostico,
        estadosVentanasActuales,
        nombreVentana,
        [{ campo, estadoInicial, pasoCambio }, ...fondo],
        parametrosPiso
      );
      const distancia = distanciaAcumulada(trayectoria, banda);
      if (!mejor || distancia < mejor.distancia - MEJORA_MINIMA) {
        mejor = { estadoInicial, pasoCambio, distancia, trayectoria };
      }
    }
  }

  return mejor;
}

// Convierte el resultado de mejorEstrategiaUnCambio en "qué tocaría hacer
// ahora mismo" + "cuándo tocaría el próximo cambio, si toca alguno".
function interpretarResultado(resultado, totalPasos) {
  const estadoAhora =
    resultado.pasoCambio === 0 ? !resultado.estadoInicial : resultado.estadoInicial;

  const hayProximoCambio = resultado.pasoCambio > 0 && resultado.pasoCambio < totalPasos;
  const proximoCambio = hayProximoCambio
    ? {
        estadoDestino: !resultado.estadoInicial,
        pasos: resultado.pasoCambio,
        minutos: resultado.pasoCambio * 15,
      }
    : null;

  return { estadoAhora, proximoCambio };
}

// Calcula el mejor horario de abierta/cerrada para una ventana — extraído
// como función propia (no solo el cuerpo de recomendarVentana) porque
// recomendarPersiana también lo necesita, para saber CUÁNDO va a estar
// abierta la ventana antes de decidir la persiana (ver más abajo).
function calcularMejorVentana(tInActual, pronostico, estadosVentanasActuales, nombreVentana, parametrosPiso) {
  return mejorEstrategiaUnCambio(
    tInActual,
    pronostico,
    estadosVentanasActuales,
    nombreVentana,
    'abierta',
    parametrosPiso,
    [false, true]
  );
}

// Abrir/cerrar: busca el mejor instante para pasar de "cerrada" a "abierta" o
// de "abierta" a "cerrada" (se prueban ambos puntos de partida — no se
// asume que el estado físico actual de la ventana sea el óptimo de partida,
// igual que el diseño original tampoco lo asumía). `accion` es el estado
// recomendado AHORA MISMO; `proximoCambio`, si lo hay, cuándo conviene volver
// a tocarla y a qué estado (en vez de forzar una única decisión fija para
// todo el horizonte).
export function recomendarVentana(
  nombreVentana,
  tInActual,
  pronostico,
  estadosVentanasActuales,
  parametrosPiso
) {
  const resultado = calcularMejorVentana(
    tInActual,
    pronostico,
    estadosVentanasActuales,
    nombreVentana,
    parametrosPiso
  );
  const { estadoAhora, proximoCambio } = interpretarResultado(resultado, pronostico.length);

  return {
    accion: estadoAhora ? 'abrir' : 'cerrar',
    proximoCambio: proximoCambio
      ? { accion: proximoCambio.estadoDestino ? 'abrir' : 'cerrar', ...proximoCambio }
      : null,
    trayectoria: resultado.trayectoria,
  };
}

// Subir/bajar persiana: el punto de partida de la búsqueda es siempre
// "arriba" (decisión ya establecida, spec.md §5 — sin motivo para tenerla
// bajada si no hace falta), y se busca el mejor instante para bajarla si el
// sol previsto lo justifica en algún momento del horizonte. Si no hay sol en
// absoluto (de noche, o toda la ventana en sombra), cambiarla en cualquier
// instante da exactamente la misma trayectoria — el empate lo resuelve el
// mismo sesgo de "no cambiar si no hay beneficio claro", así que sale
// 'arriba' sin necesitar ya un caso especial para "indiferente".
//
// Mejora post-lanzamiento (2026-08-17, ver docs/estado.md): la búsqueda usa
// el horario de "abierta" que RECOMIENDA recomendarVentana para esta misma
// ventana (no el estado físico actual, normalmente todavía cerrada hasta
// que el usuario actúa) — desde que Q_vent depende de la persiana (mejora
// del día anterior), subir la persiana con la ventana abierta también deja
// entrar más aire, no solo más sol. Sin este acoplo, la búsqueda de la
// persiana nunca veía ese beneficio de ventilación (la ventana se asumía
// cerrada todo el horizonte) y por eso, con la persiana ya bajada por sol,
// jamás encontraba motivo para subirla aunque abrir la ventana la hiciera
// interesante para ventilar.
export function recomendarPersiana(
  nombreVentana,
  tInActual,
  pronostico,
  estadosVentanasActuales,
  parametrosPiso
) {
  const ventana = calcularMejorVentana(
    tInActual,
    pronostico,
    estadosVentanasActuales,
    nombreVentana,
    parametrosPiso
  );
  const horarioVentana = {
    campo: 'abierta',
    estadoInicial: ventana.estadoInicial,
    pasoCambio: ventana.pasoCambio,
  };

  const resultado = mejorEstrategiaUnCambio(
    tInActual,
    pronostico,
    estadosVentanasActuales,
    nombreVentana,
    'persianaArriba',
    parametrosPiso,
    [true],
    [horarioVentana]
  );
  const { estadoAhora, proximoCambio } = interpretarResultado(resultado, pronostico.length);

  let motivo;
  if (!estadoAhora) {
    motivo = 'con la persiana arriba ya se supera el límite de confort ahora mismo';
  } else if (proximoCambio) {
    const horas = (proximoCambio.minutos / 60).toFixed(1);
    motivo = `con la persiana arriba se superaría el límite de confort en unas ${horas}h`;
  } else {
    motivo = 'con la persiana arriba T_in se mantiene dentro de la banda de confort en todo el horizonte';
  }

  return {
    accion: estadoAhora ? 'arriba' : 'bajar',
    motivo,
    proximoCambio: proximoCambio ? { accion: 'bajar', ...proximoCambio } : null,
    trayectoria: resultado.trayectoria,
  };
}

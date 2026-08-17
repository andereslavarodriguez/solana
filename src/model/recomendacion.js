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

// Simula la trayectoria de la ZONA TÉRMICA ÚNICA (spec.md §4 — un solo
// T_in para todo el salón-cocina) con uno o varios campos, de una o varias
// ventanas, cambiando cada uno de forma independiente en su propio
// instante — cada entrada de `cambios` es { ventana, campo, estadoInicial,
// pasoCambio } (0 = cambia desde ya, pronostico.length = no cambia nunca
// dentro del horizonte). Cualquier (ventana, campo) que no aparezca en
// `cambios` se deja como esté ahora mismo (`estadosBase`) durante todo el
// horizonte. Con un único cambio es exactamente el diseño original de un
// solo instante de cambio; con varios — de la MISMA ventana o de
// ventanas DISTINTAS — permite optimizar conjuntamente ventana+persiana de
// las dos ventanas a la vez (ver optimizarConjuntoGlobal más abajo,
// docs/estado.md, corrección 2026-08-17).
function trayectoriaConCambios(tInActual, pronostico, estadosBase, cambios, parametrosPiso) {
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
      estados[c.ventana][c.campo] = estadoEnPaso(c.estadoInicial, c.pasoCambio, inicio);
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
// `fondo`: cambios ya decididos de antemano en OTRO(S) campo(s) — de la
// MISMA ventana (p.ej. su propia persiana) o de la OTRA ventana (comparten
// la misma zona térmica) — que se mantienen fijos mientras se busca el
// mejor instante de cambio para (`ventana`, `campo`). Opcional — sin él,
// el resto de campos se queda en su estado físico actual todo el horizonte.
function mejorEstrategiaUnCambio(
  tInActual,
  pronostico,
  estadosVentanasActuales,
  ventana,
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
        [{ ventana, campo, estadoInicial, pasoCambio }, ...fondo],
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

// Los 4 grados de libertad reales del piso (spec.md §3.4: dos ventanas, cada
// una con su ventana y su persiana) — orden fijo y determinista (mismo
// orden que `parametrosPiso.ventanas`, ventana antes que persiana dentro de
// cada una) para que optimizarConjuntoGlobal() sea reproducible entre
// llamadas con los mismos datos.
function camposDelPiso(parametrosPiso) {
  const campos = [];
  for (const v of parametrosPiso.ventanas) {
    campos.push({ ventana: v.nombre, campo: 'abierta', candidatos: [false, true] });
    // Persiana: un solo candidato de partida, 'arriba' (decisión ya
    // establecida, spec.md §5 — sin motivo para tenerla bajada si no hace
    // falta), igual que antes de esta corrección.
    campos.push({ ventana: v.nombre, campo: 'persianaArriba', candidatos: [true] });
  }
  return campos;
}

// Número de rondas de descenso por coordenadas (cada campo se recalcula con
// los demás ya fijados en su mejor valor conocido hasta el momento) hasta
// fijar el resultado. NO es una búsqueda combinatoria de las 4 combinaciones
// ventana/persiana × las dos ventanas × todos los instantes de cambio a la
// vez (sería exacta, pero del orden de miles de veces más cara: cada ronda
// de aquí ya es una búsqueda EXACTA de un solo campo con los otros tres
// fijos, así que recorrer los 4 campos varias veces es un descenso por
// coordenadas sobre la misma distancia ponderada de todo el motor) —
// converge al mismo punto fijo con mucho menos cálculo. 2 rondas (8
// búsquedas de un campo en total), verificado con datos reales y dos
// escenarios sintéticos (docs/estado.md, corrección 2026-08-17): a partir
// de la ronda 1 el resultado ya no cambia (comprobado hasta la ronda 5) y
// — el motivo real de la corrección — deja de depender de con qué estado
// físico (ventana o persiana, de cualquiera de las dos ventanas) se arranca
// la búsqueda.
const RONDAS_OPTIMIZACION_GLOBAL = 2;

// Optimiza las ventanas Y persianas de TODO el piso a la vez — sustituye el
// diseño anterior (`optimizarConjunto`, por ventana) que solo unía ventana
// y persiana de la MISMA ventana y dejaba la ventana contraria fija en su
// estado físico. Bug real que motivó este cambio (reportado por el
// usuario, docs/estado.md): "la recomendación debe ser la mejor de las 4
// combinaciones... no depende de cómo estén ni una ventana ni otra, ni una
// persiana ni otra" — con el diseño por-ventana, la recomendación de la
// ventana B sí podía depender de qué persiana física tuviera puesta la
// ventana A (comparten la misma zona térmica, spec.md §4), aunque ya no
// dependiera de su propia persiana.
//
// Descenso por coordenadas: recorre los 4 campos en orden fijo
// (`camposDelPiso`), y para cada uno busca su mejor horario con los OTROS
// TRES ya fijados en el mejor valor conocido hasta ese momento (de esta
// ronda si ya se recalcularon, de la ronda anterior si no) — así cada
// campo nuevo ya tiene en cuenta el efecto de los demás, incluida la otra
// ventana. Se repite `RONDAS_OPTIMIZACION_GLOBAL` veces completas.
function optimizarConjuntoGlobal(tInActual, pronostico, estadosVentanasActuales, parametrosPiso) {
  const campos = camposDelPiso(parametrosPiso);
  const resultados = {};
  parametrosPiso.ventanas.forEach((v) => {
    resultados[v.nombre] = {};
  });

  function fondoActual(ventanaExcluida, campoExcluido) {
    const fondo = [];
    for (const v of parametrosPiso.ventanas) {
      for (const campo of ['abierta', 'persianaArriba']) {
        if (v.nombre === ventanaExcluida && campo === campoExcluido) continue;
        const r = resultados[v.nombre][campo];
        if (r) fondo.push({ ventana: v.nombre, campo, estadoInicial: r.estadoInicial, pasoCambio: r.pasoCambio });
      }
    }
    return fondo;
  }

  for (let ronda = 0; ronda < RONDAS_OPTIMIZACION_GLOBAL; ronda += 1) {
    for (const { ventana, campo, candidatos } of campos) {
      resultados[ventana][campo] = mejorEstrategiaUnCambio(
        tInActual,
        pronostico,
        estadosVentanasActuales,
        ventana,
        campo,
        parametrosPiso,
        candidatos,
        fondoActual(ventana, campo)
      );
    }
  }

  return resultados; // { [nombreVentana]: { abierta: {...}, persianaArriba: {...} } }
}

// Abrir/cerrar: `accion` es el estado recomendado AHORA MISMO;
// `proximoCambio`, si lo hay, cuándo conviene volver a tocarla y a qué
// estado (en vez de forzar una única decisión fija para todo el
// horizonte).
function formatearVentana(resultado, totalPasos) {
  const { estadoAhora, proximoCambio } = interpretarResultado(resultado, totalPasos);
  return {
    accion: estadoAhora ? 'abrir' : 'cerrar',
    proximoCambio: proximoCambio
      ? { accion: proximoCambio.estadoDestino ? 'abrir' : 'cerrar', ...proximoCambio }
      : null,
    trayectoria: resultado.trayectoria,
  };
}

// Subir/bajar persiana: mismo criterio que formatearVentana, más un
// `motivo` en prosa corta.
function formatearPersiana(resultado, totalPasos) {
  const { estadoAhora, proximoCambio } = interpretarResultado(resultado, totalPasos);

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

// Recomendación conjunta para TODO el piso — una sola llamada calcula la
// mejor combinación global (`optimizarConjuntoGlobal`) y devuelve ventana +
// persiana ya formateadas para cada ventana declarada en `parametrosPiso`.
// Preferible a llamar a recomendarVentana/recomendarPersiana por separado
// para cada ventana (lo que hacía dashboard.js hasta esta corrección): con
// 4 llamadas sueltas, cada una repetiría la misma optimización global desde
// cero — aquí se hace una vez y se reparte.
export function recomendarPiso(tInActual, pronostico, estadosVentanasActuales, parametrosPiso) {
  const resultados = optimizarConjuntoGlobal(tInActual, pronostico, estadosVentanasActuales, parametrosPiso);
  const porVentana = {};
  for (const v of parametrosPiso.ventanas) {
    porVentana[v.nombre] = {
      ventana: formatearVentana(resultados[v.nombre].abierta, pronostico.length),
      persiana: formatearPersiana(resultados[v.nombre].persianaArriba, pronostico.length),
    };
  }
  return porVentana;
}

// Abrir/cerrar una ventana concreta — envoltorio de un solo campo sobre
// recomendarPiso(), para quien solo necesita esta ventana (tests, y
// cualquier consumidor que no quiera las dos a la vez). Llama a la
// optimización global completa igual que recomendarPiso, así que para
// pedir ventana Y persiana de las dos ventanas es más barato llamar una
// vez a recomendarPiso() que a esta función 4 veces seguidas.
//
// Corrección 2026-08-17 (docs/estado.md): ya NO asume que la persiana de
// esta ventana, ni el estado de la OTRA ventana, se quedan como estén
// físicamente ahora — usa optimizarConjuntoGlobal (las 4 combinaciones a
// la vez) en vez de fijar todo lo demás en su valor físico actual.
export function recomendarVentana(
  nombreVentana,
  tInActual,
  pronostico,
  estadosVentanasActuales,
  parametrosPiso
) {
  const resultados = optimizarConjuntoGlobal(tInActual, pronostico, estadosVentanasActuales, parametrosPiso);
  return formatearVentana(resultados[nombreVentana].abierta, pronostico.length);
}

// Subir/bajar una persiana concreta — mismo criterio que recomendarVentana.
export function recomendarPersiana(
  nombreVentana,
  tInActual,
  pronostico,
  estadosVentanasActuales,
  parametrosPiso
) {
  const resultados = optimizarConjuntoGlobal(tInActual, pronostico, estadosVentanasActuales, parametrosPiso);
  return formatearPersiana(resultados[nombreVentana].persianaArriba, pronostico.length);
}

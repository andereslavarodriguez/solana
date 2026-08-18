// Plano de la casa en cuadrícula (ver docs/estado.md, "Editor de plano en
// cuadrícula"). Funciones puras: sin Three.js, sin DOM, sin persistencia —
// reciben y devuelven solo datos planos, mismo criterio que el resto de
// src/model/.
//
// Modelo: las paredes viven en las ARISTAS de la cuadrícula (estilo Los
// Sims), no en las celdas — el usuario solo dibuja paredes; qué celdas
// quedan "dentro de la casa" se deriva por flood fill desde fuera de la
// cuadrícula, nunca se pinta por separado.
//
//   plano = {
//     cols, filas,        // número de celdas
//     tamanoCelda,        // metros por celda (editable, no fijo en código)
//     orientacionCasa,    // grados de brújula que mira la fachada "frontal"
//     segmentos: [{ tipo: 'H'|'V', col, fila, clase: 'muro'|'puerta'|'ventana' }],
//     obstruccionPorFachada: { frontal, trasera, izquierda, derecha }, cada
//       una { alturaEdificioEnfrente, distanciaEdificioEnfrente } — un solo
//       valor por fachada y no por ventana individual: pedir esa distancia
//       por cada tramo en un editor de cuadrícula sería mucha fricción, y
//       casi siempre el contexto urbano es el mismo para todas las
//       ventanas de un mismo lado del edificio (simplificación deliberada,
//       ver docs/estado.md).
//   }
//
// Segmento H(col, fila): arista horizontal entre la celda (col, fila-1)
// ["arriba", fila menor] y la celda (col, fila) ["abajo", fila mayor].
// Segmento V(col, fila): arista vertical entre (col-1, fila) ["izquierda"]
// y (col, fila) ["derecha"]. Convención de ejes (arbitraria pero fija):
// fila crece hacia la fachada "trasera", columna crece hacia "derecha".

import { orientacionDeFachada } from './paredes.js';

function claveSegmento(tipo, col, fila) {
  return `${tipo},${col},${fila}`;
}

function claveCelda(col, fila) {
  return `${col},${fila}`;
}

function mapaSegmentos(plano) {
  const mapa = new Map();
  for (const s of plano.segmentos) mapa.set(claveSegmento(s.tipo, s.col, s.fila), s);
  return mapa;
}

// Celdas de la cuadrícula alcanzables sin cruzar ningún segmento, partiendo
// de un "fuera" virtual que rodea la cuadrícula entera. Todo lo NO
// alcanzado es "interior" — así el usuario nunca pinta habitaciones a
// mano, solo dibuja paredes. Una puerta bloquea el flood fill igual que un
// muro (una puerta cerrada sigue siendo parte de la envolvente real del
// edificio) — solo importa si HAY o no un segmento, no de qué clase es.
export function celdasInteriores(plano) {
  const { cols, filas } = plano;
  const segMap = mapaSegmentos(plano);
  const fuera = new Set();
  const cola = [];

  function visitar(col, fila) {
    const clave = claveCelda(col, fila);
    if (fuera.has(clave)) return;
    fuera.add(clave);
    cola.push([col, fila]);
  }

  for (let col = 0; col < cols; col++) {
    if (!segMap.has(claveSegmento('H', col, 0))) visitar(col, 0);
    if (!segMap.has(claveSegmento('H', col, filas))) visitar(col, filas - 1);
  }
  for (let fila = 0; fila < filas; fila++) {
    if (!segMap.has(claveSegmento('V', 0, fila))) visitar(0, fila);
    if (!segMap.has(claveSegmento('V', cols, fila))) visitar(cols - 1, fila);
  }

  while (cola.length > 0) {
    const [col, fila] = cola.shift();
    if (col + 1 < cols && !segMap.has(claveSegmento('V', col + 1, fila))) visitar(col + 1, fila);
    if (col - 1 >= 0 && !segMap.has(claveSegmento('V', col, fila))) visitar(col - 1, fila);
    if (fila + 1 < filas && !segMap.has(claveSegmento('H', col, fila + 1))) visitar(col, fila + 1);
    if (fila - 1 >= 0 && !segMap.has(claveSegmento('H', col, fila))) visitar(col, fila - 1);
  }

  const interior = [];
  for (let fila = 0; fila < filas; fila++) {
    for (let col = 0; col < cols; col++) {
      if (!fuera.has(claveCelda(col, fila))) interior.push({ col, fila });
    }
  }
  return interior;
}

function esInterior(col, fila, plano, interiorSet) {
  if (col < 0 || col >= plano.cols || fila < 0 || fila >= plano.filas) return false;
  return interiorSet.has(claveCelda(col, fila));
}

// Clasifica un segmento: ¿separa el interior del exterior (exactamente una
// cara interior) o son dos paredes interiores/dos huecos exteriores (no
// cuenta como fachada)? Si es exterior, ¿a qué fachada relativa (frontal/
// trasera/izquierda/derecha) corresponde?
function clasificarSegmento(segmento, plano, interiorSet) {
  let ladoMenorInterior;
  let ladoMayorInterior;
  if (segmento.tipo === 'H') {
    ladoMenorInterior = esInterior(segmento.col, segmento.fila - 1, plano, interiorSet);
    ladoMayorInterior = esInterior(segmento.col, segmento.fila, plano, interiorSet);
  } else {
    ladoMenorInterior = esInterior(segmento.col - 1, segmento.fila, plano, interiorSet);
    ladoMayorInterior = esInterior(segmento.col, segmento.fila, plano, interiorSet);
  }

  const exterior = ladoMenorInterior !== ladoMayorInterior;
  if (!exterior) return { ...segmento, exterior: false, faceta: null };

  const ladoExteriorEsMenor = !ladoMenorInterior;
  const faceta =
    segmento.tipo === 'H'
      ? ladoExteriorEsMenor
        ? 'frontal'
        : 'trasera'
      : ladoExteriorEsMenor
        ? 'izquierda'
        : 'derecha';
  return { ...segmento, exterior: true, faceta };
}

// Fusiona segmentos consecutivos de la misma línea recta con la misma
// clase/clasificación en un único "tramo" — así una ventana real de ~2m
// (varios segmentos de tamanoCelda contiguos marcados 'ventana') se trata
// como una sola ventana, no como varias diminutas, y de paso reduce el
// número de mallas 3D que hará falta construir en la Fase 3.
export function fusionarEnTramos(plano) {
  const interiorSet = new Set(celdasInteriores(plano).map((c) => claveCelda(c.col, c.fila)));
  const clasificados = plano.segmentos.map((s) => clasificarSegmento(s, plano, interiorSet));

  const grupos = new Map();
  for (const s of clasificados) {
    const clave = s.tipo === 'H' ? `H,${s.fila}` : `V,${s.col}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(s);
  }

  const tramos = [];
  for (const lista of grupos.values()) {
    const ordenada = [...lista].sort((a, b) => (a.tipo === 'H' ? a.col - b.col : a.fila - b.fila));
    let actual = null;
    for (const s of ordenada) {
      const coord = s.tipo === 'H' ? s.col : s.fila;
      const continua =
        actual &&
        actual.clase === s.clase &&
        actual.exterior === s.exterior &&
        actual.faceta === s.faceta &&
        coord === actual.fin + 1;
      if (continua) {
        actual.fin = coord;
        actual.longitudCeldas += 1;
      } else {
        if (actual) tramos.push(actual);
        actual = {
          tipo: s.tipo,
          fijo: s.tipo === 'H' ? s.fila : s.col,
          inicio: coord,
          fin: coord,
          longitudCeldas: 1,
          clase: s.clase,
          exterior: s.exterior,
          faceta: s.faceta,
        };
      }
    }
    if (actual) tramos.push(actual);
  }

  return tramos;
}

// Superficie real de la casa (m²) — sustituye el campo manual `superficie`
// de parametrosPiso: se deriva de lo dibujado, nunca puede contradecirlo.
export function superficieTotal(plano) {
  return celdasInteriores(plano).length * plano.tamanoCelda ** 2;
}

function nombreVentana(indice) {
  return String.fromCharCode(65 + indice); // 'A', 'B', 'C'...
}

// Produce exactamente la forma de objeto que ya consumen sin cambios
// termico.js/sombra.js/irradiancia.js/recomendacion.js/gemelo.js/
// recalibracion.js: {nombre, orientacion, ancho, alturaEdificioEnfrente,
// distanciaEdificioEnfrente}. Único punto de integración entre el plano y
// el resto del modelo — todo lo demás sigue exactamente igual.
export function ventanasDelModelo(plano) {
  return fusionarEnTramos(plano)
    .filter((t) => t.clase === 'ventana' && t.exterior)
    .map((t, i) => ({
      nombre: nombreVentana(i),
      orientacion: orientacionDeFachada(plano.orientacionCasa, t.faceta),
      ancho: t.longitudCeldas * plano.tamanoCelda,
      alturaEdificioEnfrente: plano.obstruccionPorFachada[t.faceta].alturaEdificioEnfrente,
      distanciaEdificioEnfrente: plano.obstruccionPorFachada[t.faceta].distanciaEdificioEnfrente,
    }));
}

// Componentes conexas de un conjunto de celdas por adyacencia de rejilla
// (arriba/abajo/izq/dcha), IGNORANDO paredes — dos habitaciones con un
// muro macizo entre ellas y sin puerta siguen siendo la misma huella de
// edificio; lo que no se admite es un segundo bloque suelto sin ninguna
// celda adyacente al primero (fuera de alcance en v1: sin patios
// interiores ni edificios exentos sueltos).
function huellaConectada(interior) {
  if (interior.length === 0) return true;
  const claves = new Set(interior.map((c) => claveCelda(c.col, c.fila)));
  const visitado = new Set([claveCelda(interior[0].col, interior[0].fila)]);
  const cola = [interior[0]];
  while (cola.length > 0) {
    const { col, fila } = cola.pop();
    for (const [dc, df] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const vecino = { col: col + dc, fila: fila + df };
      const clave = claveCelda(vecino.col, vecino.fila);
      if (claves.has(clave) && !visitado.has(clave)) {
        visitado.add(clave);
        cola.push(vecino);
      }
    }
  }
  return visitado.size === interior.length;
}

// Validación estructural del plano (distinta de src/ui/validacion.js, que
// valida rangos de campos numéricos): comprueba invariantes de la forma
// dibujada. Se usa antes de guardar (Fase 2) y antes de construir la
// escena 3D, para no intentar dibujar un plano imposible.
export function validarPlano(plano) {
  const errores = [];
  const interior = celdasInteriores(plano);

  if (interior.length === 0) {
    errores.push('El plano no tiene ninguna celda interior — dibuja al menos una habitación cerrada.');
    return { valido: false, errores };
  }

  if (!huellaConectada(interior)) {
    errores.push('La huella de la casa debe ser una única región conectada (sin partes sueltas).');
  }

  const tieneVentanaExterior = fusionarEnTramos(plano).some((t) => t.clase === 'ventana' && t.exterior);
  if (!tieneVentanaExterior) {
    errores.push('El plano no tiene ninguna ventana en una pared exterior.');
  }

  return { valido: errores.length === 0, errores };
}

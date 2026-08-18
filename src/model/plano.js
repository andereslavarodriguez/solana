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

import { PAREDES, orientacionDeFachada } from './paredes.js';

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

// Extensión (en coordenadas de aristas) de todos los segmentos dibujados.
function extensionSegmentos(segmentos) {
  let minCol = Infinity;
  let maxCol = -Infinity;
  let minFila = Infinity;
  let maxFila = -Infinity;
  for (const s of segmentos) {
    minCol = Math.min(minCol, s.col);
    maxCol = Math.max(maxCol, s.col);
    minFila = Math.min(minFila, s.fila);
    maxFila = Math.max(maxFila, s.fila);
  }
  return { minCol, maxCol, minFila, maxFila };
}

// Garantiza al menos `margen` celdas vacías alrededor de todo lo dibujado
// (crece cols/filas y desplaza los segmentos si hace falta) — usado por
// el editor al cargar un plano para editar, nunca al guardar. Sin esto,
// un plano migrado (o cualquier otro dibujado hasta el borde) no deja
// sitio visible donde dibujar una ampliación: el usuario solo ve la casa
// ya hecha, sin ninguna pista de que se puede seguir dibujando alrededor
// — bug real reportado por el usuario ("he dibujado un cuadrado pequeño y
// se ha puesto dentro de la casa", porque no había ningún hueco fuera de
// ella donde cayera). Idempotente: si ya hay margen de sobra (plano ya
// editado antes), no cambia nada — así abrir y guardar el editor varias
// veces seguidas no hace crecer la cuadrícula sin parar.
export function conMargenGarantizado(plano, margen) {
  if (plano.segmentos.length === 0) return plano;

  const { minCol, maxCol, minFila, maxFila } = extensionSegmentos(plano.segmentos);
  const faltaIzquierda = Math.max(0, margen - minCol);
  const faltaArriba = Math.max(0, margen - minFila);
  const faltaDerecha = Math.max(0, margen - (plano.cols - maxCol));
  const faltaAbajo = Math.max(0, margen - (plano.filas - maxFila));

  if (!faltaIzquierda && !faltaArriba && !faltaDerecha && !faltaAbajo) return plano;

  return {
    ...plano,
    cols: plano.cols + faltaIzquierda + faltaDerecha,
    filas: plano.filas + faltaArriba + faltaAbajo,
    segmentos: plano.segmentos.map((s) => ({ ...s, col: s.col + faltaIzquierda, fila: s.fila + faltaArriba })),
  };
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

// Caja englobante (ancho × profundidad, en metros) de las celdas
// interiores — usada por la escena 3D para encuadrar la cámara y colocar
// decoraciones (árbol/farola/buzón) igual que con la habitación
// rectangular de antes, sin importar la forma real de la huella (Fase 3,
// ver docs/estado.md). También sirve de aproximación temporal para
// `anchoHabitacion` mientras la escena 3D todavía no sabe dibujar
// directamente la forma real del plano (Fase 1 -> Fase 3).
export function cajaEnvolvente(plano) {
  const interior = celdasInteriores(plano);
  const cols = interior.map((c) => c.col);
  const filas = interior.map((c) => c.fila);
  return {
    ancho: (Math.max(...cols) - Math.min(...cols) + 1) * plano.tamanoCelda,
    profundidad: (Math.max(...filas) - Math.min(...filas) + 1) * plano.tamanoCelda,
  };
}

// --- Migración desde el modelo anterior a esta fase (parametrosPiso con
// anchoHabitacion + ventanas fijas en paredes opuestas, Fases 1-8) ---

// m/celda — resolución del plano sintético generado al migrar. 0.25
// (original) daba ~475 celdas para el piso real del usuario, un editor
// casi imposible de usar con el dedo (celdas de pocos px). Subido a 0.4
// (bug real reportado en el móvil, "haz que dibujar paredes sea más
// fácil"): ~185 celdas, celdas más grandes que tocar, sin perder tanta
// fidelidad como para notarse (con el piso real, 30m² reales -> 30.72m²
// migrados, frente a 29.7m² con 0.25 — sigue siendo una aproximación
// aceptada a propósito, no una migración sin pérdida).
const MIGRACION_TAMANO_CELDA = 0.4;

// A qué fachada relativa corresponde una orientación real dada, cuando
// `orientacionCasa` es la única referencia disponible (no todas las
// orientaciones antiguas eran exactamente múltiplos de 90° entre sí) — se
// queda con la fachada cuya orientación real está más cerca angularmente.
function facetaMasCercana(orientacionCasa, orientacionReal) {
  let mejorFaceta = PAREDES[0];
  let mejorDiferencia = Infinity;
  for (const faceta of PAREDES) {
    const real = orientacionDeFachada(orientacionCasa, faceta);
    const diferencia = Math.min(Math.abs(orientacionReal - real), 360 - Math.abs(orientacionReal - real));
    if (diferencia < mejorDiferencia) {
      mejorDiferencia = diferencia;
      mejorFaceta = faceta;
    }
  }
  return mejorFaceta;
}

function segmentosRectangulo(cols, filas) {
  const segmentos = [];
  for (let col = 0; col < cols; col++) {
    segmentos.push({ tipo: 'H', col, fila: 0, clase: 'muro' });
    segmentos.push({ tipo: 'H', col, fila: filas, clase: 'muro' });
  }
  for (let fila = 0; fila < filas; fila++) {
    segmentos.push({ tipo: 'V', col: 0, fila, clase: 'muro' });
    segmentos.push({ tipo: 'V', col: cols, fila, clase: 'muro' });
  }
  return segmentos;
}

// Marca un tramo centrado de `longitudCeldas` como 'ventana' en la pared
// exterior de la fachada dada, recortado a la longitud real de esa pared.
function marcarVentanaMigrada(segmentos, faceta, longitudCeldas, cols, filas) {
  const encontrar = (tipo, col, fila) => segmentos.find((s) => s.tipo === tipo && s.col === col && s.fila === fila);
  if (faceta === 'frontal' || faceta === 'trasera') {
    const filaFija = faceta === 'frontal' ? 0 : filas;
    const longitud = Math.min(longitudCeldas, cols);
    const inicio = Math.floor((cols - longitud) / 2);
    for (let col = inicio; col < inicio + longitud; col++) {
      encontrar('H', col, filaFija).clase = 'ventana';
    }
  } else {
    const colFija = faceta === 'izquierda' ? 0 : cols;
    const longitud = Math.min(longitudCeldas, filas);
    const inicio = Math.floor((filas - longitud) / 2);
    for (let fila = inicio; fila < inicio + longitud; fila++) {
      encontrar('V', colFija, fila).clase = 'ventana';
    }
  }
}

// Genera un plano rectangular equivalente a un `parametrosPiso` del
// esquema anterior a esta fase — para no perder la configuración real de
// un usuario ya en producción al actualizar (src/persistencia/plano.js la
// usa como migración) y como plano de referencia del proyecto (piso real
// de spec.md §3.4). El redondeo a la resolución de la cuadrícula es una
// aproximación aceptada a propósito (mismo criterio que otros parámetros
// "elegidos a ojo" del proyecto) — no es una migración con pérdida cero.
export function planoDesdeRectangulo({ anchoHabitacion, superficie, ventanas }) {
  const tamanoCelda = MIGRACION_TAMANO_CELDA;
  const cols = Math.max(1, Math.round(anchoHabitacion / tamanoCelda));
  const filas = Math.max(1, Math.round(superficie / anchoHabitacion / tamanoCelda));
  const orientacionCasa = ventanas[0].orientacion;

  const segmentos = segmentosRectangulo(cols, filas);
  const obstruccionPorFachada = Object.fromEntries(
    PAREDES.map((faceta) => [faceta, { alturaEdificioEnfrente: 0, distanciaEdificioEnfrente: 100 }]),
  );

  for (const ventana of ventanas) {
    const faceta = facetaMasCercana(orientacionCasa, ventana.orientacion);
    const longitudCeldas = Math.max(1, Math.round(ventana.ancho / tamanoCelda));
    marcarVentanaMigrada(segmentos, faceta, longitudCeldas, cols, filas);
    obstruccionPorFachada[faceta] = {
      alturaEdificioEnfrente: ventana.alturaEdificioEnfrente,
      distanciaEdificioEnfrente: ventana.distanciaEdificioEnfrente,
    };
  }

  return { cols, filas, tamanoCelda, orientacionCasa, segmentos, obstruccionPorFachada };
}

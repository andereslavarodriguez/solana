// Casos de prueba manuales para geometria.js (Fase 3 de la generalización a
// cualquier casa, ver docs/estado.md — sustituye por completo los casos de
// la Fase 6, que asumían una única habitación rectangular con exactamente 2
// ventanas). Mismo patrón que test/model.test.js: cada caso imprime valores
// intermedios y los compara con un cálculo hecho a mano.

import assert from 'node:assert/strict';
import { calcularGeometria } from '../src/escena3d/geometria.js';

let ok = 0;
function caso(nombre, fn) {
  fn();
  ok += 1;
  console.log(`OK  ${nombre}`);
}

const cerca = (a, b, tol = 0.01) => Math.abs(a - b) < tol;

// Mismo generador de perímetro mínimo que test/plano.test.js: define la
// forma por las celdas que deben quedar "dentro", no arista a arista.
function segmentosPerimetro(cols, filas, dentro) {
  const clave = (c, f) => `${c},${f}`;
  const set = new Set(dentro.map(({ col, fila }) => clave(col, fila)));
  const esDentro = (c, f) => set.has(clave(c, f));
  const segmentos = [];
  for (let col = 0; col < cols; col++) {
    for (let fila = 0; fila <= filas; fila++) {
      if (esDentro(col, fila - 1) !== esDentro(col, fila)) segmentos.push({ tipo: 'H', col, fila, clase: 'muro' });
    }
  }
  for (let fila = 0; fila < filas; fila++) {
    for (let col = 0; col <= cols; col++) {
      if (esDentro(col - 1, fila) !== esDentro(col, fila)) segmentos.push({ tipo: 'V', col, fila, clase: 'muro' });
    }
  }
  return segmentos;
}

function marcar(segmentos, tipo, col, fila, clase) {
  const s = segmentos.find((s) => s.tipo === tipo && s.col === col && s.fila === fila);
  assert.ok(s, `segmento ${tipo}(${col},${fila}) no existe en el perímetro generado`);
  s.clase = clase;
}

function rectangulo(cols, filas) {
  const celdas = [];
  for (let fila = 0; fila < filas; fila++) {
    for (let col = 0; col < cols; col++) celdas.push({ col, fila });
  }
  return celdas;
}

const OBSTRUCCION = {
  frontal: { alturaEdificioEnfrente: 15, distanciaEdificioEnfrente: 45 },
  trasera: { alturaEdificioEnfrente: 12, distanciaEdificioEnfrente: 20 },
  izquierda: { alturaEdificioEnfrente: 8, distanciaEdificioEnfrente: 10 },
  derecha: { alturaEdificioEnfrente: 20, distanciaEdificioEnfrente: 30 },
};

// Rectángulo de 6×5 celdas de 1m -> exactamente 30m², la superficie de
// referencia (escala = 1 exacto, sin redondeos que compliquen comparar a
// mano). Ventanas a ANCHO COMPLETO en frontal/trasera (una sola pared de
// cristal por lado, como en la Fase 6) — el caso de una ventana más
// estrecha que su pared, con muro a los lados, se prueba aparte.
function planoRectanguloReferencia({ orientacionCasa = 0 } = {}) {
  const cols = 6;
  const filas = 5;
  const segmentos = segmentosPerimetro(cols, filas, rectangulo(cols, filas));
  for (let col = 0; col < cols; col++) {
    marcar(segmentos, 'H', col, 0, 'ventana');
    marcar(segmentos, 'H', col, filas, 'ventana');
  }
  return { cols, filas, tamanoCelda: 1, orientacionCasa, segmentos, obstruccionPorFachada: OBSTRUCCION };
}

console.log('\n--- calcularGeometria (rectángulo 6×5 = 30m², orientacionCasa = 0°) ---');

const plano = planoRectanguloReferencia();
const geo = calcularGeometria(plano, 2.5);
console.log('geo:', JSON.stringify(geo, null, 2));

caso('con superficie real = SUPERFICIE_REFERENCIA (30m²), la escala es 1', () => {
  assert.ok(cerca(geo.escala, 1, 1e-6));
});

caso('altura = alturaTecho (escala 1)', () => {
  assert.equal(geo.altura, 2.5);
});

caso('anchoLateral/profundidad = dimensiones reales de la caja englobante (6m × 5m, escala 1)', () => {
  assert.ok(cerca(geo.anchoLateral, 6));
  assert.ok(cerca(geo.profundidad, 5));
});

caso('ejeProfundidad y ejeLateral son unitarios y perpendiculares', () => {
  assert.ok(cerca(Math.hypot(geo.ejeProfundidad.x, geo.ejeProfundidad.z), 1));
  assert.ok(cerca(Math.hypot(geo.ejeLateral.x, geo.ejeLateral.z), 1));
  const dot = geo.ejeProfundidad.x * geo.ejeLateral.x + geo.ejeProfundidad.z * geo.ejeLateral.z;
  assert.ok(cerca(dot, 0));
});

caso('ejeProfundidad apunta a orientacionCasa (0° -> +Z, convención de brújula)', () => {
  assert.ok(cerca(geo.ejeProfundidad.x, 0));
  assert.ok(cerca(geo.ejeProfundidad.z, 1));
});

caso('4 paredes: frontal y trasera de cristal a ancho completo, 2 laterales opacas', () => {
  const cristal = geo.paredes.filter((p) => p.cristal);
  const opacas = geo.paredes.filter((p) => !p.cristal);
  assert.equal(geo.paredes.length, 4);
  assert.equal(cristal.length, 2);
  assert.equal(opacas.length, 2);
  cristal.forEach((p) => assert.ok(cerca(p.anchoVentana, 6)));
});

caso('anchoVentana coincide exactamente con ancho de la pared de cristal (ya no hay franjas centradas)', () => {
  geo.paredes
    .filter((p) => p.cristal)
    .forEach((p) => assert.ok(cerca(p.anchoVentana, p.ancho)));
});

caso('las paredes laterales (sin ventana) cubren el lado entero: ancho = profundidad', () => {
  geo.paredes
    .filter((p) => !p.cristal)
    .forEach((p) => assert.ok(cerca(p.ancho, geo.profundidad)));
});

caso('esquinasSuelo: un quad por cada una de las 30 celdas interiores', () => {
  assert.equal(geo.esquinasSuelo.length, 30);
  geo.esquinasSuelo.forEach((quad) => assert.equal(quad.length, 4));
});

caso('esquinasCaja: 4 puntos que forman el rectángulo real de 6×5', () => {
  assert.equal(geo.esquinasCaja.length, 4);
  const claves = new Set(geo.esquinasCaja.map((p) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`));
  assert.equal(claves.size, 4);
  const diagonales = [
    Math.hypot(geo.esquinasCaja[0].x - geo.esquinasCaja[2].x, geo.esquinasCaja[0].z - geo.esquinasCaja[2].z),
    Math.hypot(geo.esquinasCaja[1].x - geo.esquinasCaja[3].x, geo.esquinasCaja[1].z - geo.esquinasCaja[3].z),
  ];
  assert.ok(cerca(diagonales[0], diagonales[1]));
  assert.ok(cerca(diagonales[0], Math.hypot(6, 5)));
});

console.log('\n--- calcularGeometria (ventana parcial: deja muro a los lados como tramos aparte) ---');

const planoParcial = planoRectanguloReferencia();
// Sustituye la ventana frontal a ancho completo por una parcial (cols 1-3
// de 6) — cols 0 y 4-5 quedan como muro a los lados, en dos tramos
// distintos (no contiguos entre sí, separados por el hueco de cristal).
for (let col = 0; col < 6; col++) marcar(planoParcial.segmentos, 'H', col, 0, col >= 1 && col <= 3 ? 'ventana' : 'muro');
const geoParcial = calcularGeometria(planoParcial, 2.5);

caso('la línea frontal entera se reparte en 3 tramos (muro, ventana, muro) que suman el ancho completo', () => {
  const frontal = geoParcial.paredes.filter((p) => cerca(p.centro.y, geoParcial.altura / 2) && p.normal.z > 0.9);
  // normal.z>0.9 selecciona la línea frontal (normal = +ejeProfundidad,
  // que con orientacionCasa=0 es +Z) sin depender de cristal/no cristal.
  assert.equal(frontal.length, 3);
  const sumaAnchos = frontal.reduce((acc, p) => acc + p.ancho, 0);
  assert.ok(cerca(sumaAnchos, geoParcial.anchoLateral));
  const cristal = frontal.filter((p) => p.cristal);
  assert.equal(cristal.length, 1);
  assert.ok(cerca(cristal[0].anchoVentana, 3)); // cols 1,2,3
});

console.log('\n--- calcularGeometria (forma en L, ventanas en 3 fachadas) ---');

const cols = 6;
const filas = 5;
const dentroL = [...rectangulo(6, 2), ...rectangulo(3, 3).map(({ col, fila }) => ({ col, fila: fila + 2 }))];
const segmentosL = segmentosPerimetro(cols, filas, dentroL);
marcar(segmentosL, 'H', 2, 0, 'ventana'); // frontal
marcar(segmentosL, 'V', 0, 1, 'ventana'); // izquierda
marcar(segmentosL, 'V', 3, 3, 'ventana'); // derecha, en el borde entrante de la L
const planoL = {
  cols,
  filas,
  tamanoCelda: 1,
  orientacionCasa: 30,
  segmentos: segmentosL,
  obstruccionPorFachada: OBSTRUCCION,
};
const geoL = calcularGeometria(planoL, 2.5);

caso('forma en L: 3 ventanas en 3 fachadas distintas, cada una cristal:true', () => {
  const cristal = geoL.paredes.filter((p) => p.cristal);
  assert.equal(cristal.length, 3);
});

caso('forma en L: al menos una pared opaca por la esquina entrante (sin ventana ahí)', () => {
  const opacas = geoL.paredes.filter((p) => !p.cristal);
  assert.ok(opacas.length >= 3);
});

caso('forma en L: esquinasSuelo tiene tantos quads como celdas interiores reales (12+9=21, no 6×5=30)', () => {
  assert.equal(geoL.esquinasSuelo.length, 21);
});

caso('forma en L: esquinasCaja sigue siendo el rectángulo que ENVUELVE toda la L, no la silueta real', () => {
  const anchoCaja = Math.hypot(
    geoL.esquinasCaja[0].x - geoL.esquinasCaja[1].x,
    geoL.esquinasCaja[0].z - geoL.esquinasCaja[1].z,
  );
  // 6 celdas de ancho real × su propia escala (distinta de 1: la L tiene
  // 21m² reales, no los 30m² de referencia).
  assert.ok(cerca(anchoCaja, geoL.anchoLateral));
  assert.ok(cerca(geoL.anchoLateral, 6 * geoL.escala));
});

console.log('\n--- calcularGeometria (puerta: hueco sin geometría propia) ---');

const cols2 = 6;
const filas2 = 4;
const dentro2 = rectangulo(cols2, filas2);
const segmentosPuerta = segmentosPerimetro(cols2, filas2, dentro2);
marcar(segmentosPuerta, 'H', 0, 0, 'ventana');
segmentosPuerta.push({ tipo: 'V', col: 3, fila: 0, clase: 'muro' });
segmentosPuerta.push({ tipo: 'V', col: 3, fila: 1, clase: 'puerta' });
segmentosPuerta.push({ tipo: 'V', col: 3, fila: 2, clase: 'muro' });
segmentosPuerta.push({ tipo: 'V', col: 3, fila: 3, clase: 'muro' });
const planoPuerta = {
  cols: cols2,
  filas: filas2,
  tamanoCelda: 1,
  orientacionCasa: 0,
  segmentos: segmentosPuerta,
  obstruccionPorFachada: OBSTRUCCION,
};
const geoPuerta = calcularGeometria(planoPuerta, 2.5);

caso('un tramo de clase "puerta" no genera ninguna pared (hueco real en la malla)', () => {
  // Comparación robusta, sin calcular coordenadas de mundo a mano: el
  // MISMO plano pero con ese segmento como 'muro' en vez de 'puerta'
  // fusiona todo el tabique interior en un único tramo continuo (mismo
  // tipo/exterior/faceta a lo largo de las 4 celdas) — una pared menos
  // que con la puerta, que rompe esa continuidad en dos tramos con un
  // hueco real en medio.
  const planoSinPuerta = JSON.parse(JSON.stringify(planoPuerta));
  const segPuerta = planoSinPuerta.segmentos.find((s) => s.clase === 'puerta');
  segPuerta.clase = 'muro';
  const geoSinPuerta = calcularGeometria(planoSinPuerta, 2.5);

  assert.equal(geoSinPuerta.paredes.length, geoPuerta.paredes.length - 1);
});

console.log('\n--- calcularGeometria (escala con más/menos superficie real) ---');

const planoGrande = planoRectanguloReferencia();
planoGrande.tamanoCelda = 2; // mismo nº de celdas, 4× la superficie real (120m²)
const geoGrande = calcularGeometria(planoGrande, 2.5);

caso('con 4× la superficie real (120m²), la escala visual es menor que 1', () => {
  assert.ok(geoGrande.escala < 1);
});

caso('la superficie de planta DIBUJADA (anchoLateral × profundidad) es igual pese a 4× superficie real', () => {
  const dibujadaRef = geo.anchoLateral * geo.profundidad;
  const dibujadaGrande = geoGrande.anchoLateral * geoGrande.profundidad;
  assert.ok(cerca(dibujadaRef, dibujadaGrande, 0.01));
});

caso('la proporción ventana/pared no cambia con la escala', () => {
  const propRef = geo.paredes.find((p) => p.cristal).anchoVentana / geo.paredes.find((p) => p.cristal).ancho;
  const propGrande =
    geoGrande.paredes.find((p) => p.cristal).anchoVentana / geoGrande.paredes.find((p) => p.cristal).ancho;
  assert.ok(cerca(propRef, propGrande, 0.001));
});

const planoPequeno = planoRectanguloReferencia();
planoPequeno.tamanoCelda = 0.5; // 1/4 de la superficie real (7.5m²)
const geoPequeno = calcularGeometria(planoPequeno, 2.5);

caso('con menos superficie real, la escala visual es mayor que 1', () => {
  assert.ok(geoPequeno.escala > 1);
});

console.log(`\n${ok} casos OK (escena3d-geometria.test.js)`);

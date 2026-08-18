// Casos de prueba manuales para src/model/plano.js. Mismo patrón que el
// resto de test/*.test.js: funciones puras, sin DOM, sin red.

import assert from 'node:assert/strict';
import {
  celdasInteriores,
  fusionarEnTramos,
  superficieTotal,
  ventanasDelModelo,
  validarPlano,
  cajaEnvolvente,
  planoDesdeRectangulo,
  conMargenGarantizado,
} from '../src/model/plano.js';

let ok = 0;
function caso(nombre, fn) {
  fn();
  ok += 1;
  console.log(`OK  ${nombre}`);
}

// Genera el perímetro exterior mínimo (todos los segmentos 'muro') que
// hace falta para que `celdasInteriores` reproduzca exactamente el
// conjunto `dentro` de celdas {col,fila} — así los planos de prueba se
// definen por la FORMA que deben tener, no a mano segmento a segmento, y
// de paso el propio test comprueba que el flood fill reproduce esa forma.
function segmentosPerimetro(cols, filas, dentro) {
  const clave = (c, f) => `${c},${f}`;
  const set = new Set(dentro.map(({ col, fila }) => clave(col, fila)));
  const esDentro = (c, f) => set.has(clave(c, f));
  const segmentos = [];
  for (let col = 0; col < cols; col++) {
    for (let fila = 0; fila <= filas; fila++) {
      if (esDentro(col, fila - 1) !== esDentro(col, fila)) {
        segmentos.push({ tipo: 'H', col, fila, clase: 'muro' });
      }
    }
  }
  for (let fila = 0; fila < filas; fila++) {
    for (let col = 0; col <= cols; col++) {
      if (esDentro(col - 1, fila) !== esDentro(col, fila)) {
        segmentos.push({ tipo: 'V', col, fila, clase: 'muro' });
      }
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

const OBSTRUCCION_DE_PRUEBA = {
  frontal: { alturaEdificioEnfrente: 15, distanciaEdificioEnfrente: 45 },
  trasera: { alturaEdificioEnfrente: 12, distanciaEdificioEnfrente: 20 },
  izquierda: { alturaEdificioEnfrente: 8, distanciaEdificioEnfrente: 10 },
  derecha: { alturaEdificioEnfrente: 20, distanciaEdificioEnfrente: 30 },
};

console.log('\n--- plano.js ---');

caso('rectángulo simple: superficie, y ventanas en frontal/trasera con orientación y ancho correctos', () => {
  const cols = 4;
  const filas = 4;
  const segmentos = segmentosPerimetro(cols, filas, rectangulo(cols, filas));
  marcar(segmentos, 'H', 1, 0, 'ventana');
  marcar(segmentos, 'H', 2, 0, 'ventana'); // ventana frontal de 2 celdas contiguas
  marcar(segmentos, 'H', 0, filas, 'ventana'); // ventana trasera de 1 celda

  const plano = {
    cols,
    filas,
    tamanoCelda: 1,
    orientacionCasa: 0,
    segmentos,
    obstruccionPorFachada: OBSTRUCCION_DE_PRUEBA,
  };

  assert.equal(celdasInteriores(plano).length, 16);
  assert.equal(superficieTotal(plano), 16);

  const ventanas = ventanasDelModelo(plano);
  assert.equal(ventanas.length, 2);

  const frontal = ventanas.find((v) => v.orientacion === 0);
  assert.ok(frontal, 'debe existir una ventana orientada a 0° (frontal)');
  assert.equal(frontal.ancho, 2);
  assert.equal(frontal.alturaEdificioEnfrente, 15);
  assert.equal(frontal.distanciaEdificioEnfrente, 45);

  const trasera = ventanas.find((v) => v.orientacion === 180);
  assert.ok(trasera, 'debe existir una ventana orientada a 180° (trasera)');
  assert.equal(trasera.ancho, 1);
  assert.equal(trasera.alturaEdificioEnfrente, 12);
});

caso('forma en L: huella conectada, y ventanas en 3 fachadas distintas (frontal/izquierda/derecha)', () => {
  const cols = 4;
  const filas = 4;
  // Franja superior 4x2 + pata inferior-izquierda 2x2 -> forma en L, con
  // una esquina cóncava en (col>=2, fila>=2).
  const dentro = [
    ...rectangulo(4, 2), // filas 0-1, cols 0-3
    { col: 0, fila: 2 },
    { col: 1, fila: 2 },
    { col: 0, fila: 3 },
    { col: 1, fila: 3 },
  ];
  const segmentos = segmentosPerimetro(cols, filas, dentro);

  marcar(segmentos, 'H', 1, 0, 'ventana'); // pared frontal (arriba)
  marcar(segmentos, 'V', 0, 1, 'ventana'); // pared izquierda
  marcar(segmentos, 'V', 2, 2, 'ventana'); // pared derecha del tramo bajo (borde de la L)
  marcar(segmentos, 'V', 2, 3, 'ventana'); // contiguo al anterior -> se funde en un tramo de 2 celdas

  const plano = {
    cols,
    filas,
    tamanoCelda: 0.5,
    orientacionCasa: 90,
    segmentos,
    obstruccionPorFachada: OBSTRUCCION_DE_PRUEBA,
  };

  assert.deepEqual(
    celdasInteriores(plano)
      .map((c) => `${c.col},${c.fila}`)
      .sort(),
    dentro.map((c) => `${c.col},${c.fila}`).sort(),
  );

  const ventanas = ventanasDelModelo(plano);
  assert.equal(ventanas.length, 3);

  // orientacionCasa=90 -> frontal=90, trasera=270, izquierda=0, derecha=180
  const frontal = ventanas.find((v) => v.orientacion === 90);
  assert.ok(frontal);
  assert.equal(frontal.ancho, 0.5);

  const izquierda = ventanas.find((v) => v.orientacion === 0);
  assert.ok(izquierda);
  assert.equal(izquierda.alturaEdificioEnfrente, 8);

  const derecha = ventanas.find((v) => v.orientacion === 180);
  assert.ok(derecha, 'la pared derecha del tramo bajo de la L debe reconocerse como fachada derecha');
  assert.equal(derecha.ancho, 1); // 2 celdas de 0.5m fusionadas en un tramo
  assert.equal(derecha.alturaEdificioEnfrente, 20);
});

caso('puerta interior: no cuenta como ventana y no rompe la conectividad de la huella', () => {
  const cols = 6;
  const filas = 3;
  const dentro = rectangulo(cols, filas);
  const segmentos = segmentosPerimetro(cols, filas, dentro);
  marcar(segmentos, 'H', 0, 0, 'ventana');

  // Tabique interior entre las dos mitades (col=3), con una puerta en la
  // fila central — no forma parte del perímetro generado, así que se
  // añade a mano.
  segmentos.push({ tipo: 'V', col: 3, fila: 0, clase: 'muro' });
  segmentos.push({ tipo: 'V', col: 3, fila: 1, clase: 'puerta' });
  segmentos.push({ tipo: 'V', col: 3, fila: 2, clase: 'muro' });

  const plano = {
    cols,
    filas,
    tamanoCelda: 1,
    orientacionCasa: 0,
    segmentos,
    obstruccionPorFachada: OBSTRUCCION_DE_PRUEBA,
  };

  // La puerta separa dos habitaciones interiores (ambos lados ya son
  // "dentro"), así que sigue habiendo 18 celdas interiores y una única
  // huella conectada — validarPlano no debe quejarse.
  assert.equal(celdasInteriores(plano).length, 18);
  assert.equal(ventanasDelModelo(plano).length, 1); // la puerta no cuenta como ventana
  assert.deepEqual(validarPlano(plano), { valido: true, errores: [] });
});

caso('inválido: sin ninguna celda interior', () => {
  const plano = {
    cols: 4,
    filas: 4,
    tamanoCelda: 1,
    orientacionCasa: 0,
    segmentos: [],
    obstruccionPorFachada: OBSTRUCCION_DE_PRUEBA,
  };
  const resultado = validarPlano(plano);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.errores.some((e) => e.includes('celda interior')));
});

caso('inválido: casa cerrada sin ninguna ventana exterior', () => {
  const cols = 3;
  const filas = 3;
  const segmentos = segmentosPerimetro(cols, filas, rectangulo(cols, filas));
  const plano = {
    cols,
    filas,
    tamanoCelda: 1,
    orientacionCasa: 0,
    segmentos,
    obstruccionPorFachada: OBSTRUCCION_DE_PRUEBA,
  };
  const resultado = validarPlano(plano);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.errores.some((e) => e.includes('ventana')));
});

caso('inválido: dos regiones interiores desconectadas', () => {
  const cols = 6;
  const filas = 3;
  const bloque1 = rectangulo(2, 2); // cols 0-1, filas 0-1
  const bloque2 = [
    { col: 4, fila: 0 },
    { col: 5, fila: 0 },
    { col: 4, fila: 1 },
    { col: 5, fila: 1 },
  ];
  const segmentos = segmentosPerimetro(cols, filas, [...bloque1, ...bloque2]);
  marcar(segmentos, 'H', 0, 0, 'ventana');
  marcar(segmentos, 'H', 4, 0, 'ventana');

  const plano = {
    cols,
    filas,
    tamanoCelda: 1,
    orientacionCasa: 0,
    segmentos,
    obstruccionPorFachada: OBSTRUCCION_DE_PRUEBA,
  };

  // Ambos bloques son "interior" (ninguno alcanzable desde fuera), pero no
  // son la misma huella conectada.
  assert.equal(celdasInteriores(plano).length, 8);
  const resultado = validarPlano(plano);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.errores.some((e) => e.includes('conectada')));
});

caso('fusionarEnTramos: un muro largo sin interrupciones es un único tramo', () => {
  const cols = 5;
  const filas = 2;
  const segmentos = segmentosPerimetro(cols, filas, rectangulo(cols, filas));
  marcar(segmentos, 'H', 0, 0, 'ventana');
  const plano = {
    cols,
    filas,
    tamanoCelda: 1,
    orientacionCasa: 0,
    segmentos,
    obstruccionPorFachada: OBSTRUCCION_DE_PRUEBA,
  };
  const tramos = fusionarEnTramos(plano);
  const frontal = tramos.filter((t) => t.tipo === 'H' && t.fijo === 0);
  // col 0 = ventana (tramo propio), cols 1-4 = muro (un único tramo largo)
  assert.equal(frontal.length, 2);
  const muro = frontal.find((t) => t.clase === 'muro');
  assert.equal(muro.longitudCeldas, 4);
});

caso('cajaEnvolvente: forma en L da el ancho/profundidad de la caja que la contiene, no de las celdas', () => {
  const cols = 4;
  const filas = 4;
  const dentro = [
    ...rectangulo(4, 2),
    { col: 0, fila: 2 },
    { col: 1, fila: 2 },
    { col: 0, fila: 3 },
    { col: 1, fila: 3 },
  ];
  const segmentos = segmentosPerimetro(cols, filas, dentro);
  marcar(segmentos, 'H', 0, 0, 'ventana');
  const plano = {
    cols,
    filas,
    tamanoCelda: 0.5,
    orientacionCasa: 0,
    segmentos,
    obstruccionPorFachada: OBSTRUCCION_DE_PRUEBA,
  };
  // La L ocupa cols 0-3 (4 celdas) y filas 0-3 (4 celdas) en su caja
  // englobante, aunque las esquinas (2-3, 2-3) estén vacías.
  assert.deepEqual(cajaEnvolvente(plano), { ancho: 2, profundidad: 2 });
});

caso('planoDesdeRectangulo: reproduce un rectángulo equivalente al piso real (30m², ventanas opuestas)', () => {
  const plano = planoDesdeRectangulo({
    anchoHabitacion: 4.8,
    superficie: 30,
    ventanas: [
      { orientacion: 248, ancho: 2.0, alturaEdificioEnfrente: 15, distanciaEdificioEnfrente: 45 },
      { orientacion: 68, ancho: 1.8, alturaEdificioEnfrente: 12, distanciaEdificioEnfrente: 20 },
    ],
  });

  assert.equal(plano.orientacionCasa, 248);
  assert.ok(validarPlano(plano).valido);

  // Redondeo a la resolución de la cuadrícula (0.25m): tolerancia generosa,
  // no se busca precisión exacta (ver comentario de planoDesdeRectangulo).
  const superficieAprox = superficieTotal(plano);
  assert.ok(Math.abs(superficieAprox - 30) < 1.5, `superficie ${superficieAprox} debería rondar 30m²`);

  const ventanas = ventanasDelModelo(plano);
  assert.equal(ventanas.length, 2);
  const frontal = ventanas.find((v) => v.orientacion === 248);
  const trasera = ventanas.find((v) => v.orientacion === 68);
  assert.ok(frontal && trasera);
  assert.ok(Math.abs(frontal.ancho - 2.0) < 0.3);
  assert.ok(Math.abs(trasera.ancho - 1.8) < 0.3);
  assert.equal(frontal.alturaEdificioEnfrente, 15);
  assert.equal(trasera.distanciaEdificioEnfrente, 20);
});

caso('planoDesdeRectangulo: ventanas no exactamente opuestas se asignan a la fachada más cercana', () => {
  const plano = planoDesdeRectangulo({
    anchoHabitacion: 5,
    superficie: 25,
    ventanas: [
      { orientacion: 10, ancho: 1.5, alturaEdificioEnfrente: 5, distanciaEdificioEnfrente: 10 },
      { orientacion: 100, ancho: 1.2, alturaEdificioEnfrente: 3, distanciaEdificioEnfrente: 8 }, // ~90° de la primera -> "derecha"
    ],
  });
  const ventanas = ventanasDelModelo(plano);
  assert.equal(ventanas.length, 2);
  assert.ok(ventanas.some((v) => v.orientacion === 10)); // frontal, exacta
  assert.ok(ventanas.some((v) => v.orientacion === 100)); // derecha, exacta (orientacionCasa+90)
});

caso('conMargenGarantizado: un plano dibujado hasta el borde crece y se desplaza para dejar margen', () => {
  const cols = 6;
  const filas = 5;
  const segmentos = segmentosPerimetro(cols, filas, rectangulo(cols, filas));
  marcar(segmentos, 'H', 0, 0, 'ventana');
  const plano = { cols, filas, tamanoCelda: 1, orientacionCasa: 0, segmentos, obstruccionPorFachada: OBSTRUCCION_DE_PRUEBA };

  const conMargen = conMargenGarantizado(plano, 3);
  assert.equal(conMargen.cols, cols + 6);
  assert.equal(conMargen.filas, filas + 6);
  // La forma sigue siendo exactamente la misma casa, solo desplazada.
  const ventanasAntes = ventanasDelModelo(plano);
  const ventanasDespues = ventanasDelModelo(conMargen);
  assert.equal(ventanasDespues.length, ventanasAntes.length);
  assert.ok(Math.abs(superficieTotal(conMargen) - superficieTotal(plano)) < 0.001);
  // Y ahora sí hay al menos 3 celdas vacías alrededor por todos los lados.
  const interior = new Set(celdasInteriores(conMargen).map((c) => `${c.col},${c.fila}`));
  assert.ok(!interior.has('0,0')); // la esquina de la cuadrícula ya no es parte de la casa
});

caso('conMargenGarantizado: si ya hay margen de sobra, no cambia nada (idempotente)', () => {
  const cols = 10;
  const filas = 10;
  const segmentos = segmentosPerimetro(cols, filas, rectangulo(4, 4).map((c) => ({ col: c.col + 3, fila: c.fila + 3 })));
  marcar(segmentos, 'H', 4, 3, 'ventana');
  const plano = { cols, filas, tamanoCelda: 1, orientacionCasa: 0, segmentos, obstruccionPorFachada: OBSTRUCCION_DE_PRUEBA };

  const resultado = conMargenGarantizado(plano, 2);
  assert.deepEqual(resultado, plano);
});

caso('conMargenGarantizado: plano vacío (sin segmentos) se deja tal cual', () => {
  const plano = { cols: 5, filas: 5, tamanoCelda: 1, orientacionCasa: 0, segmentos: [], obstruccionPorFachada: OBSTRUCCION_DE_PRUEBA };
  assert.deepEqual(conMargenGarantizado(plano, 3), plano);
});

console.log(`\n${ok} casos OK (plano.test.js)\n`);

// Geometría de la casa derivada del plano en cuadrícula (Fase 3 de la
// generalización a cualquier casa, ver docs/estado.md). Función pura: no
// importa Three.js, solo devuelve números/vectores en metros, en un
// sistema de coordenadas de mundo atado a la brújula real (+X = Este,
// +Z = Norte, +Y = arriba, origen en el centro de la huella de la casa),
// la misma convención de azimut que ya usan sol.js/irradiancia.js/
// sombra.js (0°=N, 90°=E, 180°=S, 270°=O). Así la orientación de la casa
// en la escena 3D queda automáticamente coherente con la posición solar
// real: no hace falta ninguna conversión aparte al dibujar el sol.
//
// Sustituye a la caja rectangular de una sola habitación de las Fases 1-8
// (`[ventanaA, ventanaB] = parametrosPiso.ventanas`, siempre 2 paredes de
// cristal en lados opuestos + 2 laterales opacas): ahora la forma de la
// casa (cuántas paredes, dónde están las puertas/ventanas, cuántas
// habitaciones) sale de `src/model/plano.js` (`fusionarEnTramos`,
// `celdasInteriores`), y esta función solo convierte esa descripción
// abstracta (columnas/filas de una cuadrícula) a coordenadas de mundo
// reales — no decide NADA sobre la forma en sí.
//
// Tamaño VISUAL fijo, independiente de la superficie/proporciones reales
// (decisión de la Fase 6, sin cambios): `escala` se aplica por igual a las
// 3 dimensiones (ancho, profundidad, alto) para que la superficie de
// planta dibujada quede fija en SUPERFICIE_REFERENCIA sea cual sea la
// real, sin distorsionar la forma. SUPERFICIE_REFERENCIA reproduce a
// propósito la superficie del piso de referencia del proyecto (30m²): con
// una casa de esa superficie, `escala` da 1 y la escena no cambia nada
// respecto a como está calibrada (zoom, isla, farola...) desde la Fase 6.
import { celdasInteriores, fusionarEnTramos, superficieTotal } from '../model/plano.js';

const SUPERFICIE_REFERENCIA = 30; // m²

const DEG2RAD = Math.PI / 180;

// Vector unitario horizontal para un azimut en convención de brújula.
function direccionAzimut(azimutDeg) {
  const rad = azimutDeg * DEG2RAD;
  return { x: Math.sin(rad), z: Math.cos(rad) };
}

// Rotación de 90° en el plano XZ (perpendicular a una dirección de brújula).
function perpendicular({ x, z }) {
  return { x: z, z: -x };
}

// Convierte un tramo de pared (src/model/plano.js: {tipo, fijo, inicio,
// fin, longitudCeldas, clase, exterior, faceta}, en coordenadas de
// cuadrícula) al mismo objeto "pared" que ya consume escena3d/escena.js
// sin cambios: {centro, normal, ancho, alto, cristal, anchoVentana?}.
//
// Una ventana ya es, por construcción, un tramo PROPIO (fusionarEnTramos
// corta la línea en cuanto cambia la clase) — así que su anchoVentana
// coincide siempre con el ancho entero de ESTE tramo, nunca un hueco
// centrado dentro de una pared más ancha. Las franjas de pared opaca a
// los lados de una ventana (Fase 6) ya no hacen falta aquí: son,
// simplemente, los tramos 'muro' contiguos, construidos como paredes
// aparte — construirParedConVentana (escena.js) ya no construye ninguna
// franja cuando anchoVentana===ancho (su cálculo de anchoLado da ~0).
//
// Los tramos 'puerta' NO llegan a esta función (se filtran antes, ver
// calcularGeometria): una puerta es un hueco sin geometría propia
// (decisión de la Fase 2, ver docs/estado.md) — la pared simplemente no
// aparece ahí.
function construirParedDesdeTramo(tramo, punto, altura, ejeProfundidad, ejeLateral) {
  let p1;
  let p2;
  let normal;

  if (tramo.tipo === 'H') {
    p1 = punto(tramo.inicio, tramo.fijo, altura / 2);
    p2 = punto(tramo.fin + 1, tramo.fijo, altura / 2);
    const signo = tramo.faceta === 'trasera' ? -1 : 1;
    normal = { x: ejeProfundidad.x * signo, y: 0, z: ejeProfundidad.z * signo };
  } else {
    p1 = punto(tramo.fijo, tramo.inicio, altura / 2);
    p2 = punto(tramo.fijo, tramo.fin + 1, altura / 2);
    // 'derecha' (no 'izquierda'): col menor = fachada "derecha" desde
    // 2026-08-18 (ver src/model/plano.js#clasificarSegmento y
    // src/model/paredes.js — los tres tienen que cambiar juntos, un bug
    // real dejó esto a medias una vez, con la normal de esta fachada
    // apuntando hacia dentro de la casa en vez de hacia fuera).
    const signo = tramo.faceta === 'derecha' ? -1 : 1;
    normal = { x: ejeLateral.x * signo, y: 0, z: ejeLateral.z * signo };
  }

  const centro = { x: (p1.x + p2.x) / 2, y: altura / 2, z: (p1.z + p2.z) / 2 };
  const ancho = Math.hypot(p2.x - p1.x, p2.z - p1.z);

  const base = { centro, normal, ancho, alto: altura };
  if (tramo.clase !== 'ventana') return { ...base, cristal: false };
  return { ...base, cristal: true, anchoVentana: ancho };
}

export function calcularGeometria(plano, alturaTecho) {
  const escala = Math.sqrt(SUPERFICIE_REFERENCIA / superficieTotal(plano));
  const altura = alturaTecho * escala;

  // Eje "profundidad" = orientación real de la fachada frontal; eje
  // "lateral" = perpendicular (la fachada "derecha", ver
  // src/model/paredes.js: OFFSET_PARED.derecha = 90°).
  const ejeProfundidad = direccionAzimut(plano.orientacionCasa);
  const ejeLateral = perpendicular(ejeProfundidad);

  const interior = celdasInteriores(plano);
  const cols = interior.map((c) => c.col);
  const filas = interior.map((c) => c.fila);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  const minFila = Math.min(...filas);
  const maxFila = Math.max(...filas);
  // Centro de la huella real (no de la cuadrícula entera, que puede tener
  // mucho margen sin dibujar alrededor) — el mismo papel que tenía el
  // centro del rectángulo de la única habitación en la Fase 6.
  const colCentro = (minCol + maxCol + 1) / 2;
  const filaCentro = (minFila + maxFila + 1) / 2;

  const unidad = plano.tamanoCelda * escala;

  // Un punto de la cuadrícula (esquina de celda: col/fila enteros, no el
  // centro de una celda) a coordenadas de mundo. `fila` crece hacia la
  // fachada trasera y `col` hacia la fachada derecha (convención fijada
  // en src/model/plano.js) — de ahí el signo invertido en AMBOS, no solo
  // en profundidad.
  //
  // Bug real corregido (2026-08-19, ver docs/estado.md): con `lateral =
  // (col - colCentro)` sin invertir, la traducción de la cuadrícula 2D al
  // mundo 3D no era una simple rotación, sino una rotación CON UN
  // ESPEJO — una puerta dibujada a la derecha de la entrada, en el
  // editor, aparecía a la izquierda de quien entra en la escena 3D (y
  // viceversa). Un primer intento de arreglo cambió solo qué NOMBRE
  // recibe cada lado de la cuadrícula (clasificarSegmento) — no sirvió,
  // porque renombrar una etiqueta no cambia la geometría real que hay
  // detrás; el espejo seguía ahí, solo que ahora además con la normal de
  // esas paredes apuntando hacia dentro de la casa. El arreglo de
  // verdad tenía que ser este: invertir también `lateral`, para que la
  // transformación completa (columna → lateral, fila → profundidad) sea
  // una rotación pura, sin ningún espejo — verificado con producto
  // vectorial (misma orientación de giro en la cuadrícula 2D y en el
  // mundo 3D visto desde arriba) y con el caso concreto reportado
  // (entrando por la fachada frontal, la mano derecha de quien entra
  // coincide con lo dibujado a la derecha del editor).
  function punto(col, fila, y) {
    const lateral = (colCentro - col) * unidad;
    const profundidad = (filaCentro - fila) * unidad;
    return {
      x: ejeProfundidad.x * profundidad + ejeLateral.x * lateral,
      y,
      z: ejeProfundidad.z * profundidad + ejeLateral.z * lateral,
    };
  }

  const anchoLateral = (maxCol - minCol + 1) * unidad;
  const profundidad = (maxFila - minFila + 1) * unidad;

  const paredes = fusionarEnTramos(plano)
    .filter((t) => t.clase !== 'puerta')
    .map((t) => construirParedDesdeTramo(t, punto, altura, ejeProfundidad, ejeLateral));

  // Suelo/techo: un quad por celda interior, no un único rectángulo — la
  // huella ya no es necesariamente un rectángulo simple. Cada quad
  // reutiliza tal cual construirQuadPlano (escena.js), sin tocar esa
  // función: solo cambia CUÁNTOS quads se construyen.
  const esquinasSuelo = interior.map(({ col, fila }) => [
    punto(col, fila, 0),
    punto(col + 1, fila, 0),
    punto(col + 1, fila + 1, 0),
    punto(col, fila + 1, 0),
  ]);

  // Las 4 esquinas de la CAJA ENGLOBANTE de la huella (no de la huella
  // real, que puede tener cualquier forma) — usadas por decoraciones que
  // necesitan "una esquina de la casa" sin importar la silueta exacta
  // (buzón, farola: ver escena.js). Mismo orden que tenían las 4 esquinas
  // del rectángulo de la única habitación en la Fase 6 — (+prof,+lat),
  // (+prof,-lat), (-prof,-lat), (-prof,+lat) — y no cualquier orden: el
  // buzón usa el índice 0 fijo, ya calibrado en la Fase 6 para no quedar
  // pegado al árbol (que se posiciona con un criterio distinto,
  // perpendicular a la cámara). Bug real de la Fase 3: un orden distinto
  // aquí desplazó el índice 0 a la esquina contraria (-lat en vez de
  // +lat), que coincidía casi con la posición del árbol — confirmado en
  // el móvil real del usuario ("se ha movido el buzón y está incrustado
  // con el árbol").
  const esquinasCaja = [
    punto(maxCol + 1, minFila, 0),
    punto(minCol, minFila, 0),
    punto(minCol, maxFila + 1, 0),
    punto(maxCol + 1, maxFila + 1, 0),
  ];

  return {
    anchoLateral,
    profundidad,
    altura,
    escala,
    ejeProfundidad,
    ejeLateral,
    paredes,
    esquinasSuelo,
    esquinasCaja,
  };
}

// Geometría de la habitación derivada de parametrosPiso (spec.md §3.4, §6.1).
//
// Función pura: no importa Three.js, solo devuelve números/vectores en
// metros, en un sistema de coordenadas de mundo atado a la brújula real
// (+X = Este, +Z = Norte, +Y = arriba, origen en el centro del suelo), la
// misma convención de azimut que ya usan sol.js/irradiancia.js/sombra.js
// (0°=N, 90°=E, 180°=S, 270°=O). Así la orientación de la habitación en la
// escena 3D queda automáticamente coherente con la posición solar real: no
// hace falta ninguna conversión aparte al dibujar el sol.
//
// Decisión de Fase 6 (sin base en spec.md, a anotar en estado.md cuando se
// cierre el checkpoint): parametrosPiso no tiene forma de planta, solo
// `superficie` total (editor visual de planta fuera de alcance en v1,
// spec.md §8) — así que la habitación se modela como una caja rectangular.
// Las dos ventanas (A/B) son paredes opuestas de cristal completo (suelo a
// techo, spec.md §3.4).
//
// El ancho lateral no se deriva ni de un ratio inventado en este módulo ni
// solo del ancho de ventana: es `parametrosPiso.anchoHabitacion`, un
// parámetro editable en la pantalla de parámetros (Fase 4/6,
// src/ui/parametros.js) — la única dimensión de planta que existe en los
// datos reales del piso, más allá de `superficie`. La profundidad sigue
// derivándose (`superficie / anchoHabitacion`), así `superficie` sigue
// siendo la única fuente de verdad para la capacidad térmica en
// termico.js — anchoHabitacion no la sustituye, solo reparte esa área en
// las dos dimensiones que necesita la caja 3D.
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

export function calcularGeometria(parametrosPiso) {
  const [ventanaA, ventanaB] = parametrosPiso.ventanas;
  const alturaTecho = parametrosPiso.alturaTecho;

  const anchoLateral = parametrosPiso.anchoHabitacion;
  const profundidad = parametrosPiso.superficie / anchoLateral;

  // Eje "profundidad" = normal de la ventana A (pared A al frente, pared B
  // detrás); eje "lateral" = perpendicular, sin datos de ventana.
  const ejeProfundidad = direccionAzimut(ventanaA.orientacion);
  const ejeLateral = perpendicular(ejeProfundidad);

  const mitadProfundidad = profundidad / 2;
  const mitadLateral = anchoLateral / 2;

  function punto(coordProfundidad, coordLateral, y) {
    return {
      x: ejeProfundidad.x * coordProfundidad + ejeLateral.x * coordLateral,
      y,
      z: ejeProfundidad.z * coordProfundidad + ejeLateral.z * coordLateral,
    };
  }

  // Cada pared: centro, normal saliente (unitaria), ancho (extensión
  // horizontal), alto, y si es de cristal (ventana suelo-a-techo) u opaca.
  const paredes = [
    {
      id: 'A',
      centro: punto(mitadProfundidad, 0, alturaTecho / 2),
      normal: { x: ejeProfundidad.x, y: 0, z: ejeProfundidad.z },
      ejeAncho: ejeLateral,
      ancho: anchoLateral,
      alto: alturaTecho,
      cristal: true,
      anchoVentana: ventanaA.ancho,
    },
    {
      id: 'B',
      centro: punto(-mitadProfundidad, 0, alturaTecho / 2),
      normal: { x: -ejeProfundidad.x, y: 0, z: -ejeProfundidad.z },
      ejeAncho: ejeLateral,
      ancho: anchoLateral,
      alto: alturaTecho,
      cristal: true,
      anchoVentana: ventanaB.ancho,
    },
    {
      id: 'lateral1',
      centro: punto(0, mitadLateral, alturaTecho / 2),
      normal: { x: ejeLateral.x, y: 0, z: ejeLateral.z },
      ejeAncho: ejeProfundidad,
      ancho: profundidad,
      alto: alturaTecho,
      cristal: false,
    },
    {
      id: 'lateral2',
      centro: punto(0, -mitadLateral, alturaTecho / 2),
      normal: { x: -ejeLateral.x, y: 0, z: -ejeLateral.z },
      ejeAncho: ejeProfundidad,
      ancho: profundidad,
      alto: alturaTecho,
      cristal: false,
    },
  ];

  // Esquinas del suelo en el mismo sistema de ejes rotado que las paredes
  // (no un rectángulo alineado a los ejes del mundo) — si no, suelo y
  // paredes no coinciden y sobresalen triángulos por las esquinas.
  const esquinasSuelo = [
    punto(mitadProfundidad, mitadLateral, 0),
    punto(mitadProfundidad, -mitadLateral, 0),
    punto(-mitadProfundidad, -mitadLateral, 0),
    punto(-mitadProfundidad, mitadLateral, 0),
  ];

  return {
    anchoLateral,
    profundidad,
    altura: alturaTecho,
    ejeProfundidad,
    ejeLateral,
    paredes,
    esquinasSuelo,
  };
}


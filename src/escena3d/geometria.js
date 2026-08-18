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
//
// Tamaño VISUAL fijo, independiente de la superficie/proporciones reales
// (pedido explícito: "que la casa tenga siempre la misma superficie
// visual, que lo único que cambie sea la proporción de esta y el tamaño
// de las ventanas"). Sin esto, una superficie real mayor agranda la caja
// de la habitación; `calcularRadioEscena()` (escena.js) aleja la cámara
// para que quepa entera, y todo lo que no escala con la habitación en sí
// (árbol, farola, buzón, piedras del muro — atados a `geo.altura` o al
// radio de la escena) se ve más pequeño en el encuadre sin que nadie lo
// haya pedido. `escala` se aplica por igual a las 3 dimensiones (ancho,
// profundidad, alto) — así la superficie de planta dibujada queda fija en
// SUPERFICIE_REFERENCIA sea cual sea la real, pero la FORMA de la caja
// (ancho:profundidad según anchoHabitacion, alto según alturaTecho) sigue
// siendo exactamente la que dictan los parámetros reales, sin distorsión.
// El mismo `escala` se aplica también al ancho real de cada ventana, para
// que su proporción respecto a su propia pared (lo único de la ventana
// que de verdad importa visualmente) coincida con la real.
//
// SUPERFICIE_REFERENCIA reproduce a propósito el valor de
// `superficie` en PARAMETROS_PISO_POR_DEFECTO (src/persistencia/piso.js):
// con ese valor exacto, `escala` da 1 y la escena no cambia nada respecto
// a como está calibrada (zoom, isla, farola...) desde la Fase 6. No se
// importa de piso.js a propósito, para no acoplar este módulo (puro, sin
// dependencias) a la capa de persistencia por un único valor — mismo
// criterio ya usado en recalibracion.js.
const SUPERFICIE_REFERENCIA = 30; // m² (piso.js: superficie por defecto)

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

  const escala = Math.sqrt(SUPERFICIE_REFERENCIA / parametrosPiso.superficie);

  const alturaTecho = parametrosPiso.alturaTecho * escala;
  const anchoLateral = parametrosPiso.anchoHabitacion * escala;
  const profundidad = (parametrosPiso.superficie / parametrosPiso.anchoHabitacion) * escala;

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
      anchoVentana: ventanaA.ancho * escala,
    },
    {
      id: 'B',
      centro: punto(-mitadProfundidad, 0, alturaTecho / 2),
      normal: { x: -ejeProfundidad.x, y: 0, z: -ejeProfundidad.z },
      ejeAncho: ejeLateral,
      ancho: anchoLateral,
      alto: alturaTecho,
      cristal: true,
      anchoVentana: ventanaB.ancho * escala,
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
    escala,
    ejeProfundidad,
    ejeLateral,
    paredes,
    esquinasSuelo,
  };
}


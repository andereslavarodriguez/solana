// Traduce datos de sol (mismo objeto {elevacion, azimut} que devuelve
// posicionSolar() de src/data/sol.js) a lo que necesita la escena 3D:
// dirección de la luz y un factor de intensidad 0-1. Función pura — no
// importa Three.js, solo números — para poder testear con assert igual que
// geometria.js.
//
// direccionSol() usa la misma convención de ejes que geometria.js (+X=Este,
// +Z=Norte, +Y=arriba), así que la luz de la escena y la física del modelo
// térmico quedan atadas a la misma posición solar sin ninguna conversión
// aparte.

const DEG2RAD = Math.PI / 180;

export function direccionSol(sol) {
  const azRad = sol.azimut * DEG2RAD;
  const elevRad = sol.elevacion * DEG2RAD;
  return {
    x: Math.sin(azRad) * Math.cos(elevRad),
    y: Math.sin(elevRad),
    z: Math.cos(azRad) * Math.cos(elevRad),
  };
}

// Suelo de nubosidad PROPIO de la escena, distinto del FACTOR_NUBES_MINIMO
// del modelo térmico (0.2, constantes.js) — decisión deliberada, no un
// descuido. Hasta ahora esta función reutilizaba literalmente iProxy/I_MAX
// (la misma curva que Q_solar) "para que la escena no se oscurezca con una
// curva distinta a la física real" — pero pedido explícito del usuario tras
// verlo en vivo: con mucha nube la escena se apagaba demasiado. La física
// del modelo térmico (Fase 1/4) sigue intacta, sin tocar — esto es
// puramente la curva que decide cuánta luz DIRECCIONAL dibuja la escena 3D,
// que ya venía tomándose licencias estéticas sin más base física en otros
// sitios (emissive de la isla, HemisphereLight nocturna, etc. — ver
// docs/estado.md, Fase 6). Con un suelo más alto, un cielo cubierto sigue
// dejando la escena razonablemente iluminada.
const FACTOR_NUBES_MINIMO_ESCENA = 0.55;

function factorNubosidadEscena(nubesPct) {
  const f = 1 - ((1 - FACTOR_NUBES_MINIMO_ESCENA) * nubesPct) / 100;
  return Math.max(FACTOR_NUBES_MINIMO_ESCENA, Math.min(1, f));
}

// Intensidad de la luz solar DIRECCIONAL de la escena — día/noche por
// elevación (0 bajo el horizonte, hasta 1 en el cénit) modulada por la
// curva de nubosidad más suave de arriba. Sigue habiendo menos luz con más
// nubes (no se pierde el efecto), pero mucho menos agresivo que la curva
// térmica real.
export function factorIntensidadSol(sol) {
  if (sol.elevacion <= 0) return 0;
  const senElev = Math.max(0, Math.sin(sol.elevacion * DEG2RAD));
  return Math.min(1, senElev * factorNubosidadEscena(sol.nubesPct));
}

// Cuánto de "encapotado" está el cielo, 0 (despejado) a 1 (100% nubes) —
// independiente de la elevación solar (a diferencia de factorIntensidadSol,
// que sí depende de si es de día). Se usa para difuminar la sombra: con
// mucha nube el sol deja de ser una única fuente puntual y pasa a
// dispersarse por todo el cielo — las nubes "actúan como focos" propios,
// así que el contorno de la sombra se vuelve mucho más suave en vez de
// seguir siendo un borde duro con menos luz.
export function factorDifusionNubes(nubesPct) {
  return Math.max(0, Math.min(1, nubesPct / 100));
}

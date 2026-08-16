// Recalibración de UA/factorCapacidad por regresión simple (Fase 7,
// spec.md §4.2), sobre las últimas ~30 anotaciones no etiquetadas.
//
// La ecuación del modelo (termico.js) es lineal en dos parámetros
// combinados: dT_in/dt = a·(T_out−T_in) + b·(Q_solar+Q_vent), con
// a = UA/C y b = 1/C. Cada intervalo entre dos anotaciones consecutivas
// aporta una fila de esa regresión: la pendiente REAL observada
// ((T_real_actual − T_real_anterior) / segundos transcurridos) contra los
// promedios ponderados por tiempo de los dos regresores que ya acumula el
// gemelo en vivo (src/model/gemelo.js) mientras avanza entre esas dos
// anotaciones.

import { capacidadTermica } from './termico.js';

export const VENTANA_RECALIBRACION = 30;
export const MINIMO_FILAS_RECALIBRACION = 10;

// Mismos límites que RANGOS.UA/RANGOS.factorCapacidad en
// src/ui/validacion.js (Fase 4) — duplicados aquí a propósito, no
// importados: src/model/ no depende de src/ui/ en ninguna otra fase, y una
// regresión sobre anotaciones ruidosas escritas a mano puede producir un
// ajuste sin sentido físico que no debe sobrescribir los parámetros del
// piso aunque el sistema de ecuaciones no sea degenerado.
const LIMITE_UA = { min: 5, max: 300 };
const LIMITE_FACTOR_CAPACIDAD = { min: 1, max: 20 };

// A partir del array completo de anotaciones (orden cronológico, tal como
// las devuelve listarAnotaciones), construye una fila de regresión por cada
// anotación NO etiquetada que ya tiene regresores calculados (predicho,
// avgConduccion, avgSolarVent — ver dashboard.js: se guardan al anotar,
// usando el estado del gemelo justo antes de corregirlo). La primera
// anotación de la lista nunca los tiene (no hay anotación anterior con la
// que comparar) y se ignora sin más.
export function construirFilasRegresion(anotaciones) {
  const filas = [];
  for (let i = 1; i < anotaciones.length; i += 1) {
    const actual = anotaciones[i];
    const anterior = anotaciones[i - 1];
    if (actual.etiquetas && actual.etiquetas.length > 0) continue;
    if (actual.avgConduccion == null || actual.avgSolarVent == null) continue;

    const deltaSegundos =
      (new Date(actual.timestamp).getTime() - new Date(anterior.timestamp).getTime()) / 1000;
    if (deltaSegundos <= 0) continue;

    filas.push({
      timestamp: actual.timestamp,
      avgConduccion: actual.avgConduccion,
      avgSolarVent: actual.avgSolarVent,
      pendienteObservada: (actual.temperatura - anterior.temperatura) / deltaSegundos,
    });
  }
  return filas;
}

// Mínimos cuadrados (ecuaciones normales, sistema 2x2) para
// y ≈ a·x1 + b·x2. Devuelve null si el sistema es degenerado (p.ej. sin
// variación real en alguno de los regresores — techo siempre cerrado en
// todo el histórico reciente).
function minimosCuadrados(filas) {
  let Sxx1 = 0;
  let Sx1x2 = 0;
  let Sx2x2 = 0;
  let Sx1y = 0;
  let Sx2y = 0;

  for (const { avgConduccion: x1, avgSolarVent: x2, pendienteObservada: y } of filas) {
    Sxx1 += x1 * x1;
    Sx1x2 += x1 * x2;
    Sx2x2 += x2 * x2;
    Sx1y += x1 * y;
    Sx2y += x2 * y;
  }

  const det = Sxx1 * Sx2x2 - Sx1x2 * Sx1x2;
  const escala = Math.max(Sxx1, Sx2x2, 1e-9);
  if (Math.abs(det) < 1e-9 * escala * escala) return null;

  const a = (Sx1y * Sx2x2 - Sx2y * Sx1x2) / det;
  const b = (Sxx1 * Sx2y - Sx1x2 * Sx1y) / det;
  return { a, b };
}

// Recalibra UA/factorCapacidad a partir de las filas ya construidas
// (construirFilasRegresion). `piso` solo se usa para leer factorCapacidad
// actual y derivar de ahí la constante volumen·densidad·calorEspecífico
// (capacidadTermica(piso)/piso.factorCapacidad, sin duplicar esa fórmula).
// Devuelve null si no hay datos suficientes, el ajuste es degenerado, o el
// resultado no es físicamente plausible (fuera de los rangos válidos de la
// pantalla de parámetros) — en ningún caso se sobrescriben los parámetros
// del piso con un ajuste dudoso.
export function recalibrar(filas, piso) {
  if (filas.length < MINIMO_FILAS_RECALIBRACION) return null;

  const ultimasFilas = filas.slice(-VENTANA_RECALIBRACION);
  const resultado = minimosCuadrados(ultimasFilas);
  if (!resultado) return null;

  const { a, b } = resultado;
  if (!(b > 0)) return null; // C = 1/b debe ser positivo

  const capacidadNueva = 1 / b;
  const UANueva = a * capacidadNueva;

  const capacidadPorUnidadFactor = capacidadTermica(piso) / piso.factorCapacidad;
  const factorCapacidadNuevo = capacidadNueva / capacidadPorUnidadFactor;

  if (UANueva < LIMITE_UA.min || UANueva > LIMITE_UA.max) return null;
  if (
    factorCapacidadNuevo < LIMITE_FACTOR_CAPACIDAD.min ||
    factorCapacidadNuevo > LIMITE_FACTOR_CAPACIDAD.max
  ) {
    return null;
  }

  return { UA: UANueva, factorCapacidad: factorCapacidadNuevo, nFilas: ultimasFilas.length };
}

// Constantes físicas y valores de referencia del modelo (spec.md §4)

// Irradiancia máxima de referencia usada por I_proxy. Constante fija en código,
// no es un parámetro editable por el usuario (decisión anotada en docs/estado.md).
export const I_MAX = 1000; // W/m²

// Fracción mínima de irradiancia que sigue llegando incluso con cielo 100%
// cubierto (§4, corrección real reportada por el usuario 2026-08-17 — ver
// docs/estado.md: con la modulación lineal original, 100% de nubes daba
// Q_solar = 0 exacto, pero un cielo totalmente nublado real sigue dejando
// pasar luz difusa que se nota). 0.2 = orden de magnitud típico de la
// fracción de irradiancia difusa bajo cielo muy cubierto (habitualmente
// citado entre el 15% y el 30%), elegido a ojo sin ajustar a este piso en
// concreto — pendiente de revisar con anotaciones reales.
export const FACTOR_NUBES_MINIMO = 0.2;

export const DENSIDAD_AIRE = 1.2; // kg/m³
export const CALOR_ESPECIFICO_AIRE = 1005; // J/(kg·°C)

// Zona de confort por defecto (spec.md §5). Editable como parámetro del piso.
export const BANDA_CONFORT = { min: 21, max: 25 }; // °C

// Constantes físicas y valores de referencia del modelo (spec.md §4)

// Irradiancia máxima de referencia usada por I_proxy. Constante fija en código,
// no es un parámetro editable por el usuario (decisión anotada en docs/estado.md).
export const I_MAX = 1000; // W/m²

export const DENSIDAD_AIRE = 1.2; // kg/m³
export const CALOR_ESPECIFICO_AIRE = 1005; // J/(kg·°C)

// Zona de confort por defecto (spec.md §5). Editable como parámetro del piso.
export const BANDA_CONFORT = { min: 21, max: 25 }; // °C

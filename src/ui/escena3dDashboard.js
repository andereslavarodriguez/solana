// Integración de la escena 3D (Fase 6) en la pantalla principal, junto al
// dashboard (Fase 5). Checkpoint pendiente desde el checkpoint 1-3 (ver
// docs/estado.md, decisión 13): dashboard.js reescribe `innerHTML` de su
// propio contenedor en cada render (toggles, anotaciones) — este módulo
// monta la escena en un contenedor HERMANO de `#app`, nunca dentro de él,
// así que un render del dashboard nunca puede destruir el canvas WebGL.
//
// A diferencia de `main-escena3d.js` (página de depuración aislada, sin
// datos en vivo salvo override manual), aquí se usan datos reales: la misma
// forma que ya produce `obtenerDatosReales` para el modelo térmico
// (`actual.sol` ya trae {elevacion, azimut, nubesPct}) sirve tal cual como
// `sol` de `crearEscena3D`, sin repetir el cálculo con `posicionSolar` por
// separado salvo en el fallback de error. Ese mismo `actual` se reutiliza
// también como condiciones actuales del pronóstico extendido
// (`montarPronosticoExtendido`, src/ui/pronosticoExtendido.js) — que flota
// sobre el cielo de esta escena — en vez de pedirlo dos veces.

import { crearEscena3D } from '../escena3d/escena.js';
import { obtenerDatosReales } from '../data/adaptador.js';
import { montarPronosticoExtendido } from './pronosticoExtendido.js';
import { cargarParametrosPiso } from '../persistencia/piso.js';
import { cargarPlano } from '../persistencia/plano.js';
import { cargarUbicacion } from '../persistencia/ubicacion.js';
import { posicionSolar } from '../data/sol.js';
import { faseLunar } from '../data/luna.js';

export async function montarEscena3D(contenedorEscena, contenedorPronostico, storage) {
  // Fase 3 de la generalización a cualquier casa (docs/estado.md): la
  // forma de la casa sale directamente del plano en cuadrícula, no de
  // parametrosPiso — solo se necesita `alturaTecho` de ahí (la altura de
  // techo no forma parte del plano, que es un dibujo 2D).
  const plano = cargarPlano(storage);
  const { alturaTecho } = cargarParametrosPiso(storage);
  const ubicacion = cargarUbicacion(storage);
  const luna = faseLunar(new Date());

  let sol;
  let clima;
  let actual = null;
  try {
    const datos = await obtenerDatosReales(ubicacion.lat, ubicacion.lon);
    actual = datos.actual;
    sol = actual.sol;
    clima = {
      precipitacion: actual.precipitacion,
      codigoTiempo: actual.codigoTiempo,
      viento: { velocidad: actual.viento, direccion: actual.vientoDireccion },
    };
  } catch (error) {
    // Sin clima en vivo, la escena se construye igualmente con la posición
    // solar real (no depende de red) y condiciones neutras — mismo criterio
    // que el default de estadoVentanas.js (Fase 5): mejor un estado neutro
    // sin datos que una escena rota o ausente. `actual` se queda en null:
    // el pronóstico extendido simplemente no dibuja su franja de
    // condiciones actuales (ver condicionesActualesHtml), el resto de la
    // tarjeta (horas/días) tiene su propio fetch y no depende de esto.
    console.error(error);
    sol = { ...posicionSolar(new Date(), ubicacion.lat, ubicacion.lon), nubesPct: 0 };
    clima = { precipitacion: 0, codigoTiempo: null, viento: null };
  }

  crearEscena3D(contenedorEscena, plano, alturaTecho, sol, clima, luna);
  // El fetch de clima es asíncrono, así que el canvas no existe todavía en
  // el primer render de la página — sin esta marca, un script de
  // verificación (o cualquier otro código que espere a que la escena esté
  // lista) no tiene ninguna señal fiable, igual que dashboard.js ya marca
  // `root.dataset.cargado` por el mismo motivo.
  contenedorEscena.dataset.cargado = 'true';

  if (contenedorPronostico) {
    montarPronosticoExtendido(contenedorPronostico, ubicacion, actual);
  }
}

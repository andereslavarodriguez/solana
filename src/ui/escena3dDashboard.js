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
// separado salvo en el fallback de error.
//
// También monta el pronóstico extendido (docs/estado.md, "widget estilo
// Google Weather") flotando sobre el cielo de la escena — pedido explícito
// de moverlo aquí desde Inicio, donde quedaba abajo del todo; "en el
// cielo, encima de la casa" es justo el hueco vacío que deja esta escena.
// Fetch propio e independiente del de la escena (`montarPronosticoOverlay`,
// más abajo): un fallo o una tardanza ahí no debe retrasar ni tumbar la
// construcción de la escena 3D, que es el elemento central de la pantalla.

import { crearEscena3D } from '../escena3d/escena.js';
import { obtenerDatosReales } from '../data/adaptador.js';
import { obtenerPronosticoExtendido } from '../data/openMeteo.js';
import { seleccionarHoras, seleccionarDias, pronosticoExtendidoHtml } from './pronosticoExtendido.js';
import { cargarParametrosPiso } from '../persistencia/piso.js';
import { cargarUbicacion } from '../persistencia/ubicacion.js';
import { posicionSolar } from '../data/sol.js';
import { faseLunar } from '../data/luna.js';

export async function montarEscena3D(contenedorEscena, contenedorPronostico, storage) {
  const piso = cargarParametrosPiso(storage);
  const ubicacion = cargarUbicacion(storage);
  const luna = faseLunar(new Date());

  let sol;
  let clima;
  try {
    const { actual } = await obtenerDatosReales(ubicacion.lat, ubicacion.lon);
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
    // sin datos que una escena rota o ausente.
    console.error(error);
    sol = { ...posicionSolar(new Date(), ubicacion.lat, ubicacion.lon), nubesPct: 0 };
    clima = { precipitacion: 0, codigoTiempo: null, viento: null };
  }

  crearEscena3D(contenedorEscena, piso, sol, clima, luna);
  // El fetch de clima es asíncrono, así que el canvas no existe todavía en
  // el primer render de la página — sin esta marca, un script de
  // verificación (o cualquier otro código que espere a que la escena esté
  // lista) no tiene ninguna señal fiable, igual que dashboard.js ya marca
  // `root.dataset.cargado` por el mismo motivo.
  contenedorEscena.dataset.cargado = 'true';

  if (contenedorPronostico) {
    montarPronosticoOverlay(contenedorPronostico, ubicacion);
  }
}

async function montarPronosticoOverlay(contenedor, ubicacion) {
  contenedor.innerHTML = pronosticoExtendidoHtml('cargando', null);
  try {
    const { hourly, daily } = await obtenerPronosticoExtendido(ubicacion.lat, ubicacion.lon);
    const ahora = new Date();
    const datos = {
      horas: seleccionarHoras(hourly, ahora, ubicacion.lat, ubicacion.lon),
      dias: seleccionarDias(daily),
    };
    contenedor.innerHTML = pronosticoExtendidoHtml('ok', datos);
  } catch (error) {
    console.error(error);
    contenedor.innerHTML = pronosticoExtendidoHtml('error', null);
  }
  contenedor.dataset.cargado = 'true';
}

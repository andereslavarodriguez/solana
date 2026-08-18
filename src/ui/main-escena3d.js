// Página aislada para iterar visualmente la escena 3D (Fase 6) sin mezclar
// esa iteración con la integración en el dashboard (checkpoint 5, ver
// docs/estado.md). Marca `document.documentElement.dataset.cargado = 'true'`
// tras el primer render para que scripts/captura-escena3d.mjs pueda esperar
// a un estado estable, siguiendo el mismo patrón que dashboard.js.

import { crearEscena3D } from '../escena3d/escena.js';
import { leerOverrideDebug } from '../escena3d/depuracion.js';
import { cargarParametrosPiso } from '../persistencia/piso.js';
import { cargarPlano } from '../persistencia/plano.js';
import { ventanasDelModelo, superficieTotal, cajaEnvolvente } from '../model/plano.js';
import { cargarUbicacion } from '../persistencia/ubicacion.js';
import { posicionSolar } from '../data/sol.js';
import { faseLunar } from '../data/luna.js';

const contenedor = document.getElementById('escena3d');
const banner = document.getElementById('banner-debug');

const override = leerOverrideDebug(new URLSearchParams(window.location.search));
if (override.activo) {
  banner.hidden = false;
}

const piso = cargarParametrosPiso(window.localStorage);
// Fase 1 de la generalización a cualquier casa (docs/estado.md): ver el
// mismo comentario en escena3dDashboard.js — aproximación temporal hasta
// que geometria.js sepa dibujar la forma real del plano (Fase 3).
const plano = cargarPlano(window.localStorage);
piso.ventanas = ventanasDelModelo(plano);
piso.superficie = superficieTotal(plano);
piso.anchoHabitacion = cajaEnvolvente(plano).ancho;
const ubicacion = cargarUbicacion(window.localStorage);

// El override de depuración es puramente visual (ver docs/estado.md,
// Fase 6): solo cambia qué fecha/nubosidad/viento/tormenta "ve" la escena,
// nunca toca localStorage ni ningún estado real (piso, ventanas,
// anotaciones).
const fecha = override.hora ?? new Date();
const sol = {
  ...posicionSolar(fecha, ubicacion.lat, ubicacion.lon),
  nubesPct: override.nubesPct ?? 0,
};
const clima = {
  precipitacion: override.precipitacion ?? 0,
  codigoTiempo: override.codigoTiempo,
  // `!= null` (no `!== null`): sin ningún override activo, `override.viento`
  // es `undefined` (no `null`) — con `!== null` a secas, `undefined` pasaba
  // el chequeo igual que un número real, construyendo `{velocidad:
  // undefined, ...}` en vez de `null`. Bug real encontrado al integrar la
  // escena en el dashboard (ver docs/estado.md): `construirViento` no
  // trata `velocidad: undefined` como "sin viento" (su guarda comprueba
  // `viento.velocidad <= 0`, y `undefined <= 0` es `false`, no `true`), así
  // que construía partículas de polvo/hojas con posiciones NaN.
  viento:
    override.viento != null
      ? { velocidad: override.viento, direccion: override.vientoDireccion ?? 0 }
      : null,
};
// Fase lunar real (checkpoint 18, ver docs/estado.md) — no depende de
// lat/lon (a diferencia de sol.js, `getMoonIllumination` es la misma para
// cualquier ubicación), así que se calcula solo a partir de `fecha`, ya
// controlada por el mismo override de depuración que el resto de la escena.
const luna = faseLunar(fecha);

crearEscena3D(contenedor, piso, sol, clima, luna);

document.documentElement.dataset.cargado = 'true';

// Panel de depuración: rellena los campos con los valores actuales de la
// URL y, al aplicar, reconstruye la query string y recarga — reutiliza
// leerOverrideDebug tal cual, no añade ningún camino nuevo de datos.
//
// `debugHora` pasó de un <input type="text"> con formato ISO escrito a
// mano a un <input type="datetime-local"> (pedido explícito: "que sea un
// seleccionable en vez de tener que escribirlo todo en ese formato") —
// necesita su propio formateo al rellenar el campo, porque
// datetime-local espera "AAAA-MM-DDTHH:mm" en hora LOCAL del navegador,
// no un ISO con "Z" como el que se guardaba antes en la URL.
// `leerOverrideDebug`/`new Date()` no cambian: siguen aceptando
// cualquier string que `Date` sepa parsear, así que no hace falta tocar
// nada fuera de este archivo.
function aDatetimeLocal(fecha) {
  const dosDigitos = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}T${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`;
}

const panel = document.getElementById('panel-debug');
const searchParams = new URLSearchParams(window.location.search);
const CAMPOS_PANEL = ['debugHora', 'debugNubes', 'debugLluvia', 'debugViento', 'debugVientoDir', 'debugCodigoTiempo'];
CAMPOS_PANEL.forEach((campo) => {
  const valorGuardado = searchParams.get(campo);
  if (campo === 'debugHora') {
    panel[campo].value = valorGuardado ? aDatetimeLocal(new Date(valorGuardado)) : '';
  } else {
    panel[campo].value = valorGuardado ?? '';
  }
});

panel.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const nuevosParams = new URLSearchParams();
  CAMPOS_PANEL.forEach((campo) => {
    if (panel[campo].value) nuevosParams.set(campo, panel[campo].value);
  });
  window.location.search = nuevosParams.toString();
});

document.getElementById('panel-debug-limpiar').addEventListener('click', () => {
  window.location.search = '';
});

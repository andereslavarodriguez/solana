// Página aislada para iterar visualmente la escena 3D (Fase 6) sin mezclar
// esa iteración con la integración en el dashboard (checkpoint 5, ver
// docs/estado.md). Marca `document.documentElement.dataset.cargado = 'true'`
// tras el primer render para que scripts/captura-escena3d.mjs pueda esperar
// a un estado estable, siguiendo el mismo patrón que dashboard.js.

import { crearEscena3D } from '../escena3d/escena.js';
import { leerOverrideDebug } from '../escena3d/depuracion.js';
import { cargarParametrosPiso } from '../persistencia/piso.js';
import { cargarUbicacion } from '../persistencia/ubicacion.js';
import { posicionSolar } from '../data/sol.js';

const contenedor = document.getElementById('escena3d');
const banner = document.getElementById('banner-debug');

const override = leerOverrideDebug(new URLSearchParams(window.location.search));
if (override.activo) {
  banner.hidden = false;
}

const piso = cargarParametrosPiso(window.localStorage);
const ubicacion = cargarUbicacion(window.localStorage);

// El override de depuración es puramente visual (ver docs/estado.md,
// Fase 6): solo cambia qué fecha/nubosidad "ve" la escena al calcular el
// sol, nunca toca localStorage ni ningún estado real (piso, ventanas,
// anotaciones).
const fecha = override.hora ?? new Date();
const sol = {
  ...posicionSolar(fecha, ubicacion.lat, ubicacion.lon),
  nubesPct: override.nubesPct ?? 0,
};

crearEscena3D(contenedor, piso, sol);

document.documentElement.dataset.cargado = 'true';

// Pantalla de parámetros (Fase 4, spec.md §3.4, §6.3). Capa de DOM: no
// contiene lógica de negocio (eso vive en validacion.js y en
// src/persistencia/), solo construye el formulario, lee/escribe sus
// valores y conecta la validación con el guardado.
//
// Dos secciones visualmente distintas (decisión anotada en docs/estado.md):
// "Datos fijos del piso" (superficie, altura, ubicación, banda de confort,
// ventanas) y "Parámetros del modelo" (UA, factorCapacidad, SHGC,
// renovacionesHora), estos últimos con una nota explícita de que la Fase 7
// los recalibra automáticamente y puede sobrescribir una edición manual.

import { cargarParametrosPiso, guardarParametrosPiso } from '../persistencia/piso.js';
import { cargarUbicacion, guardarUbicacion } from '../persistencia/ubicacion.js';
import { validarParametrosPiso, validarUbicacion, validarCampoNumerico, RANGOS } from './validacion.js';

export function montarPantallaParametros(root, storage) {
  const piso = cargarParametrosPiso(storage);
  const ubicacion = cargarUbicacion(storage);

  root.innerHTML = plantilla(piso, ubicacion);

  const form = root.querySelector('#form-parametros');

  form.querySelectorAll('input[type="number"]').forEach((input) => {
    input.addEventListener('blur', () => validarCampoEnVivo(input));
  });

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    manejarGuardado(form, storage);
  });

  // Sin carga asíncrona en esta pantalla, pero se marca igual para que el
  // script de verificación visual (scripts/captura-pantalla.mjs, Fase 5)
  // pueda esperar a `[data-cargado="true"]` de la misma forma en cualquier
  // pantalla de la app.
  root.dataset.cargado = 'true';
}

function plantilla(piso, ubicacion) {
  return `
    <form id="form-parametros" novalidate>
      <header class="cabecera">
        <h1>Parámetros del piso</h1>
        <nav><a href="/">← Volver al panel</a></nav>
      </header>

      <fieldset class="seccion seccion-fija">
        <legend>Datos fijos del piso</legend>

        <h2>Ubicación</h2>
        ${campoNumerico('lat', 'Latitud', ubicacion.lat, RANGOS.lat, '0.0001')}
        ${campoNumerico('lon', 'Longitud', ubicacion.lon, RANGOS.lon, '0.0001')}

        <h2>Piso</h2>
        ${campoNumerico('superficie', 'Superficie (m²)', piso.superficie, RANGOS.superficie, '0.5')}
        ${campoNumerico('alturaTecho', 'Altura de techo (m)', piso.alturaTecho, RANGOS.alturaTecho, '0.05')}

        <h2>Banda de confort</h2>
        ${campoNumerico('bandaConfortMin', 'Mínimo (°C)', piso.bandaConfort.min, RANGOS.bandaConfortMin, '0.5')}
        ${campoNumerico('bandaConfortMax', 'Máximo (°C)', piso.bandaConfort.max, RANGOS.bandaConfortMax, '0.5')}

        ${piso.ventanas.map((ventana, i) => plantillaVentana(ventana, i)).join('')}
      </fieldset>

      <fieldset class="seccion seccion-calibrable">
        <legend>Parámetros del modelo</legend>
        <p class="nota">
          Estos valores se recalibran solos a partir de tus anotaciones de temperatura
          (próxima fase). Edítalos solo si quieres forzar un punto de partida distinto:
          la siguiente recalibración automática los sobrescribirá sin avisar.
        </p>
        ${campoNumerico('UA', 'UA — pérdidas por conducción (W/°C)', piso.UA, RANGOS.UA, '1')}
        ${campoNumerico('factorCapacidad', 'Factor de capacidad térmica', piso.factorCapacidad, RANGOS.factorCapacidad, '0.5')}
        ${campoNumerico('SHGC', 'SHGC — ganancia solar del cristal', piso.SHGC, RANGOS.SHGC, '0.05')}
        ${campoNumerico('renovacionesHora', 'Renovaciones de aire / hora', piso.renovacionesHora, RANGOS.renovacionesHora, '0.5')}
      </fieldset>

      <button type="submit">Guardar</button>
      <p id="mensaje-guardado" role="status"></p>
    </form>
  `;
}

function plantillaVentana(ventana, i) {
  return `
    <h2>Ventana ${ventana.nombre}</h2>
    <input type="hidden" id="ventana-${i}-nombre" name="ventana-${i}-nombre" value="${ventana.nombre}" />
    ${campoNumerico(`ventana-${i}-orientacion`, 'Orientación (°)', ventana.orientacion, RANGOS.ventanaOrientacion, '1')}
    ${campoNumerico(`ventana-${i}-ancho`, 'Ancho (m)', ventana.ancho, RANGOS.ventanaAncho, '0.05')}
    ${campoNumerico(`ventana-${i}-alturaEdificioEnfrente`, 'Altura edificio enfrente (m)', ventana.alturaEdificioEnfrente, RANGOS.alturaEdificioEnfrente, '1')}
    ${campoNumerico(`ventana-${i}-distanciaEdificioEnfrente`, 'Distancia edificio enfrente (m)', ventana.distanciaEdificioEnfrente, RANGOS.distanciaEdificioEnfrente, '1')}
  `;
}

function campoNumerico(id, etiqueta, valor, rango, paso) {
  return `
    <div class="campo">
      <label for="${id}">${etiqueta}</label>
      <input type="number" id="${id}" name="${id}" value="${valor}" min="${rango.min}" max="${rango.max}" step="${paso}" />
      <span class="error" id="${id}-error"></span>
    </div>
  `;
}

function validarCampoEnVivo(input) {
  const rango = { min: Number(input.min), max: Number(input.max) };
  const error = validarCampoNumerico(input.value, rango);
  aplicarError(input, error);
}

function aplicarError(input, mensaje) {
  const spanError = document.getElementById(`${input.id}-error`);
  input.classList.toggle('invalid', Boolean(mensaje));
  if (spanError) spanError.textContent = mensaje ?? '';
}

// Traduce las claves de error de validacion.js (forma de los datos:
// "bandaConfort.min", "ventanas.0.orientacion") a los ids del DOM (forma
// del formulario: "bandaConfortMin", "ventana-0-orientacion").
function claveAId(clave) {
  if (clave === 'bandaConfort.min') return 'bandaConfortMin';
  if (clave === 'bandaConfort.max') return 'bandaConfortMax';
  const coincidencia = clave.match(/^ventanas\.(\d+)\.(.+)$/);
  if (coincidencia) return `ventana-${coincidencia[1]}-${coincidencia[2]}`;
  return clave;
}

function leerFormulario(form) {
  const campo = (nombre) => form.elements.namedItem(nombre).value;

  const piso = {
    superficie: campo('superficie'),
    alturaTecho: campo('alturaTecho'),
    UA: campo('UA'),
    factorCapacidad: campo('factorCapacidad'),
    SHGC: campo('SHGC'),
    renovacionesHora: campo('renovacionesHora'),
    bandaConfort: { min: campo('bandaConfortMin'), max: campo('bandaConfortMax') },
    ventanas: [0, 1].map((i) => ({
      nombre: campo(`ventana-${i}-nombre`),
      orientacion: campo(`ventana-${i}-orientacion`),
      ancho: campo(`ventana-${i}-ancho`),
      alturaEdificioEnfrente: campo(`ventana-${i}-alturaEdificioEnfrente`),
      distanciaEdificioEnfrente: campo(`ventana-${i}-distanciaEdificioEnfrente`),
    })),
  };

  const ubicacion = { lat: campo('lat'), lon: campo('lon') };

  return { piso, ubicacion };
}

function normalizarPiso(piso) {
  return {
    superficie: Number(piso.superficie),
    alturaTecho: Number(piso.alturaTecho),
    UA: Number(piso.UA),
    factorCapacidad: Number(piso.factorCapacidad),
    SHGC: Number(piso.SHGC),
    renovacionesHora: Number(piso.renovacionesHora),
    bandaConfort: { min: Number(piso.bandaConfort.min), max: Number(piso.bandaConfort.max) },
    ventanas: piso.ventanas.map((ventana) => ({
      nombre: ventana.nombre,
      orientacion: Number(ventana.orientacion),
      ancho: Number(ventana.ancho),
      alturaEdificioEnfrente: Number(ventana.alturaEdificioEnfrente),
      distanciaEdificioEnfrente: Number(ventana.distanciaEdificioEnfrente),
    })),
  };
}

function normalizarUbicacion(ubicacion) {
  return { lat: Number(ubicacion.lat), lon: Number(ubicacion.lon) };
}

function limpiarErrores(form) {
  form.querySelectorAll('.error').forEach((span) => {
    span.textContent = '';
  });
  form.querySelectorAll('input').forEach((input) => input.classList.remove('invalid'));
}

function manejarGuardado(form, storage) {
  const { piso, ubicacion } = leerFormulario(form);
  limpiarErrores(form);

  const resultadoPiso = validarParametrosPiso(piso);
  const resultadoUbicacion = validarUbicacion(ubicacion);
  const errores = { ...resultadoPiso.errores, ...resultadoUbicacion.errores };
  const claves = Object.keys(errores);

  const mensajeGuardado = form.querySelector('#mensaje-guardado');

  if (claves.length > 0) {
    claves.forEach((clave) => {
      const input = form.elements.namedItem(claveAId(clave));
      if (input) aplicarError(input, errores[clave]);
    });
    form.elements.namedItem(claveAId(claves[0]))?.focus();
    mensajeGuardado.textContent = '';
    return;
  }

  guardarParametrosPiso(storage, normalizarPiso(piso));
  guardarUbicacion(storage, normalizarUbicacion(ubicacion));
  mensajeGuardado.textContent = 'Guardado.';
}

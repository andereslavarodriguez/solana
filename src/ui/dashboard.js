// Pantalla principal (Fase 5, spec.md §6.2). Capa de DOM: orquesta datos
// reales (Fase 2), persistencia (Fase 3/4/5) y el motor de recomendación
// puro (Fase 1), sin modificar ninguno de esos módulos.
//
// `root.dataset.cargado` se pone a 'true' solo cuando la pantalla está en
// un estado final estable (clima cargado o fallido, no a mitad de un
// fetch) — así un script de verificación visual (Playwright) puede esperar
// a `[data-cargado="true"]` en vez de un timeout fijo o `networkidle`.

import { obtenerDatosReales } from '../data/adaptador.js';
import { cargarParametrosPiso, guardarParametrosPiso } from '../persistencia/piso.js';
import { cargarUbicacion } from '../persistencia/ubicacion.js';
import { cargarEstadoVentanas, guardarEstadoVentanas } from '../persistencia/estadoVentanas.js';
import { listarAnotaciones, guardarAnotacion } from '../persistencia/anotaciones.js';
import { cargarGemelo, guardarGemelo } from '../persistencia/gemelo.js';
import { recomendarVentana, recomendarPersiana } from '../model/recomendacion.js';
import { estadoGemeloInicial, pasoGemelo, regresoresPromedio } from '../model/gemelo.js';
import { construirFilasRegresion, recalibrar } from '../model/recalibracion.js';
import { estadoAntiguedad, horasDesde, formatoAntiguedad } from './antiguedadAnotacion.js';
import { validarCampoNumerico, RANGOS } from './validacion.js';

const INTERVALO_REFRESCO_MS = 15 * 60 * 1000;
const ETIQUETAS = [
  { id: 'cocinando', texto: 'Cocinando' },
  { id: 'climatizacion', texto: 'Calefacción/AC encendido' },
  { id: 'masGente', texto: 'Más gente de lo normal' },
];

export function montarDashboard(root, storage) {
  const piso = cargarParametrosPiso(storage);
  const ubicacion = cargarUbicacion(storage);
  let estadoVentanas = cargarEstadoVentanas(storage, piso.ventanas);

  let estadoClima = 'cargando'; // 'cargando' | 'ok' | 'error'
  let datosClima = null;

  function anotacionMasReciente() {
    const anotaciones = listarAnotaciones(storage);
    return anotaciones.length ? anotaciones[anotaciones.length - 1] : null;
  }

  // Gemelo en vivo (Fase 7, src/model/gemelo.js): un T_in simulado que
  // avanza en cada refresco de clima y se corrige al anotar. Sin nada
  // guardado, se arranca desde la última anotación real si existe (p.ej.
  // primera carga tras añadir esta fase, con anotaciones ya guardadas antes
  // de que el gemelo existiera) — sin ninguna anotación todavía, se queda
  // sin inicializar hasta la primera.
  let gemelo = cargarGemelo(storage);
  if (!gemelo) {
    const ultima = anotacionMasReciente();
    if (ultima) {
      gemelo = estadoGemeloInicial(ultima.temperatura, ultima.timestamp);
      guardarGemelo(storage, gemelo);
    }
  }

  function calcularRecomendaciones(ahora = new Date()) {
    if (estadoClima !== 'ok') return { estado: estadoClima };

    const ultimaAnotacion = anotacionMasReciente();
    if (!ultimaAnotacion) return { estado: 'sin-anotacion' };

    const antiguedad = estadoAntiguedad(ultimaAnotacion.timestamp, ahora);
    const horas = horasDesde(ultimaAnotacion.timestamp, ahora);
    if (antiguedad === 'caducada') return { estado: 'caducada', horas };

    const recomendaciones = piso.ventanas.map((ventana) => ({
      nombre: ventana.nombre,
      ventana: recomendarVentana(
        ventana.nombre,
        ultimaAnotacion.temperatura,
        datosClima.pronostico,
        estadoVentanas,
        piso,
      ),
      persiana: recomendarPersiana(
        ventana.nombre,
        ultimaAnotacion.temperatura,
        datosClima.pronostico,
        estadoVentanas,
        piso,
      ),
    }));

    return { estado: antiguedad, horas, recomendaciones };
  }

  async function actualizarClima() {
    estadoClima = 'cargando';
    render();
    try {
      datosClima = await obtenerDatosReales(ubicacion.lat, ubicacion.lon);
      estadoClima = 'ok';
      if (gemelo) {
        gemelo = pasoGemelo(gemelo, new Date(), datosClima.actual, estadoVentanas, piso);
        guardarGemelo(storage, gemelo);
      }
    } catch (error) {
      estadoClima = 'error';
      console.error(error);
    }
    render();
  }

  function render() {
    root.innerHTML = plantilla({
      piso,
      estadoVentanas,
      estadoClima,
      datosClima,
      ultimaAnotacion: anotacionMasReciente(),
      recomendacionInfo: calcularRecomendaciones(),
    });
    conectarEventos();
    root.dataset.cargado = estadoClima === 'cargando' ? 'false' : 'true';
  }

  function conectarEventos() {
    root.querySelectorAll('.toggle-abierta').forEach((input) => {
      input.addEventListener('change', () => {
        estadoVentanas[input.dataset.ventana].abierta = input.checked;
        guardarEstadoVentanas(storage, estadoVentanas);
        render();
      });
    });

    root.querySelectorAll('.toggle-persiana').forEach((input) => {
      input.addEventListener('change', () => {
        estadoVentanas[input.dataset.ventana].persianaArriba = input.checked;
        guardarEstadoVentanas(storage, estadoVentanas);
        render();
      });
    });

    const btnActualizar = root.querySelector('#btn-actualizar');
    if (btnActualizar) btnActualizar.addEventListener('click', actualizarClima);

    const formAnotacion = root.querySelector('#form-anotacion');
    if (formAnotacion) {
      formAnotacion.addEventListener('submit', (evento) => {
        evento.preventDefault();
        manejarAnotacion(formAnotacion);
      });
    }
  }

  // Al anotar: el gemelo en vivo (si existe y ha avanzado al menos un paso
  // desde la anotación anterior) aporta el "predicho" de este instante
  // (spec.md §6.4) antes de corregirse al valor real — la corrección misma
  // de spec.md §1. La recalibración (Fase 7, src/model/recalibracion.js) se
  // intenta después, solo si esta anotación no lleva ninguna etiqueta
  // (decisión: "automático tras cada anotación no etiquetada").
  function manejarAnotacion(form) {
    const inputTemperatura = form.elements.namedItem('temperatura');
    const errorSpan = form.querySelector('#temperatura-error');
    const error = validarCampoNumerico(inputTemperatura.value, RANGOS.temperaturaInterior);

    inputTemperatura.classList.toggle('invalid', Boolean(error));
    if (errorSpan) errorSpan.textContent = error ?? '';
    if (error) {
      inputTemperatura.focus();
      return;
    }

    const temperatura = Number(inputTemperatura.value);
    const etiquetas = ETIQUETAS.map((e) => e.id).filter(
      (id) => form.elements.namedItem(id)?.checked,
    );

    const regs = gemelo ? regresoresPromedio(gemelo) : null;
    const predicho = regs ? gemelo.tIn : null;

    const anotacion = guardarAnotacion(storage, {
      temperatura,
      etiquetas,
      predicho,
      avgConduccion: regs ? regs.avgConduccion : null,
      avgSolarVent: regs ? regs.avgSolarVent : null,
    });

    gemelo = estadoGemeloInicial(temperatura, anotacion.timestamp);
    guardarGemelo(storage, gemelo);

    if (etiquetas.length === 0) {
      const filas = construirFilasRegresion(listarAnotaciones(storage));
      const resultado = recalibrar(filas, piso);
      if (resultado) {
        piso.UA = resultado.UA;
        piso.factorCapacidad = resultado.factorCapacidad;
        guardarParametrosPiso(storage, piso);
      }
    }

    render();
  }

  actualizarClima();
  setInterval(actualizarClima, INTERVALO_REFRESCO_MS);
}

function plantilla({ piso, estadoVentanas, estadoClima, datosClima, ultimaAnotacion, recomendacionInfo }) {
  return `
    <header class="cabecera">
      <h1>Solana</h1>
      <nav>
        <a href="/historico.html">Histórico</a>
        <a href="/parametros.html">Parámetros</a>
      </nav>
    </header>

    ${tarjetaClima(estadoClima, datosClima)}
    ${tarjetaAnotacion(ultimaAnotacion)}

    <section class="tarjetas-ventanas">
      ${piso.ventanas.map((v) => tarjetaVentana(v, estadoVentanas[v.nombre], recomendacionInfo)).join('')}
    </section>
  `;
}

function tarjetaClima(estadoClima, datosClima) {
  if (estadoClima === 'cargando') {
    return `
      <section class="tarjeta tarjeta-clima">
        <h2>Clima ahora</h2>
        <p class="cargando">Cargando clima en vivo…</p>
      </section>
    `;
  }

  if (estadoClima === 'error') {
    return `
      <section class="tarjeta tarjeta-clima tarjeta-error">
        <h2>Clima ahora</h2>
        <p>No se pudo obtener el clima en vivo. Comprueba tu conexión.</p>
        <button type="button" id="btn-actualizar">Reintentar</button>
      </section>
    `;
  }

  const { actual } = datosClima;
  return `
    <section class="tarjeta tarjeta-clima">
      <h2>Clima ahora</h2>
      <dl class="datos-clima">
        <div><dt>Temperatura</dt><dd>${actual.tOut.toFixed(1)} °C</dd></div>
        <div><dt>Humedad</dt><dd>${Math.round(actual.humedad)}%</dd></div>
        <div><dt>Viento</dt><dd>${actual.viento.toFixed(1)} km/h</dd></div>
        <div><dt>Lluvia</dt><dd>${actual.precipitacion.toFixed(1)} mm</dd></div>
      </dl>
      <button type="button" id="btn-actualizar">Actualizar</button>
    </section>
  `;
}

function tarjetaAnotacion(ultimaAnotacion) {
  const resumen = ultimaAnotacion
    ? `<p>Última anotación: <strong>${ultimaAnotacion.temperatura} °C</strong> (${formatoAntiguedad(horasDesde(ultimaAnotacion.timestamp))})</p>`
    : '<p>Todavía no has anotado ninguna temperatura interior.</p>';

  return `
    <section class="tarjeta tarjeta-anotacion">
      <h2>Temperatura interior</h2>
      ${resumen}
      <form id="form-anotacion" novalidate>
        <div class="campo">
          <label for="temperatura">Nueva anotación (°C)</label>
          <input
            type="number"
            id="temperatura"
            name="temperatura"
            step="0.1"
            min="${RANGOS.temperaturaInterior.min}"
            max="${RANGOS.temperaturaInterior.max}"
          />
          <span class="error" id="temperatura-error"></span>
        </div>
        <fieldset class="etiquetas">
          <legend>Factores externos (opcional)</legend>
          ${ETIQUETAS.map((e) => `<label><input type="checkbox" name="${e.id}" /> ${e.texto}</label>`).join('')}
        </fieldset>
        <button type="submit">Anotar</button>
      </form>
    </section>
  `;
}

function tarjetaVentana(ventana, estadoVentana, recomendacionInfo) {
  return `
    <section class="tarjeta tarjeta-ventana" data-ventana="${ventana.nombre}">
      <h3>Ventana ${ventana.nombre}</h3>
      <div class="estado-actual">
        <label>
          <input type="checkbox" class="toggle-abierta" data-ventana="${ventana.nombre}" ${estadoVentana.abierta ? 'checked' : ''} />
          Ventana abierta
        </label>
        <label>
          <input type="checkbox" class="toggle-persiana" data-ventana="${ventana.nombre}" ${estadoVentana.persianaArriba ? 'checked' : ''} />
          Persiana subida
        </label>
      </div>
      <div class="recomendacion">
        ${recomendacionHtml(ventana.nombre, recomendacionInfo)}
      </div>
    </section>
  `;
}

function recomendacionHtml(nombreVentana, info) {
  if (info.estado === 'cargando') {
    return '<p class="recomendacion-vacia">Cargando clima para calcular la recomendación…</p>';
  }
  if (info.estado === 'error') {
    return '<p class="recomendacion-vacia">No se pudo calcular: no hay clima en vivo disponible.</p>';
  }
  if (info.estado === 'sin-anotacion') {
    return '<p class="recomendacion-vacia">Anota la temperatura interior para ver recomendaciones.</p>';
  }
  if (info.estado === 'caducada') {
    return `<p class="recomendacion-vacia">Última anotación ${formatoAntiguedad(info.horas)} — anota una nueva para ver recomendaciones actualizadas.</p>`;
  }

  const rec = info.recomendaciones.find((r) => r.nombre === nombreVentana);
  const notaAntiguedad =
    info.estado === 'aviso'
      ? `<p class="aviso-antiguedad">Basado en tu última anotación, ${formatoAntiguedad(info.horas)} — puede estar desactualizada.</p>`
      : `<p class="nota-antiguedad">Basado en tu última anotación, ${formatoAntiguedad(info.horas)}.</p>`;

  return `
    ${notaAntiguedad}
    <p><strong>Ventana:</strong> ${rec.ventana.accion === 'abrir' ? 'abrir' : 'cerrar'}</p>
    <p><strong>Persiana:</strong> ${rec.persiana.accion === 'arriba' ? 'subir' : 'bajar'}</p>
  `;
}

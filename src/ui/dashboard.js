// Pantalla "Inicio" (Fase 5, spec.md §6.2 — rediseñada como pantalla de
// controles compacta, ver docs/estado.md). Capa de DOM: orquesta datos
// reales (Fase 2), persistencia (Fase 3/4/5) y el motor de recomendación
// puro (Fase 1), sin modificar ninguno de esos módulos.
//
// `root.dataset.cargado` se pone a 'true' solo cuando la pantalla está en
// un estado final estable (clima cargado o fallido, no a mitad de un
// fetch) — así un script de verificación visual (Playwright) puede esperar
// a `[data-cargado="true"]` en vez de un timeout fijo o `networkidle`.

import { obtenerDatosReales } from '../data/adaptador.js';
import { cargarParametrosPiso, guardarParametrosPiso } from '../persistencia/piso.js';
import { cargarPlano } from '../persistencia/plano.js';
import { ventanasDelModelo, superficieTotal } from '../model/plano.js';
import { cargarUbicacion } from '../persistencia/ubicacion.js';
import { cargarEstadoVentanas, guardarEstadoVentanas } from '../persistencia/estadoVentanas.js';
import { listarAnotaciones, guardarAnotacion } from '../persistencia/anotaciones.js';
import { cargarGemelo, guardarGemelo } from '../persistencia/gemelo.js';
import { recomendarPiso } from '../model/recomendacion.js';
import { estadoGemeloInicial, pasoGemelo, regresoresPromedio } from '../model/gemelo.js';
import { construirFilasRegresion, recalibrar } from '../model/recalibracion.js';
import { estadoAntiguedad, horasDesde, formatoAntiguedad } from './antiguedadAnotacion.js';
import { validarCampoNumerico, RANGOS } from './validacion.js';
import { etiquetaCompass } from './etiquetaVentana.js';
import {
  iconoActualizar,
  iconoMas,
  iconoTermometro,
  iconoGota,
  iconoViento,
  iconoLluvia,
  iconoVentanaAbierta,
  iconoVentanaCerrada,
  iconoPersianaSubida,
  iconoPersianaBajada,
} from './iconos.js';

const INTERVALO_REFRESCO_MS = 15 * 60 * 1000;
const ETIQUETAS = [
  { id: 'cocinando', texto: 'Cocinando' },
  { id: 'climatizacion', texto: 'Calefacción/AC' },
  { id: 'masGente', texto: 'Más gente' },
];

export function montarDashboard(root, storage) {
  const piso = cargarParametrosPiso(storage);
  // El plano en cuadrícula (Fase 1 de la generalización a cualquier casa,
  // ver docs/estado.md) sustituye a `piso.ventanas`/`piso.superficie` como
  // fuente de verdad — se inyectan aquí, sobrescribiendo lo que hubiera en
  // el dato guardado, para no tocar el resto de este fichero (recomendarPiso/
  // pasoGemelo/recalibrar y el propio render ya consumen `piso.ventanas`/
  // `piso.superficie` tal cual, sin saber de dónde vienen).
  const plano = cargarPlano(storage);
  piso.ventanas = ventanasDelModelo(plano);
  piso.superficie = superficieTotal(plano);
  const ubicacion = cargarUbicacion(storage);
  let estadoVentanas = cargarEstadoVentanas(storage, piso.ventanas);

  let estadoClima = 'cargando'; // 'cargando' | 'ok' | 'error'
  let datosClima = null;
  // Formulario de anotación colapsado por defecto: pedido explícito de una
  // pantalla compacta que quepa sin deslizar — el número de un vistazo ya
  // está en la fila de "Interior", el formulario completo solo hace falta
  // al tocar el botón "+".
  let mostrarFormAnotacion = false;

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

    // Una sola llamada calcula ventana Y persiana de las DOS ventanas a la
    // vez (corrección 2026-08-17, docs/estado.md: la mejor combinación es
    // conjunta entre las 4 magnitudes físicas, no una búsqueda por
    // ventana) — más barato que llamar a recomendarVentana/
    // recomendarPersiana por separado 4 veces, y garantiza que las dos
    // tarjetas muestran una combinación mutuamente consistente.
    const porVentana = recomendarPiso(
      ultimaAnotacion.temperatura,
      datosClima.pronostico,
      estadoVentanas,
      piso,
    );
    const recomendaciones = piso.ventanas.map((ventana) => ({
      nombre: ventana.nombre,
      ventana: porVentana[ventana.nombre].ventana,
      persiana: porVentana[ventana.nombre].persiana,
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
      mostrarFormAnotacion,
    });
    conectarEventos();
    root.dataset.cargado = estadoClima === 'cargando' ? 'false' : 'true';
  }

  function conectarEventos() {
    root.querySelectorAll('.interruptor').forEach((boton) => {
      boton.addEventListener('click', () => {
        const nombreVentana = boton.dataset.ventana;
        const campo = boton.dataset.campo;
        estadoVentanas[nombreVentana][campo] = !estadoVentanas[nombreVentana][campo];
        guardarEstadoVentanas(storage, estadoVentanas);
        render();
      });
    });

    const btnActualizar = root.querySelector('#btn-actualizar');
    if (btnActualizar) btnActualizar.addEventListener('click', actualizarClima);

    const btnAbrirForm = root.querySelector('#btn-abrir-form-anotacion');
    if (btnAbrirForm) {
      btnAbrirForm.addEventListener('click', () => {
        mostrarFormAnotacion = !mostrarFormAnotacion;
        render();
      });
    }

    const formAnotacion = root.querySelector('#form-anotacion');
    if (formAnotacion) {
      formAnotacion.addEventListener('submit', (evento) => {
        evento.preventDefault();
        manejarAnotacion(formAnotacion);
      });
      formAnotacion.querySelector('input[type="number"]')?.focus();
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

    mostrarFormAnotacion = false;
    render();
  }

  actualizarClima();
  setInterval(actualizarClima, INTERVALO_REFRESCO_MS);
}

function plantilla({
  piso,
  estadoVentanas,
  estadoClima,
  datosClima,
  ultimaAnotacion,
  recomendacionInfo,
  mostrarFormAnotacion,
}) {
  return `
    <header class="cabecera-compacta">
      <h1>Solana</h1>
      <button type="button" id="btn-actualizar" class="boton-icono" aria-label="Actualizar clima">
        ${iconoActualizar()}
      </button>
    </header>

    ${filaClima(estadoClima, datosClima)}
    ${filaInterior(ultimaAnotacion, mostrarFormAnotacion)}

    <section class="tarjetas-ventanas-compactas">
      ${piso.ventanas
        .map((v) => tarjetaVentana(v, estadoVentanas[v.nombre], recomendacionInfo))
        .join('')}
    </section>
  `;
}

function filaClima(estadoClima, datosClima) {
  if (estadoClima === 'cargando') {
    return `<section class="fila-clima cargando">Cargando clima…</section>`;
  }

  if (estadoClima === 'error') {
    return `
      <section class="fila-clima fila-clima-error">
        Sin clima en vivo — comprueba tu conexión.
      </section>
    `;
  }

  const { actual } = datosClima;
  return `
    <section class="fila-clima">
      <span class="dato-clima">${iconoTermometro()}${actual.tOut.toFixed(1)}°</span>
      <span class="dato-clima">${iconoGota()}${Math.round(actual.humedad)}%</span>
      <span class="dato-clima">${iconoViento()}${Math.round(actual.viento)}km/h</span>
      <span class="dato-clima">${iconoLluvia()}${actual.precipitacion.toFixed(1)}mm</span>
    </section>
  `;
}

function filaInterior(ultimaAnotacion, mostrarFormAnotacion) {
  const resumen = ultimaAnotacion
    ? `<strong>${ultimaAnotacion.temperatura}°</strong><span class="texto-suave-compacto">${formatoAntiguedad(horasDesde(ultimaAnotacion.timestamp))}</span>`
    : `<span class="texto-suave-compacto">Sin anotar todavía</span>`;

  return `
    <section class="fila-interior">
      <div class="fila-interior-resumen">
        <span class="etiqueta-fila">Interior</span>
        ${resumen}
        <button type="button" id="btn-abrir-form-anotacion" class="boton-icono" aria-label="Anotar temperatura interior">
          ${iconoMas()}
        </button>
      </div>
      ${mostrarFormAnotacion ? formAnotacionHtml() : ''}
    </section>
  `;
}

function formAnotacionHtml() {
  return `
    <form id="form-anotacion" class="form-anotacion-compacto" novalidate>
      <div class="fila-form-anotacion">
        <input
          type="number"
          id="temperatura"
          name="temperatura"
          step="0.1"
          placeholder="°C"
          min="${RANGOS.temperaturaInterior.min}"
          max="${RANGOS.temperaturaInterior.max}"
        />
        <button type="submit">Anotar</button>
      </div>
      <span class="error" id="temperatura-error"></span>
      <div class="chips-etiquetas">
        ${ETIQUETAS.map((e) => `<label class="chip"><input type="checkbox" name="${e.id}" />${e.texto}</label>`).join('')}
      </div>
    </form>
  `;
}

function tarjetaVentana(ventana, estadoVentana, recomendacionInfo) {
  const rec = recomendacionInfo.recomendaciones?.find((r) => r.nombre === ventana.nombre);

  return `
    <section class="tarjeta-ventana-compacta" data-ventana="${ventana.nombre}">
      <h3>${etiquetaCompass(ventana.orientacion)}</h3>
      ${!rec ? mensajeSinRecomendacion(recomendacionInfo) : ''}
      ${rec && recomendacionInfo.estado === 'aviso' ? `<p class="aviso-antiguedad-compacto">Anotación ${formatoAntiguedad(recomendacionInfo.horas)}, puede estar vieja.</p>` : ''}

      ${filaControl({
        nombreVentana: ventana.nombre,
        campo: 'abierta',
        activo: estadoVentana.abierta,
        icono: estadoVentana.abierta ? iconoVentanaAbierta() : iconoVentanaCerrada(),
        etiqueta: 'Ventana',
        textoActivo: 'Abierta',
        textoInactivo: 'Cerrada',
      })}
      ${rec ? pistaControl(estadoVentana.abierta, rec.ventana.accion === 'abrir', 'abrir', 'cerrar', rec.ventana.proximoCambio) : ''}

      ${filaControl({
        nombreVentana: ventana.nombre,
        campo: 'persianaArriba',
        activo: estadoVentana.persianaArriba,
        icono: estadoVentana.persianaArriba ? iconoPersianaSubida() : iconoPersianaBajada(),
        etiqueta: 'Persiana',
        textoActivo: 'Subida',
        textoInactivo: 'Bajada',
      })}
      ${rec ? pistaControl(estadoVentana.persianaArriba, rec.persiana.accion === 'arriba', 'subir', 'bajar', rec.persiana.proximoCambio) : ''}
    </section>
  `;
}

// Fila de control con interruptor real — sustituye al botón "icono+color
// de fondo" anterior (docs/estado.md, checkpoint "Rediseño de interfaz
// móvil"), pedido explícito del usuario: "no se entiende bien si está
// abierta o cerrada, ponlo como un interruptor". La palabra de estado
// (Abierta/Cerrada, Subida/Bajada) queda fuera del interruptor, a su
// izquierda, para no depender solo de la posición del interruptor.
function filaControl({ nombreVentana, campo, activo, icono, etiqueta, textoActivo, textoInactivo }) {
  const texto = activo ? textoActivo : textoInactivo;
  return `
    <div class="fila-control">
      <span class="control-etiqueta">${icono}${etiqueta}</span>
      <span class="control-estado-texto ${activo ? 'activo' : ''}">${texto}</span>
      <button
        type="button"
        class="interruptor ${activo ? 'activo' : ''}"
        role="switch"
        aria-checked="${activo}"
        aria-label="${etiqueta}: ${texto.toLowerCase()}"
        data-ventana="${nombreVentana}"
        data-campo="${campo}"
      >
        <span class="interruptor-bola"></span>
      </button>
    </div>
  `;
}

function mensajeSinRecomendacion(info) {
  if (info.estado === 'cargando') return '<p class="recomendacion-vacia">Cargando…</p>';
  if (info.estado === 'error') return '<p class="recomendacion-vacia">Sin clima en vivo.</p>';
  if (info.estado === 'sin-anotacion') return '<p class="recomendacion-vacia">Anota la temperatura interior.</p>';
  if (info.estado === 'caducada') {
    return `<p class="recomendacion-vacia">Anotación ${formatoAntiguedad(info.horas)} — anota otra.</p>`;
  }
  return '';
}

// Pista de recomendación, ligada a un control concreto (ventana O persiana)
// en vez de dos líneas sueltas arriba de la tarjeta sin relación visual
// clara con ningún botón — pedido explícito del usuario: "tampoco se
// entiende muy bien lo que recomienda hacer". Compara el estado real
// (`estadoActual`) con el que recomienda el motor (`objetivo`): si ya
// coinciden, un aviso discreto; si no, un aviso con acento que señala la
// acción a tomar ahora mismo. El "próximo cambio" (spec.md, mejora
// post-lanzamiento del 2026-08-17) solo se muestra cuando el estado actual
// ya es el recomendado — si no coincide, mostrar ya un cambio futuro
// distraería de la acción inmediata que hace falta.
function pistaControl(estadoActual, objetivo, verboActivar, verboDesactivar, proximoCambio) {
  if (estadoActual === objetivo) {
    return `<p class="pista-control pista-ok">Así está bien${proximoCambioHtml(proximoCambio)}</p>`;
  }
  const verbo = objetivo ? verboActivar : verboDesactivar;
  return `<p class="pista-control pista-cambiar">Recomendado: ${verbo.charAt(0).toUpperCase()}${verbo.slice(1)}</p>`;
}

// Mejora post-lanzamiento (2026-08-17, docs/estado.md): recomendarVentana/
// recomendarPersiana ya no solo dicen qué hacer AHORA, también cuándo
// convendría volver a tocarlo, si toca — se muestra como un inciso corto en
// vez de una recomendación aparte, para no sumar ruido visual a la tarjeta.
function proximoCambioHtml(proximoCambio) {
  if (!proximoCambio) return '';
  const verbo = proximoCambio.accion === 'abrir' ? 'abrir' : proximoCambio.accion === 'arriba' ? 'subir' : proximoCambio.accion === 'cerrar' ? 'cerrar' : 'bajar';
  return ` <span class="proximo-cambio">(${verbo} en ${formatoDuracionCorta(proximoCambio.minutos)})</span>`;
}

function formatoDuracionCorta(minutos) {
  if (minutos < 60) return `${minutos} min`;
  const horas = minutos / 60;
  const horasRedondeadas = Math.round(horas * 10) / 10;
  return horasRedondeadas === 1 ? '1h' : `${horasRedondeadas}h`;
}

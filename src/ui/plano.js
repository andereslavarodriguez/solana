// Editor de plano en cuadrícula (Fase 2 de la generalización a cualquier
// casa, ver docs/estado.md): sustituye a los antiguos campos de
// anchoHabitacion/superficie/ventanas de la pantalla de parámetros. El
// usuario dibuja las paredes (y puertas y ventanas) de su casa sobre una
// cuadrícula, estilo Los Sims — qué celdas quedan "dentro de la casa" se
// deriva sola (src/model/plano.js), nunca se pinta por separado.
//
// Mismo patrón que dashboard.js/historico.js: `render()` interno
// reutilizable, todo el estado en memoria hasta pulsar "Guardar" (un
// borrador a medio dibujar no se persiste solo, para no dejar guardado un
// plano inválido a mitad de una edición).

import { cargarPlano, guardarPlano } from '../persistencia/plano.js';
import { celdasInteriores, superficieTotal, validarPlano } from '../model/plano.js';
import { PAREDES } from '../model/paredes.js';
import { validarCampoNumerico, RANGOS } from './validacion.js';
import { insertarNavInferior } from './navInferior.js';

// Tamaño de celda en píxeles del SVG (unidades de `viewBox`, no CSS — el
// propio SVG escala con `width:100%` en estilo.css). Grosor del área
// clicable de cada arista, más ancho que el trazo visual para que tocar
// con el dedo en móvil no falle por unos píxeles.
const CELL_PX = 22;
const GROSOR_HIT = 14;

const ETIQUETA_FACETA = {
  frontal: 'Frontal',
  trasera: 'Trasera',
  izquierda: 'Izquierda',
  derecha: 'Derecha',
};

const HERRAMIENTAS = [
  { id: 'muro', texto: 'Muro' },
  { id: 'puerta', texto: 'Puerta' },
  { id: 'ventana', texto: 'Ventana' },
  { id: 'borrar', texto: 'Borrar' },
];

export function montarPantallaPlano(root, storage) {
  const plano = cargarPlano(storage);
  let herramienta = 'muro';
  let mensajeGuardado = '';
  let errores = [];

  function alternarSegmento(tipo, col, fila) {
    const idx = plano.segmentos.findIndex((s) => s.tipo === tipo && s.col === col && s.fila === fila);
    if (herramienta === 'borrar') {
      if (idx >= 0) plano.segmentos.splice(idx, 1);
    } else if (idx >= 0) {
      plano.segmentos[idx] = { ...plano.segmentos[idx], clase: herramienta };
    } else {
      plano.segmentos.push({ tipo, col, fila, clase: herramienta });
    }
    mensajeGuardado = '';
    render();
  }

  // Cambiar cols/filas recorta los segmentos que quedarían fuera de la
  // nueva cuadrícula — un plano más pequeño simplemente pierde el trozo
  // dibujado fuera del nuevo tamaño; como nada se guarda hasta pulsar
  // "Guardar", no hace falta ningún mecanismo de deshacer para esto.
  function cambiarCuadricula(campo, valorTexto) {
    if (validarCampoNumerico(valorTexto, RANGOS[campo])) return;
    if (campo === 'planoCols') {
      plano.cols = Math.round(Number(valorTexto));
      plano.segmentos = plano.segmentos.filter((s) => (s.tipo === 'H' ? s.col < plano.cols : s.col <= plano.cols));
    } else if (campo === 'planoFilas') {
      plano.filas = Math.round(Number(valorTexto));
      plano.segmentos = plano.segmentos.filter((s) => (s.tipo === 'V' ? s.fila < plano.filas : s.fila <= plano.filas));
    } else if (campo === 'tamanoCelda') {
      plano.tamanoCelda = Number(valorTexto);
    } else if (campo === 'orientacionCasa') {
      plano.orientacionCasa = Number(valorTexto);
    }
    mensajeGuardado = '';
    render();
  }

  function cambiarObstruccion(faceta, campo, valorTexto) {
    if (validarCampoNumerico(valorTexto, RANGOS[campo])) return;
    plano.obstruccionPorFachada[faceta][campo] = Number(valorTexto);
    mensajeGuardado = '';
    render();
  }

  function manejarGuardar() {
    const resultado = validarPlano(plano);
    errores = resultado.errores;
    mensajeGuardado = resultado.valido ? 'Guardado.' : '';
    if (resultado.valido) guardarPlano(storage, plano);
    render();
  }

  function render() {
    root.innerHTML = plantilla(plano, herramienta, errores, mensajeGuardado);
    insertarNavInferior('parametros');
    conectarEventos();
    root.dataset.cargado = 'true';
  }

  function conectarEventos() {
    root.querySelector('.plano-svg')?.addEventListener('click', (evento) => {
      const el = evento.target.closest('[data-tipo]');
      if (!el) return;
      alternarSegmento(el.dataset.tipo, Number(el.dataset.col), Number(el.dataset.fila));
    });

    root.querySelectorAll('[data-herramienta]').forEach((boton) => {
      boton.addEventListener('click', () => {
        herramienta = boton.dataset.herramienta;
        render();
      });
    });

    ['planoCols', 'planoFilas', 'tamanoCelda', 'orientacionCasa'].forEach((campo) => {
      const input = root.querySelector(`#${campo}`);
      if (!input) return;
      input.addEventListener('blur', () => aplicarError(input, validarCampoNumerico(input.value, RANGOS[campo])));
      input.addEventListener('change', () => cambiarCuadricula(campo, input.value));
    });

    PAREDES.forEach((faceta) => {
      ['alturaEdificioEnfrente', 'distanciaEdificioEnfrente'].forEach((campo) => {
        const input = root.querySelector(`#obstruccion-${faceta}-${campo}`);
        if (!input) return;
        input.addEventListener('blur', () => aplicarError(input, validarCampoNumerico(input.value, RANGOS[campo])));
        input.addEventListener('change', () => cambiarObstruccion(faceta, campo, input.value));
      });
    });

    root.querySelector('#btn-guardar-plano')?.addEventListener('click', manejarGuardar);
  }

  render();
}

function aplicarError(input, mensaje) {
  const spanError = document.getElementById(`${input.id}-error`);
  input.classList.toggle('invalid', Boolean(mensaje));
  if (spanError) spanError.textContent = mensaje ?? '';
}

function plantilla(plano, herramienta, errores, mensajeGuardado) {
  const superficie = superficieTotal(plano);
  return `
    <header class="cabecera">
      <a href="parametros.html" class="enlace-volver">‹ Parámetros</a>
      <h1>Plano de la casa</h1>
    </header>

    <p class="plano-superficie">Superficie interior: <strong>${superficie.toFixed(1)} m²</strong></p>

    <div class="plano-herramientas">${botonesHerramienta(herramienta)}</div>

    <div class="plano-lienzo">${svgPlano(plano)}</div>
    <p class="nota">Toca una línea de la cuadrícula para dibujar con la herramienta activa.</p>

    <fieldset class="seccion">
      <legend>Cuadrícula</legend>
      ${campoNumerico('planoCols', 'Columnas', plano.cols, RANGOS.planoCols, '1')}
      ${campoNumerico('planoFilas', 'Filas', plano.filas, RANGOS.planoFilas, '1')}
      ${campoNumerico('tamanoCelda', 'Tamaño de celda (m)', plano.tamanoCelda, RANGOS.tamanoCelda, '0.05')}
      ${campoNumerico('orientacionCasa', 'Orientación de la fachada frontal (°)', plano.orientacionCasa, RANGOS.orientacionCasa, '1')}
    </fieldset>

    <fieldset class="seccion">
      <legend>Edificios enfrente, por fachada</legend>
      <p class="nota">Se aplica a todas las ventanas de esa fachada — el mismo contexto urbano para todas.</p>
      ${PAREDES.map((faceta) => camposObstruccion(faceta, plano.obstruccionPorFachada[faceta])).join('')}
    </fieldset>

    ${errores.length > 0 ? `<ul class="plano-errores">${errores.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}

    <button type="button" id="btn-guardar-plano">Guardar</button>
    <p role="status">${mensajeGuardado}</p>
  `;
}

function botonesHerramienta(herramienta) {
  return HERRAMIENTAS.map(
    (h) =>
      `<button type="button" class="plano-herramienta${h.id === herramienta ? ' activa' : ''}" data-herramienta="${h.id}">${h.texto}</button>`,
  ).join('');
}

function camposObstruccion(faceta, obstruccion) {
  return `
    <h2>${ETIQUETA_FACETA[faceta]}</h2>
    ${campoNumerico(`obstruccion-${faceta}-alturaEdificioEnfrente`, 'Altura edificio enfrente (m)', obstruccion.alturaEdificioEnfrente, RANGOS.alturaEdificioEnfrente, '1')}
    ${campoNumerico(`obstruccion-${faceta}-distanciaEdificioEnfrente`, 'Distancia edificio enfrente (m)', obstruccion.distanciaEdificioEnfrente, RANGOS.distanciaEdificioEnfrente, '1')}
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

// El SVG entero se reconstruye en cada render (mismo criterio que el resto
// de la app: `innerHTML` completo por interacción, no parcheo fino del
// DOM) — a la escala de una cuadrícula de casa (decenas de celdas, unos
// pocos cientos de aristas) es barato de sobra para una pantalla de
// edición, no una animación.
function svgPlano(plano) {
  const { cols, filas } = plano;
  const anchoPx = cols * CELL_PX;
  const altoPx = filas * CELL_PX;

  const mapa = new Map();
  for (const s of plano.segmentos) mapa.set(`${s.tipo},${s.col},${s.fila}`, s.clase);

  const interiorSet = new Set(celdasInteriores(plano).map((c) => `${c.col},${c.fila}`));
  const relleno = [];
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      if (interiorSet.has(`${c},${f}`)) {
        relleno.push(
          `<rect x="${c * CELL_PX}" y="${f * CELL_PX}" width="${CELL_PX}" height="${CELL_PX}" class="plano-celda-interior" />`,
        );
      }
    }
  }

  const guias = [];
  for (let c = 0; c <= cols; c++) {
    guias.push(`<line x1="${c * CELL_PX}" y1="0" x2="${c * CELL_PX}" y2="${altoPx}" class="plano-guia" />`);
  }
  for (let f = 0; f <= filas; f++) {
    guias.push(`<line x1="0" y1="${f * CELL_PX}" x2="${anchoPx}" y2="${f * CELL_PX}" class="plano-guia" />`);
  }

  const aristasH = [];
  for (let f = 0; f <= filas; f++) {
    for (let c = 0; c < cols; c++) {
      const clase = mapa.get(`H,${c},${f}`);
      const x = c * CELL_PX;
      const y = f * CELL_PX;
      aristasH.push(`
        <g data-tipo="H" data-col="${c}" data-fila="${f}" class="plano-arista">
          <rect x="${x}" y="${y - GROSOR_HIT / 2}" width="${CELL_PX}" height="${GROSOR_HIT}" class="plano-hit" />
          ${clase ? `<line x1="${x}" y1="${y}" x2="${x + CELL_PX}" y2="${y}" class="plano-segmento plano-segmento-${clase}" />` : ''}
        </g>
      `);
    }
  }

  const aristasV = [];
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c <= cols; c++) {
      const clase = mapa.get(`V,${c},${f}`);
      const x = c * CELL_PX;
      const y = f * CELL_PX;
      aristasV.push(`
        <g data-tipo="V" data-col="${c}" data-fila="${f}" class="plano-arista">
          <rect x="${x - GROSOR_HIT / 2}" y="${y}" width="${GROSOR_HIT}" height="${CELL_PX}" class="plano-hit" />
          ${clase ? `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + CELL_PX}" class="plano-segmento plano-segmento-${clase}" />` : ''}
        </g>
      `);
    }
  }

  return `
    <svg viewBox="0 0 ${anchoPx} ${altoPx}" class="plano-svg" role="img" aria-label="Editor de plano de la casa">
      ${relleno.join('')}
      ${guias.join('')}
      ${aristasH.join('')}
      ${aristasV.join('')}
    </svg>
  `;
}

// Pantalla de histórico (Fase 7, spec.md §6.4): predicho vs. real por
// anotación, con los puntos etiquetados marcados distinto y excluidos del
// error medio. Solo lectura — la recalibración en sí (src/model/
// recalibracion.js) ya corre automáticamente desde dashboard.js al anotar
// una temperatura no etiquetada (decisión anotada en docs/estado.md), no
// hay ningún botón aquí para forzarla.

import { Chart } from 'chart.js/auto';
import { listarAnotaciones } from '../persistencia/anotaciones.js';
import { cargarParametrosPiso } from '../persistencia/piso.js';
import { VENTANA_RECALIBRACION } from '../model/recalibracion.js';

export function montarHistorico(root, storage) {
  const anotaciones = listarAnotaciones(storage);
  const piso = cargarParametrosPiso(storage);

  root.innerHTML = plantilla(anotaciones, piso);

  const canvas = root.querySelector('#grafica-historico');
  if (canvas) dibujarGrafica(canvas, anotaciones);

  // Sin ningún fetch de por medio (todo sale de localStorage), la pantalla
  // ya está en su estado final nada más renderizar — mismo contrato
  // `[data-cargado="true"]` que dashboard.js/main-escena3d.js para que un
  // script de verificación visual no dependa de un timeout fijo.
  root.dataset.cargado = 'true';
}

function formatoFecha(timestamp) {
  return new Date(timestamp).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// El error medio (§4.2/§6.4) solo cuenta anotaciones no etiquetadas con
// predicho calculado — misma exclusión que usa construirFilasRegresion()
// para la recalibración, aplicada aquí solo para el resumen que ve el
// usuario (no se reutiliza esa función porque no hace falta el resto de su
// cálculo, solo el filtro y una media simple).
function calcularErrorMedio(anotaciones) {
  const filas = anotaciones.filter(
    (a) => a.predicho != null && (!a.etiquetas || a.etiquetas.length === 0),
  );
  if (!filas.length) return null;
  const sumaAbs = filas.reduce((acc, a) => acc + Math.abs(a.temperatura - a.predicho), 0);
  return { errorMedio: sumaAbs / filas.length, n: filas.length };
}

function cabecera() {
  return `
    <header class="cabecera">
      <h1>Histórico</h1>
      <nav>
        <a href="/">← Panel</a>
        <a href="/parametros.html">Parámetros</a>
      </nav>
    </header>
  `;
}

function plantilla(anotaciones, piso) {
  if (anotaciones.length < 2) {
    return `
      ${cabecera()}
      <section class="tarjeta">
        <p class="recomendacion-vacia">
          Todavía no hay anotaciones suficientes para comparar predicción y
          realidad — hace falta al menos una anotación anterior con la que
          comparar. Anota la temperatura interior desde el panel; cada
          anotación nueva se compara con lo que el modelo esperaba desde la
          anterior.
        </p>
      </section>
    `;
  }

  const errorInfo = calcularErrorMedio(anotaciones);

  return `
    ${cabecera()}

    <section class="tarjeta">
      <h2>Predicho vs. real</h2>
      <p class="nota">
        Cada punto es una anotación tuya. La línea de predicción es lo que el
        modelo esperaba justo antes de esa anotación, avanzando solo desde la
        anterior con el clima real (gemelo en vivo). Los puntos
        <span class="marca-etiquetada">●</span> llevan algún factor externo
        (cocinando, climatización, más gente) y no cuentan para el error
        medio ni para la recalibración automática.
      </p>
      <div class="contenedor-grafica">
        <canvas id="grafica-historico"></canvas>
      </div>
      ${
        errorInfo
          ? `<p class="nota-antiguedad">Error medio de predicción: <strong>${errorInfo.errorMedio.toFixed(2)} °C</strong> (${errorInfo.n} anotaciones no etiquetadas)</p>`
          : `<p class="recomendacion-vacia">Todavía no hay anotaciones no etiquetadas con predicción para calcular un error medio.</p>`
      }
    </section>

    <section class="tarjeta">
      <h2>Parámetros calibrados actuales</h2>
      <p class="nota">
        Se recalibran solos tras cada anotación no etiquetada, con las
        últimas ${Math.min(anotaciones.length, VENTANA_RECALIBRACION)} de ellas. Editables a mano en
        <a href="/parametros.html">Parámetros</a> (una recalibración
        posterior los sobrescribe sin avisar).
      </p>
      <dl class="datos-clima">
        <div><dt>UA</dt><dd>${piso.UA.toFixed(1)} W/°C</dd></div>
        <div><dt>Factor de capacidad</dt><dd>${piso.factorCapacidad.toFixed(2)}</dd></div>
      </dl>
    </section>
  `;
}

function colorCss(variable, fallback) {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return valor || fallback;
}

function dibujarGrafica(canvas, anotaciones) {
  const labels = anotaciones.map((a) => formatoFecha(a.timestamp));
  const real = anotaciones.map((a) => a.temperatura);
  const predicho = anotaciones.map((a) => a.predicho);

  const colorEtiquetada = colorCss('--aviso', '#b8873a');
  const colorNormal = colorCss('--acento', '#c97b4a');
  const colorPredicho = colorCss('--texto-suave', '#8a7a68');

  const puntoColor = anotaciones.map((a) =>
    a.etiquetas && a.etiquetas.length > 0 ? colorEtiquetada : colorNormal,
  );

  // eslint-disable-next-line no-new -- el chart se queda vivo colgado del canvas, no hace falta la referencia
  new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Real (anotado)',
          data: real,
          borderColor: colorNormal,
          backgroundColor: colorNormal,
          pointBackgroundColor: puntoColor,
          pointBorderColor: puntoColor,
          pointRadius: 4,
          tension: 0.15,
        },
        {
          label: 'Predicho por el modelo',
          data: predicho,
          borderColor: colorPredicho,
          backgroundColor: colorPredicho,
          borderDash: [6, 4],
          pointRadius: 3,
          tension: 0.15,
          spanGaps: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Sin animación de entrada: es una pantalla de solo lectura que se
      // consulta de un vistazo, no un elemento "vivo" como la escena 3D —
      // coherente con el tono tranquilo del resto de la app (CLAUDE.md), y
      // evita que una captura/verificación tomada justo tras
      // `data-cargado="true"` pille el gráfico a mitad de animar.
      animation: false,
      scales: {
        y: { title: { display: true, text: '°C' } },
      },
      plugins: {
        legend: { position: 'bottom' },
      },
    },
  });
}

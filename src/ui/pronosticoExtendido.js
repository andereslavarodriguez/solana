// Pronóstico extendido estilo Google Weather (pedido explícito del
// usuario, docs/estado.md): tarjeta flotando sobre el cielo de la pestaña
// "Tiempo" — condiciones actuales (grande) + horas cada 3h (con línea de
// temperatura) + 7 días, con el día seleccionado marcado y la fila de
// horas actualizándose para ese día. Puramente informativo: no alimenta
// el modelo térmico (obtenerDatosReales/adaptador.js, con su horizonte de
// 6-8h, sigue siendo la única fuente para eso), así que usa su propia
// llamada a Open-Meteo (obtenerPronosticoExtendido).

import { categoriaTiempo, obtenerPronosticoExtendido } from '../data/openMeteo.js';
import { posicionSolar } from '../data/sol.js';
import {
  iconoSol,
  iconoNubeSol,
  iconoNube,
  iconoLluvia,
  iconoNieve,
  iconoTormenta,
  iconoLuna,
  iconoNubeLuna,
  iconoGota,
  iconoViento,
} from './iconos.js';

const PASO_HORAS = 3;
const NUM_PUNTOS_HOY = 7; // horizonte de 21h vista para "Hoy", igual que antes
const MARCAS_DIA = [0, 3, 6, 9, 12, 15, 18, 21]; // horas del día para el resto de días
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const ICONOS_POR_CATEGORIA = {
  despejado: iconoSol,
  parcial: iconoNubeSol,
  nublado: iconoNube,
  lluvia: iconoLluvia,
  nieve: iconoNieve,
  tormenta: iconoTormenta,
};

// Variantes de noche solo para "despejado"/"parcial" — nublado/lluvia/
// nieve/tormenta se leen igual de bien de noche que de día, sin necesitar
// un icono aparte (mismo criterio de "menos iconos, más calma" que ya se
// aplicó plegando la niebla dentro de "nublado", ver categoriaTiempo).
const ICONOS_NOCHE = {
  despejado: iconoLuna,
  parcial: iconoNubeLuna,
};

function iconoCategoria(categoria, nocturno = false) {
  if (nocturno && ICONOS_NOCHE[categoria]) return ICONOS_NOCHE[categoria]();
  return (ICONOS_POR_CATEGORIA[categoria] ?? iconoNube)();
}

// La próxima hora "en punto" múltiplo de 3 estrictamente posterior a
// `ahora` (18:00, 21:00, 00:00...) — no "ahora+3h" a secas. Bug real
// reportado: a las 17:45, "ahora+3h" caía en 20:45 -> el punto más
// cercano de esa franja horaria era las 21:00, cuando lo esperable es
// que el primer punto sea el próximo redondo (18:00). Siempre avanza al
// menos una hora antes de comprobar el múltiplo, así que un `ahora`
// que cayera justo en una marca (18:00:00.000 exacto) salta a la
// SIGUIENTE marca, nunca se queda en la actual.
export function proximoMarcadorTresHoras(ahora) {
  const marcador = new Date(ahora);
  marcador.setMinutes(0, 0, 0);
  do {
    marcador.setHours(marcador.getHours() + 1);
  } while (marcador.getHours() % PASO_HORAS !== 0);
  return marcador;
}

// Construye el punto {hora,temp,categoria,nocturno} para el instante del
// `hourly` más cercano a `objetivoMs` — compartido por seleccionarHoras/
// seleccionarHorasDelDia, que solo difieren en qué objetivos generan.
function puntoMasCercano(hourly, objetivoMs, lat, lon) {
  let mejorIndice = 0;
  let mejorDiferencia = Infinity;
  hourly.time.forEach((t, idx) => {
    const diferencia = Math.abs(new Date(t).getTime() - objetivoMs);
    if (diferencia < mejorDiferencia) {
      mejorDiferencia = diferencia;
      mejorIndice = idx;
    }
  });
  const hora = new Date(hourly.time[mejorIndice]);
  return {
    hora,
    temp: hourly.temperature_2m[mejorIndice],
    categoria: categoriaTiempo(hourly.weather_code[mejorIndice]),
    // Elevación solar real en ese instante (mismo cálculo que ya usa el
    // modelo, src/data/sol.js) — sin esto, "despejado" de madrugada
    // dibujaba un sol brillante en vez de una luna.
    nocturno: posicionSolar(hora, lat, lon).elevacion < 0,
  };
}

// "Hoy": 7 puntos cada 3h desde el próximo marcador — puede cruzar la
// medianoche hacia mañana si quedan pocas horas del día en curso (eso es
// lo esperado, no un error: es literalmente "las próximas 21h").
export function seleccionarHoras(hourly, ahora, lat, lon) {
  const primerMarcador = proximoMarcadorTresHoras(ahora);
  const resultado = [];
  for (let i = 0; i < NUM_PUNTOS_HOY; i++) {
    const objetivo = primerMarcador.getTime() + i * PASO_HORAS * 60 * 60 * 1000;
    resultado.push(puntoMasCercano(hourly, objetivo, lat, lon));
  }
  return resultado;
}

// Cualquier otro día seleccionado: las 8 marcas fijas de ESE día
// (00,03,...,21), sin filtrar por `ahora` — el llamador solo pasa aquí
// una fecha estrictamente futura (ver montarPronosticoExtendido), así que
// las 8 marcas ya caen en el futuro por construcción.
export function seleccionarHorasDelDia(hourly, fecha, lat, lon) {
  return MARCAS_DIA.map((h) => {
    const objetivo = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), h, 0, 0, 0).getTime();
    return puntoMasCercano(hourly, objetivo, lat, lon);
  });
}

export function seleccionarDias(daily) {
  return daily.time.map((t, i) => ({
    // 'T00:00' fuerza parseo en hora LOCAL — un string solo de fecha
    // ("AAAA-MM-DD") se interpretaría si no como medianoche UTC, que en
    // huso horario positivo (España) puede seguir dando el día correcto
    // al formatear en local, pero no hay que confiar en ese margen.
    fecha: new Date(`${t}T00:00`),
    tempMax: daily.temperature_2m_max[i],
    tempMin: daily.temperature_2m_min[i],
    categoria: categoriaTiempo(daily.weather_code[i]),
  }));
}

// Trazado SVG (viewBox de 100 de ancho, para que las coordenadas X sean
// directamente porcentajes) que conecta la temperatura de cada hora, como
// la línea que dibuja Google sobre su tira de horas. Puro, para poder
// testear sin DOM.
export function trazadoTemperatura(temperaturas, alto = 26, margen = 4) {
  if (temperaturas.length === 0) return '';
  const n = temperaturas.length;
  const min = Math.min(...temperaturas);
  const max = Math.max(...temperaturas);
  // Sin variación (pronóstico estable), la línea va a media altura — no al
  // punto que le tocaría a "la más fría" (lo que daría dividir por un
  // rango puesto a 1 solo para evitar la división por cero).
  const constante = max === min;
  const puntos = temperaturas.map((t, i) => {
    const x = ((i + 0.5) / n) * 100;
    const normalizado = constante ? 0.5 : (t - min) / (max - min);
    const y = margen + (1 - normalizado) * (alto - margen * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${puntos.join(' L')}`;
}

function horaTexto(fecha) {
  return `${String(fecha.getHours()).padStart(2, '0')}:00`;
}

function diaTexto(fecha, esHoy) {
  return esHoy ? 'Hoy' : DIAS_SEMANA[fecha.getDay()];
}

// Condiciones actuales (temperatura grande + icono, con humedad/viento/
// nubosidad/lluvia en pequeño al lado) — pedido explícito, encima de la
// línea de temperatura. `actual` es el mismo objeto que ya produce
// obtenerDatosReales() para el modelo térmico (reutilizado tal cual desde
// escena3dDashboard.js, sin un tercer fetch); null si ese fetch falló, en
// cuyo caso esta franja simplemente no se dibuja — el resto de la tarjeta
// (horas/días) no depende de él.
function condicionesActualesHtml(actual) {
  if (!actual) return '';
  const nocturno = actual.sol.elevacion < 0;
  const categoria = categoriaTiempo(actual.codigoTiempo);
  return `
    <div class="pron-actual">
      <span class="pron-actual-icono">${iconoCategoria(categoria, nocturno)}</span>
      <span class="pron-actual-temp">${Math.round(actual.tOut)}°</span>
      <div class="pron-actual-detalles">
        <span>${iconoGota()}${Math.round(actual.humedad)}%</span>
        <span>${iconoViento()}${Math.round(actual.viento)}km/h</span>
        <span>${iconoNube()}${Math.round(actual.sol.nubesPct)}%</span>
        <span>${iconoLluvia()}${actual.precipitacion.toFixed(1)}mm</span>
      </div>
    </div>
  `;
}

function filaHorasHtml(horas) {
  const trazado = trazadoTemperatura(horas.map((h) => h.temp));
  return `
    <div class="pron-horas">
      <svg class="pron-grafico" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
        <path d="${trazado}"/>
      </svg>
      <div class="pron-fila">
        ${horas
          .map(
            (h) => `
          <div class="pron-item">
            <span class="pron-valor">${Math.round(h.temp)}°</span>
            <span class="pron-icono">${iconoCategoria(h.categoria, h.nocturno)}</span>
            <span class="pron-etiqueta">${horaTexto(h.hora)}</span>
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  `;
}

// Botones, no divs — el día se puede seleccionar (pedido explícito) para
// que la fila de horas de arriba se actualice a ese día. El seleccionado
// lleva `pron-dia-activo` (el "cuadradito verde" pedido).
function filaDiasHtml(dias, diaSeleccionado) {
  return `
    <div class="pron-fila pron-fila-dias">
      ${dias
        .map(
          (d, i) => `
        <button
          type="button"
          class="pron-item pron-dia-item${i === diaSeleccionado ? ' pron-dia-activo' : ''}"
          data-dia-index="${i}"
          aria-pressed="${i === diaSeleccionado}"
        >
          <span class="pron-etiqueta">${diaTexto(d.fecha, i === 0)}</span>
          <span class="pron-icono">${iconoCategoria(d.categoria)}</span>
          <span class="pron-dia-temps"><strong>${Math.round(d.tempMax)}°</strong> ${Math.round(d.tempMin)}°</span>
        </button>
      `,
        )
        .join('')}
    </div>
  `;
}

function tarjetaHtml(interior) {
  return `<section class="pronostico-extendido">${interior}</section>`;
}

// Monta la tarjeta completa en `contenedor`, con su propio fetch y su
// propio estado de día seleccionado (empieza en "Hoy", índice 0). Al
// cambiar de día no se vuelve a pedir nada a Open-Meteo: `hourly`/`daily`
// ya cubren los 7 días enteros (obtenerPronosticoExtendido pide
// forecast_days=7 también para `hourly`, no solo para `daily`), así que
// cambiar de día es solo recalcular con los datos que ya están en memoria
// y volver a pintar.
export async function montarPronosticoExtendido(contenedor, ubicacion, actual) {
  contenedor.innerHTML = tarjetaHtml('<p class="pron-mensaje">Cargando pronóstico…</p>');

  let hourly;
  let daily;
  try {
    ({ hourly, daily } = await obtenerPronosticoExtendido(ubicacion.lat, ubicacion.lon));
  } catch (error) {
    console.error(error);
    contenedor.innerHTML = tarjetaHtml('<p class="pron-mensaje">Pronóstico extendido no disponible.</p>');
    contenedor.dataset.cargado = 'true';
    return;
  }

  const dias = seleccionarDias(daily);
  let diaSeleccionado = 0;

  function render() {
    const horas =
      diaSeleccionado === 0
        ? seleccionarHoras(hourly, new Date(), ubicacion.lat, ubicacion.lon)
        : seleccionarHorasDelDia(hourly, dias[diaSeleccionado].fecha, ubicacion.lat, ubicacion.lon);

    contenedor.innerHTML = tarjetaHtml(`
      ${condicionesActualesHtml(actual)}
      ${filaHorasHtml(horas)}
      ${filaDiasHtml(dias, diaSeleccionado)}
    `);

    contenedor.querySelectorAll('.pron-dia-item').forEach((boton) => {
      boton.addEventListener('click', () => {
        diaSeleccionado = Number(boton.dataset.diaIndex);
        render();
      });
    });
  }

  render();
  contenedor.dataset.cargado = 'true';
}

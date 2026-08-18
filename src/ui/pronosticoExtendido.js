// Pronóstico extendido estilo Google Weather (pedido explícito del
// usuario, docs/estado.md): dos filas en la parte de arriba del apartado
// "Tiempo" del dashboard — horas cada 3h con horizonte de 21h (con una
// línea que traza la temperatura, como la de Google) y los 7 días
// siguientes con icono + máx/mín. Puramente informativo: no alimenta el
// modelo térmico (obtenerDatosReales/adaptador.js, con su horizonte de
// 6-8h, sigue siendo la única fuente para eso), así que usa su propia
// llamada a Open-Meteo (obtenerPronosticoExtendido).

import { categoriaTiempo } from '../data/openMeteo.js';
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
} from './iconos.js';

const PASO_HORAS = 3;
const NUM_PUNTOS_HORAS = 7; // 21h de horizonte, cada 3h
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

// Los 7 puntos del `hourly` (resolución horaria, forecast_hours=24 pedido
// en obtenerPronosticoExtendido) más cercanos a ahora+3h, +6h, ... +21h —
// no se asume que el índice 0 del array sea exactamente "ahora" (Open-Meteo
// redondea a la hora en curso), se busca el más cercano de verdad para
// cada objetivo.
export function seleccionarHoras(hourly, ahora, lat, lon) {
  const resultado = [];
  for (let i = 1; i <= NUM_PUNTOS_HORAS; i++) {
    const objetivo = ahora.getTime() + i * PASO_HORAS * 60 * 60 * 1000;
    let mejorIndice = 0;
    let mejorDiferencia = Infinity;
    hourly.time.forEach((t, idx) => {
      const diferencia = Math.abs(new Date(t).getTime() - objetivo);
      if (diferencia < mejorDiferencia) {
        mejorDiferencia = diferencia;
        mejorIndice = idx;
      }
    });
    const hora = new Date(hourly.time[mejorIndice]);
    resultado.push({
      hora,
      temp: hourly.temperature_2m[mejorIndice],
      categoria: categoriaTiempo(hourly.weather_code[mejorIndice]),
      // Elevación solar real en ese instante (mismo cálculo que ya usa el
      // modelo, src/data/sol.js) — sin esto, "despejado" de madrugada
      // dibujaba un sol brillante en vez de una luna.
      nocturno: posicionSolar(hora, lat, lon).elevacion < 0,
    });
  }
  return resultado;
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

function filaDiasHtml(dias) {
  return `
    <div class="pron-fila pron-fila-dias">
      ${dias
        .map(
          (d, i) => `
        <div class="pron-item">
          <span class="pron-etiqueta">${diaTexto(d.fecha, i === 0)}</span>
          <span class="pron-icono">${iconoCategoria(d.categoria)}</span>
          <span class="pron-dia-temps"><strong>${Math.round(d.tempMax)}°</strong> ${Math.round(d.tempMin)}°</span>
        </div>
      `,
        )
        .join('')}
    </div>
  `;
}

export function pronosticoExtendidoHtml(estado, datos) {
  if (estado === 'error') {
    return `<section class="pronostico-extendido pron-error">Pronóstico extendido no disponible.</section>`;
  }
  if (estado !== 'ok' || !datos) {
    return `<section class="pronostico-extendido pron-cargando">Cargando pronóstico…</section>`;
  }
  return `
    <section class="pronostico-extendido">
      ${filaHorasHtml(datos.horas)}
      ${filaDiasHtml(datos.dias)}
    </section>
  `;
}

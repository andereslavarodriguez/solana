// Iconos SVG inline, generados a mano (sin librería de iconos externa,
// mismo criterio que los iconos de la PWA — Fase 8, decisión 7: "sin
// dependencia de diseño externa"). Trazo simple (`stroke`, sin relleno)
// para que hereden el color de texto por CSS (`currentColor`) y funcionen
// igual en la paleta clara del proyecto sin variables nuevas.
//
// Pedido explícito del usuario tras probar la app: "más botones, menos
// texto" — estos iconos son la base de los botones de navegación inferior
// y de los controles de ventana/persiana (ver docs/estado.md, checkpoint
// de rediseño de interfaz móvil).

const base = (contenido, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${contenido}</svg>`;

// Pestaña "Inicio" (panel de control) — deliberadamente NO una casa, para
// no confundirse con el icono de casa de la pestaña "Parámetros" (desde el
// swap "Casa"→"Tiempo" con icono de sol, ver navInferior.js).
export function iconoInicio() {
  return base(`
    <line x1="4" y1="7" x2="20" y2="7"/>
    <circle cx="9" cy="7" r="1.6" fill="currentColor" stroke="none"/>
    <line x1="4" y1="12" x2="20" y2="12"/>
    <circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none"/>
    <line x1="4" y1="17" x2="20" y2="17"/>
    <circle cx="11" cy="17" r="1.6" fill="currentColor" stroke="none"/>
  `);
}

export function iconoCasa3D() {
  return base(`
    <path d="M4 11 12 4l8 7"/>
    <path d="M6 10v10h12V10"/>
    <line x1="12" y1="14" x2="12" y2="20"/>
  `);
}

export function iconoHistorico() {
  return base(`
    <line x1="4" y1="20" x2="20" y2="20"/>
    <line x1="7" y1="20" x2="7" y2="13"/>
    <line x1="12" y1="20" x2="12" y2="8"/>
    <line x1="17" y1="20" x2="17" y2="11"/>
  `);
}

export function iconoParametros() {
  return base(`
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6"/>
  `);
}

// Ventana cerrada: marco clásico de 4 paneles.
export function iconoVentanaCerrada() {
  return base(`
    <rect x="4" y="4" width="16" height="16" rx="1"/>
    <line x1="12" y1="4" x2="12" y2="20"/>
    <line x1="4" y1="12" x2="20" y2="12"/>
  `);
}

// Ventana abierta: la hoja se ve entornada (marco fijo a la derecha, hoja
// abatida hacia fuera a la izquierda) con líneas cortas de aire.
export function iconoVentanaAbierta() {
  return base(`
    <rect x="7" y="4" width="13" height="16" rx="1"/>
    <path d="M7 4 2 7v10l5 3"/>
    <line x1="0.5" y1="9" x2="4" y2="9"/>
    <line x1="0" y1="12" x2="4" y2="12"/>
    <line x1="0.5" y1="15" x2="4" y2="15"/>
  `);
}

// Persiana subida: solo un listón recogido arriba, resto del hueco libre.
export function iconoPersianaSubida() {
  return base(`
    <rect x="4" y="4" width="16" height="16" rx="1"/>
    <line x1="4" y1="7" x2="20" y2="7"/>
  `);
}

// Persiana bajada: hueco cubierto de listones de arriba a abajo.
export function iconoPersianaBajada() {
  return base(`
    <rect x="4" y="4" width="16" height="16" rx="1"/>
    <line x1="4" y1="7.5" x2="20" y2="7.5"/>
    <line x1="4" y1="11" x2="20" y2="11"/>
    <line x1="4" y1="14.5" x2="20" y2="14.5"/>
    <line x1="4" y1="18" x2="20" y2="18"/>
  `);
}

export function iconoMas() {
  return base(`
    <circle cx="12" cy="12" r="9"/>
    <line x1="12" y1="8" x2="12" y2="16"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
  `);
}

export function iconoActualizar() {
  return base(`
    <path d="M4 12a8 8 0 0 1 13.5-5.8"/>
    <path d="M20 12a8 8 0 0 1-13.5 5.8"/>
    <path d="M17 3v4h-4"/>
    <path d="M7 21v-4h4"/>
  `);
}

export function iconoTermometro() {
  return base(`<path d="M12 14.5V5a2 2 0 1 0-4 0v9.5a4 4 0 1 0 4 0Z"/>`);
}

export function iconoGota() {
  return base(`<path d="M12 3c4 5 6.5 8.3 6.5 11.3A6.5 6.5 0 0 1 5.5 14.3C5.5 11.3 8 8 12 3Z"/>`);
}

export function iconoViento() {
  return base(`
    <path d="M3 8h11a2.5 2.5 0 1 0-2.3-3.4"/>
    <path d="M3 13h15a2.5 2.5 0 1 1-2.3 3.4"/>
    <path d="M3 18h8"/>
  `);
}

export function iconoBorrar() {
  return base(`
    <line x1="4" y1="7" x2="20" y2="7"/>
    <path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7"/>
    <path d="M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7"/>
    <line x1="10" y1="11" x2="10" y2="16"/>
    <line x1="14" y1="11" x2="14" y2="16"/>
  `);
}

export function iconoLluvia() {
  return base(`
    <path d="M7 13a4 4 0 0 1 .9-7.9A5.5 5.5 0 0 1 18.5 8.5 3.5 3.5 0 0 1 18 15H7Z"/>
    <line x1="8" y1="18" x2="8" y2="20"/>
    <line x1="12" y1="18" x2="12" y2="20"/>
    <line x1="16" y1="18" x2="16" y2="20"/>
  `);
}

// Iconos de tiempo para el pronóstico extendido (docs/estado.md, "widget
// estilo Google Weather") — una categoría por icono (categoriaTiempo(),
// src/data/openMeteo.js), sin más variantes de intensidad para no sumar
// densidad visual que CLAUDE.md pide evitar.

export function iconoSol() {
  return base(`
    <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/>
    <path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.6 5.4l-1.7 1.7M7.1 16.9l-1.7 1.7M18.6 18.6l-1.7-1.7M7.1 7.1 5.4 5.4"/>
  `);
}

// Sol asomando por detrás de la nube — mismo trazo de nube que iconoLluvia/
// iconoNube, con un sol en la esquina libre superior-izquierda (el hueco
// que deja esa forma de nube antes de que empiece su arco). Sol más
// grande que la primera versión (r 2.1->3.1) — pedido explícito, se leía
// como una mota diminuta junto a la nube en vez de un sol de verdad.
export function iconoNubeSol() {
  return base(`
    <circle cx="5.6" cy="5.7" r="3.1" fill="currentColor" stroke="none"/>
    <path d="M5.6 0.9v1.4M0.5 5.7h1.4M1.6 1.8l1.1 1.1M1.6 9.6l1.1-1.1" stroke-width="1.6"/>
    <path d="M7 13a4 4 0 0 1 .9-7.9A5.5 5.5 0 0 1 18.5 8.5 3.5 3.5 0 0 1 18 15H7Z"/>
  `);
}

export function iconoNube() {
  return base(`<path d="M7 13a4 4 0 0 1 .9-7.9A5.5 5.5 0 0 1 18.5 8.5 3.5 3.5 0 0 1 18 15H7Z"/>`);
}

export function iconoNieve() {
  return base(`
    <line x1="12" y1="3" x2="12" y2="21"/>
    <line x1="4.5" y1="7.5" x2="19.5" y2="16.5"/>
    <line x1="19.5" y1="7.5" x2="4.5" y2="16.5"/>
    <line x1="9" y1="5" x2="7" y2="3.5"/>
    <line x1="15" y1="5" x2="17" y2="3.5"/>
    <line x1="9" y1="19" x2="7" y2="20.5"/>
    <line x1="15" y1="19" x2="17" y2="20.5"/>
  `);
}

// Luna creciente (círculo grande menos círculo desplazado) — variante de
// noche de iconoSol/iconoNubeSol: sin esto, "despejado"/"parcial" de
// madrugada mostraban un sol brillante a las 3 de la mañana.
export function iconoLuna() {
  return base(`<path d="M20.5 13.4A8.5 8.5 0 1 1 10.7 3.6a7 7 0 0 0 9.8 9.8Z" fill="currentColor" stroke="none"/>`);
}

// Mismo hueco superior-izquierdo que iconoNubeSol, con una luna en vez de
// un sol con rayos.
export function iconoNubeLuna() {
  return base(`
    <path d="M6.9 3.2a3 3 0 1 1-3.6 5.1 2.4 2.4 0 0 0 3.6-5.1Z" fill="currentColor" stroke="none"/>
    <path d="M7 13a4 4 0 0 1 .9-7.9A5.5 5.5 0 0 1 18.5 8.5 3.5 3.5 0 0 1 18 15H7Z"/>
  `);
}

// Nube desplazada hacia arriba respecto a iconoLluvia/iconoNube, para dejar
// hueco al rayo debajo.
export function iconoTormenta() {
  return base(`
    <path d="M7 11a4 4 0 0 1 .9-7.4A5.5 5.5 0 0 1 18.5 6.5 3.5 3.5 0 0 1 18 13H7Z"/>
    <path d="M13 13l-3 5h3l-2 4"/>
  `);
}

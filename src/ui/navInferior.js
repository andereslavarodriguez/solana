// Barra de navegación inferior fija, compartida por las 4 páginas reales de
// la app (Inicio, Casa 3D, Histórico, Parámetros) — sustituye a los
// enlaces de texto sueltos que tenía cada página (Fase 5/7, cabecera con
// `<nav>`). Pedido explícito del usuario: la app debe sentirse como una
// app de móvil (pestañas fijas), no como una web con enlaces de texto.
//
// Sigue siendo un sitio multi-página sin router (decisión de la Fase 4,
// no reconsiderada aquí): cada pestaña es un `<a href>` a una página HTML
// real, no una navegación en cliente. Cada punto de entrada indica qué
// pestaña está activa de forma explícita (no se intenta adivinar a partir
// de `location.pathname`, que cambia de forma con `base: '/solana/'` en
// producción vs. dev — más simple y fiable que cada página lo sepa de
// antemano).

import { iconoInicio, iconoCasa3D, iconoHistorico, iconoParametros } from './iconos.js';

const PESTANAS = [
  { id: 'inicio', href: 'index.html', texto: 'Inicio', icono: iconoInicio },
  { id: 'casa', href: 'casa.html', texto: 'Casa', icono: iconoCasa3D },
  { id: 'historico', href: 'historico.html', texto: 'Histórico', icono: iconoHistorico },
  { id: 'parametros', href: 'parametros.html', texto: 'Parámetros', icono: iconoParametros },
];

export function insertarNavInferior(activa) {
  const nav = document.createElement('nav');
  nav.className = 'nav-inferior';
  nav.innerHTML = PESTANAS.map(
    (p) => `
      <a href="${p.href}" class="nav-inferior-item${p.id === activa ? ' activo' : ''}">
        <span class="nav-inferior-icono">${p.icono()}</span>
        <span class="nav-inferior-texto">${p.texto}</span>
      </a>
    `,
  ).join('');
  document.body.appendChild(nav);
}

import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// base: '/solana/' — confirmado como nombre real del repo de GitHub
// (github.com/andereslavarodriguez/solana) en la Fase 8, GitHub Pages sirve
// el repo bajo /solana/ (spec.md §7).
export default defineConfig({
  base: '/solana/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        casa: resolve(__dirname, 'casa.html'),
        parametros: resolve(__dirname, 'parametros.html'),
        plano: resolve(__dirname, 'plano.html'),
        escena3d: resolve(__dirname, 'escena3d.html'),
        historico: resolve(__dirname, 'historico.html'),
      },
    },
  },
  plugins: [
    VitePWA({
      // registerType/injectRegister a mano (ver src/ui/registrarServiceWorker.js)
      // en vez de dejar que el plugin inyecte el script de registro: el sitio
      // es multi-página (4 entradas en rollupOptions.input, no una SPA), y
      // registrar desde un módulo compartido importado por los 4 puntos de
      // entrada es más explícito y verificable que confiar en la inyección
      // automática por HTML del plugin.
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'Solana — gemelo digital del piso',
        short_name: 'Solana',
        description:
          'Gemelo digital del salón-cocina: clima y sol reales, recomendación de ventana y persiana por ventana, histórico predicho vs. real.',
        lang: 'es',
        display: 'standalone',
        background_color: '#f3f1ea',
        theme_color: '#55654a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/maskable-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // registerType: 'autoUpdate' solo controla el comportamiento del
        // cliente (registrarSW recarga solo cuando hay una versión nueva);
        // sin skipWaiting+clientsClaim el propio service worker nunca
        // activa ni toma control de una pestaña ya abierta hasta que se
        // cierra y se reabre — con ambos, la primera visita ya queda
        // controlada (offline real) sin que el usuario tenga que hacer nada.
        skipWaiting: true,
        clientsClaim: true,
        // Precachea todo el app shell (las 4 páginas + su JS/CSS/iconos) para
        // que funcione con conexión intermitente (spec.md §7). Sin
        // navigateFallback: no es una SPA, cada página se precachea y se
        // sirve por su propia URL exacta — no tiene sentido un fallback tipo
        // "cualquier ruta desconocida cae en index.html".
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            // Los datos de clima requieren red siempre (spec.md §7) — nunca
            // se sirven de caché, ni siquiera como fallback offline. El resto
            // de la app (todo lo demás) es 100% precacheado y funciona sin
            // red.
            urlPattern: ({ url }) => url.origin === 'https://api.open-meteo.com',
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
});

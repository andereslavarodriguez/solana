// Registro del service worker (Fase 8, spec.md §7), compartido por las 4
// páginas del sitio (no es una SPA, así que se registra desde cada punto de
// entrada en vez de depender de la inyección automática del plugin en un
// único index.html — ver vite.config.js, injectRegister: false).
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

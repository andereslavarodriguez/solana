import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// base: '/solana/' — nombre del directorio/proyecto actual. Todavía no hay
// remote de git configurado; si el repo real en GitHub acaba teniendo otro
// nombre, hay que actualizar esto antes de desplegar en la Fase 8 (spec.md
// §7, GitHub Pages sirve cada repo bajo /<nombre-repo>/).
export default defineConfig({
  base: '/solana/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        parametros: resolve(__dirname, 'parametros.html'),
        escena3d: resolve(__dirname, 'escena3d.html'),
      },
    },
  },
});

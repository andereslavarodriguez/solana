import { defineConfig } from 'vite';

// base: '/solana/' — nombre del directorio/proyecto actual. Todavía no hay
// remote de git configurado; si el repo real en GitHub acaba teniendo otro
// nombre, hay que actualizar esto antes de desplegar en la Fase 8 (spec.md
// §7, GitHub Pages sirve cada repo bajo /<nombre-repo>/).
export default defineConfig({
  base: '/solana/',
});

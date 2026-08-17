// Inicio pasó a ser una pantalla solo de controles (rediseño móvil, ver
// docs/estado.md): la escena 3D se mudó a su propia pestaña (casa.html,
// main-casa.js) para que esta quepa en una pantalla sin deslizar.
import './registrarServiceWorker.js';
import { montarDashboard } from './dashboard.js';
import { insertarNavInferior } from './navInferior.js';

montarDashboard(document.getElementById('app-compacto'), window.localStorage);
insertarNavInferior('inicio');

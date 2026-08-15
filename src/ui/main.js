import { montarDashboard } from './dashboard.js';
import { montarEscena3D } from './escena3dDashboard.js';

montarDashboard(document.getElementById('app'), window.localStorage);
montarEscena3D(document.getElementById('escena3d-hero'), window.localStorage);

import './registrarServiceWorker.js';
import { montarPantallaPlano } from './plano.js';

montarPantallaPlano(document.getElementById('app'), window.localStorage);

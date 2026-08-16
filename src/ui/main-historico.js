import './registrarServiceWorker.js';
import { montarHistorico } from './historico.js';

montarHistorico(document.getElementById('app'), window.localStorage);

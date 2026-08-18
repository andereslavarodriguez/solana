// Pestaña "Tiempo" en la nav (antes "Casa" — id/href/archivo sin cambiar,
// solo el texto/icono visibles, ver navInferior.js). La escena 3D
// (Fase 6) pasa a tener su propia página a pantalla completa, en vez de
// vivir como un hero de 55vh dentro de Inicio — Inicio necesitaba ese
// espacio para caber sin scroll (pedido explícito del usuario), y la
// escena sigue siendo el "elemento central" de la app (spec.md §6.1), solo
// que ahora en una pestaña propia donde se ve entera.
//
// Reutiliza `montarEscena3D` (src/ui/escena3dDashboard.js) tal cual, sin
// duplicar la lógica de datos reales/fallback que ya tenía la integración
// del checkpoint 24.
import './registrarServiceWorker.js';
import { montarEscena3D } from './escena3dDashboard.js';
import { insertarNavInferior } from './navInferior.js';

montarEscena3D(document.getElementById('escena3d'), window.localStorage);
insertarNavInferior('casa');

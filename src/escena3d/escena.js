// Escena 3D (spec.md §6.1) — capa Three.js. Consume la geometría pura de
// geometria.js/iluminacion.js sin recalcular nada: esta función solo
// traduce esos números a mallas, luces y cámara. Sin OrbitControls en
// ninguna parte (cámara fija, sin órbita, spec.md §6.1).
//
// Checkpoint 3 (docs/estado.md, Fase 6): sol real. El edificio enfrente de
// cada ventana NO se dibuja (se probó como caja 3D a distancia comprimida y
// su sombra resultaba engañosa: podía mostrar "sin sombra" en un caso que
// en la realidad sí lo estaría, o al revés, porque dependía del ancho
// arbitrario de la caja, no del edificio real). El marco en cruz de cada
// ventana (construirMarcoVentana) SÍ proyecta sombra 3D real (castShadow +
// shadow map de Three.js): está a escala 1:1, no comprimida, así que su
// sombra es geométricamente fiable sin necesidad de ningún cálculo aparte.
//
// Se probó también un parche cálido en el suelo indicando qué ventana
// tiene sol directo ahora mismo (spec.md §6.1 lo pide explícitamente:
// "rayos de sol... en el suelo"), calculado con ventanaTieneSolDirecto()
// (iluminacion.js) — pedido explícito: se quitó tras verlo, no encajaba
// visualmente. La escena ya no tiene ninguna señal de "esta ventana tiene
// sol" más allá de la luz/sombra generales; esa información sigue
// disponible en el dashboard (Fase 5) en texto.
// Nubes/lluvia llegan en el checkpoint siguiente.

import * as THREE from 'three';
import { calcularGeometria } from './geometria.js';
import { direccionSol, factorIntensidadSol, factorDifusionNubes } from './iluminacion.js';
import { esTormenta } from '../data/openMeteo.js';

// Paleta aclarada tras feedback ("demasiado oscuro, más cálido y chill") —
// todos los tonos subieron de luminosidad, no solo de saturación; el
// oscurecimiento venía en parte de la luz (ver luzRelleno más abajo), no
// solo del color base de cada material.
const COLOR_SUELO = 0xe3b876; // tono madera cálida, más claro — más saturado (pedido explícito: "colores más vivos, se ve grisáceo")
const COLOR_PARED = 0xf6e8cc;
const COLOR_CRISTAL = 0xb8e3e3;

// Ver construirPared para el historial de estos valores. La cercana es más
// transparente (pedido explícito: se ve el interior mejor); la del fondo
// se queda casi opaca — no tapa nada, así que no hace falta.
const OPACIDAD_PARED_OPACA_CERCA = 0.6;
const OPACIDAD_PARED_OPACA_LEJOS = 0.95;
// OPACIDAD_CRISTAL subió de un primer intento en 0.22: a esa opacidad tan
// baja el tinte azul se mezclaba con el suelo cálido de detrás y el
// cristal perdía su color, quedando un verde-oliva apagado en vez de leerse
// como vidrio.
const OPACIDAD_CRISTAL = 0.28;

// Reflejo de cristal: dos franjas blancas diagonales por ventana (pedido
// explícito, feedback tras el checkpoint 1 — sin ellas el cristal no se
// leía como vidrio). MeshBasicMaterial (sin luz, color plano) porque son
// un recurso gráfico, no una superficie real que deba reaccionar a la luz.
const COLOR_REFLEJO = 0xffffff;
const OPACIDAD_REFLEJO = 0.5;
const ANCHO_REFLEJO = 0.06; // m
const ANGULO_REFLEJO_DEG = 20;

// Offset de azimut de la cámara respecto a la orientación de la fachada
// frontal (plano.orientacionCasa), y elevación angular. Punto de partida
// para el checkpoint 1 de la Fase 6 — se afina a ojo con la primera
// captura, no es un valor derivado de ningún dato real.
const CAMARA_AZIMUT_OFFSET_DEG = 45;
const CAMARA_ELEVACION_DEG = 35.264; // isométrico clásico (atan(1/√2))
// 1.6 (checkpoint 1) se quedó holgado de más una vez que la escena incluye
// la isla completa en el encuadre (checkpoint 8) → 1.28 (checkpoint 9) →
// bajado otra vez (checkpoint 16, pedido explícito: "haz todo el zoom
// posible, en el móvil se ve un poco pequeño"). Al ser el mismo valor el
// que fija tanto `alcanceHorizontal` como (ya corregido, ver
// `alcanceVertical` en construirCamara) `alcanceVertical`, bajarlo
// acerca el zoom en las dos dimensiones a la vez — incluida la anchura
// en retrato, que antes dejaba margen sin usar a los lados de la isla.
// Verificado con capturas reales en landscape Y en los dos layouts de
// retrato (móvil) para confirmar que nada se recorta con este valor.
const CAMARA_MARGEN = 0.92;

// Azimut de la cámara en grados, y su dirección horizontal unitaria — se
// necesita ANTES de construir la cámara de verdad, para saber desde qué
// lado se ve cada pared (ver signoHaciaCamara).
function azimutCamaraDeg(azimutBaseDeg) {
  return azimutBaseDeg + CAMARA_AZIMUT_OFFSET_DEG;
}

function direccionCamaraXZ(azimutCamaraDegValor) {
  const rad = (azimutCamaraDegValor * Math.PI) / 180;
  return { x: Math.sin(rad), z: Math.cos(rad) };
}

// +1 si la cámara ve esta pared desde el lado de su normal (fuera de la
// caja), -1 si la ve desde el lado contrario (dentro) — necesario para que
// los reflejos del cristal (construirReflejosCristal) sepan hacia qué lado
// desplazarse sin z-fighting, ya que A y B se ven cada una desde un lado
// distinto (docs/estado.md, Fase 6).
function signoHaciaCamara(pared, dirCamaraXZ) {
  const dot = pared.normal.x * dirCamaraXZ.x + pared.normal.z * dirCamaraXZ.z;
  return dot >= 0 ? 1 : -1;
}

// DoubleSide (en ambos materiales, opaco y cristal): sin esto, la pared
// "lejana" desde la cámara (cara frontal apuntando hacia fuera de la caja,
// en dirección contraria a la cámara) no se dibuja en absoluto — con
// paredes opuestas de cristal (A y B) eso significa no ver nunca la
// ventana lejana, justo lo que la cámara de esquina (construirCamara)
// pretende evitar.
function orientarSegunNormal(objeto, pared) {
  objeto.position.set(pared.centro.x, pared.centro.y, pared.centro.z);
  const normal = new THREE.Vector3(pared.normal.x, pared.normal.y, pared.normal.z);
  const objetivo = new THREE.Vector3(pared.centro.x, pared.centro.y, pared.centro.z).add(normal);
  objeto.lookAt(objetivo);
}

// Historial de la opacidad de las paredes opacas: 0.5 y 0.85 causaron tres
// problemas por turnos (lavado del suelo, lío de profundidad con los
// reflejos del cristal contiguo, contorno de mezcla en el borde de
// silueta — este último inherente a cualquier opacidad menor que 1, no
// arreglable con depthWrite). Pedido explícito: la pared MÁS CERCANA a la
// cámara necesita ser más transparente que la del fondo (para poder ver el
// interior), así que ya no comparten un único valor — signoCamara (+1 = la
// cámara está del lado de la normal, la pared "cercana") decide cuál usar.
function construirMaterialOpaco(signoCamara) {
  const opacidadParedOpaca = signoCamara === 1 ? OPACIDAD_PARED_OPACA_CERCA : OPACIDAD_PARED_OPACA_LEJOS;
  return new THREE.MeshStandardMaterial({
    color: COLOR_PARED,
    transparent: true,
    opacity: opacidadParedOpaca,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
}

function construirPared(pared, signoCamara, entorno, factorSol) {
  if (pared.puerta) {
    return construirPuerta(pared);
  }
  if (!pared.cristal) {
    return construirParedOpaca(pared, signoCamara);
  }
  return construirParedConVentana(pared, signoCamara, entorno, factorSol);
}

// Fachada exterior (pedido explícito: "que por fuera se vea como tablas de
// madera verticales y por dentro un color liso, crema o algo claro") —
// tablas de madera generadas en <canvas> (mismo recurso ya usado en toda la
// escena, sin ningún asset externo), solo en la cara que da HACIA FUERA de
// la casa; la cara de dentro sigue siendo el mismo material crema liso de
// siempre (construirMaterialOpaco). Las paredes INTERIORES (tabiques entre
// habitaciones, `pared.exterior === false`) no llevan madera en ningún lado
// — las dos caras de un tabique están dentro de la casa.
const ANCHO_TABLA_MADERA = 0.35; // m por tabla real — controla cuántas veces se repite la textura según el ancho de cada pared
const NUM_TABLAS_TEXTURA = 4; // cuántas tablas dibuja UNA sola repetición (tile) de la textura

let texturaMaderaExteriorBase = null;
function construirTexturaMaderaExterior() {
  const tam = 128;
  const canvas = document.createElement('canvas');
  canvas.width = tam;
  canvas.height = tam;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b08148';
  ctx.fillRect(0, 0, tam, tam);
  const numTablas = NUM_TABLAS_TEXTURA;
  const anchoTabla = tam / numTablas;
  for (let i = 0; i < numTablas; i += 1) {
    const x = i * anchoTabla;
    // Alterna un tono ligeramente más oscuro entre tablas contiguas —
    // sugiere tablas individuales sin necesitar geometría propia por tabla.
    if (i % 2 === 1) {
      ctx.fillStyle = 'rgba(60,35,15,0.1)';
      ctx.fillRect(x, 0, anchoTabla, tam);
    }
    // Veta vertical sutil dentro de cada tabla.
    ctx.strokeStyle = 'rgba(60,35,15,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + anchoTabla * 0.35, 0);
    ctx.lineTo(x + anchoTabla * 0.4, tam);
    ctx.stroke();
    // Junta entre tablas.
    ctx.strokeStyle = 'rgba(45,25,10,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, tam);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

function texturaMaderaExterior(ancho) {
  if (!texturaMaderaExteriorBase) texturaMaderaExteriorBase = construirTexturaMaderaExterior();
  // Clon por pared (barato: comparte los datos ya dibujados del canvas, solo
  // cambia el `repeat`) — así cada pared puede tener sus propias
  // repeticiones horizontales según su ancho real sin que se pisen entre sí
  // (repeat es una propiedad de la propia textura, no del material).
  const textura = texturaMaderaExteriorBase.clone();
  textura.wrapS = THREE.RepeatWrapping;
  textura.wrapT = THREE.RepeatWrapping;
  // Bug real encontrado en captura: una sola repetición ("tile") de la
  // textura ya dibuja NUM_TABLAS_TEXTURA tablas — dividir `ancho` solo por
  // ANCHO_TABLA_MADERA (sin tener en cuenta cuántas tablas hay por tile)
  // sobre-repetía la textura ~4×, dejando cada tabla de apenas unos cm en
  // pantalla — por debajo de la resolución real, el filtrado de mipmap las
  // promediaba a un gris-marrón liso sin ninguna veta visible.
  const anchoTile = ANCHO_TABLA_MADERA * NUM_TABLAS_TEXTURA;
  textura.repeat.set(Math.max(1, Math.round(ancho / anchoTile)), 1);
  textura.needsUpdate = true;
  return textura;
}

function construirMaterialMaderaExterior(signoCamara, ancho) {
  const opacidadParedOpaca = signoCamara === 1 ? OPACIDAD_PARED_OPACA_CERCA : OPACIDAD_PARED_OPACA_LEJOS;
  return new THREE.MeshStandardMaterial({
    map: texturaMaderaExterior(ancho),
    transparent: true,
    opacity: opacidadParedOpaca,
    roughness: 0.95,
    metalness: 0,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
}

// Caja de pared/tabique reutilizada tanto por una pared opaca completa
// (construirParedOpaca) como por las franjas laterales de una pared con
// ventana (construirParedConVentana) — mismo criterio en los dos sitios: la
// cara EXTERIOR (madera) solo aparece si `exterior` es cierto.
//
// BoxGeometry asigna sus 6 caras a los grupos de material en este orden:
// +x, -x, +y, -y, +z, -z (fuente: three.js, BoxGeometry.js). El eje que
// `orientarSegunNormal` (lookAt) alinea con `pared.normal` (hacia FUERA de
// la casa) es el local +Z, NO el -Z — así que la cara exterior es el
// índice 4 del array, y la interior el índice 5.
//
// Bug real encontrado verificando esto en captura (no a mano): un Object3D
// normal (Group/Mesh, no cámara ni luz) invierte el sentido de lookAt()
// respecto a una cámara — `Object3D.lookAt` llama internamente a
// `Matrix4.lookAt(target, position, up)`, con `eye` y `target`
// intercambiados frente al caso cámara/luz (`Matrix4.lookAt(position,
// target, up)`) — y `Matrix4.lookAt` define el eje local +Z como
// `normalize(eye - target)`. Con los argumentos intercambiados, ese +Z
// local sale `normalize(objetivo - centro)`, es decir, `pared.normal` —
// justo lo contrario de lo que asume un comentario ya existente en
// construirReflejosCristal ("local -Z hacia fuera") para el offset de los
// reflejos: ese código lleva verificado en captura desde hace muchos
// checkpoints y no se toca aquí, pero su comentario describe mal la
// convención real de lookAt (el resultado final es correcto igualmente,
// probablemente ajustado a base de prueba y error). Confirmado aquí con
// una prueba de colores planos (rojo/azul) antes de fiarse de la textura,
// no solo derivado a mano.
function construirCajaMuro(ancho, alto, profundidad, signoCamara, exterior) {
  const geometria = new THREE.BoxGeometry(ancho, alto, profundidad);
  const materialInterior = construirMaterialOpaco(signoCamara);
  if (!exterior) return new THREE.Mesh(geometria, materialInterior);
  const materialExterior = construirMaterialMaderaExterior(signoCamara, ancho);
  const materiales = [
    materialInterior,
    materialInterior,
    materialInterior,
    materialInterior,
    materialExterior,
    materialInterior,
  ];
  return new THREE.Mesh(geometria, materiales);
}

function construirParedOpaca(pared, signoCamara) {
  const malla = construirCajaMuro(pared.ancho, pared.alto, 0.15, signoCamara, pared.exterior);
  orientarSegunNormal(malla, pared);
  malla.castShadow = true;
  // receiveShadow — antes solo lo tenía el suelo (construirSuelo): la
  // sombra del marco de la ventana contigua nunca se notaba sobre una
  // pared, solo en el suelo. Pedido explícito: que también se vea en la
  // pared del fondo.
  malla.receiveShadow = true;
  malla.userData.esPared = true;
  return malla;
}

// Puerta (pedido explícito: "estaria bien que las puertas tuvieran una
// forma... la de fuera al menos") — hasta ahora (Fase 2) un tramo 'puerta'
// era un hueco sin geometría propia; ahora se dibuja como una hoja de
// madera maciza, con paneles hundidos y un pomo (textura en <canvas>, mismo
// recurso que el resto de la escena, sin ningún asset externo). No
// distingue interior/exterior (a diferencia de las paredes, ver
// construirCajaMuro) — pedido explícito era "de madera", sin pedir un
// acabado distinto por cada lado, y una puerta real también suele ser de
// un único material visto desde ambos lados. `pared.alto` ya viene reducido
// desde geometria.js (FRACCION_ALTURA_PUERTA) y `pared.centro.y` ya la deja
// apoyada en el suelo, no centrada en la altura de la pared — construirPuerta
// no necesita saber nada de eso, solo dibujar la caja en su sitio.
const GROSOR_PUERTA = 0.06;

let texturaPuertaCache = null;
function texturaPuerta() {
  if (texturaPuertaCache) return texturaPuertaCache;
  const w = 96;
  const h = 176;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#9c6b3e';
  ctx.fillRect(0, 0, w, h);
  // Marco de la propia hoja.
  ctx.strokeStyle = 'rgba(50,28,10,0.5)';
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  // Dos paneles hundidos, aspecto de puerta clásica.
  ctx.strokeStyle = 'rgba(50,28,10,0.4)';
  ctx.lineWidth = 3;
  ctx.strokeRect(w * 0.16, h * 0.06, w * 0.68, h * 0.36);
  ctx.strokeRect(w * 0.16, h * 0.5, w * 0.68, h * 0.44);
  // Pomo.
  ctx.fillStyle = '#e8d9a6';
  ctx.beginPath();
  ctx.arc(w * 0.83, h * 0.52, 3.2, 0, Math.PI * 2);
  ctx.fill();
  texturaPuertaCache = new THREE.CanvasTexture(canvas);
  return texturaPuertaCache;
}

function construirPuerta(pared) {
  const geometria = new THREE.BoxGeometry(pared.ancho, pared.alto, GROSOR_PUERTA);
  const material = new THREE.MeshStandardMaterial({
    map: texturaPuerta(),
    roughness: 0.85,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const malla = new THREE.Mesh(geometria, material);
  orientarSegunNormal(malla, pared);
  malla.castShadow = true;
  malla.receiveShadow = true;
  malla.userData.esPared = true;
  return malla;
}

// Ventana suelo-a-techo pero NO de ancho completo de pared — bug real
// corregido: antes el cristal ocupaba siempre pared.ancho entero
// (geo.paredes ya calculaba pared.anchoVentana desde la Fase 6 checkpoint
// 1, pero ningún consumidor lo usaba), así que editar el ancho de una
// ventana en Parámetros no tenía ningún efecto visual en la escena. El
// hueco de cristal se centra en la pared y el resto se rellena con pared
// opaca a cada lado (mismo material/opacidad que una pared lateral
// cualquiera, según de qué lado la vea la cámara).
function construirParedConVentana(pared, signoCamara, entorno, factorSol) {
  const grupo = new THREE.Group();
  orientarSegunNormal(grupo, pared);
  grupo.userData.esPared = true;

  // Cristal: roughness casi 0, algo de metalness, y envMap (solo el
  // cristal, no toda la escena — ver crearEscena3D) — pedido explícito de
  // mejorar el realismo dentro del estilo actual, sin texturas externas.
  // Le da al cristal un reflejo sutil del entorno cálido además del brillo
  // especular directo de la luz — sigue siendo un material sencillo, no un
  // cristal físicamente exacto.
  const materialCristal = new THREE.MeshStandardMaterial({
    color: COLOR_CRISTAL,
    transparent: true,
    opacity: OPACIDAD_CRISTAL,
    roughness: 0.02,
    metalness: 0.15,
    envMap: entorno,
    envMapIntensity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const cristal = new THREE.Mesh(new THREE.BoxGeometry(pared.anchoVentana, pared.alto, 0.05), materialCristal);
  // El cristal nunca proyecta sombra (dejaría de entrar sol nunca por esa
  // ventana, pedido explícito de mantenerlo así desde el checkpoint 3),
  // pero sí la recibe (la del marco de la ventana contigua, por ejemplo).
  cristal.castShadow = false;
  cristal.receiveShadow = true;
  grupo.add(cristal);

  // Franjas de pared opaca a los lados del hueco de cristal, solo si el
  // hueco no ocupa ya toda la pared (validación cruzada de
  // src/ui/validacion.js ya impide que una ventana sea más ancha que
  // anchoHabitacion, pero puede coincidir con el ancho exacto).
  const anchoLado = (pared.ancho - pared.anchoVentana) / 2;
  if (anchoLado > 0.001) {
    [-1, 1].forEach((signo) => {
      const lado = construirCajaMuro(anchoLado, pared.alto, 0.15, signoCamara, pared.exterior);
      lado.position.set(signo * (pared.anchoVentana / 2 + anchoLado / 2), 0, 0);
      lado.castShadow = true;
      lado.receiveShadow = true;
      grupo.add(lado);
    });
  }

  // Marco y reflejos ya se posicionan en espacio LOCAL de la ventana
  // (hijos de la pared, no de la escena) a partir de `pared.ancho`/`alto`
  // — se les pasa una copia con `ancho` sustituido por `anchoVentana` para
  // que encajen en el hueco real del cristal, no en la pared completa.
  const paredVentana = { ...pared, ancho: pared.anchoVentana };
  construirReflejosCristal(paredVentana, signoCamara, factorSol).forEach((r) => grupo.add(r));
  construirMarcoVentana(paredVentana).forEach((r) => grupo.add(r));

  return grupo;
}

// Marco de la ventana — hijas de la malla de la ventana en su espacio
// local (mismo truco que construirReflejosCristal): la cruz central (2
// barras) más un marco perimetral que envuelve las 4 esquinas (pedido
// explícito), dejando 4 cristales independientes. A diferencia del
// edificio enfrente (retirado, Fase 6), el marco está a escala REAL, no
// comprimida — su sombra en el suelo (más abajo, castShadow) es fiable de
// verdad, no hace falta calcularla aparte.
const COLOR_MARCO = 0xc9a876; // madera cálida, más oscura que la pared
const GROSOR_MARCO = 0.09; // ancho de cada barra, m
const PROFUNDIDAD_MARCO = 0.05; // grosor real de la barra — necesario para que tenga volumen y proyecte sombra

function construirMarcoVentana(pared) {
  const material = new THREE.MeshStandardMaterial({ color: COLOR_MARCO, roughness: 0.8, metalness: 0 });

  const cruzVertical = new THREE.Mesh(
    new THREE.BoxGeometry(GROSOR_MARCO, pared.alto, PROFUNDIDAD_MARCO),
    material,
  );
  const cruzHorizontal = new THREE.Mesh(
    new THREE.BoxGeometry(pared.ancho, GROSOR_MARCO, PROFUNDIDAD_MARCO),
    material,
  );

  // Perimetral: dos barras horizontales (arriba/abajo) + dos verticales
  // (izquierda/derecha), pegadas al borde del hueco — envuelven las 4
  // esquinas. Barras horizontales a ancho completo y verticales a alto
  // completo: se solapan un poco en las esquinas (mismo material, no se
  // nota) en vez de recortar cada una a la medida exacta.
  const borde = new THREE.Mesh(new THREE.BoxGeometry(pared.ancho, GROSOR_MARCO, PROFUNDIDAD_MARCO), material);
  borde.position.set(0, pared.alto / 2 - GROSOR_MARCO / 2, 0);
  const bordeInferior = borde.clone();
  bordeInferior.position.y = -(pared.alto / 2 - GROSOR_MARCO / 2);
  const bordeIzquierdo = new THREE.Mesh(new THREE.BoxGeometry(GROSOR_MARCO, pared.alto, PROFUNDIDAD_MARCO), material);
  bordeIzquierdo.position.set(-(pared.ancho / 2 - GROSOR_MARCO / 2), 0, 0);
  const bordeDerecho = bordeIzquierdo.clone();
  bordeDerecho.position.x = pared.ancho / 2 - GROSOR_MARCO / 2;

  const barras = [cruzVertical, cruzHorizontal, borde, bordeInferior, bordeIzquierdo, bordeDerecho];
  barras.forEach((barra) => {
    barra.castShadow = true;
    // Sin esto, Three.js descarta el objeto del pase de sombra si su
    // "frustum culling" (contra la cámara de sombra) falla — con la barra
    // anidada dentro de una pared rotada (lookAt), la esfera englobante en
    // el momento del test puede no estar actualizada. frustumCulled=false
    // se lo salta: son solo 12 cajas pequeñas, coste insignificante.
    barra.frustumCulled = false;
  });

  return barras;
}

// Franjas hijas de la malla de la ventana, en su espacio local (X=ancho,
// Y=alto, Z=grosor) — así heredan automáticamente la posición/rotación de
// la pared sin repetir el cálculo de orientación.
//
// Un pequeño offset real en Z (no un truco de profundidad): se probaron
// depthTest:false (se veía "flotando" delante de cualquier pared, incluso
// las que deberían taparlo) y polygonOffset (fallaba en ángulos rasantes
// cerca de las esquinas, dejando un rastro fantasma sobre la pared opaca
// contigua — docs/estado.md, Fase 6). Un offset de posición de verdad, del
// lado correcto, no tiene ninguno de esos dos problemas porque compite en
// profundidad de forma normal y honesta.
//
// El signo del offset no puede ser fijo: A y B se ven cada una desde un
// lado distinto de su cristal (una desde fuera de la caja, otra desde
// dentro), así que `signoCamara` (signoHaciaCamara(), calculado antes de
// construir la cámara) decide hacia qué lado desplazarse en cada caso.
//
// Una franja por cada uno de los 4 cristales que deja el marco en cruz
// (pedido explícito) — centrada en cada cuadrante, no 2 franjas largas que
// antes cruzaban por encima de donde ahora está el marco.
const OFFSET_REFLEJO_Z = 0.05; // m, hacia el lado de la cámara

function construirReflejosCristal(pared, signoCamara, factorSol) {
  const largo = (pared.alto / 2) * 0.55;
  // Atenuado por la luz solar real (checkpoint 6, comprobado en captura de
  // noche: se veía a opacidad completa sin ningún sol que lo produjera).
  // No baja a 0 del todo (mínimo 0.15) para que el cristal se siga leyendo
  // como cristal en penumbra, no un plano totalmente plano.
  const opacidadReflejo = OPACIDAD_REFLEJO * (0.15 + 0.85 * factorSol);
  const material = new THREE.MeshBasicMaterial({
    color: COLOR_REFLEJO,
    transparent: true,
    opacity: opacidadReflejo,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const anguloRad = (ANGULO_REFLEJO_DEG * Math.PI) / 180;

  const cuartoAncho = pared.ancho / 4;
  const cuartoAlto = pared.alto / 4;
  const centrosCuadrante = [
    { x: -cuartoAncho, y: cuartoAlto }, // superior izquierda
    { x: cuartoAncho, y: cuartoAlto }, // superior derecha
    { x: -cuartoAncho, y: -cuartoAlto }, // inferior izquierda
    { x: cuartoAncho, y: -cuartoAlto }, // inferior derecha
  ];

  return centrosCuadrante.map(({ x, y }) => {
    const geometria = new THREE.PlaneGeometry(ANCHO_REFLEJO, largo);
    const franja = new THREE.Mesh(geometria, material);
    // -signoCamara, no +signoCamara: lookAt() hace que el eje local -Z de
    // la pared apunte hacia pared.normal (hacia fuera), así que local +Z es
    // "hacia dentro". Cuando la cámara está del lado de la normal
    // (signoCamara=+1) hay que desplazar hacia -Z; cuando está del lado
    // contrario (signoCamara=-1) hay que desplazar hacia +Z — el signo
    // opuesto en ambos casos.
    franja.position.set(x, y, -signoCamara * OFFSET_REFLEJO_Z);
    franja.rotation.z = anguloRad;
    franja.renderOrder = 10;
    return franja;
  });
}

// Suelo/techo horizontales a partir de N cuadriláteros en espacio de mundo
// (uno por celda interior del plano, Fase 3 — la huella ya no es
// necesariamente un rectángulo simple, así que ya no basta un único quad).
// No un PlaneGeometry alineado a los ejes del mundo + rotación: la casa
// está rotada al azimut real de `orientacionCasa`, y un plano sin rotar
// dejaba huecos/salientes en las esquinas frente a las paredes.
//
// TODOS los quads se funden en una única BufferGeometry indexada (Fase 4,
// pulido de rendimiento — ver docs/estado.md): con el plano migrado por
// defecto de un usuario real (tamanoCelda=0.25m, ~475 celdas) construir
// una malla de Three.js POR CELDA daba ~950 mallas solo para suelo+techo,
// muchas más que todo el resto de la escena junto (isla, nubes, lluvia,
// viento) — un coste de draw calls innecesario para geometría 100%
// estática que nunca cambia tras crear la escena. Un solo mesh con todos
// los triángulos ya indexados es idéntico visualmente y muchísimo más
// barato.
//
// Cada celda aporta 4 vértices propios (no reutiliza los de la celda de
// al lado, aunque compartan esquina): más simple que deduplicar vértices
// entre celdas contiguas, y el coste extra de memoria es insignificante
// para las cantidades de celdas reales de esta app. Dentro de cada celda,
// misma técnica ya usada desde la Fase 6 (índice [0,1,2, 0,2,3], no 6
// vértices sueltos): con vértices duplicados DENTRO de un mismo quad se
// veía una costura diagonal por precisión/redondeo entre las dos copias
// del vértice compartido; con índice de verdad ambos triángulos de esa
// celda comparten el mismo vértice en memoria.
function construirQuadsFusionados(quads, material) {
  const vertices = new Float32Array(quads.length * 4 * 3);
  const indices = new Array(quads.length * 6);
  quads.forEach((quad, i) => {
    const base = i * 4;
    quad.forEach((p, j) => {
      vertices[(base + j) * 3] = p.x;
      vertices[(base + j) * 3 + 1] = p.y;
      vertices[(base + j) * 3 + 2] = p.z;
    });
    const idx = i * 6;
    indices[idx] = base;
    indices[idx + 1] = base + 1;
    indices[idx + 2] = base + 2;
    indices[idx + 3] = base;
    indices[idx + 4] = base + 2;
    indices[idx + 5] = base + 3;
  });
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometria.setIndex(indices);
  geometria.computeVertexNormals();
  return new THREE.Mesh(geometria, material);
}

function construirSuelo(geo) {
  // DoubleSide: evita depender de acertar el orden de bobinado a mano para
  // que la normal salga hacia arriba.
  const material = new THREE.MeshStandardMaterial({
    color: COLOR_SUELO,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const malla = construirQuadsFusionados(geo.esquinasSuelo, material);
  malla.receiveShadow = true; // recibe la sombra real del marco de ventana
  return malla;
}

// Techo invisible (pedido explícito): sigue sin dibujarse — vista tipo
// casa de muñecas, sin tapar la cámara — pero proyecta sombra igual que
// si estuviera ahí. transparent+opacity:0 en vez de visible:false: Three.js
// se salta por completo del pase de sombra cualquier objeto con
// visible:false (no solo del render normal), así que tiene que seguir
// "visible" para la cámara de sombra y solo desaparecer por opacidad.
//
// Efecto esperado (comprobado, no es un bug): limita mucho cuánto suelo
// recibe sol directo. Un punto del suelo a más profundidad que
// altura/tan(elevación_solar) desde la ventana queda "bajo techo" — el
// rayo de vuelta al sol saldría por el techo antes que por la ventana, así
// que el techo lo bloquea. Es el mismo efecto que en una habitación real
// con techo: mancha de sol cerca de la ventana, sombra según se aleja.
function construirTecho(geo) {
  const material = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const quads = geo.esquinasSuelo.map((quad) => quad.map((p) => ({ ...p, y: geo.altura })));
  const malla = construirQuadsFusionados(quads, material);
  malla.castShadow = true;
  return malla;
}

// Nubes (checkpoint 4→5, spec.md §6.1: "nubes cuando hay nubosidad alta") —
// por encima de la habitación, opacidad según `nubesPct`.
//
// Checkpoint 5 (pedido explícito: "unas nubes más bonitas que 4 círculos",
// con animación): en vez de un único círculo plano MeshBasicMaterial por
// nube, cada "nube" es ahora un CÚMULO de 5 THREE.Sprite con una textura
// radial generada en <canvas> (degradado blanco→transparente, sin ningún
// asset externo — coherente con "sin servidor" de CLAUDE.md). Sprite en
// vez de un plano con lookAt manual: Three.js ya orienta un Sprite hacia la
// cámara automáticamente (billboard nativo), así que no hace falta
// replicar el truco de orientación de construirLluvia. Los 5 puntos del
// patrón (PATRON_PUFF) se solapan con radios/opacidades distintos para que
// el contorno del cúmulo sea irregular, no un círculo perfecto.
//
// Dos tonos, no uno (primer intento con un solo blanco crema quedó casi
// invisible: el fondo del cielo era, en aquel diseño, un crema muy
// parecido a COLOR_NUBE_CLARO, así que a la opacidad de una nube real casi
// no había contraste — ya no aplica tal cual desde que el cielo pasó a
// azul, checkpoint 9, pero el mismo tipo de bug volvió a salir con el
// rayo y con el polvo del viento, así que el degradado de dos tonos se
// mantiene). Una capa de "sombra" gris-cálida, más grande y desplazada
// hacia abajo, por DEBAJO de los puffs blancos: así el borde inferior del
// cúmulo se lee gris (como la base sombreada de una nube real) y el
// conjunto tiene volumen en vez de ser un blanco plano sobre crema.
const UMBRAL_NUBES_PCT = 35; // por debajo de esto no se dibuja ninguna
const COLOR_NUBE_CLARO = 0xffffff;
const COLOR_NUBE_SOMBRA = 0xc2b39c;

let texturaNubeCache = null;
function texturaNube() {
  if (texturaNubeCache) return texturaNubeCache;
  const tam = 128;
  const canvas = document.createElement('canvas');
  canvas.width = tam;
  canvas.height = tam;
  const ctx = canvas.getContext('2d');
  const centro = tam / 2;
  const degradado = ctx.createRadialGradient(centro, centro, 0, centro, centro, centro);
  degradado.addColorStop(0, 'rgba(255,255,255,1)');
  degradado.addColorStop(0.55, 'rgba(255,255,255,0.6)');
  degradado.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, tam, tam);
  texturaNubeCache = new THREE.CanvasTexture(canvas);
  return texturaNubeCache;
}

// Offsets relativos DENTRO de un cúmulo (unidades de radio del cúmulo), fijos
// para que el contorno sea siempre el mismo — reutilizado tal cual en cada
// una de las posiciones de ANCLAS_NUBE.
const PATRON_PUFF = [
  { x: 0, y: 0, escala: 1 },
  { x: -0.55, y: -0.12, escala: 0.65 },
  { x: 0.5, y: -0.08, escala: 0.7 },
  { x: -0.2, y: 0.32, escala: 0.58 },
  { x: 0.28, y: 0.28, escala: 0.55 },
];

// Posiciones ANCLA fijas — no se generan con Math.random() sin más porque la
// zona en la que un cúmulo no roza la silueta de la caja se encontró a base
// de prueba y error real (ver historial abajo), y no es una fórmula que se
// pueda extrapolar con seguridad a un punto cualquiera. Lo "aleatorio"
// (checkpoint 6, pedido explícito: "que no siempre estén en el mismo
// sitio") es CUÁLES de estas anclas se usan en cada carga y cuánto se
// desplaza cada una alrededor de su ancla — dentro de un margen ya probado
// como seguro (ver AMPLITUD_JITTER_NUBE), no en cualquier dirección.
//
// Las 5 comparten familia de dirección (x y z negativos): es la zona
// arriba-izquierda de la pantalla que la cámara isométrica fija deja
// despejada de la silueta de la caja. Costó bastante encontrar el punto
// correcto: con offsets de signo mixto (probado primero) una nube quedaba
// proyectada justo sobre el borde de la pared del fondo — al ser
// semitransparente se mezclaba con el color oscuro de la pared detrás y se
// leía como una mancha sucia, no como una nube — y otra ni siquiera era
// visible. Alejar las nubes en horizontal (mismo x/z, más magnitud) NO
// arregló el roce: la nube seguía tangente al borde del tejado porque el
// borde también se aleja en la misma diagonal. Lo que sí lo arregla es
// `alturaBase` (más abajo): confirmado con capturas de color plano a
// opacidad 1 (sin mezcla, para ver el solape real sin ambigüedad) que
// hacía falta subir la altura hasta que las 4 originales quedasen
// claramente por encima del vértice del tejado — no es un cálculo derivado
// de la cámara, es una zona segura encontrada a ojo con captura real.
const ANCLAS_NUBE = [
  { x: -0.5, z: -0.2, radio: 0.22 },
  { x: -0.15, z: -0.5, radio: 0.28 },
  { x: -0.75, z: -0.55, radio: 0.24 },
  { x: -0.4, z: -0.75, radio: 0.2 },
  { x: -0.85, z: -0.25, radio: 0.19 },
];
// Jitter aleatorio pequeño alrededor de cada ancla — mismo orden de magnitud
// que AMPLITUD_DERIVA_NUBE (la deriva de animación), que ya se sabe seguro
// (verificado con captura a los 3s de animación sin volver a rozar el
// tejado): un desplazamiter estático del mismo tamaño no debería ser menos
// seguro que uno animado que ya llega a ese extremo.
const AMPLITUD_JITTER_NUBE = 0.07;

// Cuántos cúmulos según nubosidad — pedido explícito ("que la cantidad de
// nubes no sea simplemente la opacidad... si hay muchas nubes que haya más
// nubes en cantidad, y si hay pocas una nube pequeña"). Umbrales sobre
// `nubesPct` directamente (no sobre `intensidad`, que ya está normalizada
// 0-1 desde UMBRAL_NUBES_PCT) para que sean fáciles de leer/ajustar.
function numeroCumulos(nubesPct) {
  if (nubesPct < UMBRAL_NUBES_PCT) return 0;
  if (nubesPct < 50) return 1;
  if (nubesPct < 65) return 2;
  if (nubesPct < 80) return 3;
  if (nubesPct < 92) return 4;
  return 5;
}

// Baraja `array` (Fisher-Yates) usando `azar` como fuente de aleatoriedad
// (inyectada para poder testear con una secuencia fija si hiciera falta más
// adelante) — determina qué anclas concretas se usan cuando hay menos
// cúmulos que anclas disponibles.
function barajar(array, azar = Math.random) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Deriva lateral lenta (pedido explícito de animación): amplitud pequeña a
// propósito — un balanceo suave, no las nubes cruzando la pantalla, para no
// romper ni el tono "tranquilo" (CLAUDE.md) ni la zona segura ya ajustada
// arriba (con más amplitud, el cúmulo más cercano al tejado volvería a
// rozarlo en el extremo del movimiento).
const AMPLITUD_DERIVA_NUBE = 0.06; // fracción de `radio` de la escena
const VELOCIDAD_DERIVA_NUBE = 0.05; // rad/s

// `aspecto` (ancho/alto del encuadre) decide cuánto cielo vertical hay
// disponible de verdad — pedido explícito ("en el móvil las nubes se ven
// muy bajas, aprovecha toda la altura"). En retrato (aspecto<1),
// construirCamara ya deja mucho más cielo por encima de la habitación (el
// alto del encuadre se deriva del ancho necesario, no al revés — ver
// construirCamara); aquí se aprovecha ese sobrante repartiendo los cúmulos
// en un rango de alturas más alto en vez de amontonarlos todos a la altura
// fija de landscape. En landscape (aspecto>=1) el rango colapsa a
// prácticamente la altura fija de siempre (min≈max), sin cambiar el
// resultado ya validado.
//
// TECHO_CIELO_PORTRAIT (antes compartía el mismo 1.15 que landscape) se
// separó en su propia constante al mover la isla hacia arriba (ver
// FACTOR_ARRIBA_RETRATO en construirCamara, pedido explícito: "la isla
// está demasiado abajo"): ese cambio reduce cuánto cielo real hay por
// encima del punto de mira en retrato, así que el mismo 1.15 de antes ya
// se pasaba del borde superior real del encuadre (verificado provisionando
// una cámara real y proyectando puntos de prueba, no solo a ojo). 0.85 es
// ~94% del nuevo límite real (con margen para no recortar nada), calculado
// una vez para cualquier aspecto retrato (la relación entre `techoCielo` y
// el límite real de la cámara es constante en `aspecto`, ambos escalan
// igual con `1/aspecto`).
//
// TECHO_CIELO_LANDSCAPE (1.15 → 0.72): bug real, preexistente y sin
// relación con el cambio de retrato de arriba, encontrado al verificar
// nubes en pantalla ancha con el mismo método (proyectar con la cámara
// real): con nubesPct alto NINGUNA nube se veía en landscape — en ese
// modo `alturaMin===alturaMax` (una única altura fija, sin aleatoriedad),
// así que si esa altura está mal, TODAS las nubes (y el techo del rango de
// estrellas) se recortan siempre, sin excepción, no a veces. La isla/el
// árbol/la farola (checkpoints 8-16) fueron agrandando el `radio` que usa
// esta fórmula desde que 1.15 se calibró (antes de que existieran), sin
// que nadie volviera a comprobar si las nubes seguían cabiendo — 1.15
// proyectaba un 55% más allá del borde real de la cámara. 0.72 es el valor
// seguro (con margen) equivalente al que ya se calculó para retrato,
// verificado igual con la cámara real en varios anchos de pantalla (el
// resultado no depende del aspecto en landscape, solo del `radio`, que es
// el mismo cálculo que ya usa la cámara).
const TECHO_CIELO_LANDSCAPE = 0.72;
const TECHO_CIELO_PORTRAIT = 0.85;
function techoCielo(aspecto) {
  return aspecto < 1 ? TECHO_CIELO_PORTRAIT / aspecto : TECHO_CIELO_LANDSCAPE;
}

function construirNubes(nubesPct, objetivo, radio, aspecto) {
  const grupo = new THREE.Group();
  const numCumulos = numeroCumulos(nubesPct);
  if (numCumulos === 0) return grupo;

  // 0 en el umbral, 1 con cielo completamente cubierto — nunca 0 aquí
  // (ya se filtró arriba), así que siempre hay algo de opacidad visible.
  const intensidad = (nubesPct - UMBRAL_NUBES_PCT) / (100 - UMBRAL_NUBES_PCT);
  // En landscape, igual que siempre: min=max=1.15 (una única altura fija,
  // ya validada). En retrato, pedido explícito ("las nubes tienen que verse
  // arriba del todo"): en vez de repartir las nubes en todo el hueco entre
  // la altura de landscape y el techo real (la mayoría acababan a media
  // altura, lejos del borde), se estrecha el rango a una banda pegada al
  // propio techo — techoCielo(aspecto) ya es el límite seguro (ver arriba).
  const FRACCION_BANDA_NUBES_PORTRAIT = 0.82;
  const alturaMax = objetivo.y + radio * techoCielo(aspecto);
  const alturaMin =
    aspecto < 1
      ? objetivo.y + radio * techoCielo(aspecto) * FRACCION_BANDA_NUBES_PORTRAIT
      : objetivo.y + radio * TECHO_CIELO_LANDSCAPE;
  const textura = texturaNube();
  // 0.55-0.95 (checkpoints 5-6) se leía demasiado tenue — pedido explícito
  // ("haz que las nubes se vean más") junto con la corrección de que ya no
  // oscurecen tanto la escena: si van a aportar menos sombra a la luz, que
  // al menos se noten más ellas mismas como objeto.
  const opacidadBase = 0.72 + 0.28 * intensidad;
  // Con pocos cúmulos (nubosidad baja) cada uno es más pequeño — "una nube
  // pequeña" pedido explícito, no el mismo tamaño repetido con menos
  // opacidad.
  const escalaCumulo = 0.65 + 0.08 * numCumulos;

  const anclas = barajar(ANCLAS_NUBE).slice(0, numCumulos);

  // Bug real encontrado al verificar el reencuadre de la isla (más arriba,
  // FACTOR_ARRIBA_RETRATO): ANCLAS_NUBE se calibró (checkpoints 4-6) frente
  // a un `radio` bastante menor, antes de que la isla/el árbol/la farola
  // (checkpoints 8-16) empezaran a formar parte de `calcularRadioEscena` —
  // ese `radio` casi se ha DUPLICADO desde entonces sin que nadie
  // reescalara las anclas, así que fracciones como x=-0.85 ya representaban
  // un desplazamiento mayor que la propia mitad del encuadre horizontal de
  // la cámara (`alcanceHorizontal≈0.55×radio`): comprobado proyectando las
  // 5 anclas con la cámara real, con nubesPct alto la mayoría de los
  // cúmulos quedaban fuera de pantalla (NDC.x por debajo de -1), no solo
  // cerca del borde. ESCALA_HORIZONTAL_NUBE las trae de vuelta a una
  // fracción de `radio` segura (verificado con la cámara real en retrato,
  // cuadrado y panorámico: NDC.x máximo ≈0.77, con margen) sin renunciar a
  // la disposición relativa entre anclas ya calibrada (esquinas
  // arriba-izquierda, ver comentario de ANCLAS_NUBE).
  const ESCALA_HORIZONTAL_NUBE = 0.5;

  anclas.forEach(({ x, z, radio: radioRelativo }, i) => {
    // Jitter aleatorio fijo por cúmulo (calculado una vez al construir la
    // escena, no en cada frame — checkpoint 6, "no siempre en el mismo
    // sitio" significa carga a carga, no un temblor continuo).
    const jitterX = (Math.random() * 2 - 1) * AMPLITUD_JITTER_NUBE;
    const jitterZ = (Math.random() * 2 - 1) * AMPLITUD_JITTER_NUBE;
    const cx = objetivo.x + radio * ESCALA_HORIZONTAL_NUBE * (x + jitterX);
    const cz = objetivo.z + radio * ESCALA_HORIZONTAL_NUBE * (z + jitterZ);
    const radioCumulo = radio * radioRelativo * escalaCumulo;
    const alturaNubes = alturaMin + Math.random() * (alturaMax - alturaMin);

    const cumulo = new THREE.Group();
    cumulo.userData.fase = i * 1.7; // desfase fijo para que no se muevan todas a la vez
    cumulo.userData.radioBase = radio * AMPLITUD_DERIVA_NUBE;

    function añadirPuff(puff, color, opacidad, escalaExtra, offsetY, ordenRender) {
      const material = new THREE.SpriteMaterial({
        map: textura,
        color,
        transparent: true,
        opacity: opacidad,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      const tamañoPuff = radioCumulo * puff.escala * 2.1 * escalaExtra;
      sprite.scale.set(tamañoPuff, tamañoPuff, 1);
      sprite.position.set(
        cx + radioCumulo * puff.x,
        alturaNubes + radioCumulo * puff.y * 0.6 + offsetY,
        cz,
      );
      // renderOrder explícito, no solo orden de inserción: dos sprites
      // transparentes casi coplanares pueden ordenarse por distancia a
      // cámara de forma ambigua (la capa de sombra está desplazada hacia
      // abajo, así que según el ángulo puede quedar "más cerca" que el
      // blanco que debería taparla) — con renderOrder, Three.js respeta el
      // orden pedido antes que su propio criterio de profundidad.
      sprite.renderOrder = ordenRender;
      cumulo.add(sprite);
    }

    // Sombra primero (debajo, más grande, desplazada hacia abajo) — luego
    // los puffs blancos encima la tapan casi del todo salvo un borde
    // inferior, que es justo el efecto de volumen buscado.
    PATRON_PUFF.forEach((puff) => {
      añadirPuff(puff, COLOR_NUBE_SOMBRA, opacidadBase * 0.85, 1.12, -radioCumulo * 0.16, 0);
    });
    PATRON_PUFF.forEach((puff) => {
      añadirPuff(puff, COLOR_NUBE_CLARO, opacidadBase * (0.65 + 0.35 * puff.escala), 1, 0, 1);
    });

    grupo.add(cumulo);
  });

  return grupo;
}

// Avanza la deriva de cada cúmulo — llamada desde el bucle de animación con
// el tiempo transcurrido (segundos). Cada cúmulo es un THREE.Group hijo
// directo de `grupoNubes`; se mueve como bloque (los 5 puffs no se separan
// entre sí).
function animarNubes(grupoNubes, tiempo) {
  grupoNubes.children.forEach((cumulo) => {
    const fase = cumulo.userData.fase ?? 0;
    cumulo.position.x = cumulo.userData.radioBase * Math.sin(tiempo * VELOCIDAD_DERIVA_NUBE + fase);
  });
}

// Lluvia (checkpoint 4→6, spec.md §6.1: "lluvia cuando precipitación > 0").
//
// Checkpoint 6 (reescrita por completo, pedido explícito: "no me gusta,
// hazla más realista — partículas más pequeñas cayendo verticalmente, mucho
// más rápido (velocidad realista), más partículas, sin agrupamientos,
// distribución aleatoria"). El checkpoint 5 usaba 8 franjas diagonales fijas
// en un billboard orientado a cámara; ahora es un único `THREE.Points` con
// cientos de partículas pequeñas, posición X/Z aleatoria de verdad
// (`Math.random()`, no un patrón fijo de offsets — así no hay agrupamientos
// visibles) y caída puramente VERTICAL. Al ser vertical (eje Y del mundo) no
// hace falta orientar nada hacia la cámara — a diferencia de la lluvia
// diagonal del checkpoint 5, una línea vertical en espacio de mundo se
// proyecta vertical en pantalla venga la cámara de donde venga (con
// `camera.up` en el eje Y del mundo, que es el caso aquí) — así que se quita
// también el parámetro `direccionCamara` (y con él, `direccionCamara3D`, que
// se queda sin ningún otro uso).
//
// `THREE.Points` en vez de cientos de `THREE.Mesh`: un único
// BufferGeometry/DrawCall para todas las partículas — mucho más barato que
// instanciar un THREE.Mesh por gota, que sí importaría a este volumen
// (hasta 260 partículas).
const COLOR_LLUVIA = 0xcfe0e8;
// 70-260, luego 110-550, luego 160-850 (intentos previos): cada vez se
// pedía más intensidad al máximo, pero el mínimo también había ido
// subiendo con cada ronda — con 160 de mínimo, poca lluvia ya se veía
// bastante lluvia, así que la diferencia entre "poco" y "mucho" no se
// notaba (pedido explícito: "que la diferencia sea más clara"). Mínimo
// bajado mucho, máximo subido más todavía — más rango entre los dos
// extremos, no solo un desplazamiento del rango hacia arriba.
const NUM_PARTICULAS_LLUVIA_MIN = 35;
const NUM_PARTICULAS_LLUVIA_MAX = 1100;
// m/s — velocidad terminal real aproximada de una gota de lluvia (no
// escalada por `radio`, a diferencia del resto de la escena: la caída de la
// lluvia es un fenómeno físico con una velocidad real en metros por segundo,
// no un elemento decorativo dimensionado a la escala de la habitación).
const VELOCIDAD_CAIDA_MIN_MS = 6;
const VELOCIDAD_CAIDA_MAX_MS = 9;

// Textura pequeña de una "cápsula" (más larga que ancha) en vez de un
// punto redondo — un redondo a esta velocidad de caída se lee como una
// mota flotando, no como lluvia; una gota alargada en la dirección de
// caída se lee mejor como gota incluso sin animación de estela.
//
// `anguloRad` (checkpoint 9, pedido explícito: "que también se modifique
// el ángulo de la lluvia por culpa del viento") inclina la cápsula DE
// VERDAD, no solo la trayectoria — sin esto, la deriva horizontal
// (construirLluvia) movía el CAMPO de gotas en diagonal pero cada gota
// individual se seguía dibujando vertical, así que en una imagen fija no
// se notaba ningún ángulo, sólo un desplazamiento. Al ser una única
// textura pequeña generada una vez por escena (no por frame), rotar el
// `<canvas>` antes de dibujar es prácticamente gratis — no hace falta
// cachear distintos ángulos como con `texturaPolvo()`/`texturaNube()`
// (que no varían nunca dentro de una misma carga).
function texturaGota(anguloRad = 0) {
  const tam = 32;
  const canvas = document.createElement('canvas');
  canvas.width = tam;
  canvas.height = tam;
  const ctx = canvas.getContext('2d');
  if (anguloRad !== 0) {
    ctx.translate(tam / 2, tam / 2);
    ctx.rotate(anguloRad);
    ctx.translate(-tam / 2, -tam / 2);
  }
  ctx.fillStyle = 'white';
  const anchoGota = tam * 0.22;
  const altoGota = tam * 0.9;
  const x = (tam - anchoGota) / 2;
  const y = (tam - altoGota) / 2;
  const r = anchoGota / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + anchoGota, y, x + anchoGota, y + r, r);
  ctx.arcTo(x + anchoGota, y + altoGota, x + anchoGota - r, y + altoGota, r);
  ctx.arcTo(x, y + altoGota, x, y + altoGota - r, r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

// Repite `valor` dentro de [min, max) — usado para que la lluvia "reaparezca
// arriba" al salir del rango visible en vez de crear/destruir geometría.
function envolver(valor, min, max) {
  const rango = max - min;
  return min + (((valor - min) % rango) + rango) % rango;
}

// `viento` (checkpoint 9, pedido explícito: "que también se modifique el
// ángulo de la lluvia por culpa del viento") empuja la lluvia en horizontal
// mientras cae — no es una rotación de la textura (con cámara ortográfica
// y `THREE.Points`, cada sprite no se puede rotar sin shader propio, mismo
// límite que ya salió con el polvo del viento), sino una deriva real de
// posición en X/Z a la vez que cae en Y: la TRAYECTORIA queda en diagonal
// aunque cada gota individual se dibuje con la misma cápsula vertical de
// siempre. Con cientos de gotas cayendo rápido, una trayectoria en
// diagonal ya se lee como "lluvia con viento" sin necesitar que el sprite
// también gire.
function construirLluvia(precipitacion, objetivo, radio, viento, dirCamaraXZ) {
  const grupo = new THREE.Group();
  if (precipitacion <= 0) return grupo;

  // Más partículas Y más rápidas con más intensidad, con un tope — no hace
  // falta distinguir 5mm de 50mm con precisión, solo "llueve poco" frente a
  // "llueve mucho".
  const intensidad = Math.min(1, precipitacion / 5);
  const numParticulas = Math.round(
    NUM_PARTICULAS_LLUVIA_MIN + intensidad * (NUM_PARTICULAS_LLUVIA_MAX - NUM_PARTICULAS_LLUVIA_MIN),
  );
  const extensionXZ = radio * 0.95; // radio horizontal del área donde puede caer lluvia — más ceñido que 1.15 (antes), para que se note más densa dentro del encuadre en vez de repartida en un área más ancha
  const alturaCentro = objetivo.y + radio * 0.75;
  const mitadRango = radio * 0.55; // cae dentro de [centro−mitad, centro+mitad], en bucle

  // Deriva horizontal: 0 sin viento (cae recta, igual que antes). Factor
  // 0.5 sobre la velocidad real del viento — la lluvia no se arrastra
  // lateralmente tan rápido como el aire en sí (tiene su propia inercia
  // cayendo), es una aproximación razonable, no un cálculo físico exacto.
  const conViento = !!viento && viento.velocidad > 0;
  const derivaDir = conViento ? direccionVientoXZ(viento.direccion) : { x: 0, z: 1 };
  const derivaPerp = { x: -derivaDir.z, z: derivaDir.x };
  const derivaVelocidad = conViento ? (Math.min(viento.velocidad, 60) / 3.6) * 0.5 : 0;
  const velocidadCaida = VELOCIDAD_CAIDA_MIN_MS + (VELOCIDAD_CAIDA_MAX_MS - VELOCIDAD_CAIDA_MIN_MS) * intensidad;

  // Ángulo de la gota EN PANTALLA (no solo su trayectoria — ver comentario
  // de texturaGota): la componente de la deriva horizontal que cae sobre
  // la dirección "derecha de pantalla" de la cámara (perpendicular a
  // hacia dónde mira, mismo truco de `perp` de más arriba) es la que se
  // nota como inclinación visual — la componente hacia/desde la cámara no
  // se ve en absoluto con proyección ortográfica (no hay profundidad
  // aparente), así que un viento que sopla justo hacia/desde el
  // espectador no inclina la lluvia nada, y uno que sopla de lado la
  // inclina al máximo — físicamente coherente con lo que se vería de
  // verdad desde este ángulo de cámara fijo.
  const derechaPantalla = { x: -dirCamaraXZ.z, z: dirCamaraXZ.x };
  const tiltHorizontal = derivaDir.x * derivaVelocidad * derechaPantalla.x + derivaDir.z * derivaVelocidad * derechaPantalla.z;
  const anguloGota = Math.atan2(tiltHorizontal, velocidadCaida);

  const posiciones = new Float32Array(numParticulas * 3);
  const y0 = new Float32Array(numParticulas);
  const d0 = new Float32Array(numParticulas);
  const lateral0 = new Float32Array(numParticulas);
  for (let i = 0; i < numParticulas; i += 1) {
    // Math.random() de verdad, no un patrón de offsets fijo — pedido
    // explícito ("que no se vean agrupamientos... distribución aleatoria").
    // A diferencia de las nubes (más abajo), aquí no hace falta que sea
    // estable entre cargas: con cientos de gotas cayendo rápido no se
    // percibe patrón alguno, agrupado o no.
    d0[i] = (Math.random() * 2 - 1) * extensionXZ;
    lateral0[i] = (Math.random() * 2 - 1) * extensionXZ;
    const y = alturaCentro + (Math.random() * 2 - 1) * mitadRango;
    posiciones[i * 3] = objetivo.x + derivaDir.x * d0[i] + derivaPerp.x * lateral0[i];
    posiciones[i * 3 + 1] = y;
    posiciones[i * 3 + 2] = objetivo.z + derivaDir.z * d0[i] + derivaPerp.z * lateral0[i];
    y0[i] = y;
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));

  const material = new THREE.PointsMaterial({
    map: texturaGota(anguloGota),
    color: COLOR_LLUVIA,
    // Tamaño en PÍXELES de pantalla, no en unidades de mundo — con cámara
    // ortográfica, el shader de THREE.Points de esta versión de Three.js
    // solo aplica la atenuación por distancia (`sizeAttenuation`) para
    // cámaras en perspectiva; con una ortográfica, `size` es directamente
    // el tamaño en píxeles del sprite. `radio * 0.026` (primer intento,
    // pensando en unidades de mundo como el resto de la escena) daba
    // sprites de bastante menos de 1px — prácticamente invisibles.
    size: 4.5,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.6 + 0.3 * intensidad,
    depthWrite: false,
  });

  const puntos = new THREE.Points(geometria, material);
  puntos.userData = {
    y0,
    alturaCentro,
    mitadRango,
    velocidad: velocidadCaida,
    d0,
    lateral0,
    derivaDir,
    derivaPerp,
    derivaVelocidad,
    extensionXZ,
    objetivo,
  };
  grupo.add(puntos);
  return grupo;
}

// Avanza la caída de cada partícula — llamada desde el bucle de animación
// con el tiempo transcurrido (segundos). Muta el buffer de posiciones
// directamente (en vez de mover cientos de objetos hijos): es la forma
// habitual de animar un THREE.Points, y evita recrear geometría cada frame.
function animarLluvia(grupoLluvia, tiempo) {
  const puntos = grupoLluvia.children[0];
  if (!puntos) return; // sin lluvia, el grupo está vacío
  const {
    y0,
    alturaCentro,
    mitadRango,
    velocidad,
    d0,
    lateral0,
    derivaDir,
    derivaPerp,
    derivaVelocidad,
    extensionXZ,
    objetivo,
  } = puntos.userData;
  const attr = puntos.geometry.attributes.position;
  for (let i = 0; i < y0.length; i += 1) {
    attr.setY(i, envolver(y0[i] - tiempo * velocidad, alturaCentro - mitadRango, alturaCentro + mitadRango));
    // Sin viento, derivaVelocidad es 0 y esto deja X/Z en su valor
    // inicial (envolver de un valor constante ya dentro de rango no lo
    // cambia) — mismo comportamiento de siempre, sin ramificar el código
    // en un caso "con viento" y otro "sin viento".
    const d = envolver(d0[i] + tiempo * derivaVelocidad, -extensionXZ, extensionXZ);
    attr.setX(i, objetivo.x + derivaDir.x * d + derivaPerp.x * lateral0[i]);
    attr.setZ(i, objetivo.z + derivaDir.z * d + derivaPerp.z * lateral0[i]);
  }
  attr.needsUpdate = true;
}

// Polvo en suspensión (checkpoint 6, pedido explícito: "partículas de polvo
// para representar el viento y su dirección, siempre y cuando no haya
// lluvia... que apunten hacia la dirección real del viento, teniendo en
// cuenta la orientación de la casa"). `THREE.Points`, mismo patrón que la
// lluvia — cientos de motas pequeñas, una sola geometría.
// Primer intento (0xd9c9a3) casi invisible — mismo problema de siempre en
// esta escena (nubes, rayo): un tono cálido claro se funde con el cielo
// cálido claro (COLOR_FONDO). Más oscuro/terroso, con más contraste tanto
// de día como de noche.
const COLOR_POLVO = 0x9c7c4f;
const NUM_POLVO_MIN = 45;
const NUM_POLVO_MAX = 160;
// Tope de velocidad para escalar cantidad/velocidad — a partir de aquí ya
// es "mucho viento", no hace falta seguir intensificando el efecto.
const VELOCIDAD_POLVO_TOPE_KMH = 45;

let texturaPolvoCache = null;
function texturaPolvo() {
  if (texturaPolvoCache) return texturaPolvoCache;
  const tam = 32;
  const canvas = document.createElement('canvas');
  canvas.width = tam;
  canvas.height = tam;
  const ctx = canvas.getContext('2d');
  const centro = tam / 2;
  const degradado = ctx.createRadialGradient(centro, centro, 0, centro, centro, centro);
  degradado.addColorStop(0, 'rgba(255,255,255,0.9)');
  degradado.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, tam, tam);
  texturaPolvoCache = new THREE.CanvasTexture(canvas);
  return texturaPolvoCache;
}

// `direccion` es de dónde SOPLA el viento (convención meteorológica
// estándar, igual que `wind_direction_10m` de Open-Meteo) — el movimiento
// real de las partículas va hacia el lado opuesto (+180°). Misma fórmula
// que direccionSol() para pasar de grados de brújula a X/Z de mundo: los
// ejes de mundo de TODA la escena ya están alineados a la brújula desde
// geometria.js/sol.js (no giran con la habitación — es la CÁMARA, en
// construirCamara, la que rota según la orientación real de la ventana A),
// así que el viento apunta bien respecto a la fachada real sin ningún
// ajuste adicional aquí.
function direccionVientoXZ(direccionDeg) {
  const rad = ((direccionDeg + 180) * Math.PI) / 180;
  return { x: Math.sin(rad), z: Math.cos(rad) };
}

// Checkpoint 7 (pedido explícito: "cambia la animación del viento, que
// vaya haciendo como círculos y dejen una estela las partículas... una
// trayectoria algo turbulenta pero en la dirección correcta. si no es
// mucho trabajo, alguna hoja que vaya con las partículas"). La posición ya
// no es solo avance recto (`distancia0 + t*velocidad`, checkpoint 6):
// encima se suma un giro pequeño en el plano perpendicular al viento
// (`faseTurb`/`radioTurb`, por partícula) — la partícula avanza en línea
// recta EN PROMEDIO (la dirección real del viento) mientras gira alrededor
// de esa línea, que es justo "círculos pero en la dirección correcta".
//
// Misma fórmula de posición reutilizada para tres cosas distintas, todas
// construidas sobre `datosViento` (por partícula) + `compartido`
// (constantes de la corriente): la cabeza de cada mota de polvo, 2 puntos
// de estela por mota (mismo cálculo, evaluado en instantes anteriores —
// no hay que guardar historial de verdad) y las hojas.
function posicionViento(compartido, datos, i, t) {
  const { dir, perp, objetivo, mitadRecorrido, velocidad, velocidadTurb } = compartido;
  const d = envolver(datos.distancia0[i] + t * velocidad, -mitadRecorrido, mitadRecorrido);
  const fase = datos.faseTurb0[i] + t * velocidadTurb;
  const offsetPerp = datos.lateral[i] + Math.cos(fase) * datos.radioTurb[i];
  return {
    x: objetivo.x + dir.x * d + perp.x * offsetPerp,
    y: datos.alturaFija[i] + Math.sin(fase) * datos.radioTurb[i] * 0.6,
    z: objetivo.z + dir.z * d + perp.z * offsetPerp,
  };
}

// Genera los arrays por partícula (posición inicial, fase/radio de
// turbulencia) — comunes a las motas de polvo y a las hojas, con rangos
// distintos según `opciones`.
function generarDatosViento(n, mitadRecorrido, extensionLateral, alturaCentro, mitadAltura, radioTurbBase) {
  const distancia0 = new Float32Array(n);
  const lateral = new Float32Array(n);
  const alturaFija = new Float32Array(n);
  const faseTurb0 = new Float32Array(n);
  const radioTurb = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    distancia0[i] = (Math.random() * 2 - 1) * mitadRecorrido;
    lateral[i] = (Math.random() * 2 - 1) * extensionLateral;
    alturaFija[i] = alturaCentro + (Math.random() * 2 - 1) * mitadAltura;
    faseTurb0[i] = Math.random() * Math.PI * 2;
    radioTurb[i] = radioTurbBase * (0.6 + 0.6 * Math.random());
  }
  return { distancia0, lateral, alturaFija, faseTurb0, radioTurb };
}

// Separación entre los puntos de la estela, en segundos "hacia atrás" —
// pequeña, para que se lea como una estela corta pegada a la mota, no una
// cola larga y separada.
const PASO_ESTELA = 0.09;
const COLOR_HOJA = 0xb97a3d; // hoja seca, tono otoñal — se distingue del polvo sin desentonar
const NUM_HOJAS = 7; // pocas, "si no es mucho trabajo" — un detalle, no otro sistema de partículas grande

// `viento` es `{velocidad (km/h), direccion (grados)}` o null (sin dato).
// Devuelve un grupo con hasta 3 THREE.Points (cabeza de polvo, estela de
// polvo, hojas) — vacío si no aplica, mismo patrón que construirLluvia.
function construirViento(viento, precipitacion, objetivo, radio, aspecto, nocturnidadActual) {
  const grupo = new THREE.Group();
  // Solo sin lluvia (pedido explícito) y con viento real por encima de
  // calma — con viento ~0 no habría nada que mostrar.
  if (!viento || precipitacion > 0 || viento.velocidad <= 0) return grupo;

  const velocidadClamp = Math.min(viento.velocidad, VELOCIDAD_POLVO_TOPE_KMH);
  const intensidad = velocidadClamp / VELOCIDAD_POLVO_TOPE_KMH;
  const numParticulas = Math.round(NUM_POLVO_MIN + intensidad * (NUM_POLVO_MAX - NUM_POLVO_MIN));

  const dir = direccionVientoXZ(viento.direccion);
  const perp = { x: -dir.z, z: dir.x }; // perpendicular en el plano XZ, para el ancho de la "corriente"

  const compartido = {
    dir,
    perp,
    objetivo,
    mitadRecorrido: radio * 1.2, // tramo que recorre cada partícula antes de reaparecer al otro lado
    velocidad: velocidadClamp / 3.6, // km/h -> m/s, velocidad real de avance neto
    velocidadTurb: 1.6 + Math.random() * 0.6, // rad/s del giro — parecido entre partículas, no idéntico
  };
  grupo.userData.compartido = compartido;

  // Portrait (checkpoint 15, pedido explícito: "en vertical el polvo no
  // se ve hasta arriba"): mismo criterio que techoCielo() para las
  // nubes — en retrato la cámara deja mucho más cielo por encima de la
  // habitación (el alto del encuadre se deriva del ancho, no al revés,
  // ver construirCamara), y sin este factor el polvo se quedaba pegado a
  // la franja baja ya ajustada para landscape, sin aprovechar ese
  // sobrante. En landscape (aspecto>=1) el factor es 1, sin cambios.
  const factorVertical = aspecto < 1 ? 1 / aspecto : 1;
  const extensionLateral = radio * 1.1;
  const alturaCentro = objetivo.y + radio * 0.15 * factorVertical;
  const mitadAltura = radio * 0.45 * factorVertical;
  const radioTurb = radio * 0.045; // pequeño — un giro sutil, no bucles enormes
  // Atenuado de noche (checkpoint 15, pedido explícito: "de noche brilla
  // demasiado, parecen luciérnagas"). PointsMaterial no reacciona a la
  // luz de la escena — su brillo es siempre el mismo definido aquí, así
  // que sin esto el polvo se ve igual de intenso con la escena a oscuras,
  // leyéndose como una fuente de luz propia en vez de una mota iluminada
  // por el sol/ambiental (que sí se atenúan de noche).
  const factorNoche = 1 - 0.65 * nocturnidadActual;

  const datosPolvo = generarDatosViento(
    numParticulas,
    compartido.mitadRecorrido,
    extensionLateral,
    alturaCentro,
    mitadAltura,
    radioTurb,
  );

  const posicionesCabeza = new Float32Array(numParticulas * 3);
  const posicionesEstela = new Float32Array(numParticulas * 2 * 3);
  for (let i = 0; i < numParticulas; i += 1) {
    const p0 = posicionViento(compartido, datosPolvo, i, 0);
    posicionesCabeza[i * 3] = p0.x;
    posicionesCabeza[i * 3 + 1] = p0.y;
    posicionesCabeza[i * 3 + 2] = p0.z;
    const p1 = posicionViento(compartido, datosPolvo, i, -PASO_ESTELA);
    const p2 = posicionViento(compartido, datosPolvo, i, -PASO_ESTELA * 2);
    posicionesEstela[i * 6] = p1.x;
    posicionesEstela[i * 6 + 1] = p1.y;
    posicionesEstela[i * 6 + 2] = p1.z;
    posicionesEstela[i * 6 + 3] = p2.x;
    posicionesEstela[i * 6 + 4] = p2.y;
    posicionesEstela[i * 6 + 5] = p2.z;
  }

  const geometriaCabeza = new THREE.BufferGeometry();
  geometriaCabeza.setAttribute('position', new THREE.BufferAttribute(posicionesCabeza, 3));
  const puntosCabeza = new THREE.Points(
    geometriaCabeza,
    new THREE.PointsMaterial({
      map: texturaPolvo(),
      color: COLOR_POLVO,
      size: 6,
      sizeAttenuation: false,
      transparent: true,
      opacity: (0.55 + 0.3 * intensidad) * factorNoche,
      depthWrite: false,
    }),
  );
  puntosCabeza.userData = { datos: datosPolvo, esCabeza: true };
  grupo.add(puntosCabeza);

  // Estela: mismo polvo, más pequeño y más tenue — sin esto (probado) no
  // se lee como "dejan estela", se lee como el doble de polvo normal.
  const geometriaEstela = new THREE.BufferGeometry();
  geometriaEstela.setAttribute('position', new THREE.BufferAttribute(posicionesEstela, 3));
  const puntosEstela = new THREE.Points(
    geometriaEstela,
    new THREE.PointsMaterial({
      map: texturaPolvo(),
      color: COLOR_POLVO,
      size: 3.5,
      sizeAttenuation: false,
      transparent: true,
      opacity: (0.28 + 0.15 * intensidad) * factorNoche,
      depthWrite: false,
    }),
  );
  puntosEstela.userData = { datos: datosPolvo, esCabeza: false };
  grupo.add(puntosEstela);

  // Hojas (pedido explícito, "si no es mucho trabajo"): mismo cálculo de
  // trayectoria que el polvo, con su propio radio de giro (algo mayor —
  // una hoja se balancea más que una mota de polvo) y sin estela propia,
  // para no complicar más de la cuenta.
  const datosHojas = generarDatosViento(
    NUM_HOJAS,
    compartido.mitadRecorrido,
    extensionLateral,
    alturaCentro,
    mitadAltura,
    radioTurb * 2.2,
  );
  const posicionesHojas = new Float32Array(NUM_HOJAS * 3);
  for (let i = 0; i < NUM_HOJAS; i += 1) {
    const p = posicionViento(compartido, datosHojas, i, 0);
    posicionesHojas[i * 3] = p.x;
    posicionesHojas[i * 3 + 1] = p.y;
    posicionesHojas[i * 3 + 2] = p.z;
  }
  const geometriaHojas = new THREE.BufferGeometry();
  geometriaHojas.setAttribute('position', new THREE.BufferAttribute(posicionesHojas, 3));
  const puntosHojas = new THREE.Points(
    geometriaHojas,
    new THREE.PointsMaterial({
      map: texturaPolvo(), // misma mancha suave, tamaño/color distintos ya la distinguen del polvo
      color: COLOR_HOJA,
      size: 9,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.8 * factorNoche,
      depthWrite: false,
    }),
  );
  puntosHojas.userData = { datos: datosHojas, esCabeza: true };
  grupo.add(puntosHojas);

  return grupo;
}

// Avanza polvo (cabeza + estela) y hojas a lo largo de la dirección real
// del viento, con el giro de turbulencia — llamada desde el bucle de
// animación con el tiempo transcurrido (segundos).
function animarViento(grupoViento, tiempo) {
  const compartido = grupoViento.userData.compartido;
  if (!compartido) return; // sin viento visible, el grupo está vacío
  grupoViento.children.forEach((puntos) => {
    const { datos, esCabeza } = puntos.userData;
    const attr = puntos.geometry.attributes.position;
    const n = datos.distancia0.length;
    for (let i = 0; i < n; i += 1) {
      if (esCabeza) {
        const p = posicionViento(compartido, datos, i, tiempo);
        attr.setXYZ(i, p.x, p.y, p.z);
      } else {
        const p1 = posicionViento(compartido, datos, i, tiempo - PASO_ESTELA);
        const p2 = posicionViento(compartido, datos, i, tiempo - PASO_ESTELA * 2);
        attr.setXYZ(i * 2, p1.x, p1.y, p1.z);
        attr.setXYZ(i * 2 + 1, p2.x, p2.y, p2.z);
      }
    }
    attr.needsUpdate = true;
  });
}

// El charco (checkpoint 7) se probó y se quitó en el checkpoint 8 —
// pedido explícito, quedaba demasiado cerca de la casa y no convencía.

// Radio de la escena entera respecto al punto que mira la cámara, no un
// cálculo basado únicamente en las dimensiones de la habitación (geo):
// recorre los 8 vértices de la caja englobante real de lo que haya en la
// escena, así no hay que volver a tocar esto si un checkpoint futuro añade
// más contenido (nubes, etc.) que también deba entrar en el encuadre.
function calcularRadioEscena(scene, objetivo) {
  const caja = new THREE.Box3().setFromObject(scene);
  const esquinas = [
    [caja.min.x, caja.min.y, caja.min.z], [caja.min.x, caja.min.y, caja.max.z],
    [caja.min.x, caja.max.y, caja.min.z], [caja.min.x, caja.max.y, caja.max.z],
    [caja.max.x, caja.min.y, caja.min.z], [caja.max.x, caja.min.y, caja.max.z],
    [caja.max.x, caja.max.y, caja.min.z], [caja.max.x, caja.max.y, caja.max.z],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  return Math.max(...esquinas.map((v) => v.distanceTo(objetivo)));
}

// Cámara ortográfica fija, estilo "Los Sims": sin perspectiva, sin órbita.
// El azimut se define como offset sobre la normal de la ventana A para que
// quede atado a la orientación real del piso, no a un ángulo de mundo fijo.
//
// Composición vertical (pedido explícito, para el layout de móvil en
// retrato: "la casa abajo, el clima arriba"): en landscape (aspecto>=1) el
// encuadre es el de siempre, simétrico. En retrato (aspecto<1) el ancho ya
// no se deriva del alto (eso encogía la habitación en pantallas estrechas);
// se deriva el ALTO del ANCHO necesario para encuadrar la habitación, lo
// que de por sí deja mucho más cielo visible arriba y abajo — y encima se
// reparte ese sobrante de forma asimétrica (más arriba que abajo) para que
// la habitación quede en la franja inferior de la pantalla, dejando la
// franja superior libre para nubes/lluvia/rayos.
function construirCamara(objetivo, radio, azimutBaseDeg, aspecto) {
  const azimutCamara = (azimutBaseDeg + CAMARA_AZIMUT_OFFSET_DEG) * (Math.PI / 180);
  const elevRad = CAMARA_ELEVACION_DEG * (Math.PI / 180);

  const distancia = radio * CAMARA_MARGEN;

  const x = objetivo.x + distancia * Math.sin(azimutCamara) * Math.cos(elevRad);
  const z = objetivo.z + distancia * Math.cos(azimutCamara) * Math.cos(elevRad);
  const y = objetivo.y + distancia * Math.sin(elevRad);

  const alcanceBase = radio * CAMARA_MARGEN * 0.6;
  const esRetrato = aspecto < 1;
  const alcanceHorizontal = esRetrato ? alcanceBase : alcanceBase * aspecto;
  // 1.6 arriba / 1.0 abajo (antes 1.8/0.9, y 2.2/0.5 antes de eso): pedido
  // explícito otra vez ("pon la isla un poco más arriba") — más peso
  // relativo hacia `abajo` sube la isla dentro del encuadre (el punto de
  // mira, más o menos a la altura de la isla, queda a
  // `abajo/(arriba+abajo)` desde el borde inferior de la pantalla: antes
  // 0.9/2.7≈33%, ahora 1.0/2.6≈38%), sin perder la premisa original ("casa
  // abajo, cielo arriba" — sigue habiendo más cielo que suelo).
  const FACTOR_ARRIBA_RETRATO = 1.6;
  const FACTOR_ABAJO_RETRATO = 1.0;
  // Landscape usaba arriba=abajo (simétrico) — mismo pedido, mismo efecto:
  // más peso relativo hacia `abajo` (no hacia `arriba` — bug real de la
  // primera versión de este cambio, verificado en captura: con
  // ARRIBA=1.1/ABAJO=0.9 la isla bajaba en vez de subir, exactamente al
  // revés de lo pedido, porque es la fracción `abajo/(arriba+abajo)` la
  // que sube el punto de mira desde el borde inferior — mismo criterio ya
  // documentado para retrato) sube la isla en pantallas anchas
  // (escritorio, `casa.html` en landscape). Asimetría más discreta que en
  // retrato porque aquí no había ninguna queja previa sobre "demasiado
  // abajo", solo el ajuste de hoy.
  const FACTOR_ARRIBA_LANDSCAPE = 0.9;
  const FACTOR_ABAJO_LANDSCAPE = 1.1;
  const FACTOR_ARRIBA = esRetrato ? FACTOR_ARRIBA_RETRATO : FACTOR_ARRIBA_LANDSCAPE;
  const FACTOR_ABAJO = esRetrato ? FACTOR_ABAJO_RETRATO : FACTOR_ABAJO_LANDSCAPE;
  // Bug real (checkpoint 16, sospecha del usuario confirmada: "cuando se
  // pone en vertical la isla se achata y pierde las proporciones").
  // `alcanceVertical = alcanceBase / aspecto` asumía un frustum SIMÉTRICO
  // (arriba=abajo=alcanceVertical, span total 2×alcanceVertical) para que
  // `alcanceHorizontal/alcanceVertical` coincidiera con `aspecto` — la
  // proporción real del canvas — y así no deformar nada. Con cualquier
  // asimetría (arriba≠abajo, ahora también en landscape) el span vertical
  // real es `(FACTOR_ARRIBA+FACTOR_ABAJO)×alcanceVertical`, no
  // `2×alcanceVertical` — sin compensar, el mundo se ve "aplastado" o
  // "estirado" verticalmente. Se compensa igual en las dos orientaciones:
  // escalando `alcanceVertical` por `2/(FACTOR_ARRIBA+FACTOR_ABAJO)` para
  // que el span vertical real mantenga la proporción con
  // `alcanceHorizontal` que pide `aspecto` — verificado comparando el
  // mismo objeto redondo (la isla) hasta que dejó de verse elíptico.
  const alcanceVertical = esRetrato
    ? (2 * alcanceBase) / ((FACTOR_ARRIBA + FACTOR_ABAJO) * aspecto)
    : (2 * alcanceBase) / (FACTOR_ARRIBA + FACTOR_ABAJO);
  const arriba = alcanceVertical * FACTOR_ARRIBA;
  const abajo = alcanceVertical * FACTOR_ABAJO;

  const camara = new THREE.OrthographicCamera(
    -alcanceHorizontal,
    alcanceHorizontal,
    arriba,
    -abajo,
    0.1,
    distancia * 3,
  );
  camara.position.set(x, y, z);
  camara.lookAt(objetivo);
  return camara;
}

// Noche (checkpoint 5, pedido explícito: "si es de noche que se haga oscura
// toda la pantalla") — sin datos de "es de noche" en `sol`, se deriva de
// `sol.elevacion` (el mismo dato que ya usa factorIntensidadSol para apagar
// el sol): 0 = de día, 1 = noche cerrada, con una rampa lineal entre 0° y
// -6° (crepúsculo civil — el punto convencional en el que ya se considera
// "de noche" a efectos prácticos, no un cálculo exacto de luz percibida).
const ELEVACION_NOCHE_CERRADA = -6;
function nocturnidad(sol) {
  return Math.min(1, Math.max(0, -sol.elevacion / -ELEVACION_NOCHE_CERRADA));
}

// Colores/intensidades día↔noche. Checkpoint 9 (pedido explícito: "azul
// cielo de día, negro de noche, rojizo en amanecer/atardecer") sustituye
// el diseño anterior (crema cálido de día, morado oscuro de noche, sin
// tramo de amanecer/atardecer) por estos tres estados de verdad — la
// prioridad aquí es lo que pidió el usuario, no la lectura de CLAUDE.md
// que se venía usando hasta ahora para mantenerlo todo "cálido" incluso
// de noche.
// 0x050509 (checkpoints 5-13) tenía un deje azul frío — pedido explícito
// (checkpoint 14): "cuando oscurece sigue siendo un poco feo, hazlo más
// cálido". Morado oscuro con calidez (no azul-negro puro): sigue
// leyéndose como "noche cerrada", no como un cielo de día apagado.
const COLOR_NOCHE = 0x1c1220;
const AMBIENTAL_DIA = 0.35;
const AMBIENTAL_NOCHE = 0.14;

// Ventana de elevación solar (grados a cada lado de 0°) en la que se nota
// el tono rojizo de amanecer/atardecer — máximo justo en el horizonte,
// apagado del todo fuera de este rango. No es un valor astronómico
// (el crepúsculo civil real son -6°, ver `ELEVACION_NOCHE_CERRADA` más
// abajo), es a ojo, para que el tramo rojizo se note un rato razonable.
const VENTANA_CREPUSCULO_DEG = 9;
function factorCrepusculo(elevacion) {
  return Math.max(0, 1 - Math.abs(elevacion) / VENTANA_CREPUSCULO_DEG);
}

// Cielo con degradado (checkpoint 6/9). Textura vertical generada en
// <canvas> (mismo recurso que el resto de texturas procedurales de la
// escena — sin assets externos, coherente con "sin servidor" de
// CLAUDE.md): un degradado horizonte↔cénit se lee como cielo real de una
// forma que un THREE.Color plano no consigue, por prácticamente el mismo
// coste (una textura pequeña, generada una vez). `nubesPct` sigue
// virando el cielo hacia un gris, de día o de noche — el propio fondo ya
// cuenta parte del clima, no solo las nubes dibujadas encima.
function crearCieloGradiente(elevacion, nocturnidadActual, nubesPct) {
  // 0xbde4f7/0x4a9bd6 (checkpoints 6-14) se veía como un azul apagado —
  // pedido explícito (checkpoint 15): "el azul no me convence, más
  // vivo", teniendo en cuenta que este cielo será el FONDO de la app
  // entera cuando se integre con el dashboard, no solo un detalle de la
  // escena. Más saturación y luminosidad en ambos extremos del degradado,
  // no solo uno de los dos.
  const horizonteDia = new THREE.Color(0x8fe0fb); // celeste vivo
  const cenitDia = new THREE.Color(0x1f8fe0); // azul cielo saturado arriba
  const horizonteNoche = new THREE.Color(COLOR_NOCHE);
  // 0x000000 (checkpoints 9-13) puro negro plano en el cénit acentuaba el
  // contraste frío con el horizonte azulado — pedido explícito
  // (checkpoint 14) de que la noche en general fuera más cálida, no solo
  // el tramo nublado. Casi negro con el mismo tinte cálido que
  // COLOR_NOCHE, más oscuro que el horizonte (sigue siendo el punto más
  // oscuro del degradado).
  const cenitNoche = new THREE.Color(0x0a0710);
  // 0xd6cfc0/0x2a2735 (día/noche, primer intento del checkpoint 9) daban
  // un gris con deje morado sucio; 0xc7cdd1/0x2b323c (checkpoint 13)
  // arregló el tramo NUBLADO pero seguía siendo frío (azul-gris) en vez
  // de cálido — pedido explícito (checkpoint 14) de calidez también aquí.
  // Grises con un toque cálido (marrón/ámbar apagado), no azules ni
  // morados — sigue leyéndose como "cielo encapotado" real, no como una
  // mancha de color.
  // 0xd6cec2/0xb3a99a (checkpoints 9-21) casi sin saturación — con mucha
  // nubosidad el cielo entero se leía gris plano, no "encapotado cálido".
  // Pedido explícito (2026-08-18): "colores más vivos, se ve demasiado
  // grisáceo" — más saturados (dorado/ámbar apagado en vez de gris puro),
  // y mezclados con menos fuerza (0.6→0.45, 0.85→0.6) para que el azul
  // vivo de base siga asomando incluso con mucha nube.
  const grisHorizonte = new THREE.Color(0xdcc79a).lerp(new THREE.Color(0x352d28), nocturnidadActual);
  const grisCenit = new THREE.Color(0xac9668).lerp(new THREE.Color(0x1c1712), nocturnidadActual);

  const horizonte = horizonteDia.clone().lerp(horizonteNoche, nocturnidadActual);
  const cenit = cenitDia.clone().lerp(cenitNoche, nocturnidadActual);
  const factorNubes = Math.min(1, nubesPct / 100);
  horizonte.lerp(grisHorizonte, factorNubes * 0.45);
  cenit.lerp(grisCenit, factorNubes * 0.6);

  // Amanecer/atardecer: tiñe de rojizo, más marcado cerca del horizonte
  // que en el cénit (igual que un atardecer real) — se aplica DESPUÉS del
  // tono de nubosidad, así un atardecer nublado sigue rojizo en vez de
  // quedar tapado por el gris.
  const factorCrep = factorCrepusculo(elevacion);
  horizonte.lerp(new THREE.Color(0xd9713f), factorCrep * 0.75);
  cenit.lerp(new THREE.Color(0x8a5570), factorCrep * 0.35);

  const alto = 128;
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  const degradado = ctx.createLinearGradient(0, alto, 0, 0); // de abajo (horizonte) a arriba (cénit)
  degradado.addColorStop(0, `#${horizonte.getHexString()}`);
  degradado.addColorStop(1, `#${cenit.getHexString()}`);
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, 2, alto);

  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

// Isla flotante (checkpoint 7-8, pedido explícito). Sustituye por completo
// al suelo de hierba plano del checkpoint 6/7 (ver docs/estado.md para el
// problema que resolvía y por qué ya no hace falta): una isla es un
// objeto FINITO, así que el problema de "un plano grande con cámara
// ortográfica no deja ver el cielo" desaparece solo.
//
// Checkpoint 8: primer diseño (cono invertido, punta larga hacia abajo) se
// descartó tras verlo — pedido explícito de un "disco de tierra con
// montañitas por el borde, como para que no se pueda caer nadie", no un
// pico. Tres piezas: un disco corto (cilindro bajo, no un cono) de tierra,
// una tapa de hierba encima, y un anillo de montículos (icosaedros, mismo
// recurso que las rocas del diseño anterior pero más grandes y a lo largo
// de todo el borde) — un muro bajo de tierra alrededor, no un adorno
// puntual. Al ser mucho menos profunda que el cono original, de paso
// encoge bastante la caja englobante de la escena (ver `radio` en
// crearEscena3D) — ayuda directamente al pedido de "más zoom, la casa se
// ve pequeña".
// 0x93a663 (checkpoints 8-9) se leía apagado/pardo con la textura de
// baches y barro encima — pedido explícito de hierba más verde. Más
// saturado y algo más claro, sigue siendo un verde cálido (no un verde
// frío de césped de campo de fútbol), pero se lee como hierba de verdad
// en vez de un verde-marrón indefinido.
// Pedido explícito (2026-08-18): "haz que los colores sean más vivos, se ve
// demasiado grisáceo" — subidos de saturación (no solo de luminosidad, ese
// ajuste ya se hizo en la hierba del checkpoint 10) respecto a los valores
// anteriores (0x6fa350/0x8a6a4a), que a la luz real de la escena se leían
// apagados/terrosos en vez de vivos.
const COLOR_HIERBA = 0x5fae3c;
const COLOR_TIERRA = 0x9c6f3a;

// Textura del terreno (checkpoint 10, pedido explícito: "añade textura al
// terreno, un poco de baches y hierbas, algo de barro"). Generada una
// única vez en <canvas> (mismo recurso que el resto de texturas
// procedurales — sin assets externos): manchas de verde más claro/oscuro
// para los "baches" (variación de tono, no relieve real — cambiar la
// geometría para que tenga bultos de verdad sería mucho más trabajo para
// un efecto que, a la distancia/ángulo de esta cámara, apenas se notaría),
// un puñado de manchas de barro más grandes, y trazos cortos oscuros en
// grupos para sugerir mechones de hierba.
let texturaHierbaCache = null;
function texturaHierba() {
  if (texturaHierbaCache) return texturaHierbaCache;
  const tam = 256;
  const canvas = document.createElement('canvas');
  canvas.width = tam;
  canvas.height = tam;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${new THREE.Color(COLOR_HIERBA).getHexString()}`;
  ctx.fillRect(0, 0, tam, tam);

  // Baches: manchas irregulares de verde más claro/oscuro, sin patrón —
  // tonos más saturados que el primer intento, a juego con el verde más
  // vivo pedido para COLOR_HIERBA.
  const tonosVerdes = [0x5c9142, 0x86bb63, 0x4f7f38, 0x79ad58];
  for (let i = 0; i < 130; i += 1) {
    const r = 5 + Math.random() * 16;
    ctx.fillStyle = `#${new THREE.Color(tonosVerdes[i % tonosVerdes.length]).getHexString()}`;
    ctx.globalAlpha = 0.18 + Math.random() * 0.22;
    ctx.beginPath();
    ctx.ellipse(Math.random() * tam, Math.random() * tam, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // El barro vivía aquí como manchas de textura con contorno pintado —
  // pedido explícito de que el contorno fuera relieve 3D real, no un
  // trazo en la textura. Se quitó de aquí; ahora son objetos de verdad
  // (`construirAgujerosBarro`, más abajo).

  // Hierbas: trazos cortos oscuros en grupos pequeños (3-5 trazos por
  // "mata"), no repartidos uno a uno por todo el lienzo.
  ctx.strokeStyle = '#5f7a3d';
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.55;
  for (let mata = 0; mata < 55; mata += 1) {
    const cx = Math.random() * tam;
    const cy = Math.random() * tam;
    const brizones = 3 + Math.floor(Math.random() * 3);
    for (let b = 0; b < brizones; b += 1) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const len = 4 + Math.random() * 5;
      const ox = cx + (Math.random() - 0.5) * 6;
      const oy = cy + (Math.random() - 0.5) * 6;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(ang) * len, oy + Math.sin(ang) * len);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  const textura = new THREE.CanvasTexture(canvas);
  textura.wrapS = THREE.RepeatWrapping;
  textura.wrapT = THREE.RepeatWrapping;
  textura.repeat.set(3, 3); // se repite varias veces sobre el círculo — un único parche estirado se notaría borroso
  texturaHierbaCache = textura;
  return textura;
}

// Agujeros de barro con relieve 3D real (checkpoint 12, pedido explícito:
// "con lo del contorno de los agujeros de barro me refería a contorno
// real en 3D" — el checkpoint 11 lo resolvió pintando un trazo más
// oscuro en la textura, que no es lo que se pidió).
//
// Primer intento de esta ronda (fondo hundido POR DEBAJO de la hierba):
// no se veía nada, comprobado en captura real — la tapa de hierba es un
// disco continuo sin ningún agujero recortado de verdad, así que un
// disco de barro colocado por debajo de ella queda tapado del todo, sin
// aportar nada visible. Rehecho con la técnica contraria: un LABIO
// levantado (el toro, bien por encima de la hierba) que proyecta sombra
// real sobre un disco de barro a ras de la hierba (no oculto) — el
// relieve se lee por la altura del labio y su sombra, no por una
// cavidad recortada de verdad (eso pediría geometría bastante más
// compleja para el mismo efecto visto desde esta cámara).
// 0.22-0.42 de radio (primer intento de esta ronda) salían enormes para
// lo que en realidad son — pedido explícito: "son toperas en realidad"
// (montículos de tierra de topo, pequeños). Bajado bastante.
const COLOR_BARRO = 0x4a3626;
const COLOR_BARRO_BORDE = 0x3a2c1c;
const NUM_AGUJEROS_BARRO = 6;
const RADIO_AGUJERO_MIN = 0.09;
const RADIO_AGUJERO_MAX = 0.16;

// ¿Cae `(cx, cz)` dentro de la CAJA ENGLOBANTE (rotada) de la huella de la
// casa, con un margen? Proyecta el punto sobre los ejes propios de la casa
// (`geo.ejeLateral`/`geo.ejeProfundidad`, no los ejes de mundo — la casa
// está rotada al azimut real de `plano.orientacionCasa`) y compara con
// medio ancho/medio profundo de esa caja (Fase 3: `geo.anchoLateral`/
// `geo.profundidad` ya no son los de una única habitación rectangular,
// sino los de la caja que envuelve la huella real, sea cual sea su forma
// — esta comprobación pasa a ser conservadora, no exacta, para una huella
// no rectangular). Se usa para que las toperas no puedan salir DENTRO de
// la casa (pedido explícito, bug real visto en captura).
function dentroDeLaHabitacion(cx, cz, geo, margen) {
  const proyLateral = cx * geo.ejeLateral.x + cz * geo.ejeLateral.z;
  const proyProfundidad = cx * geo.ejeProfundidad.x + cz * geo.ejeProfundidad.z;
  return Math.abs(proyLateral) < geo.anchoLateral / 2 + margen && Math.abs(proyProfundidad) < geo.profundidad / 2 + margen;
}

function construirAgujerosBarro(radioIsla, geo) {
  const grupo = new THREE.Group();
  const materialBarro = new THREE.MeshStandardMaterial({ color: COLOR_BARRO, roughness: 1 });
  const materialBorde = new THREE.MeshStandardMaterial({ color: COLOR_BARRO_BORDE, roughness: 0.9 });
  for (let i = 0; i < NUM_AGUJEROS_BARRO; i += 1) {
    // Reintentar sorteando una posición nueva hasta que caiga fuera de la
    // habitación — tope de intentos por si algún día `radioIsla` fuera
    // tan pequeño que no quepa ninguna fuera (no debería pasar con los
    // tamaños reales del proyecto, pero evita un bucle infinito).
    let angulo;
    let distancia;
    let cx;
    let cz;
    let intentos = 0;
    do {
      angulo = Math.random() * Math.PI * 2;
      distancia = Math.sqrt(Math.random()) * radioIsla * 0.8;
      cx = Math.cos(angulo) * distancia;
      cz = Math.sin(angulo) * distancia;
      intentos += 1;
    } while (dentroDeLaHabitacion(cx, cz, geo, 0.5) && intentos < 30);

    const radioAgujero = RADIO_AGUJERO_MIN + Math.random() * (RADIO_AGUJERO_MAX - RADIO_AGUJERO_MIN);

    const fondo = new THREE.Mesh(new THREE.CircleGeometry(radioAgujero, 16), materialBarro);
    fondo.rotation.x = -Math.PI / 2;
    fondo.position.set(cx, -0.008, cz); // a ras de la hierba (-0.015), visible — NO por debajo
    fondo.receiveShadow = true;
    grupo.add(fondo);

    // Tubo del toro más grueso (0.16→0.3 del radio) y bien levantado
    // sobre la hierba (antes casi a ras, -0.01 — apenas asomaba y no
    // proyectaba sombra que se notase) — necesita altura de verdad para
    // que su sombra caiga sobre el disco de barro y se lea como relieve.
    const alturaLabio = radioAgujero * 0.22;
    const borde = new THREE.Mesh(new THREE.TorusGeometry(radioAgujero * 0.92, radioAgujero * 0.3, 8, 20), materialBorde);
    borde.rotation.x = Math.PI / 2;
    borde.position.set(cx, alturaLabio, cz);
    borde.castShadow = true;
    borde.receiveShadow = true;
    grupo.add(borde);
  }
  return grupo;
}

function construirIsla(radioIsla, radioHabitacion, nocturnidadActual, geo) {
  const grupo = new THREE.Group();
  // emissive tenue en toda la tierra (disco + montículos), no solo donde
  // hacía falta en el cono: comprobado en captura real que con el sol alto
  // (cerca del cénit) las superficies de tierra más inclinadas (el borde
  // del disco, los montículos) quedan casi de canto a la luz directa y,
  // con solo la ambiental (0.35), se veían casi negras — no es
  // photorealista pero tampoco hace falta serlo aquí (CLAUDE.md, "cálido y
  // hogareño"). Atenuado por `nocturnidadActual` para que no "brille" de
  // más de noche, cuando el resto de la escena ya está oscurecida.
  const materialTierra = new THREE.MeshStandardMaterial({
    color: COLOR_TIERRA,
    roughness: 1,
    emissive: new THREE.Color(COLOR_TIERRA),
    emissiveIntensity: 0.18 * (1 - nocturnidadActual * 0.75),
  });

  const grosorDisco = radioHabitacion * 0.4;
  const disco = new THREE.Mesh(
    new THREE.CylinderGeometry(radioIsla, radioIsla * 0.88, grosorDisco, 32),
    materialTierra,
  );
  // La cara superior del cilindro (CylinderGeometry SÍ tiene tapas propias
  // por defecto, a diferencia del cono `openEnded` del diseño anterior)
  // queda un poco por debajo de y=0 a propósito — si no, tapaba del todo
  // a la hierba de encima (comprobado en captura real: no se veía nada
  // verde, solo tierra).
  disco.position.y = -grosorDisco / 2 - 0.03;
  // receiveShadow:false — mismo motivo que en el diseño del cono: nada de
  // la escena proyecta sombra sobre la tierra en realidad (cuelga en el
  // aire; solo la tapa de hierba y la habitación reciben sombra de
  // verdad), y en los bordes más inclinados el ángulo rasante al sol daba
  // "shadow acne" (autosombra por precisión de la shadow map).
  disco.receiveShadow = false;
  grupo.add(disco);

  const geometriaTapa = new THREE.CircleGeometry(radioIsla, 32);
  geometriaTapa.rotateX(-Math.PI / 2);
  // color:0xffffff — con la textura ya llevando el tono verde real
  // (derivado de COLOR_HIERBA al generarla), un color de material no
  // blanco multiplicaría sobre ella y la oscurecería/tintaría de más.
  const materialHierba = new THREE.MeshStandardMaterial({ color: 0xffffff, map: texturaHierba(), roughness: 1 });
  const tapa = new THREE.Mesh(geometriaTapa, materialHierba);
  tapa.position.y = -0.015; // justo debajo del suelo real (evita z-fighting) y por encima del disco de tierra
  tapa.receiveShadow = true;
  grupo.add(tapa);

  // Montículos del borde: un anillo completo (no unos pocos sueltos como
  // las rocas del diseño anterior) — "como para que no se pueda caer
  // nadie" implica un borde continuo, no decoración puntual. Tamaño y
  // posición angular con jitter pequeño y fijo (mismo criterio que las
  // anclas de nube: variedad sin aleatoriedad completa) para que no se
  // vean todos idénticos y equiespaciados de forma robótica.
  // 0.11-0.16 (primer intento) salía desproporcionado — los montículos
  // tapaban casi toda la hierba y parecían más grandes que la propia
  // casa; 0.045-0.065 (segundo intento, achatados) se quedó demasiado
  // discreto — pedido explícito de piedras más puntiagudas y alargadas,
  // en mayor cantidad, "como una especie de muro". Escala ya no achata en
  // Y (antes más ancho que alto): ahora es más alto que ancho, para que
  // apunten hacia arriba. Más cantidad (26, antes 16) y radio de anillo
  // más ceñido para que se toquen/solapen un poco entre sí, leyéndose
  // como un muro continuo en vez de piedras sueltas separadas.
  //
  // `materialMonticulo` aparte de `materialTierra` (no reutilizado):
  // `flatShading:true` es justo lo que faltaba para que se lean como
  // rocas puntiagudas de verdad — sin él (comprobado en captura real),
  // Three.js suaviza los vértices compartidos entre caras y el
  // icosaedro alargado se ve como una gota/bala roma, no como una
  // piedra partida. Aplicarlo también al disco de tierra (que comparte
  // `materialTierra`) habría facetado su superficie cilíndrica lisa sin
  // necesidad, así que es un material propio, no el mismo compartido.
  const materialMonticulo = new THREE.MeshStandardMaterial({
    color: COLOR_TIERRA,
    roughness: 1,
    flatShading: true,
    emissive: new THREE.Color(COLOR_TIERRA),
    emissiveIntensity: 0.18 * (1 - nocturnidadActual * 0.75),
  });
  // 26→46 (checkpoints 10-11) seguía dejando huecos — pedido explícito
  // otra vez ("aún hay algunos huecos"). Subido más (62) y con el radio
  // horizontal de cada piedra también mayor.
  //
  // Altura: antes ligada al mismo `radioIsla` que el ancho (escala
  // vertical = escala horizontal × 2.2) — al crecer `radioIsla` con la
  // isla más grande (checkpoint 11), las piedras crecieron TAMBIÉN en
  // altura sin querer, hasta rebasar la altura de la propia casa (pedido
  // explícito: "que ninguna sea más alta que la casa"). Ahora la altura
  // se deriva de `geo.altura` (la altura real de la habitación), no de
  // `radioIsla` — el ancho de cada piedra sigue ligado al radio de la
  // isla (para que se solapen bien sea cual sea el tamaño de la isla),
  // pero la altura tiene su propio tope independiente.
  const alturaMonticuloMax = geo.altura * 0.55; // claramente por debajo del tejado, no rozándolo
  // 62 (checkpoint 12) seguía dejando huecos puntuales (pedido explícito,
  // checkpoint 14) — cada piedra tiene una rotación distinta
  // (rotation.y = angulo*3.7) sobre una geometría facetada e irregular
  // (IcosahedronGeometry de baja subdivisión), así que su ancho real en
  // la dirección tangencial varía bastante piedra a piedra; con el
  // espaciado angular de 62 piedras, las más "estrechas" de canto no
  // llegaban a tocar a sus vecinas. Subido a 90 (más espaciado angular
  // pequeño) y el rango de anchura también un poco mayor, para que
  // incluso la piedra más desfavorablemente rotada siga solapando con
  // las de al lado.
  const numMonticulos = 90;
  for (let i = 0; i < numMonticulos; i += 1) {
    const angulo = (i / numMonticulos) * Math.PI * 2 + (Math.sin(i * 2.3) * 0.5 * Math.PI) / numMonticulos;
    const escalaHorizontal = radioIsla * (0.09 + 0.035 * ((i % 3) / 2));
    const alturaMonticulo = alturaMonticuloMax * (0.5 + 0.5 * ((i % 4) / 3));
    // detail=0 (pocas caras grandes) en vez de 1 — con flatShading, menos
    // caras más grandes se lee más como "roca partida en pocos planos"
    // que como una superficie facetada fina, casi como una mora.
    const monticulo = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), materialMonticulo);
    // IcosahedronGeometry(1,0) mide 2 de alto (radio 1) antes de escalar
    // — de ahí el /2 para que `alturaMonticulo` sea la altura real, no el
    // doble.
    monticulo.scale.set(escalaHorizontal * 0.85, alturaMonticulo / 2, escalaHorizontal * 0.85);
    monticulo.rotation.y = angulo * 3.7; // orientación distinta por piedra, para que no se vean todas "iguales pero giradas en anillo"
    // 0.9 (antes) dejaba un anillo de hierba visible más allá de las
    // piedras — pedido explícito: "que la isla acabe con ellas", sin
    // hierba después. Al radio exacto del disco de hierba/tierra
    // (`radioIsla`) — el propio ancho de cada piedra (que se extiende
    // hacia fuera desde su centro) ya sobresale un poco más allá del
    // borde del disco, tapándolo del todo.
    const r = radioIsla;
    monticulo.position.set(Math.cos(angulo) * r, -0.02 + alturaMonticulo * 0.32, Math.sin(angulo) * r);
    monticulo.castShadow = true;
    monticulo.receiveShadow = true;
    grupo.add(monticulo);
  }

  grupo.add(construirAgujerosBarro(radioIsla, geo));

  return grupo;
}

// Filamentos de tierra en la hierba (checkpoint 11, pedido explícito: "si
// no es demasiado... que se muevan con la velocidad del aire"). Un puñado
// de brizones finos (no un césped completo — "si no es demasiado" pedía
// contención), color tierra (no verde — se pidieron como algo distinto de
// la hierba, no más hierba), que se balancean según `viento.velocidad`.
// Cada uno es un `THREE.Group` (pivote) con la barrita desplazada hacia
// arriba dentro de él — mismo truco que el tronco del árbol/el poste del
// buzón para que la rotación de balanceo gire desde la base, no desde el
// centro de la barrita.
const COLOR_FILAMENTO = 0x9c6f3a; // mismo tono que COLOR_TIERRA (más vivo, 2026-08-18) — valor propio, no importado, para no acoplar este bloque al de la isla
const NUM_FILAMENTOS = 45;

// `geo` + reintento (checkpoint 14, mismo bug/mismo arreglo que las
// toperas: podían salir dentro de la casa, sin ningún chequeo antes) —
// mismo patrón `dentroDeLaHabitacion` + `do...while` con tope de
// intentos ya usado en construirAgujerosBarro.
function construirFilamentos(radioIsla, geo) {
  const grupo = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: COLOR_FILAMENTO, roughness: 0.9 });
  for (let i = 0; i < NUM_FILAMENTOS; i += 1) {
    let angulo;
    let distancia;
    let cx;
    let cz;
    let intentos = 0;
    do {
      angulo = Math.random() * Math.PI * 2;
      // sqrt(Math.random()) para que la distancia salga repartida de
      // forma uniforme por ÁREA — sin la raíz, se amontonarían cerca del
      // centro (un ángulo+radio uniformes sin más concentra puntos hacia
      // dentro).
      distancia = Math.sqrt(Math.random()) * radioIsla * 0.92;
      cx = Math.cos(angulo) * distancia;
      cz = Math.sin(angulo) * distancia;
      intentos += 1;
    } while (dentroDeLaHabitacion(cx, cz, geo, 0.3) && intentos < 30);
    const alturaFilamento = 0.12 + Math.random() * 0.1;

    const pivote = new THREE.Group();
    pivote.position.set(cx, 0, cz);
    const brizna = new THREE.Mesh(new THREE.BoxGeometry(0.012, alturaFilamento, 0.012), material);
    brizna.position.y = alturaFilamento / 2;
    brizna.castShadow = true;
    pivote.add(brizna);
    pivote.userData.fase = Math.random() * Math.PI * 2;
    grupo.add(pivote);
  }
  return grupo;
}

// Avanza el balanceo de cada filamento — llamada desde el bucle de
// animación. Sin viento (o `viento` null) sigue habiendo un balanceo
// mínimo (no completamente inmóvil, se leería como "congelado" en una
// escena que ya anima todo lo demás) pero apenas perceptible; con viento
// fuerte, notable — y siempre en la dirección real del viento (todos los
// filamentos se inclinan hacia el mismo lado a la vez, como hierba de
// verdad, no cada uno para su lado).
function animarFilamentos(grupoFilamentos, tiempo, viento) {
  const velocidadViento = viento?.velocidad ?? 0;
  const intensidad = Math.min(1, velocidadViento / 30);
  const amplitud = 0.02 + intensidad * 0.3;
  const frecuencia = 1 + intensidad * 2.2;
  const dir = viento ? direccionVientoXZ(viento.direccion) : { x: 1, z: 0 };
  grupoFilamentos.children.forEach((pivote) => {
    const s = Math.sin(tiempo * frecuencia + pivote.userData.fase) * amplitud;
    pivote.rotation.x = -dir.z * s;
    pivote.rotation.z = dir.x * s;
  });
}

// Farolillo colgante — cuerda fina + cajita de "cristal" emissive cálido
// + `PointLight` (checkpoint 18: el del árbol; checkpoint 22, pedido
// explícito: "pon un poste como en forma de horca del que cuelgue otro
// farolillo como el del árbol" — la farola de la casa pasó a colgar
// exactamente este mismo diseño en vez de mantener uno propio por
// separado). `COLOR_LUZ_FAROLA` se define más abajo, en el bloque de la
// farola — el resto de este archivo ya asume que las funciones no se
// ejecutan hasta que el módulo entero ha terminado de evaluarse (mismo
// criterio que `UMBRAL_NUBES_FAROLA` usado en `construirArbol`).
//
// `conSombra`/`alcanceSombra` son opcionales: el farolillo del árbol es
// decorativo, sin sombra propia (la copa está pegada justo encima —
// mismo riesgo de autosombra que ya costó una ronda de bugs en la
// farola); el de la farola sí necesita ser una fuente de luz real, con
// sombra, ya que sustituye por completo al foco que antes llevaba.
function construirFarolilloColgante(puntoX, puntoY, puntoZ, factorEncendida, opciones = {}) {
  const {
    alturaCuerda = 0.3,
    tamañoFarolillo = 0.13,
    intensidadLuz = 5,
    conSombra = false,
    alcanceSombra = 5,
  } = opciones;

  const grupo = new THREE.Group();
  const cuerda = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, alturaCuerda, 6),
    new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 0.8 }),
  );
  cuerda.position.set(puntoX, puntoY - alturaCuerda / 2, puntoZ);
  grupo.add(cuerda);

  const farolilloY = puntoY - alturaCuerda;
  const farolillo = new THREE.Mesh(
    new THREE.BoxGeometry(tamañoFarolillo, tamañoFarolillo, tamañoFarolillo),
    new THREE.MeshStandardMaterial({
      color: COLOR_LUZ_FAROLA,
      emissive: new THREE.Color(COLOR_LUZ_FAROLA),
      emissiveIntensity: 0.15 + 1.3 * factorEncendida,
      roughness: 0.4,
    }),
  );
  farolillo.position.set(puntoX, farolilloY, puntoZ);
  grupo.add(farolillo);

  const luz = new THREE.PointLight(COLOR_LUZ_FAROLA, intensidadLuz * factorEncendida, 0, 2);
  luz.position.set(puntoX, farolilloY, puntoZ);
  if (conSombra) {
    luz.castShadow = true;
    luz.shadow.mapSize.set(1024, 1024);
    luz.shadow.bias = -0.001;
    luz.shadow.camera.near = 0.1;
    luz.shadow.camera.far = alcanceSombra;
  }
  grupo.add(luz);

  return grupo;
}

// Árbol (checkpoint 7-8, de la lista de detalles opcionales —
// "minimalista"): tronco (cilindro) + copa. Checkpoint 8, dos cambios
// pedidos explícitos:
//   - Posición: "detrás de la casa" (checkpoint 7, usando −dirCamaraXZ) se
//     descartó — se pidió que NO esté detrás. Se mueve al LADO de la
//     cámara (`perp`, perpendicular a `dirCamaraXZ` — mismo vector que ya
//     usa el viento para el ancho de su corriente), donde queda claramente
//     visible en vez de escondido tras la habitación.
//   - Copa: antes una única esfera ("un simple círculo" visto desde
//     cámara). Ahora un racimo de 3 esferas de tamaño/posición distintos
//     (mismo recurso que los puffs de nube: varias formas simples
//     solapadas en vez de una figura más compleja) — un contorno
//     irregular en vez de una bola perfecta, sin modelar hojas de verdad.
const COLOR_TRONCO = 0x8a5f34; // más vivo (2026-08-18), a juego con COLOR_TIERRA/COLOR_SUELO
const COLOR_COPA = 0x62a83e; // más vivo (2026-08-18), a juego con COLOR_HIERBA sin ser idéntico
const PATRON_COPA = [
  { x: 0, y: 0, escala: 1 },
  { x: -0.55, y: -0.1, escala: 0.72 },
  { x: 0.5, y: 0.15, escala: 0.68 },
];
function construirArbol(geo, radioIsla, dirCamaraXZ, nocturnidadActual, nubesPct) {
  const grupo = new THREE.Group();
  const alturaTronco = geo.altura * 0.85;
  const radioTronco = 0.09;

  const tronco = new THREE.Mesh(
    new THREE.CylinderGeometry(radioTronco, radioTronco * 1.3, alturaTronco, 8),
    new THREE.MeshStandardMaterial({ color: COLOR_TRONCO, roughness: 0.9 }),
  );
  tronco.position.y = alturaTronco / 2;
  tronco.castShadow = true;
  grupo.add(tronco);

  const materialCopa = new THREE.MeshStandardMaterial({ color: COLOR_COPA, roughness: 0.95 });
  const radioCopaBase = 0.8;
  PATRON_COPA.forEach(({ x, y, escala }) => {
    const radioBola = radioCopaBase * escala;
    const bola = new THREE.Mesh(new THREE.SphereGeometry(radioBola, 10, 8), materialCopa);
    bola.position.set(radioCopaBase * x, alturaTronco + radioCopaBase * 0.7 + radioCopaBase * y, 0);
    bola.castShadow = true;
    grupo.add(bola);
  });

  // Al lado de la cámara (perpendicular a dirCamaraXZ, mismo vector que ya
  // usa el viento) en vez de detrás — pegado hacia el borde de la tapa de
  // hierba, sin salirse del radio de la isla ni pisar la huella de la
  // habitación.
  //
  // Bug real (confirmado en captura: el árbol quedaba DENTRO de la casa):
  // `anchoLateral/2` es la mitad del ANCHO de la habitación, medida a lo
  // largo del propio eje lateral de la habitación — pero `perp` no es ese
  // eje, es perpendicular a la cámara, que está desplazada 45° respecto a
  // la orientación real del piso (checkpoint 1). Alejarse en una
  // dirección en diagonal respecto al rectángulo de la habitación y
  // comparar esa distancia solo con la mitad del ancho no basta para
  // salir fuera — hace falta la mitad de la DIAGONAL (`Math.hypot`) para
  // que valga sea cual sea el ángulo real entre `perp` y los ejes de la
  // habitación.
  const perp = { x: -dirCamaraXZ.z, z: dirCamaraXZ.x };
  const distancia = Math.min(Math.hypot(geo.anchoLateral, geo.profundidad) / 2 + 1.3, radioIsla * 0.78);
  grupo.position.set(perp.x * distancia, 0, perp.z * distancia);

  // Farolillo colgado del árbol (checkpoint 18, pedido explícito: "me
  // gusta lo del farolillo colgado del árbol"). Una cuerda fina + una
  // cajita cálida colgando de dentro de la copa, no una farola en
  // miniatura — sin varillas propias (serían demasiado pequeñas para
  // notarse) y sin `castShadow` en la propia cajita ni sombra de su
  // `PointLight` (decorativa y barata: la copa está pegada justo
  // encima, mismo riesgo de autosombra que ya costó una ronda de bugs
  // en la farola de la casa, y aquí no aporta nada verlo).
  // `factorEncendida` reutiliza el mismo criterio y los mismos umbrales
  // que la farola (`UMBRAL_NUBES_FAROLA`/`RAMPA_NUBES_FAROLA`, definidos
  // más abajo en el archivo pero ya inicializados cuando esta función se
  // ejecuta de verdad — evaluación de módulo completa antes de llamar a
  // ninguna función exportada) — las dos luces cálidas de la escena se
  // encienden juntas, no cada una con su propio criterio.
  const factorNubesArbol = Math.max(0, Math.min(1, (nubesPct - UMBRAL_NUBES_FAROLA) / RAMPA_NUBES_FAROLA));
  const factorEncendida = Math.max(nocturnidadActual, factorNubesArbol);

  // Bug real (confirmado en captura): con el punto de enganche DENTRO
  // del volumen de la copa (`alturaTronco + radioCopaBase*0.55`, misma
  // zona donde viven las 3 bolas del follaje), el farolillo quedaba
  // literalmente enterrado dentro del propio follaje opaco — invisible,
  // aunque la geometría estuviera ahí. La bola principal (`PATRON_COPA`
  // primer punto, escala 1) es la más baja de las tres: su punto más
  // bajo real es `alturaTronco + radioCopaBase*0.7 - radioCopaBase*1`
  // = `alturaTronco - radioCopaBase*0.3`. El farolillo tiene que colgar
  // claramente POR DEBAJO de eso, no solo desplazado a un lado (un
  // desplazamiento lateral pequeño seguía cayendo dentro del radio de
  // la bola a esa altura).
  const puntoCuelgueX = radioCopaBase * 0.25;
  const puntoCuelgueZ = radioCopaBase * 0.15;
  const puntoCuelgueY = alturaTronco - radioCopaBase * 0.2; // justo bajo el punto más bajo real de la copa
  grupo.add(
    construirFarolilloColgante(puntoCuelgueX, puntoCuelgueY, puntoCuelgueZ, factorEncendida, {
      alturaCuerda: radioCopaBase * 0.7,
      tamañoFarolillo: 0.13,
      intensidadLuz: 5,
    }),
  );

  return grupo;
}

// Pino grande y alto detrás de la casa (2026-08-19, pedido explícito: "pon
// un pino muy grande y alto en la isla en la parte de detras de la casa").
// A diferencia de construirArbol (que se movió AL LADO de la cámara en el
// checkpoint 8, precisamente porque "detrás" quedaba escondido tras la
// habitación) — aquí "detrás" es justo lo pedido: un pino mucho más alto
// que el árbol normal, que sobresale bien por encima del tejado y se
// recorta contra el cielo desde la cámara fija aunque quede parcialmente
// tapado por la casa en primer plano. Tronco + niveles de copa apilados
// (THREE.ConeGeometry, silueta cónica clásica de pino), no el racimo de
// esferas de construirArbol — un pino no se lee como una bola de fronda.
const COLOR_TRONCO_PINO = 0x6b4a30;
const COLOR_COPA_PINO = 0x2f5c33;
// Posición vertical (fracción de la altura de la copa) y radio relativo
// de cada nivel, de abajo a arriba — más ancho en la base, más estrecho
// hacia arriba. Pedido explícito tras ver el primer resultado ("el pino
// es demasiado puntiagudo"): radios más altos en cada nivel (menos
// ahusado). Solo 4 niveles, todos cono — el remate ya no es un 5º nivel
// cónico (ver más abajo: una esfera achatada, nunca un cono, porque
// CUALQUIER cono por corto que sea sigue terminando en un vértice
// matemático perfecto, y eso es justo lo que se leía como "puntiagudo"
// por mucho que se abriera el ángulo).
const NIVELES_PINO = [
  { y: 0.0, radio: 1.0 },
  { y: 0.3, radio: 0.84 },
  { y: 0.58, radio: 0.66 },
  { y: 0.82, radio: 0.48 },
];
function construirPino(geo, radioIsla, dirCamaraXZ) {
  const grupo = new THREE.Group();

  // "Muy grande y alto" — bastante más que construirArbol (tronco
  // geo.altura*0.85 + copa de ~1.4 de radio), para que sobresalga con
  // claridad por encima del tejado visto desde la cámara.
  const alturaPino = geo.altura * 4.2;
  const alturaTronco = alturaPino * 0.32;
  const alturaCopa = alturaPino - alturaTronco;
  const radioCopaBase = alturaPino * 0.16;
  const radioTronco = alturaPino * 0.02;

  const tronco = new THREE.Mesh(
    new THREE.CylinderGeometry(radioTronco * 0.6, radioTronco, alturaTronco, 8),
    new THREE.MeshStandardMaterial({ color: COLOR_TRONCO_PINO, roughness: 0.9 }),
  );
  tronco.position.y = alturaTronco / 2;
  tronco.castShadow = true;
  grupo.add(tronco);

  const materialCopa = new THREE.MeshStandardMaterial({ color: COLOR_COPA_PINO, roughness: 0.95 });
  const alturaNivel = alturaCopa * 0.32; // cada cono es más alto que el hueco hasta el siguiente, para que se solapen sin dejar huecos
  let apiceConoY = 0;
  NIVELES_PINO.forEach(({ y, radio }, i) => {
    const esUltimo = i === NIVELES_PINO.length - 1;
    // Bug real (encontrado en captura): dar a TODOS los niveles la misma
    // altura (alturaNivel*1.7) hacía que el último, arrancando ya muy
    // arriba (y=0.82), sobresaliera mucho más allá de la copa nominal
    // (apice en 1.36×alturaCopa) — más puntiagudo que antes de este
    // cambio, no menos. El último nivel usa el hueco que queda de verdad
    // hasta la copa (`alturaCopa*(1-y)`), no el mismo alto que el resto.
    const alturaCono = esUltimo ? alturaCopa * (1 - y) * 0.95 : alturaNivel * 1.7;
    const baseY = alturaTronco + alturaCopa * y;
    const cono = new THREE.Mesh(new THREE.ConeGeometry(radioCopaBase * radio, alturaCono, 9), materialCopa);
    cono.position.y = baseY + alturaCono / 2;
    cono.castShadow = true;
    grupo.add(cono);
    if (esUltimo) apiceConoY = baseY + alturaCono;
  });

  // Remate: una esfera achatada, NUNCA un cono (pedido explícito: "el
  // pino es demasiado puntiagudo") — se hunde parcialmente en la punta
  // del último cono para redondearla del todo, en vez de dejar un
  // vértice agudo visible.
  const radioRemate = radioCopaBase * NIVELES_PINO[NIVELES_PINO.length - 1].radio * 0.55;
  const remate = new THREE.Mesh(new THREE.SphereGeometry(radioRemate, 10, 8), materialCopa);
  remate.scale.y = 0.8;
  remate.position.y = apiceConoY - radioRemate * 0.5;
  remate.castShadow = true;
  grupo.add(remate);

  // Detrás de la casa: dirección CONTRARIA a la cámara (-dirCamaraXZ), el
  // lado que la cámara isométrica fija no ve de frente. Misma lección que
  // ya costó un bug real en el árbol/las toperas (checkpoints 9/13): para
  // salir fuera de la huella real de la casa hace falta compararse con la
  // mitad de la DIAGONAL de la caja englobante (Math.hypot), no con la
  // mitad de un solo lado — `-dirCamaraXZ` no coincide con los ejes reales
  // de la habitación salvo que la casa esté alineada con la cámara.
  const distancia = Math.min(
    Math.hypot(geo.anchoLateral, geo.profundidad) / 2 + radioCopaBase + 0.6,
    radioIsla * 0.85,
  );
  grupo.position.set(-dirCamaraXZ.x * distancia, 0, -dirCamaraXZ.z * distancia);

  return grupo;
}

// Buzón simple junto a la casa (checkpoint 8, pedido explícito: "un palo
// en el suelo, una caja de metal con una pieza roja en forma de L").
// Cuatro piezas, todo THREE.BoxGeometry salvo el poste — nada de textura
// ni bisagra real.
const COLOR_POSTE = 0x6b5842;
const COLOR_BUZON_METAL = 0x8a9099;
const COLOR_BANDERA = 0xb53a2e;
// 1 (tamaño real) se leía diminuto → 1.8 (checkpoint 10) se pasó de
// grande en la dirección contraria, pedido explícito otra vez. Punto
// intermedio.
const ESCALA_BUZON = 1.2;
function construirBuzon(geo, dirCamaraXZ) {
  const grupo = new THREE.Group();
  const alturaPoste = 0.85;

  const poste = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, alturaPoste, 8),
    new THREE.MeshStandardMaterial({ color: COLOR_POSTE, roughness: 0.85 }),
  );
  poste.position.y = alturaPoste / 2;
  poste.castShadow = true;
  grupo.add(poste);

  const materialMetal = new THREE.MeshStandardMaterial({ color: COLOR_BUZON_METAL, roughness: 0.5, metalness: 0.4 });
  const caja = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.2), materialMetal);
  caja.position.set(0.08, alturaPoste + 0.11, 0);
  caja.castShadow = true;
  grupo.add(caja);

  // Bandera en L: una pieza vertical corta + una horizontal, pegadas al
  // lateral de la caja — la "L" clásica de bandera de buzón americano.
  const materialBandera = new THREE.MeshStandardMaterial({ color: COLOR_BANDERA, roughness: 0.6 });
  const banderaVertical = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.03), materialBandera);
  banderaVertical.position.set(-0.11, alturaPoste + 0.24, 0.11);
  banderaVertical.castShadow = true;
  grupo.add(banderaVertical);
  const banderaHorizontal = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.03), materialBandera);
  banderaHorizontal.position.set(-0.04, alturaPoste + 0.3, 0.11);
  banderaHorizontal.castShadow = true;
  grupo.add(banderaHorizontal);

  grupo.scale.setScalar(ESCALA_BUZON);

  // En una de las 4 esquinas de la CAJA ENGLOBANTE de la casa (pedido
  // explícito), no en una posición relativa a la cámara como el primer
  // intento (que solucionaba "detrás de la pared" pero no era ninguna
  // esquina en concreto). Desde la Fase 3 la huella real ya no es
  // necesariamente un rectángulo (`geo.esquinasSuelo` es un quad POR
  // CELDA), así que se usa `geo.esquinasCaja` — las 4 esquinas del
  // rectángulo que envuelve la huella entera, mismo papel que tenían las
  // esquinas reales en la Fase 6.
  //
  // La esquina se elige por PROYECCIÓN sobre `dirCamaraXZ` (2026-08-19,
  // pedido explícito: "mueve el buzón a la esquina de la casa más cercana
  // a la cámara") — `dirCamaraXZ` apunta desde el centro de la escena
  // HACIA la cámara (misma definición que ya usa `signoHaciaCamara`), así
  // que la esquina con mayor producto escalar contra ese vector es la que
  // queda más adelantada hacia la cámara, no la más lejana. Antes era un
  // índice fijo (0), sin relación con la cámara.
  const esquina = geo.esquinasCaja.reduce((mejor, e) =>
    e.x * dirCamaraXZ.x + e.z * dirCamaraXZ.z > mejor.x * dirCamaraXZ.x + mejor.z * dirCamaraXZ.z ? e : mejor,
  );
  const magEsquina = Math.hypot(esquina.x, esquina.z);
  const nx = esquina.x / magEsquina;
  const nz = esquina.z / magEsquina;
  const margenFuera = 0.9;
  grupo.position.set(esquina.x + nx * margenFuera, 0, esquina.z + nz * margenFuera);
  return grupo;
}

// Farola (checkpoints 14-22, ver docs/estado.md para el historial
// completo — este bloque sustituye TODOS los diseños anteriores).
// Checkpoint 23, pedido explícito: "lo de la madera del farolillo no
// has pillado lo que yo buscaba. me refería a algo más pequeño, con
// tablas planas. que sea una vertical, otra horizontal, y otra que
// sirva para sujetar la horizontal con la vertical, en un triángulo. de
// la horizontal, en el borde, cuelga el farolillo. pero es pequeño,
// como el del árbol. y los postes de madera también son más pequeños
// que el que has hecho". Diseño nuevo: tres TABLAS PLANAS de madera
// (`BoxGeometry`, no cilindros de metal) formando una escuadra en
// triángulo — vertical + horizontal + diagonal de refuerzo, como un
// soporte de cartel de jardín — con el mismo `construirFarolilloColgante`
// del árbol colgando del borde de la tabla horizontal. Tamaño fijo,
// pequeño, sin escalar con la altura de la casa (a diferencia de los
// diseños "cobra"/"vintage" anteriores, que sí lo hacían y salían
// demasiado grandes) — el mismo criterio de tamaño fijo que ya usa el
// buzón para sus propias piezas.
const COLOR_LUZ_FAROLA = 0xffbe83; // cálida, tono farola de sodio suave

// Umbral de nubosidad a partir del cual la farola también se enciende de
// día (checkpoint 15, pedido explícito: "que la farola se encienda
// cuando haya más de un 75% de nubes") — rampa corta (75%→85%) en vez de
// un interruptor brusco, mismo criterio que ya usa factorCrepusculo() para
// suavizar transiciones.
const UMBRAL_NUBES_FAROLA = 75;
const RAMPA_NUBES_FAROLA = 10;

function construirFarola(geo, dirCamaraXZ, nocturnidadActual, nubesPct) {
  // Encendida de noche O con cielo muy nublado — el máximo de las dos
  // rampas, no una suma (a mediodía con 90% de nubes no debería sumar
  // más que "encendida del todo", igual que de noche con cielo despejado).
  const factorNubesFarola = Math.max(0, Math.min(1, (nubesPct - UMBRAL_NUBES_FAROLA) / RAMPA_NUBES_FAROLA));
  const factorEncendida = Math.max(nocturnidadActual, factorNubesFarola);

  // Esquina de la casa, simétrica al árbol (checkpoint 23, pedido
  // explícito: "muévelo... a la esquina derecha de la casa,
  // simétricamente al árbol" — reemplaza por completo el intento
  // anterior, centrado en la ventana con un desplazamiento lateral a
  // ojo, que dejaba la farola parcialmente tapada por la propia casa).
  // Misma técnica que ya usa `construirArbol` para su propia posición:
  // `perp` (perpendicular a la cámara) es el eje a lo largo del cual el
  // árbol se coloca en un lado; la esquina "simétrica" es la de
  // `geo.esquinasCaja` (las 4 esquinas de la caja englobante de la huella,
  // ver construirBuzon) cuya proyección sobre ESE MISMO `perp` es más
  // negativa — el lado contrario al árbol, no un punto cualquiera.
  const perp = { x: -dirCamaraXZ.z, z: dirCamaraXZ.x };
  const productosPerp = geo.esquinasCaja.map((esq) => esq.x * perp.x + esq.z * perp.z);
  const esquina = geo.esquinasCaja[productosPerp.indexOf(Math.min(...productosPerp))];
  const magEsquina = Math.hypot(esquina.x, esquina.z);
  const nx = esquina.x / magEsquina;
  const nz = esquina.z / magEsquina;
  // 1.0 (checkpoint 23) quedaba demasiado pegada a la casa — pedido
  // explícito de separarla un poco más, plantada en la hierba.
  const margenFuera = 1.5;
  const baseX = esquina.x + nx * margenFuera;
  const baseZ = esquina.z + nz * margenFuera;
  // Hacia el centro de la casa (signo opuesto a la normal centro→esquina
  // de arriba) — dirección en la que se adelanta la tabla horizontal.
  const dirCasaX = -nx;
  const dirCasaZ = -nz;

  const grupo = new THREE.Group();
  grupo.position.set(baseX, 0, baseZ);
  // Todas las piezas se construyen en un espacio local sencillo donde
  // "hacia la casa" es siempre el eje +X (mucho más fácil de razonar que
  // orientar cada tabla a mano con la dirección real) y se rota el GRUPO
  // ENTERO una sola vez al final para alinear ese eje con `dirCasa`, en
  // vez de calcular la orientación de cada tabla por separado.
  grupo.rotation.y = Math.atan2(-dirCasaZ, dirCasaX);

  const materialMadera = new THREE.MeshStandardMaterial({ color: COLOR_TRONCO, roughness: 0.9 });

  // Un 50% más grande (checkpoint 23, pedido explícito) sobre las
  // medidas originales de este bloque.
  const ESCALA_FAROLA = 1.5;

  // Tabla vertical.
  const ALTURA_POSTE = 0.95 * ESCALA_FAROLA;
  const ESPESOR_TABLA = 0.02 * ESCALA_FAROLA; // grosor de la tabla
  const GROSOR_TABLA = 0.06 * ESCALA_FAROLA; // ancho de cara de la tabla
  // La tabla vertical más ancha que el resto (pedido explícito) — solo la
  // cara de esta pieza, sin tocar `GROSOR_TABLA` (que sigue midiendo el
  // brazo/diagonal, más finos por diseño).
  const GROSOR_TABLA_VERTICAL = GROSOR_TABLA * 2;
  const poste = new THREE.Mesh(
    new THREE.BoxGeometry(ESPESOR_TABLA, ALTURA_POSTE, GROSOR_TABLA_VERTICAL),
    materialMadera,
  );
  poste.position.y = ALTURA_POSTE / 2;
  poste.castShadow = true;
  grupo.add(poste);

  // Tabla horizontal, saliendo del poste cerca de arriba (eje +X local).
  const LONGITUD_BRAZO = 0.42 * ESCALA_FAROLA;
  const alturaBrazo = ALTURA_POSTE - 0.08 * ESCALA_FAROLA;
  const brazo = new THREE.Mesh(new THREE.BoxGeometry(LONGITUD_BRAZO, ESPESOR_TABLA, GROSOR_TABLA), materialMadera);
  brazo.position.set(LONGITUD_BRAZO / 2, alturaBrazo, 0);
  // SIN castShadow: el extremo del brazo es justo de donde cuelga el
  // farolillo, así que sigue relativamente cerca del foco — mismo
  // criterio de siempre en este bloque, ninguna pieza de la propia
  // farola necesita sombrear el charco de luz que produce.
  grupo.add(brazo);

  // Tabla diagonal — el tercer lado del triángulo, sujetando la
  // horizontal contra la vertical (escuadra de cartel de jardín típica).
  // Geometría en el plano XY local (Z=0 para las tres tablas, son
  // coplanares — el triángulo real que se pidió): un punto más abajo en
  // el poste, otro a mitad de la tabla horizontal, y una tabla entre
  // los dos con su propia longitud/ángulo calculados, no ajustados a
  // ojo — así el triángulo encaja exactamente sea cual sea
  // `LONGITUD_BRAZO`/`ALTURA_POSTE` si algún día cambian.
  const puntoBajoPosteY = alturaBrazo - 0.3 * ESCALA_FAROLA;
  const puntoEnBrazoX = LONGITUD_BRAZO * 0.6;
  const dx = puntoEnBrazoX;
  const dy = alturaBrazo - puntoBajoPosteY;
  const longitudDiagonal = Math.hypot(dx, dy);
  const diagonal = new THREE.Mesh(new THREE.BoxGeometry(ESPESOR_TABLA, longitudDiagonal, GROSOR_TABLA), materialMadera);
  diagonal.position.set(puntoEnBrazoX / 2, (puntoBajoPosteY + alturaBrazo) / 2, 0);
  diagonal.rotation.z = -Math.atan2(dx, dy);
  grupo.add(diagonal);

  // Farolillo colgado del BORDE de la tabla horizontal (pedido
  // explícito). Checkpoint 22: mismo tamaño que el del árbol. Checkpoint
  // 23, pedido explícito ("hazlo más grande"): ya no comparte tamaño con
  // el del árbol — escala con `ESCALA_FAROLA` igual que el resto de la
  // farola; intensidad subida con el cuadrado de la escala (mismo
  // criterio que los diseños anteriores: con el farolillo más grande y
  // más lejos del suelo, la iluminancia cae con el cuadrado de esa
  // distancia).
  grupo.add(
    construirFarolilloColgante(LONGITUD_BRAZO, alturaBrazo, 0, factorEncendida, {
      alturaCuerda: 0.16 * ESCALA_FAROLA,
      tamañoFarolillo: 0.13 * ESCALA_FAROLA,
      // Sí con sombra real (a diferencia del farolillo decorativo del
      // árbol) — este es el único foco de la farola.
      intensidadLuz: 6 * ESCALA_FAROLA ** 2,
      conSombra: true,
      alcanceSombra: 6 * ESCALA_FAROLA,
    }),
  );

  return grupo;
}

// Tormenta (checkpoint 5: "si hay tormenta que caigan rayos") — el
// checkpoint 5 la aproximaba con lluvia fuerte + mucha nube porque no se
// pedía el dato real. Checkpoint 6 (pedido explícito: "deberíamos pedir ese
// dato también"): `src/data/openMeteo.js` ya pide `weather_code` y expone
// `esTormenta(codigoTiempo)` (códigos WMO 95/96/99). Esta función ya no
// vive aquí — se importa tal cual, sin duplicar la lista de códigos.

// Forma en zigzag fija (no aleatoria — mismo criterio que nubes/lluvia) para
// el rayo: x,y en [0,1], y=1 arriba, y=0 abajo.
//
// Primer intento: bajaba hasta objetivo.y+radio*0.25, muy por debajo del
// tejado (que empieza en objetivo.y+geo.altura) — quedaba oculto DETRÁS de
// las paredes por el test de profundidad normal (no era un problema de
// opacidad: el flash de luz ambiental sí se veía, la línea no). En vez de
// intentar que "caiga" hasta cerca del suelo (que además rompería el tono
// tranquilo de CLAUDE.md, un rayo "entrando" en el salón), se confina
// entera dentro de la misma franja vertical ya validada para las nubes
// (`alturaNubes`, más arriba) — garantizado libre de la silueta de la caja.
const PATRON_RAYO = [
  { x: 0, y: 1 },
  { x: 0.18, y: 0.72 },
  { x: -0.1, y: 0.5 },
  { x: 0.12, y: 0.26 },
  { x: -0.04, y: 0 },
];
const ANCLA_RAYO = { x: -0.6, z: -0.4 }; // misma zona segura que las nubes

function construirRayo(objetivo, radio) {
  // 1.35/0.95 y luego 1.28/1.02 (intentos previos) se salían por arriba del
  // encuadre de la cámara — casi todo el rayo quedaba fuera de la pantalla.
  // En vez de seguir tanteando el límite exacto del frustum de la cámara
  // (con la elevación inclinada de la cámara, no es un cálculo directo),
  // se centra el rayo en `alturaNubes` (radio*1.15) — la MISMA altura ya
  // confirmada visualmente dentro de cámara y fuera de la silueta de la
  // caja para las nubes — con un tramo corto alrededor, no una caída larga.
  const arriba = objetivo.y + radio * 1.18;
  const abajo = objetivo.y + radio * 1.05;
  const cx = objetivo.x + radio * ANCLA_RAYO.x;
  const cz = objetivo.z + radio * ANCLA_RAYO.z;
  const puntos = PATRON_RAYO.map(
    ({ x, y }) => new THREE.Vector3(cx + radio * 0.12 * x, abajo + (arriba - abajo) * y, cz),
  );
  const geometria = new THREE.BufferGeometry().setFromPoints(puntos);
  const material = new THREE.LineBasicMaterial({
    // Azul-blanco eléctrico, no blanco-crema puro (primer intento, casi
    // invisible: se mezclaba con el blanco de los puffs de nube contiguos,
    // el mismo problema de bajo contraste que ya costó resolver en las
    // nubes, aquí con el color en vez de con la altura).
    color: 0xbcd9ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const linea = new THREE.Line(geometria, material);
  // renderOrder por encima del de los puffs blancos de las nubes (=1): sin
  // esto el rayo, al estar espacialmente cerca del cúmulo de nubes, quedaba
  // SIEMPRE tapado por ellas — Three.js prioriza renderOrder explícito
  // sobre el orden por distancia a cámara entre objetos transparentes.
  linea.renderOrder = 2;
  linea.userData.proximoFlash = 1 + Math.random() * 3; // primer rayo pronto, para verlo rápido al probar
  linea.userData.inicioFlash = null;
  return linea;
}

const DURACION_FLASH = 0.6; // segundos
const INTERVALO_FLASH_MIN = 3;
const INTERVALO_FLASH_MAX = 8;

// Avanza el parpadeo del rayo — llamada desde el bucle de animación.
// Devuelve la intensidad del flash [0,1] en este instante, para que
// crearEscena3D pueda usarla también para iluminar el resto de la escena un
// instante (luzFlash).
function animarRayo(rayo, tiempo) {
  if (rayo.userData.inicioFlash === null && tiempo >= rayo.userData.proximoFlash) {
    rayo.userData.inicioFlash = tiempo;
  }
  if (rayo.userData.inicioFlash === null) {
    rayo.material.opacity = 0;
    return 0;
  }
  const transcurrido = tiempo - rayo.userData.inicioFlash;
  if (transcurrido >= DURACION_FLASH) {
    rayo.userData.inicioFlash = null;
    rayo.userData.proximoFlash = tiempo + INTERVALO_FLASH_MIN + Math.random() * (INTERVALO_FLASH_MAX - INTERVALO_FLASH_MIN);
    rayo.material.opacity = 0;
    return 0;
  }
  // Subida rápida (15% de la duración) y bajada lineal el resto — más
  // simple que el primer intento (dos gaussianas superpuestas), que
  // decaía tan rápido en los primeros ~100ms que en la práctica casi
  // nunca se llegaba a ver: con opacidad ya por debajo de 0.02 a los
  // 100ms de empezar el flash, cualquier verificación con una espera
  // normal lo pillaba prácticamente apagado.
  const t = transcurrido / DURACION_FLASH;
  const pulso = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.85);
  rayo.material.opacity = Math.min(1, pulso);
  return rayo.material.opacity;
}

// Luz direccional posicionada según la posición solar REAL (mismo azimut/
// elevación que ya usa termico.js vía sol.js) — no una luz decorativa.
//
// SÍ proyecta sombra 3D real (castShadow) — a diferencia del edificio
// enfrente (retirado, Fase 6: su sombra dependía de una caja a escala
// comprimida y podía no coincidir con la realidad), el marco de la ventana
// y las paredes opacas están a escala 1:1 real, así que su sombra en el
// suelo sí es fiable: no hace falta calcularla aparte con una fórmula, es
// exactamente la misma geometría real proyectada con el sol real. El
// cristal sigue sin proyectar sombra (dejaría de entrar sol por esa
// ventana).
function construirLuzSol(sol, objetivo, radio) {
  const dir = direccionSol(sol);
  const factor = factorIntensidadSol(sol);
  const distanciaLuz = radio * 3;

  const luz = new THREE.DirectionalLight(0xfff6e8, 2.4 * factor);
  luz.position.set(
    objetivo.x + dir.x * distanciaLuz,
    objetivo.y + dir.y * distanciaLuz,
    objetivo.z + dir.z * distanciaLuz,
  );
  luz.target.position.copy(objetivo);
  luz.castShadow = true;
  // 1024→2048→4096: la isla más grande (checkpoint 11) agrandó
  // `alcanceSombra` (más abajo) y con él el tamaño de cada texel en
  // unidades de mundo — más resolución ayuda a la vez con dos problemas
  // (contorno difuso Y el hueco de "peter-panning" en la base de objetos
  // pequeños, más abajo): con texels más finos hace falta menos bias para
  // evitar shadow acne, así que también se puede bajar el bias sin que
  // vuelva el acné.
  luz.shadow.mapSize.set(4096, 4096);
  // near/far ceñidos al rango real donde puede haber geometría (ver
  // docs/estado.md, Fase 6 — con near/far muy separados la precisión del
  // shadow map se degrada tanto que la sombra deja de aparecer).
  luz.shadow.camera.near = Math.max(0.1, distanciaLuz - radio * 2);
  luz.shadow.camera.far = distanciaLuz + radio * 2;
  const alcanceSombra = radio * 1.3;
  luz.shadow.camera.left = -alcanceSombra;
  luz.shadow.camera.right = alcanceSombra;
  luz.shadow.camera.top = alcanceSombra;
  luz.shadow.camera.bottom = -alcanceSombra;
  // -0.00012 (checkpoint 12) volvió a dejar "shadow acne" muy visible
  // (checkpoint 21, confirmado ampliando una captura a sol rasante) — la
  // farola, mucho más alta desde entonces (checkpoints 16-21) y
  // desplazada del centro, ha ido agrandando `radio`/`alcanceSombra`
  // (más abajo) sin que este valor se retocase desde entonces: con el
  // mismo `mapSize`, texels más grandes en unidades de mundo necesitan
  // más bias para el mismo resultado sin ruido. Subido junto con
  // `normalBias` (mismo motivo), re-verificado con el mismo par de
  // escenas límite que en el checkpoint 12 (rocas a mediodía para
  // "peter-panning", pared a sol rasante para acné).
  luz.shadow.bias = -0.00035;
  // normalBias (no solo bias): sin esto se veía un contorno fino de
  // autosombra justo en la base de las paredes, donde tocan el suelo —
  // "shadow acne" típico en la costura de contacto entre un objeto vertical
  // y la superficie que lo recibe. normalBias desplaza el muestreo del
  // shadow map a lo largo de la normal de la superficie, que corrige mejor
  // este caso que subir el bias plano.
  //
  // 0.03 (checkpoints 3-11) se quedó demasiado alto según la escena creció
  // (isla más grande, checkpoint 11 → `radio`/`alcanceSombra` más grandes,
  // más abajo): pedido explícito confirmado en captura real — casi todos
  // los objetos (rocas, árbol) tenían una tira de hierba SIN sombra justo
  // en su base, "peter-panning" clásico (el desplazamiento a lo largo de
  // la normal, a un ángulo de sol no cenital, equivale a un desplazamiento
  // horizontal real de la sombra respecto al objeto). Bajado bastante;
  // sigue habiendo algo de bias (no 0) para no reintroducir el acné que
  // motivó tenerlo en primer lugar.
  luz.shadow.normalBias = 0.004;
  // 1 (checkpoint 12-21) era un contorno bastante definido, pedido
  // explícito entonces. Ahora se difumina más cuanto más nublado está
  // (`factorDifusionNubes`, iluminacion.js): con mucha nube el sol deja de
  // ser una fuente puntual y se dispersa por todo el cielo — "las nubes
  // actúan como focos" propios, así que la sombra se vuelve mucho más
  // suave en vez de solo más tenue. Con cielo despejado (difusión 0) sigue
  // siendo el mismo contorno definido de siempre.
  luz.shadow.radius = 1 + 6 * factorDifusionNubes(sol.nubesPct);
  // Sin esto, los cambios de near/far/left/right/top/bottom de arriba no
  // se aplican nunca: Three.js no recalcula la matriz de proyección de la
  // cámara de sombra por su cuenta, hay que pedirlo explícitamente. Este
  // era el bug real por el que no aparecía ninguna sombra (ni en este
  // entorno sin GPU ni, según confirmaste, en un navegador con GPU real):
  // la cámara de sombra seguía usando su frustum por defecto (near/far muy
  // separados), no el ajustado.
  luz.shadow.camera.updateProjectionMatrix();

  const grupo = new THREE.Group();
  grupo.add(luz);
  grupo.add(luz.target);
  return grupo;
}

// Luna real (checkpoint 18, pedido explícito: "que por la noche se tenga
// en cuenta la luna que hay. si hay luna llena que salga arriba una luna
// llena que alumbre un poco. si hay creciente pues creciente. y si hay
// luna nueva que esté más oscuro. que se vean las estrellas en función de
// la luna. no tiene que ser estrellas reales. y la luna tampoco tiene que
// estar en el sitio exacto"). `fraccionIluminada` (0=nueva, 1=llena) y
// `creciente` vienen de SunCalc vía src/data/luna.js — la FASE es un dato
// real, no inventado; ni la posición del disco en el cielo ni las
// estrellas lo son (pedido explícito de no necesitarlo).
const COLOR_LUNA_CSS = '#f3ecd9';

// Textura de la luna con la forma real de su fase — mismo recurso de
// siempre en esta escena (canvas 2D generado una vez, sin assets
// externos).
//
// Primer intento (arco de semicírculo + elipse recortada a mano con
// sweep-flags por ángulo) salió con la lógica invertida — confirmado en
// captura real: luna nueva (fracción≈0) salía como un disco lleno y
// brillante, luna llena (fracción≈1) salía apagada/gris, justo al
// revés. Reescrito con una técnica mucho más fácil de verificar a mano
// (composición de canvas en vez de ángulos de arco):
// 1. Recorta todo lo que sigue al disco (`ctx.clip()`).
// 2. Rellena la mitad iluminada (creciente=derecha, menguante=izquierda)
//    con el color de la luna — sin elipses todavía, un simple rectángulo
//    recortado al disco.
// 3. Una elipse (ancho = r×|1−2k|, k=fracción iluminada) se RESTA de esa
//    mitad si k<0.5 (menos de medio disco: hay que estrechar el
//    semicírculo hasta dejar solo un creciente fino) o se SUMA si k>0.5
//    (más de medio disco: hay que invadir la mitad contraria hasta
//    dejar una gibosa). En k=0 la elipse mide lo mismo que el propio
//    semicírculo (ancho=r) y lo borra entero → luna nueva casi
//    invisible; en k=1 la elipse vuelve a medir lo mismo pero SUMA sobre
//    la mitad contraria → disco completo. Verificado con captura real en
//    los tres casos (nueva, media, llena) tras el cambio.
function texturaLuna(fraccionIluminada, creciente) {
  const tam = 128;
  const canvas = document.createElement('canvas');
  canvas.width = tam;
  canvas.height = tam;
  const ctx = canvas.getContext('2d');
  const cx = tam / 2;
  const cy = tam / 2;
  const r = tam * 0.4;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Disco base muy tenue (para que la luna nueva no sea del todo
  // invisible, solo casi).
  const discoBase = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  discoBase.addColorStop(0, 'rgba(120,115,100,0.22)');
  discoBase.addColorStop(1, 'rgba(120,115,100,0)');
  ctx.fillStyle = discoBase;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // Mitad iluminada (sin elipse todavía).
  ctx.fillStyle = COLOR_LUNA_CSS;
  if (creciente) {
    ctx.fillRect(cx, cy - r, r, r * 2); // mitad derecha
  } else {
    ctx.fillRect(cx - r, cy - r, r, r * 2); // mitad izquierda
  }

  // Elipse del terminador: resta (creciente estrecho) o suma (gibosa)
  // según si la fracción iluminada es menor o mayor que la mitad.
  const semiEjeH = r * Math.abs(1 - 2 * fraccionIluminada);
  if (semiEjeH > tam * 0.01) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, semiEjeH, r, 0, 0, Math.PI * 2);
    ctx.globalCompositeOperation = fraccionIluminada < 0.5 ? 'destination-out' : 'source-over';
    ctx.fillStyle = COLOR_LUNA_CSS;
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();

  // Halo suave ALREDEDOR del disco — se lee como una fuente de luz real,
  // no como un recorte plano pegado sobre el cielo.
  //
  // Dos bugs reales por turnos, cada uno confirmado ampliando una
  // captura real:
  // 1) Con el halo pintado ANTES que el disco/terminador, la resta
  //    `destination-out` del terminador (luna nueva/creciente) no
  //    distingue de qué capa viene cada píxel — borraba también el halo
  //    ya pintado justo DENTRO del radio del disco, dejando el interior
  //    a alpha 0 mientras el halo seguía intacto justo fuera: el salto
  //    entre "borrado dentro" e "intacto fuera" se leía como un anillo
  //    brillante pegado al borde.
  // 2) "Arreglado" pintando el halo DESPUÉS con `destination-over`
  //    (rellena por detrás de lo ya dibujado) — pero `destination-over`
  //    solo respeta lo que YA HAY cuando ya hay algo con alpha>0; en la
  //    parte oscura de una luna nueva/creciente (que el terminador deja
  //    en alpha 0, transparente de verdad), no había nada que respetar,
  //    así que el halo se pintaba ahí igual que si fuera la única capa
  //    — con su radio interior (`r*0.7`) a alpha plano 0.35, eso
  //    inundaba el lado oscuro entero de un blanco sólido — pedido
  //    explícito: "la luna tiene una cosa blanca donde debería ser
  //    oscura".
  // Solución de verdad: recortar el halo a un ANILLO real (entre `r` y
  // `r*1.15`, con `evenodd`) que no pueda pintar NADA dentro del propio
  // radio del disco — así da igual qué haya (o no haya) ahí dentro, el
  // halo nunca lo toca, y el orden de dibujo deja de importar. Radio
  // exterior `r*1.15` (no más) por el mismo motivo que ya se corrigió
  // una vez: el lienzo mide `tam`=128 (mitad de lado = 64px) y hay que
  // quedarse claramente por debajo de eso para no volver a dejar un
  // resto de color con forma de cuadrado en las esquinas del lienzo.
  ctx.save();
  const anillo = new Path2D();
  anillo.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
  anillo.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip(anillo, 'evenodd');
  const halo = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 1.15);
  halo.addColorStop(0, 'rgba(243,236,217,0.35)');
  halo.addColorStop(1, 'rgba(243,236,217,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, tam, tam);
  ctx.restore();

  return new THREE.CanvasTexture(canvas);
}

// Sprite de la luna — billboard nativo (mismo motivo que las nubes: no
// hace falta orientarlo a mano hacia la cámara). Solo se construye de
// noche (`nocturnidadActual>0`, misma rampa crepuscular que ya apaga el
// sol/enciende las farolas) — de día no pinta nada, ni siquiera muy tenue.
// Varios intentos previos (anclas de nube a su altura habitual,
// `ANCLA_RAYO`...) no se veían en captura real, o solo un fragmento
// recortado en la esquina. Diagnosticado con marcadores de colores
// temporales en varias posiciones candidatas (borrados de este archivo
// tras confirmar el resultado, no dejados como código muerto): el
// encuadre fijo de la cámara resulta ser bastante más ceñido de lo que
// las coordenadas de las nubes sugerían — las nubes SE VEN a esas
// coordenadas porque son sprites grandes cuyo borde asoma al encuadre
// aunque su centro esté fuera; un objeto pequeño en el mismo punto no
// asoma nada. `{x:-0.15, z:-0.3}` a 0.45×radio de altura sí quedó
// claramente dentro del encuadre en la captura de calibración, sin
// tapar el tejado.
// Checkpoint 20 (pedido explícito: "la luna es enorme y se ve en todo
// el medio... debería estar por detrás de la isla o más arriba"): dos
// cambios, mismo método de calibración con marcadores de colores
// temporales (borrados tras confirmar). Tamaño de 0.32×radio a
// 0.13×radio (menos de la mitad) — a un cuarto del encuadre, un disco
// tan grande dominaba el centro de la imagen en vez de leerse como algo
// lejano en el cielo. Altura de 0.45×radio a 0.6×radio (misma
// coordenada horizontal `{x:-0.15,z:-0.3}`, confirmada de nuevo dentro
// de encuadre a esta altura mayor) — más arriba, más pequeña y menos
// protagonista, como un objeto de fondo real.
// Ancla horizontal calibrada (ver historial arriba) — compartida con
// `construirEstrellas` para poder excluir estrellas de encima de la luna.
const ANCLA_LUNA = { x: -0.15, z: -0.3 };
// Relación altura/techoCielo ya calibrada en landscape (checkpoint 19-21):
// la ALTURA ABSOLUTA de la luna (0.6×radio) no cambia aquí — sigue siendo
// la misma de siempre en pantallas anchas — pero el denominador sí, porque
// TECHO_CIELO_LANDSCAPE bajó de 1.15 a 0.72 (bug real corregido más
// arriba); 0.6/0.72 mantiene exactamente esa misma altura absoluta
// (0.6×radio) con el nuevo denominador, en vez de heredar sin querer un
// recorte que no tiene nada que ver con la luna. En retrato, pedido
// explícito ("la luna tiene que verse arriba del todo"): 0.6/1.15 solo
// dejaba la luna a mitad de camino del cielo disponible, muy lejos del
// borde superior real — PROPORCION_ALTURA_LUNA_PORTRAIT casi al límite de
// `techoCielo` (que a su vez ya tiene su propio margen de seguridad frente
// al borde real de la cámara, ver TECHO_CIELO_PORTRAIT), para que la luna
// quede pegada arriba sin llegar a recortarse.
const PROPORCION_ALTURA_LUNA_LANDSCAPE = 0.6 / 0.72;
const PROPORCION_ALTURA_LUNA_PORTRAIT = 0.95;
function construirLuna(objetivo, radio, aspecto, fraccionIluminada, creciente, nocturnidadActual) {
  const grupo = new THREE.Group();
  if (nocturnidadActual <= 0) return grupo;

  const material = new THREE.SpriteMaterial({
    map: texturaLuna(fraccionIluminada, creciente),
    transparent: true,
    opacity: nocturnidadActual,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const tamaño = radio * 0.13;
  sprite.scale.set(tamaño, tamaño, 1);
  sprite.position.set(
    objetivo.x + radio * ANCLA_LUNA.x,
    objetivo.y +
      radio *
        techoCielo(aspecto) *
        (aspecto < 1 ? PROPORCION_ALTURA_LUNA_PORTRAIT : PROPORCION_ALTURA_LUNA_LANDSCAPE),
    objetivo.z + radio * ANCLA_LUNA.z,
  );
  grupo.add(sprite);
  return grupo;
}

// Estrellas — puntos pequeños repartidos por el cielo, sin ninguna
// pretensión de constelación real (pedido explícito: "no tiene que ser
// estrellas reales"). Cantidad/opacidad moduladas por `fraccionIluminada`
// de la luna real: con luna llena casi no se ven (el brillo de la luna
// las lava, igual que en un cielo real), con luna nueva se ven casi
// todas — así "que se vean las estrellas en función de la luna" sí tiene
// una base real detrás, aunque las posiciones no la tengan.
//
// Checkpoint 20 (pedido explícito: "solo hay estrellas en la parte
// izquierda... colócalas aleatoriamente, pero más arriba, ya que cuanto
// más abajo más luz hay"). Dos cambios, mismo método de calibración con
// marcadores de colores (borrados tras confirmar):
// - Solo se usaba `ANCLAS_NUBE` (zona arriba-izquierda) porque era la
//   única zona ya validada seguro. Calibrado ahora también el lado
//   DERECHO del encuadre (`ANCLAS_ESTRELLAS_DERECHA`, dos puntos
//   confirmados visibles en captura real) — cada estrella elige al azar
//   entre las anclas de AMBOS lados, no solo las de la izquierda.
// - "Aleatoriamente" ya lo eran (`Math.random()` en la altura); lo que
//   pedía en realidad era MÁS densidad arriba que abajo, no solo azar
//   uniforme. `Math.random() ** 1.8` sesga el valor hacia 1 (en vez de
//   repartirlo llano en [0,1]), así que la altura resultante
//   (`alturaMin + t*(alturaMax-alturaMin)`) cae más veces cerca de
//   `alturaMax` (arriba) que de `alturaMin` (abajo, más cerca de donde
//   brilla la farola).
// Checkpoint 21 (pedido explícito: "baja el tamaño de las estrellas y su
// densidad, y haz que no todas sean igual de grandes y brillantes... un
// filtro que haga que cuanto más abajo las estrellas brillen menos").
// 220→130: menos densidad en general. `NIVELES_ESTRELLAS`: `size` de
// `PointsMaterial` es un único escalar por `Points` — no admite tamaño
// por vértice sin shader propio (mismo límite ya documentado para la
// lluvia/el polvo) — así que la variación de TAMAÑO viene de 3 grupos
// con su propio `size` (más estrellas pequeñas que grandes, como un
// cielo real), no de un único `Points`. La variación de BRILLO, en
// cambio, sí es continua dentro de cada grupo: `vertexColors` sí admite
// un valor por vértice, así que cada estrella lleva su propio color
// (blanco escalado) en vez de compartir un único `material.color` fijo.
const NUM_ESTRELLAS = 130;
const NIVELES_ESTRELLAS = [
  { fraccion: 0.6, tamañoPx: 1.1, brilloBase: 0.5 },
  { fraccion: 0.3, tamañoPx: 1.6, brilloBase: 0.75 },
  { fraccion: 0.1, tamañoPx: 2.1, brilloBase: 1 },
];
const ANCLAS_ESTRELLAS_DERECHA = [
  { x: 0.15, z: 0.3 },
  { x: 0, z: 0.4 },
];
// Exclusión alrededor de la luna (pedido explícito: "a veces salen
// estrellas ahí [encima de la luna], no deberían") — mismo patrón de
// reintento que ya usan las toperas para no aparecer dentro de la casa:
// si el punto sorteado cae demasiado cerca de `ANCLA_LUNA` en XZ, se
// vuelve a sortear en vez de aceptarlo.
const RADIO_EXCLUSION_LUNA = 0.2;
function construirEstrellas(objetivo, radio, aspecto, fraccionIluminada, nocturnidadActual) {
  const grupo = new THREE.Group();
  if (nocturnidadActual <= 0) return grupo;

  const factorVisibilidad = 1 - fraccionIluminada * 0.85;
  const numEstrellas = Math.round(NUM_ESTRELLAS * (0.25 + 0.75 * factorVisibilidad));
  const alturaMin = objetivo.y + radio * 0.85;
  const alturaMax = objetivo.y + radio * techoCielo(aspecto);
  const anclasCielo = [...ANCLAS_NUBE, ...ANCLAS_ESTRELLAS_DERECHA];
  const JITTER_ESTRELLAS = 0.35;

  NIVELES_ESTRELLAS.forEach(({ fraccion, tamañoPx, brilloBase }) => {
    const n = Math.round(numEstrellas * fraccion);
    const posiciones = new Float32Array(n * 3);
    const colores = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      let x;
      let z;
      let intentos = 0;
      do {
        const ancla = anclasCielo[Math.floor(Math.random() * anclasCielo.length)];
        x = ancla.x + (Math.random() * 2 - 1) * JITTER_ESTRELLAS;
        z = ancla.z + (Math.random() * 2 - 1) * JITTER_ESTRELLAS;
        intentos += 1;
      } while (Math.hypot(x - ANCLA_LUNA.x, z - ANCLA_LUNA.z) < RADIO_EXCLUSION_LUNA && intentos < 20);

      // `t` sesgado hacia 1 (arriba, "aleatoriamente... pero más
      // arriba") y reutilizado tal cual como factor de brillo ("cuanto
      // más abajo brillen menos") — la misma altura que decide dónde
      // cae la estrella decide también cuánto brilla, sin dos cálculos
      // separados.
      const t = Math.random() ** 1.8;
      posiciones[i * 3] = objetivo.x + radio * x;
      posiciones[i * 3 + 1] = alturaMin + t * (alturaMax - alturaMin);
      posiciones[i * 3 + 2] = objetivo.z + radio * z;

      const brillo = brilloBase * (0.35 + 0.65 * t) * (0.75 + 0.5 * Math.random());
      colores[i * 3] = brillo;
      colores[i * 3 + 1] = brillo;
      colores[i * 3 + 2] = brillo;
    }
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    geometria.setAttribute('color', new THREE.BufferAttribute(colores, 3));
    const material = new THREE.PointsMaterial({
      color: 0xfff6e0,
      vertexColors: true,
      size: tamañoPx,
      sizeAttenuation: false,
      transparent: true,
      opacity: nocturnidadActual * (0.35 + 0.5 * factorVisibilidad),
      depthWrite: false,
    });
    grupo.add(new THREE.Points(geometria, material));
  });

  return grupo;
}

// Entorno procedural para reflejos sutiles en el cristal (pedido explícito
// de "reflejos donde correspondan", dentro del estilo actual — sin
// texturas externas descargadas, coherente con "sin servidor" de
// CLAUDE.md). Una esfera con degradado de color propio (cálido arriba,
// más terroso abajo, simulando cielo/suelo) horneada con PMREMGenerator en
// un mapa de entorno reutilizable — no es un cielo realista, es solo una
// fuente de reflejo suave y coherente con la paleta cálida del proyecto.
function crearEntornoProcedural(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const escenaEntorno = new THREE.Scene();

  const geometria = new THREE.SphereGeometry(40, 16, 16);
  const colorArriba = new THREE.Color(0xfef6e4);
  const colorAbajo = new THREE.Color(0xcbb289);
  const posiciones = geometria.attributes.position;
  const colores = new Float32Array(posiciones.count * 3);
  for (let i = 0; i < posiciones.count; i += 1) {
    const t = (posiciones.getY(i) / 40 + 1) / 2; // 0 abajo, 1 arriba
    const color = colorAbajo.clone().lerp(colorArriba, t);
    colores[i * 3] = color.r;
    colores[i * 3 + 1] = color.g;
    colores[i * 3 + 2] = color.b;
  }
  geometria.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  escenaEntorno.add(new THREE.Mesh(geometria, material));

  const renderTarget = pmrem.fromScene(escenaEntorno, 0.04);
  pmrem.dispose();
  return renderTarget.texture;
}

// `clima` agrupa lo que no es `sol` (posición solar + nubosidad, que ya
// tenía su propio parámetro desde la Fase 2): precipitación, código de
// tiempo WMO (para tormenta real, ver esTormenta más arriba) y viento
// ({velocidad en km/h, direccion en grados de brújula — de dónde SOPLA,
// convención meteorológica}, o null si no hay dato/no aplica). `viento` se
// usa para el polvo en suspensión (construirViento, más abajo), que solo
// aparece sin lluvia. `luna` (checkpoint 18) es la fase real de
// src/data/luna.js — {fraccionIluminada, creciente}; los valores por
// defecto (luna nueva) solo importan si algún día se llama a esta función
// sin pasarlo, cosa que main-escena3d.js ya no hace.
export function crearEscena3D(contenedor, plano, alturaTecho, sol, clima = {}, luna = {}) {
  const { precipitacion = 0, codigoTiempo = null, viento = null } = clima;
  const { fraccionIluminada = 0, creciente = true } = luna;
  const ancho = contenedor.clientWidth || 800;
  const alto = contenedor.clientHeight || 600;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(ancho, alto);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  // PCFShadowMap, no VSMShadowMap: cambié a VSM buscando sombras más
  // suaves y dejó de verse la sombra (pedido explícito, confirmado por el
  // usuario) — no pude verificar VSM yo mismo en este entorno, así que no
  // debí cambiar algo que ya sabíamos que funcionaba (PCFShadowMap, ya
  // confirmado en un checkpoint anterior) por algo sin probar. PCFShadowMap
  // también usa shadow.radius para suavizar, así que no se pierde del todo
  // el objetivo de sombras más suaves.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  contenedor.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // De día/noche según sol.elevacion (ver nocturnidad()) — calculado una
  // sola vez al crear la escena, no en el bucle de animación: no cambia
  // frame a frame, solo cuando cambian los datos reales o el override de
  // depuración.
  const nocturnidadActual = nocturnidad(sol);
  scene.background = crearCieloGradiente(sol.elevacion, nocturnidadActual, sol.nubesPct);
  // Sin scene.environment: afecta a TODOS los materiales de la escena, no
  // solo al cristal — probado, y lavaba el contraste de luz/sombra del
  // suelo y las paredes opacas por completo. El entorno se pasa como
  // envMap solo al material del cristal (construirPared), no globalmente.
  const entorno = crearEntornoProcedural(renderer);

  const geo = calcularGeometria(plano, alturaTecho);

  // Se necesita antes de construir las paredes, para el offset de los
  // reflejos del cristal (signoHaciaCamara) — no se puede esperar a tener
  // la cámara ya construida más abajo. Desde la Fase 3, `azimutBase` es
  // directamente `plano.orientacionCasa` (geo.ejeProfundidad ya se deriva
  // de ahí) — ya no depende de "la primera ventana" como en la Fase 6, es
  // un parámetro explícito e independiente de cuántas ventanas haya.
  const azimutBase = Math.atan2(geo.ejeProfundidad.x, geo.ejeProfundidad.z) * (180 / Math.PI);
  const dirCamaraXZ = direccionCamaraXZ(azimutCamaraDeg(azimutBase));
  // También se necesita antes de las paredes, para atenuar el reflejo del
  // cristal — comprobado en captura real: de noche (o con el sol bajo el
  // horizonte) el reflejo diagonal se veía a opacidad completa, como si
  // brillara sin ninguna luz que lo produjera. `factorIntensidadSol` ya es
  // 0 sin sol (misma función que apaga la luz direccional).
  const factorSol = factorIntensidadSol(sol);

  scene.add(construirSuelo(geo));
  scene.add(construirTecho(geo));
  geo.paredes.forEach((pared) =>
    scene.add(construirPared(pared, signoHaciaCamara(pared, dirCamaraXZ), entorno, factorSol)),
  );

  const objetivo = new THREE.Vector3(0, geo.altura / 2, 0);
  // Radio en dos fases: la isla y el árbol (checkpoint 7) son parte de la
  // ESCENA real, no decoración de cielo (a diferencia de nubes/lluvia/
  // viento, más abajo) — tienen que entrar en el cálculo de encuadre de la
  // cámara para que no queden cortados. Pero el propio tamaño de la isla
  // se define a partir del tamaño de la habitación, así que hace falta un
  // radio "solo habitación" primero.
  const radioHabitacion = calcularRadioEscena(scene, objetivo);
  // 1.25 (checkpoints 8-9) dejaba muy poco margen entre la casa y el
  // borde ("me da claustrofobia") → 1.9 (checkpoint 11). Bajado otra vez
  // (checkpoint 15, pedido explícito: "haz más pequeño el aro para poder
  // hacer más zoom") — la isla sigue teniendo sitio alrededor de la casa,
  // solo que menos: al ser el mayor contribuyente al radio de encuadre de
  // la cámara, encogerla es lo que de verdad permite acercar el zoom sin
  // tocar CAMARA_MARGEN.
  const radioIsla = radioHabitacion * 1.4;
  scene.add(construirIsla(radioIsla, radioHabitacion, nocturnidadActual, geo));
  scene.add(construirArbol(geo, radioIsla, dirCamaraXZ, nocturnidadActual, sol.nubesPct));
  scene.add(construirPino(geo, radioIsla, dirCamaraXZ));
  scene.add(construirBuzon(geo, dirCamaraXZ));
  scene.add(construirFarola(geo, dirCamaraXZ, nocturnidadActual, sol.nubesPct));
  const radio = calcularRadioEscena(scene, objetivo);
  const camera = construirCamara(objetivo, radio, azimutBase, ancho / alto);

  // Ambiental baja — solo evita que la cara que no mira al sol se vaya a
  // negro puro — para que la sombra real (ahora que sí se ve, tras el
  // arreglo de la normal del suelo) se note claramente y no quede diluida
  // por un relleno ambiental demasiado fuerte (pedido explícito: sombra
  // más marcada). Intensidad interpolada día↔noche (checkpoint 5).
  //
  // AMBIENTAL_NUBES_EXTRA (pedido explícito: "las nubes actúan como
  // focos... que no oscurezca tanto, pero las sombras sean más difusas"):
  // de día, con cielo cubierto se añade algo de ambiental extra, como si
  // el cielo entero (no solo el sol) se convirtiera en una fuente de luz
  // dispersa — junto con la sombra más difusa de `construirLuzSol`, es la
  // misma idea física en dos sitios (menos luz puntual, más luz repartida)
  // en vez de solo apagar la escena entera. Solo de día (`1-nocturnidad`):
  // de noche la nubosidad ya se nota en el cielo/sombra, no hace falta que
  // también compita con el contraste cálido de la farola.
  const AMBIENTAL_NUBES_EXTRA = 0.16;
  const intensidadAmbiental =
    AMBIENTAL_DIA +
    (AMBIENTAL_NOCHE - AMBIENTAL_DIA) * nocturnidadActual +
    AMBIENTAL_NUBES_EXTRA * factorDifusionNubes(sol.nubesPct) * (1 - nocturnidadActual);
  const luzAmbiental = new THREE.AmbientLight(0xfff3e0, intensidadAmbiental);
  scene.add(luzAmbiental);
  scene.add(construirLuzSol(sol, objetivo, radio));

  // Luz de cielo tenue de noche (checkpoint 18, propuesta aceptada por el
  // usuario: "pon también un poco de luz del cielo tenue"). HemisphereLight
  // no proyecta sombra (barata, sin coste de shadow map) — solo levanta
  // un poco el negro más puro del lado sin luz directa de la farola/el
  // farolillo del árbol, sin competir con su contraste cálido. Nula de
  // día (`nocturnidadActual=0`); de noche, modulada por la fase lunar
  // real — pedido explícito: "si hay luna llena que alumbre un poco...
  // si hay luna nueva que esté más oscuro". Mínimo 0.05 incluso en luna
  // nueva (no una noche 100% negra), hasta 0.22 en luna llena.
  const luzHemisferio = new THREE.HemisphereLight(0x8fb8d9, 0x2a2418, nocturnidadActual * (0.05 + 0.17 * fraccionIluminada));
  scene.add(luzHemisferio);

  // Añadidas DESPUÉS de calcular radio/cámara (arriba): si entraran antes,
  // inflarían la caja englobante de calcularRadioEscena() y forzarían un
  // zoom-out innecesario, el mismo problema que ya tuvimos con los
  // edificios (retirados, ver docs/estado.md) — a diferencia de la isla y
  // el árbol (arriba), que sí necesitan entrar en el encuadre.
  const grupoNubes = construirNubes(sol.nubesPct, objetivo, radio, ancho / alto);
  scene.add(grupoNubes);
  const grupoLluvia = construirLluvia(precipitacion, objetivo, radio, viento, dirCamaraXZ);
  scene.add(grupoLluvia);
  const grupoViento = construirViento(viento, precipitacion, objetivo, radio, ancho / alto, nocturnidadActual);
  scene.add(grupoViento);
  const grupoFilamentos = construirFilamentos(radioIsla, geo);
  scene.add(grupoFilamentos);
  scene.add(construirLuna(objetivo, radio, ancho / alto, fraccionIluminada, creciente, nocturnidadActual));
  scene.add(construirEstrellas(objetivo, radio, ancho / alto, fraccionIluminada, nocturnidadActual));

  // Rayo (checkpoint 5): solo se construye/añade si hay tormenta — así una
  // escena sin tormenta no paga ningún coste extra ni en memoria ni en el
  // bucle de animación.
  const tormenta = esTormenta(codigoTiempo);
  const rayo = tormenta ? construirRayo(objetivo, radio) : null;
  if (rayo) scene.add(rayo);

  renderer.render(scene, camera);

  // Bucle de animación (checkpoint 5, pedido explícito — antes la escena
  // era estática, un único render por carga/cambio de datos, deliberado
  // por batería en un PWA de móvil; se revierte esa decisión a petición
  // expresa, documentado en docs/estado.md). Se pausa con
  // document.visibilitychange (pestaña en segundo plano) para no gastar
  // batería de fondo — es la mitigación barata al coste de tener un bucle
  // continuo, no una reconsideración de si merece la pena tenerlo.
  // Reloj propio en vez de THREE.Clock (deprecado en esta versión de
  // Three.js en favor de THREE.Timer, que requiere llamar a su propio
  // update() cada frame — para lo que hace falta aquí, un cronómetro que se
  // pueda pausar/retomar, un par de líneas con performance.now() es más
  // simple que adoptar esa API nueva).
  let tiempoBase = performance.now();
  let tiempoAcumulado = 0;
  let idAnimacion = null;
  function animar() {
    idAnimacion = requestAnimationFrame(animar);
    const tiempo = tiempoAcumulado + (performance.now() - tiempoBase) / 1000;
    animarNubes(grupoNubes, tiempo);
    animarLluvia(grupoLluvia, tiempo);
    animarViento(grupoViento, tiempo);
    animarFilamentos(grupoFilamentos, tiempo, viento);
    if (rayo) {
      const flash = animarRayo(rayo, tiempo);
      // El flash ilumina brevemente el resto de la escena, no solo el
      // trazo del rayo — así se lee como un destello real, no una línea
      // que se enciende sola en la nada.
      luzAmbiental.intensity = intensidadAmbiental + flash * 1.1;
    }
    renderer.render(scene, camera);
  }
  function alCambiarVisibilidad() {
    if (document.hidden) {
      if (idAnimacion !== null) cancelAnimationFrame(idAnimacion);
      idAnimacion = null;
      tiempoAcumulado += (performance.now() - tiempoBase) / 1000; // congela el tiempo transcurrido hasta ahora
    } else if (idAnimacion === null) {
      tiempoBase = performance.now(); // el tiempo en segundo plano no cuenta
      animar();
    }
  }
  document.addEventListener('visibilitychange', alCambiarVisibilidad);
  animar();

  // Ejes propios de la cámara ("derecha"/"arriba" tal y como se ven en
  // pantalla), sacados de su matriz de mundo una única vez — la rotación
  // de la cámara no vuelve a tocarse nunca (ni aquí ni en el paneo de más
  // abajo, ni siquiera al redimensionar), así que estos dos vectores son
  // válidos para toda la vida de la escena. `updateMatrixWorld()` hace
  // falta porque la cámara todavía no se ha renderizado ni una vez en
  // este punto (matrixWorld empieza como identidad hasta la primera
  // actualización).
  camera.updateMatrixWorld();
  const basisDerecha = new THREE.Vector3();
  const basisArriba = new THREE.Vector3();
  camera.matrixWorld.extractBasis(basisDerecha, basisArriba, new THREE.Vector3());

  // Paneo acumulado (arrastre con un dedo), en unidades de mundo a lo
  // largo de `basisDerecha`/`basisArriba` — se reaplica tal cual tras cada
  // redimensionar (más abajo) y en cada gesto de paneo nuevo.
  let panDerecha = 0;
  let panArriba = 0;
  const LIMITE_PAN = radio * 0.7;
  const ZOOM_MIN = 1;
  const ZOOM_MAX = 3.5;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  // El límite de paneo depende del zoom actual, no es un tope fijo —
  // pedido explícito: "cuando se haga el mínimo zoom... no haya
  // posibilidad de moverse hacia los lados. si no, queda raro que quites
  // el zoom y la isla no esté en medio". Con el zoom mínimo (toda la
  // escena ya visible, sin margen que recorrer) el límite es 0: cualquier
  // intento de paneo se recorta a nada. El límite crece de forma lineal
  // hasta `LIMITE_PAN` en el zoom máximo.
  function limitePanActual() {
    const t = clamp((camera.zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN), 0, 1);
    return LIMITE_PAN * t;
  }
  // Recorta el paneo acumulado contra el límite del zoom actual y aplica
  // solo la diferencia a `camera.position` — se llama tanto al arrastrar
  // como cada vez que cambia el zoom (no solo al final de un pellizco),
  // así que alejar el zoom del todo siempre devuelve la isla al centro
  // sobre la marcha, en vez de dejar un paneo "colgado" a la espera de
  // otro arrastre.
  function recortarPan() {
    const limite = limitePanActual();
    const nuevoPanDerecha = clamp(panDerecha, -limite, limite);
    const nuevoPanArriba = clamp(panArriba, -limite, limite);
    camera.position.addScaledVector(basisDerecha, nuevoPanDerecha - panDerecha);
    camera.position.addScaledVector(basisArriba, nuevoPanArriba - panArriba);
    panDerecha = nuevoPanDerecha;
    panArriba = nuevoPanArriba;
  }

  function redimensionar() {
    const w = contenedor.clientWidth;
    const h = contenedor.clientHeight;
    renderer.setSize(w, h);
    const nuevaCamara = construirCamara(objetivo, radio, azimutBase, w / h);
    camera.left = nuevaCamara.left;
    camera.right = nuevaCamara.right;
    camera.top = nuevaCamara.top;
    camera.bottom = nuevaCamara.bottom;
    // Rotación primero, con la posición SIN panear (igual que en la
    // construcción inicial) — si se paneara antes de mirar a `objetivo`,
    // `lookAt` recalcularía el ángulo desde un punto descentrado y el
    // encuadre isométrico cambiaría un poco en cada resize mientras
    // hubiera paneo activo. El paneo se reaplica DESPUÉS, como una simple
    // traslación que no toca la rotación ya fijada.
    camera.position.copy(nuevaCamara.position);
    camera.lookAt(objetivo);
    camera.position.addScaledVector(basisDerecha, panDerecha);
    camera.position.addScaledVector(basisArriba, panArriba);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', redimensionar);

  // Pellizco para zoom + arrastre con un dedo para paneo, sin cambiar de
  // ángulo en ningún caso (pedido explícito: "que se pueda mover... no es
  // un cambio de ángulo") — cámara ortográfica fija, sin OrbitControls
  // (spec.md §6.1). El zoom solo toca `camera.zoom` (un escalar sobre el
  // frustum ya calculado); el paneo solo traslada `camera.position` a lo
  // largo de sus propios ejes derecha/arriba (nunca su rotación) — así se
  // puede recentrar la vista sobre el árbol, el buzón, etc. sin que la
  // cámara gire ni un grado. `touch-action: pan-y` (estilo.css) deja que
  // el navegador siga gestionando el scroll vertical de un dedo donde la
  // escena es un hero dentro de una página más larga (por si se
  // reutiliza `#escena3d-hero`), pero no reserva ningún gesto de la
  // escena para su propio scroll/zoom de página — así los toques llegan
  // aquí para gestionarlos a mano.
  let modoToque = null; // 'pan' | 'pinch' | null
  let panToquePrevio = null; // {x,y} en píxeles CSS del dedo único
  let pinchDistanciaInicial = null;
  let pinchZoomInicial = camera.zoom;

  function distanciaEntreDedos(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function empezarPan(touch) {
    modoToque = 'pan';
    panToquePrevio = { x: touch.clientX, y: touch.clientY };
  }
  function empezarPinch(touches) {
    modoToque = 'pinch';
    pinchDistanciaInicial = distanciaEntreDedos(touches);
    pinchZoomInicial = camera.zoom;
  }

  function alEmpezarToque(evento) {
    if (evento.touches.length === 1) {
      empezarPan(evento.touches[0]);
    } else if (evento.touches.length === 2) {
      empezarPinch(evento.touches);
    } else {
      modoToque = null;
    }
  }
  function alMoverToque(evento) {
    if (modoToque === 'pan' && evento.touches.length === 1) {
      evento.preventDefault();
      const toque = evento.touches[0];
      const dxPx = toque.clientX - panToquePrevio.x;
      const dyPx = toque.clientY - panToquePrevio.y;
      panToquePrevio = { x: toque.clientX, y: toque.clientY };

      // Píxeles CSS -> unidades de mundo: el ancho/alto visible en mundo
      // (ya con el zoom actual aplicado) repartido en los píxeles reales
      // del contenedor.
      const mundoPorPixelX = (camera.right - camera.left) / camera.zoom / contenedor.clientWidth;
      const mundoPorPixelY = (camera.top - camera.bottom) / camera.zoom / contenedor.clientHeight;
      // Arrastrar hacia la izquierda/abajo debe traer contenido de la
      // derecha/arriba al centro -> la cámara se mueve en la dirección
      // CONTRARIA al arrastre (mismo criterio que arrastrar un mapa). El
      // límite es el del zoom ACTUAL, no el fijo — con el zoom mínimo
      // (`limitePanActual()===0`) el arrastre no mueve nada.
      const limite = limitePanActual();
      const nuevoPanDerecha = clamp(panDerecha - dxPx * mundoPorPixelX, -limite, limite);
      const nuevoPanArriba = clamp(panArriba + dyPx * mundoPorPixelY, -limite, limite);
      camera.position.addScaledVector(basisDerecha, nuevoPanDerecha - panDerecha);
      camera.position.addScaledVector(basisArriba, nuevoPanArriba - panArriba);
      panDerecha = nuevoPanDerecha;
      panArriba = nuevoPanArriba;
    } else if (modoToque === 'pinch' && evento.touches.length === 2) {
      evento.preventDefault();
      const distanciaActual = distanciaEntreDedos(evento.touches);
      const factor = distanciaActual / pinchDistanciaInicial;
      camera.zoom = clamp(pinchZoomInicial * factor, ZOOM_MIN, ZOOM_MAX);
      camera.updateProjectionMatrix();
      // El zoom acaba de cambiar -> el paneo permitido también, y hay que
      // recortar el ya acumulado contra el nuevo límite ahora mismo (no
      // solo la próxima vez que se arrastre) para que cerrar el pellizco
      // del todo recentre la isla sobre la marcha.
      recortarPan();
    }
  }
  function alSoltarToque(evento) {
    // Al levantar un dedo de un pellizco queda uno solo — retoma el
    // paneo desde la posición actual de ese dedo (sin salto, sin
    // recordar de dónde venía el pellizco) en vez de quedarse sin
    // gestionar nada hasta un gesto completamente nuevo.
    if (evento.touches.length === 0) {
      modoToque = null;
    } else if (evento.touches.length === 1) {
      empezarPan(evento.touches[0]);
    } else if (evento.touches.length === 2) {
      empezarPinch(evento.touches);
    }
  }
  renderer.domElement.addEventListener('touchstart', alEmpezarToque, { passive: true });
  renderer.domElement.addEventListener('touchmove', alMoverToque, { passive: false });
  renderer.domElement.addEventListener('touchend', alSoltarToque);
  renderer.domElement.addEventListener('touchcancel', alSoltarToque);

  return { renderer, scene, camera };
}

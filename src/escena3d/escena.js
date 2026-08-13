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
import { direccionSol, factorIntensidadSol } from './iluminacion.js';

// Paleta aclarada tras feedback ("demasiado oscuro, más cálido y chill") —
// todos los tonos subieron de luminosidad, no solo de saturación; el
// oscurecimiento venía en parte de la luz (ver luzRelleno más abajo), no
// solo del color base de cada material.
const COLOR_FONDO = 0xfbf1de; // cálido, no "sala de control" (CLAUDE.md)
const COLOR_SUELO = 0xe8c99c; // tono madera cálida, más claro
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

// Offset de azimut de la cámara respecto a la normal de la ventana A, y
// elevación angular. Punto de partida para el checkpoint 1 — se afina a ojo
// con la primera captura, no es un valor derivado de ningún dato real.
const CAMARA_AZIMUT_OFFSET_DEG = 45;
const CAMARA_ELEVACION_DEG = 35.264; // isométrico clásico (atan(1/√2))
const CAMARA_MARGEN = 1.6; // factor de zoom-out sobre el tamaño de la habitación

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

function construirPared(pared, signoCamara, entorno) {
  const grosor = pared.cristal ? 0.05 : 0.15;
  const geometria = new THREE.BoxGeometry(pared.ancho, pared.alto, grosor);
  // DoubleSide: sin esto, la pared "lejana" desde la cámara (cara frontal
  // apuntando hacia fuera de la caja, en dirección contraria a la cámara)
  // no se dibuja en absoluto — con paredes opuestas de cristal (A y B) eso
  // significa no ver nunca la ventana lejana, justo lo que la cámara de
  // esquina (ver construirCamara) pretende evitar.
  // Historial de la opacidad de las paredes opacas: 0.5 y 0.85 causaron
  // tres problemas por turnos (lavado del suelo, lío de profundidad con
  // los reflejos del cristal contiguo, contorno de mezcla en el borde de
  // silueta — este último inherente a cualquier opacidad menor que 1, no
  // arreglable con depthWrite). Pedido explícito: la pared MÁS CERCANA a la
  // cámara necesita ser más transparente que la del fondo (para poder ver
  // el interior), así que ya no comparten un único valor — signoCamara
  // (+1 = la cámara está del lado de la normal, la pared "cercana") decide
  // cuál de las dos usar.
  const opacidadParedOpaca = signoCamara === 1 ? OPACIDAD_PARED_OPACA_CERCA : OPACIDAD_PARED_OPACA_LEJOS;
  // Cristal: roughness casi 0, algo de metalness, y envMap (solo el
  // cristal, no toda la escena — ver crearEscena3D) — pedido explícito de
  // mejorar el realismo dentro del estilo actual, sin texturas externas.
  // Le da al cristal un reflejo sutil del entorno cálido además del brillo
  // especular directo de la luz — sigue siendo un material sencillo, no un
  // cristal físicamente exacto.
  const material = new THREE.MeshStandardMaterial({
    color: pared.cristal ? COLOR_CRISTAL : COLOR_PARED,
    transparent: true,
    opacity: pared.cristal ? OPACIDAD_CRISTAL : opacidadParedOpaca,
    roughness: pared.cristal ? 0.02 : 0.9,
    metalness: pared.cristal ? 0.15 : 0,
    envMap: pared.cristal ? entorno : null,
    envMapIntensity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: !pared.cristal,
  });
  const malla = new THREE.Mesh(geometria, material);

  malla.position.set(pared.centro.x, pared.centro.y, pared.centro.z);
  // Las paredes opacas sí proyectan sombra; el cristal no (dejaría de
  // entrar sol nunca por esa ventana, pedido explícito de mantenerlo así
  // en el checkpoint 3).
  malla.castShadow = !pared.cristal;
  // receiveShadow — antes solo lo tenía el suelo (construirSuelo): la
  // sombra del marco de la ventana contigua nunca se notaba sobre una
  // pared, solo en el suelo. Pedido explícito: que también se vea en la
  // pared del fondo.
  malla.receiveShadow = true;

  // Orientar la pared: su normal (eje +Z local del BoxGeometry, grosor)
  // debe apuntar en la dirección `pared.normal`.
  const normal = new THREE.Vector3(pared.normal.x, pared.normal.y, pared.normal.z);
  const arriba = new THREE.Vector3(0, 1, 0);
  const objetivo = new THREE.Vector3(pared.centro.x, pared.centro.y, pared.centro.z).add(normal);
  malla.lookAt(objetivo);
  malla.userData.esPared = true;
  if (pared.cristal) {
    construirReflejosCristal(pared, signoCamara).forEach((r) => malla.add(r));
    construirMarcoVentana(pared).forEach((r) => malla.add(r));
  }
  return malla;
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

function construirReflejosCristal(pared, signoCamara) {
  const largo = (pared.alto / 2) * 0.55;
  const material = new THREE.MeshBasicMaterial({
    color: COLOR_REFLEJO,
    transparent: true,
    opacity: OPACIDAD_REFLEJO,
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

// Quad plano horizontal a partir de 4 esquinas en espacio de mundo (no un
// PlaneGeometry alineado a los ejes del mundo + rotación: la habitación
// está rotada al azimut real de la ventana A, y un plano sin rotar dejaba
// huecos/salientes en las esquinas frente a las paredes).
//
// Geometría INDEXADA (4 vértices únicos + índice [0,1,2, 0,2,3]), no 6
// vértices sueltos duplicados en dos triángulos separados: con vértices
// duplicados, aunque tengan la misma normal calculada, seguía viéndose una
// costura diagonal de esquina a esquina (más visible cuanto más contraste
// de luz/sombra había) — algo de precisión/redondeo entre las dos copias
// "iguales" del vértice compartido. Con índice de verdad ambos triángulos
// comparten el mismo vértice en memoria, no dos copias distintas: no hay
// nada que pueda desalinearse. computeVertexNormals() sobre esta versión
// indexada promedia correctamente en el vértice compartido — antes
// (checkpoint 1) se probó computeVertexNormals() sin indexar y sí se veía
// una costura, pero esa era la causa (vértices duplicados), no el cálculo
// de normales en sí.
function construirQuadPlano([p1, p2, p3, p4], material) {
  const vertices = new Float32Array([
    p1.x, p1.y, p1.z,
    p2.x, p2.y, p2.z,
    p3.x, p3.y, p3.z,
    p4.x, p4.y, p4.z,
  ]);
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometria.setIndex([0, 1, 2, 0, 2, 3]);
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
  const malla = construirQuadPlano(geo.esquinasSuelo, material);
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
  const esquinasTecho = geo.esquinasSuelo.map((p) => ({ ...p, y: geo.altura }));
  const material = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const malla = construirQuadPlano(esquinasTecho, material);
  malla.castShadow = true;
  return malla;
}

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
function construirCamara(objetivo, radio, azimutBaseDeg, aspecto) {
  const azimutCamara = (azimutBaseDeg + CAMARA_AZIMUT_OFFSET_DEG) * (Math.PI / 180);
  const elevRad = CAMARA_ELEVACION_DEG * (Math.PI / 180);

  const distancia = radio * CAMARA_MARGEN;

  const x = objetivo.x + distancia * Math.sin(azimutCamara) * Math.cos(elevRad);
  const z = objetivo.z + distancia * Math.cos(azimutCamara) * Math.cos(elevRad);
  const y = objetivo.y + distancia * Math.sin(elevRad);

  const alcanceVertical = radio * CAMARA_MARGEN * 0.6;
  const alcanceHorizontal = alcanceVertical * aspecto;

  const camara = new THREE.OrthographicCamera(
    -alcanceHorizontal,
    alcanceHorizontal,
    alcanceVertical,
    -alcanceVertical,
    0.1,
    distancia * 3,
  );
  camara.position.set(x, y, z);
  camara.lookAt(objetivo);
  return camara;
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
  luz.shadow.mapSize.set(1024, 1024);
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
  luz.shadow.bias = -0.0015;
  // normalBias (no solo bias): sin esto se veía un contorno fino de
  // autosombra justo en la base de las paredes, donde tocan el suelo —
  // "shadow acne" típico en la costura de contacto entre un objeto vertical
  // y la superficie que lo recibe. normalBias desplaza el muestreo del
  // shadow map a lo largo de la normal de la superficie, que corrige mejor
  // este caso que subir el bias plano.
  luz.shadow.normalBias = 0.03;
  luz.shadow.radius = 3; // solo tiene efecto con VSMShadowMap — sombra suave, no de borde duro
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

export function crearEscena3D(contenedor, parametrosPiso, sol) {
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
  scene.background = new THREE.Color(COLOR_FONDO);
  // Sin scene.environment: afecta a TODOS los materiales de la escena, no
  // solo al cristal — probado, y lavaba el contraste de luz/sombra del
  // suelo y las paredes opacas por completo. El entorno se pasa como
  // envMap solo al material del cristal (construirPared), no globalmente.
  const entorno = crearEntornoProcedural(renderer);

  const geo = calcularGeometria(parametrosPiso);

  // Se necesita antes de construir las paredes, para el offset de los
  // reflejos del cristal (signoHaciaCamara) — no se puede esperar a tener
  // la cámara ya construida más abajo.
  const azimutBase = Math.atan2(geo.ejeProfundidad.x, geo.ejeProfundidad.z) * (180 / Math.PI);
  const dirCamaraXZ = direccionCamaraXZ(azimutCamaraDeg(azimutBase));

  scene.add(construirSuelo(geo));
  scene.add(construirTecho(geo));
  geo.paredes.forEach((pared) => scene.add(construirPared(pared, signoHaciaCamara(pared, dirCamaraXZ), entorno)));

  const objetivo = new THREE.Vector3(0, geo.altura / 2, 0);
  const radio = calcularRadioEscena(scene, objetivo);
  const camera = construirCamara(objetivo, radio, azimutBase, ancho / alto);

  // Ambiental baja — solo evita que la cara que no mira al sol se vaya a
  // negro puro — para que la sombra real (ahora que sí se ve, tras el
  // arreglo de la normal del suelo) se note claramente y no quede diluida
  // por un relleno ambiental demasiado fuerte (pedido explícito: sombra
  // más marcada).
  scene.add(new THREE.AmbientLight(0xfff3e0, 0.35));
  scene.add(construirLuzSol(sol, objetivo, radio));

  renderer.render(scene, camera);

  function redimensionar() {
    const w = contenedor.clientWidth;
    const h = contenedor.clientHeight;
    renderer.setSize(w, h);
    const nuevaCamara = construirCamara(objetivo, radio, azimutBase, w / h);
    camera.left = nuevaCamara.left;
    camera.right = nuevaCamara.right;
    camera.top = nuevaCamara.top;
    camera.bottom = nuevaCamara.bottom;
    camera.position.copy(nuevaCamara.position);
    camera.lookAt(objetivo);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  window.addEventListener('resize', redimensionar);

  return { renderer, scene, camera };
}

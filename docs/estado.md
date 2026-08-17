# Estado del proyecto

Última actualización: 2026-08-17 (rediseño del motor de recomendación —
busca el mejor instante de cambio en vez de una decisión fija para todo el
horizonte, y el modelo de ventilación ya tiene en cuenta la persiana y el
viento real — ver "Correcciones post-lanzamiento" al final del documento)

Trabajamos una fase por sesión. Al empezar una sesión nueva: lee este archivo,
confirma en qué fase estamos, y no avances a la siguiente fase sin que la actual
tenga sus tests/verificación pasando y esté commiteada.

## Hecho

- **Fase 1 — Modelo puro.** Modelo térmico RC, sombra por ventana y motor de
  recomendación implementados como funciones puras en `src/model/` (sin APIs
  reales, sin persistencia, sin interfaz). 33 casos de prueba manuales en
  `test/model.test.js`, verificables a ojo (imprimen valores intermedios) y
  con `assert`. Ejecutar con `npm test`.
- **Fase 2 — Datos reales.** Capa de datos en `src/data/` (`ubicacion.js`,
  `sol.js`, `openMeteo.js`, `adaptador.js`) que alimenta el modelo puro de la
  Fase 1 con clima real (Open-Meteo, minutely_15, 8h de pronóstico) y
  posición solar real (SunCalc), sin modificar `src/model/`. El adaptador
  produce exactamente las mismas formas de datos que usaban los casos de
  prueba de la Fase 1 (`sol: {elevacion, azimut, nubesPct}`,
  `pronostico: [{tOut, sol}, ...]`). Verificación manual con datos reales de
  Pamplona en `test/datos-reales.test.js` (imprime valores intermedios y
  comprueba rangos físicos), ejecutar con `npm run test:datos` (requiere
  red; no forma parte de `npm test`).
- **Fase 3 — Persistencia.** Módulos `src/persistencia/piso.js` y
  `src/persistencia/anotaciones.js`, con el `storage` (interfaz
  getItem/setItem, igual que `localStorage`) recibido como parámetro en vez
  de leer `window.localStorage` directamente, para poder testear sin
  navegador. `guardarParametrosPiso`/`cargarParametrosPiso` persisten bajo
  la clave `solana:parametrosPiso`, con default embebido para el primer
  arranque; `guardarAnotacion`/`listarAnotaciones` persisten un array bajo
  `solana:anotaciones`. 7 casos de prueba manuales en
  `test/persistencia.test.js` con un storage falso en memoria, integrados en
  `npm test`.
- **Fase 4 — Pantalla de parámetros.** Primera fase de interfaz. Vite +
  JS vanilla (sin framework), `index.html` en la raíz + `src/ui/`
  (`main.js`, `parametros.js`, `validacion.js`, `estilo.css`), que consume
  `src/persistencia/` y `src/data/` tal cual, sin tocarlos. Nuevo módulo
  `src/persistencia/ubicacion.js` (paralelo a `piso.js`, clave
  `solana:ubicacion`) para hacer editable de verdad la ubicación (spec.md
  §3.1), que hasta ahora era una constante fija. Formulario con validación
  por rangos (`src/ui/validacion.js`, funciones puras testeadas en
  `test/validacion.test.js`, 16 casos integrados en `npm test`) y dos
  secciones visualmente distintas para separar datos fijos de parámetros
  calibrables por la Fase 7 (detalle en "Decisiones tomadas").
- **Fase 5 — Dashboard.** `index.html` pasa a montar la pantalla principal
  (`src/ui/dashboard.js`); la pantalla de parámetros se muda a
  `parametros.html` (`src/ui/main-parametros.js`), con enlaces cruzados
  entre ambas. El dashboard orquesta, sin tocarlos: `obtenerDatosReales`
  (Fase 2) para clima/pronóstico en vivo, con refresco automático cada 15
  min + botón manual; `recomendarVentana`/`recomendarPersiana` (Fase 1)
  por ventana; y persistencia (`piso.js`, `ubicacion.js`, `anotaciones.js`
  de Fases 3-4). Módulo nuevo `src/persistencia/estadoVentanas.js`
  (clave `solana:estadoVentanas`) para el estado físico real
  ventana-abierta/persiana-arriba, que declara el usuario con toggles
  porque no hay sensores. Módulo nuevo `src/ui/antiguedadAnotacion.js`
  (funciones puras) para decidir si la última anotación está fresca,
  merece un aviso o ha caducado (umbrales 3h/12h, motivo detallado en
  "Decisiones tomadas"); sin anotación válida no se fabrica una
  recomendación. 16 casos de prueba manuales nuevos
  (`test/estadoVentanas.test.js`, `test/antiguedadAnotacion.test.js`),
  integrados en `npm test`. Verificación visual con
  `scripts/captura-pantalla.mjs`, script de Playwright reutilizable
  (committeado, a diferencia de la verificación ad-hoc de la Fase 4) que
  espera a `[data-cargado="true"]` en vez de un timeout fijo — comprobado
  a ojo en los estados sin anotación, con anotación, con toggles, con
  validación de rango y con fallo de red simulado.
- **Fase 6 — Escena 3D, completa.** `src/escena3d/`
  (`geometria.js`, `iluminacion.js`, `escena.js`) con Three.js
  (`0.185.1`, pinneada exacta como `playwright`), montada de forma
  aislada en `escena3d.html`/`src/ui/main-escena3d.js` para iterar
  visualmente (checkpoints 1-23, resumen detallado en "Fase actual" y
  "Decisiones tomadas" de cada checkpoint), e integrada al final
  (checkpoint 24) en `index.html` junto al dashboard vía
  `src/ui/escena3dDashboard.js`, con datos reales (no el override de
  depuración, que sigue existiendo solo en la página aislada). Habitación
  como
  caja rectangular con las dos ventanas de cristal completo (suelo a
  techo) en paredes opuestas, marco en cruz + perimetral por ventana con
  sombra 3D real (`castShadow`/`receiveShadow`, sol real vía
  `posicionSolar` + `DirectionalLight`), cámara ortográfica fija estilo
  Los Sims (con composición distinta en retrato para móvil). El edificio
  enfrente y el parche de sol en el suelo se probaron y se descartaron —
  detalle completo en "Decisiones tomadas". Nubes (cúmulos de sprites con
  textura procedural, cantidad variable según nubosidad, con deriva y
  algo de aleatoriedad entre cargas), lluvia (partículas pequeñas
  cayendo rápido y en vertical, densidad+velocidad reales, sin
  agrupamientos), tormenta con dato real de Open-Meteo (`weather_code`,
  no una heurística) con rayos, noche (cielo y luz oscurecen según
  elevación solar real, reflejo de cristal atenuado también de noche) y
  viento (polvo en suspensión con trayectoria turbulenta + estela +
  alguna hoja, dirección/velocidad reales) — con bucle de animación
  (`requestAnimationFrame`, pausado en pestaña oculta) que revierte la
  decisión inicial de escena estática, a petición expresa del usuario.
  **La habitación ya no está sobre un suelo plano infinito: flota en una
  isla** (cono invertido de tierra con rocas + tapa de hierba), con un
  árbol simple detrás y un charco que crece durante la lluvia; el cielo
  es un degradado horizonte↔cénit que también evoluciona con la hora y la
  nubosidad. Override de depuración
  `?debugHora=&debugNubes=&debugLluvia=&debugViento=&debugVientoDir=&debugCodigoTiempo=`
  en `escena3d.html` (banner "MODO DEBUG" visible, con un panel para
  rellenar esos mismos parámetros a mano sin editar la URL), puramente
  visual — no toca `localStorage`. 20 casos de prueba puros
  (`test/escena3d-geometria.test.js`, `test/escena3d-iluminacion.test.js`,
  sin casos nuevos para nubes/lluvia/noche/rayos/viento/isla — viven en
  `escena.js`, la capa impura, verificada visualmente igual que el resto
  del fichero), integrados en `npm test`. Verificación visual con
  `scripts/captura-escena3d.mjs` (mismo patrón que `captura-pantalla.mjs`,
  con espera opcional en ms para capturar la animación en marcha, y
  viewport opcional para verificar el layout de móvil).
- **Fase 7 — Histórico, completa.** Predicho vs. real (spec.md §6.4) y
  recalibración automática de `UA`/`factorCapacidad` (§4.2), resolviendo un
  hueco real que la spec no cubría: no existía ningún histórico de clima
  ni de estado de ventanas con el que reconstruir qué predecía el modelo
  en el pasado. Solución — "gemelo en vivo"
  (`src/model/gemelo.js`): un `T_in` simulado que avanza un paso
  (`pasoGemelo`) cada vez que el dashboard refresca clima (cada 15 min o al
  pulsar "Actualizar"), usando clima y estado de ventanas reales del
  instante, persistido en `src/persistencia/gemelo.js`
  (`solana:gemelo`); huecos largos (app cerrada) se rellenan repitiendo el
  último clima conocido en pasos de 15 min (`simularHorizonte`, ya
  existente), no con un único salto de Euler inestable. Al anotar
  (`dashboard.js`), el valor del gemelo justo antes de corregirse es el
  `predicho` de esa anotación (null en la primera anotación o si no hubo
  ningún tick de por medio) — se guarda junto con la anotación
  (`predicho`/`avgConduccion`/`avgSolarVent`, campos nuevos en
  `anotaciones.js`) y el gemelo se reinicia al valor real. Recalibración
  (`src/model/recalibracion.js`): cada anotación no etiquetada con
  regresores calculados aporta una fila a una regresión lineal por mínimos
  cuadrados (`dT_in/dt = a·(T_out−T_in) + b·(Q_solar+Q_vent)`, con
  `a=UA/C`, `b=1/C`) sobre las últimas 30, con guardas de seguridad (mínimo
  10 filas, sistema no degenerado, resultado dentro de rangos físicos
  plausibles) antes de sobrescribir `parametrosPiso` — se dispara sola tras
  cada anotación no etiquetada. Pantalla nueva `historico.html`
  (`src/ui/historico.js`, montada vía `src/ui/main-historico.js`) con
  Chart.js (dependencia nueva, primera de UI del proyecto): gráfica de
  predicho vs. real, puntos etiquetados marcados en un color distinto y
  excluidos del error medio mostrado, más una tarjeta de solo lectura con
  `UA`/`factorCapacidad` actuales. 16 casos de prueba puros nuevos
  (`test/gemelo.test.js`, `test/recalibracion.test.js`, incluida una
  recuperación exacta de `UA`/`factorCapacidad` sintéticos por mínimos
  cuadrados sin ruido) más 4 nuevos en `test/persistencia.test.js`,
  integrados en `npm test`. Verificación visual con
  `scripts/captura-historico.mjs` (mismo patrón que `captura-pantalla.mjs`,
  sembrando anotaciones sintéticas en `localStorage` con
  `page.addInitScript` ya que esta pantalla no hace ningún fetch) y una
  comprobación funcional de extremo a extremo contra `index.html` con red
  real (primera anotación con `predicho: null`, segunda con `predicho`
  calculado de verdad). Un bug real encontrado y corregido por el camino
  — ver "Decisiones tomadas".
- **Fase 8 — PWA, completa. Cierra la spec entera.** `vite-plugin-pwa`
  (`generateSW`) genera `manifest.webmanifest` + service worker que
  precachea el app shell completo (las 4 páginas — dashboard, parámetros,
  histórico, escena3d — y todo su JS/CSS/iconos) para conexión
  intermitente (spec.md §7); regla `runtimeCaching` explícita con
  `NetworkOnly` para `api.open-meteo.com` — el clima nunca se sirve de
  caché, solo de red real, coherente con "los datos de clima requieren
  red" de la spec. `skipWaiting`+`clientsClaim` para que la primera visita
  ya quede controlada offline sin que el usuario tenga que recargar.
  Registro del service worker manual (`src/ui/registrarServiceWorker.js`,
  `virtual:pwa-register`) importado por los 3 puntos de entrada reales
  (`main.js`, `main-parametros.js`, `main-historico.js`) en vez de la
  inyección automática del plugin — más explícito y verificable en un
  sitio multi-página; `escena3d.html` (página de depuración aislada, no
  parte de la app instalable) no lo registra. Iconos propios nuevos
  (`public/icons/`, SVG generado con la paleta cálida ya existente en
  `estilo.css` — casa con dos ventanas y sol sobre fondo `--acento`,
  ninguna dependencia de diseño externa) en 192/512/apple-touch-icon/
  maskable. Repo real creado (`github.com/andereslavarodriguez/solana`,
  público) y desplegado a GitHub Pages
  (`https://andereslavarodriguez.github.io/solana/`) vía
  `.github/workflows/deploy.yml` (`npm test` → `npm run build` → GitHub
  Pages), con GitHub Pages configurado con origen "GitHub Actions".
  Verificado con Playwright contra un build real (`vite preview`): las 4
  páginas cargan con `context.setOffline(true)` (red cortada de verdad,
  no solo caché de navegador) y el fetch a Open-Meteo falla como se
  pretende en vez de servirse de una respuesta cacheada; capturada
  también la app ya desplegada en producción funcionando con datos reales
  (clima, sol, fase lunar). Detalle completo de decisiones (elección de
  `injectRegister: false`, `navigateFallback: null` por ser multi-página
  y no SPA, nombre/visibilidad del repo, instalación de `gh` CLI) en
  "Decisiones tomadas" más abajo.

## Fase actual

Las 8 fases de spec.md están completas — no queda ninguna fase
pendiente. La app está desplegada y funcionando en
`https://andereslavarodriguez.github.io/solana/`, instalable desde
Android/Chrome vía "Añadir a pantalla de inicio". Trabajo futuro (fuera
de alcance de v1, spec.md §8) o pendientes ya anotados a lo largo de
este documento (p.ej. revisar umbrales 3h/12h y `MINIMO_FILAS_RECALIBRACION`
con uso real, considerar integrar `weathercode` donde todavía falta,
posibles mejoras de iluminación de la escena 3D propuestas y no
implementadas en el checkpoint 18) quedan para cuando el propio uso
diario del piso real dé motivo para revisarlos — no hay una "Fase 9"
planificada en la spec.

El uso diario real ya dio motivo para una revisión: dos bugs reales en el
motor de recomendación (`src/model/recomendacion.js`) que daban avisos
absurdos de noche, corregidos el 2026-08-16 — ver "Correcciones
post-lanzamiento" al final de este documento.

## Fases

- [x] **Fase 1 — Modelo puro.** Modelo térmico RC (spec.md §4), cálculo de sombra
      por ventana (§4.1) y motor de recomendación (§5), como funciones puras de
      JS con datos de prueba inventados (sin APIs reales todavía). Casos de
      prueba manuales que se puedan verificar a ojo.
- [x] **Fase 2 — Datos reales.** Integrar Open-Meteo (minutely_15, clima +
      pronóstico 6-8h) y SunCalc (posición solar). Sustituir los datos de
      prueba de la Fase 1 por reales. Verificar que los números tienen sentido
      para la ubicación y el momento actual.
- [x] **Fase 3 — Persistencia.** Guardar en localStorage los parámetros del
      piso/edificios y las anotaciones de temperatura (con sus etiquetas
      opcionales, spec.md §3.5).
- [x] **Fase 4 — Pantalla de parámetros.** Interfaz para editar la geometría
      del piso, ventanas y edificios obstáculo (spec.md §3.4, §6.3).
- [x] **Fase 5 — Dashboard.** Pantalla principal: clima en vivo, recomendación
      independiente por ventana (ventana + persiana), botón de anotar
      temperatura (spec.md §6.2).
- [x] **Fase 6 — Escena 3D.** Vista fija estilo Los Sims, geometría limpia,
      sol/sombra/nubes/lluvia en vivo (spec.md §6.1). Probablemente varias
      sesiones — no forzar que quepa en una.
- [x] **Fase 7 — Histórico.** Predicho vs. real, recalibración con las
      últimas ~30 anotaciones no etiquetadas (spec.md §4.2, §6.4).
- [x] **Fase 8 — PWA.** Manifest, service worker, instalable en Android
      (spec.md §7).

## Decisiones tomadas durante la construcción

### Fase 1 — Modelo puro

1. **Altura de referencia de ventana para el cálculo de sombra (§4.1).** Las
   ventanas son suelo-a-techo; se usa el punto medio vertical del hueco
   (`alturaTecho / 2`, ej. 1.25m con techo de 2.5m) como `altura_ventana` en
   `elevación_límite = atan((altura_edificio − altura_ventana) / distancia)`.
   Ni el alféizar (0) ni el techo.

2. **`I_max` (irradiancia proxy máxima).** Constante fija en código,
   1000 W/m² (`src/model/constantes.js`). No es un parámetro editable en la
   pantalla de parámetros (Fase 4).

3. **Modulación por nubosidad.** Lineal: `factorNubosidad(nubesPct) = 1 −
   nubesPct/100`, recortado a [0,1]. Implementada como función aislada en
   `src/model/irradiancia.js`, no inline en la fórmula de `Q_solar`.

4. **`cos(ángulo_incidencia)` para ventana vertical.**
   `cos(elevación) · cos(azimut_sol − azimut_ventana)`, recortado a 0 cuando
   sale negativo (sol detrás de la fachada o geometría rasante, incluido el
   caso de sol en el cénit).

5. **Regla de persiana (sustituye la tabla de 4 casos de §5 como algoritmo
   real).** Por ventana:
   - Si `T_in` actual ya supera el máximo de la banda de confort → persiana
     abajo, sin mirar `T_out`.
   - Si no, se simula la trayectoria de `T_in` en el horizonte de pronóstico
     con la persiana arriba (resto de estados como están ahora). Si esa
     trayectoria se mantiene dentro de la banda sin superar el máximo en
     ningún punto → persiana arriba; si lo supera en algún punto → persiana
     abajo.
   - Reutiliza `simularHorizonte()`, la misma simulación de horizonte que usa
     la recomendación de ventana.

6. **Histéresis.** No implementada en Fase 1. Pendiente explícito para
   Fase 2+ (banda muerta en `recomendarVentana`/`recomendarPersiana` para
   evitar oscilación de recomendaciones cuando se alimenten con datos en
   vivo, que cambian de forma continua en vez de a saltos como en los tests).

7. **Criterio de abrir/cerrar ventana (`recomendarVentana`, no detallado en
   §5).** Se simula la trayectoria de `T_in` en el horizonte con la ventana
   abierta todo el rato y con la ventana cerrada todo el rato (resto de
   estados fijos en su valor actual), y se compara la distancia acumulada de
   cada trayectoria a la banda de confort (suma de cuánto se sale de [min,
   max] en cada paso). Gana la que acumula menos distancia. Empate → se
   recomienda cerrar (por defecto no abrir si no hay beneficio claro).

8. **Simplificación en `recomendarPersiana` (confirmada, no es un descuido).**
   La regla dice "si esa trayectoria se mantiene dentro de la banda sin
   superar el máximo → arriba", en vez de comparar la distancia a la banda
   de la trayectoria con persiana arriba contra la de persiana abajo (como sí
   hace `recomendarVentana`). Es válido porque `Q_solar` nunca es negativo:
   subir la persiana solo puede añadir calor o dejarlo igual, nunca enfriar.
   Por tanto la única forma en que "persiana arriba" empeora respecto a
   "persiana abajo" es pasarse del máximo de la banda por arriba — nunca
   puede alejar más `T_in` por abajo. Comprobar solo si se supera el máximo
   ya captura el caso completo; no hace falta simular también la trayectoria
   con persiana abajo para comparar.

### Fase 2 — Datos reales

1. **Ubicación por defecto.** Centro de Pamplona (42.8125, -1.6458),
   confirmado con el usuario como valor de partida hasta que la pantalla de
   parámetros (Fase 4) permita introducir la ubicación real del piso.
   Vive en `src/data/ubicacion.js` como única fuente de verdad, para que la
   Fase 4 solo tenga que sustituir esa constante por un valor editable.

2. **Librería SunCalc: versión 2.x, no la clásica.** El paquete `suncalc`
   en npm (v2.0.1) ya devuelve `azimuth`/`altitude` en grados y en
   convención de brújula (0°=N, 90°=E, 180°=S, 270°=O) — no en radianes con
   azimut medido desde el sur, como la librería clásica de mourner que
   describen muchos tutoriales. Esto coincide exactamente con las
   convenciones que ya usaban `irradiancia.js`/`sombra.js` del modelo puro
   (mismas que `ventana.orientacion`), así que `src/data/sol.js` no aplica
   ninguna conversión de unidades. Si en el futuro se cambia de librería de
   posición solar, hay que revisar esto explícitamente.

3. **Variables pedidas a Open-Meteo.** `temperature_2m`, `precipitation`,
   `relative_humidity_2m`, `wind_speed_10m`, `cloud_cover`, todas en
   `minutely_15` (spec.md §3.2). Solo `temperature_2m` y `cloud_cover`
   alimentan el modelo térmico ahora mismo; las otras tres se piden ya
   porque las necesitará el dashboard (Fase 5) y es el mismo request.

4. **Horizonte de pronóstico: 8h fijas (32 pasos de 15min).** Parámetro por
   defecto de `obtenerDatosReales()`, dentro del rango 6-8h de spec.md §3.2.

5. **Un único fetch para "actual" + "pronóstico".** `adaptador.js` pide una
   sola vez `minutely_15` (con `past_minutely_15` por defecto en 0, así que
   el primer punto devuelto es el más cercano al instante presente) y deriva
   de ahí tanto `actual` como `pronostico`, en vez de hacer dos peticiones
   separadas. `pronostico` incluye ese primer punto (no empieza en el
   segundo), igual que hacían los arrays de prueba de la Fase 1.

6. **`npm run test:datos` separado de `npm test`.** La verificación con
   datos reales (`test/datos-reales.test.js`) depende de red y de la hora
   real, así que no es un test determinista: se deja fuera de `npm test`
   (que sigue verificando solo el modelo puro, sin red) y se ejecuta aparte.
   Comprueba rangos físicos (elevación, azimut, temperatura, nubosidad) en
   vez de valores exactos, y también imprime los intermedios para
   verificación a ojo, siguiendo el mismo patrón que `model.test.js`.

### Fase 3 — Persistencia

1. **`bandaConfort` pasa a formar parte de `parametrosPiso`.** Antes vivía
   como parámetro opcional de `recomendarVentana`/`recomendarPersiana` con
   default `BANDA_CONFORT` importado de `constantes.js`. Ahora ambas
   funciones leen `parametrosPiso.bandaConfort` (parámetro obligatorio, sin
   default en la firma) y `constantes.js` solo aporta el valor de partida
   dentro de `PARAMETROS_PISO_POR_DEFECTO`. Motivo: spec.md §6.3 la trata
   como un parámetro editable del piso, igual que `UA`/`SHGC`/etc., así que
   Fase 4 solo necesita una pantalla de edición, no dos mecanismos
   distintos.

2. **`storage` inyectado, no `window.localStorage` directo.** Tanto
   `piso.js` como `anotaciones.js` reciben `storage` (con `getItem`/
   `setItem`) como primer parámetro de cada función. Permite testear con un
   storage falso en memoria (`test/persistencia.test.js`) sin depender del
   navegador, siguiendo el mismo criterio de "verificable sin interfaz" que
   guio la Fase 1. Cuando exista interfaz (Fase 4+), se le pasará
   `window.localStorage` tal cual — cumple la misma interfaz.

3. **Claves de etiquetas de anotación (§3.5).** `'cocinando'`,
   `'climatizacion'`, `'masGente'`. `'climatizacion'` cubre tanto
   calefacción como aire acondicionado como un único factor — es como los
   trata spec.md §3.5 (un solo concepto de "climatización encendida"), así
   que no hace falta distinguir cuál de las dos es.

4. **`id` de anotación: `crypto.randomUUID()`, no el `timestamp`.**
   `timestamp` es el dato de cuándo ocurrió la anotación; `id` es su
   identidad. Si en el futuro se permite corregir el timestamp de una
   anotación ya guardada, no debe cambiar su identidad ni duplicarla.
   `crypto.randomUUID()` está disponible globalmente en Node 20 (usado en
   este proyecto) y en navegadores Android/Chrome modernos, sin dependencia
   añadida.

5. **`version: 1` en ambos objetos guardados.** `guardarParametrosPiso`
   envuelve el objeto completo en `{ version: 1, ...parametrosPiso }`; cada
   anotación individual (no el array que las contiene) lleva su propio
   `version: 1`. Objetivo: poder migrar el formato de cualquiera de los dos
   en el futuro sin romper datos ya guardados en el móvil de un usuario
   real. `cargarParametrosPiso` descarta el campo `version` al devolver el
   objeto (el modelo puro no lo espera); `listarAnotaciones` lo deja tal
   cual en cada elemento.

6. **Valores por defecto de `PARAMETROS_PISO_POR_DEFECTO`.** Geometría de
   ventanas y edificios enfrente: valores reales de spec.md §3.4. El resto
   (`superficie`, `UA`, `factorCapacidad`, `SHGC`, `renovacionesHora`):
   mismos valores de prueba que ya usaba `test/model.test.js` desde la Fase
   1 — sirven para que la app funcione en el primer arranque, pero no son
   defaults "finales"; eso se decide en la pantalla de parámetros de la
   Fase 4.

### Fase 4 — Pantalla de parámetros

1. **Stack: Vite + JS vanilla, sin framework de UI.** Vite solo como
   herramienta de dev server/build (necesaria para servir los módulos ES ya
   existentes en el navegador, y para `vite-plugin-pwa` en la Fase 8 sin
   escribir el service worker a mano). Sin React/Vue/Svelte: coherente con
   el resto del proyecto (todo son funciones puras hasta ahora, solo
   dependencia `suncalc`), y no hay necesidad real de un framework
   reactivo — el dashboard de la Fase 5 actualiza pocos elementos a baja
   frecuencia (clima cada ~15min) y la escena 3D de la Fase 6 será
   Three.js con su propio bucle de render imperativo. Si en el futuro la
   complejidad de la UI lo justifica de verdad, se reconsidera entonces.

2. **`vite.config.js`: `base: '/solana/'`.** No hay remote de git
   configurado todavía; se usa el nombre del directorio/proyecto actual
   como valor de partida. **Pendiente de revisar** el día que exista el
   repo real en GitHub Pages si el nombre del repo acaba siendo distinto
   (spec.md §7 — GitHub Pages sirve cada repo bajo `/<nombre-repo>/`).

3. **`src/persistencia/ubicacion.js`, módulo nuevo.** La ubicación
   (spec.md §3.1) no tenía persistencia — vivía como la constante
   `UBICACION_PISO` en `src/data/ubicacion.js`, marcada desde la Fase 2
   como "editable de verdad en la Fase 4". Se creó un módulo paralelo a
   `piso.js` (misma interfaz `storage`, misma envoltura `version: 1`)
   en vez de meter `lat`/`lon` dentro de `parametrosPiso`, porque la spec
   ya los trata como conceptos distintos (§3.1 vs §3.4) y ya vivían en
   módulos de datos separados.

4. **Distinción visual fijo vs. calibrable, y qué pasa si se edita un
   calibrable a mano.** La pantalla tiene dos secciones separadas:
   "Datos fijos del piso" (superficie, altura de techo, banda de confort,
   ubicación, ventanas — estilo neutro) y "Parámetros del modelo" (`UA`,
   `factorCapacidad`, `SHGC`, `renovacionesHora` — fondo con tono cálido
   distinto y una nota fija explicando que se recalibran solos).
   **Decisión explícita sobre el conflicto edición manual vs.
   recalibración automática (Fase 7):** la recalibración sobrescribe sin
   más los valores calibrables con lo que calcule — "last write wins", sin
   bloqueo ni modo "override" persistente. Una edición manual vale hasta
   que corre la siguiente recalibración, que la pisa sin avisar (la nota
   en la UI ya lo advierte). Se descarta a propósito un mecanismo de
   override porque sería maquinaria para una función (Fase 7) que no
   existe todavía — contra la regla del proyecto de no diseñar para
   requisitos hipotéticos. Si en el uso real esto resulta confuso, se
   revisa en la Fase 7 con datos de uso reales, no ahora especulando.

5. **Validación: rechazo estricto en submit, sin redondeo/clamp
   silencioso.** Fuera de rango o no numérico no se guarda; se marca el
   campo y no se persiste nada hasta que todos los campos sean válidos.
   Rangos en `src/ui/validacion.js` (`RANGOS`), únicos también para los
   atributos `min`/`max` de los `<input type="number">`:

   | Campo | Mín | Máx |
   |---|---|---|
   | `superficie` (m²) | 5 | 200 |
   | `alturaTecho` (m) | 2.0 | 4.0 |
   | `UA` (W/°C) | 5 | 300 |
   | `factorCapacidad` | 1 | 20 |
   | `SHGC` | 0 | 1 |
   | `renovacionesHora` (ACH) | 0 | 20 |
   | `bandaConfort.min`/`.max` (°C) | 10 | 30 |
   | `ventana.orientacion` (°) | 0 | 360 |
   | `ventana.ancho` (m) | 0.3 | 10 |
   | `alturaEdificioEnfrente` (m) | 0 | 200 |
   | `distanciaEdificioEnfrente` (m) | 1 | 500 |
   | `lat` | -90 | 90 |
   | `lon` | -180 | 180 |

   Además, validación cruzada: `bandaConfort.min` debe ser estrictamente
   menor que `bandaConfort.max` (no basta con no ser mayor). Límites de
   `distanciaEdificioEnfrente` empiezan en 1 (no 0) para evitar dividir
   entre cero en `elevacionLimiteSombra()` (`src/model/sombra.js`).

6. **`playwright` como devDependency permanente, versión fijada
   (`1.62.1`, sin `^`).** Se usó de forma transitoria para verificar esta
   fase en un Chromium real (pilotado contra el Chromium cacheado por
   WSLg en `~/.cache/ms-playwright/`, ya que `chromium-cli` no está
   disponible en este entorno) y se decidió dejarlo instalado en vez de
   instalar/desinstalar en cada sesión: la Fase 6 (escena 3D) va a
   necesitar verificación visual en navegador real con mucha más
   frecuencia, y una instalación de npm en este entorno puede tardar
   minutos de forma impredecible. Es una dependencia de desarrollo, no de
   producción — no afecta al bundle de la PWA ni al requisito de "sin
   backend" (spec.md §7). El binario del navegador en sí no se commitea
   (vive fuera del repo, en `~/.cache/ms-playwright/`); cada máquina
   nueva necesita `npx playwright install chromium` una vez.

### Fase 5 — Dashboard

1. **Antigüedad de la última anotación: no estaba resuelto en spec.md, se
   decide en esta fase.** El motor de recomendación (Fase 1) parte de un
   `tInActual` que en el dashboard solo puede venir de la última anotación
   manual — si es antigua, la recomendación se calcula sobre un `T_in` que
   probablemente ya no es cierto, y eso no se detecta con solo mirar la
   pantalla en un instante dado. Tres estados según antigüedad (función pura
   `estadoAntiguedad()` en `src/ui/antiguedadAnotacion.js`, con `ahora`
   como parámetro para poder testear con casos deterministas):
   - `< 3 h` → **fresca**: se usa sin más.
   - `3 h – 12 h` → **aviso**: se sigue usando (mejor una estimación con
     aviso que nada), pero la tarjeta muestra "última anotación hace X,
     puede estar desactualizada".
   - `≥ 12 h` → **caducada**: no se calcula recomendación; mismo estado
     vacío que "todavía no hay ninguna anotación", con el texto adaptado
     ("última anotación hace X h — anota una nueva para ver
     recomendaciones"). Coherente con la decisión ya tomada sobre el primer
     arranque (no fabricar una recomendación sobre un dato que ya no
     representa el estado real del piso).
   - Umbrales elegidos como punto medio entre honestidad y usabilidad: 3h
     cubre el caso normal de "llevo un rato sin mirar la app" sin generar
     avisos constantes; 12h (media jornada) es lo bastante largo para no
     penalizar a alguien que anota mañana/noche, pero lo bastante corto
     porque en ese tiempo el interior puede haber cambiado varios grados
     por sol/ventilación/calefacción sin que el modelo se entere. No hay
     mecanismo para "retro-simular" T_in desde la anotación hasta ahora
     (exigiría guardar histórico de cambios de estado de ventanas, que
     esta fase no persiste — ver decisión 2 más abajo) — deliberadamente
     fuera de alcance, se revisa si hace falta en una fase futura.
   - **3h/12h son una estimación a ojo, no un valor derivado del modelo
     térmico de este piso.** No se calcularon a partir de la constante de
     tiempo real del RC (`C/UA`, con `C = capacidadTermica(parametrosPiso)`
     de `src/model/termico.js`) ni de ningún dato de uso real — son un
     punto de partida razonado cualitativamente (orden de magnitud del
     horizonte de pronóstico de 6-8h, patrón de "anota mañana/noche") pero
     sin base empírica. **Pendiente de ajustar con uso real** — cuando haya
     histórico de anotaciones (Fase 7) vale la pena revisar si 3h/12h son
     demasiado estrictos o demasiado laxos para este piso en concreto, o si
     merece la pena derivarlos de `C/UA` en vez de dejarlos fijos.

2. **Las anotaciones etiquetadas (§3.5: cocinando/climatización/más gente)
   sí se usan como `tInActual` para la recomendación en vivo, aunque se
   excluyan de la recalibración automática de la Fase 7.** Son cosas
   distintas: la exclusión de la recalibración es para no dejar que una
   causa transitoria no modelada en el RC (un horno encendido, por
   ejemplo) contamine la regresión de `UA`/capacidad térmica, que asume
   que toda la desviación viene de la envolvente del piso. Pero como
   lectura de "qué temperatura hay ahora mismo" es exactamente igual de
   válida que una sin etiquetar — de hecho es la única lectura real
   disponible en ese momento. Excluirla también aquí obligaría a caer a
   una anotación sin etiquetar potencialmente mucho más antigua (o al
   estado "caducada" de la decisión 1), lo cual sería estrictamente peor
   para la decisión de abrir/cerrar ventana de ahora mismo.

3. **`estadoVentanas.js`, módulo de persistencia nuevo (paralelo a
   `piso.js`/`ubicacion.js`).** El estado físico real de cada ventana
   (¿está abierta?, ¿persiana arriba?) no lo puede inferir el modelo — no
   hay sensores — y sin embargo `recomendarVentana`/`recomendarPersiana`
   (Fase 1) lo necesitan como `estadosVentanasActuales` para simular el
   efecto conjunto de ambas ventanas sobre la única zona térmica. Se
   declara a mano con un toggle por ventana en el dashboard y se persiste
   bajo `solana:estadoVentanas`, keyed por `ventana.nombre` (no
   hardcoded a "A"/"B") para no romper si en el futuro cambian los
   nombres desde la pantalla de parámetros.

   **Default antes de tocar ningún toggle (primer arranque):
   `{ abierta: false, persianaArriba: false }` — elección consciente, no
   el default implícito de un booleano.** Ventana cerrada + persiana
   abajo es el único estado en el que `Q_solar` y `Q_vent` son ambos cero
   (`termico.js`: `qSolarVentana` devuelve 0 si `!persianaArriba`,
   `qVentVentana` devuelve 0 si `!abierta`) — es decir, es el punto de
   partida térmicamente neutro: la primerísima recomendación que ve un
   usuario nuevo (antes de corregir los toggles al estado real de su
   piso) se basa solo en pérdidas por conducción (`UA·(T_out−T_in)`), sin
   que el modelo asuma de entrada una ganancia solar o una ventilación
   que igual no existen. Cualquier otro default (p.ej. persiana arriba)
   arriesgaba mostrar una primera recomendación basada en una suposición
   activa sobre el estado real de la ventana, no solo en ausencia de
   información sobre él.

4. **`index.html` pasa a montar el dashboard; la pantalla de parámetros se
   muda a `parametros.html`.** El dashboard es la pantalla de uso diario
   (spec.md §6, "elemento central"); parámetros es una pantalla de ajuste
   ocasional. Sitio multi-página con Vite (sin router, coherente con la
   decisión de Fase 4 de no añadir un framework), con un enlace cruzado
   simple entre ambas. Al ser navegación de página completa, no hace falta
   limpiar el `setInterval` del auto-refresco del dashboard al salir de
   la pantalla — el documento entero se destruye.

5. **Refresco del clima: automático cada 15 min (resolución de
   `minutely_15`) + botón manual.** Sin service worker ni Notification
   Triggers (fuera de alcance, spec.md §7) — es solo un `setInterval` en
   la propia pantalla mientras está abierta, que vuelve a llamar a
   `obtenerDatosReales()`.

6. **Script de verificación visual (`scripts/captura-pantalla.mjs`)
   committeado, no ad-hoc.** A diferencia de la Fase 4 (donde la
   verificación con Playwright fue manual y no se guardó ningún script),
   aquí se deja un script reutilizable y parametrizado (ruta + archivo de
   salida) porque la Fase 6 (escena 3D) lo va a necesitar con mucha más
   frecuencia — ya se anticipó al decidir dejar Playwright instalado en la
   Fase 4. Espera a que el propio código marque `root.dataset.cargado =
   'true'` tras renderizar (en vez de un timeout fijo o `networkidle`),
   para no depender de asunciones de temporización de red.

### Fase 6 — Escena 3D (checkpoints 1-3)

1. **Habitación como caja rectangular, sin forma de planta real.**
   `parametrosPiso` no tiene ancho/profundidad, solo `superficie` total
   (editor visual de planta fuera de alcance en v1, spec.md §8). En vez de
   inventar un ratio de aspecto fijo en el código de la escena (se probó
   y se descartó — daba una proporción de "pasillo" con los valores por
   defecto), se añadió `anchoHabitacion` como parámetro editable nuevo en
   `parametrosPiso` (Parámetros del piso, no del modelo — no participa en
   `termico.js`), con la profundidad derivada siempre como
   `superficie / anchoHabitacion`. Validación cruzada nueva: ninguna
   ventana puede ser más ancha que `anchoHabitacion`.

2. **El edificio enfrente de cada ventana NO se dibuja en 3D — decisión
   importante, dio bastantes vueltas.** Se probó primero como caja 3D a
   distancia visual comprimida (con la altura calculada para preservar el
   mismo `elevacionLimiteSombra()` real a esa distancia falsa). Se
   descartó por dos motivos, en este orden:
   - Su sombra 3D (shadow mapping real) no era fiable: con un sol muy
     rasante, la sombra de la caja comprimida podía "sobrevolar" el suelo
     de la habitación sin llegar a tocarlo, aunque el ángulo real sí
     tapase la ventana según el modelo — al revés también podía pasar.
   - Aunque se descartó el shadow mapping y se calculó "sol directo por
     ventana" aparte con la fórmula real (ver decisión 4), el edificio
     visual seguía sin aportar nada funcional y obligaba a la cámara a
     alejarse mucho para que cupiera, dejando la habitación (el sujeto
     real) diminuta en el encuadre.
   `calcularElevacionesLimite()` (que solo exponía el ángulo límite real
   de cada ventana, reutilizando `elevacionLimiteSombra()` sin la caja) se
   añadió y se volvió a quitar en la misma sesión al eliminar también el
   parche de sol (decisión 4) — no quedó ningún consumidor.

3. **Cámara ortográfica fija, offset de 45° sobre la normal de la ventana
   A.** Sin `OrbitControls` en ningún sitio (spec.md §6.1). Las paredes
   opuestas de cristal (A y B) necesitan `side: THREE.DoubleSide` para que
   la cámara vea ambas ventanas a la vez pese a estar en paredes opuestas
   (una desde fuera de la caja, otra desde dentro) — sin esto, Three.js no
   dibuja la cara "trasera" de una pared y una de las dos ventanas no se
   vería nunca. El radio de encuadre de la cámara se calcula a partir de
   la caja englobante real de toda la escena (`calcularRadioEscena`), no
   de las dimensiones de la habitación a secas, para no tener que volver a
   tocarlo si un checkpoint futuro añade más contenido.

4. **Parche de sol en el suelo: se implementó y se quitó otra vez, pedido
   explícito.** spec.md §6.1 pide literalmente "rayos de sol... en el
   suelo", y se implementó (`ventanaTieneSolDirecto()` en
   `iluminacion.js`, reutilizando `ventanaSombreada`/`cosIncidencia` de
   `src/model` con los valores reales del piso — la misma condición que ya
   usa `qSolarVentana` en `termico.js`). Se probaron varias iteraciones de
   opacidad/tamaño y se acabó quitando del todo porque, visualmente, no
   encajaba ("parecía una antisombra"). **La escena 3D ya no tiene ninguna
   señal visual de "esta ventana tiene sol directo ahora mismo"** más allá
   de la luz/sombra generales — esa información sigue disponible en el
   dashboard (Fase 5) en texto. Diverge de spec.md §6.1 a propósito; si se
   echa en falta más adelante, reconsiderar como un paralelogramo
   inclinado según el ángulo real del sol (opción descartada esta vez por
   tiempo/alcance) en vez del rectángulo genérico que se probó.

5. **Sombra 3D real (shadow mapping de Three.js) solo para el marco de la
   ventana y las paredes opacas — NUNCA para el edificio (retirado).** El
   marco (`construirMarcoVentana`: cruz central + perimetral, 4 cristales
   independientes por ventana) y las paredes opacas están a escala 1:1
   real, así que su sombra es geométricamente fiable sin cálculo aparte.
   El cristal nunca proyecta sombra (`castShadow`) — si lo hiciera, no
   entraría sol nunca por esa ventana.

6. **Dos bugs reales de Three.js que costó encontrar, por si se repiten
   en checkpoints futuros:**
   - `light.shadow.camera.near/far/left/right/top/bottom` mutados
     directamente **no tienen ningún efecto** si no se llama después a
     `light.shadow.camera.updateProjectionMatrix()` — Three.js no lo hace
     solo. Sin esto, la sombra usaba el frustum por defecto (near/far muy
     separados) y no aparecía nunca, ni en software rendering ni con GPU
     real.
   - El suelo (`construirQuadPlano`, 2 triángulos formando un quad)
     necesita geometría **indexada de verdad** (`setIndex`), no 6 vértices
     sueltos duplicados en dos triángulos separados — con vértices
     duplicados (aunque con la misma normal calculada) se veía una
     costura diagonal de esquina a esquina, con iluminación ligeramente
     distinta a cada lado, más visible cuanto más contraste de luz/sombra
     había. Con índice de verdad ambos triángulos comparten el mismo
     vértice en memoria y no puede desalinearse.
   - Relacionado: la normal del suelo **no se puede fijar a mano**
     (`(0,1,0)`) con un material `DoubleSide` — el shader invierte la
     normal recibida según de qué lado se ve cada triángulo (comparando
     contra el sentido de bobinado); una normal fija que no coincide con
     ese criterio se ve invertida desde arriba, y la superficie recibía
     casi solo luz ambiental, sin apenas contraste de la direccional.
     Hay que usar `computeVertexNormals()` (que sí calcula a partir del
     bobinado real) sobre la geometría ya indexada.

7. **Paredes opacas: NO llevan `depthWrite:false`, aunque el cristal sí.**
   `depthWrite:false` en las paredes opacas (probado) mezclaba sus dos
   caras (`DoubleSide`) entre sí en el borde de silueta contra el fondo,
   en ángulos rasantes — se veía como un contorno fino de un tono
   intermedio en la base de cada pared. El cristal sí lo necesita
   (`depthWrite:false`) porque sus reflejos/marco hijos son decals
   coincidentes en el mismo plano (ver decisión 9) y sin esto se pelean
   por profundidad con la propia pared.

8. **Opacidad de las paredes opacas: distinta la cercana de la del
   fondo, y con bastante historial.** Se probó 0.5, luego 0.85, luego
   opaca del todo (1) para eliminar de raíz tres problemas que causó la
   transparencia por turnos (lavado del color del suelo en la línea de
   visión a través de la pared, lío de profundidad con los reflejos del
   cristal contiguo, contorno de mezcla en el borde de silueta — este
   último inherente a cualquier opacidad menor que 1, no arreglable con
   `depthWrite`). Pedido explícito de recuperar algo de transparencia
   sobre todo en la pared **más cercana a la cámara** (para poder ver el
   interior): valores finales `OPACIDAD_PARED_OPACA_CERCA = 0.6`,
   `OPACIDAD_PARED_OPACA_LEJOS = 0.95`, decididos con `signoHaciaCamara()`
   (ya existente para los reflejos, reutilizado aquí).

9. **Reflejos de cristal (franjas blancas diagonales, una por cada uno de
   los 4 cristales que deja el marco en cruz): el offset de profundidad
   dio más vueltas que ningún otro elemento.** Al ser decals coincidentes
   en el mismo plano que el propio cristal, se probaron tres técnicas en
   orden, cada una con un problema real distinto:
   - `depthTest:false` → el reflejo se dibuja siempre por encima de todo,
     incluida cualquier pared que debiera taparlo ("flotando" delante).
   - `polygonOffset` → falla en ángulos rasantes cerca de las esquinas del
     cristal (donde converge con el borde de la pared lateral contigua),
     dejando un rastro fantasma sobre la pared opaca.
   - **Offset de posición real en Z, con signo dinámico** (ganador): como
     A y B se ven cada una desde un lado distinto del cristal (una desde
     fuera de la caja, otra desde dentro, por `lookAt()`), el signo del
     offset no puede ser fijo — `signoHaciaCamara(pared, dirCamaraXZ)`
     (calculado ANTES de construir la cámara real, con la misma fórmula
     de azimut) decide hacia qué lado desplazarse en cada pared. Un
     intento intermedio de alejar los reflejos del centro de cada
     cuadrante (para evitar el problema de esquina de la técnica
     anterior) resultó innecesario con el offset real, y además
     descentraba visualmente los reflejos — se revirtió.

10. **Techo invisible que sí proyecta sombra.** `opacity:0` +
    `transparent:true`, NO `visible:false` — Three.js excluye del pase de
    sombra por completo cualquier objeto con `visible:false`, así que
    tiene que seguir "visible" para la cámara de sombra y desaparecer
    solo por opacidad. Efecto esperado, comprobado y no es un bug: limita
    mucho cuánto suelo puede recibir sol directo (un punto a más
    profundidad que `altura/tan(elevación_solar)` desde la ventana queda
    "bajo techo" — el rayo de vuelta al sol saldría por el techo antes que
    por la ventana). Es el mismo efecto que en una habitación real con
    techo.

11. **`renderer.shadowMap.type`: `PCFShadowMap`, no `VSMShadowMap`.** Se
    probó VSM buscando sombras más suaves (con `luz.shadow.radius`) y la
    sombra dejó de verse por completo, confirmado por el usuario en un
    navegador con GPU real — no se pudo verificar VSM en este entorno de
    desarrollo antes de cambiarlo, lección aprendida: no cambiar algo ya
    confirmado que funciona (`PCFShadowMap`) por una alternativa sin
    poder probarla primero. `PCFShadowMap` también respeta
    `shadow.radius`, así que no se perdió del todo el objetivo de sombras
    más suaves.

12. **Reflejo de entorno en el cristal: `envMap` por material, nunca
    `scene.environment` global.** Pedido explícito de mejoras de realismo
    razonables (sombras más suaves, brillo especular, reflejo de entorno)
    sin salirse del estilo "cálido y hogareño" ni añadir texturas
    externas (CLAUDE.md, "sin servidor"). El entorno se genera
    proceduralmente (`crearEntornoProcedural`: una esfera con degradado
    de color propio — cálido arriba, terroso abajo — horneada con
    `PMREMGenerator`, sin ninguna textura descargada) y se pasa como
    `envMap` solo al material del cristal. Se probó `scene.environment`
    (afecta a TODOS los materiales PBR de la escena) y lavaba por
    completo el contraste de luz/sombra ya conseguido en el suelo y las
    paredes opacas.

13. **`escena3d.html` sigue aislada del dashboard — la integración en
    `index.html` es checkpoint pendiente, no de esta sesión.** Motivo
    original (Fase 5): `dashboard.js` reescribe `innerHTML` en cada
    render (toggles, anotaciones), lo que destruiría el canvas WebGL si
    la escena viviera dentro de ese mismo contenedor — hay que decidir
    cómo mantener la escena 3D fuera del ciclo de re-render del
    dashboard antes de integrarla.

### Fase 6 — Escena 3D (checkpoint 5: nubes/lluvia/noche/rayos + móvil)

Pedido explícito del usuario tras ver el checkpoint 4 en vivo ("las
representaciones... tendría que ser más realista, haz unas animaciones y
unas nubes más bonitas que 4 círculos. que la lluvia caiga
proporcionalmente a los mm que hay. y si hay tormenta que caigan rayos. y
si es de noche que se haga oscura toda la pantalla... en el móvil la app
será vertical, pon la casa abajo y que en la parte superior se vea el
clima"), con la condición "solo si es barato" — cada pieza se implementó
con el recurso más simple posible dentro del estilo ya establecido
(sprites/canvas procedural, heurísticas sobre datos ya disponibles), no
con librerías o assets nuevos.

1. **Bucle de animación continuo (`requestAnimationFrame`), revierte la
   decisión de la Fase 5/checkpoint 4 de escena estática.** Aquella
   decisión (sin animación, un único render por carga/cambio de datos) fue
   explícitamente por batería en un PWA de móvil — sigue siendo la razón
   por la que el bucle se pausa con `document.visibilitychange` cuando la
   pestaña pasa a segundo plano (mitigación barata, no una reconsideración
   de si merece la pena el bucle en sí). Reloj propio con
   `performance.now()` en vez de `THREE.Clock` — esta versión de Three.js
   (`0.185.1`) lo marca deprecado en favor de `THREE.Timer`, y para lo que
   hace falta aquí (pausar/retomar) un par de líneas a mano es más simple
   que adoptar esa API nueva.

2. **Nubes: cúmulos de 5 `THREE.Sprite` con textura radial generada en
   `<canvas>`, no círculos planos — y con DOS tonos, no uno.** Sprite en
   vez de plano con `lookAt()` manual porque Three.js ya orienta un Sprite
   hacia la cámara (billboard nativo) sin repetir el truco de
   `construirLluvia`. El primer intento con un solo tono crema
   (`COLOR_NUBE`) salió casi invisible: el fondo del cielo (`COLOR_FONDO`)
   es un crema muy parecido, así que a la opacidad de una nube real casi
   no había contraste. Se añadió una capa de "sombra" gris-cálida
   (`COLOR_NUBE_SOMBRA`), más grande (1.12x) y desplazada hacia abajo,
   DEBAJO de los puffs blancos — con `renderOrder` explícito para
   garantizar el orden (dos sprites transparentes casi coplanares pueden
   ordenarse por distancia a cámara de forma ambigua). El resultado da
   volumen real a la nube (borde inferior sombreado) en vez de un blanco
   plano.

3. **`alturaNubes` subió de 0.95×radio (checkpoint 4) a 1.15×radio.** La
   capa de sombra del punto 2, al ser más grande y desplazada hacia abajo
   que los puffs blancos, hizo que el cúmulo más cercano volviera a rozar
   el vértice del tejado con la altura ya confirmada del checkpoint 4 —
   mismo síntoma que entonces (mancha mezclada con la pared), reajustado
   con el mismo método (capturas de color plano a opacidad 1 para ver el
   solape real sin ambigüedad de mezcla).

4. **Deriva lateral de las nubes: amplitud pequeña (0.06×radio) a
   propósito.** Un balanceo suave, no las nubes cruzando la pantalla — ni
   por tono (CLAUDE.md pide "tranquilo") ni por seguridad (con más
   amplitud, el cúmulo más cercano al tejado volvería a rozarlo en el
   extremo del movimiento, mismo problema del punto 3). Verificado con una
   captura a los 3s de animación, no solo en el instante inicial.

5. **Lluvia: cae de verdad, en bucle (`envolver()`), con velocidad Y
   densidad proporcionales a los mm — bug real encontrado y corregido en
   el reparto de fase inicial.** El primer intento derivaba la posición
   inicial (`y0`) de cada franja del mismo `OFFSETS_LLUVIA.z` que ya usaba
   el checkpoint 4 para el offset horizontal — eso las agrupaba en una
   banda estrecha del rango total de caída, así que las 8 franjas caían y
   desaparecían del encuadre casi a la vez, dejando la escena vacía varios
   segundos hasta que volvían a aparecer arriba (visible al comparar
   capturas en t=0/1.5s/3s, no en una sola captura estática). Se corrigió
   repartiendo `y0` de forma uniforme a lo largo de todo el rango según el
   índice de cada franja, con el offset de `OFFSETS_LLUVIA.z` reducido a
   un jitter pequeño encima. La velocidad de caída también bajó de
   0.5×radio/s a 0.12×radio/s — a la primera velocidad cada franja
   completaba su bucle en ~1.3s, con más aspecto de ventisca que de
   lluvia tranquila.

6. **Rayos: heurística sobre datos ya existentes, no un dato real de
   tormenta.** Open-Meteo tiene `weathercode` (incluye códigos de
   tormenta), pero pedirlo sería tocar `src/data/openMeteo.js` /
   `adaptador.js` (Fase 2, con su propia decisión de qué variables pedir)
   por una función de la escena de depuración — fuera de alcance de este
   checkpoint. `hayTormenta()` aproxima con lo que ya hay: llueve fuerte
   (≥4mm) Y está muy nublado (≥75%). **Pendiente de revisar si se integra
   `weathercode` de verdad más adelante.**

7. **El rayo dio más vueltas que ningún otro elemento del checkpoint —
   tres bugs reales encontrados por turnos, cada uno diagnosticado con la
   misma técnica de aislar con color/opacidad forzados ya usada para las
   nubes en el checkpoint 4:**
   - Fórmula del pulso de parpadeo con `-x ** 2` sin paréntesis: `SyntaxError`
     en tiempo de carga (unario antes de `**` no es válido en JS) — rompía
     la página entera, no solo el rayo. Detectado enseguida porque
     `captura-escena3d.mjs` sí falla el proceso ante errores de consola,
     no solo ante timeouts.
   - Con la fórmula ya corregida, el rayo estaba geométricamente colocado
     bien pero era invisible: el diagnóstico con color rojo/opacidad 1
     forzados mostró que SÍ se dibujaba, en la posición correcta — el
     problema real era que los puffs blancos de nube (`renderOrder=1`)
     tapaban SIEMPRE al rayo (`renderOrder` por defecto, 0) por estar
     espacialmente cerca del cúmulo, independientemente de la profundidad
     real. Se arregló con `linea.renderOrder = 2`.
   - Ya visible en la posición correcta, seguía leyéndose casi invisible
     con su color original (`0xfdf8ec`, crema): mismo problema de bajo
     contraste que las nubes del checkpoint 4, esta vez en el rayo en vez
     de en la altura — se mezclaba con el blanco de las nubes contiguas.
     Cambiado a un azul-blanco eléctrico (`0xbcd9ff`), con más contraste
     tanto contra las nubes blancas como contra el cielo (crema de día,
     azul-morado de noche).
   - Además, el rango vertical del rayo (pensado al principio para "caer"
     desde la nube hasta cerca del suelo, `0.25×radio` a `0.9×radio`, y
     luego `0.95×radio` a `1.35×radio`) quedaba mayormente fuera del
     frustum vertical de la cámara (con la cámara inclinada 35°, el límite
     real no es un cálculo directo desde `alcanceVertical`) o detrás de la
     geometría opaca de la habitación. Se resolvió sin seguir tanteando el
     límite exacto: el rayo se confina dentro de la misma franja vertical
     ya validada para las nubes (`alturaNubes`, 1.15×radio, ±0.13), como
     un relámpago dentro/junto a la nube en vez de una caída larga hacia
     el suelo — coherente además con no romper el tono tranquilo con un
     rayo "entrando" en el salón.
   - Curva de parpadeo también rediseñada: el primer intento (dos
     gaussianas superpuestas buscando un "doble parpadeo") decaía tan
     rápido que a los 100ms de empezar el flash la opacidad ya bajaba de
     0.02 — invisible en la práctica la mayor parte de su propia duración.
     Sustituida por una subida rápida (15% de la duración) y bajada
     lineal el resto, más simple y con opacidad realmente visible durante
     casi toda la ventana de `DURACION_FLASH` (subida a 0.6s).
   - De día el rayo es apenas perceptible (buen contraste solo contra el
     cielo oscuro de noche) — aceptado tal cual: es coherente con cómo se
     ve un rayo real a plena luz del día, y añadir más contraste solo de
     día sería una pieza extra de complejidad para un efecto secundario,
     no pedido ("solo si es barato").

8. **Noche: oscurece `scene.background` y la luz ambiental según
   `sol.elevacion`, con rampa entre 0° y -6° (crepúsculo civil).** No hay
   ningún dato explícito de "es de noche"; se deriva del mismo dato que ya
   apaga el sol (`factorIntensidadSol`). `COLOR_NOCHE` es un azul-morado
   oscuro con algo de calidez (no negro ni azul frío puro), para no romper
   "cálido y hogareño" (CLAUDE.md) ni de noche. La luz ambiental baja de
   0.35 a 0.14 (no a 0): a 0 la habitación quedaría con las caras sin sol
   directo en negro puro, ilegible — un poco de luz ambiental de noche es
   la misma licencia estética que ya se tomó de día (ver Fase 6 checkpoint
   3, decisión sobre luz ambiental).

9. **Cámara: composición distinta en retrato (móvil) vs. landscape,
   pedido explícito ("la casa abajo, el clima arriba").** En landscape el
   encuadre es EXACTAMENTE el de antes (mismo cálculo, sin tocar). En
   retrato (`aspecto<1`), dos cambios encadenados:
   - El ancho ya no se deriva del alto (`alcanceHorizontal =
     alcanceVertical*aspecto`, checkpoint 1) — eso encogía la habitación
     en pantallas estrechas. Se deriva el ALTO del ANCHO necesario para
     encuadrar la habitación (`alcanceVertical = alcanceBase/aspecto`),
     que de por sí deja mucho más cielo visible en una pantalla alta y
     estrecha, sin tocar el tamaño de la habitación.
   - Ese sobrante vertical se reparte asimétrico (2.2× arriba, 0.5× abajo,
     encontrado a ojo con capturas reales de 393×852) en vez de simétrico,
     para que la habitación quede en la franja inferior de la pantalla —
     confirmado con captura de móvil real que el resultado dejaba la
     habitación abajo con una franja de cielo/nubes arriba, tal como se
     pidió.
   - Nubes/lluvia/rayo NO se tocaron para retrato — sus posiciones son
     `objetivo + radio×offset` en espacio de mundo, independientes de la
     cámara, así que ya aparecían dentro de la franja de cielo ampliada
     sin cambios. **Pendiente de revisar con más calma:** en retrato queda
     bastante cielo vacío entre el clima y el panel superior (las nubes no
     se expanden para aprovechar el espacio extra) — aceptado por ahora
     ("solo si es barato"), se revisaría si hace falta más adelante.

10. **`scripts/captura-escena3d.mjs` ampliado con espera opcional (ms) y
    viewport opcional, no un script nuevo.** Necesario para verificar este
    checkpoint de verdad: sin espera no se puede comprobar que la lluvia
    cae (solo el frame inicial) ni que el rayo parpadea, y sin viewport
    configurable no se puede comprobar el layout de retrato. Cambio
    retrocompatible (parámetros nuevos al final, con default que reproduce
    el comportamiento anterior).

11. **Panel de depuración en `escena3d.html` (además del banner "MODO
    DEBUG" ya existente), pedido explícito.** Formulario simple
    (hora/nubes/lluvia) que reconstruye la query string y recarga la
    página — reutiliza `leerOverrideDebug()` tal cual, no añade ningún
    camino de datos nuevo. Fijo en la esquina superior derecha, con hueco
    reservado para el banner de arriba (se solapaban en el primer
    intento).

### Fase 6 — Escena 3D (checkpoint 6: lluvia realista, tormenta real, nubes variables, viento)

Pedido explícito del usuario tras ver el checkpoint 5 ("la lluvia no me
gusta... partículas más pequeñas cayendo verticalmente, mucho más rápido,
más partículas, sin agrupamientos, distribución aleatoria. en cuanto a la
tormenta, deberíamos pedir ese dato también. las nubes en el móvil se ven
muy bajas, aprovecha toda la altura. haz que sean un poco aleatorias... que
la cantidad no sea simplemente la opacidad. también deberíamos implementar
partículas de polvo para el viento y su dirección, teniendo en cuenta la
orientación de la casa").

1. **`src/data/openMeteo.js` pide ahora también `wind_direction_10m` y
   `weather_code`.** Confirmado con una petición real (curl) que
   Open-Meteo los sirve a resolución `minutely_15` — no daba por hecho que
   `weather_code` estuviera disponible a esa resolución (en otras APIs de
   tiempo suele ser solo horario/diario), y merecía la pena comprobarlo
   antes de construir nada encima. `esTormenta(codigoTiempo)` vive aquí
   (no en `escena3d/`): es interpretación del dato de la API (códigos WMO
   95/96/99 = tormenta), no algo específico de la escena — reutilizable el
   día que el dashboard también quiera saber si hay tormenta.
   `src/data/adaptador.js` expone `vientoDireccion` y `codigoTiempo` en
   `actual`, mismo patrón que `viento`/`precipitacion` ya existentes.
   `test/datos-reales.test.js` (red, fuera de `npm test`) actualizado y
   ejecutado — de paso se encontró y arregló un bug preexistente no
   relacionado (le faltaba `bandaConfort` al piso de prueba, roto desde la
   Fase 3, nadie lo había vuelto a ejecutar).

2. **Tormenta: `esTormenta(codigoTiempo)` sustituye por completo la
   heurística lluvia+nubes del checkpoint 5.** `hayTormenta()` (con sus
   umbrales `UMBRAL_TORMENTA_MM`/`UMBRAL_TORMENTA_NUBES`) se ha eliminado
   de `escena.js` — ya no aproxima nada, usa el dato real. La escena
   aislada (`escena3d.html`) no hace fetch real todavía (ver decisión 13
   del checkpoint 1-3: la integración con datos en vivo es un checkpoint
   aparte), así que se prueba con el override `?debugCodigoTiempo=95`.

3. **Lluvia reescrita por completo: de 8 franjas diagonales fijas a un
   único `THREE.Points` con cientos de partículas verticales aleatorias.**
   Al ser vertical (eje Y de mundo) ya no hace falta orientar nada hacia
   la cámara (con `camera.up` en el eje Y del mundo, una línea vertical en
   espacio de mundo se proyecta vertical en pantalla sea cual sea el
   azimut de la cámara) — se eliminó `direccionCamara3D()`, que se quedó
   sin ningún otro uso. Posiciones con `Math.random()` de verdad (no un
   patrón de offsets fijo): con cientos de gotas cayendo rápido no hace
   falta que sea estable entre cargas para comparar capturas, a diferencia
   de las nubes.
   - **Bug real: el tamaño no se veía — con cámara ortográfica, el shader
     de `THREE.Points` de esta versión de Three.js solo aplica
     `sizeAttenuation` (atenuar el tamaño por distancia) para cámaras en
     perspectiva.** Con una ortográfica, `size` es directamente el tamaño
     en PÍXELES de pantalla, no en unidades de mundo — `radio * 0.026`
     (pensado como el resto de la escena, en unidades de mundo) daba
     sprites de bastante menos de 1px, invisibles. Corregido a un tamaño
     en píxeles fijo (4.5) con `sizeAttenuation: false`. Aplica igual al
     polvo del viento (decisión 6) — mismo tamaño en píxeles, no en
     `radio`.
   - Velocidad de caída en **metros por segundo reales** (6-9 m/s según
     intensidad), no en fracción de `radio` como el resto de elementos
     decorativos de la escena — la caída de la lluvia es un fenómeno
     físico con una velocidad real, no algo dimensionado a la escala de
     la habitación.
   - Textura de gota: una cápsula vertical (más alta que ancha) en vez de
     un punto redondo — un punto redondo a esta velocidad se lee como una
     mota flotando, no como lluvia.

4. **Nubes: cantidad de cúmulos según `nubesPct` (no solo opacidad),
   posición con jitter aleatorio, tamaño más pequeño con menos nubosidad.**
   `numeroCumulos(nubesPct)`: 0 por debajo del umbral, 1 a 4-5 según
   tramos. Como generar posiciones nuevas con `Math.random()` sin más
   habría vuelto a arriesgar el roce con el tejado que costó tantas
   rondas resolver en el checkpoint 5, se mantienen las anclas ya
   validadas como zona segura (con una 5ª añadida, misma familia de
   dirección) — lo aleatorio es CUÁLES de las anclas se usan
   (`barajar()`, Fisher-Yates) y un jitter pequeño alrededor de cada una
   (mismo orden de magnitud que la deriva de animación ya confirmada
   segura). Tamaño de cada cúmulo escala con `numCumulos` — pedido
   explícito ("si hay pocas, una nube pequeña"), no el mismo tamaño con
   menos opacidad.

5. **Nubes en retrato: `techoCielo(aspecto)` reparte los cúmulos en un
   rango de alturas mucho mayor cuando `aspecto<1`, en vez de la altura
   fija de landscape.** `construirCamara` (checkpoint 5) ya deja mucho más
   cielo vertical disponible en retrato (el alto del encuadre se deriva
   del ancho, no al revés); antes las nubes no aprovechaban ese sobrante
   y quedaban todas a la misma altura de landscape, muy abajo en una
   pantalla de móvil alta. Verificado con 3 capturas de móvil distintas
   (alturas aleatorias distintas cada vez) sin que ninguna llegase a
   rozar ni el tejado ni el borde superior del encuadre — con margen de
   sobra en ambos extremos, no ajustado al límite.

6. **Polvo en suspensión (viento), solo sin lluvia — nuevo, `THREE.Points`
   igual que la lluvia.** `direccionVientoXZ()` convierte grados de
   brújula a X/Z de mundo con la misma fórmula que `direccionSol()` — el
   viento apunta bien respecto a la fachada real SIN necesitar
   `azimutBase` ni ningún ajuste por la orientación de la casa: los ejes
   de mundo de toda la escena ya están alineados a la brújula desde
   `geometria.js`/`sol.js` (es solo la CÁMARA la que rota según esa
   orientación, no el mundo). `wind_direction_10m` es de dónde SOPLA el
   viento (convención meteorológica), así que la dirección de movimiento
   real es +180°. Velocidad real (km/h → m/s), cantidad y velocidad
   escalan con `viento.velocidad` hasta un tope (45 km/h, "ya es mucho
   viento"). Mismo bug de contraste que ya salió con las nubes y el rayo
   en el checkpoint 5: el primer color (`0xd9c9a3`, tono polvo/tierra
   claro) era casi invisible contra el cielo cálido claro — corregido a
   un tono más oscuro/terroso (`0x9c7c4f`).

### Fase 6 — Escena 3D (checkpoint 7: reflejo de noche, viento más visible, cielo y suelo)

Pedido explícito tras ver el checkpoint 6: "comprueba que de noche no se
vean los reflejos de las ventanas. comprueba lo del viento, no lo puedo
ver. elige qué poner de fondo — un cielo que evolucione por hora/clima, o
hierba y cielo... algo simple."

1. **Bug real confirmado y arreglado: el reflejo diagonal del cristal se
   veía a opacidad completa de noche, sin ninguna luz que lo produjera.**
   `OPACIDAD_REFLEJO` era una constante fija, nunca modulada por luz —
   ahora se atenúa por `factorIntensidadSol(sol)` (la misma función que ya
   apaga la luz direccional), con un mínimo de 0.15 en vez de bajar a 0
   del todo: a 0 el cristal se vería como un plano totalmente liso en
   penumbra, no como cristal. `factorSol` se calcula ahora ANTES de
   construir las paredes (antes solo se calculaba dentro de
   `construirLuzSol`, que se llama después) — no cambia qué se ve de día,
   solo añade el atenuado de noche/penumbra.

2. **Viento: no era un bug de lógica, era de visibilidad — confirmado con
   captura real que las partículas SÍ se construían y animaban, solo que
   a 3px y con la opacidad del checkpoint 6 eran demasiado difíciles de
   distinguir.** Subido a 6px (tamaño similar al de la lluvia) con más
   opacidad base y más partículas mínimas (25→45), sin tocar la lógica de
   dirección/velocidad, que ya funcionaba.

3. **Fondo: cielo con degradado + suelo de hierba, en vez de un color
   plano — pedido explícito, "algo simple" a elegir por Claude.** Cielo:
   textura vertical generada en `<canvas>` (mismo recurso ya usado para
   nubes/entorno del cristal — sin assets externos), horizonte↔cénit,
   con los mismos `nocturnidadActual`/`nubesPct` que ya movían el resto de
   la escena — así el cielo por sí solo ya cuenta parte del clima. Suelo:
   plano de hierba a ras del suelo real de la habitación.

4. **El suelo de hierba costó tres intentos — lección real sobre cámaras
   ortográficas y "horizonte".** Con cámara ortográfica y vista
   inclinada, TODOS los rayos de vista son paralelos: un plano de
   terreno suficientemente grande no deja ver nada de cielo en absoluto
   (no hay punto de fuga que "esconda" el terreno lejano bajo un
   horizonte, como pasaría con una cámara en perspectiva). Intentos:
   - Cuadrado grande centrado en la habitación → un cuadrado alineado a
     los ejes de mundo, visto en isométrico, se proyecta como un rombo:
     sus 4 esquinas quedaban dentro de encuadre como triángulos de cielo
     colándose entre grandes zonas de hierba, muy poco natural.
   - Círculo → o cubría el encuadre entero (sin nada de cielo, con el
     mismo tamaño que hacía falta para tapar las esquinas del intento
     anterior) o, más pequeño, se veía como una "colina" — el borde
     curvo de una elipse (la proyección de un círculo en este ángulo) se
     nota mucho más que el de un horizonte real.
   - **Rectángulo alineado con la dirección de la CÁMARA (no con los ejes
     de mundo), mucho más ancho que profundo — ganador.** El borde lejano
     de un rectángulo así se proyecta como una línea recta horizontal de
     verdad (un rectángulo tiene bordes rectos; la clave era que ese
     borde quedase perpendicular a la mirada de la cámara, no en
     diagonal como con el cuadrado). Con el lado corto (profundidad,
     `alcanceLejos`/`alcanceCerca`) controlando dónde queda el horizonte
     en pantalla, y el lado largo (`anchoLateral`, 16×radio) tan ancho
     que sus esquinas quedan muy lejos a los lados, fuera de encuadre
     incluso en retrato. La rotación del rectángulo se deriva de
     `azimutCamaraDeg` con la misma fórmula que ya usa `direccionCamaraXZ`
     (+180°, para que apunte en la dirección CONTRARIA a la cámara) — no
     tanteada a ojo, aunque sí verificada con captura real.
   - Añadido, como el resto de elementos "de fondo" (nubes, lluvia,
     viento), DESPUÉS de calcular radio/cámara — con `anchoLateral =
     16×radio` habría inflado la caja englobante de
     `calcularRadioEscena()` muchísimo si se calculara con él dentro,
     el mismo problema (mucho más extremo) que ya se documentó para los
     edificios retirados y para el resto de elementos de clima.

### Fase 6 — Escena 3D (checkpoint 8: isla flotante, árbol, charco, viento con estela)

Pedido explícito del usuario, cambio de idea sobre el suelo del
checkpoint 7: "la casa esté en una isla flotando en el cielo, como
arrancada del suelo, un cono invertido con tierra y piedras abajo —
minimalista. detalles simples con sombra (árbol, buzón, piedra), y un
charco que se vaya llenando cuando llueve — eso ya te lo dejo a ti.
cambia la animación del viento, que haga círculos y dejen estela; alguna
hoja si no es mucho trabajo."

1. **La isla sustituye por completo al suelo de hierba plano del
   checkpoint 7 — y de paso resuelve el problema que costó tres intentos
   en ese checkpoint.** Un suelo INFINITO (o muy grande) con cámara
   ortográfica no deja ver nada de cielo (todos los rayos de vista son
   paralelos, no hay horizonte natural); una isla es un objeto FINITO
   colgado en el aire, así que ese problema desaparece solo — no hace
   falta alinear nada con la cámara. Dos piezas simples (no una malla
   escultórica): una tapa plana de hierba (mismo material que el suelo
   anterior) y un `ConeGeometry` invertido (`rotateX(Math.PI)`, con
   `openEnded` porque la tapa de hierba ya cubre el hueco por arriba) para
   la tierra, con 3 rocas simples (icosaedros) cerca de la punta para que
   no acabe en un pico perfectamente liso.

2. **Radio en dos fases, porque la isla SÍ debe entrar en el encuadre de
   la cámara (a diferencia de nubes/lluvia/viento).** Se calcula un
   `radioHabitacion` (solo suelo/techo/paredes) para dimensionar la isla
   proporcionalmente a la habitación, se añaden isla + árbol + charco, y
   SOLO ENTONCES se recalcula el `radio` final (con todo dentro) que usa
   la cámara — si la isla se dimensionara con el radio final (circular:
   necesita el radio final para existir, pero el radio final la necesita
   a ella para calcularse), o si se añadiera después de la cámara como
   nubes/lluvia (mismo patrón de "no inflar el encuadre"), quedaría
   cortada por el borde del encuadre en vez de enmarcada.

3. **Bug real: el cono de tierra se veía casi negro con el sol alto,
   confirmado con captura y corregido con `emissive`, no con más luz
   ambiental global.** Con el sol cerca del cénit, los lados del cono
   quedan casi de canto a la luz directa (ángulo muy oblicuo entre su
   normal y la dirección del sol) y con solo la ambiental (0.35) apenas
   se veían — no es un bug de sombra (`receiveShadow:false` no lo
   arregló, se probó primero por si era autosombra/acné en ángulo
   rasante) sino de iluminación real insuficiente. Un `emissive` tenue
   propio del material (no tocar `AMBIENTAL_DIA`, que afecta a TODA la
   escena) lo resuelve sin photorealismo — coherente con "cálido y
   hogareño" (CLAUDE.md), no hace falta que sea físicamente exacto.
   Segundo bug encadenado: ese `emissive` fijo se veía "brillando" de más
   de noche, con el resto de la escena ya oscurecida — atenuado también
   por `nocturnidadActual`, igual que el resto de luces de la escena.

4. **Árbol: "detrás de la casa" se define respecto a la CÁMARA, no a
   ninguna ventana.** Un primer borrador usaba la normal de la ventana A
   como referencia — pero la cámara está desplazada 45° respecto a esa
   normal (checkpoint 1), así que no es exactamente "detrás" desde el
   punto de vista real. `-dirCamaraXZ` (ya calculado para atenuar los
   reflejos del cristal) es el lado que la cámara no ve de frente en
   absoluto — ahí es donde un árbol se lee como detrás de la casa de
   verdad, sea cual sea la orientación real del piso. Solo tronco +
   copa (cilindro + esfera), sin ramas ni textura — de la lista de
   detalles opcionales pedida, se implementó solo este; buzón y piedra
   sueltas se dejaron fuera para no acumular objetos decorativos sin
   necesidad ("minimalista").

5. **Charco: crece con el tiempo mientras llueve, sin lógica de
   "vaciarse".** `escena3d.html` no hace fetch de datos en vivo — todo
   viene de `precipitacion`, fija durante toda la carga de la página — así
   que no existe un momento real de "dejó de llover a mitad de sesión"
   que haga falta drenar; añadir esa lógica sería para un caso que no
   puede pasar en esta página tal como está montada ahora mismo. Oculto
   del todo (`visible = false`) sin lluvia, en vez de con escala 0 — más
   explícito y evita cualquier resto visible a opacidad mínima.

6. **Viento: la turbulencia es la MISMA fórmula de posición reutilizada
   tres veces (cabeza del polvo, 2 puntos de estela, hojas), no tres
   sistemas de partículas distintos.** `posicionViento()` suma al avance
   recto de antes (checkpoint 6) un giro pequeño en el plano perpendicular
   a la dirección del viento (`cos`/`sin` de una fase que avanza con el
   tiempo) — la partícula avanza en línea recta EN PROMEDIO (la dirección
   real del viento) mientras gira alrededor de esa línea, que es
   literalmente "que haga círculos pero en la dirección correcta".
   - **Estela sin guardar historial de verdad:** en vez de acumular
     posiciones pasadas, se evalúa la MISMA función de posición en
     instantes ligeramente anteriores (`t − PASO_ESTELA`,
     `t − 2×PASO_ESTELA`) — como la trayectoria es una fórmula
     determinista de `t`, "la posición hace 0.09s" es tan barato de
     calcular como "la posición ahora", sin buffers ni arrays de
     histórico por partícula.
   - **La estela es un `THREE.Points` MÁS PEQUEÑO Y MÁS TENUE, no el
     mismo tamaño con menos opacidad de golpe.** `THREE.PointsMaterial`
     no soporta tamaño por vértice en esta versión de Three.js (sin
     shader propio) — con un solo tamaño para cabeza+estela mezclados en
     el mismo `Points`, probado, se leía como "el doble de polvo normal",
     no como una cola. Dos objetos `Points` (cabeza a tamaño/opacidad
     completos, estela más pequeña y tenue) consiguen el efecto de cola
     con dos `THREE.PointsMaterial` normales, sin shader a medida.
   - **Hojas: mismo cálculo de trayectoria, con su propio radio de giro
     algo mayor (una hoja se balancea más que una mota de polvo) y sin
     estela propia** — "si no es mucho trabajo": reutilizar
     `posicionViento()`/`generarDatosViento()` en vez de un sistema
     aparte fue lo que lo mantuvo barato.

### Fase 6 — Escena 3D (checkpoint 9: ajustes tras ver la isla — zoom, forma, árbol/buzón, lluvia, cielo)

Pedido explícito tras ver el checkpoint 8 en vivo: más zoom (la casa se
veía pequeña); la isla como disco con montañitas en el borde, no un cono
("como para que no se pueda caer nadie"); el árbol no detrás de la casa y
algo más complejo que una esfera; quitar el charco (quedaba demasiado
cerca); un buzón (palo + caja metálica + bandera en L roja); más
intensidad de lluvia al máximo; que el viento incline el ángulo de la
lluvia; y el cielo en tres estados de verdad (azul de día, negro de
noche, rojizo en amanecer/atardecer).

1. **Isla: disco (cilindro corto) + tapa de hierba + anillo de
   montículos, sustituye al cono del checkpoint 8 — y de paso encoge
   mucho la caja englobante de la escena, ayudando directamente al pedido
   de zoom.** Bug real al pasar de cono a disco: `ConeGeometry` con
   `openEnded` (checkpoint 8) no tenía tapa propia, así que la tapa de
   hierba encima rellenaba ese hueco sin más; `CylinderGeometry` SÍ trae
   sus dos tapas por defecto, así que la cara superior del disco de
   tierra (a la misma altura, y=0) tapaba del todo a la hierba —
   confirmado en captura real (no se veía nada verde). Se resolvió
   bajando el disco 0.03 más de lo que su propio grosor exigiría, para
   que su tapa quede claramente por debajo de la hierba. Los montículos
   del primer intento (14, escala 0.11-0.16×radioIsla) salieron
   desproporcionados — tapaban casi toda la hierba y parecían más
   grandes que la propia casa; bajados a 0.045-0.065×radioIsla (16,
   más pequeños y más numerosos) para que se note el borde sin dominar.

2. **Árbol: se movió de "detrás de la cámara" (checkpoint 8) al LADO**
   (`perp`, perpendicular a `dirCamaraXZ` — mismo vector que ya usa el
   viento para el ancho de su corriente), pedido explícito de que no
   quedara escondido. Copa: de una sola esfera a un racimo de 3 (mismo
   recurso que los puffs de nube — formas simples solapadas, no una
   forma nueva más compleja) para un contorno irregular en vez de "un
   simple círculo".

3. **Buzón nuevo — bug real de posición, no solo de diseño.** El primer
   intento lo colocaba al lado contrario del árbol (mismo `perp`, signo
   opuesto) pero SOLO con desplazamiento lateral — quedaba justo detrás
   de la pared cercana a la cámara, visible como una silueta rara a
   través del cristal semitransparente en vez de estar claramente fuera,
   en la hierba. Se corrigió sumando también un desplazamiento hacia la
   cámara (`+dirCamaraXZ`), no solo lateral, para sacarlo de detrás de la
   pared. Cuatro piezas (poste, caja, bandera vertical, bandera
   horizontal), todas `BoxGeometry`/`CylinderGeometry` sin textura.

4. **Charco eliminado sin más** (`construirCharco`/`animarCharco` y su
   llamada, borrados) — pedido explícito, quedaba demasiado cerca de la
   casa y "no convencía"; no se intentó reposicionarlo primero porque el
   propio pedido fue quitarlo, no ajustarlo.

5. **Lluvia: más intensidad, dos rondas.** 70-260 (checkpoint 6) → 110-550
   (primer intento de esta ronda, insuficiente todavía, pedido explícito
   otra vez) → 160-850, con el radio del área (`extensionXZ`) reducido de
   1.15×radio a 0.95×radio para que la misma cantidad de gotas se note
   más concentrada dentro del encuadre en vez de repartida en un área más
   ancha.

6. **Ángulo de la lluvia por viento — dos partes, no solo una.** La
   deriva horizontal (posición X/Z que también avanza con el tiempo,
   igual que la posición Y ya avanzaba cayendo) solo cambia la
   TRAYECTORIA — en una imagen fija, cada gota se seguía dibujando
   vertical, así que no se notaba ningún ángulo, solo un desplazamiento
   de conjunto. Confirmado con captura real que hacía falta también
   inclinar la textura de la gota. Como la textura (`texturaGota()`) se
   genera una única vez por escena (no por frame), rotar el `<canvas>`
   antes de dibujar la cápsula es prácticamente gratis — se calcula el
   ángulo EN PANTALLA proyectando la deriva horizontal sobre la
   "derecha de pantalla" de la cámara (`{x:-dirCamaraXZ.z,
   z:dirCamaraXZ.x}`, mismo patrón `perp` de siempre): la componente de
   viento perpendicular a la mirada de la cámara inclina la lluvia, la
   componente hacia/desde la cámara no (proyección ortográfica, sin
   profundidad aparente) — coherente con lo que se vería de verdad desde
   un ángulo de cámara fijo. `texturaGota()` dejó de cachear un único
   resultado global (ahora varía según el viento de cada carga).

7. **Cielo en tres estados — sustituye el diseño "cálido incluso de
   noche" del checkpoint 7 por lo pedido explícitamente: azul de día,
   negro de noche, rojizo en amanecer/atardecer.** Nuevo
   `factorCrepusculo(elevacion)`: una ventana de ±9° alrededor de
   elevación 0° (a ojo, no un valor astronómico como el crepúsculo civil
   de -6° que ya usa `nocturnidad()`) que tiñe el horizonte de
   naranja-rojizo y el cénit de un violeta más sutil — aplicado DESPUÉS
   del tono de nubosidad, para que un atardecer nublado siga leyéndose
   rojizo en vez de quedar tapado por el gris. `COLOR_FONDO` (la
   constante del diseño anterior, crema) quedó sin ningún uso — se
   eliminó en vez de dejarla como código muerto.

8. **Zoom: `CAMARA_MARGEN` de 1.6 a 1.28.** El valor de 1.6 es de la
   Fase 6 / checkpoint 1, antes de que la escena incluyera la isla
   completa en el cálculo de encuadre (checkpoint 8) — con la isla ya
   puesta, quedaba más margen del que hacía falta. Verificado que la isla
   completa (con los montículos del borde) sigue cabiendo sin cortarse
   ni en landscape ni en el retrato de móvil, con nubes al 90% y lluvia
   incluida.

### Fase 6 — Escena 3D (checkpoint 10: bugs de posición, textura del terreno, piedras del muro)

Pedido explícito tras ver el checkpoint 9: el árbol se veía DENTRO de la
casa; el buzón muy pequeño; el contorno de las sombras borroso; textura
en el terreno (baches, hierbas, barro); y las piedras del borde más
puntiagudas, alargadas y en mayor cantidad, "como una especie de muro".

1. **Bug real: el árbol quedaba dentro de la casa — error de geometría,
   no de gusto.** `distancia = anchoLateral/2 + margen` es la mitad del
   ANCHO de la habitación medida a lo largo del propio eje lateral de la
   habitación — pero el árbol se coloca a lo largo de `perp`
   (perpendicular a la cámara, que está desplazada 45° respecto a la
   orientación real del piso desde el checkpoint 1). Alejarse en
   diagonal respecto al rectángulo de la habitación y comparar esa
   distancia solo con la mitad del ancho no basta para salir fuera de
   la huella — hace falta la mitad de la DIAGONAL (`Math.hypot(ancho,
   profundidad)/2`) para que valga sea cual sea el ángulo entre `perp` y
   los ejes reales de la habitación. Es la misma clase de error que ya
   había costado un bug parecido con el buzón en el checkpoint 9 (ahí
   por desplazamiento insuficiente en una dirección, aquí por comparar
   con la magnitud equivocada) — misma lección: cuando el objeto se
   coloca a lo largo de un eje que NO es el de la propia habitación, la
   comprobación de "está fuera" tiene que usar el peor caso (la
   diagonal), no una medida de un solo eje.

2. **Buzón: `grupo.scale.setScalar(1.8)`, no rehacer las medidas de cada
   pieza a mano.** Simplemente pequeño a esta distancia de cámara, no un
   problema de diseño — escalar el grupo entero (position y scale son
   transforms independientes; escalar no mueve la posición ya fijada)
   fue más simple que recalcular 4 geometrías.

3. **Sombras menos borrosas: `shadow.radius` de 3 a 1, `mapSize` de 1024
   a 2048.** El 3 era pedido explícito del checkpoint 5 para lo
   contrario (ablandar un borde muy duro) — aquí se pide lo contrario
   otra vez, así que baja, no desaparece del todo (evita "shadow acne"
   en el borde, ver checkpoint 5). `mapSize` más grande ayuda a que el
   contorno se note menos "escalonado/difuso" de por sí, independiente
   del radio de suavizado.

4. **Textura de terreno: canvas procedural aplicado como `map` al
   material de hierba (antes solo `color` plano) — mismo recurso que el
   resto de texturas de la escena, sin assets externos.** Manchas de
   verde más claro/oscuro para los "baches" (variación de tono, no
   relieve real — cambiar la geometría para tener bultos de verdad sería
   mucho más trabajo para un efecto que a esta distancia de cámara
   apenas se notaría), unas pocas manchas de barro más grandes y
   opacas, y trazos cortos oscuros agrupados en "matas" para sugerir
   mechones de hierba. `RepeatWrapping` con `repeat.set(3,3)` para que
   no se note como un único parche estirado sobre todo el círculo de la
   isla.

5. **Piedras del borde: dos rondas hasta que se leyeron como rocas de
   verdad, no como gotas/balas romas.** Primer cambio de esta ronda
   (más alargadas verticalmente, `IcosahedronGeometry` con 1
   subdivisión) no bastó — en captura real se veían suaves y
   redondeadas, no puntiagudas, porque Three.js interpola (suaviza) los
   normales compartidos entre caras por defecto. El arreglo real fue
   `flatShading:true` en un material NUEVO solo para los montículos (no
   reutilizar `materialTierra`, que también usa el disco — facetar la
   superficie cilíndrica lisa del disco no hacía falta y se vería
   raro), combinado con volver a `detail=0` (menos caras, más grandes:
   con flatShading, pocas caras grandes se lee como "roca partida en
   pocos planos", más piedra que mora). 26 montículos (antes 16),
   radio de anillo más ceñido para que se solapen ligeramente entre sí
   — "como una especie de muro" continuo, no piedras sueltas.

### Fase 6 — Escena 3D (checkpoint 11: isla más grande, hierba más verde, buzón en esquina, muro sin huecos, barro con contorno, filamentos con viento)

Pedido explícito tras ver el checkpoint 10: isla más grande ("me da
claustrofobia"); hierba más verde; buzón más pequeño y en una esquina de
la casa; más piedras, sin huecos para saltar el muro; el barro con
contorno definido; y filamentos de tierra en la hierba que se muevan con
la velocidad del viento.

1. **Isla: `radioIsla` de 1.25×radioHabitacion a 1.9×.** Efecto en
   cadena esperado y aceptado: al crecer la isla crece la caja
   englobante de la escena, así que la cámara se aleja un poco para
   seguir encuadrándolo todo — es la misma relación que ya se documentó
   al revés en el checkpoint 9 (bajar `CAMARA_MARGEN` porque la isla
   entraba en el cálculo de encuadre). No se tocó `CAMARA_MARGEN` esta
   vez: el pedido era más margen alrededor de la casa, no más zoom sobre
   ella.

2. **Hierba: `COLOR_HIERBA` más saturado (0x93a663→0x6fa350) y los tonos
   de "baches" de la textura recalculados a juego** — con la textura de
   baches/barro del checkpoint 10 encima, el verde apagado original se
   leía pardo, no verde.

3. **Buzón: `ESCALA_BUZON` de 1.8 a 1.2 (el 1.8 del checkpoint 10 se
   pasó en la dirección contraria) y reposicionado a una esquina REAL de
   la habitación.** El checkpoint 10 lo colocaba en una posición relativa
   a la cámara (`perp` + `dirCamaraXZ`) que arreglaba el bug de quedar
   detrás del cristal, pero no era ninguna esquina en concreto — pedido
   explícito de una esquina de verdad. `geo.esquinasSuelo[0]` (mismas 4
   esquinas exactas que usan las paredes, no una aproximación) empujado
   un poco más hacia fuera en la dirección centro→esquina.
   `dirCamaraXZ`/`radioIsla` dejaron de hacer falta en `construirBuzon()`
   con el nuevo cálculo — parámetros eliminados de la firma en vez de
   dejarlos sin usar.

4. **Montículos: 26→46, y el radio de cada uno también algo mayor
   (0.055→0.075×radioIsla) — al crecer `radioIsla` (punto 1), el mismo
   número de piedras del mismo tamaño de antes se separó, dejando huecos
   reales** ("que no haya huecos para saltar del círculo", pedido
   explícito) — el perímetro del anillo creció con la isla pero la
   cantidad/tamaño de piedras no, hasta este ajuste.

5. **Barro: contorno explícito (`ctx.stroke()` además de `ctx.fill()`),
   no solo relleno difuso.** El primer intento (checkpoint 10, solo
   relleno con opacidad parcial) "no convencía" — se leía como suciedad
   borrosa, no como un agujero de barro con forma. Un trazo más oscuro
   siguiendo el mismo contorno de la elipse marca el borde con claridad.

6. **Filamentos de tierra: nuevos, `construirFilamentos`/
   `animarFilamentos` — 45 brizones finos color tierra (no verdes: se
   pidieron como algo distinto de la hierba en sí), balanceándose según
   `viento.velocidad`.** Mismo patrón de pivote-en-la-base que ya usan el
   tronco del árbol y el poste del buzón (grupo con el mesh desplazado
   hacia arriba dentro, para que la rotación gire desde el suelo). Sin
   viento sigue habiendo un balanceo mínimo (no completamente inmóvil —
   se notaría "congelado" en una escena donde todo lo demás ya anima) en
   vez de una rama condicional aparte para "sin viento no animar nada".
   La dirección del balanceo es la dirección REAL del viento
   (`direccionVientoXZ`, misma función que ya usan el polvo y la
   lluvia) — todos los filamentos se inclinan hacia el mismo lado a la
   vez, no cada uno para un lado aleatorio distinto.

### Fase 6 — Escena 3D (checkpoint 12: contraste de lluvia, barro 3D de verdad, muro sin huecos con piedras bajas, "peter-panning" en las sombras)

Pedido explícito tras ver el checkpoint 11: diferencia más clara entre
poca y mucha lluvia; el contorno del barro tenía que ser relieve 3D real,
no un trazo en la textura (malentendido del checkpoint 11); más piedras
(seguía habiendo huecos) pero más bajas, ninguna más alta que la casa; y
un problema real de sombra — "casi todos los objetos tienen luz justo en
su base, donde debería haber sombra".

1. **Lluvia: rango de partículas mucho más amplio (160-850 → 35-1100),
   no solo el máximo subido otra vez.** Las tres rondas anteriores
   subieron el máximo pero el MÍNIMO también había ido subiendo con cada
   ronda — con 160 de mínimo, poca lluvia ya parecía bastante lluvia, así
   que "poco" y "mucho" no se distinguían (pedido explícito: "que la
   diferencia sea más clara"). Bajar el mínimo de verdad, no solo subir
   el máximo, es lo que crea el contraste.

2. **Barro: reescrito como relieve real (labio elevado que proyecta
   sombra + disco a ras de la hierba), no como el intento anterior
   (fondo hundido por DEBAJO de la hierba) — que resultó no verse EN
   ABSOLUTO.** Bug real encontrado al implementar la aclaración del
   usuario: la tapa de hierba es un único disco continuo, sin ningún
   agujero recortado de verdad — un disco de barro colocado por debajo
   de ese nivel queda completamente tapado por la hierba que tiene
   encima, invisible. La técnica que sí funciona (comprobada en captura
   real) es la contraria: un TORO bien levantado sobre la hierba (no
   apenas asomando) que proyecta una sombra real sobre un disco de barro
   colocado A RAS de la hierba (visible, no oculto) — el relieve se lee
   por la altura del labio y su sombra proyectada, no por una cavidad
   recortada de verdad (que pediría geometría bastante más compleja,
   cortar un agujero real en la malla de la hierba, para el mismo
   resultado visual desde esta cámara fija).

3. **Piedras: 46→62, y la altura ya no depende de `radioIsla`.** Seguía
   habiendo huecos con 46 (pedido explícito otra vez). Más importante:
   la altura de cada piedra se derivaba de la misma escala que su ancho
   (ligada a `radioIsla`, que había crecido mucho en el checkpoint 11),
   así que las piedras habían crecido en altura sin que nadie lo pidiera
   — hasta superar la altura de la propia casa (pedido explícito:
   "ninguna más alta que la casa"). Se separaron los dos ejes: el ANCHO
   sigue ligado a `radioIsla` (para seguir solapando sin huecos sea cual
   sea el tamaño de la isla), pero la ALTURA se deriva ahora de
   `geo.altura` (la altura real de la habitación) con un tope explícito
   (55% de esa altura) — un cambio en el tamaño de la isla ya no puede
   volver a hacer que las piedras crezcan más que la casa sin querer.

4. **Sombras: "peter-panning" real, confirmado y diagnosticado con
   capturas de aislamiento antes de tocar ningún valor.** El síntoma
   ("luz justo en la base de los objetos, donde debería haber sombra")
   es el patrón clásico de bias/normalBias demasiado altos: con el sol a
   un ángulo no cenital, desplazar el muestreo de sombra a lo largo de
   la normal de la superficie equivale a desplazar la sombra
   HORIZONTALMENTE respecto al objeto que la proyecta, dejando una tira
   sin sombrear justo en el punto de contacto real. Diagnóstico en dos
   pasos, no un ajuste a ciegas:
   - Se puso `bias`/`normalBias` a 0 del todo → el hueco desapareció por
     completo (confirma que la causa era el bias, no otra cosa —
     posiciones de las piedras, receiveShadow, etc.).
   - Con 0 del todo, en una captura a sol rasante (18:30) reapareció el
     "shadow acne" (ruido de autosombra) que el bias ya evitaba desde el
     checkpoint 3 — confirma que hace falta ALGO de bias, no cero.
   Solución: `mapSize` subido a 4096 (texels más finos necesitan menos
   bias para el mismo resultado sin acné — la isla más grande del
   checkpoint 11 había subido `alcanceSombra`, y con él el tamaño de
   cada texel en unidades de mundo) combinado con `normalBias` bajado de
   0.03 a 0.0015 y `bias` de -0.0015 a -0.00012 — encontrado probando
   ambos escenarios (piedras a mediodía, pared a sol rasante) hasta que
   el hueco desapareciera a simple vista y el acné quedara imperceptible
   a escala normal de captura (solo se nota con zoom ×4, no en la
   imagen real).

### Fase 6 — Escena 3D (checkpoint 13: toperas fuera de la casa, cielo nublado más bonito, piedras hasta el borde real, selector de hora)

Pedido explícito tras ver el checkpoint 12: los agujeros de barro a
veces salían dentro de la casa (aclarado: son toperas, así que además
de no poder aparecer dentro de la casa tenían que ser más pequeñas, no
un contorno grande); el cielo muy nublado se oscurece correctamente
pero con un color feo; las piedras del muro debían llegar hasta el
borde real de la isla, sin hierba visible más allá; y el campo de hora
del panel de depuración debía ser un selector, no texto ISO escrito a
mano.

1. **Toperas: exclusión real del footprint de la casa, con el mismo
   error que ya había costado un bug en el árbol/buzón — ejes de
   cámara en vez de ejes propios de la habitación.** No existía ningún
   chequeo antes: la posición aleatoria de cada agujero (`angulo`,
   `distancia`) podía caer dentro del rectángulo de la habitación sin
   que nada lo impidiera. Se añadió `dentroDeLaHabitacion(cx, cz, geo,
   margen)`, que proyecta el punto candidato sobre los ejes LOCALES
   reales de la habitación (`geo.ejeLateral`/`geo.ejeProfundidad`, ya
   calculados por `calcularGeometria`) — NO sobre `dirCamaraXZ` (la
   dirección de la cámara), que es lo que se usó por error la primera
   vez en el árbol y el buzón esta misma sesión, y que solo coincide
   con los ejes reales de la habitación cuando esta no está rotada
   respecto a la cámara. Con la proyección correcta, cada agujero se
   sortea dentro
   de un bucle `do...while` con reintento (tope de 30 intentos) hasta
   caer fuera del rectángulo con un margen de 0.5; verificado con 4
   capturas de página nuevas (posiciones aleatorias distintas en cada
   una, `Math.random()` no está sembrado) para confirmar que la
   exclusión es fiable y no solo una casualidad de una única carga.

2. **Toperas: tamaño reducido de 0.22–0.42 a 0.09–0.16 de radio.**
   Aclaración del usuario de que el contorno grande de la ronda
   anterior no encajaba con lo que en realidad quería representar
   (toperas, no cráteres) — se mantiene intacta la técnica de relieve
   del checkpoint 12 (labio elevado que proyecta sombra sobre un disco
   a ras de hierba, nunca un hueco hundido — ver esa decisión para el
   porqué), solo cambia la escala.

3. **Cielo nublado: gris-azulado en vez del gris-morado anterior.**
   El oscurecimiento con mucha nubosidad ya funcionaba bien
   (confirmado explícitamente por el usuario, "lo cual está bien") —
   el problema era solo el tono: `grisHorizonte`/`grisCenit` usaban
   `0xd6cfc0`/`0x2a2735` y `0xc3c2bb`/`0x211f30`, que junto al azul del
   cielo despejado de base leían como un morado sucio. Sustituidos por
   `0xc7cdd1`/`0x2b323c` y `0x9aa6ad`/`0x161b22` — tonos azul-grisáceo
   de "día encapotado" en vez de gris con dominante violeta.
   Verificado con captura antes/después.

4. **Piedras del muro: `r = radioIsla` en vez de `radioIsla * 0.9`.**
   El 0.9 dejaba un anillo de hierba visible más allá de las piedras;
   pedido explícito "que la isla acabe con ellas". Al posicionarlas al
   radio exacto del disco de hierba/tierra, el propio ancho de cada
   piedra (que se extiende hacia fuera desde su centro) ya sobresale un
   poco más allá del borde del disco y lo tapa del todo — no hizo
   falta agrandar el radio del disco ni las piedras, solo mover su
   centro hacia fuera.

5. **Selector de hora: `<input type="datetime-local">` en vez de
   `<input type="text">` con ISO escrito a mano.** El campo
   `debugHora` de `escena3d.html` pasa a un input nativo del
   navegador; `datetime-local` espera/devuelve hora LOCAL del
   navegador en formato `"AAAA-MM-DDTHH:mm"` (sin segundos ni "Z"),
   distinto del ISO-con-Z que ya se guardaba en la URL — se añadió
   `aDatetimeLocal()` en `main-escena3d.js` para convertir el valor
   guardado al formato que el input necesita al rellenar el panel.
   `leerOverrideDebug()` no cambió: sigue aceptando cualquier string
   que `new Date()` sepa parsear, y el valor que devuelve el propio
   input ya cumple eso sin conversión adicional al enviar el
   formulario.

6. **Confirmado: la detección de tormenta real (`esTormenta()`, código
   WMO 95/96/99 en `src/data/openMeteo.js`) ya estaba implementada
   desde el checkpoint 6** — el usuario preguntó directamente si se
   había hecho. No es nueva de este checkpoint, solo se verificó que
   sigue en pie y se explicó que la página aislada de depuración no
   hace fetch real (por diseño, ver `depuracion.js`), así que se prueba
   con `?debugCodigoTiempo=95`; la integración con el fetch en vivo
   queda para el checkpoint futuro de integración con el dashboard.

### Fase 6 — Escena 3D (checkpoint 14: filamentos fuera de la casa, muro de piedras sin huecos, noche más cálida, farola nueva)

Pedido explícito tras ver el checkpoint 13: los filamentos de hierba
también crecían dentro de la casa (mismo bug que las toperas); las
piedras del borde seguían dejando huecos entre sí; la noche seguía
siendo "un poco fea", pedido de hacerla más cálida; y una farola nueva
en la esquina de la casa contraria al árbol, tipo farola de calle
(alumbra hacia abajo, luz cálida, un círculo que incluya la casa,
proyectando sombra).

1. **Filamentos: mismo `dentroDeLaHabitacion` + reintento que las
   toperas (checkpoint 13), aplicado ahora también aquí.** No había
   ningún chequeo — `construirFilamentos` solo recibía `radioIsla`, sin
   `geo`. Se le añadió el parámetro y el mismo bucle `do...while` con
   tope de 30 intentos y margen 0.3 (más pequeño que el 0.5 de las
   toperas: un filamento es una brizna fina, no necesita tanto colchón
   respecto a la pared).

2. **Piedras del muro: 62→90, y el rango de anchura también algo mayor
   (0.075-0.105 → 0.09-0.125 de `radioIsla`).** El hueco no era un
   problema de cantidad insuficiente sin más, sino de que cada piedra
   tiene su propia rotación (`rotation.y = angulo*3.7`) sobre una
   geometría facetada e irregular (icosaedro de baja subdivisión), así
   que su anchura real en la dirección tangencial varía bastante de una
   piedra a otra — con el espaciado angular de 62 piedras, las que
   caían "de canto" no llegaban a solapar con sus vecinas. Más cantidad
   (menos espaciado angular) y más anchura media dejan margen incluso
   para la peor rotación posible.

3. **Noche más cálida: tres colores nuevos, no solo el tramo nublado
   (ya arreglado en el checkpoint 13).** `COLOR_NOCHE` (horizonte de
   cielo despejado nocturno) pasó de `0x050509` (casi negro con deje
   azul) a `0x1c1220` (morado oscuro cálido); el cénit nocturno pasó de
   negro puro `0x000000` a `0x0a0710` (mismo tinte cálido, más oscuro
   que el horizonte); y los grises del tramo NUBLADO nocturno
   (`grisHorizonte`/`grisCenit`, ya corregidos una vez en el checkpoint
   13 pero todavía fríos/azulados) pasaron a tonos con un toque
   marrón/ámbar apagado (`0x352d28`/`0x1c1712`) en vez de azul-gris.
   Verificado con captura de noche despejada y de noche muy nublada.

4. **Farola nueva — el diseño dio dos vueltas, el primer intento tenía
   un bug real de raíz, no solo de ajuste fino.** Primer diseño: poste
   en la esquina de la casa contraria al árbol (misma técnica que
   `construirBuzon`, pero comparando la proyección de las 4 esquinas
   reales de la habitación sobre el mismo `perp` — perpendicular a la
   cámara — que ya usa `construirArbol` para posicionarse: no es el
   mismo error de ejes que costó el bug del árbol/las toperas, porque
   aquí no se comprueba si un punto cae DENTRO de la habitación —eso sí
   exige los ejes propios de la habitación—, sino cuál de las 4 esquinas
   ya conocidas está más lejos del árbol a lo largo del eje que el
   propio árbol usa para colocarse), con el foco apuntando al CENTRO de
   la casa (0,0,0 de mundo) y una intensidad alta (420). Resultado real
   (captura de noche): un tajo de luz muy intenso entrando en diagonal
   por el hueco del techo invisible, con un borde muy duro — nada que
   ver con un círculo cálido bajo una farola. Diagnóstico: con la cabeza
   de la farola casi a la misma altura que el techo invisible (que SÍ
   proyecta sombra, `construirTecho`) y el objetivo al otro lado de la
   habitación, el haz tenía que atravesar ese plano en un ángulo tan
   rasante que la sombra no lo bloqueaba de forma fiable — el mismo tipo
   de problema de ángulo rasante que ya había costado ajustar el bias de
   la sombra del sol (checkpoint 12), aquí con una luz nueva sin esos
   ajustes. En vez de perseguir el bias/ángulo exacto para este caso
   concreto, se cambió el diseño de raíz: el foco apunta ahora recto
   hacia ABAJO desde la propia cabeza (mismo X/Z, Y=0), no al centro de
   la casa — el círculo de luz queda pegado a la esquina exterior,
   tocando la fachada y la hierba de alrededor, sin que el haz necesite
   cruzar nunca el hueco del techo. Efecto secundario esperado: la
   intensidad bajó de 420 a 55 (con `decay` físico normal, 2, en vez del
   1.6 más lento del primer intento) porque el objetivo pasó de estar a
   6-9m (centro de la casa) a ~2.5m (la propia altura de la cabeza) —
   con caída inversa al cuadrado, la misma intensidad a esa distancia
   mucho menor saturaba la escena entera. Encendida solo de noche
   (intensidad y `emissiveIntensity` de la bombilla escaladas por
   `nocturnidadActual`, la misma rampa crepuscular que ya atenúa el sol)
   — de día se ve como una farola apagada, no como una bombilla
   encendida bajo el sol. Geometría: poste + brazo corto tipo "cobra"
   que se adelanta un poco hacia la casa + pantalla (cono truncado
   abierto) + bombilla emissive, todo formas simples sin textura, mismo
   criterio que el buzón/árbol.

### Fase 6 — Escena 3D (checkpoint 15: más zoom, farola proporcional, cielo más vivo, polvo en retrato y de noche, farola con nubes)

Pedido explícito tras ver el checkpoint 14 ("se ve mejor"): la isla más
pequeña para poder acercar más el zoom; la farola más grande y
proporcional a la casa (más alta que ella); el azul del cielo "no
convence", más vivo, teniendo en cuenta que será el fondo de la app;
revisar el modo vertical (el polvo del viento no llega arriba del todo);
el polvo de noche "brilla demasiado, parecen luciérnagas"; y que la
farola se encienda también con más de un 75% de nubes, no solo de noche.

1. **Isla: `radioIsla` de `radioHabitacion * 1.9` (checkpoint 11) a
   `* 1.4`.** Es el mayor contribuyente al radio de encuadre de la
   cámara (`calcularRadioEscena`), así que encogerla es lo que de verdad
   permite acercar el zoom sin tocar `CAMARA_MARGEN` — la casa sigue
   teniendo sitio alrededor, solo que menos que en el checkpoint 11 (que
   la había agrandado por el motivo contrario, "me da claustrofobia").

2. **Farola: altura derivada de `geo.altura`, no una constante fija —
   y un bug de autosombra nuevo, encontrado tras escalarla.**
   `ALTURA_FAROLA` (2.6 fijo, checkpoint 14) pasa a `alturaFarola =
   geo.altura * 1.55` (más alta que el tejado, no solo igualada); el
   resto de medidas del bloque (radio del poste, alcance del brazo,
   tamaño de pantalla/bombilla) se pensaron para una altura de
   referencia de 2.6, así que se escalan dentro de la función en la
   misma proporción (`escala = alturaFarola / 2.6`) para que crezca
   entera, no solo el poste. Efecto en cadena esperado: con la cabeza
   más lejos del suelo, la misma intensidad (55, con `decay` físico 2)
   se ve más tenue — compensado multiplicando por `escala ** 2`
   (iluminancia con caída inversa al cuadrado de la distancia).
   **Bug real, encontrado en captura con 90% de nubes (que ya encendía
   la farola de día, ver decisión 6): una cuña oscura triangular
   grande cortaba el charco de luz, justo donde no debería haber
   sombra.** No era la pantalla (se probó quitándole `castShadow`
   primero — la cuña seguía ahí) ni bastaba con eso: el brazo y el
   poste, con la farola ya escalada, se acercan lo bastante a la
   cabeza/al eje del foco (que apunta recto hacia abajo desde la propia
   cabeza) como para meterse dentro del cono de luz (ángulo ancho, 45°)
   cerca de su vértice — un occlusor pequeño ahí proyecta una cuña
   grande sobre TODO el círculo, no una sombra puntual. Se aisló
   probando uno a uno (pantalla → seguía; brazo → seguía; poste →
   desapareció del todo) hasta confirmar que las TRES piezas de la
   propia farola necesitaban `castShadow = false`: ninguna pieza de la
   farola necesita proyectar su propia sombra sobre el charco de luz que
   ella misma produce; el resto de la escena (casa, rocas, buzón, árbol)
   sigue recibiendo sombra de este foco con normalidad.

3. **Cielo de día: azul más vivo.** `horizonteDia`/`cenitDia`
   (`0xbde4f7`/`0x4a9bd6`, checkpoints 6-14) se veían apagados — pedido
   explícito, con la consideración añadida de que este cielo será el
   FONDO de la app entera al integrarse con el dashboard, no solo un
   detalle de la escena aislada. Más saturación y luminosidad en los dos
   extremos del degradado (`0x8fe0fb`/`0x1f8fe0`), no solo en uno.

4. **Polvo en retrato: mismo criterio que `techoCielo()` (nubes,
   checkpoint 6), aplicado ahora también al viento.** `construirViento`
   no recibía `aspecto`, así que la franja vertical del polvo
   (`alturaCentro`/`mitadAltura`) era siempre la de landscape, sin
   aprovechar el sobrante de cielo que `construirCamara` ya deja en
   retrato (el alto del encuadre se deriva del ancho, no al revés).
   `factorVertical = aspecto<1 ? 1/aspecto : 1` escala ambos valores
   igual que ya hacía `techoCielo()` para las nubes; en landscape el
   factor es 1, sin cambios.

5. **Polvo de noche: opacidad atenuada por `nocturnidadActual`, no
   fija.** `THREE.PointsMaterial` no reacciona a la luz de la escena —
   su brillo es siempre el definido en el material, así que con la
   escena a oscuras el polvo (y las hojas) se leían como una fuente de
   luz propia en vez de una mota iluminada por el sol/ambiental (que sí
   se atenúan de noche) — de ahí el "parecen luciérnagas". Factor
   `1 - 0.65*nocturnidadActual` multiplicando la opacidad de cabeza,
   estela y hojas por igual.

6. **Farola: también se enciende con mucha nube, no solo de noche.**
   `factorEncendida = Math.max(nocturnidadActual, factorNubesFarola)`,
   con `factorNubesFarola` en rampa corta 75%→85% (mismo criterio de
   transición suave que ya usa `factorCrepusculo()`) en vez de un
   interruptor brusco al cruzar el 75%. El máximo de las dos rampas, no
   la suma — a mediodía con 90% de nubes no debería encenderse "más"
   que de noche con cielo despejado, solo tan encendida como cualquiera
   de las dos condiciones por separado. Sustituye a `nocturnidadActual`
   a secas tanto en la intensidad del foco como en el `emissiveIntensity`
   de la bombilla.

### Fase 6 — Escena 3D (checkpoint 16: farola +50% en la ventana trasera con piezas bien unidas, zoom máximo, isla sin achatar en retrato)

Pedido explícito tras ver el checkpoint 15: la farola un 50% más
grande; en medio de la ventana de atrás, no en una esquina; el brazo y
la pantalla no quedaban bien unidos al poste; arreglar también la
sombra del poste; todo el zoom posible (en el móvil se ve pequeño);
que la anchura de la isla encaje con la anchura del móvil; y una
sospecha del usuario a comprobar — "cuando se pone en vertical la isla
se achata un poco y pierde las proporciones, ¿es posible?".

1. **Farola +50%: un solo factor.** `FACTOR_ALTURA_FAROLA_SOBRE_CASA`
   de 1.55 a `1.55 * 1.5`. Como el resto de medidas del bloque
   (radio del poste, alcance del brazo, tamaño de pantalla/bombilla) ya
   escalaban con `escala = alturaFarola/ALTURA_FAROLA_REFERENCIA`
   (checkpoint 15), subir este único factor agranda la farola entera de
   forma coherente, no solo la altura.

2. **Reposicionada al centro de la ventana trasera, no a una esquina.**
   La "ventana de atrás" es el cristal cuya normal apunta EN CONTRA de
   la cámara (`signoHaciaCamara` da -1): el que queda al fondo, más
   pequeño/lejano en el encuadre isométrico. `pared.centro` ya da el
   punto medio real de esa pared (mismo sistema de coordenadas rotado
   que las esquinas), así que centrar la farola ahí es directo — se
   quitó todo el cálculo de esquina/`perp` del diseño anterior (y su
   comentario sobre "esquina contraria al árbol", que ya no aplica).
   **Bug real de la primera versión de este cambio:** con el mismo
   `margenFuera=0.9` fijo que ya usaba el buzón (pensado para una
   farola a escala de referencia), el poste quedaba pegado al marco de
   la ventana, casi fundido visualmente con él en captura real — se
   corrigió escalando también `margenFuera` por `escala`, para que la
   separación crezca junto con el resto de la farola.

3. **Brazo y pantalla no estaban bien unidos — bug real, no solo un
   ajuste de posición.** El brazo del checkpoint 14/15 era un cilindro
   HORIZONTAL a una altura fija (`alturaFarola - 0.05*escala`) que no
   coincidía ni con la punta real del poste (`alturaFarola`) ni con la
   parte superior de la pantalla (bastante más abajo,
   `cabezaY + alturaPantalla/2`) — quedaba flotando entre las dos
   piezas sin tocar ninguna, un hueco que antes pasaba desapercibido a
   la escala de referencia pero se notaba mucho más ya agrandada.
   Reescrito como un cilindro DIAGONAL, orientado con un cuaternión
   (`Quaternion.setFromUnitVectors`) desde la punta real del poste
   hasta el borde superior real de la pantalla — encaja a ras con las
   dos piezas sea cual sea `escala`, sin coordenadas ajustadas a mano
   que se puedan volver a desincronizar si la farola cambia de tamaño
   otra vez.

4. **Sombra del poste reactivada — y esta vez sin que reaparezca la
   cuña del checkpoint 15.** El checkpoint 15 había desactivado
   `castShadow` en poste+brazo+pantalla enteros para quitar una cuña de
   autosombra; pedido explícito de recuperar al menos la del poste. Se
   reactivó solo la del poste y se verificó en captura (con la escena
   muy nublada, que enciende la farola de día) que no reaparecía
   ninguna cuña — con el brazo ya diagonal (decisión 3) en vez del
   horizontal fijo de antes, ya no pasa tan cerca del vértice del cono
   de luz. La pantalla y el nuevo brazo diagonal se dejaron sin
   `castShadow` (mismo riesgo geométrico que ya causó el bug real una
   vez, no se ha vuelto a probar reactivarlos).

5. **Zoom: `CAMARA_MARGEN` de 1.28 a 0.92, en dos pasos verificados con
   captura.** Primero a 1.05 (verificado sin recorte en landscape,
   retrato y con la farola ya más alta/nubosa, el elemento más alto de
   la escena); confirmado que aún quedaba margen de sobra, bajado otra
   vez a 0.92 y vuelto a verificar en los cuatro casos límite (día/noche
   × landscape/retrato) antes de darlo por bueno — con la farola ahora
   el elemento más alto de la escena, es el candidato más probable a
   recortarse primero si el margen se pasa de ajustado.

6. **Isla achatada en retrato: la sospecha del usuario era un bug real,
   confirmado con álgebra antes de tocar ningún valor — no solo "se ve
   un poco raro".** `alcanceVertical = alcanceBase/aspecto` (checkpoint
   5) asumía un frustum vertical SIMÉTRICO (arriba=abajo=alcanceVertical,
   span total `2×alcanceVertical`) para que
   `alcanceHorizontal/alcanceVertical` coincidiera con `aspecto` (la
   proporción real del canvas) y así no deformar nada. Pero en retrato
   arriba/abajo NO son iguales (2.2/0.5, checkpoint 5, "casa abajo,
   cielo arriba"): el span vertical real es
   `(2.2+0.5)×alcanceVertical = 2.7×alcanceVertical`, no
   `2×alcanceVertical` como asumía la fórmula — con esa asimetría sin
   compensar, la proporción horizontal/vertical del frustum quedaba por
   debajo de lo que pedía `aspecto` (un factor 2/2.7 ≈ 0.74), así que
   el mundo se veía más aplastado verticalmente de lo que el canvas
   permitía: exactamente el achatamiento que describía el usuario, y
   llevaba ahí desde el checkpoint 5 sin que nadie lo hubiera notado
   hasta ahora. Corregido escalando `alcanceVertical` por
   `2/(2.2+0.5)` para que el span vertical real (arriba+abajo) sí
   mantenga la proporción con `alcanceHorizontal` que pide `aspecto`,
   sin tocar la composición 2.2/0.5 en sí (sigue siendo "más cielo
   arriba que hierba abajo", solo que ahora sin distorsionar el
   resultado). De paso resuelve también el pedido de "que la anchura de
   la isla encaje con el móvil": al ser `alcanceHorizontal` el mismo
   valor en todos los aspectos de retrato (no escalaba con el ancho real
   de la pantalla), la combinación de esta corrección con el zoom más
   ajustado (decisión 5) es lo que de verdad acerca la isla a los bordes
   de la pantalla en vez de dejar margen sin usar a los lados.

### Fase 6 — Escena 3D (checkpoint 17: farola vintage con luz puntual, sustituye al diseño "cobra")

Pedido explícito tras ver el checkpoint 16: "se me queda una zona muy
oscura. cambia esa farola por una de las vintage, de esas que son más
bajitas pero alumbran más horizontalmente. prueba con una sola primero
— si sigue quedando oscuro, movemos el árbol y ponemos dos, una en cada
esquina".

1. **Sustitución completa del diseño "cobra" (checkpoints 14-16), no un
   añadido en paralelo.** `construirFarola` se reescribió entera:
   desaparecen el brazo lateral, la pantalla cónica y el `SpotLight`
   estrecho hacia abajo; entra un poste más corto (sin brazo, el
   farolillo va centrado justo encima), un farolillo (caja con material
   emissive cálido simulando el cristal) rematado en un cono con pomo, y
   una `THREE.PointLight` en el centro del farolillo. La causa raíz del
   "queda una zona muy oscura" era estructural, no un ajuste de
   intensidad: un `SpotLight` con ángulo de 45° concentra toda su luz en
   un cono hacia abajo — por diseño, no puede iluminar nada FUERA de
   ese cono por mucha intensidad que se le suba. Un `PointLight` reparte
   la misma energía en todas direcciones alrededor del punto, que es
   literalmente "alumbrar más horizontalmente" — efecto secundario
   observado y bienvenido: también ilumina el interior de la casa a
   través del cristal cercano, algo que el cono estrecho del diseño
   anterior nunca llegaba a tocar.

2. **Altura: más baja a propósito, y ya no necesita ser "más alta que la
   casa".** `FACTOR_ALTURA_FAROLA_SOBRE_CASA` de 2.325 (checkpoint 16)
   a 1.3 — pedido explícito ("más bajitas"). El requisito de "más alta
   que el tejado" del diseño anterior (checkpoint 14) existía solo para
   que el brazo lateral no tuviera que cruzar el hueco del techo
   invisible en diagonal; sin brazo (todo el farolillo queda centrado
   en el eje del poste, fuera de la huella de la casa por la propia
   posición junto a la ventana trasera) ese problema no puede repetirse,
   así que no hacía falta mantener la restricción de altura.

3. **Misma posición que el diseño anterior (centro de la ventana
   trasera), reutilizando `signoHaciaCamara`/`paredTrasera` tal cual.**
   No pedido explícito de cambiar dónde va, solo de cambiar QUÉ es — se
   mantuvo la posición ya validada en el checkpoint 16 en vez de
   reabrir esa decisión sin necesidad.

4. **Intensidad de la `PointLight`: encontrada a ojo con captura real,
   mismo patrón de siempre en este bloque.** `10 * escala**2 *
   factorEncendida` — el exponente 2 por el mismo motivo que ya
   justificaba el diseño anterior (con `decay` físico 2, la iluminancia
   cae con el cuadrado de la distancia al farolillo, que se aleja del
   suelo en proporción a `escala`). El propio criterio de encendido
   (`factorEncendida`: noche o >75% de nubes, checkpoint 15) y el
   `emissiveIntensity` del farolillo (atenuado de día, intenso de
   noche/nublado) se reutilizaron sin cambios — la lógica de "cuándo se
   enciende" no dependía del diseño físico de la farola.

5. **Zona oscura: mejor, pero no resuelta del todo — decisión pendiente
   del usuario, no autónoma de Claude.** En captura de noche con esta
   única farola vintage, el interior de la casa y la hierba alrededor
   de la ventana trasera quedan bien iluminados, pero el lado opuesto
   (donde está el árbol, y hacia el buzón) sigue relativamente oscuro —
   una sola fuente de luz en un lado de una isla grande no puede cubrir
   el lado contrario sin más alcance del que se ha probado. Pedido
   explícito de ENSEÑAR primero este resultado antes de decidir si hace
   falta mover el árbol y añadir una segunda farola en la esquina
   opuesta — no se ha tomado esa decisión todavía, queda para la
   siguiente ronda según lo que decida el usuario al ver las capturas.

### Fase 6 — Escena 3D (checkpoint 18: farola en la esquina del tejado, farolillo con varillas, propuestas de iluminación sin implementar)

Pedido explícito tras confirmar que el checkpoint 17 "mejora" el
resultado: mover la farola a la esquina de arriba del todo (a ver si
alumbra más); mejorar el farolillo ("es un cubo cutre"), con las cuatro
varillas metálicas típicas de estas farolas; y proponer (sin
implementar) alguna forma bonita de iluminar el resto del mapa.

1. **Posición: la esquina del tejado más opuesta a la cámara, no el
   centro de la ventana trasera.** Todas las esquinas del tejado están
   a la misma altura de mundo; la que se proyecta "más arriba" en la
   pantalla fija es la que queda más lejos de la cámara en su propia
   dirección de vista — se calcula igual que la esquina "contraria al
   árbol" del checkpoint 14 (mínima proyección sobre un vector de
   referencia), pero aquí el vector es `dirCamaraXZ` en vez de `perp`.
   Efecto secundario confirmado en captura: al estar en la esquina más
   alta/lejana del tejado, la luz llega un poco más lejos hacia el lado
   del árbol/buzón que en el checkpoint 17, aunque esa zona sigue sin
   estar tan iluminada como el lado de la ventana.

2. **Farolillo: cuatro varillas metálicas en las esquinas, mismo
   principio que el marco de las ventanas de la casa.** Un cubo de
   cristal liso (checkpoint 17) no se lee como un farol vintage de
   verdad — el detalle que lo distingue es el marco de hierro forjado
   en las esquinas, igual que `construirMarcoVentana` ya usa un marco
   delgado por encima del cristal en vez de una pieza nueva compleja.
   Las varillas (`BoxGeometry` finas) sobresalen un poco por arriba y
   por abajo del propio cristal (`alturaVarilla = alturaFarolillo *
   1.2`, no exactamente `alturaFarolillo`) para que se lean como postes
   que sujetan el farolillo, no como cuatro listones pegados a él sin
   más.

3. **Propuestas de iluminación para el resto del mapa — pedido
   explícito de NO implementar, solo proponer.** Ver la respuesta al
   usuario en la conversación para el detalle completo; en resumen, se
   propusieron: una `HemisphereLight` tenue solo de noche (barata, sin
   sombra, levanta un poco el negro más puro sin aplastar el contraste
   real de la farola); un farolillo colgado del propio árbol (reutiliza
   un objeto que ya existe, sin poste nuevo); y una hilera de luces
   pequeñas tipo guirnalda a lo largo del muro de piedras del borde de
   la isla (varios puntos de luz muy débiles, look "acogedor" barato).
   Ninguna se ha implementado — queda pendiente de que el usuario elija
   si quiere alguna antes de tocar el código.

### Fase 6 — Escena 3D (checkpoint 19: farolillo del árbol, farola de vuelta a la ventana, luna real con fase y estrellas)

Pedido explícito tras el checkpoint 18: el farolillo colgado del árbol
(de la lista de propuestas); arreglar la sombra de la farola para que
las varillas no cuenten; la farola de vuelta al centro de la ventana
(no la esquina); la luz de cielo tenue propuesta también; y que la
noche tenga en cuenta la luna real (fase, no posición exacta) con
estrellas cuya cantidad dependa de ella.

1. **Farola: de vuelta al centro de la ventana trasera.** La esquina
   del tejado (checkpoint 18) no compensaba lo bastante el pedido
   original de "alumbra más" como para justificar perder la composición
   centrada contra el cristal — se revirtió a la lógica de
   `paredTrasera` del checkpoint 16.

2. **Sombra de la farola: las 4 varillas del farolillo pasan a
   `castShadow=false`.** Mismo problema estructural que ya costó una
   ronda de bugs en el diseño "cobra" (checkpoints 15-16): las varillas
   rodean la propia `PointLight` a muy poca distancia (están pegadas al
   mismo farolillo donde vive el foco), así que proyectaban una sombra
   en cruz sobre el propio charco de luz que la farola produce, en vez
   de una sombra útil sobre otra cosa.

3. **Farolillo colgado del árbol — bug real de posición, la primera
   versión era literalmente invisible.** Cuerda + cajita cálida +
   `PointLight` propia (mismo criterio de encendido que la farola:
   noche o >75% de nubes, reutilizando `UMBRAL_NUBES_FAROLA`/
   `RAMPA_NUBES_FAROLA`). El primer punto de enganche
   (`alturaTronco + radioCopaBase*0.55`) caía DENTRO del volumen de la
   bola principal de la copa (la más baja de las tres,
   `PATRON_COPA[0]`, con la única de las bolas que baja hasta
   `alturaTronco - radioCopaBase*0.3`) — el farolillo quedaba enterrado
   dentro del follaje opaco, invisible aunque la geometría estuviera
   ahí de verdad. Corregido colgándolo bastante por debajo del punto
   más bajo real de la copa, no solo desplazado a un lado (un
   desplazamiento lateral pequeño seguía cayendo dentro del radio de la
   bola a esa altura).

4. **Luz de cielo tenue: `HemisphereLight`, sin sombra, modulada por la
   fase lunar real.** Propuesta ya descrita en el checkpoint 18,
   implementada tal cual: nula de día, y de noche entre 0.05 (luna
   nueva) y 0.22 (luna llena) — "si hay luna llena que alumbre un poco,
   si hay luna nueva que esté más oscuro" también se cumple aquí, no
   solo en el disco visible de la luna.

5. **`src/data/luna.js`, módulo nuevo — misma fase real para todo,
   posición no.** `getMoonIllumination(fecha)` de SunCalc (ya
   dependencia del proyecto desde la Fase 2) da `fraction` (0=nueva,
   1=llena) y `waxing` (creciente/menguante) sin necesitar lat/lon — a
   diferencia de la posición solar, la fase lunar es la misma para
   cualquier ubicación de la Tierra en un instante dado. No se usa
   `getMoonPosition` (la posición real en el cielo) — pedido explícito:
   "la luna tampoco tiene que estar en el sitio exacto". Calculado en
   `main-escena3d.js` a partir de la misma `fecha` que ya controla el
   resto de la escena (real o de depuración), sin ningún override nuevo
   en `depuracion.js` — no hace falta, la fecha ya se puede forzar con
   `?debugHora=`.

6. **Luna: dos rondas de bugs reales, cada una diagnosticada con
   evidencia antes de tocar el código a ciegas.**
   - **No aparecía en NINGUNA captura, con ningún ancla/altura probado
     a mano.** Se probaron tres combinaciones razonadas a partir de las
     coordenadas ya usadas por nubes/rayo (mismo "cuadrante seguro") sin
     éxito. Diagnosticado colocando temporalmente varios marcadores de
     colores en distintas coordenadas candidatas (borrados del código
     una vez confirmado el resultado, no dejados como deuda) y
     capturando de día para verlos con claridad: reveló que ni siquiera
     las coordenadas "seguras" de las nubes lo son para un objeto
     pequeño — las nubes se ven en esas posiciones porque son sprites
     grandes cuyo borde asoma al encuadre aunque su centro quede fuera;
     un objeto pequeño en el mismo punto no asoma nada. Con marcadores
     de prueba en magnitudes bastante más moderadas sí aparecieron
     limpiamente dentro de encuadre — la luna final usa una de esas
     coordenadas confirmadas (`x:-0.15, z:-0.3` a 0.45×radio de altura).
   - **Con la posición ya arreglada, la FORMA salía invertida: luna
     nueva se veía como un disco lleno y brillante, luna llena salía
     apagada/gris — justo al revés.** El primer algoritmo (arco de
     semicírculo fijo + elipse del terminador recortada con ángulos y
     "sweep flags" elegidos a ojo) tenía la lógica de qué zona
     dibujar/qué zona no invertida, y depurar ángulos de arco a ciegas
     no es fiable. Reescrito con una técnica mucho más fácil de
     verificar paso a paso: recortar el canvas al disco
     (`ctx.clip()`), rellenar la MITAD iluminada con un rectángulo llano
     (sin elipses todavía), y luego SUMAR o RESTAR una elipse completa
     (0 a 2π, sin ángulos parciales) con `globalCompositeOperation`
     (`destination-out` para recortar un creciente, `source-over` para
     añadir una gibosa) según si la fracción iluminada es menor o mayor
     que la mitad — cada uno de los tres casos límite (nueva, mitad,
     llena) se puede razonar a mano sin ambigüedad antes de escribirlo.
     Verificado con captura real en los tres casos tras el cambio.

### Fase 6 — Escena 3D (checkpoint 20: luna más pequeña, dos bugs de halo, estrellas a ambos lados, sombra real de la farola)

Pedido explícito tras ver el checkpoint 19: la luna es enorme y está en
medio de la pantalla, debería estar más arriba/detrás de la isla; solo
hay estrellas a la izquierda, en exceso, deberían salir aleatorias por
toda la pantalla pero más arriba (menos luz cuanto más arriba); la luna
tiene un cuadrado blanco visible; y la farola sigue con sombras mal —
"las varillas verticales no deberían producir sombra". Pedido explícito
de comprobar la escena y repetir el proceso si algo seguía mal — dos de
los cuatro puntos necesitaron una segunda vuelta tras la primera
corrección.

1. **Luna: mucho más pequeña y más arriba, misma dirección horizontal ya
   calibrada.** Tamaño de 0.32×radio a 0.13×radio (menos de la mitad);
   altura de 0.45×radio a 0.6×radio, misma técnica de calibración con
   marcadores de colores temporales (confirmado dentro de encuadre a
   esa altura mayor, sin recorte).

2. **Cuadrado blanco alrededor de la luna: el radio exterior del
   degradado del halo se salía del propio lienzo.** Con `tam=128` el
   lienzo mide `±64` desde el centro, pero el degradado llegaba hasta
   `r*2`≈102 — en los bordes y esquinas del cuadrado, el degradado
   TODAVÍA no había llegado a alpha 0 cuando se acababa el área
   dibujada, dejando un tinte con forma de cuadrado. Bajado a `r*1.15`
   (≈59, claramente por debajo de 64) para que llegue a alpha 0 de
   verdad dentro del lienzo.

3. **Anillo brillante en el borde del disco — apareció DESPUÉS de
   arreglar el cuadrado, mismo halo pero un bug distinto.** El halo se
   pintaba ANTES que el disco/terminador; la resta `destination-out` del
   terminador (luna nueva/creciente) no distingue de qué capa viene cada
   píxel — borraba también el halo ya pintado justo dentro del radio del
   disco, dejando el interior a alpha 0 mientras el halo seguía intacto
   justo fuera de ese radio: el salto entre "borrado dentro" e "intacto
   fuera" se leía como un anillo brillante pegado al borde, muy visible
   en luna nueva. Diagnosticado ampliando mucho una captura real del
   disco (no a simple vista en el encuadre normal). Arreglado moviendo
   el halo al FINAL, con `destination-over` (rellena por detrás de lo ya
   dibujado, sin que nada posterior pueda volver a borrarlo) — así
   ninguna operación sobre el disco puede afectarlo, salga la fase que
   salga. De paso, el disco base tenue (para que la luna nueva no fuera
   invisible del todo) pasó de un `rgba` de alpha plano a su propio
   degradado radial que ya llega a 0 en el radio `r` — el relleno plano
   anterior, recortado en seco justo en ese borde, había sido la
   PRIMERA versión (fallida) de intentar arreglar este mismo anillo,
   antes de encontrar la causa real en el orden de dibujo del halo.

4. **Estrellas: solo aparecían a la izquierda porque solo se había
   calibrado esa zona (`ANCLAS_NUBE`).** Mismo método de marcadores de
   colores, esta vez explorando el lado derecho del encuadre: dos puntos
   nuevos confirmados visibles (`ANCLAS_ESTRELLAS_DERECHA`,
   `{x:0.15,z:0.3}` y `{x:0,z:0.4}`). Cada estrella elige ahora al azar
   entre las anclas de AMBOS lados (`Math.random()`, no `i % length`
   como antes — eso repartía las anclas en un patrón fijo y predecible
   en vez de verdaderamente al azar). Para la densidad "más arriba,
   menos abajo" (pedido explícito, "cuanto más abajo más luz hay"): la
   altura ya era aleatoria (`Math.random()` simple), pero uniforme —
   `Math.random() ** 1.8` sesga el resultado hacia 1 (arriba) sin dejar
   de ser aleatorio, en vez de cambiar a un reparto no aleatorio.

5. **Sombra "mal" de la farola: no eran las varillas — ya se habían
   arreglado en el checkpoint 19 (sin `castShadow` desde entonces).**
   Confirmado en captura real ampliada de la base de la farola: una
   mancha oscura grande y redondeada pegada al pie del poste, no una
   sombra fina en cruz (que sí habría apuntado a las varillas). Causa
   real: el foco (`PointLight`) no tiene desplazamiento propio en X/Z —
   vive exactamente encima del eje del poste — así que el POSTE (y la
   BASE, mismo eje) quedan literalmente debajo del punto de luz,
   bloqueando su reparto omnidireccional en todas direcciones a la vez
   alrededor de su propia base. Arreglado quitando `castShadow` también
   del poste y la base (mismo criterio ya aplicado a pantalla/brazo en
   el diseño "cobra" y a las varillas en el checkpoint 19: ninguna pieza
   de la farola necesita proyectar sombra sobre el charco de luz que
   ella misma produce). El resto de la escena sigue recibiendo sombra
   real de este foco con normalidad.

### Fase 6 — Escena 3D (checkpoint 21: halo de la luna sin blanco en el lado oscuro, estrellas más pequeñas/variadas, shadow acne real, farola más lejos y alta)

Pedido explícito, en el mismo mensaje que reportaba que el checkpoint 20
no se notaba todavía: la luna tiene "una cosa blanca donde debería ser
oscura"; a veces salen estrellas encima de la luna; bajar tamaño y
densidad de las estrellas, con variación de tamaño/brillo y un filtro
que las haga brillar menos cuanto más abajo; la sombra de la farola
"sigue estando ahí... una sombra cuadrada que envuelve la farola"; el
techo hace algo raro con su propia sombra; aleja la farola de la
ventana y hazla un 20% más alta; en vertical la luna debería salir en
la parte más alta; y las paredes (sobre todo la translúcida) generan
mal la sombra, con luz visible en la parte de abajo.

1. **Halo de la luna: tercer bug real en el mismo degradado, encontrado
   tras arreglar el cuadrado (checkpoint 20) y el anillo (mismo
   checkpoint).** Con el halo ya movido al final vía `destination-over`
   (arreglo del anillo), ese modo de composición solo respeta lo que YA
   HAY cuando ya hay algo con alpha>0 — en el lado oscuro de una luna
   nueva/creciente (que el terminador deja en alpha 0 de verdad, no solo
   tenue), no había nada que respetar, así que el halo se pintaba ahí
   como si fuera la única capa, con su radio interior a alpha plano
   0.35: inundaba el lado oscuro entero de blanco sólido. Arreglado
   recortando el halo a un ANILLO real (`Path2D` con dos arcos y regla
   `evenodd`, entre `r` y `r*1.15`) que no puede pintar nada dentro del
   propio radio del disco — así da igual qué haya o no haya ahí dentro,
   y el orden de dibujo deja de importar del todo.

2. **Estrellas encima de la luna: exclusión por distancia XZ al ancla de
   la luna, mismo patrón `do...while` con reintento que ya usan las
   toperas.** `ANCLA_LUNA` se extrajo como constante compartida entre
   `construirLuna` y `construirEstrellas` para no duplicar el valor.
   Radio de exclusión 0.2 (unidades de `radio` de escena).

3. **Estrellas: menos densidad (220→130), menos tamaño, y variación real
   de tamaño/brillo con un filtro de altura.** `PointsMaterial.size` es
   un único escalar por `Points` (no admite tamaño por vértice sin
   shader propio, mismo límite ya documentado para lluvia/polvo) — la
   variación de TAMAÑO viene de `NIVELES_ESTRELLAS`, 3 grupos con su
   propio `size` (más estrellas pequeñas que grandes). La variación de
   BRILLO sí es continua: `vertexColors` sí admite un valor por vértice,
   así que cada estrella lleva su propio color (blanco escalado). El
   "filtro" de brillo por altura reutiliza literalmente el mismo `t`
   (0-1, sesgado hacia arriba) que ya decidía dónde cae la estrella —
   la misma altura que la coloca decide también cuánto brilla, sin dos
   cálculos separados.

4. **Sombra "cuadrada que envuelve la farola": no era ninguna pieza de
   la farola (poste/base ya sin sombra desde el checkpoint 20) — era
   `remate` (el cono de remate encima del farolillo), el único occlusor
   que quedaba pegado al foco.** Más ancho en su base que el propio
   farolillo, justo encima del punto de luz, tapaba buena parte del
   reparto omnidireccional. Quitado su `castShadow`, mismo criterio que
   el resto de piezas de este bloque.

5. **Shadow acne real y seria en toda la escena a sol rasante — no
   descrita explícitamente por el usuario en este mensaje, encontrada al
   diagnosticar visualmente el problema del techo/las paredes.**
   Confirmado ampliando una captura a las 18:30: un patrón de rayado
   fino cubría paredes/suelo/rocas por completo, "shadow acne" clásico.
   Causa: `bias`/`normalBias` de la luz del sol no se habían retocado
   desde el checkpoint 12, pero la farola (inexistente entonces) ha ido
   agrandando `radio`/`alcanceSombra` desde el checkpoint 14 — con el
   mismo `mapSize`, texels más grandes en unidades de mundo necesitan
   más bias para el mismo resultado sin ruido. Subidos ambos
   (`bias` -0.00012→-0.00035, `normalBias` 0.0015→0.004), re-verificado
   con el mismo par de escenas límite que en el checkpoint 12 (rocas a
   mediodía para "peter-panning", pared a sol rasante para acné) — el
   acné desapareció y no reapareció el hueco de peter-panning.
   **Pendiente:** los problemas concretos de "techo" y "pared
   translúcida" que describió el usuario no se pudieron reproducir de
   forma aislada tras arreglar el acné — es plausible que el ruido del
   acné fuera la causa real de lo que se percibía como esos dos
   problemas (un patrón de ruido denso se puede leer fácilmente como
   "sombra que no empieza donde debería" o "luz colándose"), pero no se
   ha confirmado con el usuario si siguen viéndose tras este arreglo.

6. **Farola: más lejos de la ventana y un 20% más alta — cambios
   directos, sin bug de por medio.** `margenFuera` de 0.9×escala a
   1.8×escala (con la sospecha, no confirmada aún en este checkpoint, de
   que estar tan pegada al marco de la ventana explicaba parte de la
   sombra "cuadrada" — el marco SÍ proyecta sombra para el sol, y con la
   farola tan cerca su `PointLight` también lo alcanzaba). Altura
   ×1.2 sobre el factor ya existente.

7. **Luna en retrato: altura atada a la misma proporción que ya usa
   `techoCielo(aspecto)` para nubes/estrellas.** La altura fija (0.6×
   radio) no aprovechaba el sobrante de cielo que el encuadre de retrato
   ya reserva — `PROPORCION_ALTURA_LUNA = 0.6/1.15` mantiene la relación
   ya calibrada en landscape pero deja que la altura real suba en
   retrato exactamente igual que sube el techo del cielo.

### Fase 6 — Escena 3D (checkpoint 22: farola rediseñada como poste en forma de horca)

Pedido explícito, interrumpiendo una verificación en curso del
checkpoint 21: "la farola no está quedando muy bien. en vez de eso pon
un poste como en forma de horca del que cuelgue otro farolillo como el
del árbol. que nazca de la hierba, no de las rocas como ahora" —
sustitución completa de diseño, no un ajuste más sobre el "vintage".

1. **`construirFarolilloColgante`, helper nuevo compartido entre el
   árbol y la farola.** El farolillo colgado del árbol (checkpoint 18:
   cuerda + cajita emissive + `PointLight`) se extrajo tal cual a una
   función reutilizable, con `conSombra`/`alcanceSombra` opcionales (el
   del árbol sigue sin sombra propia y con poca intensidad, decorativo;
   el de la farola sí proyecta sombra real y tiene mucha más intensidad,
   al ser ahora el único foco de la farola). `construirArbol` se
   simplificó para llamar a este helper en vez de mantener su propia
   copia del código.

2. **La farola pasó de base+farolillo propio+varillas+remate (diseño
   "vintage", checkpoints 17-21) a poste + brazo horizontal (silueta de
   horca/gallows) + el MISMO farolillo colgante del árbol.** Mucha menos
   geometría, y ya no hace falta ir desactivando `castShadow` pieza a
   pieza en un cubo propio — el farolillo cuelga del EXTREMO del brazo,
   desplazado hacia la casa, ya no "debajo" del punto de luz como pasaba
   con el poste del diseño "vintage".

3. **Bug real en el brazo de la horca, encontrado en la primera
   captura: apuntaba siempre en la misma dirección fija, sin importar
   hacia dónde estuviera la casa.** `rotation.z = Math.PI/2` tumba el
   cilindro a lo largo del eje X LOCAL — que coincide con el eje X del
   MUNDO porque este grupo no tiene ninguna rotación propia. `dirCasaX/
   dirCasaZ` es una dirección arbitraria (depende de la orientación real
   de la casa, spec.md ventana A = 248°), casi nunca alineada con el eje
   X del mundo — así que solo la POSICIÓN del brazo se calculaba con
   `dirCasaX/Z`, pero su orientación no, dejando un cilindro que no
   conectaba de verdad el poste con el punto de enganche. Arreglado con
   la misma técnica de "cilindro entre dos puntos" (cuaternión) que ya
   usó el brazo diagonal del diseño "cobra" (checkpoint 16) — funciona
   sea cual sea la orientación real de la casa, no solo por casualidad.

4. **Poste plantado en la hierba, no en las rocas — dos intentos hasta
   confirmarlo en captura real.** `margenFuera` (distancia desde la
   ventana hacia fuera) heredaba el 1.8×escala del diseño "vintage"
   anterior, que ya lo dejaba tocando el muro de piedras del borde de
   la isla; bajado primero a 1.0×escala (seguía tocando las rocas en
   captura) y después a 0.5×escala, confirmado ya claramente dentro de
   la hierba.

### Fase 6 — Escena 3D (checkpoint 23: farola de madera con tablas planas, agrandada y en la esquina simétrica al árbol)

Pedido explícito tras ver el checkpoint 22: "lo de la madera del
farolillo no has pillado lo que yo buscaba. me refería a algo más
pequeño, con tablas planas. que sea una vertical, otra horizontal, y
otra que sirva para sujetar la horizontal con la vertical, en un
triángulo. de la horizontal, en el borde, cuelga el farolillo. pero es
pequeño, como el del árbol. y los postes de madera también son más
pequeños que el que has hecho" — y, en dos rondas posteriores dentro
del mismo checkpoint, agrandarlo un 50% y moverlo para que la casa no
lo tapara, primero a un lado del centro de la ventana y finalmente,
pedido explícito, "a la esquina derecha de la casa, simétricamente al
árbol".

1. **Sustitución completa de material y forma — no un reajuste de
   tamaño sobre la horca de metal del checkpoint 22.** El poste con
   brazo de cilindros (`CylinderGeometry`, `COLOR_POSTE_FAROLA` hierro
   forjado) se sustituyó por tres TABLAS PLANAS (`BoxGeometry`) de
   madera (`COLOR_TRONCO`, el mismo tono ya usado en el tronco del
   árbol): vertical, horizontal y una diagonal de refuerzo — las tres
   coplanares (Z=0 en el espacio local de la pieza), formando el
   triángulo real que se pidió, no solo una silueta que lo sugiere.
   Tamaño fijo en metros (0.95m de poste de referencia, antes de
   escalar), sin atarlo a la altura de la casa como hacían los diseños
   "cobra"/"vintage" anteriores — pedido explícito de que fuera
   pequeño, y esos diseños se habían ido hacia arriba en altura
   precisamente por escalar con `geo.altura`.

2. **Tabla diagonal: longitud y ángulo calculados a partir de los dos
   puntos que conecta, no ajustados a ojo.** Un punto más abajo en el
   poste y otro a mitad de la tabla horizontal definen un vector 2D en
   el plano local; `Math.hypot`/`Math.atan2` dan la longitud y el
   ángulo de rotación reales — así el triángulo encaja exactamente
   aunque cambien `LONGITUD_BRAZO`/`ALTURA_POSTE` en el futuro, sin
   tener que volver a calcular nada a mano.

3. **Toda la escuadra se construye en un espacio local sencillo donde
   "hacia la casa" es siempre el eje +X, y se rota el GRUPO ENTERO una
   sola vez al final** (`grupo.rotation.y`) para alinear ese eje con la
   dirección real hacia la casa — en vez de orientar cada una de las
   tres tablas por separado con la dirección real (que costó un bug
   real en el brazo de la horca del checkpoint 22, con una pieza que
   apuntaba siempre igual sin importar la orientación de la casa). Con
   una única rotación de grupo, ese tipo de bug no puede volver a
   pasar pieza por pieza.

4. **Agrandado un 50% (`ESCALA_FAROLA`), incluido el propio farolillo
   — a diferencia del checkpoint 22, que lo dejaba del mismo tamaño que
   el del árbol a propósito.** Pedido explícito distinto esta vez
   ("hazlo más grande"): el farolillo ya no comparte tamaño con el del
   árbol, aunque siga siendo la misma función `construirFarolilloColgante`.
   Intensidad de la luz escalada con el cuadrado de `ESCALA_FAROLA`
   (mismo criterio que los diseños anteriores: con el farolillo más
   grande y más lejos del suelo, la iluminancia cae con el cuadrado de
   esa distancia).

5. **Posición: dos intentos fallidos antes de la posición final, cada
   uno confirmado o descartado con captura real.**
   - Centrada en la ventana trasera con un desplazamiento lateral "a
     ojo" (tangente a la pared, signo elegido sin verificar primero):
     en la primera captura quedaba prácticamente escondida detrás de la
     esquina de la casa; al invertir el signo del desplazamiento
     quedaba todavía MÁS escondida, no menos — confirmando que ese
     enfoque (mover lateralmente una cantidad arbitraria) no era fiable
     sin saber de antemano hacia qué lado "cae" la pantalla.
   - Pedido explícito de abandonar ese enfoque y usar en su lugar la
     esquina real de la casa "simétrica al árbol": reutiliza
     literalmente la misma técnica que ya usa `construirArbol` para su
     propia posición (`perp`, perpendicular a la cámara; la esquina de
     `geo.esquinasSuelo` con la proyección más negativa sobre ese
     mismo eje) — el lado contrario al árbol, una esquina REAL de la
     habitación, no una posición aproximada. Confirmado a ojo por el
     usuario en la primera captura con este cambio.

### Fase 6 — Escena 3D (checkpoint 24: integración en index.html junto al dashboard, cierra la Fase 6)

Pedido explícito: "falta integrar la escena 3D en index.html junto al
dashboard (ahora mismo vive aislada en escena3d.html) — eso cierra del
todo la Fase 6".

1. **Contenedor `#escena3d-hero`, HERMANO de `#app` en el DOM, nunca
   dentro — resuelve la duda que quedó pendiente desde el checkpoint
   1-3 (decisión 13: "dashboard.js reescribe innerHTML de su propio
   contenedor en cada render... hay que decidir cómo mantener la escena
   3D fuera del ciclo de re-render del dashboard antes de
   integrarla").** Con la escena en un elemento sibling (banner a ancho
   completo por encima de `#app`, no dentro), cada `render()` de
   `dashboard.js` (toggles, nueva anotación, refresco de clima cada 15
   min) reconstruye solo su propio `innerHTML` — el canvas WebGL de la
   escena nunca se toca. `main.js` monta ambos por separado, cada uno
   con su propio `storage`.

2. **`src/ui/escena3dDashboard.js`, módulo nuevo — reutiliza
   `obtenerDatosReales` tal cual, sin repetir el cálculo de posición
   solar que sí hace falta en `main-escena3d.js`.** A diferencia de la
   página de depuración aislada (que nunca hace fetch real, por diseño,
   y calcula `sol` a mano con `posicionSolar` porque solo tiene overrides
   de query string), aquí `obtenerDatosReales(lat, lon)` ya devuelve
   `actual.sol` con la forma exacta que espera `crearEscena3D`
   (`{elevacion, azimut, nubesPct}`, calculado con el mismo
   `posicionSolar` internamente) — no hay que llamarlo por separado.
   `clima.viento` se arma con `actual.viento`/`actual.vientoDireccion`
   (velocidad/dirección reales de Open-Meteo). Fallback si el fetch
   falla (sin red, por ejemplo): se construye igual la escena, con
   `posicionSolar` calculado directamente (no depende de red) y
   condiciones neutras (`nubesPct:0`, `precipitacion:0`, `viento:null`)
   — mismo criterio que el default de `estadoVentanas.js` (Fase 5):
   mejor un estado neutro sin datos que una escena rota o ausente.

3. **Bug real encontrado verificando la integración: race condition
   entre el fetch de la escena (asíncrono) y la captura/carga de
   página, sin ninguna señal de "lista".** Una primera verificación con
   Playwright en viewport de escritorio capturó la página con el hero
   completamente en blanco — el propio dashboard ya se había marcado
   `[data-cargado="true"]` (su fetch de clima, independiente, había
   resuelto antes) mientras el fetch de la escena todavía estaba en
   vuelo. En un viewport de móvil la misma carga sí había mostrado la
   escena completa, confirmando que era una carrera de temporización
   (ambos fetches piden datos al mismo host con latencia parecida, así
   que unas veces coincide y otras no) y no un problema de tamaño de
   contenedor. Arreglado con el mismo patrón que ya usan
   `dashboard.js`/`main-escena3d.js`: `contenedor.dataset.cargado =
   'true'` en `escena3dDashboard.js` tras llamar a `crearEscena3D`,
   para que cualquier código (verificación o futuro) tenga una señal
   fiable. Además, `#escena3d-hero` lleva un fondo de degradado cielo
   (mismo tono que el cielo despejado de día de la propia escena) en
   vez de heredar el fondo crema del body — evita un parpadeo en blanco
   real para el usuario mientras el fetch está en curso, no solo un
   arreglo de test.

4. **Altura del banner: `55vh` con `min-height: 360px`, no pantalla
   completa como `escena3d.html` (que usa `100vh`) — por eso un id
   distinto (`#escena3d-hero`) en vez de reutilizar `#escena3d`.**
   Ambas páginas comparten la misma hoja de estilos; con el mismo id se
   habría heredado sin querer la regla `100vh` pensada para la página
   aislada de pantalla completa. La cámara de la escena ya generaliza
   sola a esta proporción distinta (el aspecto real del contenedor, no
   un valor fijo, decide si usa la composición landscape o la
   portrait/"casa abajo, cielo arriba" ya calibrada en checkpoints
   anteriores) — no hizo falta tocar `construirCamara`. Verificado con
   captura real en escritorio (1280×800, aspecto ≈2.3, landscape) y
   móvil (393×852, con el hero en aspecto ≈0.77 — menos extremo que el
   ≈0.46 de la página aislada a pantalla completa, pero sigue disparando
   la rama portrait sin verse deformado).

5. **Bug real preexistente encontrado (no introducido por esta
   integración) al diagnosticar por qué `escena3d.html` sin ningún
   query param mostraba `THREE.BufferGeometry.computeBoundingSphere():
   Computed radius is NaN` en consola — diagnosticado con
   instrumentación temporal (`scene.traverse` + comparación de stack
   trace vía `console.error` parcheado, revertida antes de commitear),
   no a ciegas.** Causa: en `main-escena3d.js`,
   `override.viento !== null` — cuando no hay NINGÚN override activo,
   `leerOverrideDebug()` devuelve `{activo:false}` y deja el resto de
   campos, incluido `viento`, en `undefined` (no `null`). `undefined
   !== null` es `true`, así que el chequeo se colaba igual que un valor
   real, construyendo `clima.viento = {velocidad: undefined, direccion:
   0}` en vez de `null`. `construirViento` (escena.js) no trataba ese
   caso como "sin viento" — su guarda comprueba `viento.velocidad <=
   0`, y `undefined <= 0` es `false`, no `true` — así que construía las
   hojas del viento (`NUM_HOJAS = 7`, constante fija, coincide
   exactamente con el `count: 7` del error) con posiciones NaN en X/Z
   (dependen de `velocidad`; la Y no, por eso solo dos de las tres
   coordenadas salían mal). Arreglado cambiando la comparación a
   `override.viento != null` (comparación laxa: trata `undefined` y
   `null` igual, correcto aquí porque ambos significan "sin dato de
   viento"). Verificado sin errores de consola en 3 cargas seguidas de
   `escena3d.html` sin overrides y una carga con `?debugViento=25
   &debugVientoDir=90` (para confirmar que el override real de viento
   sigue funcionando).

6. **`escena3d.html` se deja intacta como página de iteración
   aislada — no se elimina ni se redirige.** Sigue siendo útil para
   iterar visualmente con el override de depuración (hora/nubes/
   lluvia/viento/tormenta forzados) sin depender de que el clima real
   coincida con lo que se quiere probar, tal y como se decidió crearla
   en el checkpoint 1-3.

### Fase 7 — Histórico

Antes de construir nada se le planteó al usuario el hueco real que la
spec no resuelve (§4.2/§6.4 piden "predicho vs. real" pero no cómo
reconstruir qué predecía el modelo en el pasado sin ningún histórico de
clima ni de estado de ventanas guardado) y se decidieron cuatro cosas
con él antes de escribir código: arquitectura del "predicho" (gemelo en
vivo vs. reconstrucción con Open-Meteo histórico), alcance de la
regresión (UA solo vs. UA+factorCapacidad juntos), técnica de gráfica
(SVG a mano vs. librería) y cuándo recalibrar (automático vs. manual vs.
ambos) — resueltas como se detalla en las decisiones siguientes.

1. **"Gemelo en vivo" en vez de reconstrucción con la API histórica de
   Open-Meteo — elegido explícitamente por el usuario entre las dos
   opciones planteadas.** Un `T_in` simulado (`src/model/gemelo.js`,
   `pasoGemelo`) avanza un paso cada vez que `dashboard.js` refresca
   clima (cada 15 min o al pulsar "Actualizar"), usando el clima y el
   estado de ventanas REALES de ese instante, y se corrige al valor real
   cada vez que el usuario anota — literalmente el patrón de gemelo
   digital que describe spec.md §1 (predice, se compara con la
   realidad, se corrige), sin necesitar ninguna API nueva ni asumir nada
   sobre estados pasados de las ventanas (que nunca se han guardado).
   Limitación aceptada a propósito: si la app pasa mucho tiempo cerrada,
   ese hueco se reconstruye repitiendo el ÚLTIMO clima real conocido en
   pasos de 15 min (`simularHorizonte`, ya existente en `termico.js`,
   reutilizada sin cambios) en vez de con un único paso de Euler con un
   `dt` enorme — un salto así sería numéricamente inestable para la
   parte de conducción del modelo (`dT/dt = UA/C·(T_out−T_in)` diverge
   con pasos grandes); repetir el mismo clima en pasos pequeños converge
   de forma estable hacia `T_out`, verificado en `gemelo.test.js` con un
   hueco de 3 días.

2. **Los acumuladores de regresión se ponderan por segundos reales, no
   por número de ticks.** `pasoGemelo` acumula `(T_out−T_in)` y
   `(Q_solar+Q_vent)` en `sumConduccionSeg`/`sumSolarVentSeg`
   multiplicados por los segundos reales transcurridos en cada llamada
   (no +1 por tick) — así un hueco largo de catch-up (una sola llamada
   que internamente da muchos pasos de `simularHorizonte`) pesa en el
   promedio lo que de verdad duró, no lo mismo que un tick normal de 15
   min. `regresoresPromedio()` divide por `segundosAcumulados`; devuelve
   `null` si no hubo ningún tick desde el último reinicio (dos
   anotaciones seguidas sin refresco de clima de por medio) — ese caso
   se trata como "sin predicción", no como una predicción con regresores
   a cero.

3. **`predicho`/`avgConduccion`/`avgSolarVent` se guardan DENTRO de cada
   anotación (`anotaciones.js`), no en un almacén de histórico
   aparte.** Cada anotación ya es, por diseño, un punto en el tiempo con
   su propio `timestamp` — añadirle estos tres campos opcionales
   (`null` si no hay gemelo previo o no hubo ningún tick) evita crear
   una segunda fuente de verdad que se pudiera desincronizar de la
   lista de anotaciones. `construirFilasRegresion()`
   (`recalibracion.js`) deriva `Δt`/`ΔT_real` de los `timestamp`/
   `temperatura` de dos anotaciones consecutivas en vez de guardar esos
   valores por duplicado.

4. **Regresión conjunta de `UA` y `factorCapacidad` (no solo `UA`) —
   elegido explícitamente por el usuario.** La ecuación del modelo es
   lineal en dos parámetros combinados: `dT_in/dt = a·(T_out−T_in) +
   b·(Q_solar+Q_vent)`, con `a=UA/C` y `b=1/C` — mínimos cuadrados
   (ecuaciones normales 2×2) sobre las últimas `VENTANA_RECALIBRACION=30`
   filas (cada fila = una anotación no etiquetada con regresores),
   recuperando `C=1/b`, `UA=a·C` y `factorCapacidad=C/(volumen·densidad·
   calorEspecífico)` — esta última constante se obtiene de
   `capacidadTermica(piso)/piso.factorCapacidad` en vez de duplicar la
   fórmula de `volumenZona()` (privada en `termico.js`). Verificado con
   datos sintéticos sin ruido (`recalibracion.test.js`) que el ajuste
   recupera exactamente un `UA`/`factorCapacidad` "reales" distintos de
   los del piso de partida.

5. **`MINIMO_FILAS_RECALIBRACION=10`, elegido a ojo (igual que los
   umbrales 3h/12h de antigüedad de la Fase 5) — no derivado de
   ningún dato real todavía.** Por debajo de ese mínimo no se intenta
   recalibrar (demasiado ruido en una regresión de 2 parámetros sobre
   pocas anotaciones escritas a mano). **Pendiente de ajustar con uso
   real**, mismo criterio que ya se dejó anotado para los umbrales de
   antigüedad.

6. **Guardas de seguridad antes de sobrescribir `UA`/`factorCapacidad`:
   sistema degenerado y resultado fuera de rango físico, ambos
   rechazados con `null` (no se toca `parametrosPiso`).** Sistema
   degenerado: determinante de las ecuaciones normales casi cero (p.ej.
   `Q_solar+Q_vent` siempre 0 en todo el histórico reciente — persiana
   bajada y ventana cerrada todo el rato — no hay información con la
   que separar `a` de `b`). Fuera de rango: `UA`/`factorCapacidad`
   resultantes fuera de `RANGOS.UA`/`RANGOS.factorCapacidad`
   (`src/ui/validacion.js`, Fase 4) — duplicados como constantes locales
   en `recalibracion.js` en vez de importados, a propósito: `src/model/`
   no depende de `src/ui/` en ninguna otra fase, y una regresión sobre
   anotaciones ruidosas puede dar un ajuste sin sentido físico aunque el
   sistema no sea degenerado (p.ej. `C` positivo pero absurdamente
   pequeño). "Last write wins" (decisión ya tomada en la Fase 4) solo
   aplica a un resultado que pasa estas guardas — nunca se sobrescribe
   con un ajuste dudoso.

7. **Recalibración automática tras cada anotación NO etiquetada,
   elegido explícitamente por el usuario entre automático/manual/ambos.**
   `dashboard.js` la dispara dentro de `manejarAnotacion()` solo cuando
   `etiquetas.length === 0`, reconstruyendo las filas desde CERO a partir
   de `listarAnotaciones()` completo cada vez (no incremental) — con
   como mucho unos pocos cientos de anotaciones en la vida realista de
   este proyecto, recalcular es barato y evita mantener un segundo
   estado acumulado sincronizado con las anotaciones guardadas. No hay
   ningún botón manual en `historico.js` — esa pantalla es de solo
   lectura a propósito, coherente con la decisión.

8. **Chart.js, primera dependencia de UI del proyecto — elegido
   explícitamente por el usuario en vez de SVG a mano.** Justificación
   dada: soporte nativo para colorear puntos individuales
   (`pointBackgroundColor` por índice, necesario para marcar distinto
   los puntos etiquetados de spec.md §6.4) sin tener que escribir esa
   lógica de posicionamiento a mano. Import `chart.js/auto` (registra
   todos los componentes) para no gestionar el registro manual de
   escalas/controladores. `options.animation:false` — bug real
   encontrado en la propia verificación: la primera captura con
   Playwright salió con casi todos los puntos aplastados cerca de la
   parte baja del eje Y pese a que `chart.data.datasets[...].data`
   contenía los valores correctos (confirmado inyectando la instancia
   del chart en `window` temporalmente e inspeccionándola) — la
   animación de entrada de Chart.js (~1s) todavía estaba a mitad de
   interpolar desde el arranque cuando la captura se disparó justo
   después de marcarse `[data-cargado="true"]`. Desactivar la animación
   no es solo el arreglo técnico: coincide con el tono tranquilo de
   CLAUDE.md para una pantalla de solo lectura que se consulta de un
   vistazo, no un elemento "vivo" como la escena 3D.

9. **Error medio mostrado en `historico.js`: media del valor absoluto
   del error, no el error con signo.** Para el resumen que lee el
   usuario ("cuánto se equivoca el modelo de media") un error con signo
   se podría promediar a casi cero por cancelación entre sobre- y
   sub-predicciones aunque el modelo fallara bastante en cada punto
   individual — el valor absoluto sí refleja la magnitud real del
   error. La regresión de recalibración en sí (`recalibracion.js`) SÍ
   usa el error con signo (mínimos cuadrados sobre la pendiente
   observada, no sobre su valor absoluto) porque ahí hace falta saber
   en qué DIRECCIÓN corregir `UA`/`factorCapacidad`, no solo cuánto se
   equivocó.

10. **`historico.html` como página nueva (mismo patrón que
    `parametros.html`/`escena3d.html`), no una sección dentro del
    dashboard.** Es una pantalla de consulta ocasional, no de uso
    diario — mismo criterio que ya separó parámetros del dashboard en
    la Fase 5. `vite.config.js` gana una cuarta entrada de build.
    Verificación visual nueva, `scripts/captura-historico.mjs` (mismo
    patrón que `captura-pantalla.mjs`), con una diferencia real: esta
    pantalla no hace ningún fetch (todo sale de `localStorage`), así
    que la verificación siembra anotaciones sintéticas con
    `page.addInitScript()` antes de navegar en vez de depender de red
    real — y de paso se hizo una comprobación funcional aparte contra
    el dashboard real (`index.html`, con red real) para confirmar que
    la primera anotación queda con `predicho: null` y una segunda
    anotación posterior sí lleva un `predicho` calculado de verdad, sin
    errores de consola.

### Fase 8 — PWA (cierra la spec entera)

1. **Repo real creado durante esta fase, con el usuario resolviendo tres
   decisiones antes de escribir código: quién genera los iconos, cómo se
   llama/qué visibilidad tiene el repo, y si esta fase también despliega
   de verdad o solo deja la PWA lista.** El proyecto no había tenido
   remote de git hasta ahora (`vite.config.js` ya dejaba `base: '/solana/'`
   como una apuesta razonada desde la Fase 4, sin repo real que la
   confirmara). Elegido: iconos generados por Claude (sin assets
   externos), repo `solana` público bajo la cuenta del usuario
   (`andereslavarodriguez`), y despliegue real a GitHub Pages (no solo
   dejar la PWA "lista para desplegar"). Sin `gh` CLI ni ninguna sesión
   de GitHub autenticada en el entorno — se instaló `gh` vía `apt`
   (necesitó sudo del usuario, ejecutado por él con `!`) y se autenticó
   con `gh auth login` interactivo (también ejecutado por el usuario, sin
   que Claude viera ninguna credencial). Rama local renombrada de
   `master` a `main` antes del primer push (sin remote todavía, cambio
   sin riesgo) para coincidir con el default de GitHub — no había ninguna
   decisión previa registrada sobre el nombre de la rama principal.

2. **`vite-plugin-pwa` con estrategia `generateSW`, no `injectManifest`.**
   Confirma la apuesta ya anotada en la Fase 4 (decisión 1: "vite-plugin-pwa
   en la Fase 8 sin escribir el service worker a mano"). `generateSW` es
   la opción estándar cuando no hace falta lógica de caché custom más
   allá de reglas declarativas de Workbox — que es exactamente lo que
   pide spec.md §7 (precachear todo, dejar el clima siempre en red real).

3. **`injectRegister: false` + registro manual del service worker desde un
   módulo compartido (`src/ui/registrarServiceWorker.js`, `virtual:pwa-register`)
   importado en los 3 puntos de entrada reales — no la inyección
   automática del plugin.** El sitio es multi-página desde la Fase 5 (4
   entradas en `rollupOptions.input`, no una SPA); aunque Vite sí llama
   al hook `transformIndexHtml` del plugin para las 4 páginas por igual
   (confirmado inspeccionando `dist/*.html` tras el build — las 4 llevan
   `<link rel="manifest">` con el `base` correcto), preferir un import
   explícito en JS es más fácil de verificar y de razonar sobre qué
   páginas registran el service worker de cuáles no, en vez de depender
   de un comportamiento implícito del plugin para un caso (MPA) menos
   común que su caso de uso principal (SPA). `escena3d.html` (página de
   depuración aislada, ver Fase 6 checkpoint 1-3 decisión 13) deliberadamente
   no importa este módulo — no es parte de la experiencia "instalable"
   real de la app, aunque sigue precacheada igualmente como parte del
   `dist/` completo (no hace daño, simplemente no se registra desde ahí).

4. **`skipWaiting: true` + `clientsClaim: true` en `workbox`, añadidos
   tras un bug real encontrado verificando con Playwright — no estaban
   en el primer intento.** Con `registerType: 'autoUpdate'` a secas, el
   service worker se instala y activa pero nunca toma control de una
   pestaña ya abierta hasta que el usuario cierra y reabre — confirmado
   con un test real (`navigator.serviceWorker.controller` se quedaba en
   `null` más de 30s tras cargar la página). `registerType: 'autoUpdate'`
   solo controla el comportamiento del *cliente* (recargar solo cuando
   hay versión nueva sin preguntar); `skipWaiting`/`clientsClaim` son
   opciones de Workbox aparte que hacen que el *service worker* no espere
   a que se cierren las pestañas para activarse y reclame el control de
   las ya abiertas de inmediato — con ambos, la primera visita ya queda
   controlada y funciona offline sin ninguna acción del usuario,
   verificado recargando las 4 páginas con `context.setOffline(true)`
   (red cortada de verdad en Playwright, no solo caché del navegador)
   tras el cambio.

5. **`navigateFallback: null` explícito.** Por defecto Workbox en modo
   `generateSW` puede configurar un fallback de navegación tipo SPA
   (cualquier ruta no encontrada cae en una página fija) — no tiene
   sentido aquí: las 4 páginas son URLs reales y distintas, cada una
   precacheada con su propia entrada exacta (`directoryIndex: 'index.html'`
   por defecto de Workbox ya resuelve `/solana/` sin filename al
   `index.html` precacheado, sin necesitar fallback). Confirmado que
   funciona navegando a las 4 rutas offline sin él.

6. **`runtimeCaching` con `NetworkOnly` explícito para
   `api.open-meteo.com`, no dejarlo fuera del `globPatterns` sin más.**
   Bastaría con que el dominio de Open-Meteo no coincidiera con ningún
   patrón de precacheo para que Workbox nunca lo intente cachear por
   iniciativa propia, pero dejar la exclusión implícita no es lo mismo
   que garantizar que un fetch a esa URL SIEMPRE golpea la red real y
   nunca una respuesta de caché de ningún tipo (runtime caching por
   defecto de `fetch()` sin ningún `registerRoute` que lo intercepte ya
   se comporta así en un Service Worker sin más, pero declararlo
   explícito documenta la intención — spec.md §7, "los datos de clima
   requieren red" — en vez de depender de que nadie añada sin querer una
   regla de caché genérica en el futuro). Verificado con Playwright:
   offline, el `fetch()` a Open-Meteo falla (`Failed to fetch`) en vez de
   devolver una respuesta 200 de caché.

7. **Iconos: un único SVG generado sirve tanto para los iconos "any" como
   para el "maskable", en vez de dos diseños separados.** Diseño simple
   (casa con dos ventanas — una por cada ventana real que modela la app —
   y sol, sobre fondo `--acento`) construido directamente con las
   variables de color ya definidas en `estilo.css`, sin ninguna
   herramienta de diseño externa. Verificado a mano que el contenido cae
   dentro de la "safe zone" maskable estándar (círculo inscrito al 80%
   del icono) antes de reutilizar el mismo PNG para ambos propósitos en
   el manifest — evita mantener dos artes separados sin necesidad.
   Rasterizado de SVG a PNG (192/512/apple-touch-icon 180) con
   `imagemagick` (`convert`, ya disponible en el sistema vía `apt`), sin
   añadir ninguna dependencia npm nueva solo para generar iconos.

8. **`npm install -D vite-plugin-pwa` colgado en segundo plano la primera
   vez (más de 8 minutos sin progreso real de E/S, confirmado con
   `/proc/<pid>/io`) — diagnosticado antes de matarlo a ciegas, no
   asumido como "npm es lento y ya está".** Se comprobó primero que la
   red funcionaba (`curl` directo al registry y a un tarball concreto,
   ambos con 200 OK) y que el proceso SÍ había tenido I/O real al
   principio (lectura/escritura creciendo) antes de quedarse parado del
   todo — descartando tanto un problema de red del entorno como un
   proceso zombi desde el minuto uno. Con la causa probable acotada
   (comportamiento intermitente de este `npm install` concreto en este
   entorno, no reproducible de forma determinista), se mató el proceso y
   se reintentó en primer plano con `--no-audit --no-fund --loglevel http`
   — terminó en 7s sin problema. **Pendiente/nota para el futuro:** si
   una instalación de npm en este proyecto vuelve a quedarse colgada
   mucho tiempo sin I/O real, matar y reintentar en primer plano con
   logging verboso es más fiable que esperar indefinidamente en segundo
   plano.

9. **`npm test` corre dentro del propio workflow de despliegue
   (`.github/workflows/deploy.yml`), antes de `npm run build` — no
   solo localmente antes de hacer push.** Coherente con la regla del
   proyecto (CLAUDE.md: "no saltar a una fase sin que la anterior tenga
   pruebas que pasen") aplicada también a CI: un futuro cambio que rompa
   `npm test` no debería poder desplegarse a producción aunque alguien
   olvide correr los tests a mano antes del push. `npm run test:datos`
   (Fase 2, requiere red y no es determinista) deliberadamente NO se
   incluye en el workflow — mismo motivo por el que ya está separado de
   `npm test` en local.

10. **`dist/` añadido a `.gitignore`, no committeado.** El build de
    producción lo genera el propio workflow de GitHub Actions en cada
    despliegue (paso `npm run build` → `actions/upload-pages-artifact`);
    no hay ninguna razón para versionar un artefacto que se regenera
    automáticamente en cada push a `main`, y evita divergencias entre lo
    committeado y lo realmente desplegado.

11. **Bug real encontrado por el usuario probando en su móvil real (no en
    ninguna de las verificaciones anteriores): la navegación interna
    entre dashboard/parámetros/histórico estaba rota en producción,
    online y offline por igual — no solo un problema de PWA.** Los
    enlaces cruzados (`dashboard.js`, `historico.js`, `parametros.js`)
    usaban rutas absolutas de raíz (`href="/parametros.html"`,
    `href="/"`) generadas dentro de plantillas JS (template strings), no
    como atributos HTML estáticos — Vite solo reescribe con el prefijo
    `base` (`/solana/`) las URLs que puede ver en el HTML en tiempo de
    build (`<script src>`, `<link href>`, etc.; confirmado en la Fase 8
    decisión 3 de este mismo documento), nunca dentro de un string
    generado en tiempo de ejecución. En producción esos enlaces
    apuntaban a `https://andereslavarodriguez.github.io/parametros.html`
    (la raíz del usuario en GitHub Pages) en vez de
    `.../solana/parametros.html` — un 404 real incluso online, que había
    pasado desapercibido en todas las verificaciones previas porque
    `npm run dev`/`vite preview` sirven bajo la ruta completa de todas
    formas al navegar con la barra de direcciones, y ninguna verificación
    anterior (Fases 4-8) había probado un CLIC en los enlaces de
    navegación cruzada contra un build real desplegado — solo `page.goto()`
    directo a cada URL. Diagnosticado reproduciendo offline contra el
    sitio real ya desplegado (no solo contra `vite preview` en local, que
    no expone este bug porque ahí la app vive en la raíz del dominio):
    `page.goto()` a cada página funcionaba bien offline (coincide con la
    URL exacta precacheada), pero hacer clic en los enlaces desde dentro
    del dashboard llevaba a `chrome-error://chromewebdata/` — confirmando
    que el problema no era el service worker sino la URL de destino en
    sí. Arreglado a rutas relativas sin barra inicial
    (`href="parametros.html"`, `href="index.html"`), que resuelven bien
    tanto en dev como en producción sin depender de ningún valor de
    `base` — más robusto que hardcodear `/solana/` a mano, y coherente
    con la lección ya aprendida en la Fase 4 (decisión 2) sobre lo frágil
    que es ese valor. **Lección para verificaciones futuras:** probar
    clics reales en la navegación (no solo `goto()` a cada URL por
    separado) y, cuando sea posible, verificar contra el sitio ya
    desplegado además de contra `vite preview` local — ambos escapan
    bugs que dependen del subpath real de despliegue.

12. **Rediseño de estilo tras la primera instalación real en móvil —
    pedido explícito: "evita usar la tipografía, colores y estilo de
    Claude. haz que sea minimalista".** La paleta original
    (terracota `#c97b4a` + crema `#faf3ea`) coincide de forma bastante
    directa con los colores de marca de Claude/Anthropic — aunque
    cumplía "cálido y hogareño" al pie de la letra (spec.md §6), leía
    como una plantilla genérica de IA en vez de tener identidad propia.
    Sustituida por oliva apagado (`--acento: #55654a`) + carbón cálido
    (`--texto: #262420`) + lino (`--fondo: #f3f1ea`) — sigue siendo
    cálido/hogareño (madera, plantas, luz de casa) pero deliberadamente
    fuera de la familia terracota. Titulares (`h1`/`h2`/`legend`/
    `.datos-clima dd`) en una pila de fuentes serif del sistema
    (`Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua',
    serif`) para un contraste clásico con el cuerpo en sans — sin cargar
    ninguna fuente externa (coherente con "sin servidor propio", CLAUDE.md).
    Esquinas de `border-radius` bajadas de 0.5-0.75rem a 0.15-0.2rem
    (casi rectas) y botones rectangulares, criterio "minimalista" pedido
    explícitamente — menos "redondeado y bonito", que es justo el rasgo
    que más se asocia con una interfaz generada por IA sin dirección de
    diseño propia. `.seccion-calibrable` (Fase 4, decisión 4: distinguir
    visualmente parámetros fijos de calibrables) pasa de un bloque de
    fondo de color propio a un borde izquierdo fino con el acento — la
    distinción funcional se mantiene, pero con mucho menos relleno de
    color, más en línea con "minimalista". Iconos de la PWA (Fase 8,
    decisión 7) y `theme-color`/`background_color` del manifest
    regenerados a juego con la paleta nueva — un fallback hardcodeado en
    `historico.js` (colores de Chart.js) también actualizado, aunque en
    la práctica siempre lee primero de las variables CSS reales.
    Verificado visualmente con los scripts de captura ya existentes
    (`captura-pantalla.mjs` para dashboard/parámetros,
    `captura-historico.mjs`) y contra el sitio ya desplegado en
    producción, no solo en local.

### Correcciones post-lanzamiento: motor de recomendación (2026-08-16)

El usuario reportó recomendaciones "absurdas" con un caso concreto: de
noche, con 22°C fuera y 26°C dentro, la app recomendaba cerrar la ventana Y
bajar la persiana — justo lo contrario de lo razonable (fuera está más
fresco que dentro, y de noche el sol no puede ser el problema). Diagnóstico
con simulaciones manuales (no solo lectura de código) antes de tocar nada,
reproduciendo primero el caso con los parámetros por defecto del piso: con
un pronóstico plano (22°C toda la noche) el motor SÍ recomendaba bien
("abrir") — hizo falta reproducirlo con un pronóstico de madrugada bajando
varios grados más en las siguientes horas (habitual: 22°C→16°C en 8h) para
que apareciera el primer bug. Dos bugs reales distintos, uno por ventana y
otro por persiana:

1. **`recomendarVentana`: la comparación de trayectorias completas (§5,
   decisión 7 de la Fase 1) pesaba por igual todo el horizonte de 6-8h, sin
   ninguna preferencia por el corto plazo.** Con un pronóstico que sigue
   bajando de madrugada, la trayectoria "ventana abierta" se enfría más
   rápido y por tanto se pasa por debajo de la banda de confort ANTES que
   la trayectoria "cerrada" — esa infracción futura, sumada a peso
   constante junto con el resto de pasos, pesaba más en la suma total que
   el beneficio real e inmediato de abrir ahora mismo (T_in muy por encima
   de la banda, T_out ya dentro de ella). Verificado que ni siquiera
   acortar el horizonte de golpe a un número fijo de pasos es una solución
   robusta (el resultado cambia de forma brusca según dónde se corte,
   comprobado a mano con varios cortes). Arreglado ponderando cada paso del
   horizonte con un peso que decae exponencialmente
   (`distanciaPonderada` en `recomendacion.js`, `VIDA_MEDIA_PASOS_VENTANA =
   3` — 45 min con pasos de 15min): lo que pase dentro de un rato (que la
   propia app puede corregir sola en el siguiente refresco automático de
   clima, cada 15min — Fase 5) pesa mucho más que lo que pase dentro de
   4-8h, sin dejar de anticipar del todo (spec.md §5 pide literalmente
   "abrir ahora O EN LAS PRÓXIMAS HORAS", no "en las próximas 8h por
   igual"). El valor 3 se eligió a ojo, verificado contra varios
   escenarios sintéticos (pronóstico plano, bajando fuerte, bajando
   moderado, con y sin T_in ya fuera de banda) antes de fijarlo — mismo
   criterio que otros parámetros del proyecto sin base empírica todavía
   (umbrales 3h/12h de antigüedad de anotación, `MINIMO_FILAS_RECALIBRACION`),
   **pendiente de ajustar con uso real**.

2. **`recomendarPersiana`: el atajo "T_in ya supera el máximo de confort
   ahora mismo -> bajar, sin mirar T_out" (§5, decisión 5 de la Fase 1) no
   comprobaba si había algo de sol de por medio.** De noche, sin ningún sol
   en todo el horizonte, `Q_solar` es 0 tanto con la persiana arriba como
   abajo — la posición de la persiana es literalmente indiferente
   térmicamente (esto ya lo dice spec.md §5 explícitamente para el caso
   "sin sol"), pero el atajo se disparaba igual solo por mirar T_in,
   recomendando "bajar" una persiana que no tiene ningún efecto real en
   ese momento. Quitar el atajo sin más no bastaba: incluso simulando la
   trayectoria con la persiana arriba y comprobando si supera el máximo en
   algún punto (la rama normal del algoritmo), el primer elemento de esa
   trayectoria es la propia `tInActual` ya por encima del máximo, así que
   `trayectoria.some(t => t > banda.max)` seguía dando `true` por el mismo
   motivo. Arreglado comparando de verdad las dos trayectorias completas
   (persiana arriba vs. abajo, mismo resto de estados): si son
   EXACTAMENTE iguales en todos los pasos, el sol no está en juego en todo
   el horizonte y se recomienda `'arriba'` sin más — mismo valor por
   defecto que ya usaba el resto del algoritmo para "no hace falta
   bajarla" (no "dejarla como está": se probó esa alternativa primero y
   rompía un test ya existente de la Fase 1 que esperaba `'arriba'` como
   default explícito para el caso sin sol, así que se mantuvo la
   convención ya establecida en vez de introducir una nueva).

3. **Verificación:** dos casos de prueba manuales nuevos en
   `test/model.test.js` que reproducen EXACTAMENTE el escenario reportado
   por el usuario (T_in=26°C, T_out empezando en 22°C y bajando a lo largo
   de 8h; y T_in=26°C sin nada de sol en el horizonte), además de los 4
   casos ya existentes de `recomendarVentana`/`recomendarPersiana`, todos
   pasando (`npm test`, 32 casos OK en total del fichero, sin tocar
   ningún otro módulo). El resto del modelo térmico (`termico.js`,
   `sombra.js`, `irradiancia.js`) no cambió — el problema estaba
   íntegramente en cómo `recomendacion.js` interpretaba las trayectorias
   simuladas, no en la física del modelo en sí.

### Rediseño del motor de recomendación + modelo de ventilación (2026-08-17)

El usuario, tras la corrección del día anterior, cuestionó la lógica de
fondo: el motor seguía comparando "estado fijo para las 6-8h enteras del
horizonte" contra el otro estado fijo — pero abrir/cerrar una ventana no es
una decisión que se tome de un tirón para toda la noche, se puede volver a
tocar en cualquier momento (y de hecho el dashboard recalcula la
recomendación sola cada 15 min, Fase 5). Propuso además calcular la hora
óptima de cambio en vez de un simple abrir/cerrar, y señaló un hueco físico
real: el modelo de ventilación no distinguía persiana arriba/abajo ni usaba
el viento real (ya disponible de Open-Meteo, sin usar en el modelo térmico).
Se plantearon las cuatro mejoras al usuario antes de tocar código
(`AskUserQuestion`) y se implementaron las cuatro.

1. **`recomendarVentana`/`recomendarPersiana` reescritas: buscan el mejor
   INSTANTE DE CAMBIO en vez de comparar dos estados fijos para todo el
   horizonte.** Nueva función `mejorEstrategiaUnCambio()` en
   `recomendacion.js`: para cada estado de partida candidato (ambos para
   ventana — no se asume que el estado físico actual sea el punto de
   partida óptimo, igual que el diseño original tampoco lo asumía;
   solo `arriba` para persiana, ver punto 2), prueba TODOS los instantes de
   cambio posibles (`trayectoriaConCambio()`: estado inicial hasta el paso
   k, el contrario desde ahí) y se queda con el que menos distancia
   acumulada a la banda de confort produce. El resultado ya no es solo
   "abrir"/"cerrar": incluye `proximoCambio` (`{ accion, pasos, minutos }`,
   o `null` si no conviene cambiar dentro del horizonte) — el dashboard
   ahora puede decir "abrir (y cerrar en 2.5h)" en vez de una única decisión
   sin fecha. Esto también volvió innecesario, y se eliminó, el caso
   especial "indiferente" que se había añadido el día anterior a
   `recomendarPersiana` (sin sol, cualquier instante de cambio da
   exactamente la misma trayectoria — el propio empate ya lo resuelve el
   sesgo de "no cambiar si no hay beneficio claro").

2. **Persiana: el punto de partida de la búsqueda sigue siendo siempre
   "arriba" (no el estado físico real), a propósito — asimetría deliberada
   respecto a la ventana.** A diferencia de la ventana (donde no hay un
   estado "por defecto" preferible), la persiana sí tiene uno ya establecido
   desde la Fase 1 (decisión 5: sin motivo para tenerla bajada si no hace
   falta) — mantenerlo evita reintroducir el mismo problema que costó
   arreglar el día anterior (si el punto de partida fuera "lo que hay
   ahora", con la persiana físicamente bajada por la razón que sea, la
   búsqueda podría recomendar "bajar" solo por inercia del estado actual,
   no porque haga falta).

3. **Se necesitó reintroducir la ponderación exponencial del horizonte
   (`DECAY_PASO`, `VIDA_MEDIA_PASOS=1.5` — 22.5 min) — el rediseño la había
   quitado al principio dando por hecho que buscar el instante de cambio
   bastaba, y un caso de prueba real demostró que no.** Con distancia SIN
   ponderar, un escenario con sol muy fuerte y sostenido (`elevacion=40°`
   fija, como en el test ya existente "T_in ya por encima de 25°C ahora
   mismo -> bajar") hacía que la búsqueda AGRAVARA el problema en vez de
   arreglarlo ya: la trayectoria "persiana arriba" en ese test no dejaba de
   calentarse en ningún momento del horizonte (la ganancia solar de una
   ventana suelo-a-techo a mediodía superaba la pérdida por conducción
   incluso con el exterior helando) — así que retrasar el cambio "escondía"
   parte de la posterior bajada de temperatura fuera del horizonte visible,
   dando una distancia acumulada menor cuanto más tarde se bajaba la
   persiana, aunque bajarla YA fuera estrictamente mejor en cada instante
   individual (Q_solar nunca puede ser negativo — decisión 8, Fase 1). Es
   el problema clásico de optimizar sobre un horizonte finito sin ningún
   descuento temporal: sin él, el optimizador puede aplazar indefinidamente
   una mala consecuencia con tal de empujarla fuera de la ventana evaluada.
   `VIDA_MEDIA_PASOS=1.5` se afinó a mano verificando ese caso (necesita
   vida media ≤1.5 pasos para recomendar bajar YA, no en ~1h) y
   comprobando que seguía sin romper el caso real que motivó todo esto el
   día anterior (T_in muy por encima de la banda, T_out más fresco pero
   bajando el resto de la noche -> sigue recomendando abrir). Efecto
   secundario aceptado conscientemente: con una vida media tan corta, el
   "próximo cambio" casi nunca anticipa más de 1-2h vista — se decidió que
   es un buen trade-off porque coincide con la premisa que motivó todo el
   rediseño (no es una decisión inamovible, la app la vuelve a calcular
   sola cada 15 min).

4. **`MEJORA_MINIMA=0.01`, guarda nueva para que la ponderación exponencial
   no fabrique un "próximo cambio" de puro ruido numérico.** Con el
   horizonte tan ponderado hacia el corto plazo, una diferencia a 6-8h
   vista pesa casi nada pero no es exactamente cero — verificado con el
   caso real que motivó la corrección del día anterior (26°C dentro, 22°C
   fuera bajando toda la noche): antes de esta guarda, la búsqueda
   recomendaba "abrir (y cerrar en 30 min)" por una diferencia de ~0.0005
   entre cerrar pronto y no cerrar nunca — indistinguible del ruido, pero
   igualmente "ganadora" al ser estrictamente menor. Un candidato solo
   sustituye al mejor hasta ahora si mejora por más de `MEJORA_MINIMA` —
   verificado que ese mismo caso ya no propone ningún cambio futuro
   (`proximoCambio: null`) tras la guarda, mientras que los casos donde sí
   hay una diferencia real (~0.1 o más en los escenarios probados) siguen
   proponiendo un cambio con normalidad. Valor elegido a ojo, con margen de
   sobra entre el ruido observado (~0.0005) y una diferencia real
   (~0.1) — pendiente de ajustar con uso real.

5. **`termico.js`: `qVentVentana` ahora depende de la persiana, con un
   parámetro nuevo `fraccionVentPersianaBajada` (0.15 por defecto).** Antes
   el caudal de ventilación de una ventana abierta era el mismo estuviera
   la persiana como estuviera — con la persiana bajada, una persiana
   enrollable normal deja pasar bastante menos aire, no el mismo caudal.
   `renovacionesHora` pasa a ser el caudal "persiana arriba"; con la
   persiana abajo se multiplica por esta nueva fracción. Nuevo parámetro
   editable en "Parámetros del modelo" (`parametros.js`,
   `validacion.js` con rango 0-1, igual que SHGC) — 0.15 elegido a ojo, sin
   base empírica todavía.

6. **`termico.js`: `qVentVentana` también escala con el viento real
   (`factorViento`), dato que ya se pedía a Open-Meteo (`wind_speed_10m`,
   desde la Fase 6 checkpoint 6) pero nunca llegaba al modelo térmico —
   solo se usaba en la escena 3D.** Con más viento entra más aire por una
   ventana abierta que en calma; `factorViento(v) = min(1 + v/15, 3)`
   (km/h), o sea caudal nominal en calma, hasta triplicado con viento
   fuerte. Simplificación deliberada: solo la VELOCIDAD del viento, no su
   dirección relativa a la fachada (barlovento/sotavento) — matiz real
   pero un parámetro más sin base empírica clara, fuera de alcance de esta
   mejora. `V_REF_VIENTO_KMH=15`/`FACTOR_VIENTO_MAX=3` elegidos a ojo,
   pendientes de ajustar con uso real. Sin dato de viento (tests,
   simulaciones que no lo pasan) el factor es 1 — no se asume ni calma ni
   viento, compatibilidad hacia atrás sin tocar ningún test existente.

7. **Datos reales: el viento pasa a ir también en cada punto del
   pronóstico (`adaptador.js`), no solo en `actual`.** `wind_speed_10m` ya
   se pedía a `minutely_15` completo desde la Fase 6 checkpoint 6, pero
   `puntoModelo()` solo lo exponía para el instante presente — ahora cada
   punto de `pronostico` lleva su propio `viento`, para que
   `simularHorizonte()` pueda escalar la ventilación con el viento
   PREVISTO en cada paso, no solo con el viento actual repetido. El gemelo
   en vivo (`gemelo.js`, Fase 7) también se actualizó para pasar
   `actual.viento` tanto a `simularHorizonte` como a `qVentTotal` — mismo
   criterio de consistencia física en todos los sitios que simulan.

8. **Verificación:** 5 casos de prueba manuales nuevos en
   `test/model.test.js` (persiana reduce el caudal proporcionalmente al
   nuevo parámetro, viento real lo escala, sin dato de viento se comporta
   igual que antes, y un caso de `proximoCambio` real para ventana y para
   persiana cada uno) — 33 casos OK en total del fichero, y 118 en todo
   `npm test`, sin romper ningún test ya existente (incluidos los 4 casos
   de `recomendarVentana`/`recomendarPersiana` de la Fase 1 y los 2 de la
   corrección del día anterior). Verificación visual con Playwright: el
   dashboard renderiza bien el nuevo inciso "(y bajar en 2.5h)" con datos
   reales (captura manual, no committeada), la pantalla de parámetros
   muestra y guarda correctamente el campo nuevo
   (`fraccionVentPersianaBajada`), y ninguna de las dos genera errores de
   consola.

### Persiana y ventana acopladas de verdad (2026-08-17, misma tarde)

El usuario probó la app en caliente (literalmente: anotó 32°C, mediodía de
agosto) y encontró un problema real en la interacción entre las dos mejoras
del mismo día: la app recomendaba abrir ambas ventanas Y bajar ambas
persianas — "al menos una podria estar abierta para que entre aire". Tenía
razón: `recomendarPersiana` seguía simulando con el estado FÍSICO ACTUAL de
`abierta` (normalmente cerrada, hasta que el usuario actúa sobre la propia
recomendación), nunca con el estado que `recomendarVentana` acababa de
recomendar — así que, desde que `qVentVentana` depende de la persiana
(mejora de esa misma mañana, ver más arriba), la búsqueda de la persiana
NUNCA veía el beneficio de ventilación de tenerla subida con la ventana
abierta, solo el coste de la ganancia solar. Sesgada sistemáticamente hacia
bajarla, sin ningún caso en que la ventilación pudiera compensar.

1. **`recomendarPersiana` calcula primero el horario de `recomendarVentana`
   para la MISMA ventana, y lo usa como estado fijo de `abierta` en su
   propia búsqueda — no el estado físico actual.** Nueva función interna
   `calcularMejorVentana()` (compartida por las dos funciones exportadas,
   antes duplicada como el cuerpo de `recomendarVentana`). Acoplo en un
   solo sentido (ventana → persiana), no bidireccional: `recomendarVentana`
   sigue asumiendo el estado ACTUAL de la persiana propia (una
   simplificación razonable y ya razonada — si en realidad la persiana
   también termina subiendo, la ventilación real solo sería MEJOR que la
   modelada, nunca peor, así que no invalida la recomendación de abrir,
   como mucho la hace conservadora). Ida y vuelta completa (persiana
   también influyendo en el cálculo de ventana con un punto fijo iterado)
   se descartó por complejidad no justificada por el problema real
   encontrado — decidir primero la ventana (la palanca más "grande":
   afecta a térmica Y seguridad/ruido) y ajustar la persiana después con
   ese dato ya resuelve el caso reportado.

2. **Nueva función `trayectoriaConCambios()` (plural), generaliza la
   anterior `trayectoriaConCambio()` (que se elimina) para simular DOS
   campos cambiando de forma independiente en la misma ventana — el que se
   está buscando (`persianaArriba`) y uno ya decidido de antemano
   (`abierta`, con su propio instante de cambio ya fijado por
   `calcularMejorVentana`).** Trocea el horizonte en los puntos de cambio
   de ambos campos (hasta 3 tramos) y encadena `simularHorizonte()` por
   tramo, igual que ya hacía la versión de un solo campo pero generalizado
   a una lista de cambios en vez de uno solo. `mejorEstrategiaUnCambio()`
   gana un parámetro opcional `fondo` (cambios fijos adicionales, vacío por
   defecto) — sin usarlo, el comportamiento de `recomendarVentana` no
   cambia en nada.

3. **Verificado con datos reales del piso (mediodía de agosto, T_out real
   ~27.5°C subiendo a ~30°C por la tarde) con distintos valores de T_in,
   antes y después del cambio:** con T_in hasta 28°C (ventana recomendada
   cerrada, T_out nunca baja de eso en el pronóstico) la persiana B (con
   sol real ahora mismo) sigue bajando igual que antes — el acoplo no
   cambia nada cuando la ventana no se va a abrir. Con T_in=32°C (ventana
   abierta, T_out siempre más fresco que dentro en todo el horizonte)
   AMBAS persianas pasan a "arriba" — la B, pese a tener sol real
   ahora mismo, prioriza la ventilación de una habitación a 32°C sobre
   evitar una ganancia solar moderada. Nuevo caso de prueba en
   `test/model.test.js` que reproduce esta comparación exacta (mismo sol,
   mismo T_in, cambiando solo T_out: con T_out=20 -> ventana abre y
   persiana sube; con T_out=40 -> ventana se queda cerrada y persiana baja,
   igual que antes de esta mejora) — 119 casos OK en total (`npm test`),
   sin romper ninguno de los ya existentes. Verificado también en el
   dashboard con Playwright y clima real (T_in=32 anotado): las dos
   tarjetas muestran "Persiana: subir", una de ellas con "(y bajar en
   1.5h)" cuando el sol vaya a alcanzarla más tarde — sin errores de
   consola.

4. **Sigue habiendo un matiz físico no modelado, mencionado por el usuario
   y confirmado con los propios números, que queda anotado como pendiente
   en vez de implementado: con las DOS ventanas abiertas a la vez, el aire
   circularía mucho más rápido (ventilación cruzada) que la suma de cada
   ventana abierta por separado — `qVentTotal` sigue sumando cada ventana
   de forma independiente, sin ningún término de sinergia entre ambas.**
   Fuera de alcance de esta mejora concreta (no fue lo que reportó el
   usuario esta vez) y sin un valor de referencia claro con el que
   modelarlo sin inventar un parámetro más a ciegas — si hace falta más
   adelante, se retoma con datos de uso real en vez de una suposición.

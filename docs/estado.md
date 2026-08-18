# Estado del proyecto

Última actualización: 2026-08-18 (bug real corregido: días marcados con
icono de lluvia sin lluvia real, corroborado ahora con la precipitación
acumulada del día; sol más grande en el icono "parcialmente nublado" —
ver "Icono de lluvia falso y sol más grande" al final del documento)

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

### Rediseño de interfaz móvil (2026-08-17, misma tarde)

El usuario probó la app instalada de verdad y dio el mismo veredicto que
motivó el rediseño de estilo de la Fase 8 (decisión 12): "no me convence,
es como de una página web... piensa la app para el móvil". Cinco quejas
concretas: hay que deslizar hacia abajo para ver todo; hacen falta más
botones; las pantallas están todas mezcladas en una sola página larga
("diferentes feeds"); demasiado texto; "Ventana A"/"Ventana B" no dice
nada (no sabe qué letra es qué ventana física); y marcar un cuadrado para
el estado de ventana/persiana "no me gusta, piensa otra forma". Antes de
tocar código se plantearon con el usuario (`AskUserQuestion`, con mockups
ASCII) las dos decisiones de fondo que cambian la arquitectura: cómo
resolver que la escena 3D (55vh) más el resto no cabía en una pantalla sin
deslizar, y qué control sustituye al checkbox — resueltas como se detalla
abajo.

1. **Pestañas fijas abajo (Inicio / Casa / Histórico / Parámetros),
   elegido explícitamente por el usuario entre tres opciones planteadas
   (pestañas con escena compacta arriba; pantallas deslizables
   horizontalmente tipo stories).** La app sigue siendo un sitio
   multi-página sin router (decisión de la Fase 4, no reconsiderada): cada
   pestaña es un `<a href>` a una página HTML real, no navegación en
   cliente. `src/ui/navInferior.js` (`insertarNavInferior(activa)`)
   construye la barra y la inserta en `document.body` — no dentro del
   contenedor que cada página reescribe con `innerHTML` en cada render
   (mismo motivo por el que la escena 3D vive en un hermano de `#app`
   desde el checkpoint 24 de la Fase 6), para que un re-render del
   dashboard no la destruya. Cada punto de entrada (`main.js`,
   `main-casa.js`, `historico.js`, `parametros.js`) pasa su propio id de
   pestaña activa de forma explícita en vez de intentar adivinarlo a
   partir de `location.pathname` (que cambia de forma con `base:
   '/solana/'` en producción frente a dev) — más simple y fiable.

2. **La escena 3D se muda a una pestaña propia (`casa.html` +
   `src/ui/main-casa.js`), a pantalla completa — deja de vivir como hero
   de 55vh dentro de Inicio.** Reutiliza `montarEscena3D`
   (`src/ui/escena3dDashboard.js`, checkpoint 24 de la Fase 6) tal cual,
   sin duplicar la lógica de datos reales/fallback. Sigue siendo el
   "elemento central" de la app (spec.md §6.1) — solo que ahora se ve
   entera en su propia pestaña, en vez de recortada dentro de un hero que
   competía por espacio con los controles. `vite.config.js` gana una
   quinta entrada de build (`casa`); `globPatterns` de la PWA ya la
   precachea sin cambios (patrón genérico `**/*.html`).

3. **Inicio (`index.html`, `#app-compacto`) pasa a ser una pantalla solo de
   controles, rediseñada para caber en una pantalla de móvil sin deslizar:
   clima en una fila compacta de icono+valor, temperatura interior +
   botón "+" que despliega un formulario de anotación compacto (colapsado
   por defecto), y dos tarjetas de ventana con controles interruptor.**
   Verificado con Playwright en viewport 393×852 (`document.documentElement
   .scrollHeight <= clientHeight`) tanto en el estado normal como con el
   formulario de anotación desplegado — cabe sin deslizar en ambos casos.
   No se fuerza `overflow: hidden` en ningún sitio: si un móvil más
   pequeño o un estado con más contenido no cupiera, el contenido haría
   scroll en vez de recortarse — "no deslizar" es el diseño objetivo para
   el caso normal, no una prohibición dura que arriesgue esconder
   funcionalidad real. Histórico y Parámetros NO se tocaron en este
   sentido — siguen siendo pantallas de consulta/edición ocasional con
   scroll normal (decisión ya tomada en la Fase 5), solo ganan la barra de
   pestañas y pierden los enlaces de texto cruzados que tenían en la
   cabecera.

4. **Botón interruptor único (icono + color, tocar invierte el estado)
   sustituye al checkbox de "Ventana abierta"/"Persiana subida" — elegido
   explícitamente por el usuario entre tres opciones (par de botones
   Abrir/Cerrar; deslizador tipo iOS).** `.control-estado`/`.activo` en
   `estilo.css`: fondo/color de acento cuando está activo (abierta /
   subida), blanco con texto atenuado cuando no. Icono nuevo por estado en
   `src/ui/iconos.js` (`iconoVentanaAbierta`/`Cerrada`,
   `iconoPersianaSubida`/`Bajada`) — mismo criterio que los iconos de la
   PWA (Fase 8, decisión 7): SVG generado a mano, sin librería externa.
   **Bug de especificidad CSS real, encontrado antes de verificar
   visualmente (no en producción):** la regla genérica preexistente
   `button[type='button']` (Fase 4/5, botón "Actualizar"/"Reintentar")
   tiene más especificidad que una clase sola (`.control-estado`) porque
   añade un selector de elemento sobre el mismo nivel de
   clase/atributo — así que sus `padding`/`border`/`background`
   ganaban pese a estar declarados antes en el archivo. Arreglado
   calificando los selectores nuevos con el elemento
   (`button.boton-icono`, `button.control-estado`,
   `button.control-estado.activo`) para igualar esa especificidad y que
   el orden de declaración (más tarde en el archivo) decida, en vez de
   depender de casualidad. Comprobado con un script de Playwright ad-hoc
   (no committeado) que `getComputedStyle` da el `border-radius`/
   `background` esperados, y visualmente en las capturas.

5. **Ventanas identificadas por punto cardinal derivado de
   `ventana.orientacion` (`src/ui/etiquetaVentana.js`,
   `etiquetaCompass()`), no por un apodo guardado aparte.** Una sola
   fuente de verdad (la orientación real, ya editable en Parámetros desde
   la Fase 4) — no puede quedar desincronizada de la geometría real si se
   corrige. Decisión no obvia sobre el redondeo: bins de 45° que arrancan
   en el propio grado de cada dirección (`floor(orientacion/45)`), NO
   bins centrados en cada dirección (`round(orientacion/45)`) — con bins
   centrados, las dos orientaciones reales de este piso (248°/68°,
   spec.md §3.4) caen justo al otro lado del límite (a 22°/23° de
   distancia de sus dos vecinos, prácticamente empatadas) y salen
   "Oeste"/"Este" en vez de "Suroeste"/"Noreste" — el nombre que el
   propio spec.md ya usa para ellas, presumiblemente porque el autor
   original las redondeó de forma coloquial, no bin a bin. Con bins que
   arrancan en el grado exacto de cada dirección, las dos orientaciones
   reales caen exactamente donde ya se esperaba, verificado con un caso
   de prueba que lo comprueba explícitamente contra
   `PARAMETROS_PISO_POR_DEFECTO` (`test/etiquetaVentana.test.js`, 8 casos,
   integrado en `npm test`). La etiqueta se usa en el título de cada
   tarjeta de Inicio y, además, junto a "Ventana A"/"Ventana B" en los
   encabezados de la pantalla de Parámetros (para que el usuario pueda
   relacionar la letra con el punto cardinal mientras edita los grados a
   mano) — el `nombre` interno ('A'/'B') no cambia, sigue siendo la clave
   real usada por `estadoVentanas`/`recomendacion.js`.

6. **Menos texto: recomendaciones reducidas a icono + verbo corto (p.ej.
   "🗔 Abrir (cerrar en 2h)"), sin la frase "Basado en tu última anotación,
   hace X" repetida en cada tarjeta — ese dato ya está una sola vez en la
   fila "Interior" de arriba.** El aviso de antigüedad (3h-12h, Fase 5)
   solo se muestra dentro de la tarjeta de ventana cuando de verdad aplica
   (estado 'aviso'), no como nota siempre visible. Etiquetas de anotación
   (cocinando/climatización/más gente) pasan de checkboxes en lista
   vertical a chips en una fila que envuelve (`.chip`), mismo patrón
   visual que ya usan otras apps para selección múltiple compacta.

7. **Verificación:** `npm test` (122 casos, incluidos los 8 nuevos de
   `etiquetaVentana.test.js`) y `npm run build` sin errores ni avisos
   nuevos. Visual con `scripts/captura-pantalla.mjs` en viewport de móvil
   (393×852) para las 4 páginas reales (`index.html`, `casa.html`,
   `historico.html`, `parametros.html`) sin errores de consola en
   ninguna. Un aparente bug en la primera captura de Parámetros (la barra
   de pestañas parecía aparecer a mitad de página, no fija abajo) resultó
   ser un artefacto conocido de las capturas `fullPage: true` de
   Playwright con elementos `position: fixed` (se "congelan" en la
   composición apilada) — descartado como bug real comprobando
   `getBoundingClientRect()` antes/después de hacer scroll (se mantiene
   pegada a `clientHeight` en ambos casos) y con una captura de viewport
   normal (no `fullPage`), donde se ve fija abajo como se espera.

### Corrección: 100% de nubes ya no equivale a "sin sol" (2026-08-17)

El usuario, usando la app recién desplegada con datos reales (29.7°C
fuera, 27.5°C dentro, 100% nublado), le sorprendió que las dos ventanas
recomendaran subir la persiana con ese percance ("porque si está 100%
nublado considera que no me da el sol? porque sigue notándose aunque haya
nubes"). Diagnóstico confirmado leyendo el código antes de tocar nada:
`factorNubosidad()` (`src/model/irradiancia.js`, Fase 1 decisión 3) era
una atenuación lineal exacta, `1 − nubesPct/100` — a 100% de nubes daba
factor 0 exacto, es decir `Q_solar = 0` en cualquier ventana pase lo que
pase con el sol real. Correcto en la forma general (a más nubes, menos
sol) pero equivocado en el extremo: un cielo totalmente cubierto real
sigue dejando pasar luz difusa notable, no es lo mismo que "de noche".

1. **`FACTOR_NUBES_MINIMO = 0.2` (`src/model/constantes.js`), suelo nuevo
   para la atenuación lineal — no se sustituyó por una curva no lineal
   tipo Kasten-Czeplak (una alternativa real y más "correcta"
   físicamente) a propósito.** Se valoraron las dos: la fórmula de
   irradiancia con nubosidad de Kasten-Czeplak (`1 − 0.75·(nubes/100)^3.4`)
   es un modelo real y citado en ingeniería solar, pero introduce dos
   constantes "de manual" (0.75 y 3.4) sin ninguna base ajustada a este
   piso — rompe con el patrón ya establecido en todo el proyecto de
   preferir un solo parámetro simple, documentado como "elegido a ojo,
   pendiente de ajustar con uso real" (mismo criterio que
   `fraccionVentPersianaBajada`, `VIDA_MEDIA_PASOS`,
   `UMBRAL_TORMENTA_MM`, etc. — ver decisiones anteriores). Un suelo
   lineal con un único parámetro (`FACTOR_NUBES_MINIMO`) es igual de
   fácil de razonar y de retocar más adelante si hace falta.
   `factorNubosidad(nubesPct) = max(FACTOR_NUBES_MINIMO, 1 −
   (1−FACTOR_NUBES_MINIMO)·nubesPct/100)` — sigue siendo lineal, sigue
   dando 1 en 0% de nubes, pero ya no baja de 0.2 en el otro extremo.
   0.2 (20%) es el orden de magnitud habitual citado para la fracción de
   irradiancia difusa que atraviesa un cielo muy cubierto (normalmente
   entre 15% y 30%), no un valor ajustado empíricamente a este piso.

2. **Efecto en cadena real, encontrado corriendo los tests tras el
   cambio: un caso de prueba existente de "próximo cambio" de persiana
   dejó de pasar, y result usaba precisamente el bug como parte de su
   premisa — no un fallo del cambio en sí.** El caso simulaba "nublado y
   cómodo ahora, se despeja con sol fuerte en 45min" usando
   `nubesPct: 100` para el tramo "sin sol" — con el suelo nuevo, ese tramo
   ya no es gratis (aporta algo de calor no deseado, por poco que sea), así
   que la estrategia óptima pasó de "subir ahora, bajar en 45min" a "bajar
   ya" — correcto con la física nueva, ya no servía para probar el cálculo
   de "próximo cambio" en sí. Se sustituyó el tramo "sin sol" por elevación
   solar negativa (antes del amanecer, `elevacion: -5`) en vez de nubosidad
   — sigue siendo `Q_solar = 0` exacto en cualquier caso (`iProxy` recorta
   `sin(elevación)` a 0, no pasa por `factorNubosidad`), así que reproduce
   el mismo escenario sin depender del suelo de nubes. Se añadió además un
   caso nuevo que verifica explícitamente el comportamiento corregido: con
   sol fuerte real más adelante en el horizonte, un tramo de 100% nubes
   YA NO vale la pena "esperar a que aclare" — baja la persiana desde ya.
   `test/model.test.js`: 35 casos OK (dos nuevos, uno reescrito), 124 en
   total en `npm test`.

3. **Verificación con los datos reales que reportó el usuario** (fetch
   real a Open-Meteo, ubicación/parámetros por defecto, ambas ventanas
   cerradas con persiana bajada, T_in=27.5°C anotada): antes del cambio,
   las dos ventanas recomendaban persiana "arriba" (100% nublado ->
   `Q_solar=0` en las dos, sin motivo para bajarla). Después del cambio,
   la ventana Suroeste (sol real esa tarde casi de frente, azimut del sol
   ~227° vs. orientación de la ventana 248°) pasa a recomendar "bajar"
   (con el suelo de nubosidad ya aporta calor no deseado con T_in ya por
   encima de la banda); la ventana Noreste (68°, sol al otro lado del
   edificio en ese momento, `cosIncidencia` recortado a 0 sin importar la
   nubosidad) se queda igual en "arriba" — coherente con que solo influye
   la ventana que de verdad puede recibir sol, no las dos por igual.

### Corrección: la recomendación de ventana ya no depende del botón físico de persiana (2026-08-17)

El usuario, comparando la recomendación con distintas combinaciones reales
de persianas, señaló el problema con precisión antes de que se le
explicara ninguna causa: "la recomendación de qué hacer con las ventanas
no puede depender de cómo estén las persianas. la recomendación debe ser
la mejor de las 4 combinaciones... debería decirme en 3 horas abre la
ventana y la persiana, no que dé por hecho que voy a dejar la persiana
bajada". Diagnóstico confirmado leyendo el diseño ya documentado más
arriba (checkpoint "Persiana y ventana acopladas de verdad", mismo día):
`recomendarVentana` calculaba el horario de la ventana usando el estado
FÍSICO ACTUAL de la persiana (`estadosVentanasActuales`, el que declara el
usuario con el botón) como fijo durante toda la simulación — así que subir
o bajar la persiana con la ventana cerrada cambiaba de verdad la
recomendación de la ventana, porque cambia cuánto calor solar entra por el
cristal aunque la ventana esté cerrada. Ese checkpoint ya había reconocido
el acoplo (ventana → persiana) pero explícitamente lo dejó de un solo
sentido ("ida y vuelta completa... se descartó por complejidad no
justificada por el problema real encontrado") — el problema real que
faltaba para justificarlo llegó ese mismo día, unas horas más tarde.

1. **`optimizarConjunto()` (`src/model/recomendacion.js`), descenso por
   coordenadas de 2 rondas, no una búsqueda combinatoria de las 4
   combinaciones × todos los instantes de cambio de las dos a la vez.**
   Se valoró la búsqueda combinatoria completa (matemáticamente exacta,
   probaría cada combinación de instante de cambio de ventana × instante
   de cambio de persiana) pero sale ~65× más cara que el resto del motor
   sin necesidad: cada ronda de `optimizarConjunto` ya es una búsqueda
   EXACTA de un campo con el otro fijo (reutiliza `mejorEstrategiaUnCambio`
   tal cual), así que alternar ventana→persiana→ventana... es
   literalmente un descenso por coordenadas sobre la misma distancia
   ponderada que ya usa todo el motor — cada ronda no puede empeorar el
   resultado de la ronda anterior (cada una es un mínimo exacto de su
   propio campo), así que converge a un punto fijo estable sin explorar
   las ~4356 combinaciones por ventana que exigiría la fuerza bruta.
   Ronda 0: calcula la ventana con la persiana física actual de fondo
   (igual que antes de esta corrección) y decide la persiana óptima para
   ese horario de ventana. Ronda 1: recalcula la ventana usando esa
   persiana YA OPTIMIZADA de fondo (no ya la física) y vuelve a decidir la
   persiana. `recomendarVentana`/`recomendarPersiana` devuelven el
   resultado de la ronda final.

2. **2 rondas (`RONDAS_OPTIMIZACION_CONJUNTA = 2`), verificado
   empíricamente hasta 5 rondas antes de fijarlo, no una intuición sin
   comprobar.** Con un script ad-hoc (no committeado) sobre el clima real
   del momento (29.7°C fuera, 27.5°C dentro, 100% nublado) y sobre un
   escenario sintético (calor+sol ahora, se enfría y anochece en 45min): a
   partir de la ronda 1 el resultado deja de cambiar (comprobado hasta la
   ronda 4), y — más importante que la estabilidad en sí — dos búsquedas
   arrancadas con la persiana física en `SUBIDA` y en `BAJADA`
   convergen exactamente al mismo resultado final, que es el bug concreto
   que reportó el usuario. `assert.deepEqual` entre ambas en el nuevo caso
   de test (ver punto 4) comprueba esto mismo, no solo que las dos den la
   misma `accion`.

3. **Alcance deliberadamente NO ampliado a las dos ventanas a la vez —
   sigue siendo la misma limitación ya documentada esa mañana ("no hay
   ningún término de sinergia... si hace falta más adelante, se retoma
   con datos de uso real").** `optimizarConjunto` co-optimiza
   ventana+persiana de UNA MISMA ventana; la ventana contraria se sigue
   tratando como un dato de entrada fijo (su estado físico real, vía
   `estadosVentanasActuales`), tal y como ya hacía el diseño anterior —
   confirmado con el mismo script real: la recomendación de la ventana A
   deja de depender de la persiana de A, pero la de la ventana B (que
   comparte la misma zona térmica de una sola pieza, spec.md §4) sigue
   dependiendo de qué haga A, porque el calor solar que entra por A
   calienta la MISMA habitación que ventila B — eso es física real de una
   sola zona, no el bug reportado, y ampliar la co-optimización a las dos
   ventanas a la vez multiplicaría el coste (2 ventanas × 2 rondas cada
   una, con dependencia circular entre ambas) sin que haya evidencia
   todavía de que haga falta.

4. **Verificación:** caso de prueba nuevo en `test/model.test.js`
   reproduciendo el escenario del usuario (calor y sol fuerte ahora,
   anochece en 45min) llamando a `recomendarVentana` dos veces con
   `estadosVentanasActuales` idénticos salvo la persiana física de A
   (subida vs. bajada) — `assert.deepEqual(rSubida, rBajada)` sobre el
   resultado completo (acción, próximo cambio y trayectoria), no solo la
   acción. 36 casos OK en `model.test.js` (uno nuevo), 125 en total en
   `npm test` — ninguno de los 35 casos ya existentes cambió de resultado
   con el nuevo diseño (los escenarios de prueba ya usaban combinaciones
   de persiana que coincidían con el óptimo conjunto, así que no hizo
   falta reescribir ninguno, a diferencia de la corrección del suelo de
   nubosidad de más arriba). Verificado también con clima real del
   momento (29.7°C fuera, 100% nublado): la ventana Suroeste da "cerrar"
   en las 4 combinaciones de persianas reales posibles (antes daba
   resultados distintos según la persiana física de esa misma ventana).

### Segunda vuelta: la combinación óptima es de las 4 magnitudes a la vez, no por ventana (2026-08-17, misma tarde)

El usuario no se conformó con la corrección anterior — con razón: esa
corrección solo unía ventana y persiana de la MISMA ventana física
(`optimizarConjunto`, un solo `nombreVentana`), dejando la ventana
CONTRARIA fija en su estado físico real. "La recomendación debe ser la
mejor de las 4 combinaciones... esa posición no depende de como esté ni
una ventana ni otra, ni una persiana ni otra. la posición óptima es la
que hay que calcular combinando las 4 opciones de cada conjunto ventana
persiana" — la propia sección "Persiana y ventana acopladas de verdad"
de esa misma mañana ya había dejado anotado el límite exacto que el
usuario acababa de encontrar en la práctica ("no hay ningún término de
sinergia... si hace falta más adelante, se retoma con datos de uso
real") — llegó antes de lo esperado.

1. **`optimizarConjuntoGlobal()` sustituye a `optimizarConjunto()` —
   generaliza el descenso por coordenadas de 2 campos (ventana+persiana
   de UNA ventana) a 4 campos (ventana+persiana de las DOS ventanas),
   reutilizando exactamente la misma maquinaria de simulación.**
   `trayectoriaConCambios`/`mejorEstrategiaUnCambio` pasan de asumir un
   único `nombreVentana` implícito a que cada entrada de `cambios` lleve
   su propio `ventana` — cambio mínimo (una clave más por entrada) que
   permite que `fondo` incluya cambios de la ventana CONTRARIA, no solo
   de campos de la misma. `camposDelPiso(parametrosPiso)` deriva los 4
   campos a optimizar (ventana+persiana de cada `parametrosPiso.ventanas`)
   en vez de tener a A y B escritos a mano — generaliza sola si algún día
   hay más de dos ventanas, aunque eso siga sin ser un objetivo de la
   spec.

2. **Sigue sin ser una búsqueda combinatoria de las 4×4 combinaciones ×
   todos los instantes de cambio a la vez — mismo criterio de coste ya
   razonado esa mañana, ahora aplicado a 4 campos en vez de 2.** Cada
   ronda recorre los 4 campos en orden fijo (A.abierta, A.persianaArriba,
   B.abierta, B.persianaArriba) y busca el mejor horario de cada uno con
   los otros TRES ya fijados en su mejor valor conocido hasta el momento
   (de esta ronda si ya se recalcularon, de la ronda anterior si no) —
   descenso por coordenadas de Gauss-Seidel, no de Jacobi (usar el valor
   más reciente de cada campo, no solo el de la ronda anterior, converge
   más rápido).

3. **2 rondas (mismo valor que la corrección anterior, no cambiado),
   verificado esta vez con 7 combinaciones físicas de partida distintas
   (las 4 combinaciones de persiana A/B, más 3 variando también ventana
   A/B abierta/cerrada) sobre clima real y sobre el escenario sintético
   con próximo cambio.** Las 7 convergen al mismo resultado final ya en
   la ronda 1, estable hasta la ronda 5 comprobada — mismo método de
   verificación (script ad-hoc, no committeado) que la corrección
   anterior, ahora con más combinaciones de partida para cubrir el caso
   que el usuario señaló explícitamente (las 4 magnitudes, no solo 2).

4. **`recomendarPiso(tInActual, pronostico, estadosVentanasActuales,
   parametrosPiso)`, función nueva — calcula la combinación global UNA
   VEZ y devuelve ventana+persiana de las dos ventanas ya formateadas
   (`{ [nombre]: { ventana, persiana } }`), en vez de que cada consumidor
   llame por separado.** Motivo: `recomendarVentana`/`recomendarPersiana`
   (mantenidas, mismo contrato de siempre, para tests y consumidores que
   solo quieran un campo) ahora recalculan la optimización GLOBAL
   completa cada una — 4 llamadas sueltas (como hacía `dashboard.js`)
   repetirían esa optimización 4 veces sin necesidad. `dashboard.js`
   (`calcularRecomendaciones`) pasa a una única llamada a
   `recomendarPiso`, más barato y además garantiza que las dos tarjetas
   de la pantalla muestren una combinación mutuamente consistente
   (calculada de una sola vez, no 4 veces con la posibilidad — remota
   pero real — de una carrera de datos entre llamadas si el reloj/clima
   cambiaran entre medias). `formatearVentana`/`formatearPersiana` se
   extrajeron como funciones puras compartidas entre `recomendarPiso` y
   los envoltorios de un solo campo, en vez de duplicar el `if/else` del
   `motivo` de la persiana.

5. **Coste real: sigue siendo barato.** Una ronda completa son 8
   búsquedas de un campo (4 campos × [hasta 2 candidatos de partida cada
   uno]), cada una recorriendo hasta 33 instantes de cambio — con 2
   rondas, del orden de unas pocas centenas de simulaciones de horizonte
   por cada llamada a `recomendarPiso`/`recomendarVentana`/
   `recomendarPersiana`, cada simulación de como mucho 32 pasos de Euler
   con un puñado de operaciones en coma flotante cada uno — nada que se
   note en un botón de móvil, verificado sin problema visible de
   fluidez en las capturas de Playwright del dashboard con clima real.

6. **Verificación:** dos casos de prueba nuevos en `test/model.test.js` —
   uno reproduciendo el escenario exacto del usuario variando las 4
   magnitudes físicas a la vez (`assert.deepEqual` entre las 4
   combinaciones) sobre el mismo escenario sintético de la corrección
   anterior, y otro comprobando que `recomendarPiso()` da exactamente lo
   mismo que llamar a `recomendarVentana`/`recomendarPersiana` por
   separado para cada ventana. 38 casos OK en `model.test.js` (dos
   nuevos), 127 en total en `npm test`, ninguno de los 36 ya existentes
   cambió de resultado. Verificado también en el dashboard real
   (Playwright, clima real, 27.5°C anotados, ambas ventanas
   cerradas/persiana bajada): las dos tarjetas muestran una combinación
   coherente ("Suroeste: cerrar/bajar", "Noreste: cerrar (abrir en
   2.3h)/subir"), sin errores de consola.

### Interruptores reales y recomendación ligada a cada control (2026-08-17)

El usuario, usando la app instalada, reportó dos problemas de legibilidad
distintos: "no se acaba de entender muy bien si las ventanas están
cerradas o abiertas, creo que sería mejor cambiarlo a un interruptor" y
"tampoco se entiende muy bien lo que recomienda hacer". El botón
"icono+color de fondo" de la Fase 6 (checkpoint "Rediseño de interfaz
móvil") ya había sustituido al checkbox original, pero seguía siendo un
patrón propio sin convención reconocible; y las dos líneas de
recomendación vivían aparte, arriba de los propios controles, sin ninguna
relación visual directa con el botón al que se referían.

1. **`.control-estado` (botón con icono+fondo de color) sustituido por un
   interruptor deslizante real (pista+bola, patrón de ajustes de móvil ya
   conocido por cualquier usuario) — no un ajuste de color sobre el
   mismo diseño.** `filaControl()` en `dashboard.js` genera una fila con
   tres piezas: icono+etiqueta fija ("Ventana"/"Persiana") a la
   izquierda, la palabra de estado actual (Abierta/Cerrada,
   Subida/Bajada) en el centro, y el interruptor a la derecha —
   `role="switch"`/`aria-checked` para que el estado también sea
   explícito para lectores de pantalla, no solo visualmente. El listener
   de clic pasó de `.control-estado` a `.interruptor`, mismo
   comportamiento (invierte `estadoVentanas[nombre][campo]` y persiste).

2. **Recomendación ligada a cada control por separado, no dos líneas
   sueltas arriba de la tarjeta.** `pistaControl()` compara el estado
   FÍSICO real de ese control concreto con el que recomienda
   `recomendarPiso` (Fase 1/correcciones post-lanzamiento) para ese mismo
   campo: si coinciden, un aviso discreto y de bajo peso visual ("Así
   está bien", con el "próximo cambio" ya existente como inciso si lo
   hay); si no coinciden, un aviso con acento y fondo tenue ("Recomendado:
   Abrir") pegado justo debajo del interruptor que hay que tocar. Con esto
   la pregunta que antes exigía leer dos frases y compararlas mentalmente
   con dos botones aparte ("¿qué recomienda y coincide con lo que tengo
   puesto?") queda resuelta con una sola mirada por control.

3. **El "próximo cambio" solo se muestra en la rama "así está bien", no en
   la de mismatch — decisión deliberada, no un descuido.** Si el control
   ya está mal puesto ahora mismo, mostrar además cuándo tocaría cambiarlo
   en el futuro (que presupone haber hecho ya el cambio actual) distraería
   de la acción inmediata que hace falta — coherente con "más simple y
   entendible", el pedido explícito del usuario.

4. **`--acento-fondo` nueva variable CSS (`#e8ece3`), mismo patrón que
   `--aviso-fondo` ya existente** — fondo tenue del mismo tono que
   `--acento` para el aviso "Recomendado: X", en vez de reutilizar
   `--aviso-fondo` (reservado para el aviso real de antigüedad de
   anotación, un concepto distinto que no debía confundirse visualmente
   con este).

5. **Verificación:** `npm test` (127 casos, sin tocar ningún módulo de
   `src/model`/`src/data`/`src/persistencia` — cambio íntegramente de UI)
   y `npm run build` sin errores. Visual con Playwright en viewport de
   móvil (393×852): estado inicial sin anotación (interruptores apagados,
   sin pista de recomendación); con una anotación de 27.5°C que fuerza
   mismatch en una persiana (pista "Recomendado: Subir" visible, resaltada,
   junto al interruptor correspondiente); y con los cuatro interruptores
   activados a mano (estado "activo" en verde, bola desplazada a la
   derecha, claramente distinguible del estado apagado) — sin errores de
   consola en ningún caso.

### Borrado de anotaciones del histórico (2026-08-17)

Pedido explícito del usuario: "quiero que hagas que los datos históricos se
puedan borrar. imagina que has metido un dato por error, pues debería
poder borrarse" — no existía ninguna forma de corregir una anotación mal
escrita (temperatura equivocada, pulsación accidental) salvo vivir con
ella para siempre en el histórico y en la recalibración automática.

1. **`borrarAnotacion(storage, id)` (`src/persistencia/anotaciones.js`),
   nueva — e invalida a `null` el `predicho`/`avgConduccion`/`avgSolarVent`
   de la anotación siguiente si los tenía, no solo quita la borrada de la
   lista.** Esos tres campos (Fase 7) describen el intervalo del gemelo en
   vivo entre una anotación y la INMEDIATAMENTE anterior — al borrar esa
   anterior, el hueco real hasta la anterior superviviente pasa a ser más
   largo del que esos regresores describen, así que dejarlos como estaban
   los volvería incoherentes con el nuevo hueco (el mismo tipo de error
   que ya se razonó, en la dirección contraria, en las decisiones de
   ponderación temporal de la Fase 7). `construirFilasRegresion()` ya
   ignora filas sin regresores, así que invalidarlas a `null` basta —no
   hace falta recalcular nada con el gemelo, que no tiene memoria del
   pasado más allá de su estado actual.

2. **Borrar una anotación no etiquetada dispara una recalibración,
   igual que anotar una nueva — mismo criterio que dashboard.js
   (`manejarAnotacion`), reconstruyendo las filas desde cero con
   `listarAnotaciones()` ya sin la borrada.** Un dato metido por error que
   ya influyó en `UA`/`factorCapacidad` seguiría distorsionándolos hasta
   la siguiente anotación real si no se recalculara aquí también — borrar
   un dato erróneo es, en el fondo, la misma operación de "corregir el
   histórico" que ya justifica la recalibración automática, solo que
   quitando una fila en vez de añadiéndola. `historico.js` importa
   `construirFilasRegresion`/`recalibrar` (ya usados por dashboard.js) y
   `guardarParametrosPiso` para persistir el resultado si pasa las guardas
   de seguridad ya existentes (sistema degenerado / fuera de rango físico
   → no se toca nada).

3. **La lista de anotaciones (más reciente primero, con botón de
   papelera) vive en `historico.js`, no en el dashboard — es la pantalla
   de consulta del histórico completo (spec.md §6.4), coherente con dónde
   ya vive la gráfica predicho/real.** Se muestra siempre que haya al
   menos una anotación, incluso con 0 o 1 (el estado "todavía no hay
   anotaciones suficientes" de la gráfica) — para poder borrar una
   anotación solitaria o accidental aunque todavía no haya suficientes
   para dibujar nada. `montarHistorico` pasó de un montaje de un solo
   disparo a un `render()` interno reutilizable (mismo patrón que
   `dashboard.js`), llamado de nuevo tras cada borrado para reflejar la
   lista/gráfica/parámetros ya actualizados sin recargar la página.

4. **Confirmación con `window.confirm()` nativo, no un modal propio.**
   Un borrado es irreversible (sin backend con el que deshacerlo, spec.md
   §7) y poco frecuente — el diálogo nativo del navegador ya transmite esa
   gravedad sin necesidad de construir ni estilizar un componente de
   confirmación nuevo para una acción que se espera usar rara vez.

5. **`iconoBorrar()` nuevo en `iconos.js` (papelera, mismo trazo
   `currentColor` que el resto) y `.boton-borrar` en `estilo.css` con
   `--error` en vez del acento habitual — bug de especificidad CSS
   evitado a propósito, no encontrado por accidente.** Ya había un caso
   idéntico documentado (Fase 6, rediseño de interfaz móvil: la regla
   genérica `button[type='button']` ganaba sobre `.control-estado` por
   tener más especificidad) — aquí `button.boton-borrar` iguala la
   especificidad de `button.boton-icono` (elemento+clase en ambas) a
   propósito, y se declaró DESPUÉS de `button.boton-icono` en el archivo
   para que sus valores (tamaño más pequeño, color `--error`) ganen el
   desempate por orden — comprobado visualmente con captura, no solo
   razonado.

6. **Verificación:** 4 casos de prueba nuevos en `test/persistencia.test.js`
   (borra por id conservando el resto en orden; id inexistente no cambia
   nada; invalida el predicho/regresores de la anotación siguiente;
   borrar la última anotación no invalida nada al no haber siguiente) — 16
   casos OK en ese fichero, sin romper ninguno de los 12 ya existentes.
   `npm run build` sin errores. Verificación funcional con un script ad-hoc
   de Playwright (no committeado): sembradas 3 anotaciones sintéticas,
   clic en la papelera de la del medio, diálogo `confirm` interceptado y
   aceptado, comprobado que `localStorage` queda con las 2 restantes y que
   la tercera (la que era "siguiente" de la borrada) pierde su
   `predicho`/`avgConduccion`/`avgSolarVent` — sin errores de consola.
   Verificación visual con `scripts/captura-historico.mjs` en viewport de
   móvil: la nueva tarjeta "Anotaciones" aparece con las 10 anotaciones
   sintéticas, más reciente primero, cada una con su papelera.

### Nubes: menos oscurecimiento, sombras más difusas (2026-08-17)

Pedido explícito del usuario tras ver la escena en vivo: "cuando hay nubes
afecta demasiado a la luz... lo que tienes que hacer para no perder el
efecto nubes es que siga habiendo luz, pero las sombras sean más difusas
— cuando hay nubes todas las nubes actúan como focos y por tanto las
sombras se borran. haz que las nubes se vean más". Diagnóstico: la
escena reutilizaba literalmente `iProxy`/`I_MAX` (la misma curva de
`Q_solar` del modelo térmico, con su suelo de nubosidad de 0.2 —
corrección de esa misma tarde) para la intensidad de la luz
`DirectionalLight` — decisión original de la Fase 6 (checkpoint 3, "así
la escena no se oscurece con una curva distinta a la física real"),
correcta para no inventar dos físicas distintas pero equivocada para el
objetivo estético: con 100% de nubes y sol ya bajo, la escena se quedaba
casi negra aunque el modelo térmico (con razón, para el cálculo de
`Q_solar`) siguiera considerando que entraba algo de luz.

1. **`factorIntensidadSol` (`src/escena3d/iluminacion.js`) deja de
   importar `iProxy`/`I_MAX` del modelo térmico — pasa a tener su propia
   curva de nubosidad, más suave, solo para la escena.** Nueva constante
   local `FACTOR_NUBES_MINIMO_ESCENA = 0.55` (frente al `0.2` del modelo
   térmico, `constantes.js`) — deliberadamente distinta, no un
   descuido: el modelo térmico sigue intacto (no se ha tocado
   `irradiancia.js` ni ningún test de `model.test.js`), esto es
   puramente una licencia estética de la escena 3D, coherente con otras
   ya tomadas antes sin base física exacta (emissive de la isla,
   `HemisphereLight` nocturna — ver checkpoints anteriores). El test que
   verificaba "reutiliza iProxy real, no una curva propia"
   (`test/escena3d-iluminacion.test.js`, Fase 6 checkpoint 3) se
   sustituyó por uno que verifica lo contrario a propósito: con 100% de
   nubes, el factor se queda bastante por encima de lo que daría la
   curva térmica antigua.

2. **`factorDifusionNubes(nubesPct)`, función nueva — 0 (despejado) a 1
   (cielo cubierto), independiente de la elevación solar.** Se usa en
   dos sitios para materializar la idea del usuario ("las nubes actúan
   como focos"): sustituye una única fuente de luz puntual/direccional
   por luz repartida, que es literalmente lo que hace un cielo
   nublado real (dispersa la luz del sol por todo el domo del cielo).
   - `luz.shadow.radius` (`construirLuzSol`) pasa de un valor fijo (1,
     contorno bastante definido, checkpoint 12/21) a
     `1 + 6 × factorDifusionNubes(nubesPct)` — con cielo despejado el
     contorno sigue siendo el mismo de siempre; con cielo cubierto la
     sombra se desdibuja mucho, coherente con "las sombras se borran"
     pedido explícitamente.
   - Nueva constante `AMBIENTAL_NUBES_EXTRA = 0.16`: la luz ambiental
     (`AmbientLight`) sube con la nubosidad, solo de día
     (`(1-nocturnidadActual)` — de noche ya se nota en el cielo/farola,
     no hace falta competir con su contraste cálido). Compensa
     directamente que la luz direccional ya no se apaga tanto sin dejar
     la escena sin contraste: el efecto combinado es "sigue habiendo
     luz" (menos oscurecimiento total) con sombras mucho más suaves, en
     vez de solo apagar la escena entera.

3. **Nubes (los propios sprites) más visibles — `opacidadBase` de
   `0.55-0.95` (checkpoints 5-6) a `0.72-1.0`.** Pedido explícito ("haz
   que las nubes se vean más"): si van a aportar menos oscurecimiento a
   la luz de la escena, que al menos se noten más como objeto visual —
   mismo patrón de dos tonos/sombra propia ya existente (checkpoint 5),
   sin tocar geometría ni cantidad de cúmulos (`numeroCumulos`, ya
   escalaba con `nubesPct` desde el checkpoint 6).

4. **Verificación:** `test/escena3d-iluminacion.test.js` reescrito (11
   casos OK, 3 nuevos para `factorDifusionNubes` y uno reemplazado),
   resto de `npm test` sin cambios (no se tocó ningún módulo de
   `src/model`). `npm run build` sin errores. Visual con
   `scripts/captura-escena3d.mjs` comparando `debugNubes=0` vs.
   `debugNubes=100` a la misma hora (mediodía): con nubes, la sombra del
   árbol pasa de un óvalo bien definido a una mancha muy difuminada,
   mientras la escena en conjunto sigue razonablemente iluminada (no se
   oscurece de golpe); con `debugNubes=60` en un viewport más alto (para
   que las nubes no quedaran tapadas por el panel de depuración) se
   confirmó que los cúmulos se ven claramente más opacos/blancos que
   antes. Verificado también contra `casa.html` con clima real (fetch en
   vivo), sin errores de consola.

### Farola de madera: más separada de la casa, tabla vertical más ancha (2026-08-17)

Pedido explícito, ajuste rápido sobre el diseño del checkpoint 23: "aparta
un poco el farolillo de la madera de la casa. y ponle la tabla vertical
más ancha".

1. **`margenFuera` (`construirFarola`) de 1.0 a 1.5** — misma técnica de
   siempre (esquina real de la habitación + normal hacia fuera), solo más
   distancia desde esa esquina.

2. **Tabla vertical (`poste`) con su propio ancho de cara,
   `GROSOR_TABLA_VERTICAL = GROSOR_TABLA * 2`, sin tocar `GROSOR_TABLA`
   en sí.** `GROSOR_TABLA` sigue siendo el ancho de cara del brazo
   horizontal y la diagonal (pedido explícito: solo la vertical, no las
   tres tablas) — se introdujo una constante nueva en vez de ensanchar
   la compartida para no afectar sin querer a las otras dos piezas.

3. **Verificación:** `npm test`/`npm run build` sin cambios de
   resultado (cambio íntegro de geometría/posición, ningún módulo
   testeado). Visual con `scripts/captura-escena3d.mjs` de noche: la
   farola queda claramente separada de la esquina de la casa, y en un
   recorte ampliado se distingue la tabla vertical más gruesa que el
   brazo/la diagonal.

### Casa sin scroll, isla más arriba, luna/nubes arriba del todo, zoom táctil (2026-08-17)

Pedido explícito del usuario probando en el móvil: el feed "Casa" (la
escena 3D a pantalla completa, ver Fase 6 checkpoint "rediseño de interfaz
móvil") se podía deslizar aunque no había nada que desplazar; la isla
seguía baja dentro del encuadre; la luna y las nubes debían verse "arriba
del todo"; y pidió poder hacer zoom con los dedos en el móvil sin que
cambiara el ángulo isométrico fijo.

1. **Scroll residual: `100vh` → `100dvh`, más `overflow:hidden` en
   `body:has(#escena3d)`.** `100vh` en móvil incluye el área que la barra
   de direcciones del navegador tapa/destapa al hacer scroll — el
   documento quedaba un poco más alto que la ventana realmente visible en
   cada momento, así que la página se podía deslizar un poco aunque no
   hubiera contenido nuevo que ver. `100dvh` se ajusta a la altura visible
   real. Verificado que el "hueco" que parecía scroll en las primeras
   pruebas con Playwright era en realidad un artefacto del entorno headless
   sin emulación móvil real (sin `isMobile`/`hasTouch`, Chromium calcula
   `dvh` como si aún quedara sitio para una barra de herramientas que en
   ese contexto no existe) — con un dispositivo emulado de verdad
   (`devices['iPhone 13']` de Playwright) el hueco desaparece por completo,
   confirmando que el `dvh` sí resuelve el problema real en un navegador
   móvil de verdad. Regla nueva `body:has(#escena3d){overflow:hidden;
   height:100dvh}` (mismo selector `:has()` ya usado para
   `.nav-inferior`) — no afecta a Inicio (usa `#escena3d-hero`, un id
   distinto, con scroll normal, sin tocar).

2. **Isla "demasiado abajo": `FACTOR_ARRIBA_RETRATO`/`FACTOR_ABAJO_RETRATO`
   de 2.2/0.5 a 1.8/0.9 (`construirCamara`, checkpoint 5).** Estos dos
   factores reparten el mismo total de cielo vertical capturado por la
   cámara (invariante frente a la proporción elegida — la fórmula de
   `alcanceVertical` se normaliza sola por la suma de ambos, verificado
   con álgebra antes de tocar el valor) entre "por encima" y "por debajo"
   del punto de mira: subir el peso relativo de `abajo` deja más margen
   bajo la isla y la sube dentro del encuadre, sin tener que recalcular
   nada más (zoom, proporción horizontal/vertical ya corregida en
   checkpoint 16, todo eso sigue intacto). Verificado con capturas reales
   de móvil que la isla queda más arriba sin llegar a perder la premisa
   original ("casa abajo, cielo arriba").

3. **Bug real encontrado al perseguir "luna/nubes arriba del todo":
   `TECHO_CIELO_LANDSCAPE` (la constante que limita cuánto puede subir
   cualquier cosa del cielo — nubes, estrellas, luna) llevaba tiempo
   proyectando MÁS ALLÁ del borde real de la cámara en modo panorámico, no
   solo cerca de él.** Diagnosticado exponiendo temporalmente la cámara y
   la escena en `window` desde `main-escena3d.js` (revertido antes de
   terminar) y proyectando puntos de prueba con `Vector3.project(camera)`
   — con `nubesPct` alto, CERO nubes se veían en pantalla ancha; en
   landscape `alturaMin===alturaMax` (una única altura fija, sin
   aleatoriedad ninguna), así que si esa altura está mal TODAS las nubes
   se recortan siempre, no a veces. Causa: `1.15` (el valor de
   `techoCielo()` para landscape) se calibró en los checkpoints 6-9, antes
   de que la isla/el árbol/la farola (checkpoints 8-16) empezaran a formar
   parte de `calcularRadioEscena()` — ese `radio` casi se duplicó desde
   entonces sin que nadie volviera a comprobar si las nubes seguían
   cabiendo dentro del encuadre real. Corregido a `0.72` (verificado
   proyectando con la cámara real que se queda dentro del borde con
   margen, en varios anchos de pantalla — el resultado no depende del
   aspecto en landscape, solo del `radio`). La luna nunca estuvo afectada
   por este bug en sí (su proporción, 0.522, ya la dejaba bastante por
   debajo del techo real incluso con el techo roto) pero SÍ dependía del
   mismo `techoCielo()`, así que `PROPORCION_ALTURA_LUNA_LANDSCAPE` se
   recalculó (0.6/0.72 en vez de 0.6/1.15) para mantener EXACTAMENTE la
   misma altura absoluta de siempre (0.6×radio) con el denominador ya
   corregido — la luna no se mueve ni un pixel respecto a antes.

4. **Segundo bug real, específico de retrato y de las nubes: `ANCLAS_NUBE`
   (las posiciones X/Z fijas de cada cúmulo) también se calibraron con un
   `radio` mucho menor (checkpoints 4-6), y desde entonces sus fracciones
   (hasta x=-0.85) ya representaban un desplazamiento mayor que la propia
   mitad del encuadre horizontal de la cámara — con nubesPct alto, la
   mayoría de los cúmulos caían fuera de pantalla por el lado, no solo
   cerca del borde.** Mismo método de diagnóstico (proyección real con
   `Vector3.project`). `ESCALA_HORIZONTAL_NUBE=0.5` nuevo, aplicado a la
   posición X/Z de cada cúmulo (no al tamaño del cúmulo en sí, campo
   `radio` de cada ancla, sin tocar) — verificado con la cámara real en
   varios aspectos (móvil, cuadrado, panorámico) que el peor caso se queda
   con margen (~23%) dentro de encuadre.

5. **`techoCielo()` separado en `TECHO_CIELO_LANDSCAPE`/
   `TECHO_CIELO_PORTRAIT` (antes un único `1.15` compartido) y
   `PROPORCION_ALTURA_LUNA_LANDSCAPE`/`_PORTRAIT` (antes un único
   `0.6/1.15`), y `alturaMin` de las nubes también depende de si es
   retrato — necesario porque, tras corregir el bug del punto 2, mover la
   isla arriba en retrato (punto 1) reduce el cielo real disponible ahí
   respecto a landscape, así que un solo valor ya no sirve para ambos.**
   `TECHO_CIELO_PORTRAIT=0.85` (margen ~6% sobre el borde real de la
   cámara en retrato, tras el cambio del punto 1).
   `PROPORCION_ALTURA_LUNA_PORTRAIT=0.95` (la luna casi al límite de
   `techoCielo`, que a su vez ya tiene su propio margen — pedido explícito
   de que se vea "arriba del todo"). Nubes en retrato:
   `FRACCION_BANDA_NUBES_PORTRAIT=0.82` estrecha el rango de altura
   aleatoria de cada cúmulo a una banda pegada al techo (antes se repartía
   en todo el hueco entre la altura fija de landscape y el techo real, y
   la mayoría acababan a media altura). Landscape no cambia de
   comportamiento (mismo valor `min=max` de siempre, solo con el número ya
   corregido).

6. **Zoom táctil con dos dedos, sin OrbitControls y sin cambiar el ángulo
   — solo se toca `camera.zoom` (un escalar de Three.js sobre el frustum
   ya calculado), nunca la posición ni la rotación de la cámara.** Listener
   `touchstart`/`touchmove`/`touchend` en `renderer.domElement`
   (`crearEscena3D`, `escena.js`) que mide la distancia entre los dos
   dedos y ajusta `camera.zoom` proporcionalmente, con
   `camera.updateProjectionMatrix()` en cada paso; recortado a
   `[1, 3.5]` para no alejar más allá del encuadre original ni acercar
   hasta perder el contexto. `touch-action:pan-y` en el `<canvas>`
   (`estilo.css`), no `none`: dos dedos ya no disparan el zoom nativo del
   navegador (que movería el layout entero, no la cámara 3D), pero un
   dedo sigue pudiendo hacer scroll vertical normal donde la escena es un
   hero dentro de una página más larga (Inicio, antes de su rediseño;
   `#escena3d-hero` sigue llevando la misma regla por si se reutiliza).
   Verificado con `Input.dispatchTouchEvent` (CDP) simulando un pellizco
   real de apertura en `casa.html`: la escena se acerca visiblemente
   mientras el ángulo isométrico (las líneas del tejado/las paredes) se
   mantiene exactamente igual, solo más grande.

7. **Verificación:** `npm test` (127 casos) sin cambios de resultado —
   todo el trabajo de esta sesión es de la capa impura de `escena3d/`
   (sin casos de prueba puros, mismo criterio que el resto del fichero
   desde la Fase 6) y de `estilo.css`. Visual con capturas reales
   (Playwright + Chromium, dispositivo `iPhone 13` emulado con
   `hasTouch:true` para el pellizco) contra `casa.html`, `index.html` y la
   página aislada `escena3d.html` — de día y de noche, retrato y
   panorámico: sin scroll residual en `casa.html`
   (`document.documentElement.scrollHeight === innerHeight`), isla más
   arriba sin cortarse, al menos una nube visible pegada al borde superior
   del cielo en los cuatro casos (antes de esta sesión no se veía ninguna
   con `nubesPct` alto, ni en retrato ni en panorámico), luna dentro de
   encuadre y pegada arriba de noche, y sin errores de consola en ningún
   caso.

### Paneo con un dedo (2026-08-18)

Pedido explícito tras probar el zoom táctil del cambio anterior: el
pellizco solo acercaba/alejaba siempre sobre el centro de la casa —
pidió poder desplazar la vista para ver el árbol y el resto de la isla,
dejando claro que seguía sin querer ningún cambio de ángulo, solo poder
"hacer zoom en todos lados".

1. **Arrastre con un dedo traslada `camera.position` a lo largo de sus
   propios ejes derecha/arriba — nunca su rotación, así el ángulo
   isométrico no cambia en ningún gesto (ni pellizco, ni arrastre, ni
   redimensionar mientras hay paneo activo).** `basisDerecha`/
   `basisArriba` se extraen una única vez de `camera.matrixWorld` justo
   tras construir la cámara (`extractBasis`) — válidos para siempre
   porque la posición/rotación base de la cámara (`construirCamara`) no
   depende del aspecto de pantalla, solo su frustum (`left/right/top/
   bottom`) sí. El arrastre traduce píxeles CSS a unidades de mundo
   dividiendo el ancho/alto visible actual (`camera.right-camera.left`,
   ya con el zoom en vigor) entre el tamaño real del contenedor, y mueve
   la cámara en la dirección CONTRARIA al arrastre (mismo criterio que
   arrastrar un mapa: el contenido sigue al dedo). El paneo acumulado se
   guarda (`panDerecha`/`panArriba`) y se recorta a
   `±radio×0.7` para no poder alejarse de la isla hasta perderla de
   vista.

2. **Gestión combinada de pellizco (dos dedos) y arrastre (un dedo) en
   los mismos listeners `touchstart`/`touchmove`/`touchend`, con
   transición sin salto al pasar de uno a otro.** Al soltar un dedo de un
   pellizco (quedan uno o cero), o al añadir un segundo dedo en medio de
   un arrastre, el gesto se re-arranca desde la posición/distancia ACTUAL
   de los dedos que queden — no desde el punto donde empezó el gesto
   anterior, que ya no es válido y provocaría un salto visual.

3. **Al redimensionar (`redimensionar()`) con paneo activo, la rotación
   se fija PRIMERO (con la posición sin panear, `camera.lookAt(objetivo)`)
   y el paneo se reaplica DESPUÉS como una simple traslación — no antes.**
   Si se paneara antes de mirar a `objetivo`, `lookAt` recalcularía la
   rotación desde un punto ya descentrado y el ángulo isométrico
   cambiaría ligeramente en cada resize mientras hubiera paneo, algo que
   contradice directamente el pedido explícito de que el ángulo nunca
   cambie.

4. **`touch-action` de `pan-y` a `none` en el `<canvas>` de la escena
   (`estilo.css`).** Con `pan-y` el navegador se reservaba el gesto
   vertical de un dedo para su propio scroll — desde este cambio, un dedo
   también sirve para panear la escena en cualquier dirección, así que ya
   no puede quedar ningún eje reservado para el navegador.
   `#escena3d-hero` (sin ningún consumidor real desde el rediseño móvil
   de Inicio) comparte la regla por si se reutiliza en el futuro.

5. **Verificación:** `npm test` (127 casos, sin cambios de resultado —
   cambio íntegro de interacción táctil en la capa impura de
   `escena3d/`) y `npm run build` sin errores. Funcional con
   `Input.dispatchTouchEvent` (CDP, Playwright) contra `casa.html`:
   pellizco de apertura confirma zoom con el ángulo intacto (mismas
   pendientes de tejado/paredes, solo más grandes — mismo método de
   verificación que el cambio anterior), y un arrastre de un dedo
   posterior desplaza de verdad lo que se ve en pantalla (otra esquina de
   la casa/la isla queda centrada) sin ningún salto ni error de consola.

### Límite de paneo atado al zoom (2026-08-18)

Pedido explícito, mismo día: "haz que cuando se haga el mínimo zoom
posible... no haya posibilidad de moverse hacia los lados. si no, queda
raro que quites el zoom y la isla no esté en medio" — el paneo del
cambio anterior usaba un límite fijo (`radio×0.7`) sin relación con el
zoom, así que se podía dejar la vista descentrada incluso con el zoom ya
en el mínimo (toda la escena visible, sin ningún margen real que
recorrer).

1. **`limitePanActual()` sustituye la constante fija — el límite de
   paneo pasa a depender linealmente del zoom actual: 0 en `ZOOM_MIN`
   (nada de margen que recorrer, así que nada que panear), hasta
   `LIMITE_PAN` en `ZOOM_MAX`.** Con el zoom mínimo, cualquier arrastre
   queda recortado a 0 al instante — "no haya posibilidad de moverse
   hacia los lados" se cumple sin necesitar un caso especial aparte, es
   solo el caso límite de la misma fórmula.

2. **`recortarPan()` se llama también cada vez que cambia el zoom por
   pellizco (no solo al arrastrar) — necesario para que cerrar el
   pellizco del todo recentre la isla SOBRE LA MARCHA, no solo la
   próxima vez que alguien intente arrastrar.** Sin esto, un paneo ya
   acumulado se habría quedado "colgado" (fuera del nuevo límite, más
   pequeño) hasta el siguiente gesto de arrastre — quedaría descentrado
   exactamente en el momento que el pedido explícito quería evitar.

3. **Verificación:** `npm test` (127 casos, sin cambios de resultado) y
   `npm run build` sin errores. Funcional con `Input.dispatchTouchEvent`
   (CDP, Playwright) contra `casa.html`: un arrastre con el zoom ya en el
   mínimo no mueve nada (captura idéntica a la inicial, pixel a pixel);
   con el zoom ampliado, el mismo arrastre sí desplaza la vista con
   normalidad; y cerrar el pellizco hasta el zoom mínimo después de
   panear devuelve la isla exactamente al encuadre inicial, sin ningún
   arrastre adicional de por medio — confirmado comparando la captura
   final con la de antes de tocar nada, iguales.

### Tamaño visual fijo de la casa y ventanas a su ancho real (2026-08-18)

Pedido explícito del usuario: al poner una superficie de piso mayor que la
usada durante toda la construcción de la Fase 6 (30m², el valor por
defecto), el árbol, la farola, el buzón y el resto de detalles se veían
pequeños en proporción — pidió que la casa tenga siempre la misma
"superficie visual" en el dibujo sea cual sea el valor real de los
parámetros, y que solo cambien su proporción y el tamaño de las ventanas.
De paso señaló un segundo bug real, ya presente desde el checkpoint 1 de
la Fase 6: las ventanas siempre se dibujaban ocupando la pared entera, sin
importar el ancho real editado en Parámetros.

1. **Causa raíz del primer problema: `calcularRadioEscena()` (escena.js)
   encuadra la cámara según el tamaño REAL de la habitación, pero el
   árbol/la farola/el buzón/las piedras del muro están dimensionados a
   partir de `radioHabitacion`/`geo.altura` — con una habitación más
   grande, la cámara se aleja para que quepa entera, y todo lo demás
   encoge en el encuadre sin que nadie lo pidiera (mismo patrón que ya
   forzó ajustes de zoom/tamaño de isla en varios checkpoints
   anteriores, aquí en la dirección contraria).** Solución en
   `geometria.js`, no en `escena.js`: `calcularGeometria()` aplica ahora
   una `escala = sqrt(SUPERFICIE_REFERENCIA / parametrosPiso.superficie)`
   uniforme a las 3 dimensiones (`anchoLateral`, `profundidad`,
   `alturaTecho`) antes de construir nada. Con `SUPERFICIE_REFERENCIA=30`
   (el mismo valor que `PARAMETROS_PISO_POR_DEFECTO.superficie`,
   src/persistencia/piso.js — deliberadamente NO importado desde
   geometria.js, para no acoplar este módulo puro a la capa de
   persistencia por un único valor, mismo criterio que
   `recalibracion.js`), `escala=1` con los parámetros por defecto: la
   escena no cambia nada respecto a como está calibrada desde la Fase 6.
   Con cualquier otra superficie, la superficie de planta DIBUJADA
   (`anchoLateral × profundidad`) queda fija en `SUPERFICIE_REFERENCIA` —
   ni más grande ni más pequeña — mientras que la PROPORCIÓN de la caja
   (ancho:profundidad según `anchoHabitacion`; alto según `alturaTecho`)
   sigue siendo exactamente la real, sin distorsión, porque la misma
   escala se aplica por igual a los 3 ejes. Como el resto de la escena
   (árbol, farola, isla, muro de piedras) se sigue derivando de
   `radioHabitacion`/`geo.altura` sin ningún cambio en `escena.js`, todo
   eso vuelve a quedar automáticamente al tamaño de siempre — no hizo
   falta tocar ni un valor de escena.js para resolver el problema
   reportado, la normalización en el origen (geometria.js) ya bastaba.

2. **Segundo bug real, encontrado leyendo el código al investigar el
   primero: `pared.anchoVentana` (calculado en `geometria.js` desde el
   checkpoint 1 de la Fase 6) nunca lo leía nadie — `construirPared()`
   dibujaba el cristal siempre a `pared.ancho` completo, así que editar
   el ancho de una ventana en Parámetros no tenía ningún efecto visual
   en la escena.** `construirPared()` se dividió en
   `construirParedOpaca()` (paredes laterales, sin cambios de
   comportamiento) y `construirParedConVentana()` (paredes A/B): el
   cristal ahora mide `pared.anchoVentana` de ancho, centrado en la
   pared, con el resto rellenado por hasta dos franjas de pared opaca a
   los lados (mismo material/opacidad que una pared lateral, según
   `signoCamara` — reutiliza `construirMaterialOpaco()`, extraída del
   código ya existente en vez de duplicarlo). El marco (`construirMarcoVentana`)
   y los reflejos (`construirReflejosCristal`) — que solo conocían
   `pared.ancho`/`pared.alto`, no la distinción ventana/pared entera —
   siguen intactos: se les pasa una copia de `pared` con `ancho`
   sustituido por `anchoVentana`, así que encajan en el hueco real del
   cristal sin tener que tocar ninguna de las dos funciones. La pared con
   ventana pasó de ser un único `THREE.Mesh` a un `THREE.Group` (cristal
   + hasta 2 franjas opacas + marco + reflejos, todos hijos con posición
   en espacio local) — `calcularRadioEscena()` sigue funcionando igual
   (`Box3().setFromObject()` ya recorre todos los descendientes, no solo
   el nodo raíz).

3. **El mismo `escala` de la normalización de tamaño se aplica también al
   ancho real de cada ventana (`ventanaA.ancho * escala`,
   `ventanaB.ancho * escala`) — resuelve a la vez el segundo pedido
   explícito del usuario ("que cambie... el tamaño de las ventanas").**
   Como `escala` es la misma para la pared que la contiene y para la
   ventana, la PROPORCIÓN ventana/pared (lo único que de verdad se ve)
   coincide exactamente con la real (`ventana.ancho / anchoHabitacion`),
   sea cual sea el tamaño visual fijo al que se haya normalizado toda la
   casa.

4. **Verificación:** `npm test` (146 casos, 8 nuevos en
   `test/escena3d-geometria.test.js` — superficie dibujada idéntica entre
   un piso de 30m² y uno de 120m² pese al 4× de superficie real,
   proporción ancho:profundidad dibujada igual a la real, altura escalada
   en la misma proporción que ancho/profundidad, proporción
   ventana/pared invariante, escala>1 con menos superficie real y <1 con
   más), sin romper ninguno de los 138 ya existentes (el piso por
   defecto sigue dando `escala=1` exacto, así que ningún valor ya
   verificado cambió). `npm run build` sin errores. Verificación visual
   con un script ad-hoc de Playwright (no committeado, mismo patrón que
   `captura-escena3d.mjs` pero sembrando `localStorage` con
   `page.addInitScript()` antes de navegar a `escena3d.html`): un piso de
   150m² con `anchoHabitacion=9` y ventanas de 3.5m/3.0m se dibuja al
   mismo tamaño visual que el piso por defecto (isla/árbol/farola/buzón
   del mismo tamaño de siempre), solo que alargado y con las ventanas
   proporcionalmente más anchas; un piso con ventanas de 0.8m/0.6m
   (frente a los 2.0m/1.8m reales por defecto) muestra huecos de cristal
   claramente estrechos con pared opaca visible a los lados, en vez de
   cristal de pared a pared — sin errores de consola en ningún caso.

### Pronóstico extendido (horas + 7 días) y pestaña Tiempo (2026-08-18)

Pedido explícito del usuario: un rectángulo en la parte de arriba del
apartado de clima de Inicio, estilo el buscador de tiempo de Google en
móvil — dos filas horizontales (horas cada 3h a 21h vista, y los 7 días
siguientes con icono + máx/mín), con la línea que traza la temperatura
igual que la de Google. De paso, cambiar el nombre de la pestaña "Casa" a
"Tiempo" con icono de sol (reutilizando el que tenía Parámetros) y dar a
Parámetros el icono de casa que quedaba libre.

1. **Datos: llamada nueva y aparte a Open-Meteo
   (`obtenerPronosticoExtendido`, `src/data/openMeteo.js`), no una
   ampliación de la que ya usa el modelo.** `obtenerClimaMinutely15`
   (Fase 2) sigue intacta — el pronóstico extendido es puramente
   informativo (no alimenta `termico.js`/`recomendacion.js`, que siguen
   con su horizonte real de 6-8h), así que mezclar ambas llamadas habría
   acoplado sin necesidad una petición del modelo con datos que solo
   consume la UI. Un único fetch con `hourly=temperature_2m,weather_code
   &forecast_hours=24` + `daily=weather_code,temperature_2m_max,
   temperature_2m_min&forecast_days=7` (confirmado con curl real que
   Open-Meteo sirve ambos bloques en la misma petición, con
   `timezone=auto` igual que el resto del proyecto).

2. **`categoriaTiempo(codigoTiempo)` vive en `src/data/openMeteo.js`,
   junto a `esTormenta()` — mismo criterio ya establecido en la Fase 6
   checkpoint 6 ("es interpretación del dato de la API, no algo
   específico de la escena/UI que la consume").** Mapea el código WMO
   real a 6 categorías (`despejado`, `parcial`, `nublado`, `lluvia`,
   `nieve`, `tormenta`) — niebla (45/48) se pliega dentro de `nublado` en
   vez de tener icono propio, mismo criterio de "menos iconos, más calma"
   que ya pedía CLAUDE.md para el resto de la interfaz. `esTormenta()` no
   se tocó (`categoriaTiempo` coincide con ella en los 3 códigos de
   tormenta, verificado en `test/openMeteo.test.js`).

3. **Iconos nuevos en `src/ui/iconos.js`: sol, nube+sol, nube, nieve,
   tormenta — y, tras verlo en una captura real, también luna y
   nube+luna.** El primer resultado (sin variante de noche) mostraba un
   sol brillante a las 2 de la madrugada para cualquier hora "despejada"
   — confirmado en captura de móvil, un bug real de credibilidad, no solo
   estético, para una app que ya calcula posición solar real en todos
   lados. `seleccionarHoras()` (`src/ui/pronosticoExtendido.js`) ahora
   recibe `lat`/`lon` y calcula `nocturno` con `posicionSolar()`
   (`src/data/sol.js`, mismo cálculo que ya usa el resto de la app) para
   cada uno de los 7 puntos; `iconoCategoria()` sustituye sol→luna y
   nube+sol→nube+luna cuando `nocturno` es cierto. Solo esas dos
   categorías tienen variante de noche — nublado/lluvia/nieve/tormenta se
   leen igual de bien a cualquier hora, un icono de noche propio para
   cada una habría sido más densidad visual sin más claridad real.
   Verificado con datos reales (Pamplona, agosto): 23:00/02:00/05:00
   muestran luna, 20:00/08:00/11:00/14:00 muestran sol — y con
   `posicionSolar()` real (no aproximado) se confirmó además el caso
   límite de la puesta de sol (21:00 con elevación +0.4°, todavía día por
   muy poco), documentado en el test en vez de dejarlo como una
   coincidencia sin explicar.

4. **Sin scroll horizontal ni tira deslizable — exactamente 7 puntos por
   fila que caben en el ancho de un móvil, a diferencia de la tira de
   muchas horas que tiene Google.** El usuario pidió horas cada 3h con
   horizonte de 21h, que da exactamente 7 puntos — con `justify-content:
   space-evenly` y texto pequeño (0.68-0.72rem), caben en una sola fila
   sin deslizar ni envolver, tanto para las horas como para los 7 días.
   Evita la complejidad de una tira `overflow-x` con scroll-snap para un
   caso que no la necesita.

5. **Línea de temperatura: SVG con viewBox de ancho 100 (para que la
   coordenada X sea directamente un porcentaje), función pura
   `trazadoTemperatura()` separada de la generación de HTML — testeable
   sin DOM, mismo criterio que el resto del proyecto para su lógica no
   trivial.** Bug real encontrado por el primer test: con temperaturas
   constantes, la fórmula de normalización `(t-min)/(max-min)` con
   `max-min` sustituido por 1 solo para evitar la división por cero
   dibujaba la línea pegada abajo del todo (trataba el caso "sin
   variación" como si fuera "el valor más frío"), no a media altura como
   sería lo esperable para un pronóstico estable — corregido con un caso
   `constante` explícito que usa 0.5 de normalizado en vez de reutilizar
   un rango falso de 1.

6. **La línea NO alimenta ningún dato al motor de recomendación ni al
   histórico — es puramente decorativa, sobre el ancho completo de la
   fila de horas, sin intentar alinear cada punto exactamente con el
   centro de su tarjeta (`justify-content: space-evenly` no garantiza
   centros en `(i+0.5)/n`, solo una aproximación razonable).** Aceptado a
   propósito: es un adorno tipo "curva a mano" como la de Google, no un
   gráfico de precisión — el histórico (Fase 7, `historico.js`, Chart.js)
   sigue siendo el único gráfico "serio" de la app.

7. **Fallo de red independiente entre clima (modelo) y pronóstico
   extendido — `Promise.allSettled`, no una sola llamada con try/catch
   compartido.** Si `obtenerPronosticoExtendido` falla (o Open-Meteo
   tarda) no debe tumbar las recomendaciones de ventana/persiana, que
   solo dependen de `obtenerDatosReales` — y viceversa, un fallo del
   modelo no debería ocultar el widget si esa llamada sí funcionó.
   `estadoPronExt`/`datosPronExt` son estado independiente de
   `estadoClima`/`datosClima` en `dashboard.js`, con su propio mensaje de
   error discreto (`.pron-error`) que no compite visualmente con el de
   `.fila-clima-error`.

8. **Inicio ya NO cabe sin deslizar con este widget añadido (817px de
   contenido en un viewport de 664px, iPhone 13) — aceptado, no
   corregido a la fuerza.** El rediseño móvil (checkpoint anterior) ya
   había dejado anotado que "no deslizar" es el objetivo para el caso
   normal, no una prohibición dura — un widget de este tamaño (dos filas
   + línea + máx/mín) no cabía en el presupuesto de altura que dejaba esa
   pantalla sin sacrificar legibilidad (texto/iconos ya están cerca del
   mínimo razonable). Ningún `overflow:hidden` se ha añadido para
   forzarlo — el contenido hace scroll vertical con normalidad, como ya
   preveía esa decisión.

9. **Pestaña "Casa" → "Tiempo": solo texto/icono, sin tocar `id`/`href`
   ni renombrar `casa.html`.** El usuario pidió "cambiar el nombre... y
   el icono", no la ruta — `insertarNavInferior('casa')` en
   `main-casa.js` no cambió, evitando tocar `vite.config.js` y todas las
   referencias a `casa.html`/`#escena3d` por un cambio que es solo de
   etiqueta visible. `<title>` de `casa.html` sí se actualizó a "Solana —
   Tiempo" (visible en la pestaña del navegador, coherente con el nuevo
   nombre). El icono de sol reutilizado es literalmente
   `iconoParametros()` (círculo+rayos) — su nombre de función no se tocó
   para no forzar un rename sin necesidad funcional; el comentario de
   `iconoInicio()` que explicaba "no es una casa para no confundir con la
   pestaña Casa" se actualizó para reflejar que ahora es Parámetros quien
   tiene el icono de casa.

10. **Verificación:** 14 casos de prueba nuevos (`test/openMeteo.test.js`,
    `test/pronosticoExtendido.test.js`), 160 en total en `npm test`, sin
    romper ninguno de los 146 ya existentes. `npm run build` sin errores.
    Visual con Playwright (dispositivo `iPhone 13` emulado, datos reales
    de Pamplona vía `vite preview`): widget con horas/días reales y
    coherentes (icono de tormenta en el día con más lluvia, lunas en las
    horas de madrugada), pestaña "Tiempo" con icono de sol y pestaña
    "Parámetros" con icono de casa, sin errores de consola en ningún
    caso. Script ad-hoc, no committeado (mismo criterio que otras
    verificaciones puntuales del proyecto).

### El pronóstico extendido se muda al cielo de "Tiempo" (2026-08-18, misma tarde)

Al ver el widget desplegado en Inicio, pedido explícito del usuario:
"lo quería poner en Tiempo, encima de donde está la casa, en el cielo,
eso quedaba vacío" — más "dale un poco de transparencia y redondea las
esquinas del recuadro". No un añadido nuevo: se mueve por completo desde
Inicio (`dashboard.js`) a la pestaña "Tiempo" (`casa.html`), flotando
sobre la escena 3D en vez de vivir como una tarjeta más en la lista de
Inicio.

1. **`escena3dDashboard.js` gana un segundo contenedor
   (`montarEscena3D(contenedorEscena, contenedorPronostico, storage)`) y
   un segundo fetch, independiente del que ya alimenta la escena — un
   fallo o una tardanza del pronóstico extendido no debe retrasar ni
   tumbar la construcción de la escena 3D, que sigue siendo el elemento
   central de esta pantalla (spec.md §6.1).** `montarPronosticoOverlay()`,
   función nueva y separada de la lógica de la escena, hace su propio
   `try/catch` y su propio `contenedor.dataset.cargado`, mismo patrón que
   ya usa `contenedorEscena` para que un script de verificación tenga una
   señal fiable de cuándo cada pieza terminó.

2. **`dashboard.js` vuelve exactamente a como estaba antes de esta
   sesión — sin `estadoPronExt`/`datosPronExt`, sin el fetch de
   `obtenerPronosticoExtendido`, sin la llamada a
   `pronosticoExtendidoHtml()`.** No quedó ningún resto: el widget vivía
   ahí por una decisión de la sesión anterior que el propio usuario
   revirtió al verlo en contexto real, así que revertir del todo (no
   dejar la lógica "por si acaso") es lo correcto — `src/ui/
   pronosticoExtendido.js`, sus iconos y sus tests no se tocaron, solo
   cambió QUIÉN los llama. Efecto colateral bienvenido, no buscado: sin
   el widget, Inicio vuelve a caber sin deslizar en el viewport de
   referencia (664px de contenido en 664px visibles) — la sesión anterior
   ya había aceptado explícitamente el scroll como su coste, así que
   desaparece solo, no hizo falta ningún ajuste de layout para lograrlo.

3. **Overlay con `position:fixed`, mismo patrón que `.nav-inferior` en el
   extremo opuesto de la pantalla (`env(safe-area-inset-top)`, mismo
   `z-index` por debajo del de la nav).** `#pron-overlay` (el
   envoltorio posicionado) y `.pronostico-extendido` (la tarjeta en sí,
   con su fondo/borde/radio) son elementos distintos a propósito: el
   envoltorio lleva `pointer-events:none` y solo la tarjeta
   `pointer-events:auto` — así el hueco que deja el `left/right:
   0.9rem` del envoltorio (fuera de la tarjeta) no bloquea el
   arrastre/pellizco de la escena de fondo, verificado con un gesto real
   (CDP `Input.dispatchTouchEvent`) que sí desplazaba la vista con el
   overlay presente en pantalla.

4. **Transparencia con `rgba()` fijo, no `color-mix()` con `--papel`.**
   Pedido explícito de "un poco de transparencia" — se usó
   `rgba(255, 255, 254, 0.82)` (el mismo blanco cálido de `--papel`, con
   alpha) en vez de `color-mix(in srgb, var(--papel) 82%, transparent)`
   (más "correcto" en el sentido de no duplicar el valor del color) para
   que un navegador sin soporte de `color-mix()` no se quede sin ningún
   fondo declarado — un valor fijo siempre se aplica. Con
   `backdrop-filter: blur(7px)` (más `-webkit-` para Safari/iOS) y una
   sombra suave (`box-shadow`) para que se lea como una tarjeta
   "flotando" de verdad sobre la escena, no como un rectángulo plano
   pegado encima.

5. **Esquinas mucho más redondeadas que el resto de la interfaz (1rem
   vs. 0.2rem en el resto) — inconsistencia deliberada, no un
   descuido.** El resto de la app usa esquinas casi rectas a propósito
   (Fase 8, decisión 12: "minimalista", esquinas de 0.15-0.2rem en toda
   la interfaz, para no parecer una plantilla genérica). Aquí se rompe
   esa convención porque el contexto es distinto: una tarjeta flotando
   sobre un cielo ilustrado pide un aire de "recorte suave", no el
   mismo lenguaje de tarjetas ancladas al fondo plano de página —
   pedido explícito del usuario, no una decisión unilateral de apartarse
   del estilo ya establecido.

6. **Verificación:** `npm test` (160 casos, sin cambios — el trabajo de
   esta sesión es reorganizar DOM/CSS/orquestación, no lógica pura nueva)
   y `npm run build` sin errores. Visual con Playwright (dispositivo
   `iPhone 13` emulado y desktop 1280×800, datos reales): tarjeta
   traslúcida con esquinas redondeadas flotando sobre el cielo azul de
   "Tiempo", por encima de la casa; confirmado con
   `getBoundingClientRect()`/`getComputedStyle()` que la posición y el
   `border-radius`/`background` calculados coinciden con lo pedido;
   Inicio confirmado sin `.pronostico-extendido` y cabiendo sin deslizar;
   gesto de arrastre real sobre la escena con el overlay visible
   confirmando que el paneo/zoom de la escena (checkpoints anteriores)
   sigue intacto. Sin errores de consola en ningún caso. Script ad-hoc,
   no committeado.

### Marcador de 3h real, condiciones actuales y selector de día (2026-08-18, misma tarde)

Tres pedidos explícitos tras ver la tarjeta ya flotando sobre el cielo:
un bug real ("son las 5:45 y el primer punto que sale es a las 21:00,
debería ser a las 18:00"); añadir encima de la línea de temperatura la
temperatura actual en grande, con icono, humedad, viento y nubosidad más
pequeños al lado; y poder seleccionar cada uno de los 7 días para que la
fila de horas de arriba se actualice a ese día, con el seleccionado
(hoy por defecto) marcado con un cuadrito verde.

1. **Bug real confirmado con el caso exacto del usuario antes de
   arreglarlo: `seleccionarHoras` calculaba objetivos como "ahora + i×3h"
   (17:45+3h=20:45) y luego buscaba el punto horario MÁS CERCANO a ese
   instante — a las 17:45, el más cercano a 20:45 es 21:00, no 18:00.**
   El diseño original (misma sesión, unas horas antes) nunca pensó en
   "próxima marca redonda de 3h", solo en "n×3h de aquí" — funcionaba
   por casualidad cuando `ahora` ya caía en una marca exacta (como en los
   tests, que usaban `12:00`), pero no en el caso general. Arreglado con
   `proximoMarcadorTresHoras(ahora)` (`src/ui/pronosticoExtendido.js`):
   trunca a la hora en curso y avanza de una en una hasta la primera que
   sea múltiplo de 3 — siempre estrictamente posterior a `ahora` (si
   `ahora` cayera justo en una marca, salta a la siguiente, no se queda
   en la actual). `seleccionarHoras` pasa a generar sus 7 objetivos desde
   ese marcador (`primerMarcador + i×3h`, i=0..6) en vez de sumar
   directamente sobre `ahora`.

2. **`seleccionarHorasDelDia(hourly, fecha, lat, lon)`, función nueva —
   las 8 marcas fijas (00,03,...,21) de un día concreto, sin filtrar por
   `ahora`.** Necesaria para el selector de día: al elegir un día
   distinto de hoy, esas 8 marcas ya son todas futuras por construcción
   (el día entero está por delante), así que no hace falta el concepto
   de "próximo marcador" que sí necesita "Hoy". `seleccionarHoras`
   (renombrada internamente su lógica, mismo nombre exportado) sigue
   siendo la que se usa para "Hoy" — 7 puntos desde el próximo marcador,
   que puede cruzar la medianoche si quedan pocas horas del día en curso
   (aceptado a propósito, es literalmente "las próximas 21h"). Ambas
   comparten `puntoMasCercano()`, extraída como función interna en vez
   de duplicar la búsqueda de índice más cercano.

3. **`obtenerPronosticoExtendido` (`src/data/openMeteo.js`) pierde el
   `forecast_hours=24` explícito — bug real de alcance, encontrado al
   diseñar el selector de día antes de escribirlo, no en producción.**
   Con `forecast_hours=24` fijo, `hourly` solo cubría las próximas 24h
   sin importar qué día se seleccionara — `seleccionarHorasDelDia` para
   el día 3 (o más) simplemente no habría tenido datos de qué buscar.
   Sin ese parámetro, `hourly` hereda el mismo `forecast_days=7` que ya
   se pedía para `daily` (confirmado con una petición real: 168 puntos
   horarios, uno por cada hora de los 7 días completos) — un único
   fetch ya cubre el horizonte completo que necesita el selector, sin
   tener que volver a pedir nada a Open-Meteo al cambiar de día.

4. **Condiciones actuales reutilizan el `actual` que ya calcula
   `escena3dDashboard.js` para la propia escena 3D (Q_solar, sombra,
   iluminación) — no un tercer fetch.** `montarEscena3D` ya llama a
   `obtenerDatosReales()` una vez; antes ese resultado solo alimentaba
   `crearEscena3D`, ahora también se pasa a
   `montarPronosticoExtendido(contenedor, ubicacion, actual)` como
   tercer parámetro. Si ese fetch falla, `actual` queda en `null` y
   `condicionesActualesHtml()` simplemente no dibuja esa franja — el
   resto de la tarjeta (horas/días) tiene su propio fetch
   (`obtenerPronosticoExtendido`) y no depende de él en absoluto, mismo
   criterio de independencia ya establecido cuando se separaron ambos
   fetches.

5. **`montarPronosticoExtendido` pasa de una función de un solo disparo
   (fetch → pintar HTML una vez) a dueña de su propio estado
   (`diaSeleccionado`) con un `render()` interno reutilizable — mismo
   patrón que `dashboard.js`/`historico.js`.** `hourly`/`daily` quedan en
   el cierre de la función tras el fetch; cambiar de día NO vuelve a
   pedir nada a la red, solo recalcula `horas` (con
   `seleccionarHoras`/`seleccionarHorasDelDia` según si el día elegido es
   el 0 o no) y reconstruye el HTML. Los botones de día
   (`.pron-dia-item`) se reenganchan con `addEventListener` después de
   cada `render()`, igual que ya hace `dashboard.js` con sus
   interruptores tras cada `root.innerHTML`.

6. **Los días son `<button type="button">`, no `<div>` — necesario para
   que sean clicables/accesibles, con el mismo problema de
   especificidad CSS ya documentado varias veces en este fichero
   (`button.boton-icono`, `button.interruptor`, `button.boton-borrar`):
   `button[type='button']` (genérico, ya existente) gana por
   especificidad a una clase sola, así que hace falta calificar con el
   elemento (`button.pron-dia-item`) para que el padding/border/fondo de
   aquí ganen.** El día activo (`button.pron-dia-item.pron-dia-activo`,
   doble clase para ganar también por especificidad y no solo por orden)
   usa `--acento-fondo` + borde `--acento` — el "cuadradito verde"
   pedido, mismo tono ya usado en la app para destacar algo sin gritar
   (pista de recomendación de las tarjetas de ventana, Inicio).

7. **Verificación:** 5 casos de prueba nuevos en
   `test/pronosticoExtendido.test.js` (`proximoMarcadorTresHoras` en sus
   3 casos límite — hora suelta, justo en una marca, cruce de
   medianoche — y `seleccionarHorasDelDia`), 11 casos OK en ese fichero
   (166 en total en `npm test`), verificado también con `TZ=UTC` a mano
   para no repetir el fallo de CI de la sesión anterior. `npm run build`
   sin errores. Visual con Playwright (`iPhone 13`, hora real del
   sistema ~17:55): primer punto de horas en 18:00 (no 21:00);
   condiciones actuales "32° · 33% · 17km/h · 0% · 0.0mm" con el sol en
   grande a la izquierda; clic en el tercer día (Jue) actualiza la fila
   de horas a las 8 marcas de ese día (00:00 a 21:00, con lunas de
   madrugada) y lo marca con fondo verde — confirmado también con
   `getComputedStyle` que el color de fondo del día activo coincide con
   `--acento-fondo`. Sin errores de consola en ningún caso. Script
   ad-hoc, no committeado.

### Icono de lluvia falso y sol más grande (2026-08-18, misma tarde)

Dos pedidos explícitos más, y una pregunta: "hay días en los que el
icono es de lluvia pero luego no llueve"; "el icono de sol con nubes haz
el sol más grande"; y si es normal que el jueves salieran máximas de 32°
en la app cuando Google mostraba 25°.

1. **Bug real confirmado con una petición directa a Open-Meteo antes de
   tocar nada: `daily.weather_code` (el código "más severo del día") puede
   marcar un código de llovizna/lluvia con `precipitation_sum` en 0.0mm
   el mismo día.** Visto en producción: código 55 ("llovizna densa") con
   0.0mm reales el mismo día — el dato de categoría y el dato de cantidad
   de lluvia, ambos reales, se contradicen entre sí, y el icono solo
   miraba el primero. `categoriaTiempoDia(codigoTiempo,
   precipitacionSumMm)`, función nueva en `src/data/openMeteo.js` (junto
   a `categoriaTiempo`/`esTormenta`, mismo criterio de "interpretación
   del dato de la API" ya establecido) — corrobora las categorías que
   implican precipitación (lluvia/nieve/tormenta) con la cantidad
   acumulada real; por debajo de `UMBRAL_PRECIPITACION_ICONO_MM = 0.2`,
   se muestra como "nublado" en vez de una lluvia/nieve/tormenta que el
   propio dato de cantidad desmiente. Solo afecta a la fila de 7 DÍAS
   (`seleccionarDias`, que ya tenía el dato de precipitación disponible
   tras pedirlo) — la fila de horas sigue usando `categoriaTiempo` a
   secas: cada hora tiene su propio código real para ese instante
   concreto, sin el mismo problema de "resumen del día entero" que solo
   existe en el dato diario. `obtenerPronosticoExtendido` pide ahora
   también `precipitation_sum` en `daily` (no se pedía antes, hacía
   falta para esta corroboración).

2. **Sol más grande en `iconoNubeSol` — pedido explícito, se leía como
   una mota diminuta junto a la nube.** Radio del disco de 2.1 a 3.1 (un
   ~50% más grande), con los rayos reescalados a juego. Verificado
   aislando ambas versiones en una página mínima aparte (no en la app en
   vivo: con el clima real de Pamplona en el momento de verificar no
   había ningún día/hora en categoría "parcial" con el que comparar
   dentro de la propia interfaz) — confirmado en captura que el sol
   nuevo se lee con mucha más presencia que el original, sin salirse del
   hueco libre que deja la nube. `iconoNubeLuna` (la misma composición
   pero de noche) no se tocó — no fue lo que se pidió, y una luna
   pequeña se lee bien a su tamaño actual sin necesitar el mismo ajuste
   que un sol con rayos.

3. **La pregunta del jueves: no es un bug de la app — verificado
   comparando el número mostrado contra la respuesta cruda de Open-Meteo
   antes de responder.** Una petición directa a la API para ese día
   devolvió `temperature_2m_max: 31.7`, que es exactamente lo que la app
   redondea a "32°" — no hay ningún desfase de índice/día ni error de
   zona horaria en cómo se procesa. La discrepancia con Google (25°) es
   real pero ajena al código: cada proveedor agrega modelos
   meteorológicos distintos (Open-Meteo mezcla varios modelos numéricos
   reales; Google no necesariamente los mismos), y ese jueves concreto
   cae justo en una transición de temperatura fuerte según el propio
   Open-Meteo (32° jueves -> 23° viernes, una caída de 8-9° de un día
   para otro) — en una transición así, una pequeña diferencia entre
   modelos sobre CUÁNDO llega el cambio de tiempo (unas horas antes o
   después) puede traducirse en varios grados de diferencia en la
   máxima prevista para ese día concreto. Es una limitación conocida de
   cualquier previsión a varios días vista, no algo que la app deba (o
   pueda) corregir: se le explicó esto al usuario en vez de tratarlo
   como una tarea de código.

4. **Verificación:** 7 casos de prueba nuevos (6 en
   `test/openMeteo.test.js` para `categoriaTiempoDia`, incluido el caso
   exacto reportado; 1 en `test/pronosticoExtendido.test.js` para
   `seleccionarDias` con el mismo caso real de extremo a extremo), 171 en
   total en `npm test`, sin romper ningún test ya existente.
   `npm run build` sin errores. Visual con Playwright y clima real de
   Pamplona: un día que antes mostraba icono de lluvia con 0.0mm real
   ("Mié") pasa a mostrar nube sin gotas, con el resto de días con
   lluvia real de verdad sin cambios; icono de sol grande verificado por
   separado (ver punto 2). Sin errores de consola en ningún caso.
   Scripts ad-hoc, no committeados.

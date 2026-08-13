# Estado del proyecto

Última actualización: 2026-08-13 (Fase 6, checkpoints 1-3)

Trabajamos una fase por sesión. Al empezar una sesión nueva: lee este archivo,
confirma en qué fase estamos, y no avances a la siguiente fase sin que la actual
tenga sus tests/verificación pasando y esté commiteada.

## Hecho

- **Fase 1 — Modelo puro.** Modelo térmico RC, sombra por ventana y motor de
  recomendación implementados como funciones puras en `src/model/` (sin APIs
  reales, sin persistencia, sin interfaz). 26 casos de prueba manuales en
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
- **Fase 6 (checkpoints 1-3) — Escena 3D, en progreso.** `src/escena3d/`
  (`geometria.js`, `iluminacion.js`, `escena.js`) con Three.js
  (`0.185.1`, pinneada exacta como `playwright`), montada de forma
  aislada en `escena3d.html`/`src/ui/main-escena3d.js` (no en el
  dashboard todavía — eso es integración pendiente). Habitación como
  caja rectangular con las dos ventanas de cristal completo (suelo a
  techo) en paredes opuestas, marco en cruz + perimetral por ventana con
  sombra 3D real (`castShadow`/`receiveShadow`, sol real vía
  `posicionSolar` + `DirectionalLight`), cámara ortográfica fija estilo
  Los Sims. El edificio enfrente y el parche de sol en el suelo se
  probaron y se descartaron — detalle completo en "Decisiones tomadas".
  Override de depuración `?debugHora=&debugNubes=&debugLluvia=` en
  `escena3d.html` (banner "MODO DEBUG" visible), puramente visual — no
  toca `localStorage`. 20 casos de prueba nuevos
  (`test/escena3d-geometria.test.js`, `test/escena3d-iluminacion.test.js`),
  integrados en `npm test`. Verificación visual con
  `scripts/captura-escena3d.mjs` (mismo patrón que
  `captura-pantalla.mjs`, con query string opcional para el override de
  depuración).

## Fase actual

Fase 6 — Escena 3D. Hechos los checkpoints 1-3 (geometría/cámara fija,
marco de ventana con sombra real, sol real). Falta el checkpoint 4
(nubes/lluvia) y, después, integrar la escena en `index.html` junto al
dashboard (de momento vive aislada en `escena3d.html` para iterar sin
mezclar con el checkpoint 5 de Fase 5).

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
- [ ] **Fase 6 — Escena 3D.** Vista fija estilo Los Sims, geometría limpia,
      sol/sombra/nubes/lluvia en vivo (spec.md §6.1). Probablemente varias
      sesiones — no forzar que quepa en una.
- [ ] **Fase 7 — Histórico.** Predicho vs. real, recalibración con las
      últimas ~30 anotaciones no etiquetadas (spec.md §4.2, §6.4).
- [ ] **Fase 8 — PWA.** Manifest, service worker, instalable en Android
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

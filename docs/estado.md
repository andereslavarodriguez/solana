# Estado del proyecto

Última actualización: 2026-08-13 (Fase 4)

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

## Fase actual

Fase 5 — Dashboard (sin empezar)

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
- [ ] **Fase 5 — Dashboard.** Pantalla principal: clima en vivo, recomendación
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

# Estado del proyecto

Última actualización: 2026-08-13 (Fase 2)

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

## Fase actual

Fase 3 — Persistencia (sin empezar)

## Fases

- [x] **Fase 1 — Modelo puro.** Modelo térmico RC (spec.md §4), cálculo de sombra
      por ventana (§4.1) y motor de recomendación (§5), como funciones puras de
      JS con datos de prueba inventados (sin APIs reales todavía). Casos de
      prueba manuales que se puedan verificar a ojo.
- [x] **Fase 2 — Datos reales.** Integrar Open-Meteo (minutely_15, clima +
      pronóstico 6-8h) y SunCalc (posición solar). Sustituir los datos de
      prueba de la Fase 1 por reales. Verificar que los números tienen sentido
      para la ubicación y el momento actual.
- [ ] **Fase 3 — Persistencia.** Guardar en localStorage los parámetros del
      piso/edificios y las anotaciones de temperatura (con sus etiquetas
      opcionales, spec.md §3.5).
- [ ] **Fase 4 — Pantalla de parámetros.** Interfaz para editar la geometría
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

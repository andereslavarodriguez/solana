# Solana — gemelo digital del piso (especificación técnica)

Proyecto de aprendizaje personal (previo a incorporarse a BM2 Solar) para entender la
arquitectura de un gemelo digital antes de aplicarla al mercado eléctrico español.
Este documento es la especificación completa para construir el proyecto con Claude Code.

## 1. Qué es esto

Una PWA (Progressive Web App) instalable en Android, sin servidor, sin tienda de
aplicaciones, sin coste ni mantenimiento, que:

- Mantiene un modelo térmico en vivo del salón-cocina de un piso concreto (2ª planta).
- Lo alimenta con datos meteorológicos reales y la posición solar real, calculados
  para la ubicación exacta del piso.
- Recomienda, por separado para cada una de las dos ventanas, si conviene abrir/cerrar
  la ventana y subir/bajar la persiana.
- Se corrige con temperaturas reales que el usuario anota a mano, y compara predicción
  vs. realidad.
- Muestra una escena 3D fija (estilo "Los Sims": vista isométrica, cámara fija, sin
  órbita) con sol, sombras, nubes y lluvia reflejando las condiciones reales.

Es deliberadamente un gemelo digital "de verdad" y no una simulación: el valor está en
que el modelo se puede equivocar, se pueda medir cuánto se equivoca, y se pueda
corregir con datos reales — el mismo patrón que un gemelo digital de una batería o de
una planta industrial.

## 2. Arquitectura de datos (sin servidor)

```
Ubicación fija (introducida una vez)
        │
        ├──> SunCalc (cálculo astronómico local, sin API) ──> posición del sol
        │                                                       (acimut, elevación)
        └──> Open-Meteo (API pública gratuita, sin clave) ──> clima real
                                                                (temp, lluvia, humedad,
                                                                 viento, nubosidad)
                                    │
                                    v
                    Modelo térmico RC (una sola zona, ver §4)
                                    │
                    corregido con  │  temperatura interior
                    anotaciones    │  anotada a mano (+ etiquetas
                    del usuario <──┘  opcionales de factores externos)
                                    │
                                    v
                  Motor de recomendación por ventana (ver §5)
                                    │
                                    v
                     Interfaz: escena 3D + dashboard (ver §6)
```

Toda la persistencia (parámetros del piso, histórico de anotaciones) vive en
`localStorage`/IndexedDB del propio móvil. No hay backend propio ni base de datos remota.

## 3. Datos de entrada

### 3.1 Ubicación
- Se introduce **una vez** (dirección o lat/long) en la pantalla de parámetros y queda
  fija. No se pide geolocalización en cada apertura.

### 3.2 Clima (Open-Meteo, sin API key)
- Variables: temperatura, precipitación, humedad relativa, viento, nubosidad (%).
- **Todas** las variables se piden con el parámetro `minutely_15` (resolución de 15
  minutos) — es gratuito y no tiene contrapartida frente a pedirlas en horario. Si
  Pamplona cae dentro del dominio de alta resolución de Open-Meteo (ICON-D2/AROME,
  centrado en Alemania/Francia y alrededores) los 15 minutos son datos nativos del
  modelo; si cae justo fuera, Open-Meteo interpola matemáticamente el dato horario a
  intervalos de 15 minutos — no perjudica en nada pedirlo de todas formas, así que no
  hace falta comprobarlo de antemano ni diferenciar variables.
- Se pide también el **pronóstico de las próximas 6-8 horas** de estas mismas
  variables, para que el motor de recomendación pueda anticipar.

### 3.3 Posición solar
- Librería SunCalc (JS, sin dependencias, cálculo puro cliente): acimut y elevación
  solar exactos para la ubicación y el instante actual, y para las próximas horas.

### 3.4 Geometría del piso (parámetros editables)
- Planta: 2ª.
- Superficie del salón-cocina (m²) y altura de techo (parámetro, valor por defecto 2.5m).
- Ventana A: orientación 248° (SO). Suelo a techo. Grosor de cristal ~1.5cm.
  Edificio enfrente: 5 plantas (~15m), a 45m de distancia.
- Ventana B: orientación 68° (NE, opuesta). Suelo a techo, mismo grosor.
  Edificio enfrente: 4 plantas (~12m), a 20m de distancia.
- Todos estos valores son parámetros numéricos editables en la app (no fijos en código).
- v1: parámetros numéricos simples (ancho, orientación, alturas/distancias de
  obstáculos). No hay editor visual de planta en v1 — ver §8.

### 3.5 Anotaciones manuales de temperatura interior
- El usuario anota la temperatura interior cuando quiere, con marca de tiempo.
- Etiquetas opcionales por anotación: "cocinando", "calefacción/AC encendido", "más
  gente de lo normal". Las anotaciones etiquetadas se guardan y se muestran en el
  histórico, pero se excluyen de la recalibración automática (§4.4).
- Se guardan indefinidamente (el volumen de datos es insignificante). La
  recalibración automática solo usa las últimas ~30 anotaciones no etiquetadas.

## 4. Modelo térmico

Una sola zona de aire (salón-cocina en L), con ganancia solar calculada por separado
por ventana. Ecuación de balance (modelo RC de un nodo):

```
dT_in/dt = (1/C) · [ UA · (T_out − T_in) + Q_solar(t) + Q_vent(t) ]
```

- `C` — capacidad térmica de la zona (J/°C). Estimación inicial: volumen (m² × altura
  de techo) × densidad del aire × calor específico del aire, multiplicado por un
  factor empírico (parámetro ajustable, por defecto ×6) para aproximar la inercia de
  paredes/muebles sin modelarlos por separado.
- `UA` — coeficiente de pérdidas por conducción con ventanas y persianas cerradas
  (W/°C). Valor inicial típico de doble acristalamiento + fachada estándar,
  parámetro ajustable y candidato principal a recalibración.
- `Q_solar(t)` — suma sobre las ventanas **no sombreadas** en el instante t de:
  `Área_ventana × SHGC × I_proxy(t) × cos(ángulo_incidencia)`, donde `I_proxy(t)`
  es una irradiancia estimada a partir de la elevación solar (`I_max · sin(elevación)`)
  modulada por la nubosidad real (%) de la API. SHGC (coeficiente de ganancia solar del
  cristal) es un parámetro ajustable, valor inicial típico de doble acristalamiento.
  Si la persiana de esa ventana está bajada, `Q_solar` de esa ventana es 0.
- `Q_vent(t)` — si la ventana está abierta: caudal de aire estimado (renovaciones/hora,
  parámetro ajustable) × capacidad calorífica del aire × `(T_out − T_in)`. Si está
  cerrada, es 0.

### 4.1 Sombra de edificios enfrente
Para cada ventana, ángulo de elevación solar límite:
`elevación_límite = atan((altura_edificio − altura_ventana) / distancia)`.
Por debajo de esa elevación solar, la ventana está en sombra completa
(`Q_solar` de esa ventana = 0). **Simplificación deliberada de v1**: no se considera
el ancho angular del edificio (solo la elevación) — la diferencia que introduce es
pequeña para el propósito del proyecto.

### 4.2 Corrección con datos reales
Cada anotación manual no etiquetada se usa para:
1. Mostrar predicción vs. realidad en el histórico (§6.4).
2. Recalibrar `UA` y/o el factor de capacidad térmica por regresión simple sobre las
   últimas ~30 anotaciones no etiquetadas (minimizar el error de predicción acumulado).

## 5. Motor de recomendación

Por cada ventana, dos salidas independientes:
- **Ventana**: abrir/cerrar — decide comparando `T_in` vs. `T_out` **actual y
  prevista** (próximas 6-8h): si abrir ahora o en las próximas horas acerca `T_in` a
  una zona de confort (parámetro, por defecto 21-25°C), se recomienda abrir.
- **Persiana**: subir/bajar — decide en función de si esa ventana tiene sol directo
  ahora o en las próximas horas (según §4.1) y si `Q_solar` ayuda o perjudica respecto
  a la zona de confort.

Casos que las hacen depender una de otra (documentado para que la lógica no las trate
como una sola decisión):
- Sol + fuera frío → persiana arriba (ganancia solar gratis), ventana cerrada (no
  perder calor).
- Sol + fuera caluroso → ambas cerradas.
- Sin sol + fuera más fresco que dentro → ventana abierta, persiana indiferente
  térmicamente.
- Sin sol + fuera más caliente que dentro → ventana cerrada, persiana indiferente
  térmicamente.

## 6. Interfaz

Estilo visual: **cálido y hogareño** — colores claros, tono tranquilo y calmado,
tipografía suave. Nada de estética "sala de control".

### 6.1 Escena 3D (elemento central)
- Geometría limpia (paredes, ventanas, suelo), sin mobiliario ilustrativo.
- Vista fija isométrica tipo *Los Sims*: cámara fija, sin controles de órbita.
- Efectos en vivo reflejando datos reales: rayos de sol y sombra proyectada en el
  suelo a través de las ventanas cuando hay sol y no hay obstrucción; nubes cuando hay
  nubosidad alta; lluvia cuando `precipitación > 0`. Todo con paleta suave/tranquila.

### 6.2 Dashboard
- Temperatura/humedad/viento/lluvia exteriores (en vivo).
- Última temperatura interior anotada + botón para anotar una nueva (con las 3
  etiquetas opcionales de §3.5).
- Dos tarjetas de recomendación, una por ventana, cada una con su estado de
  ventana + persiana.

### 6.3 Parámetros
- Todos los valores de §3.4 editables, más los parámetros ajustables del modelo
  (`UA`, factor de capacidad térmica, SHGC, renovaciones/hora) con sus valores
  actuales (recalibrados o por defecto) visibles.

### 6.4 Histórico
- Gráfica de temperatura interior anotada vs. predicha por el modelo en el mismo
  instante. Los puntos etiquetados con un factor externo (§3.5) se marcan visualmente
  distintos y no cuentan para el error medio de calibración.

## 7. Distribución
- PWA: manifest.json + service worker (cacheo para funcionar con conexión
  intermitente; los datos de clima requieren red, el resto funciona offline).
- Alojamiento estático gratuito (ej. GitHub Pages) — no es "un servidor propio", es
  solo dónde viven los archivos.
- Instalación vía "Añadir a pantalla de inicio" en Android/Chrome.
- **Sin notificaciones push.** Se evaluó y se descartó: requeriría o bien un backend
  real, o bien la API de "Notification Triggers" de Chrome, que Google mismo retiró
  del navegador por no poder garantizarla sin servidor.

## 8. Fuera de alcance en v1 (posibles mejoras futuras)
- Editor visual de la forma del piso (dibujar el contorno) — v1 usa parámetros
  numéricos.
- Ancho angular de los edificios obstáculo en el cálculo de sombra.
- Radiación solar medida en vez de proxy geométrico.
- Notificaciones proactivas (requeriría aceptar un poco de infraestructura en la nube).
- Modelo multi-zona (si en el futuro se separan estancias con puertas).

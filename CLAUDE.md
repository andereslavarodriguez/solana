# Solana — gemelo digital del piso

Ver @docs/spec.md para la especificación técnica completa (arquitectura, modelo
térmico, motor de recomendación, pantallas, límites del proyecto).

Ver @docs/estado.md para qué está construido, qué está en progreso y qué toca ahora.
Actualízalo tú mismo (marca checkboxes, añade lo nuevo) cada vez que termines algo,
sin que tenga que pedírtelo cada vez.

## Cómo trabajar en este proyecto

- Construir por fases, en este orden: (1) modelo térmico + motor de recomendación
  como funciones puras de JS con casos de prueba manuales, sin interfaz; (2)
  integración de datos reales (Open-Meteo + SunCalc); (3) persistencia local; (4)
  dashboard; (5) escena 3D. No saltar a una fase sin que la anterior tenga pruebas
  que pasen.
- Commit con git al final de cada fase que funcione, con mensaje descriptivo.
- Si tomas una decisión de diseño que no estaba en docs/spec.md (por ejemplo, un
  valor de parámetro concreto, una simplificación), anótala en la sección
  "Decisiones tomadas durante la construcción" de docs/estado.md.

## Requisitos no negociables (ver docs/spec.md §7)

- Sin servidor propio, sin backend, sin base de datos remota. Solo APIs públicas
  externas (Open-Meteo) llamadas directamente desde el cliente, y almacenamiento
  local del dispositivo.
- Sin notificaciones push (evaluado y descartado, ver spec §7).
- Estilo visual: cálido y hogareño, tono tranquilo — nunca estética de sala de
  control ni dashboard técnico denso.

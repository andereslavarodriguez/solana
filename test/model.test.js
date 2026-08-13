// Casos de prueba manuales para la Fase 1 (modelo puro, sin APIs reales).
// Cada caso imprime el resultado y lo compara contra un valor calculado a
// mano, para poder verificarlo a ojo además de con el assert.

import assert from 'node:assert/strict';
import { factorNubosidad, cosIncidencia, iProxy } from '../src/model/irradiancia.js';
import { elevacionLimiteSombra, ventanaSombreada } from '../src/model/sombra.js';
import { qSolarVentana, qVentVentana, derivadaTemperatura, simularHorizonte } from '../src/model/termico.js';
import { recomendarVentana, recomendarPersiana } from '../src/model/recomendacion.js';

let ok = 0;
function caso(nombre, fn) {
  fn();
  ok += 1;
  console.log(`OK  ${nombre}`);
}

const cerca = (a, b, tol = 0.01) => Math.abs(a - b) < tol;

// --- Piso de prueba (valores de prueba, NO son los defaults finales de la
// pantalla de parámetros de la Fase 4 — eso se decide en su propia fase) ---
const piso = {
  superficie: 30, // m²
  alturaTecho: 2.5, // m
  UA: 60, // W/°C
  factorCapacidad: 6,
  SHGC: 0.6,
  renovacionesHora: 3, // ventana bien abierta, no solo entreabierta
  bandaConfort: { min: 21, max: 25 },
  ventanas: [
    { nombre: 'A', orientacion: 248, ancho: 2.0, alturaEdificioEnfrente: 15, distanciaEdificioEnfrente: 45 },
    { nombre: 'B', orientacion: 68, ancho: 1.8, alturaEdificioEnfrente: 12, distanciaEdificioEnfrente: 20 },
  ],
};

console.log('\n--- factorNubosidad (§4, modulación lineal por nubosidad) ---');

caso('0% nubes -> factor 1', () => {
  assert.equal(factorNubosidad(0), 1);
});
caso('100% nubes -> factor 0', () => {
  assert.equal(factorNubosidad(100), 0);
});
caso('50% nubes -> factor 0.5', () => {
  assert.equal(factorNubosidad(50), 0.5);
});
caso('valores fuera de rango se recortan a [0,1]', () => {
  assert.equal(factorNubosidad(-10), 1);
  assert.equal(factorNubosidad(150), 0);
});

console.log('\n--- cosIncidencia (§4, ventana vertical) ---');

caso('sol de frente a la ventana (mismo azimut) a 45° elevación -> cos(45°)', () => {
  const v = cosIncidencia(45, 248, 248);
  console.log(`    cosIncidencia = ${v.toFixed(4)} (esperado ${Math.cos(Math.PI / 4).toFixed(4)})`);
  assert.ok(cerca(v, Math.cos(Math.PI / 4)));
});
caso('sol a 90° de azimut respecto a la ventana -> 0 (rasante)', () => {
  const v = cosIncidencia(45, 248 + 90, 248);
  assert.ok(cerca(v, 0));
});
caso('sol al otro lado del edificio (180° de diferencia) -> 0 (recortado, no negativo)', () => {
  const v = cosIncidencia(45, 248 + 180, 248);
  assert.equal(v, 0);
});
caso('sol en el cénit (90° elevación) -> 0 (rasante para una pared vertical)', () => {
  const v = cosIncidencia(90, 248, 248);
  assert.ok(cerca(v, 0));
});

console.log('\n--- elevacionLimiteSombra / ventanaSombreada (§4.1) ---');
// Altura de referencia: punto medio del hueco suelo-a-techo = alturaTecho/2 = 1.25m

caso('ventana A: edificio 15m a 45m -> límite ≈ 17.0°', () => {
  const lim = elevacionLimiteSombra(15, 1.25, 45);
  console.log(`    elevacionLimite A = ${lim.toFixed(2)}°`);
  assert.ok(cerca(lim, 16.997, 0.05));
});
caso('ventana B: edificio 12m a 20m -> límite ≈ 28.28°', () => {
  const lim = elevacionLimiteSombra(12, 1.25, 20);
  console.log(`    elevacionLimite B = ${lim.toFixed(2)}°`);
  assert.ok(cerca(lim, 28.28, 0.05));
});
caso('sol por debajo del límite -> sombreada', () => {
  assert.equal(ventanaSombreada(10, 17.0), true);
});
caso('sol por encima del límite -> no sombreada', () => {
  assert.equal(ventanaSombreada(20, 17.0), false);
});
caso('edificio más bajo que el punto medio de la ventana (límite negativo) -> casi nunca sombreada', () => {
  const lim = elevacionLimiteSombra(1, 1.25, 20); // edificio de 1m, más bajo que 1.25m de referencia
  console.log(`    elevacionLimite (edificio bajo) = ${lim.toFixed(2)}°`);
  assert.ok(lim < 0);
  assert.equal(ventanaSombreada(1, lim), false); // hasta con el sol muy bajo, no sombreada
});

console.log('\n--- qSolarVentana (§4) ---');

caso('ventana A, sol de frente a 30°, sin nubes, persiana arriba -> ≈1299 W', () => {
  const sol = { elevacion: 30, azimut: 248, nubesPct: 0 };
  const estado = { persianaArriba: true, abierta: false };
  const q = qSolarVentana(piso.ventanas[0], estado, sol, piso);
  console.log(`    Q_solar A = ${q.toFixed(1)} W`);
  // area = 2.0*2.5=5 m² · SHGC 0.6 · I_proxy=1000*sin(30°)=500 · cos(incidencia)=cos(30°)*cos(0°)≈0.866
  const esperado = 5 * 0.6 * 500 * Math.cos((30 * Math.PI) / 180);
  assert.ok(cerca(q, esperado, 1));
});
caso('misma situación con persiana abajo -> 0 W', () => {
  const sol = { elevacion: 30, azimut: 248, nubesPct: 0 };
  const estado = { persianaArriba: false, abierta: false };
  const q = qSolarVentana(piso.ventanas[0], estado, sol, piso);
  assert.equal(q, 0);
});
caso('ventana A con sol por debajo del límite de sombra -> 0 W aunque persiana arriba', () => {
  const sol = { elevacion: 10, azimut: 248, nubesPct: 0 }; // 10° < 17° límite
  const estado = { persianaArriba: true, abierta: false };
  const q = qSolarVentana(piso.ventanas[0], estado, sol, piso);
  assert.equal(q, 0);
});
caso('ventana A con sol dando en la fachada opuesta (B) -> 0 W', () => {
  const sol = { elevacion: 30, azimut: 68, nubesPct: 0 }; // azimut de la ventana B
  const estado = { persianaArriba: true, abierta: false };
  const q = qSolarVentana(piso.ventanas[0], estado, sol, piso);
  assert.equal(q, 0);
});

console.log('\n--- qVentVentana (§4) ---');

caso('ventana abierta, fuera más frío que dentro -> Q_vent negativo (enfría)', () => {
  const estado = { abierta: true, persianaArriba: false };
  const q = qVentVentana(piso.ventanas[0], estado, 26, 20, piso);
  console.log(`    Q_vent = ${q.toFixed(1)} W`);
  assert.ok(q < 0);
});
caso('ventana cerrada -> Q_vent = 0', () => {
  const estado = { abierta: false, persianaArriba: false };
  const q = qVentVentana(piso.ventanas[0], estado, 26, 20, piso);
  assert.equal(q, 0);
});

console.log('\n--- derivadaTemperatura / simularHorizonte (§4) ---');

caso('de noche, todo cerrado, fuera más frío -> dT/dt negativo (se enfría)', () => {
  const sol = { elevacion: -10, azimut: 0, nubesPct: 0 };
  const estados = {
    A: { abierta: false, persianaArriba: false },
    B: { abierta: false, persianaArriba: false },
  };
  const dTdt = derivadaTemperatura(22, 10, sol, estados, piso);
  console.log(`    dT/dt = ${dTdt.toExponential(3)} °C/s`);
  assert.ok(dTdt < 0);
});

caso('simularHorizonte: de noche y fuera más frío, la trayectoria decrece de forma monótona', () => {
  const sol = { elevacion: -10, azimut: 0, nubesPct: 0 };
  const estados = {
    A: { abierta: false, persianaArriba: false },
    B: { abierta: false, persianaArriba: false },
  };
  const pronostico = Array.from({ length: 8 }, () => ({ tOut: 15, sol })); // 2h a pasos de 15min
  const tray = simularHorizonte(22, pronostico, estados, piso);
  console.log(`    trayectoria = [${tray.map((t) => t.toFixed(2)).join(', ')}]`);
  for (let i = 1; i < tray.length; i += 1) {
    assert.ok(tray[i] < tray[i - 1]);
  }
});

console.log('\n--- recomendarVentana (§5) ---');

caso('noche, sin sol, dentro por encima de la banda y fuera dentro de la banda -> recomienda abrir', () => {
  // T_in=27 (por encima de la banda 21-25), T_out=22 (dentro de la banda): abrir
  // acerca T_in a la banda más rápido que dejar que se enfríe solo por conducción.
  const sol = { elevacion: -10, azimut: 0, nubesPct: 0 };
  const pronostico = Array.from({ length: 24 }, () => ({ tOut: 22, sol })); // 6h
  const estados = {
    A: { abierta: false, persianaArriba: false },
    B: { abierta: false, persianaArriba: false },
  };
  const r = recomendarVentana('A', 27, pronostico, estados, piso);
  console.log(`    accion = ${r.accion}`);
  assert.equal(r.accion, 'abrir');
});

caso('noche, sin sol, fuera bastante más caliente que dentro -> recomienda cerrar', () => {
  const sol = { elevacion: -10, azimut: 0, nubesPct: 0 };
  const pronostico = Array.from({ length: 24 }, () => ({ tOut: 30, sol }));
  const estados = {
    A: { abierta: false, persianaArriba: false },
    B: { abierta: false, persianaArriba: false },
  };
  const r = recomendarVentana('A', 22, pronostico, estados, piso);
  console.log(`    accion = ${r.accion}`);
  assert.equal(r.accion, 'cerrar');
});

console.log('\n--- recomendarPersiana (§5, regla acordada) ---');

caso('T_in ya por encima de 25°C ahora mismo -> bajar, sin mirar T_out', () => {
  const sol = { elevacion: 40, azimut: 248, nubesPct: 0 };
  const pronostico = Array.from({ length: 8 }, () => ({ tOut: 5, sol })); // fuera helando
  const estados = {
    A: { abierta: false, persianaArriba: false },
    B: { abierta: false, persianaArriba: false },
  };
  const r = recomendarPersiana('A', 26, pronostico, estados, piso);
  console.log(`    accion = ${r.accion} (${r.motivo})`);
  assert.equal(r.accion, 'bajar');
});

caso('sol fuerte y sostenido con fuera caluroso -> con persiana arriba se supera 25°C -> bajar', () => {
  const sol = { elevacion: 45, azimut: 248, nubesPct: 0 };
  const pronostico = Array.from({ length: 24 }, () => ({ tOut: 32, sol })); // 6h de sol pleno + calor
  const estados = {
    A: { abierta: false, persianaArriba: false },
    B: { abierta: false, persianaArriba: false },
  };
  const r = recomendarPersiana('A', 22, pronostico, estados, piso);
  console.log(`    accion = ${r.accion} (${r.motivo})`);
  assert.equal(r.accion, 'bajar');
});

caso('sin sol (de noche) y fuera frío -> persiana arriba no supera el límite -> arriba', () => {
  const sol = { elevacion: -10, azimut: 248, nubesPct: 0 }; // de noche, Q_solar siempre 0
  const pronostico = Array.from({ length: 24 }, () => ({ tOut: 8, sol }));
  const estados = {
    A: { abierta: false, persianaArriba: false },
    B: { abierta: false, persianaArriba: false },
  };
  const r = recomendarPersiana('A', 22, pronostico, estados, piso);
  console.log(`    accion = ${r.accion} (${r.motivo})`);
  assert.equal(r.accion, 'arriba');
});

console.log(`\n${ok} casos OK\n`);

import test from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../ra/vision.js';
import { OrientationBuffer, createOneEuroQuat, AnchorTracker } from '../ra/tracking.js';
import { simulate } from './ra-jitter.mjs';

const DEG = Math.PI / 180;
const yawQ = deg => V.quatFromDeviceOrientation(deg, 90, 0, 0);
const yawOf = q => { const f = V.rotate(q, [0, 0, -1]); return Math.atan2(-f[0], -f[2]) / DEG; };

test('Buffer de orientación: interpola en el instante de captura', () => {
  const b = new OrientationBuffer();
  for (let t = 0; t <= 100; t += 20) b.push(t, yawQ(t / 10)); // 1° cada 10 ms
  assert.ok(Math.abs(yawOf(b.at(50)) - 5) < 1e-6);
  assert.ok(Math.abs(yawOf(b.at(500)) - 10) < 1e-6, 'no extrapola');
  b.push(90, yawQ(99)); assert.ok(Math.abs(yawOf(b.at(100)) - 10) < 1e-6, 'ignora muestras fuera de orden');
});

test('One Euro: suaviza el ruido en reposo y sigue un giro sin retardo apreciable', () => {
  let seed = 3; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
  const f = createOneEuroQuat(); let raw = 0, filtered = 0, n = 0;
  for (let t = 0; t < 2000; t += 16) { const y = r() * 0.2, q = f(yawQ(y), t); if (t > 500) { raw += y * y; filtered += yawOf(q) ** 2; n++; } }
  assert.ok(Math.sqrt(filtered / n) < 0.6 * Math.sqrt(raw / n), 'reduce el ruido en reposo');
  const g = createOneEuroQuat(); let last = 0;
  for (let t = 0; t <= 1000; t += 16) last = yawOf(g(yawQ(t / 1000 * 30), t)); // 30°/s
  assert.ok(Math.abs(last - 30) < 1.5, `retardo en movimiento: ${(30 - last).toFixed(2)}°`);
});

test('Anclaje: ignora el ruido y los saltos aislados, corrige de forma continua', () => {
  const tr = new AnchorTracker({ theta: -90 * DEG, rho: 2.4 });
  // Ruido pequeño: no se mueve (zona muerta).
  for (let i = 0; i < 6; i++) tr.observe({ theta: -90 * DEG + (i % 2 ? 0.1 : -0.1) * DEG, rho: 2.4 + (i % 2 ? 0.003 : -0.003) }, i * 150);
  for (let i = 0; i < 30; i++) tr.step(33);
  assert.ok(Math.abs(tr.line.rho - 2.4) < 1e-9);
  // Un salto aislado (borde del zócalo) no mueve la mediana.
  tr.observe({ theta: -90 * DEG, rho: 2.55 }, 1000); for (let i = 0; i < 30; i++) tr.step(33);
  assert.ok(Math.abs(tr.line.rho - 2.4) < 1e-9);
  // Desplazamiento real de 3 cm: converge sin saltos (< 4 mm por cuadro).
  let prev = tr.line.rho, maxStep = 0;
  for (let i = 0; i < 40; i++) { if (i % 4 === 0) tr.observe({ theta: -90 * DEG, rho: 2.43 }, 1200 + i * 37); tr.step(37); maxStep = Math.max(maxStep, Math.abs(tr.line.rho - prev)); prev = tr.line.rho; }
  assert.ok(Math.abs(tr.line.rho - 2.43) < 0.002, `converge: ${tr.line.rho}`);
  assert.ok(maxStep < 0.004, `paso máximo ${maxStep}`);
  assert.equal(tr.observe({ theta: -60 * DEG, rho: 2.4 }, 3000), false, 'otra pared no reemplaza a la fijada');
});

test('Anclaje sin piso visible: el detector de pared corrige la orientación girando sobre la mira', () => {
  const tr = new AnchorTracker({ theta: -90 * DEG, rho: 2.4 }), pivot = V.pointOnBase(tr.line, 0.3);
  for (let i = 0; i < 5; i++) tr.observeOrientation(-88.8 * DEG, i * 150, 0.3);
  for (let i = 0; i < 60; i++) tr.step(33);
  assert.ok(Math.abs(V.angleDiff(tr.line.theta, -88.8 * DEG)) < 0.02 * DEG);
  assert.ok(Math.abs(V.dot([Math.cos(tr.line.theta), 0, Math.sin(tr.line.theta)], pivot) - tr.line.rho) < 1e-9, 'el punto bajo la mira no se mueve');
});

test('Simulación: menos tiritón y menos desfase que el seguimiento anterior', () => {
  for (const sensorNoise of [0.03, 0.1, 0.2]) {
    const avg = p => { const r = [1, 2, 3].map(seed => simulate({ pipeline: p, sensorNoise, seed })); return { jit: r.reduce((s, x) => s + x.jitterRms, 0) / 3, p95: r.reduce((s, x) => s + x.errorP95, 0) / 3 }; };
    const old = avg('old'), nu = avg('new');
    assert.ok(nu.jit < 0.85 * old.jit, `tiritón ${nu.jit.toFixed(2)} vs ${old.jit.toFixed(2)} px (ruido ${sensorNoise}°)`);
    assert.ok(nu.p95 < 0.75 * old.p95, `error p95 ${nu.p95.toFixed(1)} vs ${old.p95.toFixed(1)} px`);
  }
});

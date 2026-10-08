import test from 'node:test';
import assert from 'node:assert/strict';
import * as V from '../ra/vision.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} != ${b} (±${eps})`);
const DEG = Math.PI / 180;

// Cámara sintética: teléfono vertical 390×844 CSS px, video 1080×1920.
function camera({ yaw = 0, pitch = 20, roll = 0, h = 1.4, focalFactor = 0.75 } = {}) {
  const k = V.intrinsicsFor(1080, 1920, 390, 844, focalFactor);
  return { ...k, h, q: V.quatFromDeviceOrientation(yaw, 90 - pitch, roll, 0) };
}
// Muro: encuentro a distancia rho, normal girada theta; inclinación lean (°, + = se aleja).
function wall({ rho = 2.5, thetaDeg = -90 + 12, lean = 0 } = {}) {
  const line = { theta: thetaDeg * DEG, rho }, f = V.lineFrame(line);
  const up = V.normalize(V.add(V.scale(V.UP, Math.cos(lean * DEG)), V.scale(f.toCamera, -Math.sin(lean * DEG))));
  return { line, f, up, at: (s, y) => V.add(V.add(V.pointOnBase(line, s), V.scale(up, y)), [0, 0, 0]) };
}
// Segmento proyectado y recortado al cuadro de la imagen (Liang–Barsky).
function seg(cam, A, B, contrast = 0) {
  const a = V.project(cam, A), b = V.project(cam, B);
  if (!a || !b) return null;
  let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0]], [dx, cam.width - a[0]], [-dy, a[1]], [dy, cam.height - a[1]]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const r = q / p; if (p < 0) { if (r > t1) return null; t0 = Math.max(t0, r); } else { if (r < t0) return null; t1 = Math.min(t1, r); }
  }
  const s = { x1: a[0] + t0 * dx, y1: a[1] + t0 * dy, x2: a[0] + t1 * dx, y2: a[1] + t1 * dy, contrast };
  return Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 2 ? s : null;
}
function scene(cam, w, { tiles = true, wallLines = true, noise = 0 } = {}) {
  const S = [], c = V.pixelToWall(cam, w.line, cam.cx, cam.cy).s; // centrado en lo que mira la cámara
  S.push(seg(cam, w.at(c - 2, 0), w.at(c - 0.1, 0), 0.35), seg(cam, w.at(c + 0.05, 0), w.at(c + 2, 0), 0.35)); // encuentro (con un corte)
  for (const s of [-0.45, 0.1, 0.5]) S.push(seg(cam, w.at(c + s, 0), w.at(c + s, 2.0), 0.15)); // marcos / esquinas verticales
  if (wallLines) for (const y of [0.35, 0.7, 1.05]) S.push(seg(cam, w.at(c - 2, y), w.at(c + 2, y), 0.03)); // juntas del muro (sin contraste de región)
  if (tiles) for (const back of [0.6, 1.2]) { // juntas de baldosas paralelas, más cerca
    const o = V.scale(w.f.toCamera, back); S.push(seg(cam, V.add(w.at(c - 2, 0), o), V.add(w.at(c + 2, 0), o), 0.04));
  }
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < noise; i++) { const x = rnd() * 390, y = rnd() * 844, a = rnd() * Math.PI; S.push({ x1: x, y1: y, x2: x + Math.cos(a) * 40, y2: y + Math.sin(a) * 40, contrast: rnd() * 0.1 }); }
  return S.filter(Boolean);
}

test('Orientación: teléfono vertical mira al horizonte; beta 70° inclina 20° hacia abajo', () => {
  const q = V.quatFromDeviceOrientation(0, 90, 0, 0);
  V.rotate(q, [0, 0, -1]).forEach((v, i) => near(v, [0, 0, -1][i], 1e-12));
  near(V.cameraPitch(V.quatFromDeviceOrientation(0, 70, 0, 0)), 20, 1e-9);
  near(V.cameraPitch(V.quatFromDeviceOrientation(0, 0, 0, 0)), 90, 1e-5, 'plano: mira al piso');
});

test('Proyección y retroproyección al piso son inversas', () => {
  const cam = camera({ yaw: 15, pitch: 30, roll: 4 });
  for (const P of [[0.3, 0, -1.2], [-1, 0, -3], [0.8, 0, -2.2]]) {
    const p = V.project(cam, P), Q = V.pixelToFloor(cam, p[0], p[1]);
    for (let i = 0; i < 3; i++) near(Q[i], P[i], 1e-9);
  }
});

test('Detecta el encuentro piso–muro entre juntas de muro y de piso', () => {
  for (const [pitch, yaw, thetaDeg, rho] of [[20, 0, -78, 2.5], [28, 20, -60, 1.8], [12, -10, -100, 3.4]]) {
    const cam = camera({ pitch, yaw }), w = wall({ rho, thetaDeg });
    const { base, second } = V.findWallBase(cam, scene(cam, w, { noise: 25 }));
    assert.ok(base, 'base detectada');
    near(base.rho, rho, rho * 0.005, 'distancia al muro');
    near(Math.abs(V.angleDiff(base.theta, thetaDeg * DEG)), 0, 0.3 * DEG, 'orientación');
    assert.ok(base.support >= 2, 'aristas verticales de apoyo');
    assert.equal(second, null);
  }
});

test('Con zócalo elige el borde inferior (encuentro real)', () => {
  const cam = camera({ pitch: 22 }), w = wall({ rho: 2.2 });
  const S = scene(cam, w, { tiles: false });
  S.push(seg(cam, w.at(-1.6, 0.09), w.at(1.6, 0.09), 0.35)); // borde superior del zócalo
  near(V.findWallBase(cam, S).base.rho, 2.2, 0.01);
});

test('Mide 90° en un muro a plomo y detecta desplomes', () => {
  for (const lean of [0, 3, -4]) {
    const cam = camera({ pitch: 18, yaw: 8 }), w = wall({ rho: 2.6, lean });
    const S = scene(cam, w);
    const det = V.findWallBase(cam, S, { verticalTolDeg: 6 });
    const vert = V.wallVerticalDirection(cam, det.base, S);
    assert.ok(vert && vert.used >= 3);
    const { angle, plumb } = V.floorWallAngle(det.base, vert.v);
    near(angle, 90 + lean, 0.25, `lean ${lean}`);
    near(plumb, Math.abs(lean), 0.25);
  }
});

test('Ángulo de esquina entre dos muros', () => {
  const a = { theta: -80 * DEG, rho: 2 }, b = { theta: 10 * DEG, rho: 1.5 };
  near(V.cornerAngle(a, b), 90, 1e-9);
  const P = V.lineIntersection(a, b);
  near(V.dot([Math.cos(a.theta), 0, Math.sin(a.theta)], P), 2, 1e-9);
  near(V.dot([Math.cos(b.theta), 0, Math.sin(b.theta)], P), 1.5, 1e-9);
});

test('Refina la focal con el punto de fuga vertical cuando el teléfono está inclinado', () => {
  const truth = camera({ pitch: 25, roll: 3, focalFactor: 0.82 }), w = wall({ rho: 2.4 });
  const S = scene(truth, w);
  for (const s of [-0.8, -0.4, 0.8]) { const g = seg(truth, w.at(s, 0.1), w.at(s, 1.9)); if (g) S.push(g); }
  const guess = { ...truth, f: truth.f * 0.75 / 0.82 };
  const r = V.estimateFocal(guess, S);
  assert.ok(r, 'estimación disponible');
  near(r.f, truth.f, truth.f * 0.01);
  assert.equal(V.estimateFocal(camera({ pitch: 3 }), S), null, 'mal condicionado con el teléfono a plomo');
});

test('Medición sobre el muro y el piso; calibración por medida conocida', () => {
  const cam = camera({ pitch: 15, yaw: -5 }), w = wall({ rho: 2.8, thetaDeg: -95 });
  const pA = V.project(cam, w.at(-1.1, 0)), pB = V.project(cam, w.at(1.3, 0)), pC = V.project(cam, w.at(0.2, 2.25));
  const A = V.pixelToWall(cam, w.line, ...pA), B = V.pixelToWall(cam, w.line, ...pB), C = V.pixelToWall(cam, w.line, ...pC);
  near(B.s - A.s, 2.4, 1e-6, 'ancho'); near(C.y, 2.25, 1e-6, 'alto');
  const sq = [[-0.5, 0, -1.5], [0.5, 0, -1.5], [0.5, 0, -2.5], [-0.5, 0, -2.5]].map(P => V.pixelToFloor(cam, ...V.project(cam, P)));
  near(V.polygonAreaXZ(sq), 1, 1e-6, 'área de piso');
  // Si el teléfono estaba a 1,50 m y se supuso 1,40, la calibración lo corrige.
  const wrong = { ...cam, h: 1.4 }, real = { ...cam, h: 1.5 };
  const P1 = V.project(real, [-0.5, 0, -2]), P2 = V.project(real, [0.5, 0, -2]);
  const measured = V.distance3(V.pixelToFloor(wrong, ...P1), V.pixelToFloor(wrong, ...P2));
  near(V.calibratedHeight(1.4, measured, 1), 1.5, 1e-9);
});

test('Pose del muro virtual: base sobre el encuentro, cara hacia el usuario', () => {
  const line = { theta: -70 * DEG, rho: 2 }, m = V.wallMatrix(line, 0.5, 0, 0);
  const O = [m[12], m[13], m[14]], Z = [m[8], m[9], m[10]], X = [m[0], m[1], m[2]];
  near(O[1], 0, 1e-12); near(V.dot([Math.cos(line.theta), 0, Math.sin(line.theta)], O), 2, 1e-12);
  assert.ok(V.dot(Z, V.sub([0, 1.4, 0], O)) > 0, 'la cara frontal mira a la cámara');
  near(V.dot(V.cross(X, [0, 1, 0]), Z), 1, 1e-12, 'base derecha');
  near(V.alongCoordinate(line, O), 0.5, 1e-12);
});

test('Seguimiento: estabilidad y mezcla de detecciones compatibles', () => {
  const l = { theta: -1.4, rho: 2 };
  assert.equal(V.isStable([l, l, l, l, l]), false);
  assert.equal(V.isStable([l, l, l, l, l, { theta: -1.41, rho: 2.03 }]), true);
  assert.equal(V.blendLine(l, { theta: -1.4, rho: 3 }).accepted, false);
  near(V.blendLine(l, { theta: -1.4, rho: 2.1 }, 0.5).line.rho, 2.05, 1e-12);
});

test('Zócalo recordado: el borde superior se corrige a la distancia del encuentro', () => {
  const prev = { theta: -1.4, rho: 2.4 }, z = 0.08, h = 1.4, top = { theta: -1.4, rho: 2.4 / (1 - z / h) };
  near(V.correctForBaseboard(top, z, h, prev).rho, 2.4, 1e-9);
  assert.equal(V.correctForBaseboard({ theta: -1.4, rho: 3.2 }, z, h, prev).rho, 3.2, 'otra línea no se toca');
});

test('Sensor de orientación (cuaternión) equivale a DeviceOrientationEvent', () => {
  const qz = a => V.quatFromAxisAngle([0, 0, 1], a * DEG), qx = a => V.quatFromAxisAngle([1, 0, 0], a * DEG), qy = a => V.quatFromAxisAngle([0, 1, 0], a * DEG);
  for (const [al, be, ga, sc] of [[0, 90, 0, 0], [37, 72, -8, 0], [-120, 95, 12, 90], [200, 40, 30, -90]]) {
    const qs = V.quatMultiply(V.quatMultiply(qz(al), qx(be)), qy(ga)); // W3C: Z-X'-Y''
    near(V.quatAngle(V.quatFromSensor(qs, sc), V.quatFromDeviceOrientation(al, be, ga, sc)), 0, 1e-6, `${al},${be},${ga}`);
  }
});

test('Detector de pared: las líneas horizontales del muro dan su orientación sin el piso', () => {
  for (const [pitch, yaw, thetaDeg] of [[18, 0, -78], [25, 15, -62], [10, -10, -100]]) {
    const cam = camera({ pitch, yaw }), w = wall({ rho: 2.5, thetaDeg });
    const S = scene(cam, w, { noise: 20 }); // incluye juntas de piso paralelas y aristas verticales
    // Se parte de una línea con 3° de error: el detector de pared la corrige.
    const wrong = { theta: w.line.theta + 3 * DEG, rho: w.line.rho };
    const o = V.wallOrientation(cam, wrong, S);
    assert.ok(o && o.count >= 2, 'líneas del muro');
    near(V.angleDiff(o.theta, w.line.theta), 0, 0.15 * DEG, 'orientación del muro');
  }
});

test('Fusión: el encuentro ruidoso mejora con la orientación del muro; si discrepan, manda el encuentro', () => {
  const cam = camera({ pitch: 20 }), w = wall({ rho: 2.4, thetaDeg: -82 }), S = scene(cam, w);
  const noisy = { theta: w.line.theta + 1.2 * DEG, rho: 2.43, sigmaTheta: 1 * DEG, extent: { min: -1, max: 1 } };
  const fused = V.fuseOrientation(cam, noisy, V.wallOrientation(cam, noisy, S));
  assert.ok(fused.wallConfirmed);
  assert.ok(Math.abs(V.angleDiff(fused.theta, w.line.theta)) < 0.3 * DEG, 'orientación corregida');
  // El punto del encuentro bajo la mira no se mueve.
  const before = V.pixelToWall(cam, noisy, cam.cx, cam.cy), P = V.pointOnBase(noisy, before.s);
  near(V.dot([Math.cos(fused.theta), 0, Math.sin(fused.theta)], P), fused.rho, 1e-9);
  const conflict = V.fuseOrientation(cam, noisy, { theta: w.line.theta + 12 * DEG, uncertainty: 0.2, count: 5 });
  assert.equal(conflict.theta, noisy.theta); assert.ok(conflict.wallConflict);
});

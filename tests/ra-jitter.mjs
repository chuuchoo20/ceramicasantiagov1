// Simulación del «tiritón» de la muralla proyectada: compara el seguimiento
// anterior con el nuevo (ra/tracking.js) en las mismas condiciones.
//   node tests/ra-jitter.mjs
// Modelo: teléfono en la mano (balanceo lento + temblor 8–10 Hz + deriva de
// la mano de ±1 cm), sensor a 60 Hz con ruido y deriva de rumbo, video a 30
// cuadros/s con 90 ms de latencia, detecciones con ruido y 10 % de errores
// (borde superior del zócalo). Métrica: distancia en pantalla entre un punto
// de la muralla proyectada y el mismo punto de la pared real en el video.
import * as V from '../ra/vision.js';
import { OrientationBuffer, createOneEuroQuat, AnchorTracker } from '../ra/tracking.js';

const DEG = Math.PI / 180, H = 1.4, RHO0 = 2.4, THETA0 = -88 * DEG;
const K = V.intrinsicsFor(1080, 1920, 390, 844, 0.75);
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }

export function simulate({ pipeline = 'new', orient = pipeline, anchorMode = pipeline, seconds = 12, latency = 90, assumedLatency = null, seed = 7, euroOpts = {}, pan = true, tremor = 0.15, sensorNoise = 0.03, detNoise = 1 } = {}) {
  const r = rng(seed);
  // Movimiento real (en el marco del mundo inercial).
  // Incluye un paneo de 8° (el usuario recorre la pared con la vista) entre 5 y 6 s.
  const panAt = t => !pan ? 0 : t < 5 ? 0 : t > 6 ? 8 : 8 * (1 - Math.cos(Math.PI * (t - 5))) / 2;
  const yaw = t => panAt(t) + 0.6 * Math.sin(2 * Math.PI * 0.25 * t) + 0.15 * Math.sin(2 * Math.PI * 1.1 * t + 1) + tremor * Math.sin(2 * Math.PI * 9.3 * t);
  const pitch = t => 20 + 0.5 * Math.sin(2 * Math.PI * 0.3 * t + 1) + tremor * 0.8 * Math.sin(2 * Math.PI * 8.1 * t);
  const roll = t => 0.4 * Math.sin(2 * Math.PI * 0.21 * t) + 0.05 * Math.sin(2 * Math.PI * 10.2 * t + 2);
  const pos = t => [0.010 * Math.sin(2 * Math.PI * 0.2 * t), 0, 0.008 * Math.sin(2 * Math.PI * 0.17 * t + 0.5)];
  const drift = t => 0.5 / 60 * t; // ° de rumbo por segundo (deriva del giroscopio)
  const qTrue = t => V.quatFromDeviceOrientation(yaw(t), 90 - pitch(t), roll(t), 0);
  // El sensor mide en un marco que deriva en rumbo.
  const qSensorExact = t => V.quatFromDeviceOrientation(yaw(t) + drift(t), 90 - pitch(t), roll(t), 0);
  // Pared real en el marco del modelo (cámara en el origen, marco del sensor) en el instante t.
  const lineModel = t => { const th = THETA0 + drift(t) * DEG, m = [Math.cos(THETA0), 0, Math.sin(THETA0)]; return { theta: th, rho: RHO0 - V.dot(m, pos(t)) }; };
  // Punto físico de referencia sobre la pared (en el mundo inercial).
  const lineWorld = { theta: THETA0, rho: RHO0 }, sRef = 0.4, yRef = 1.0;
  const Pphys = V.add(V.pointOnBase(lineWorld, sRef), [0, yRef, 0]);

  const buf = new OrientationBuffer(), euro = createOneEuroQuat(euroOpts);
  let qOld = null, anchor = null, tracker = null, sOv = sRef, lastDet = -1, lastFrame = -1, q = null, tPrevFrame = 0;
  const detEvery = anchorMode === 'new' ? 150 : 300, errors = [];
  const tFix = 1000;
  for (let t = 0; t < seconds * 1000; t += 1000 / 60) { // refresco de pantalla 60 Hz
    // Sensor a 60 Hz con ruido (0,03°) desfasado del refresco.
    const ts = t - 3; const n = () => gauss(r) * sensorNoise;
    buf.push(ts, V.quatFromDeviceOrientation(yaw(ts / 1000) + drift(ts / 1000) + n(), 90 - pitch(ts / 1000) + n(), roll(ts / 1000) + n(), 0));
    // Cuadro de video visible: capturado en el múltiplo de 33,3 ms anterior a t - latencia.
    const tCap = Math.floor((t - latency) / (1000 / 30)) * (1000 / 30);
    if (tCap < 0) continue;
    const newFrame = tCap !== lastFrame;
    // Orientación usada para dibujar.
    if (orient === 'old') {
      const target = buf.latest().q;
      qOld = !qOld || V.quatAngle(qOld, target) > 0.35 ? target : V.quatSlerp(qOld, target, 0.45); q = qOld;
    } else if (newFrame) {
      const tq = assumedLatency === null ? tCap : t - assumedLatency; // con captureTime o con latencia estimada
      q = euro(buf.at(tq), tq);
    }
    // Detección (con la imagen capturada) y anclaje.
    if (t >= tFix && !anchor) { anchor = lineModel(tCap / 1000); tracker = new AnchorTracker(anchor); }
    if (anchor && t - lastDet >= detEvery) {
      lastDet = t; const truth = lineModel(tCap / 1000);
      let obs = { theta: truth.theta + gauss(r) * 0.35 * DEG * detNoise, rho: truth.rho * (1 + gauss(r) * 0.005 * detNoise) };
      if (r() < 0.1) obs = { ...obs, rho: obs.rho / (1 - 0.08 / H) }; // a veces el borde del zócalo
      if (anchorMode === 'old') { const b = V.blendLine(anchor, obs, 0.15); if (b.accepted) anchor = b.line; }
      else tracker.observe(obs, t);
    }
    if (anchorMode === 'new' && tracker && newFrame) { anchor = tracker.step(tCap - tPrevFrame); }
    if (newFrame) { tPrevFrame = tCap; lastFrame = tCap; }
    if (!anchor || t < tFix + 1500) continue;
    // Error en pantalla: muralla dibujada vs pared en el video.
    const camOv = { ...K, h: H, q }, Pov = V.add(V.pointOnBase(anchor, sOv), [0, yRef, 0]);
    const camTrue = { ...K, h: H, q: qTrue(tCap / 1000) }, p = pos(tCap / 1000);
    const a = V.project(camOv, Pov), b = V.project(camTrue, V.sub(Pphys, p));
    if (a && b) errors.push({ t, e: [a[0] - b[0], a[1] - b[1]] });
  }
  // Tiritón = componente rápida del error (lo que se ve temblar); se separa
  // de la deriva lenta con una media móvil de 0,5 s.
  const win = 15, jit = [];
  for (let i = win; i < errors.length - win; i++) {
    const m = [0, 0]; for (let j = i - win; j <= i + win; j++) { m[0] += errors[j].e[0]; m[1] += errors[j].e[1]; }
    jit.push(Math.hypot(errors[i].e[0] - m[0] / (2 * win + 1), errors[i].e[1] - m[1] / (2 * win + 1)));
  }
  const rms = a => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length), p95 = a => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)];
  const mag = errors.map(x => Math.hypot(...x.e));
  return { jitterRms: rms(jit), jitterP95: p95(jit), errorMean: mag.reduce((s, v) => s + v, 0) / mag.length, errorP95: p95(mag) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fmt = r => `tiritón ${r.jitterRms.toFixed(2)} px (p95 ${r.jitterP95.toFixed(2)}) · error ${r.errorMean.toFixed(1)} px (p95 ${r.errorP95.toFixed(1)})`;
  const avg = (opts) => { const runs = [1, 2, 3, 4, 5, 6].map(seed => simulate({ ...opts, seed })), k = Object.keys(runs[0]); return Object.fromEntries(k.map(x => [x, runs.reduce((s, r) => s + r[x], 0) / runs.length])); };
  for (const sensorNoise of [0.03, 0.1, 0.2]) {
    console.log(`Ruido del sensor ${sensorNoise}°`);
    console.log('  anterior                          ', fmt(avg({ pipeline: 'old', sensorNoise })));
    console.log('  nuevo (captureTime del video)     ', fmt(avg({ pipeline: 'new', sensorNoise })));
    console.log('  nuevo (latencia estimada 70 ms)   ', fmt(avg({ pipeline: 'new', sensorNoise, assumedLatency: 70 })));
  }
}

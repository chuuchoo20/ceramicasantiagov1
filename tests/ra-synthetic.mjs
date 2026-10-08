// Validación de punta a punta del detector con habitaciones sintéticas.
//   node tests/ra-synthetic.mjs cases  > tmp/ra-cases.json
//   python3 tests/ra_pipeline.py tmp/ra-cases.json tmp/ra-segments.json tmp/ra-renders
//   node tests/ra-synthetic.mjs evaluate tmp/ra-cases.json tmp/ra-segments.json
// El script de Python renderiza cada habitación con la misma cámara y ejecuta
// el MISMO pipeline de ra/detector.js con OpenCV nativo (Canny + HoughLinesP).
import { readFileSync } from 'node:fs';
import * as V from '../ra/vision.js';
const DEG = Math.PI / 180;

const CASES = [
  { name: 'muro liso, piso de baldosas, de frente', pitch: 22, yaw: 0, roll: 1, h: 1.40, rho: 2.4, thetaDeg: -90, floor: 'tiles', wall: 'paint', baseboard: false, door: true },
  { name: 'muro liso con zócalo, piso de madera, oblicuo', pitch: 25, yaw: 18, roll: -2, h: 1.35, rho: 2.0, thetaDeg: -66, floor: 'wood', wall: 'paint', baseboard: true, door: true },
  { name: 'muro de ladrillo existente, piso de cemento', pitch: 18, yaw: -8, roll: 0, h: 1.45, rho: 2.9, thetaDeg: -100, floor: 'concrete', wall: 'brick', baseboard: false, door: false },
  { name: 'muro desplomado 3°, piso de baldosas', pitch: 20, yaw: 6, roll: 2, h: 1.40, rho: 2.6, thetaDeg: -84, floor: 'tiles', wall: 'paint', baseboard: false, door: true, lean: 3 },
  { name: 'poca luz, de cerca', pitch: 30, yaw: -12, roll: 0, h: 1.30, rho: 1.5, thetaDeg: -102, floor: 'tiles', wall: 'paint', baseboard: true, door: false, light: 0.55 },
  { name: 'muro desplomado +3° (se aleja), dos marcos visibles', pitch: 20, yaw: 0, roll: 0, h: 1.40, rho: 3.0, thetaDeg: -90, floor: 'tiles', wall: 'paint', baseboard: false, door: true, lean: 3 },
  { name: 'muro desplomado −2° (se acerca), dos marcos visibles', pitch: 16, yaw: 3, roll: 1, h: 1.45, rho: 2.8, thetaDeg: -92, floor: 'concrete', wall: 'paint', baseboard: true, door: true, lean: -2 },
  { name: 'esquina de 90° (dos muros)', pitch: 22, yaw: -18, roll: 0, h: 1.40, rho: 2.3, thetaDeg: -90, floor: 'wood', wall: 'paint', baseboard: false, door: false, corner: { thetaDeg: 0, rho: 0.9 } }
];

function camera(c) {
  return { ...V.intrinsicsFor(1080, 1920, 390, 844), h: c.h, q: V.quatFromDeviceOrientation(c.yaw, 90 - c.pitch, c.roll, 0) };
}

const [, , cmd, a, b] = process.argv;
if (cmd === 'cases') {
  console.log(JSON.stringify(CASES.map(c => ({ ...c, cam: camera(c), line: { theta: c.thetaDeg * DEG, rho: c.rho }, corner: c.corner ? { theta: c.corner.thetaDeg * DEG, rho: c.corner.rho } : null }))));
} else if (cmd === 'evaluate') {
  const cases = JSON.parse(readFileSync(a, 'utf8')), results = JSON.parse(readFileSync(b, 'utf8'));
  let failures = 0;
  for (const [i, c] of cases.entries()) {
    const cam = c.cam, segs = results[i].segments;
    const det = V.findWallBase(cam, segs);
    const base = det.base;
    const sq = base ? V.squareness(cam, base, segs) : null, ang = sq?.measured ? sq : null;
    const errRho = base ? (base.rho - c.rho) / c.rho * 100 : NaN, errTheta = base ? V.angleDiff(base.theta, c.line.theta) / DEG : NaN;
    const expectAngle = 90 + (c.lean || 0);
    const truthLine = c.corner && Math.abs(V.angleDiff(base?.theta ?? 0, c.corner.theta)) < 0.2 ? c.corner : c.line; // en esquina vale cualquiera de los dos muros
    const ok = base && Math.abs((base.rho - truthLine.rho) / truthLine.rho * 100) < 3 && Math.abs(V.angleDiff(base.theta, truthLine.theta) / DEG) < 2 && (!ang || Math.abs(ang.angle - expectAngle) < 1.5);
    let cornerText = '';
    if (c.corner) {
      const other = det.second; const ca = other ? V.cornerAngle(base, other) : null;
      cornerText = ` · esquina ${ca ? ca.toFixed(1) + '°' : 'no detectada'}`;
    }
    // Detector de pared (independiente del piso): parte de una línea con 3° de error.
    const wrong = base ? { ...base, theta: base.theta + 3 * DEG } : null, wo = wrong ? V.wallOrientation(cam, wrong, segs) : null;
    const fused = base ? V.fuseOrientation(cam, base, base ? V.wallOrientation(cam, base, segs) : null) : null;
    const wallText = wo ? `muro ${wo.count} líneas, ${(V.angleDiff(wo.theta, truthLine.theta) / DEG).toFixed(2)}° ±${wo.uncertainty.toFixed(2)} · fusión ${(V.angleDiff(fused.theta, truthLine.theta) / DEG).toFixed(2)}°` : 'muro sin líneas horizontales';
    const wallOk = !wo || Math.abs(V.angleDiff(wo.theta, truthLine.theta) / DEG) < Math.max(1, 3 * wo.uncertainty);
    if (!wallOk) failures++;
    cornerText += ` · ${wallOk ? '' : 'FALLA '}${wallText}`;
    if (!ok) failures++;
    console.log(`${ok ? 'OK  ' : 'FALLA'} ${c.name}: ${segs.length} segmentos · distancia ${base ? base.rho.toFixed(3) : '—'} m (real ${c.rho}, ${errRho.toFixed(2)} %) · orientación ${errTheta.toFixed(2)}° · ángulo piso–muro ${ang ? ang.angle.toFixed(2) + '° ±' + ang.uncertainty.toFixed(2) : 'no observable' + (sq?.uncertainty ? ' (±' + sq.uncertainty.toFixed(1) + '°)' : '')} (real ${expectAngle}°) · confianza ${base ? base.confidence.toFixed(2) : 0}${cornerText}`);
  }
  process.exitCode = failures ? 1 : 0;
}

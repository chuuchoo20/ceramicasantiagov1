// =====================================================================
// RA · Núcleo geométrico (sin DOM, sin OpenCV, sin Three.js).
//
// Convenciones
//  - Mundo: metros, eje Y hacia arriba, piso en y = 0.
//  - Cámara: en C = (0, h, 0). Mira hacia su -Z local; +Y local es el borde
//    superior de la pantalla y +X local el borde derecho (igual que Three.js).
//  - Imagen: píxeles CSS de la vista, origen arriba-izquierda, v hacia abajo.
//  - q: cuaternión [x, y, z, w] mundo←cámara, obtenido de los sensores.
//
// Idea central: los sensores entregan la gravedad, por lo tanto la
// orientación del piso respecto de la cámara. Con la altura del teléfono h
// cada píxel que mira hacia abajo se convierte en un punto métrico del piso.
// OpenCV entrega segmentos rectos; aquí se proyectan al plano del piso y se
// agrupan con una transformada de Hough métrica (θ, ρ), donde ρ es la
// distancia perpendicular desde los pies del usuario hasta la línea.
// La unión piso–muro es la línea con más evidencia; las aristas verticales
// del muro permiten medir el ángulo real piso–muro (≈ 90°).
// =====================================================================

export const UP = [0, 1, 0];
const DEG = Math.PI / 180;

// ---------- vectores y cuaterniones --------------------------------------
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = a => Math.hypot(a[0], a[1], a[2]);
export const normalize = a => { const n = norm(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function quatMultiply(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [ax * bw + aw * bx + ay * bz - az * by, ay * bw + aw * by + az * bx - ax * bz, az * bw + aw * bz + ax * by - ay * bx, aw * bw - ax * bx - ay * by - az * bz];
}
export const quatConjugate = q => [-q[0], -q[1], -q[2], q[3]];
export function quatNormalize(q) { const n = Math.hypot(...q) || 1; return q.map(v => v / n); }
export function quatFromAxisAngle(axis, angle) { const s = Math.sin(angle / 2), a = normalize(axis); return [a[0] * s, a[1] * s, a[2] * s, Math.cos(angle / 2)]; }
export function rotate(q, v) {
  // v' = q v q*
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz, iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
export function quatSlerp(a, b, t) {
  let [bx, by, bz, bw] = b, c = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (c < 0) { c = -c; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  if (c > 0.9995) return quatNormalize([a[0] + t * (bx - a[0]), a[1] + t * (by - a[1]), a[2] + t * (bz - a[2]), a[3] + t * (bw - a[3])]);
  const th = Math.acos(c), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return [a[0] * wa + bx * wb, a[1] * wa + by * wb, a[2] * wa + bz * wb, a[3] * wa + bw * wb];
}
export function quatAngle(a, b) { return 2 * Math.acos(clamp(Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]), 0, 1)); }

// Euler YXZ → cuaternión, idéntico a THREE.Quaternion.setFromEuler.
function quatFromEulerYXZ(x, y, z) {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2), s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 - s1 * s2 * c3, c1 * c2 * c3 + s1 * s2 * s3];
}
const Q_WORLD = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2]; // -90° en X: tierra Z-arriba → Y-arriba

// DeviceOrientationEvent (grados) + ángulo de pantalla → cuaternión de cámara.
// Teléfono vertical mirando al horizonte: beta = 90° → identidad.
export function quatFromDeviceOrientation(alpha = 0, beta = 90, gamma = 0, screenAngle = 0) {
  let q = quatFromEulerYXZ(beta * DEG, alpha * DEG, -gamma * DEG);
  q = quatMultiply(q, Q_WORLD);
  return quatNormalize(quatMultiply(q, quatFromAxisAngle([0, 0, 1], -screenAngle * DEG)));
}
// Cuaternión de RelativeOrientationSensor (marco del dispositivo, mundo Z
// arriba, como DeviceOrientationEvent) → cámara. Es la misma rotación que
// quatFromDeviceOrientation, pero sin pasar por ángulos de Euler (que son
// singulares justo con el teléfono vertical) y a mayor frecuencia.
export function quatFromSensor(qs, screenAngle = 0) {
  return quatNormalize(quatMultiply(quatMultiply(Q_WORLD, qs), quatFromAxisAngle([0, 0, 1], -screenAngle * DEG)));
}
// Inclinación de la cámara (positiva = mira hacia abajo) en grados.
export function cameraPitch(q) { const f = rotate(q, [0, 0, -1]); return -Math.asin(clamp(f[1], -1, 1)) / DEG; }

// ---------- cámara -----------------------------------------------------
// Las cámaras principales de teléfonos rondan 26 mm equivalentes: f ≈ 0,75 ×
// lado largo del sensor. El video se muestra con object-fit: cover.
export function intrinsicsFor(videoW, videoH, viewW, viewH, focalFactor = 0.75) {
  const s = Math.max(viewW / videoW, viewH / videoH);
  return { f: focalFactor * Math.max(videoW, videoH) * s, cx: viewW / 2, cy: viewH / 2, width: viewW, height: viewH };
}
export function verticalFov(cam) { return 2 * Math.atan(cam.height / 2 / cam.f) / DEG; }
export function cameraCenter(cam) { return [0, cam.h, 0]; }
export function pixelRay(cam, u, v) { return normalize(rotate(cam.q, [(u - cam.cx) / cam.f, -(v - cam.cy) / cam.f, -1])); }
export function project(cam, P) {
  const d = rotate(quatConjugate(cam.q), sub(P, cameraCenter(cam)));
  if (d[2] > -1e-6) return null; // detrás de la cámara
  return [cam.cx + cam.f * d[0] / -d[2], cam.cy - cam.f * d[1] / -d[2]];
}
export function rayFloor(cam, r, maxDistance = 30) {
  if (r[1] > -1e-4) return null;
  const t = -cam.h / r[1], P = add(cameraCenter(cam), scale(r, t));
  return Math.hypot(P[0], P[2]) <= maxDistance ? P : null;
}
export function pixelToFloor(cam, u, v) { return rayFloor(cam, pixelRay(cam, u, v)); }
// Altura en píxeles del horizonte en la columna central (para guías de UI).
export function horizonY(cam) {
  const P = add(cameraCenter(cam), scale(normalize([rotate(cam.q, [0, 0, -1])[0], 0, rotate(cam.q, [0, 0, -1])[2]]), 1000));
  return project(cam, P)?.[1] ?? null;
}

// ---------- línea en el piso: forma normal (θ, ρ) ------------------------
// m = (cos θ, 0, sin θ) es la normal horizontal; la línea es m·P = ρ ≥ 0.
// ρ es la distancia desde los pies del usuario hasta el encuentro piso–muro.
export function floorLineFromPoints(P1, P2) {
  let d = normalize([P2[0] - P1[0], 0, P2[2] - P1[2]]), m = [-d[2], 0, d[0]], rho = dot(m, P1);
  if (rho < 0) { m = scale(m, -1); rho = -rho; }
  return { theta: Math.atan2(m[2], m[0]), rho };
}
export function lineFrame(line) {
  const m = [Math.cos(line.theta), 0, Math.sin(line.theta)];
  const toCamera = scale(m, -1);            // horizontal, desde el muro hacia el usuario
  const along = normalize(cross(UP, toCamera)); // "derecha" mirando el muro
  const foot = scale(m, line.rho);           // punto del encuentro frente a los pies
  return { m, toCamera, along, foot };
}
export function angleDiff(a, b) { let d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; }
export function pointOnBase(line, s) { const f = lineFrame(line); return add(f.foot, scale(f.along, s)); }
export function alongCoordinate(line, P) { const f = lineFrame(line); return dot(sub(P, f.foot), f.along); }

// Intersección de un píxel con el plano vertical del muro: (s, y) en metros.
export function pixelToWall(cam, line, u, v) {
  const f = lineFrame(line), r = pixelRay(cam, u, v), C = cameraCenter(cam), denom = dot(f.m, r);
  if (denom < 1e-5) return null; // el rayo no avanza hacia el muro
  const t = (line.rho - dot(f.m, C)) / denom;
  if (t <= 0 || t > 60) return null;
  const P = add(C, scale(r, t));
  return { s: dot(sub(P, f.foot), f.along), y: P[1], point: P };
}

// ---------- clasificación de segmentos ---------------------------------
// seg = {x1,y1,x2,y2, contrast?}. El plano de interpretación de un segmento
// contiene el centro óptico y la recta 3D. Si contiene el vector vertical,
// la recta 3D es vertical (o pasa bajo la cámara, caso degenerado).
export function interpretationNormal(cam, s) { return normalize(cross(pixelRay(cam, s.x1, s.y1), pixelRay(cam, s.x2, s.y2))); }
export function segLength(s) { return Math.hypot(s.x2 - s.x1, s.y2 - s.y1); }
// Bordes de la imagen: el recorte y el desenfoque generan aristas falsas.
export function onBorder(cam, s, m = 4) {
  return (s.x1 < m && s.x2 < m) || (s.x1 > cam.width - m && s.x2 > cam.width - m) || (s.y1 < m && s.y2 < m) || (s.y1 > cam.height - m && s.y2 > cam.height - m);
}

export function analyzeSegments(cam, segments, opts = {}) {
  const verticalTol = Math.sin((opts.verticalTolDeg ?? 6) * DEG), minLen = opts.minLength ?? Math.max(18, cam.width * 0.06);
  const vertical = [], floor = [];
  for (const s of segments) {
    const L = segLength(s); if (L < minLen || onBorder(cam, s)) continue;
    const n = interpretationNormal(cam, s), nUp = Math.abs(n[1]);
    if (nUp < verticalTol) { vertical.push({ ...s, L, n }); continue; }
    const P1 = pixelToFloor(cam, s.x1, s.y1), P2 = pixelToFloor(cam, s.x2, s.y2);
    if (!P1 || !P2) continue;
    const d1 = Math.hypot(P1[0], P1[2]), d2 = Math.hypot(P2[0], P2[2]);
    if (Math.min(d1, d2) < (opts.minDistance ?? 0.3) || Math.max(d1, d2) > (opts.maxDistance ?? 12)) continue;
    const line = floorLineFromPoints(P1, P2);
    if (line.rho < (opts.minWallDistance ?? 0.6)) continue; // demasiado cerca o línea radial
    // Líneas que se alejan del usuario (juntas radiales del piso) no son un encuentro frontal.
    const mid = [(P1[0] + P2[0]) / 2, 0, (P1[2] + P2[2]) / 2], dir = normalize([P2[0] - P1[0], 0, P2[2] - P1[2]]);
    if (Math.abs(dot(dir, normalize(mid))) > Math.cos((opts.radialDeg ?? 15) * DEG)) continue;
    floor.push({ ...s, L, n, P1, P2, ...line });
  }
  return { vertical, floor };
}

// ---------- detección del encuentro piso–muro (Hough métrico) ------------
export function clusterFloorLines(floor, opts = {}) {
  const thetaTol = (opts.thetaTolDeg ?? 4) * DEG, clusters = [];
  for (const s of [...floor].sort((a, b) => b.L - a.L)) {
    const rhoTol = Math.max(0.06, 0.045 * s.rho);
    let best = null;
    for (const c of clusters) {
      const dt = Math.abs(angleDiff(s.theta, c.theta)), dr = Math.abs(s.rho - c.rho);
      if (dt < thetaTol && dr < rhoTol && (!best || dr < Math.abs(s.rho - best.rho))) best = c;
    }
    const w = s.L * (0.6 + (s.contrast ?? 0));
    if (!best) { clusters.push({ theta: s.theta, rho: s.rho, weight: w, segs: [s] }); continue; }
    best.segs.push(s);
    // media circular ponderada para θ, media ponderada para ρ
    const tw = best.weight + w; best.theta = best.theta + angleDiff(s.theta, best.theta) * w / tw; best.rho = (best.rho * best.weight + s.rho * w) / tw; best.weight = tw;
  }
  return clusters;
}

// Ajuste por mínimos cuadrados totales de los extremos (en el piso).
export function refitLine(segs) {
  let sw = 0, mx = 0, mz = 0;
  const pts = [];
  for (const s of segs) for (const P of [s.P1, s.P2]) { const w = s.L; pts.push([P[0], P[2], w]); sw += w; mx += P[0] * w; mz += P[2] * w; }
  mx /= sw; mz /= sw;
  let sxx = 0, szz = 0, sxz = 0;
  for (const [x, z, w] of pts) { sxx += w * (x - mx) ** 2; szz += w * (z - mz) ** 2; sxz += w * (x - mx) * (z - mz); }
  const phi = 0.5 * Math.atan2(2 * sxz, sxx - szz), d = [Math.cos(phi), 0, Math.sin(phi)];
  return floorLineFromPoints([mx, 0, mz], [mx + d[0], 0, mz + d[2]]);
}

function lineExtent(line, segs) {
  let min = Infinity, max = -Infinity;
  for (const s of segs) for (const P of [s.P1, s.P2]) { const a = alongCoordinate(line, P); min = Math.min(min, a); max = Math.max(max, a); }
  return { min, max };
}

// Distancia en píxeles entre la proyección de una línea del piso y un punto de la imagen.
export function lineDistanceToPoint(cam, line, p) {
  const f = lineFrame(line), center = pixelToWall(cam, line, p[0], p[1]);
  const s0 = center ? center.s : 0, a = project(cam, add(f.foot, scale(f.along, s0 - 0.5))), b = project(cam, add(f.foot, scale(f.along, s0 + 0.5)));
  if (!a || !b) return Infinity;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return Math.abs(dx * (a[1] - p[1]) - dy * (a[0] - p[0])) / (Math.hypot(dx, dy) || 1);
}
// Incertidumbre (rad) de la orientación del encuentro: dispersión de los
// extremos respecto de la recta ajustada (mínimo: ~0,7 px proyectado al piso)
// dividida por el largo visible. Un tramo corto orienta mal.
export function junctionSigma(cam, line, segs, ext = lineExtent(line, segs)) {
  const m = [Math.cos(line.theta), 0, Math.sin(line.theta)];
  let r2 = 0, n = 0;
  for (const s of segs) for (const P of [s.P1, s.P2]) { r2 += (dot(m, P) - line.rho) ** 2; n++; }
  const pixelNoise = 0.7 * (cam.h ** 2 + line.rho ** 2) / (cam.h * cam.f);
  const sigmaP = Math.max(Math.sqrt(r2 / Math.max(1, n)), pixelNoise), span = Math.max(0.05, ext.max - ext.min);
  return Math.max(0.05 * DEG, sigmaP * Math.sqrt(12) / (span * Math.sqrt(Math.max(1, n / 2))));
}
export function verticalSupport(cam, line, vertical) {
  // Aristas verticales (marcos, esquinas) que nacen sobre el encuentro.
  let count = 0;
  for (const s of vertical) {
    const low = s.y1 > s.y2 ? [s.x1, s.y1] : [s.x2, s.y2];
    const P = pixelToFloor(cam, low[0], low[1]); if (!P) continue;
    if (Math.abs(dot([Math.cos(line.theta), 0, Math.sin(line.theta)], P) - line.rho) < Math.max(0.12, 0.06 * line.rho)) count++;
  }
  return count;
}

export function findWallBase(cam, segments, opts = {}) {
  const { vertical, floor } = analyzeSegments(cam, segments, opts);
  const clusters = clusterFloorLines(floor, opts), aim = opts.aim ?? [cam.cx, cam.cy];
  if (!clusters.length) return { base: null, vertical, floor, candidates: [] };
  const candidates = clusters.map(c => {
    // Rechazo de atípicos respecto de la línea dominante del grupo; luego ajuste fino.
    const ref = c.segs[0], mRef = [Math.cos(ref.theta), 0, Math.sin(ref.theta)], tol = Math.max(0.02, 0.012 * ref.rho);
    const inliers = c.segs.filter(s => Math.abs(angleDiff(s.theta, ref.theta)) < 1.5 * DEG && Math.max(Math.abs(dot(mRef, s.P1) - ref.rho), Math.abs(dot(mRef, s.P2) - ref.rho)) < tol);
    if (inliers.length) c.segs = inliers;
    const line = c.segs.length > 1 ? refitLine(c.segs) : { theta: c.segs[0].theta, rho: c.segs[0].rho };
    const ext = lineExtent(line, c.segs);
    const sigmaTheta = junctionSigma(cam, line, c.segs, ext);
    const pxCover = Math.min(1, c.segs.reduce((s, g) => s + Math.abs(g.x2 - g.x1), 0) / cam.width);
    const contrast = c.segs.reduce((s, g) => s + (g.contrast ?? 0) * g.L, 0) / c.segs.reduce((s, g) => s + g.L, 0);
    const support = verticalSupport(cam, line, vertical);
    const weight = c.segs.reduce((sum, g) => sum + g.L * (0.6 + (g.contrast ?? 0)), 0);
    // Prior de la mira: el usuario apunta la retícula al encuentro.
    const aimDist = lineDistanceToPoint(cam, line, aim);
    const aimWeight = 0.35 + 0.65 * Math.exp(-((aimDist / (0.28 * cam.height)) ** 2));
    // Histéresis: la línea aceptada en el cuadro anterior gana estabilidad.
    const keep = opts.prev && Math.abs(angleDiff(line.theta, opts.prev.theta)) < 3 * DEG && Math.abs(line.rho - opts.prev.rho) < 0.04 * opts.prev.rho ? 1.6 : 1;
    const score = weight * (0.15 + 2.5 * contrast) ** 2 * (1 + 0.35 * Math.min(support, 4)) * (0.5 + pxCover) * aimWeight * keep;
    return { ...line, extent: ext, segs: c.segs, contrast, support, cover: pxCover, score, sigmaTheta };
  }).sort((a, b) => b.score - a.score);
  let base = candidates[0];
  // Zócalo: el borde superior del zócalo es una línea del MURO que, proyectada
  // al piso, parece más lejana. Si hay una paralela más cercana cuya diferencia
  // corresponde a una altura de zócalo (3–18 cm), esa es el encuentro real.
  for (const c of candidates.slice(1)) {
    if (Math.abs(angleDiff(c.theta, base.theta)) > 3 * DEG || c.rho >= base.rho) continue;
    const z = cam.h * (1 - c.rho / base.rho);
    if (z >= 0.03 && z <= 0.18 && (c.contrast >= 0.2 || c.score > 0.45 * base.score) && c.cover > 0.25) { base = { ...c, baseboard: z }; break; }
  }
  const total = candidates.reduce((s, c) => s + c.score, 0);
  base = { ...base, confidence: clamp(base.score / total * Math.min(1, base.cover * 2.2), 0, 1) };
  // Segunda pared (esquina) si existe una familia claramente distinta.
  let second = candidates.find(c => c !== base && Math.abs(Math.sin(angleDiff(c.theta, base.theta))) > Math.sin(25 * DEG) && c.score > 0.3 * base.score) || null;
  if (second) {
    // En una esquina se reviste el muro que está bajo la mira (centro de la vista):
    // el primero que intersecta el rayo central.
    const [u, v] = aim, dist = l => { const w = pixelToWall(cam, l, u, v); return w ? norm(sub(w.point, cameraCenter(cam))) : Infinity; };
    if (dist(second) < dist(base)) [base, second] = [{ ...second, confidence: base.confidence }, base];
  }
  return { base, second, vertical, floor, candidates };
}

// ---------- detector de pared: líneas horizontales del muro --------------
// Toda recta 3D horizontal tiene dirección d = n × UP (n: normal de su plano de
// interpretación). Hiladas, juntas, cantos de zócalo, dinteles, repisas y el
// encuentro con el cielo son horizontales y paralelos al muro: dan la
// orientación del muro SIN mirar el piso y con muchas más líneas que el
// encuentro. No dan distancia (una sola cámara no ve escala): la distancia
// sigue viniendo del encuentro piso–muro. Por eso trabajan juntos.
export function wallOrientation(cam, line, segments, opts = {}) {
  const f = lineFrame(line), tol = (opts.tolDeg ?? 10) * DEG, minL = opts.minLength ?? Math.max(18, cam.width * 0.06), maxH = opts.maxHeight ?? 3.2;
  const items = [];
  for (const s of segments) {
    const L = s.L ?? segLength(s); if (L < minL || onBorder(cam, s)) continue;
    const n = s.n ?? interpretationNormal(cam, s), ny = Math.abs(n[1]);
    // Casi vertical (aristas) o a la altura del horizonte (dirección indefinida).
    if (ny < Math.sin(20 * DEG) || ny > Math.cos(3 * DEG)) continue;
    // Debe estar sobre el plano del muro: ambos extremos entre el piso y ~3 m.
    const a = pixelToWall(cam, line, s.x1, s.y1), b = pixelToWall(cam, line, s.x2, s.y2);
    if (!a || !b || Math.min(a.y, b.y) < (opts.minHeight ?? 0.02) || Math.max(a.y, b.y) > maxH) continue;
    const d = normalize(cross(n, UP));
    let r = Math.atan2(dot(cross(f.along, d), UP), dot(f.along, d));
    if (r > Math.PI / 2) r -= Math.PI; if (r < -Math.PI / 2) r += Math.PI;
    if (Math.abs(r) > tol) continue;
    // Incertidumbre propia de cada línea: error de sus extremos (~0,5 px)
    // amplificado cuando la línea está cerca de la altura de la cámara.
    const sigma = Math.max(1e-4, (opts.pixelNoise ?? 0.5) * Math.SQRT2 / L) * ny / Math.sqrt(1 - ny * ny);
    items.push({ r, w: 1 / sigma ** 2, s });
  }
  if (items.length < (opts.minLines ?? 2)) return null;
  // Mediana ponderada → inliers (±1,5°) → media ponderada.
  const sorted = [...items].sort((x, y) => x.r - y.r), W = sorted.reduce((t, i) => t + i.w, 0);
  let acc = 0, med = sorted[0].r; for (const i of sorted) { acc += i.w; if (acc >= W / 2) { med = i.r; break; } }
  const inl = items.filter(i => Math.abs(i.r - med) < (opts.inlierDeg ?? 1.5) * DEG);
  if (inl.length < (opts.minLines ?? 2)) return null;
  const wi = inl.reduce((t, i) => t + i.w, 0), mean = inl.reduce((t, i) => t + i.r * i.w, 0) / wi;
  const sd = Math.sqrt(inl.reduce((t, i) => t + i.w * (i.r - mean) ** 2, 0) / wi);
  const uncertainty = Math.max(0.08, Math.max(1 / Math.sqrt(wi), sd / Math.sqrt(inl.length)) / DEG);
  return { theta: line.theta - mean, uncertainty, count: inl.length, weight: wi, segments: inl.map(i => i.s) };
}
// Fusión de los dos detectores: el encuentro aporta la distancia; ambos
// aportan la orientación, ponderada por su incertidumbre (1/σ²). Se gira
// alrededor del punto del encuentro bajo la mira para no desplazar lo que
// el usuario está viendo. Si discrepan, se confía en el encuentro.
export function fuseOrientation(cam, base, wall, opts = {}) {
  if (!base || !wall) return base ? { ...base, wallLines: 0 } : base;
  const sj = base.sigmaTheta ?? 1 * DEG, sw = wall.uncertainty * DEG, d = angleDiff(wall.theta, base.theta);
  if (Math.abs(d) > Math.max(opts.maxDeg ?? 2.5, 3 * Math.hypot(sj, sw) / DEG) * DEG) return { ...base, wallLines: wall.count, wallConflict: true };
  const k = (1 / sw ** 2) / (1 / sw ** 2 + 1 / sj ** 2), theta = base.theta + k * d;
  const aim = opts.aim ?? [cam.cx, cam.cy], hit = pixelToWall(cam, base, aim[0], aim[1]);
  const P = pointOnBase(base, hit ? clamp(hit.s, base.extent?.min ?? -3, base.extent?.max ?? 3) : 0);
  const rho = dot([Math.cos(theta), 0, Math.sin(theta)], P);
  return { ...base, theta, rho, sigmaTheta: 1 / Math.sqrt(1 / sw ** 2 + 1 / sj ** 2), wallLines: wall.count, wallConfirmed: true };
}

// Si ya se conoce la altura del zócalo y solo se ve su borde superior, se
// corrige la distancia: el borde superior está a z metros sobre el piso.
export function correctForBaseboard(line, z, h, prev) {
  if (!z || !prev) return line;
  const top = prev.rho / (1 - z / h);
  if (Math.abs(angleDiff(line.theta, prev.theta)) < 3 * DEG && Math.abs(line.rho - top) < 0.03 * top) return { ...line, rho: line.rho * (1 - z / h), baseboard: z, corrected: true };
  return line;
}

// ---------- ángulos ----------------------------------------------------
// Autovector de menor valor propio de una matriz simétrica 3×3 (Jacobi).
export function smallestEigenvector(M) {
  const a = M.map(r => [...r]), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 30; sweep++) {
    let off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]); if (off < 1e-14) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(a[p][q]) < 1e-18) continue;
      const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), s = Math.sin(th);
      for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
  }
  let i = 0; for (let k = 1; k < 3; k++) if (a[k][k] < a[i][i]) i = k;
  return normalize([V[0][i], V[1][i], V[2][i]]);
}

// Dirección vertical real del muro a partir de sus aristas casi verticales.
// RANSAC sobre pares: v = n_i × n_j; los inliers cumplen |n_k · v| < sin(1,5°).
// Se exigen al menos dos aristas en posiciones distintas: con una sola, un
// desplome hacia el usuario no es observable.
export function wallVerticalDirection(cam, line, segments, opts = {}) {
  const tol = Math.sin((opts.toleranceDeg ?? 9) * DEG), minL = opts.minLength ?? cam.width * 0.12, inTol = Math.sin((opts.inlierDeg ?? 1.5) * DEG), cand = [];
  for (const s of segments) {
    const L = s.L ?? segLength(s); if (L < minL || onBorder(cam, s)) continue;
    const n = s.n ?? interpretationNormal(cam, s); if (Math.abs(n[1]) > tol) continue;
    const w = pixelToWall(cam, line, (s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2);
    if (!w || w.y < 0.02) continue; // debe estar sobre el muro
    cand.push({ n, L });
  }
  if (cand.length < 2) return null;
  let best = null;
  for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) {
    const c = cross(cand[i].n, cand[j].n), sn = norm(c);
    if (sn < Math.sin(4 * DEG)) continue; // planos casi iguales: mal condicionado
    let v = scale(c, 1 / sn); if (v[1] < 0) v = scale(v, -1);
    if (v[1] < Math.cos(12 * DEG)) continue;
    let score = 0; const inl = [];
    for (const k of cand) if (Math.abs(dot(k.n, v)) < inTol) { score += k.L; inl.push(k); }
    if (!best || score > best.score) best = { score, inl };
  }
  if (!best || best.inl.length < 2) return null;
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const { n, L } of best.inl) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) M[r][c] += L * n[r] * n[c];
  let v = smallestEigenvector(M); if (v[1] < 0) v = scale(v, -1);
  // Incertidumbre del desplome hacia el usuario (lo menos observable con un
  // teléfono: depende de cuán separadas están las aristas en la imagen).
  const e = normalize(sub(lineFrame(line).toCamera, scale(v, dot(lineFrame(line).toCamera, v))));
  let info = 0, res = 0;
  for (const { n, L } of best.inl) { info += L * dot(n, e) ** 2; res += L * Math.asin(clamp(dot(n, v), -1, 1)) ** 2; }
  const sigma = Math.max(0.4 * DEG, Math.sqrt(res / best.score));
  const uncertainty = sigma / Math.sqrt(Math.max(info / best.score, 1e-9) * best.inl.length) / DEG;
  return { v, used: best.inl.length, weight: best.score, uncertainty };
}

// Ángulo interior piso–muro en grados (90° = muro a plomo) y desplome.
export function floorWallAngle(line, v) {
  const f = lineFrame(line), d = f.along;
  const u = normalize(sub(v, scale(d, dot(v, d))));
  return { angle: Math.acos(clamp(dot(f.toCamera, u), -1, 1)) / DEG, plumb: Math.acos(clamp(v[1], -1, 1)) / DEG };
}
// Resumen para la interfaz: el ángulo solo se informa si es observable.
export function squareness(cam, line, segments, opts = {}) {
  const vert = wallVerticalDirection(cam, line, segments, opts);
  if (!vert || vert.uncertainty > (opts.maxUncertaintyDeg ?? 1.2) || vert.weight < (opts.minEdgeLength ?? 0.6 * cam.width)) return { measured: false, angle: 90, uncertainty: vert?.uncertainty ?? null, edges: vert?.used ?? 0 };
  const a = floorWallAngle(line, vert.v);
  return { measured: true, angle: a.angle, plumb: a.plumb, uncertainty: vert.uncertainty, edges: vert.used };
}
// Ángulo interior entre dos muros vistos desde dentro del recinto.
export function cornerAngle(lineA, lineB) {
  const a = lineFrame(lineA).toCamera, b = lineFrame(lineB).toCamera;
  return 180 - Math.acos(clamp(dot(a, b), -1, 1)) / DEG;
}
// Punto donde se encuentran dos líneas del piso (esquina), o null.
export function lineIntersection(lineA, lineB) {
  const a = [Math.cos(lineA.theta), Math.sin(lineA.theta)], b = [Math.cos(lineB.theta), Math.sin(lineB.theta)], det = a[0] * b[1] - a[1] * b[0];
  if (Math.abs(det) < 1e-6) return null;
  return [(lineA.rho * b[1] - a[1] * lineB.rho) / det, 0, (a[0] * lineB.rho - lineA.rho * b[0]) / det];
}

// Refinamiento de la focal con el punto de fuga vertical (solo si la cámara
// está inclinada; con el teléfono a plomo el punto de fuga está en el infinito).
export function estimateFocal(cam, segments, opts = {}) {
  const g = rotate(quatConjugate(cam.q), UP); // vertical en coordenadas de cámara
  if (Math.abs(g[2]) < Math.sin((opts.minPitchDeg ?? 12) * DEG)) return null;
  const a = g[0] / -g[2], b = g[1] / -g[2], estimates = [];
  for (const s of segments) {
    const L = segLength(s); if (L < (opts.minLength ?? cam.width * 0.08)) continue;
    // Pre-filtro: casi vertical en la imagen tras compensar el giro.
    const roll = Math.atan2(g[0], g[1]), ang = Math.atan2(s.x2 - s.x1, -(s.y2 - s.y1));
    if (Math.abs(Math.sin(ang - roll)) > Math.sin((opts.imageTolDeg ?? 25) * DEG)) continue;
    const l = cross([s.x1, s.y1, 1], [s.x2, s.y2, 1]), den = l[0] * a - l[1] * b;
    if (Math.abs(den) < 1e-9) continue;
    const f = -(l[0] * cam.cx + l[1] * cam.cy + l[2]) / den;
    if (f > cam.f * 0.55 && f < cam.f * 1.8) estimates.push(f);
  }
  if (estimates.length < (opts.minSegments ?? 5)) return null;
  estimates.sort((x, y) => x - y);
  const f = estimates[estimates.length >> 1];
  const mad = estimates.map(e => Math.abs(e - f)).sort((x, y) => x - y)[estimates.length >> 1];
  return mad / f < 0.08 ? { f, samples: estimates.length, spread: mad / f } : null;
}

// ---------- mediciones ---------------------------------------------------
export function polygonAreaXZ(points) {
  let s = 0; for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length]; s += a[0] * b[2] - b[0] * a[2]; }
  return Math.abs(s) / 2;
}
export function distance3(a, b) { return norm(sub(a, b)); }
// Todas las medidas son proporcionales a h: calibrar con una medida conocida
// equivale a corregir la altura del teléfono.
export function calibratedHeight(h, measured, real) { return measured > 1e-6 && real > 0 ? h * real / measured : h; }

// ---------- pose del muro virtual ---------------------------------------
// Matriz 4×4 (columna mayor, como THREE.Matrix4.elements) para un muro cuyo
// borde inferior central está en el encuentro, en la coordenada s.
export function wallMatrix(line, s = 0, lift = 0, offset = 0.002) {
  const f = lineFrame(line), O = add(add(pointOnBase(line, s), [0, lift, 0]), scale(f.toCamera, offset));
  const X = f.along, Y = UP, Z = f.toCamera;
  return [X[0], X[1], X[2], 0, Y[0], Y[1], Y[2], 0, Z[0], Z[1], Z[2], 0, O[0], O[1], O[2], 1];
}
// Pose para piso: el diseño queda tendido sobre el piso, mirando hacia arriba.
export function floorMatrix(center, yaw = 0, offset = 0.002) {
  const X = [Math.cos(yaw), 0, -Math.sin(yaw)], Z = [0, 1, 0], Y = cross(Z, X); // Y del diseño apunta "hacia adelante"
  return [X[0], X[1], X[2], 0, Y[0], Y[1], Y[2], 0, Z[0], Z[1], Z[2], 0, center[0], offset, center[2], 1];
}

// ---------- seguimiento -------------------------------------------------
// Corrige suavemente la línea anclada con una nueva detección compatible.
export function blendLine(anchor, observed, k = 0.2, opts = {}) {
  const dt = angleDiff(observed.theta, anchor.theta), dr = observed.rho - anchor.rho;
  if (Math.abs(dt) > (opts.maxThetaDeg ?? 7) * DEG || Math.abs(dr) > Math.max(0.15, (opts.maxRhoRatio ?? 0.25) * anchor.rho)) return { line: anchor, accepted: false };
  return { line: { ...anchor, theta: anchor.theta + k * dt, rho: anchor.rho + k * dr }, accepted: true };
}
// Estabilidad temporal: true cuando las últimas n detecciones coinciden.
export function isStable(history, n = 6, thetaDeg = 2.5, rhoRatio = 0.04) {
  if (history.length < n) return false;
  const last = history.slice(-n), ref = last[n - 1];
  return last.every(l => l && Math.abs(angleDiff(l.theta, ref.theta)) < thetaDeg * DEG && Math.abs(l.rho - ref.rho) < rhoRatio * ref.rho);
}

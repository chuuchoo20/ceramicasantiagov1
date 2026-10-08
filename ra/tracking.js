// =====================================================================
// RA · Seguimiento estable (sin DOM): orientación sincronizada con el video,
// filtro adaptativo y anclaje del muro con corrección suave.
//
// De dónde venía el «tiritón» de la muralla proyectada:
//  1. Desfase sensor–video. El giroscopio llega al instante; la imagen de la
//     cámara llega ~50–120 ms tarde. Al mover el teléfono, la muralla se
//     adelantaba a la pared y volvía: parecía que flotaba. Ahora cada cuadro
//     se dibuja con la orientación del instante en que se CAPTURÓ ese cuadro.
//  2. Ruido del sensor. Se filtra con un filtro «One Euro»: suaviza fuerte
//     con el teléfono quieto y casi nada al moverlo (sin retardo visible).
//  3. Re-anclaje a saltos. Antes cada detección (cada 300 ms) movía la línea
//     un 15 % de golpe. Ahora se toma la mediana de las últimas detecciones,
//     se ignora el ruido bajo un umbral y la corrección se aplica de forma
//     continua, cuadro a cuadro.
// =====================================================================
import * as V from './vision.js';

const DEG = Math.PI / 180;

// Historial de orientaciones con marca de tiempo (performance.now, ms).
export class OrientationBuffer {
  constructor(maxAgeMs = 1500) { this.samples = []; this.maxAge = maxAgeMs; }
  push(t, q) {
    const s = this.samples;
    if (s.length && t <= s[s.length - 1].t) return; // fuera de orden o duplicado
    s.push({ t, q });
    while (s.length > 2 && t - s[0].t > this.maxAge) s.shift();
  }
  get size() { return this.samples.length; }
  latest() { return this.samples[this.samples.length - 1] ?? null; }
  // Orientación interpolada en el instante t (sin extrapolar hacia el futuro).
  at(t) {
    const s = this.samples; if (!s.length) return null;
    if (t >= s[s.length - 1].t) return s[s.length - 1].q;
    if (t <= s[0].t) return s[0].q;
    let i = s.length - 1; while (i > 0 && s[i - 1].t > t) i--;
    const a = s[i - 1], b = s[i];
    return V.quatSlerp(a.q, b.q, (t - a.t) / Math.max(1e-6, b.t - a.t));
  }
}

// Filtro One Euro para cuaterniones (Casiez et al., 2012). minCutoff (Hz)
// fija el suavizado en reposo; beta sube el corte con la velocidad angular.
export function createOneEuroQuat({ minCutoff = 3, beta = 6, dCutoff = 1.2 } = {}) {
  let prev = null, tPrev = 0, speed = 0;
  const alpha = (fc, dt) => 1 / (1 + 1 / (2 * Math.PI * fc * dt));
  const filter = (q, t) => {
    if (!prev) { prev = q; tPrev = t; return q; }
    const dt = Math.max(1e-3, (t - tPrev) / 1000); tPrev = t;
    const raw = V.quatAngle(prev, q) / dt; // rad/s
    speed += alpha(dCutoff, dt) * (raw - speed);
    prev = V.quatNormalize(V.quatSlerp(prev, q, alpha(minCutoff + beta * speed, dt)));
    return prev;
  };
  filter.reset = () => { prev = null; speed = 0; };
  return filter;
}

// Anclaje del muro proyectado. Recibe observaciones del encuentro (θ, ρ) y,
// cuando el piso no se ve, solo de orientación (detector de pared).
export class AnchorTracker {
  constructor(line, opts = {}) {
    this.line = { theta: line.theta, rho: line.rho };
    this.o = { window: 7, minObs: 3, maxAgeMs: 1600, tau: 0.35, deadRho: 0.006, deadRhoRatio: 0.003, deadThetaDeg: 0.25, gateThetaDeg: 6, gateRhoRatio: 0.2, ...opts };
    this.obs = []; this.ori = []; this.target = null; this.rejected = 0;
  }
  // Observación completa (encuentro visible). Las incompatibles se descartan:
  // con la muralla fijada no se salta a otra línea.
  observe(line, t) {
    const o = this.o, dt = V.angleDiff(line.theta, this.line.theta), dr = line.rho - this.line.rho;
    if (Math.abs(dt) > o.gateThetaDeg * DEG || Math.abs(dr) > Math.max(0.15, o.gateRhoRatio * this.line.rho)) { this.rejected++; return false; }
    this.obs.push({ t, theta: line.theta, rho: line.rho }); this.prune(t);
    this.retarget(); return true;
  }
  // Solo orientación (paredes con textura, sin piso visible): gira alrededor
  // del punto pivote del encuentro, que queda fijo en pantalla.
  observeOrientation(theta, t, pivotS = 0) {
    if (Math.abs(V.angleDiff(theta, this.line.theta)) > this.o.gateThetaDeg * DEG) { this.rejected++; return false; }
    this.ori.push({ t, theta, pivotS }); this.prune(t);
    if (this.obs.length >= this.o.minObs) return true; // el encuentro manda si está visible
    if (this.ori.length < this.o.minObs) return true;
    const th = this.line.theta + median(this.ori.map(x => V.angleDiff(x.theta, this.line.theta)));
    if (!this.target && Math.abs(V.angleDiff(th, this.line.theta)) < this.o.deadThetaDeg * DEG) return true;
    const P = V.pointOnBase(this.line, pivotS);
    this.target = { theta: th, rho: V.dot([Math.cos(th), 0, Math.sin(th)], P) };
    return true;
  }
  prune(t) {
    const keep = x => t - x.t <= this.o.maxAgeMs;
    this.obs = this.obs.filter(keep).slice(-this.o.window); this.ori = this.ori.filter(keep).slice(-this.o.window);
  }
  retarget() {
    const o = this.o; if (this.obs.length < o.minObs) return;
    const th = this.line.theta + median(this.obs.map(x => V.angleDiff(x.theta, this.line.theta))), rho = median(this.obs.map(x => x.rho));
    // Zona muerta con histéresis: decide si EMPEZAR a corregir; una vez en
    // marcha, la corrección llega hasta la mediana.
    const moving = !!this.target;
    const moveRho = moving || Math.abs(rho - this.line.rho) > Math.max(o.deadRho, o.deadRhoRatio * this.line.rho);
    const moveTheta = moving || Math.abs(V.angleDiff(th, this.line.theta)) > o.deadThetaDeg * DEG;
    this.target = moveRho || moveTheta ? { theta: moveTheta ? th : this.line.theta, rho: moveRho ? rho : this.line.rho } : null;
  }
  // Avanza la corrección de forma continua (exponencial, constante tau en s).
  step(dtMs) {
    if (!this.target) return this.line;
    const k = 1 - Math.exp(-Math.max(0, dtMs) / 1000 / this.o.tau), d = V.angleDiff(this.target.theta, this.line.theta);
    this.line = { theta: this.line.theta + k * d, rho: this.line.rho + k * (this.target.rho - this.line.rho) };
    if (Math.abs(V.angleDiff(this.target.theta, this.line.theta)) < 0.01 * DEG && Math.abs(this.target.rho - this.line.rho) < 2e-4) { this.line = { ...this.target }; this.target = null; }
    return this.line;
  }
  // Ajuste de escala (calibración de la altura del teléfono).
  scale(k) { this.line = { ...this.line, rho: this.line.rho * k }; this.obs = []; this.ori = []; this.target = null; }
}

export function median(values) {
  const v = [...values].sort((a, b) => a - b), n = v.length;
  return n ? (n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2) : 0;
}

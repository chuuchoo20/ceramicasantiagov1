// =====================================================================
// RA · Sesión "Ver en mi pared"
// Cámara + sensores de movimiento + OpenCV → encuentro piso–muro → muralla
// generada por el usuario proyectada a escala 1:1 sobre la pared real.
//
// Flujo con una sola instrucción visible a la vez:
//   permiso → buscar el encuentro → fijar → ver / mover / editar / medir.
// Si OpenCV no carga o no encuentra la línea, el usuario la marca con dos
// puntos (modo manual): la geometría métrica sigue funcionando.
//
// Dos detectores trabajan juntos: el encuentro piso–muro (distancia y
// orientación) y el detector de pared (líneas horizontales del muro:
// orientación, confirmación y seguimiento aunque el piso no se vea).
// El dibujo se sincroniza con cada cuadro del video (ver ra/tracking.js).
// =====================================================================
import * as THREE from 'three';
import * as V from './vision.js';
import { loadOpenCV, createDetector } from './detector.js';
import { OrientationBuffer, createOneEuroQuat, AnchorTracker } from './tracking.js';
import { TUTORIAL_CSS, tutorialStrip, stepNow } from './tutorial.js';

const DEG = Math.PI / 180;
const fmt = (v, d = 2) => v.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } } };

const CSS = `
.ra{position:fixed;inset:0;z-index:100;background:#111;color:#fff;font:15px/1.4 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden}
.ra video,.ra canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.ra video{object-fit:cover}.ra .ra-src{object-fit:cover}
.ra-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:10px;padding:max(12px,env(safe-area-inset-top)) 12px 12px;background:linear-gradient(#000a,#0000);pointer-events:none}
.ra-top>*{pointer-events:auto}
.ra-icon{flex:none;width:44px;height:44px;border-radius:50%;border:0;background:#0007;color:#fff;font-size:22px;display:grid;place-items:center;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);cursor:pointer}
.ra-pill{flex:1;min-width:0;text-align:center;font-weight:650;font-size:14px;padding:11px 14px;border-radius:22px;background:#000a;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ra-chips{position:absolute;left:12px;right:12px;top:calc(max(12px,env(safe-area-inset-top)) + 58px);display:flex;justify-content:center;gap:6px;flex-wrap:wrap;pointer-events:none}
.ra-chip{font-size:12px;font-weight:600;padding:6px 10px;border-radius:14px;background:#000b;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.ra-chip.ok{background:#1f6f43e0}.ra-chip.warn{background:#9a5b10e6}
.ra-bottom{position:absolute;left:0;right:0;bottom:0;padding:14px 14px max(14px,env(safe-area-inset-bottom));background:linear-gradient(#0000,#000c 40%);display:flex;flex-direction:column;gap:10px}
.ra-row{display:flex;gap:8px;justify-content:center;align-items:center}
.ra-btn{min-height:52px;border-radius:14px;border:0;padding:0 18px;font:inherit;font-weight:700;color:#fff;background:#ffffff26;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px}
.ra-btn.primary{background:#d22c21;flex:1;max-width:420px;font-size:16px}
.ra-btn.primary:disabled{background:#d22c2166;color:#fffa}
.ra-btn.ghost{background:none;font-weight:600;text-decoration:underline;text-underline-offset:3px;min-height:44px}
.ra-tool{flex:1;max-width:120px;min-height:62px;flex-direction:column;gap:3px;font-size:12px;font-weight:650;padding:6px}
.ra-tool i{font-size:22px;font-style:normal}
.ra-tool[aria-pressed=true]{background:#fff;color:#1d1d1b}
/* «Medir y colocar»: la acción principal, primera y destacada */
.ra-tool.hero{flex:1.7;max-width:190px;background:#d51314;color:#fff;box-shadow:0 6px 20px #d5131466;font-size:13px;font-weight:800;animation:ra-ring 1.6s ease-out 2}
.ra-tool.hero[aria-pressed=true]{background:#fff;color:#d51314}
@keyframes ra-ring{0%{box-shadow:0 0 0 0 #d51314aa}100%{box-shadow:0 0 0 16px #d5131400}}
.ra-card.ra-compact{padding:12px 14px;border-radius:16px}
.ra-card .rt-strip{margin:6px -18px 6px;padding:2px 18px 8px}
.ra-link{border:0;background:none;color:#5c574d;font:inherit;font-size:13px;font-weight:600;text-decoration:underline;text-underline-offset:3px;padding:8px;cursor:pointer}
.ra-card{background:#f7f5f0;color:#28251f;border-radius:20px;padding:18px;box-shadow:0 10px 40px #0006;max-width:460px;margin:0 auto;width:100%}
.ra-card h2{margin:0 0 6px;font-size:19px}.ra-card p{margin:0 0 12px;color:#5c574d;font-size:14px}
.ra-card .ra-btn{background:#ece8df;color:#28251f}.ra-card .ra-btn.primary{background:#d22c21;color:#fff}
.ra-sheet{max-height:52dvh;overflow:auto;-webkit-overflow-scrolling:touch}
.ra-sheet h3{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#7a7365;margin:14px 0 8px}
.ra-swatches{display:flex;gap:10px;overflow-x:auto;padding:4px 2px 6px}
.ra-swatch{flex:none;width:40px;height:40px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1px #0002;cursor:pointer}
.ra-swatch[aria-pressed=true]{box-shadow:0 0 0 3px #d22c21}
.ra-chipset{display:flex;gap:6px;flex-wrap:wrap}
.ra-opt{min-height:40px;border-radius:20px;border:1px solid #d6d0c4;background:#fff;color:#28251f;padding:0 14px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.ra-opt[aria-pressed=true]{background:#28251f;color:#fff;border-color:#28251f}
.ra-stepper{display:grid;grid-template-columns:52px 1fr 52px;align-items:center;gap:6px;background:#fff;border:1px solid #d6d0c4;border-radius:14px;padding:4px}
.ra-stepper button{height:44px;border:0;border-radius:10px;background:#f0ece4;font-size:22px;color:#28251f;cursor:pointer}
.ra-stepper output{text-align:center;font-weight:700;font-size:17px}
.ra-stepper small{display:block;font-size:11px;font-weight:600;color:#7a7365}
.ra-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ra-result{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:4px 0 12px;text-align:center}
.ra-result b{display:block;font-size:20px}.ra-result span{font-size:11px;color:#7a7365;text-transform:uppercase;letter-spacing:.05em}
.ra-busy{position:absolute;inset:0;display:grid;place-items:center;background:#000a;z-index:5}
.ra-spinner{width:44px;height:44px;border-radius:50%;border:4px solid #fff3;border-top-color:#fff;animation:ra-spin 1s linear infinite}
@keyframes ra-spin{to{transform:rotate(360deg)}}
.ra-handle{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:3px solid #fff;background:#d22c2155;box-shadow:0 0 0 2px #0005;touch-action:none;cursor:grab}
.ra-handle:after{content:'';position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px;border-radius:50%;background:#fff}
.ra-help li{margin:0 0 8px;color:#4a463d;font-size:14px}
.ra-input{width:100%;min-height:48px;font:inherit;font-size:18px;border:1px solid #cfc8bb;border-radius:12px;padding:0 12px;margin:4px 0 12px}
.ra-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .4s}
@media (prefers-reduced-motion:reduce){.ra-spinner{animation:none}.ra-flash{transition:none}.ra-tool.hero{animation:none}}
` + TUTORIAL_CSS;

export class RASession {
  // host: { getMeshes(), getOptions(), update(patch), applyMeasure({width,height}), config, usePhoto? }
  constructor(host, opts = {}) {
    this.host = host; this.opts = opts;
    this.h = store.get('cs-ra-height', 1.4); this.focalFactor = store.get('cs-ra-focal', 0.75);
    this.state = 'intro'; this.history = []; this.detection = null; this.anchor = null; this.s0 = 0; this.lift = 0;
    this.q = [0, 0, 0, 1]; this.sensorSeen = false; this.measure = { kind: 'wall', points: [] };
    this.lastDetect = 0; this.squareness = null; this.corner = null; this.lum = 0.5; this.lumTarget = 0.5; this.handles = null; this.debug = /[?&]ra-debug/.test(location.search);
    // Orientación con marca de tiempo: cada cuadro se dibuja con la del
    // instante en que la cámara lo capturó (no con la más reciente).
    this.orient = new OrientationBuffer(); this.euro = createOneEuroQuat(); this.latency = 60; this.lastVideoFrame = -1e9;
    this.onOrientation = e => {
      if (e.beta === null || this.fusedSensor) return; this.sensorSeen = true;
      this.orient.push(eventTime(e), V.quatFromDeviceOrientation(e.alpha || 0, e.beta, e.gamma || 0, screenAngle()));
    };
    this.build();
  }

  // ---------------- interfaz ----------------
  build() {
    if (!document.getElementById('ra-style')) { const s = document.createElement('style'); s.id = 'ra-style'; s.textContent = CSS; document.head.append(s); }
    const root = this.root = document.createElement('div'); root.className = 'ra'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Ver en mi pared');
    root.innerHTML = `
      <video playsinline muted autoplay aria-hidden="true"></video>
      <canvas class="ra-gl" aria-hidden="true"></canvas>
      <canvas class="ra-hud" aria-hidden="true"></canvas>
      <div class="ra-flash"></div>
      <div class="ra-top"><button class="ra-icon" data-act="close" aria-label="Cerrar">✕</button><div class="ra-pill" role="status" aria-live="polite">Ver en mi pared</div><button class="ra-icon" data-act="help" aria-label="Ayuda y ajustes">?</button></div>
      <div class="ra-chips" aria-live="polite"></div>
      <div class="ra-bottom"></div>`;
    document.body.append(root);
    this.video = root.querySelector('video'); this.gl = root.querySelector('.ra-gl'); this.hud = root.querySelector('.ra-hud'); this.ctx = this.hud.getContext('2d');
    this.pill = root.querySelector('.ra-pill'); this.chips = root.querySelector('.ra-chips'); this.bottom = root.querySelector('.ra-bottom');
    root.addEventListener('click', e => { const a = e.target.closest('[data-act]')?.dataset.act; if (a) this.action(a, e.target.closest('[data-act]')); });
    root.addEventListener('pointerdown', e => this.pointerDown(e)); root.addEventListener('pointermove', e => this.pointerMove(e));
    for (const t of ['pointerup', 'pointercancel']) root.addEventListener(t, e => this.pointerUp(e));
    this.keydown = e => { if (e.key === 'Escape') this.close(); }; document.addEventListener('keydown', this.keydown);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.gl, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene(); this.hemi = new THREE.HemisphereLight(0xfff6e8, 0x6b6359, 2.2); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1de, 1.6); this.sun.position.set(-1, 3, 2); this.scene.add(this.sun);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 60); this.wall = new THREE.Group(); this.wall.matrixAutoUpdate = false; this.wall.visible = false; this.scene.add(this.wall);
    this.renderIntro();
  }
  setPill(text) { if (this.pill.textContent !== text) this.pill.textContent = text; }
  setChips(list) { const html = list.map(([t, cls]) => `<span class="ra-chip ${cls || ''}">${t}</span>`).join(''); if (this.chips.innerHTML !== html) this.chips.innerHTML = html; }
  setBottom(html) { this.bottom.innerHTML = html; }

  renderIntro() {
    this.setPill('Ver en mi pared');
    this.setBottom(`<div class="ra-card"><h2>Coloca tu muralla en tu pared</h2>
      <p>En 4 toques mides tu pared y la muralla queda con esas medidas, en su lugar. Desliza para ver cómo:</p>
      ${tutorialStrip()}
      <div class="ra-row"><button class="ra-btn primary" data-act="start">Activar cámara</button></div></div>`);
  }
  renderScan() {
    this.setBottom(`<div class="ra-card ra-compact">${stepNow(0)}</div>
      <div class="ra-row"><button class="ra-btn primary" data-act="fix" disabled>Fijar pared</button></div>
      <div class="ra-row"><button class="ra-btn ghost" data-act="manual">Marcar la línea a mano</button></div>`);
  }
  renderManual() {
    this.setBottom(`<div class="ra-row"><button class="ra-btn primary" data-act="fix">Fijar pared</button></div>
      <div class="ra-row"><button class="ra-btn ghost" data-act="rescan">${this.detector ? 'Volver a detección automática' : 'Reintentar detección'}</button></div>`);
  }
  renderPlaced() {
    const t = this.tool || 'move';
    this.setBottom(`<div class="ra-row">
      <button class="ra-btn ra-tool hero" data-act="tool-measure" aria-pressed="${t === 'measure'}"><i>📐</i>Medir y colocar</button>
      <button class="ra-btn ra-tool" data-act="tool-design" aria-pressed="${t === 'design'}"><i>▦</i>Diseño</button>
      <button class="ra-btn ra-tool" data-act="compare" aria-label="Mantén presionado para ver la pared real"><i>◐</i>Comparar</button>
      <button class="ra-btn ra-tool" data-act="capture"><i>◉</i>Foto</button></div>`);
  }
  renderDesign() {
    const o = this.host.getOptions(), s = o.state;
    const sw = o.colors.map(([name, hex]) => `<button class="ra-swatch" style="background:${hex}" data-act="color" data-v="${name}" aria-label="${name}" aria-pressed="${name === s.color}"></button>`).join('');
    const pat = o.patterns.map(([k, label]) => `<button class="ra-opt" data-act="pattern" data-v="${k}" aria-pressed="${k === s.pattern}">${label}</button>`).join('');
    this.setBottom(`<div class="ra-card ra-sheet"><div class="ra-row" style="justify-content:space-between"><h2 style="margin:0">Tu diseño</h2><button class="ra-btn" data-act="tool-move">Listo</button></div>
      ${o.colors.length > 1 ? `<h3>Color · ${s.color}</h3><div class="ra-swatches">${sw}</div>` : ''}
      ${o.patterns.length > 1 ? `<h3>Traba</h3><div class="ra-chipset">${pat}</div>` : ''}
      <h3>Medidas de la muralla</h3><div class="ra-grid2">
        <div class="ra-stepper"><button data-act="w-" aria-label="Reducir ancho">−</button><output><small>Ancho</small>${fmt(s.width)} m</output><button data-act="w+" aria-label="Aumentar ancho">+</button></div>
        <div class="ra-stepper"><button data-act="h-" aria-label="Reducir alto">−</button><output><small>Alto</small>${fmt(s.height)} m</output><button data-act="h+" aria-label="Aumentar alto">+</button></div></div>
      <p style="margin:10px 0 0;font-size:12px">${o.summary}</p></div>`);
  }
  // «Medir y colocar»: tres toques sobre la pared real (extremo, extremo,
  // altura) definen el ancho, el alto Y la posición de la muralla.
  renderMeasure() {
    const m = this.measure, n = m.points.length;
    if (m.kind === 'wall') {
      if (n < 3) {
        this.setBottom(`<div class="ra-card ra-compact">${stepNow(n + 1)}
          <div class="ra-row" style="margin-top:8px;justify-content:space-between">${n ? '<button class="ra-link" data-act="measure-undo">Deshacer punto</button>' : '<button class="ra-link" data-act="measure-kind" data-v="floor">Medir un piso</button>'}<button class="ra-link" data-act="measure-skip">Usar mis medidas</button></div></div>`);
        return;
      }
      const [A, B, C] = m.points, w = Math.abs(B.s - A.s), hgt = Math.max(0, C.y);
      this.measured = { width: w, height: hgt, mid: (A.s + B.s) / 2 };
      this.setBottom(`<div class="ra-card"><div class="ra-result"><div><b>${fmt(w)} m</b><span>Ancho</span></div><div><b>${fmt(hgt)} m</b><span>Alto</span></div><div><b>${fmt(w * hgt)} m²</b><span>Superficie</span></div></div>
        <div class="ra-row"><button class="ra-btn primary" data-act="apply-measure">Colocar mi muralla aquí</button></div>
        <div class="ra-row"><button class="ra-btn ghost" data-act="measure-reset">Repetir</button><button class="ra-btn ghost" data-act="calibrate">¿No calza? Calibrar</button></div></div>`);
      return;
    }
    const pts = m.points.map(p => p.P), area = n >= 3 ? V.polygonAreaXZ(pts) : 0;
    const body = n < 3 ? `<p style="color:#fff;text-align:center;margin:0;font-weight:600">${n ? `Punto ${n} marcado · toca la siguiente esquina del piso` : 'Toca las esquinas del área de piso'}</p>`
      : `<div class="ra-card"><div class="ra-result" style="grid-template-columns:1fr 1fr"><div><b>${fmt(area)} m²</b><span>Área de piso</span></div><div><b>${n}</b><span>Esquinas</span></div></div>
        <div class="ra-row"><button class="ra-btn" data-act="measure-undo">Deshacer punto</button><button class="ra-btn ghost" data-act="measure-reset">Repetir</button></div></div>`;
    this.setBottom(`<div class="ra-row"><button class="ra-btn" style="min-height:40px" data-act="measure-kind" data-v="wall">Volver a medir la pared</button><button class="ra-btn" style="min-height:40px" data-act="tool-move">Listo</button></div>${body}`);
  }
  renderHelp() {
    this.prevBottom = this.bottom.innerHTML;
    this.setBottom(`<div class="ra-card ra-sheet"><h2>Cómo funciona</h2><ul class="ra-help" style="padding-left:18px;margin:8px 0">
      <li>La cámara busca la unión piso–pared con visión por computador (OpenCV) y confirma la pared con sus líneas horizontales (hiladas, zócalo, marcos). Los sensores del teléfono entregan la vertical.</li>
      <li>La escala depende de la altura a la que sostienes el teléfono. Si una medida no calza, calibra con una medida conocida.</li>
      <li>Mejor con buena luz, mirando la pared con algo de piso visible.</li></ul>
      <h3 style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#7a7365">Altura del teléfono</h3>
      <div class="ra-stepper"><button data-act="ph-" aria-label="Bajar">−</button><output>${fmt(this.h)} m</output><button data-act="ph+" aria-label="Subir">+</button></div>
      <div class="ra-row" style="margin-top:12px">${this.detector ? '<button class="ra-btn" data-act="rescan">Volver a detectar</button>' : ''}</div>
      <div class="ra-row"><button class="ra-btn primary" data-act="help-close">Entendido</button></div></div>`);
  }
  renderCalibrate() {
    this.setBottom(`<div class="ra-card"><h2>Calibrar escala</h2><p>Mide el ancho que marcaste con una huincha y escríbelo. Ajustamos todas las medidas.</p>
      <input class="ra-input" type="number" inputmode="decimal" step="0.01" min="0.1" max="20" value="${fmt(this.measured?.width ?? 1).replace(',', '.')}" aria-label="Ancho real en metros">
      <div class="ra-row"><button class="ra-btn primary" data-act="calibrate-apply">Aplicar</button><button class="ra-btn" data-act="calibrate-cancel">Cancelar</button></div></div>`);
    this.bottom.querySelector('input').focus();
  }

  // ---------------- acciones ----------------
  async action(a, el) {
    const o = () => this.host.getOptions().state;
    switch (a) {
      case 'close': return this.close();
      case 'start': return this.start();
      case 'help': return this.renderHelp();
      case 'help-close': this.bottom.innerHTML = this.prevBottom || ''; return this.refreshBottom();
      case 'ph-': case 'ph+': this.setHeight(this.h + (a === 'ph+' ? 0.05 : -0.05)); return this.renderHelp();
      case 'manual': return this.enterManual();
      case 'rescan': return this.enterScan();
      case 'fix': return this.fix();
      case 'tool-move': this.tool = 'move'; return this.renderPlaced();
      case 'tool-design': this.tool = 'design'; return this.renderDesign();
      case 'tool-measure': this.tool = 'measure'; this.measure = { kind: 'wall', points: [] }; return this.renderMeasure();
      case 'measure-skip': this.tool = 'move'; this.toast('Puedes medir y colocar cuando quieras'); return this.renderPlaced();
      case 'measure-kind': this.measure = { kind: el.dataset.v, points: [] }; return this.renderMeasure();
      case 'measure-reset': this.measure.points = []; return this.renderMeasure();
      case 'measure-undo': this.measure.points.pop(); return this.renderMeasure();
      case 'apply-measure': {
        // Medidas al diseño (ancho, alto, cálculo de unidades) y la muralla
        // centrada entre los dos extremos tocados, apoyada en el piso.
        const r = this.host.applyMeasure(this.measured);
        if (r) { this.s0 = this.measured.mid; this.lift = 0; }
        this.refreshWall();
        this.toast(r ? `Muralla colocada · ${fmt(r.width)} × ${fmt(r.height)} m` : 'Medida fuera de rango (0,30 a 6 m de ancho)');
        this.measure.points = []; this.tool = 'move'; return this.renderPlaced();
      }
      case 'calibrate': return this.renderCalibrate();
      case 'calibrate-cancel': return this.renderMeasure();
      case 'calibrate-apply': {
        const real = Number(this.bottom.querySelector('input').value.replace(',', '.'));
        if (!(real > 0.05) || !this.measured?.width) return;
        this.setHeight(V.calibratedHeight(this.h, this.measured.width, real));
        this.toast(`Escala calibrada · teléfono a ${fmt(this.h)} m`); return this.renderMeasure();
      }
      case 'color': this.host.update({ color: el.dataset.v }); this.refreshWall(); return this.renderDesign();
      case 'pattern': this.busy(true); await tick(); this.host.update({ pattern: el.dataset.v }); this.refreshWall(); this.busy(false); return this.renderDesign();
      case 'w-': case 'w+': case 'h-': case 'h+': {
        const s = o(), key = a[0] === 'w' ? 'width' : 'height', step = a[1] === '+' ? 0.1 : -0.1;
        this.busy(true); await tick(); this.host.update({ [key]: Math.round((s[key] + step) * 10) / 10 }); this.refreshWall(); this.busy(false); return this.renderDesign();
      }
      case 'capture': return this.capture();
      case 'compare': return; // se maneja con pointerdown/up (mantener)
    }
  }
  refreshBottom() {
    if (this.state === 'scan') this.renderScan(); else if (this.state === 'manual') this.renderManual();
    else if (this.state === 'placed') { if (this.tool === 'design') this.renderDesign(); else if (this.tool === 'measure') this.renderMeasure(); else this.renderPlaced(); }
  }
  setHeight(h) {
    h = Math.max(0.5, Math.min(2.2, h)); const k = h / this.h;
    // Todas las posiciones métricas escalan con h (rayos desde la cámara).
    if (this.anchor) this.anchor = { ...this.anchor, rho: this.anchor.rho * k };
    this.tracker?.scale(k);
    this.s0 *= k; this.lift *= k; for (const p of this.measure.points) { if (p.s !== undefined) { p.s *= k; p.y *= k; } if (p.P) p.P = V.scale(p.P, k); }
    if (this.measured) this.measured = { width: this.measured.width * k, height: this.measured.height * k, mid: (this.measured.mid ?? 0) * k };
    this.history = []; this.h = h; store.set('cs-ra-height', h);
  }
  busy(on) {
    let el = this.root.querySelector('.ra-busy');
    if (on && !el) { el = document.createElement('div'); el.className = 'ra-busy'; el.innerHTML = '<div class="ra-spinner" role="progressbar" aria-label="Actualizando"></div>'; this.root.append(el); }
    if (!on) el?.remove();
  }
  toast(text) { this.setPill(text); this.toastUntil = performance.now() + 2500; }

  // ---------------- inicio: cámara, sensores, OpenCV ----------------
  async start() {
    // iOS exige pedir el permiso de movimiento dentro del gesto del usuario.
    const motion = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function' ? DeviceOrientationEvent.requestPermission().catch(() => 'denied') : Promise.resolve('granted');
    this.setBottom(''); this.busy(true); this.setPill('Preparando la cámara…');
    const cv = loadOpenCV(this.host.config?.opencv || []).then(({ cv: cvm }) => { this.detector = createDetector(cvm); return true; }).catch(e => { console.warn('[RA] OpenCV', e); return false; });
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Error('Este navegador no permite usar la cámara. Abre la página por HTTPS en Chrome o Safari.');
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      this.video.srcObject = this.stream; await this.video.play().catch(() => {});
      await new Promise(r => this.video.videoWidth ? r() : this.video.addEventListener('loadedmetadata', r, { once: true }));
      this.source = this.video;
      const perm = await motion;
      if (perm !== 'granted') throw Error('Sin acceso a los sensores de movimiento. Permítelos en Safari para medir la pared.');
      this.startFusedSensor(); // Android: cuaternión a 60 Hz (más estable)
      window.addEventListener('deviceorientation', this.onOrientation);
      await new Promise(r => setTimeout(r, 900));
      if (!this.sensorSeen) throw Error('Este dispositivo no entrega sensores de movimiento. Usa un teléfono con giroscopio.');
      try { this.wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }
      this.setPill('Cargando visión por computador…');
      const ok = await Promise.race([cv, new Promise(r => setTimeout(() => r(null), 25000))]);
      this.busy(false);
      this.refreshWall();
      if (ok) this.enterScan(); else { this.toast('Detección automática no disponible: marca la línea a mano'); this.enterManual(); }
      this.loop();
    } catch (e) {
      this.busy(false); this.stopCamera();
      this.setPill('No se pudo iniciar');
      this.setBottom(`<div class="ra-card"><h2>No pudimos abrir la cámara</h2><p>${e.name === 'NotAllowedError' ? 'Permite el acceso a la cámara en tu navegador y vuelve a intentarlo.' : e.message}</p>
        <div class="ra-row"><button class="ra-btn primary" data-act="start">Reintentar</button></div>
        ${this.host.usePhoto ? '<div class="ra-row"><button class="ra-btn ghost" data-act="close">Usar una foto en el estudio</button></div>' : ''}</div>`);
    }
  }
  // RelativeOrientationSensor (Chrome Android): fusión giroscopio + acelerómetro
  // entregada como cuaternión, sin la singularidad de Euler con el teléfono
  // vertical. Si no existe o no hay permiso, se usa DeviceOrientationEvent.
  startFusedSensor() {
    if (typeof RelativeOrientationSensor === 'undefined') return;
    try {
      const sensor = new RelativeOrientationSensor({ frequency: 60, referenceFrame: 'device' });
      sensor.addEventListener('reading', () => {
        if (!sensor.quaternion) return;
        if (!this.fusedSensor) { this.fusedSensor = true; this.orient = new OrientationBuffer(); this.euro.reset(); } // un solo marco de referencia
        this.sensorSeen = true;
        const t = Number.isFinite(sensor.timestamp) && Math.abs(sensor.timestamp - performance.now()) < 1000 ? sensor.timestamp : performance.now();
        this.orient.push(t, V.quatFromSensor(sensor.quaternion, screenAngle()));
      });
      sensor.addEventListener('error', () => { try { sensor.stop(); } catch { /* ya detenido */ } if (this.fusedSensor) { this.fusedSensor = false; this.orient = new OrientationBuffer(); this.euro.reset(); } });
      sensor.start(); this.sensor = sensor;
    } catch { /* sin permiso o no soportado: DeviceOrientationEvent */ }
  }
  enterScan() { this.tracker = null; this.state = 'scan'; this.track = null; this.pending = null; this.misses = 0; this.history = []; this.baseboard = 0; this.sqAcc = null; this.squareness = null; this.detection = null; this.anchor = null; this.wall.visible = false; this.tool = 'move'; this.renderScan(); }
  enterManual() {
    this.state = 'manual'; this.wall.visible = false; const W = this.root.clientWidth, H = this.root.clientHeight;
    const y = this.detection?.base ? null : H * 0.68;
    this.handles = this.detection?.base ? this.lineEndpoints(this.detection.base).map(p => [Math.min(W - 40, Math.max(40, p[0])), Math.min(H - 160, Math.max(140, p[1]))]) : [[W * 0.2, y], [W * 0.8, y]];
    this.renderManual();
  }
  fix() {
    let line = null;
    if (this.state === 'manual') line = this.manualLine();
    else if (this.detection?.base) {
      // Promedio de las últimas detecciones coherentes.
      const ref = this.detection.base, last = this.history.filter(Boolean).slice(-6).filter(l => Math.abs(V.angleDiff(l.theta, ref.theta)) < 3 * DEG && Math.abs(l.rho - ref.rho) < 0.05 * ref.rho);
      line = { theta: ref.theta + last.reduce((s, l) => s + V.angleDiff(l.theta, ref.theta), 0) / Math.max(1, last.length), rho: last.reduce((s, l) => s + l.rho, 0) / Math.max(1, last.length) || ref.rho };
    }
    if (!line) { this.toast('Aún no hay una línea: apunta al encuentro piso–pared'); return; }
    this.anchor = line; this.tracker = new AnchorTracker(line);
    const aim = V.pixelToWall(this.cam(), line, this.root.clientWidth / 2, this.root.clientHeight / 2);
    this.s0 = aim ? aim.s : 0; this.lift = 0;
    // Primer paso tras fijar la pared: medir y colocar la muralla.
    this.state = 'placed'; this.tool = 'measure'; this.measure = { kind: 'wall', points: [] }; this.refreshWall(); this.renderMeasure();
    navigator.vibrate?.(30);
    this.toast('Pared fijada · ahora mide dónde va tu muralla');
  }
  manualLine() {
    const cam = this.cam(), [a, b] = this.handles, P1 = V.pixelToFloor(cam, ...a), P2 = V.pixelToFloor(cam, ...b);
    if (!P1 || !P2 || V.distance3(P1, P2) < 0.05) return null;
    return V.floorLineFromPoints(P1, P2);
  }

  // ---------------- cámara virtual ----------------
  cam() {
    const W = this.root.clientWidth, H = this.root.clientHeight, src = this.source;
    const vw = src?.videoWidth || W, vh = src?.videoHeight || H;
    return { ...V.intrinsicsFor(vw, vh, W, H, this.focalFactor), h: this.h, q: this.q };
  }
  // Orientación del instante de captura del cuadro, con filtro adaptativo
  // (suaviza el ruido con el teléfono quieto, no agrega retardo al moverlo).
  updateOrientation(tCapture) {
    const q = this.orient.at(tCapture); if (!q) return;
    this.q = this.euro(q, tCapture);
  }
  refreshWall() {
    for (const c of [...this.wall.children]) { this.wall.remove(c); c.geometry?.dispose(); c.material?.dispose(); }
    const sources = this.host.getMeshes(); if (!sources.length) return;
    // Piezas + plano de cantería. La caja de las piezas define la base.
    sources[0].geometry.computeBoundingBox(); const bb = sources[0].geometry.boundingBox;
    this.wallSize = { w: bb.max.x - bb.min.x, h: bb.max.y - bb.min.y };
    for (const src of sources) {
      const mesh = new THREE.Mesh(src.geometry.clone(), src.material.clone());
      mesh.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, 0.002 + src.position.z); // base sobre el encuentro, centrado en s0
      this.wall.add(mesh);
    }
  }
  lineEndpoints(line, cam = this.cam()) {
    // Puntos visibles de la línea (para dibujarla de borde a borde).
    const pts = []; for (let s = -12; s <= 12; s += 0.25) { const p = V.project(cam, V.pointOnBase(line, s)); if (p && p[0] > -200 && p[0] < cam.width + 200 && p[1] > -200 && p[1] < cam.height + 200) pts.push(p); }
    return pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : [[cam.width * 0.2, cam.height * 0.7], [cam.width * 0.8, cam.height * 0.7]];
  }

  // ---------------- bucle ----------------
  // Bucle: si el navegador avisa cada cuadro nuevo del video
  // (requestVideoFrameCallback), se dibuja exactamente con ese cuadro y con la
  // orientación del instante en que se capturó. Si no, se usa
  // requestAnimationFrame con una latencia estimada.
  loop() {
    const v = this.video;
    if (v?.requestVideoFrameCallback) {
      const onVideo = (now, meta) => {
        if (this.closed) return;
        this.vfc = v.requestVideoFrameCallback(onVideo);
        let tCap = meta?.captureTime;
        const shown = meta?.expectedDisplayTime ?? now;
        if (Number.isFinite(tCap) && tCap <= shown && shown - tCap < 500) this.latency = this.latency * 0.9 + (shown - tCap) * 0.1;
        else tCap = shown - this.latency;
        this.lastVideoFrame = now; this.frame(now, tCap);
      };
      this.vfc = v.requestVideoFrameCallback(onVideo);
    }
    const onAnimation = t => {
      if (this.closed) return;
      this.raf = requestAnimationFrame(onAnimation);
      if (t - this.lastVideoFrame < 250) return; // el video manda; esto es respaldo
      this.frame(t, t - this.latency);
    };
    this.raf = requestAnimationFrame(onAnimation);
  }
  frame(t, tCap) {
    const dt = this.lastFrameT ? Math.min(100, t - this.lastFrameT) : 16; this.lastFrameT = t;
    this.resize();
    this.updateOrientation(tCap);
    const cam = this.cam();
    // Frecuencia adaptativa: nunca más del ~40 % del tiempo en visión.
    const interval = Math.max(this.state === 'scan' ? 110 : this.state === 'placed' ? 150 : 1e9, 2.5 * (this.detectMs || 0));
    if (this.detector && t - this.lastDetect > interval) { this.lastDetect = t; const t0 = performance.now(); this.detect(cam, t); this.detectMs = (this.detectMs || 0) * 0.7 + (performance.now() - t0) * 0.3; }
    if (this.tracker && this.state === 'placed') this.anchor = this.tracker.step(dt);
    this.lum += (this.lumTarget - this.lum) * (1 - Math.exp(-dt / 800)); // luz sin parpadeo
    if (this.toastUntil && t > this.toastUntil) this.toastUntil = 0;
    this.guidance(cam, !this.toastUntil); // los avisos breves tienen prioridad sobre la guía
    this.renderWall(cam); this.drawHud(cam);
  }
  resize() {
    const W = this.root.clientWidth, H = this.root.clientHeight, dpr = Math.min(devicePixelRatio, 2);
    if (this.size?.[0] === W && this.size?.[1] === H) return; this.size = [W, H];
    this.renderer.setSize(W, H, false); this.hud.width = W * dpr; this.hud.height = H * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  detect(cam, t = performance.now()) {
    let res; try { res = this.detector.detect(this.video, cam.width, cam.height); } catch (e) { console.warn('[RA] detección', e); return; }
    if (!res) return;
    this.lumTarget = res.luminance; this.lastSegments = res.segments;
    const prev = this.state === 'placed' ? this.anchor : this.detection?.base;
    const det = V.findWallBase(cam, res.segments, { prev }); this.lastDet = det;
    if (det.base?.baseboard && !det.base.corrected) this.baseboard = det.base.baseboard; // recuerda la altura del zócalo
    else if (det.base && this.baseboard) det.base = V.correctForBaseboard(det.base, this.baseboard, cam.h, prev);
    // Segundo detector: la pared por sus líneas horizontales. Afina la
    // orientación del encuentro y, con la muralla fijada, sigue corrigiendo
    // la orientación aunque el piso salga del cuadro.
    const ref = det.base || (this.state === 'placed' ? this.anchor : null);
    const wall = ref ? V.wallOrientation(cam, ref, res.segments) : null;
    this.wallSegments = wall?.segments ?? null;
    if (det.base) det.base = V.fuseOrientation(cam, det.base, wall);
    if (this.state === 'scan') {
      // Seguimiento con confirmación: una línea distinta debe repetirse 3 cuadros
      // antes de reemplazar a la actual (evita saltos por un cuadro ruidoso).
      const same = (a, b) => a && b && Math.abs(V.angleDiff(a.theta, b.theta)) < 3 * DEG && Math.abs(a.rho - b.rho) < 0.05 * b.rho;
      const obs = det.base;
      if (obs && (!this.track || same(obs, this.track))) { this.track = obs; this.pending = null; this.misses = 0; }
      else if (obs) {
        this.pending = this.pending && same(obs, this.pending.line) ? { line: obs, n: this.pending.n + 1 } : { line: obs, n: 1 };
        if (this.pending.n >= 3) { this.track = obs; this.pending = null; this.misses = 0; } else this.misses = (this.misses || 0) + 1;
      } else this.misses = (this.misses || 0) + 1;
      if (this.misses > 8) this.track = null;
      const tracked = this.track && same(obs, this.track) ? obs : this.track;
      this.history.push(tracked ? { theta: tracked.theta, rho: tracked.rho } : null); if (this.history.length > 12) this.history.shift();
      this.detection = tracked ? { ...det, base: tracked, second: tracked === obs ? det.second : null } : null;
      if (tracked === obs && obs) {
        // Ángulo piso–muro: promedio ponderado (1/σ²) de las mediciones observables.
        const sq = V.squareness(cam, det.base, res.segments);
        if (sq.measured) {
          const w = 1 / Math.max(0.05, sq.uncertainty) ** 2, acc = this.sqAcc = this.sqAcc || { sum: 0, w: 0, n: 0 };
          acc.sum += sq.angle * w; acc.w += w; acc.n++;
          this.squareness = { measured: true, angle: acc.sum / acc.w, uncertainty: Math.max(0.3, sq.uncertainty / Math.sqrt(Math.min(acc.n, 6))) };
        } else if (!this.squareness?.measured) this.squareness = sq;
        this.corner = det.second ? V.cornerAngle(det.base, det.second) : null;
        const f = V.estimateFocal(cam, res.segments);
        if (f) { this.focalFactor = Math.max(0.6, Math.min(1.0, this.focalFactor * 0.9 + (f.f / cam.f * this.focalFactor) * 0.1)); store.set('cs-ra-focal', this.focalFactor); }
      }
      const btn = this.bottom.querySelector('[data-act=fix]'); if (btn) btn.disabled = !this.detection?.base;
    } else if (this.state === 'placed' && this.tracker) {
      // Re-anclaje continuo: mediana de las últimas detecciones, sin corregir
      // el ruido pequeño y aplicada cuadro a cuadro (ver AnchorTracker).
      if (det.base) this.tracker.observe(det.base, t);
      else if (wall) this.tracker.observeOrientation(wall.theta, t, V.pixelToWall(cam, this.anchor, cam.width / 2, cam.height / 2)?.s ?? 0);
    }
  }
  guidance(cam, showText = true) {
    const pitch = V.cameraPitch(cam.q);
    let text;
    if (this.state === 'scan') {
      const stable = V.isStable(this.history, 5);
      if (pitch < 4) text = 'Inclina el teléfono hacia el piso';
      else if (pitch > 72) text = 'Levanta un poco el teléfono';
      else if (!this.detection?.base) text = 'Apunta a la unión del piso con la pared';
      else text = stable ? 'Línea encontrada · toca «Fijar pared»' : 'Mantén el teléfono quieto…';
      const chips = [];
      if (this.detection?.base) {
        chips.push([`Pared a ${fmt(this.detection.base.rho, 1)} m`]);
        // Ángulo piso–muro: "≈ 90°" dentro de la tolerancia (evita falsa precisión);
        // el valor exacto solo se muestra cuando el muro parece fuera de plomo.
        const sq = this.squareness;
        if (sq?.measured) chips.push(Math.abs(sq.angle - 90) <= Math.max(2, 2 * sq.uncertainty) ? ['Piso–pared ≈ 90° ✓', 'ok'] : [`Piso–pared ${fmt(sq.angle, 1)}° · revisa el plomo`, 'warn']);
        else chips.push(['Piso–pared 90° (a plomo)']);
        // En un muro con hiladas, la primera junta se parece a un zócalo: no se informa.
        if (this.baseboard && !(this.detection.base.wallLines >= 6)) chips.push([`Zócalo ${fmt(this.baseboard * 100, 0)} cm`]);
        if (this.detection.base.wallConfirmed && this.detection.base.wallLines >= 3) chips.push([`Pared confirmada · ${this.detection.base.wallLines} líneas`, 'ok']);
      }
      this.setChips(chips);
    } else if (this.state === 'manual') {
      text = 'Arrastra los puntos sobre la unión piso–pared';
      const l = this.manualLine(); this.setChips(l ? [[`Pared a ${fmt(l.rho, 1)} m`]] : []);
    } else if (this.state === 'placed') {
      const s = this.host.getOptions().state;
      const n = this.measure.points.length;
      text = this.tool === 'measure' ? (this.measure.kind === 'wall' ? ['Toca un extremo del muro, a ras de piso', 'Toca el otro extremo', 'Toca la altura a revestir', 'Revisa las medidas'][Math.min(n, 3)] : 'Medición de piso') : this.tool === 'design' ? 'Editando tu diseño' : 'Arrastra para mover tu muralla';
      this.setChips([[`${fmt(s.width)} × ${fmt(s.height)} m`], [`Pared a ${fmt(this.anchor.rho, 1)} m`]]);
    }
    if (text && showText) this.setPill(text);
  }
  renderWall(cam) {
    this.camera.fov = V.verticalFov(cam); this.camera.aspect = cam.width / cam.height; this.camera.near = 0.02; this.camera.updateProjectionMatrix();
    this.camera.position.set(0, cam.h, 0); this.camera.quaternion.set(...cam.q); this.camera.updateMatrixWorld();
    if (this.anchor && this.state === 'placed') this.wall.matrix.fromArray(V.wallMatrix(this.anchor, this.s0, this.lift, 0)), this.wall.matrixWorldNeedsUpdate = true;
    this.wall.visible = this.state === 'placed' && !this.comparing && !(this.tool === 'measure' && this.measure.kind === 'wall'); // al medir se ve la pared real y la vista previa
    this.hemi.intensity = 1.2 + 1.6 * this.lum; this.sun.intensity = 0.6 + 1.6 * this.lum; // luz aproximada a la escena real
    this.renderer.render(this.scene, this.camera);
  }
  drawHud(cam) {
    const g = this.ctx, W = cam.width, H = cam.height; g.clearRect(0, 0, W, H);
    const line = (a, b, color, width, dash = []) => { g.save(); g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash); g.lineCap = 'round'; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); g.restore(); };
    const label = (p, text, bg = '#000c') => { g.save(); g.font = '600 13px Inter,system-ui,sans-serif'; const w = g.measureText(text).width + 16; g.fillStyle = bg; g.beginPath(); g.roundRect(p[0] - w / 2, p[1] - 14, w, 28, 14); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, p[0], p[1] + 1); g.restore(); };
    const dot = (p, r = 7, color = '#fff') => { g.save(); g.fillStyle = color; g.strokeStyle = '#d22c21'; g.lineWidth = 3; g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore(); };
    if (this.debug && this.lastSegments) for (const s of this.lastSegments) line([s.x1, s.y1], [s.x2, s.y2], s.contrast > 0.25 ? '#ff5050' : '#50ff8080', 1.5);
    if (this.state === 'scan') {
      // Mira central
      g.save(); g.strokeStyle = '#fffc'; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, H / 2, 16, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(W / 2, H / 2, 2.5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.restore();
      const b = this.detection?.base;
      // Líneas con que el detector de pared confirmó el muro (tenues).
      if (b?.wallConfirmed && this.wallSegments) for (const s of [...this.wallSegments].sort((p, q) => V.segLength(q) - V.segLength(p)).slice(0, 24)) line([s.x1, s.y1], [s.x2, s.y2], '#ffffff40', 1.5);
      if (b) {
        const stable = V.isStable(this.history, 5), [a, c] = this.lineEndpoints(b, cam);
        line(a, c, stable ? '#d22c21aa' : '#ffffff55', 12); line(a, c, '#fff', 3, stable ? [] : [10, 8]);
        if (this.detection.second) { const [a2, c2] = this.lineEndpoints(this.detection.second, cam); line(a2, c2, '#ffffff99', 2, [6, 6]); }
        const mid = V.project(cam, V.pointOnBase(b, (V.pixelToWall(cam, b, W / 2, H / 2)?.s) ?? 0)); if (mid) label([mid[0], mid[1] - 26], `${fmt(b.rho, 2)} m`);
      }
    } else if (this.state === 'manual' && this.handles) {
      line(this.handles[0], this.handles[1], '#fff', 3);
      for (const p of this.handles) dot(p, 22, '#d22c2166');
    } else if (this.state === 'placed' && this.tool === 'measure') {
      const pts = this.measure.points.map(p => p.P ? V.project(cam, p.P) : V.project(cam, V.add(V.pointOnBase(this.anchor, p.s), [0, p.y, 0])));
      if (this.measure.kind === 'wall') {
        const [A, B, C] = this.measure.points;
        if (A && B) { const a = V.project(cam, V.pointOnBase(this.anchor, A.s)), b = V.project(cam, V.pointOnBase(this.anchor, B.s)); if (a && b) { line(a, b, '#fff', 3); label([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 24], `${fmt(Math.abs(B.s - A.s))} m`); } }
        if (A && B && C) {
          // Vista previa del lugar donde quedará la muralla.
          const q = [[A.s, 0], [B.s, 0], [B.s, C.y], [A.s, C.y]].map(([s, y]) => V.project(cam, V.add(V.pointOnBase(this.anchor, s), [0, y, 0])));
          if (q.every(Boolean)) { g.save(); g.fillStyle = '#d5131433'; g.strokeStyle = '#d51314'; g.lineWidth = 2.5; g.setLineDash([8, 6]); g.beginPath(); q.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.closePath(); g.fill(); g.stroke(); g.restore(); }
        }
        if (A && B && C) { const sMid = (A.s + B.s) / 2, b0 = V.project(cam, V.pointOnBase(this.anchor, sMid)), t = V.project(cam, V.add(V.pointOnBase(this.anchor, sMid), [0, C.y, 0])); if (b0 && t) { line(b0, t, '#fff', 3, [8, 6]); label([t[0], t[1] - 22], `${fmt(C.y)} m`); } }
      } else if (pts.length > 1) {
        g.save(); g.fillStyle = '#d22c2140'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); pts.forEach((p, i) => p && (i ? g.lineTo(...p) : g.moveTo(...p))); if (pts.length > 2) { g.closePath(); g.fill(); } g.stroke(); g.restore();
      }
      for (const p of pts) if (p) dot(p);
    }
  }

  // ---------------- gestos ----------------
  pointerDown(e) {
    if (e.target.closest('.ra-bottom,.ra-top,button,input')) {
      if (e.target.closest('[data-act=compare]')) { this.comparing = true; e.preventDefault(); }
      return;
    }
    const p = [e.clientX - this.root.getBoundingClientRect().left, e.clientY - this.root.getBoundingClientRect().top];
    if (this.state === 'manual' && this.handles) {
      const i = this.handles.findIndex(h => Math.hypot(h[0] - p[0], h[1] - p[1]) < 44);
      if (i >= 0) { this.drag = { kind: 'handle', i }; capturePointer(this.root, e.pointerId); }
      return;
    }
    if (this.state !== 'placed') return;
    const cam = this.cam();
    if (this.tool === 'measure') {
      if (this.measure.kind === 'wall') { if (this.measure.points.length >= 3) return; const w = V.pixelToWall(cam, this.anchor, ...p); if (w) this.measure.points.push({ s: w.s, y: w.y }); }
      else { const P = V.pixelToFloor(cam, ...p); if (P && V.dot([Math.cos(this.anchor.theta), 0, Math.sin(this.anchor.theta)], P) <= this.anchor.rho + 0.05) this.measure.points.push({ P }); }
      navigator.vibrate?.(10); this.renderMeasure(); return;
    }
    if (this.tool === 'move') { const w = V.pixelToWall(cam, this.anchor, ...p); if (w) { this.drag = { kind: 'wall', start: w, s0: this.s0, lift: this.lift }; capturePointer(this.root, e.pointerId); } }
  }
  pointerMove(e) {
    if (!this.drag) return;
    const r = this.root.getBoundingClientRect(), p = [e.clientX - r.left, e.clientY - r.top];
    if (this.drag.kind === 'handle') { this.handles[this.drag.i] = [Math.max(10, Math.min(r.width - 10, p[0])), Math.max(10, Math.min(r.height - 10, p[1]))]; return; }
    if (this.drag.kind === 'wall') {
      const w = V.pixelToWall(this.cam(), this.anchor, ...p); if (!w) return;
      this.s0 = this.drag.s0 + (w.s - this.drag.start.s);
      const lift = this.drag.lift + (w.y - this.drag.start.y); this.lift = lift < 0.04 ? 0 : Math.min(3, lift); // imán al piso
    }
  }
  pointerUp() { this.drag = null; this.comparing = false; }

  // ---------------- captura ----------------
  async capture() {
    const W = this.root.clientWidth, H = this.root.clientHeight, dpr = Math.min(devicePixelRatio, 2), c = document.createElement('canvas');
    c.width = W * dpr; c.height = H * dpr; const g = c.getContext('2d');
    const src = this.video, vw = src.videoWidth, vh = src.videoHeight, s = Math.max(W / vw, H / vh), sw = W / s, sh = H / s;
    g.drawImage(src, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    this.renderWall(this.cam()); g.drawImage(this.gl, 0, 0, c.width, c.height);
    const summary = this.host.getOptions().caption; g.scale(dpr, dpr);
    g.fillStyle = '#000a'; g.fillRect(0, H - 54, W, 54); g.fillStyle = '#fff'; g.font = '700 14px Inter,system-ui,sans-serif'; g.fillText('Cerámica Santiago', 14, H - 31); g.font = '500 12px Inter,system-ui,sans-serif'; g.fillText(summary, 14, H - 13);
    const flash = this.root.querySelector('.ra-flash'); flash.style.transition = 'none'; flash.style.opacity = '0.8'; requestAnimationFrame(() => { flash.style.transition = ''; flash.style.opacity = '0'; });
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9)); if (!blob) return;
    const file = new File([blob], 'mi-muralla-ceramica-santiago.jpg', { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Mi muralla · Cerámica Santiago' }); return; } catch { /* cancelado: se descarga */ } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    this.toast('Foto guardada');
  }

  // ---------------- cierre ----------------
  stopCamera() {
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = null; window.removeEventListener('deviceorientation', this.onOrientation);
    try { this.sensor?.stop(); } catch { /* ya detenido */ } this.sensor = null;
  }
  close() {
    if (this.closed) return; this.closed = true; cancelAnimationFrame(this.raf); if (this.vfc) this.video?.cancelVideoFrameCallback?.(this.vfc); this.stopCamera();
    this.wakeLock?.release?.().catch(() => {}); document.removeEventListener('keydown', this.keydown);
    this.detector?.dispose(); this.refreshWall = () => {};
    for (const c of this.wall.children) { c.geometry?.dispose(); c.material?.dispose(); }
    this.renderer.dispose(); this.root.remove(); this.opts.onClose?.();
  }
}
// Cede un cuadro para mostrar el indicador antes de un cálculo pesado (con
// respaldo por si la pestaña está en segundo plano y no hay cuadros).
const tick = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 80); });
const screenAngle = () => screen.orientation?.angle ?? window.orientation ?? 0;
// Instante del evento en el reloj de performance.now (algunos navegadores
// antiguos entregan milisegundos de época).
const eventTime = e => Number.isFinite(e.timeStamp) && Math.abs(e.timeStamp - performance.now()) < 1000 ? e.timeStamp : performance.now();
const capturePointer = (el, id) => { try { el.setPointerCapture(id); } catch { /* puntero sintético o ya liberado */ } };

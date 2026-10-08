// =====================================================================
// RA · Paso a paso «Medir y colocar», con ilustraciones de línea al estilo
// de un instructivo de armado: trazo negro, un solo acento rojo, sin texto
// dentro del dibujo y un número grande por paso. SVG puro (sin archivos).
// =====================================================================
const INK = '#1f1f1f', RED = '#d51314';

// Escena base: muro de frente y piso en perspectiva; el encuentro en y = 80.
const room = `
  <path d="M28 80 L12 112 M144 80 L158 112" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M12 112 H158" stroke="${INK}" stroke-width="1.2" stroke-dasharray="2 4" fill="none"/>
  <rect x="28" y="10" width="116" height="70" fill="#fff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M44 98 H128 M34 106 H138" stroke="${INK}" stroke-width="1" opacity=".25"/>`;
// Dedo que toca (la punta queda en x, y).
const finger = (x, y, flip = false) => `
  <g transform="translate(${x} ${y}) ${flip ? 'scale(-1 1)' : ''}">
    <path d="M0 0 c2.6 0 4.6 2 4.6 4.6 v13 c1.6-1.6 5.6-1.6 6.6 1 c1.8-1.6 5.6-1.2 6.4 1.8 c2-1 5.6 .2 5.6 3.8 v10.4 c0 8-6 13.4-13.6 13.4 h-3.2 c-5.6 0-8.4-2.6-11.2-7.2 l-6.6-10.6 c-1.8-3 1.2-5.8 4-3.8 l3.8 3.6 v-25.4 c0-2.6 1.8-4.6 3.6-4.6 z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  </g>`;
const tap = (x, y) => `<circle cx="${x}" cy="${y}" r="10" fill="none" stroke="${RED}" stroke-width="1.6" opacity=".35"/><circle cx="${x}" cy="${y}" r="6.5" fill="none" stroke="${RED}" stroke-width="1.8" opacity=".7"/><circle cx="${x}" cy="${y}" r="3.6" fill="${RED}"/>`;
const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="3.6" fill="${RED}"/><circle cx="${x}" cy="${y}" r="6.5" fill="none" stroke="${RED}" stroke-width="1.6"/>`;
const hDim = (x1, x2, y) => `<path d="M${x1} ${y} H${x2} M${x1} ${y - 4} V${y + 4} M${x2} ${y - 4} V${y + 4} M${x1 + 6} ${y - 3} L${x1} ${y} L${x1 + 6} ${y + 3} M${x2 - 6} ${y - 3} L${x2} ${y} L${x2 - 6} ${y + 3}" stroke="${RED}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const vDim = (x, y1, y2) => `<path d="M${x} ${y1} V${y2} M${x - 4} ${y1} H${x + 4} M${x - 4} ${y2} H${x + 4} M${x - 3} ${y2 + 6} L${x} ${y2} L${x + 3} ${y2 + 6} M${x - 3} ${y1 - 6} L${x} ${y1} L${x + 3} ${y1 - 6}" stroke="${RED}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const bricks = (x, y, w, h) => {
  let d = ''; const ch = 7;
  for (let r = 0, yy = y + h; yy > y + 0.5; r++, yy -= ch) {
    const top = Math.max(y, yy - ch); d += `M${x} ${top} H${x + w} `;
    for (let xx = x + (r % 2 ? 9 : 0); xx < x + w; xx += 18) if (xx > x) d += `M${xx} ${top} V${yy} `;
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fbe3df" stroke="${RED}" stroke-width="2"/><path d="${d}" stroke="${RED}" stroke-width="1" opacity=".75" fill="none"/>`;
};
const phone = `
  <rect x="50" y="18" width="60" height="96" rx="10" fill="#fff" stroke="${INK}" stroke-width="2.4"/>
  <rect x="55" y="28" width="50" height="70" rx="3" fill="#f3f3f1" stroke="${INK}" stroke-width="1.4"/>
  <rect x="55" y="28" width="50" height="40" fill="#fff"/><path d="M55 68 L52 98 M105 68 L108 98" stroke="${INK}" stroke-width="1" opacity=".3"/>
  <path d="M55 68 H105" stroke="${RED}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="80" cy="48" r="5" fill="none" stroke="${INK}" stroke-width="1.4"/><circle cx="80" cy="48" r="1.2" fill="${INK}"/>
  <rect x="62" y="85" width="36" height="9" rx="4.5" fill="${RED}"/>
  <path d="M74 106 H86" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
const check = (x, y) => `<circle cx="${x}" cy="${y}" r="11" fill="${RED}"/><path d="M${x - 5} ${y} l3.6 3.6 l6.4 -7" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

export const MEASURE_STEPS = [
  { title: 'Apunta a la unión del piso con la pared y toca «Fijar pared».', art: `${phone}${finger(82, 91)}` },
  { title: 'Toca un extremo del muro, a ras de piso.', art: `${room}${tap(42, 80)}${finger(42, 80)}` },
  { title: 'Toca el otro extremo.', art: `${room}${dot(42, 80)}${hDim(42, 128, 66)}${tap(128, 80)}${finger(128, 80, true)}` },
  { title: 'Toca la altura que quieres revestir.', art: `${room}${dot(42, 80)}${dot(128, 80)}${vDim(116, 80, 34)}${tap(128, 34)}${finger(128, 34)}` },
  { title: 'Tu muralla queda con esas medidas y en ese lugar. Luego cambia color y traba.', art: `${room}${bricks(42, 34, 86, 46)}${check(140, 22)}` }
];

export function stepSVG(i, size = 160) {
  const s = MEASURE_STEPS[i];
  return `<svg viewBox="0 0 160 120" width="${size}" height="${Math.round(size * 0.75)}" role="img" aria-label="Paso ${i + 1}: ${s.title}"><text x="4" y="22" font-family="Helvetica Neue,Arial,sans-serif" font-weight="800" font-size="19" fill="${INK}">${i + 1}</text>${s.art}</svg>`;
}

// Tira horizontal con todos los pasos (desliza). Clases: .rt-*
export const TUTORIAL_CSS = `
.rt-strip{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 8px;margin:0 -2px;scrollbar-width:none}
.rt-strip::-webkit-scrollbar{display:none}
.rt-step{flex:none;width:min(62vw,200px);scroll-snap-align:start;background:#fff;border:1px solid #e3e3e0;border-radius:6px;padding:8px 8px 10px;color:#1f1f1f}
.rt-step svg{display:block;width:100%;height:auto}
.rt-step p{margin:6px 2px 0;font-size:12.5px;line-height:1.35;font-weight:600;color:#1f1f1f}
.rt-dots{display:flex;justify-content:center;gap:5px;margin-top:2px}.rt-dots i{width:6px;height:6px;border-radius:50%;background:#cfcfca}.rt-dots i.on{background:#d51314}
.rt-now{display:flex;align-items:center;gap:12px}.rt-now svg{flex:none;width:96px;height:72px;background:#fff;border-radius:6px;border:1px solid #e3e3e0}
.rt-now b{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#d51314}.rt-now span{display:block;font-size:15px;font-weight:700;line-height:1.3;color:#1f1f1f}`;
export function tutorialStrip() {
  return `<div class="rt-strip" role="list">${MEASURE_STEPS.map((s, i) => `<div class="rt-step" role="listitem">${stepSVG(i)}<p>${s.title}</p></div>`).join('')}</div>`;
}
// Paso actual con su dibujo (para la guía dentro de la cámara).
export function stepNow(i, total = 4, label = 'Paso') {
  return `<div class="rt-now">${stepSVG(i, 96)}<div><b>${label} ${i + 1} de ${total}</b><span>${MEASURE_STEPS[i].title}</span></div></div>`;
}

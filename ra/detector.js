// =====================================================================
// RA · Detector de segmentos con OpenCV.js
// Canny con umbrales adaptativos al gradiente + HoughLinesP probabilística.
// Cada segmento lleva un "contraste de región": diferencia de color medio y
// de textura entre franjas a ambos lados. Un encuentro piso–muro separa dos
// materiales (contraste alto); una junta de baldosa o de mortero no.
// Parámetros espejo en tests/ra_pipeline.py (validación con OpenCV nativo).
// =====================================================================

export const DETECTOR_PARAMS = Object.freeze({
  analysisWidth: 400,      // px de análisis (el video se reduce antes de procesar)
  blur: 5,                 // Gaussiano 5×5
  gradPercentile: 0.90,    // umbral alto de Canny = percentil del gradiente
  hiMin: 28, hiMax: 140, loRatio: 0.4,
  houghThreshold: 0.07,    // × ancho de análisis
  minLineLength: 0.09,     // × ancho de análisis
  maxLineGap: 0.025,       // × ancho de análisis
  bandNear: 3, bandFar: 10, bandEdge: 0.1, samples: 14
});

let cvPromise = null;
// Carga perezosa: OpenCV.js (~9 MB sin comprimir) solo se descarga al abrir la RA.
// Devuelve { cv }. IMPORTANTE: nunca resolver una promesa CON el módulo de
// OpenCV: el módulo Emscripten trae su propio .then(), que se llama a sí mismo
// y deja la página colgada en un bucle infinito de microtareas.
export function loadOpenCV(urls, timeoutMs = 45000) {
  if (cvPromise) return cvPromise;
  const list = Array.isArray(urls) ? urls : [urls];
  cvPromise = (async () => {
    if (globalThis.cv?.Mat && globalThis.cv?.calledRun !== false) return { cv: globalThis.cv };
    let lastError;
    for (const url of list) {
      try { await injectScript(url, timeoutMs); return await readyCV(timeoutMs); }
      catch (e) { lastError = e; }
    }
    throw lastError || Error('OpenCV no disponible');
  })();
  cvPromise.catch(() => { cvPromise = null; });
  return cvPromise;
}
function injectScript(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.async = true; s.src = url;
    const t = setTimeout(() => reject(Error('Tiempo agotado al descargar OpenCV')), timeoutMs);
    s.onload = () => { clearTimeout(t); resolve(); };
    s.onerror = () => { clearTimeout(t); s.remove(); reject(Error('No se pudo descargar OpenCV')); };
    document.head.append(s);
  });
}
async function readyCV(timeoutMs) {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(Error('OpenCV no terminó de inicializar')), timeoutMs));
  let cv = globalThis.cv;
  // Algunas compilaciones exponen una Promise real que entrega el módulo.
  if (cv instanceof Promise) { cv = await Promise.race([cv.then(m => ({ m })), timeout]).then(r => r.m); globalThis.cv = cv; }
  // Otras exponen el módulo con .then(callback): se espera sin adoptar el módulo.
  if (cv && typeof cv.then === 'function') await Promise.race([new Promise(r => cv.then(() => r())), timeout]);
  const start = performance.now();
  while (!globalThis.cv?.Mat) {
    if (performance.now() - start > timeoutMs) throw Error('OpenCV no terminó de inicializar');
    await new Promise(r => setTimeout(r, 50));
  }
  return { cv: globalThis.cv };
}

export function createDetector(cv, params = DETECTOR_PARAMS) {
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
  let src = null, rgb = null, gray = null, blur = null, edges = null, lines = null, gx = null, gy = null, w = 0, h = 0;
  function allocate(aw, ah) {
    release();
    w = aw; h = ah; canvas.width = aw; canvas.height = ah;
    src = new cv.Mat(ah, aw, cv.CV_8UC4); rgb = new cv.Mat(); gray = new cv.Mat(); blur = new cv.Mat(); edges = new cv.Mat(); lines = new cv.Mat(); gx = new cv.Mat(); gy = new cv.Mat();
  }
  function release() { for (const m of [src, rgb, gray, blur, edges, lines, gx, gy]) m?.delete(); src = rgb = gray = blur = edges = lines = gx = gy = null; }

  function cannyThresholds() {
    // Percentil del módulo del gradiente (|gx|+|gy|) sobre una submuestra.
    cv.Sobel(blur, gx, cv.CV_16S, 1, 0, 3); cv.Sobel(blur, gy, cv.CV_16S, 0, 1, 3);
    const a = gx.data16S, b = gy.data16S, hist = new Uint32Array(1024); let n = 0;
    for (let i = 0; i < a.length; i += 7) { const m = Math.min(1023, (Math.abs(a[i]) + Math.abs(b[i])) >> 2); hist[m]++; n++; }
    let acc = 0, k = 0, target = n * params.gradPercentile;
    for (; k < 1024; k++) { acc += hist[k]; if (acc >= target) break; }
    // |gx|+|gy| de Sobel 3×3 ≈ 4 × diferencia de intensidad; Canny usa L2.
    const hi = Math.max(params.hiMin, Math.min(params.hiMax, k * 4 * 0.75));
    return [hi * params.loRatio, hi];
  }

  function regionContrast(seg) {
    // Franja cercana: color medio y textura. Franja amplia: densidad de bordes.
    const g = blur.data, c = rgb.data, e = edges.data, dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1, L = Math.hypot(dx, dy) || 1;
    let nx = -dy / L, ny = dx / L; if (ny > 0) { nx = -nx; ny = -ny; } // n apunta hacia arriba en la imagen
    const sc = w / 320, near = params.bandFar * sc, far = Math.max(params.bandFar + 4, Math.round(w * params.bandEdge)), step = Math.max(1, Math.round(2 * sc));
    const A = [], B = [], A2 = [], B2 = []; let ea = 0, eb = 0, na = 0, nb = 0;
    for (let i = 0; i < params.samples; i++) {
      const t = (i + 0.5) / params.samples, x = seg.x1 + dx * t, y = seg.y1 + dy * t;
      for (let o = Math.round(params.bandNear * sc); o <= far; o += step) {
        const ax = Math.round(x + nx * o), ay = Math.round(y + ny * o), bx = Math.round(x - nx * o), by = Math.round(y - ny * o);
        if (ax >= 0 && ay >= 0 && ax < w && ay < h) { const k = ay * w + ax; na++; if (e[k]) ea++; (o <= near ? A : A2).push([c[k * 4], c[k * 4 + 1], c[k * 4 + 2], g[k]]); }
        if (bx >= 0 && by >= 0 && bx < w && by < h) { const k = by * w + bx; nb++; if (e[k]) eb++; (o <= near ? B : B2).push([c[k * 4], c[k * 4 + 1], c[k * 4 + 2], g[k]]); }
      }
    }
    // El color debe cambiar cerca Y lejos de la línea: una junta gruesa (fragüe)
    // solo cambia cerca; un encuentro piso–muro separa dos superficies amplias.
    const color = Math.min(contrastFromSamples(A, B), A2.length > 4 && B2.length > 4 ? contrastFromSamples(A2, B2) : 1), texture = na > 8 && nb > 8 ? edgeContrast(ea / na, eb / nb) : 0;
    return { contrast: 0.85 * color + 0.15 * texture, color, texture };
  }

  return {
    params,
    canvas,
    // source: <video> o <canvas>; view: tamaño CSS de la vista (cover).
    detect(source, viewW, viewH) {
      const vw = source.videoWidth || source.width, vh = source.videoHeight || source.height;
      if (!vw || !vh) return null;
      const aw = params.analysisWidth, ah = Math.round(aw * viewH / viewW);
      if (aw !== w || ah !== h) allocate(aw, ah);
      const s = Math.max(viewW / vw, viewH / vh), sw = viewW / s, sh = viewH / s;
      ctx.drawImage(source, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, aw, ah);
      src.data.set(ctx.getImageData(0, 0, aw, ah).data);
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      const ksize = new cv.Size(params.blur, params.blur);
      cv.GaussianBlur(gray, blur, ksize, 0, 0, cv.BORDER_DEFAULT);
      cv.GaussianBlur(src, rgb, ksize, 0, 0, cv.BORDER_DEFAULT);
      const [lo, hi] = cannyThresholds();
      cv.Canny(blur, edges, lo, hi, 3, true);
      cv.HoughLinesP(edges, lines, 1, Math.PI / 180, Math.round(aw * params.houghThreshold), aw * params.minLineLength, aw * params.maxLineGap);
      const k = viewW / aw, out = [], d = lines.data32S;
      let lum = 0; for (let i = 0; i < blur.data.length; i += 11) lum += blur.data[i];
      for (let i = 0; i < d.length; i += 4) {
        const seg = { x1: d[i], y1: d[i + 1], x2: d[i + 2], y2: d[i + 3] };
        const r = regionContrast(seg);
        out.push({ x1: seg.x1 * k, y1: seg.y1 * k, x2: seg.x2 * k, y2: seg.y2 * k, ...r });
      }
      return { segments: out, thresholds: [lo, hi], luminance: lum / Math.ceil(blur.data.length / 11) / 255, analysis: [aw, ah] };
    },
    dispose() { release(); }
  };
}

// Diferencia de color medio (RGB) y de textura (desviación de gris), 0…1.
// Muestras: [r, g, b, gris].
export function contrastFromSamples(A, B) {
  if (A.length < 4 || B.length < 4) return 0;
  const stats = arr => {
    const m = [0, 0, 0, 0]; for (const v of arr) for (let i = 0; i < 4; i++) m[i] += v[i];
    for (let i = 0; i < 4; i++) m[i] /= arr.length;
    let s = 0; for (const v of arr) s += (v[3] - m[3]) ** 2;
    return [m, Math.sqrt(s / arr.length)];
  };
  const [ma, sa] = stats(A), [mb, sb] = stats(B);
  const dc = Math.hypot(ma[0] - mb[0], ma[1] - mb[1], ma[2] - mb[2]) / 255;
  return Math.min(1, dc * 1.8 + Math.abs(sa - sb) / 64 * 0.5);
}
export function edgeContrast(da, db) { return Math.abs(da - db) / (da + db + 0.03); }

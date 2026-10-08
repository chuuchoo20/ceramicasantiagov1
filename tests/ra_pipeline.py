"""Renderiza habitaciones sintéticas y ejecuta el pipeline de ra/detector.js con
OpenCV nativo (mismos parámetros). Solo para validación de desarrollo.

python3 tests/ra_pipeline.py tmp/ra-cases.json tmp/ra-segments.json [carpeta_renders]
"""
import json, math, sys, os
import numpy as np
import cv2

P = dict(analysisWidth=400, blur=5, gradPercentile=0.90, hiMin=28, hiMax=140, loRatio=0.4,
         houghThreshold=0.07, minLineLength=0.09, maxLineGap=0.025, bandNear=3, bandFar=10, bandEdge=0.1, samples=14)


def quat_matrix(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def frame(theta, rho):
    m = np.array([math.cos(theta), 0, math.sin(theta)])
    to_cam = -m
    along = np.cross([0, 1, 0], to_cam); along /= np.linalg.norm(along)
    return m, to_cam, along, m * rho


def hashnoise(a, b, seed):
    v = np.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453
    return v - np.floor(v)


def render(c, ss=2):
    cam = c['cam']; W, H = int(cam['width']), int(cam['height'])
    R = quat_matrix(cam['q']); f, cx, cy, h = cam['f'], cam['cx'], cam['cy'], cam['h']
    us = (np.arange(W * ss) + 0.5) / ss; vs = (np.arange(H * ss) + 0.5) / ss
    U, Vv = np.meshgrid(us, vs)
    d = np.stack([(U - cx) / f, -(Vv - cy) / f, -np.ones_like(U)], -1) @ R.T
    C = np.array([0, h, 0.0])
    INF = 1e9
    walls = [(c['line']['theta'], c['line']['rho'], c.get('lean', 0) or 0)]
    if c.get('corner'): walls.append((c['corner']['theta'], c['corner']['rho'], 0))
    planes = []
    for (th, rho, lean) in walls:
        m, to_cam, along, foot = frame(th, rho)
        up = np.array([0, 1, 0]) * math.cos(math.radians(lean)) - to_cam * math.sin(math.radians(lean))
        n = np.cross(along, up); n /= np.linalg.norm(n)
        planes.append((m, rho, n, foot, along, up))

    def inside_all(Pt, skip=None):
        ok = np.ones(Pt.shape[:2], bool)
        for k, (m, rho, *_rest) in enumerate(planes):
            if k == skip: continue
            ok &= (Pt @ m) <= rho + 1e-6
        return ok

    best_t = np.full(U.shape, INF); kind = np.zeros(U.shape, np.int8)
    tf = np.where(d[..., 1] < -1e-6, -h / np.minimum(d[..., 1], -1e-6), INF)
    Pf = C + d * tf[..., None]
    valid = (tf < INF) & inside_all(Pf)
    best_t = np.where(valid, tf, best_t); kind = np.where(valid, 1, kind)
    for k, (m, rho, n, foot, along, up) in enumerate(planes):
        den = d @ n
        tw = np.where(np.abs(den) > 1e-6, ((foot - C) @ n) / np.where(np.abs(den) > 1e-6, den, 1), INF)
        Pw = C + d * tw[..., None]
        yv = (Pw - foot) @ up
        valid = (tw > 0) & (tw < best_t) & (yv >= -1e-6) & (yv <= 2.6) & inside_all(Pw, skip=k)
        best_t = np.where(valid, tw, best_t); kind = np.where(valid, 2 + k, kind)
    P3 = C + d * best_t[..., None]
    img = np.zeros(U.shape + (3,))
    img[:] = (0.93, 0.93, 0.92)  # techo
    # piso
    fl = kind == 1; x, z = P3[..., 0], P3[..., 2]
    if c['floor'] == 'tiles':
        s = 0.6; gx = np.abs(((x / s) % 1) - 0.5) > 0.5 - 0.004 / s; gz = np.abs(((z / s) % 1) - 0.5) > 0.5 - 0.004 / s
        tone = 0.72 + 0.06 * hashnoise(np.floor(x / s), np.floor(z / s), 1)
        col = np.stack([tone, tone * 0.96, tone * 0.9], -1); col[gx | gz] *= 0.62
    elif c['floor'] == 'wood':
        # tablas paralelas al eje X del mundo, vetas
        w = 0.14; plank = np.floor(z / w); grain = 0.05 * np.sin(x * 23 + plank * 3.1) + 0.04 * hashnoise(plank, np.floor(x / 1.2 + plank * 0.37), 3)
        tone = 0.55 + 0.08 * hashnoise(plank, 0, 5) + grain
        col = np.stack([tone, tone * 0.72, tone * 0.48], -1)
        seam = np.abs(((z / w) % 1) - 0.5) > 0.5 - 0.003 / w; col[seam] *= 0.7
    else:
        tone = 0.6 + 0.04 * hashnoise(np.floor(x * 20), np.floor(z * 20), 7)
        col = np.stack([tone, tone, tone * 0.98], -1)
    img[fl] = col[fl]
    # muros
    for k, (m, rho, n, foot, along, up) in enumerate(planes):
        wl = kind == 2 + k
        sv = (P3 - foot) @ along; yv = (P3 - foot) @ up
        if c['wall'] == 'brick' and k == 0:
            bw, bh, j = 0.24, 0.055, 0.01
            row = np.floor(yv / (bh + j)); off = (row % 2) * 0.5 * (bw + j)
            mortar = (((yv % (bh + j)) > bh) | ((((sv + off) % (bw + j))) > bw))
            tone = 0.55 + 0.07 * hashnoise(row, np.floor((sv + off) / (bw + j)), 9)
            col = np.stack([tone * 1.15, tone * 0.62, tone * 0.45], -1); col[mortar] = (0.72, 0.7, 0.66)
        else:
            base = (0.86, 0.84, 0.79) if k == 0 else (0.80, 0.80, 0.76)
            col = np.ones(U.shape + (3,)) * base
        if c.get('baseboard'):
            bb = yv < 0.085; col[bb] = (0.97, 0.97, 0.96); col[(yv > 0.083) & (yv < 0.087)] *= 0.85
        if c.get('door') and k == 0:
            for s0 in (-0.35,):
                frame_l = (np.abs(sv - s0) < 0.04) & (yv < 2.05); frame_r = (np.abs(sv - (s0 + 0.9)) < 0.04) & (yv < 2.05)
                top = (sv > s0 - 0.04) & (sv < s0 + 0.94) & (np.abs(yv - 2.05) < 0.04)
                inner = (sv > s0 + 0.04) & (sv < s0 + 0.86) & (yv < 2.01)
                col[inner] = (0.62, 0.5, 0.38); col[frame_l | frame_r | top] = (0.95, 0.95, 0.94)
        img[wl] = col[wl]
    # luz: caída suave con la distancia + ruido de sensor
    dist = np.where(best_t < INF, best_t, 6)
    shade = (0.95 - 0.07 * np.clip(dist - 1, 0, 6)) * c.get('light', 1)
    img = img * shade[..., None]
    img = cv2.resize((np.clip(img, 0, 1) * 255).astype(np.float32), (W, H), interpolation=cv2.INTER_AREA)
    img = cv2.GaussianBlur(img, (0, 0), 0.6)
    rng = np.random.default_rng(3); img += rng.normal(0, 2.5 + (1 - c.get('light', 1)) * 6, img.shape)
    return np.clip(img, 0, 255).astype(np.uint8)


def contrast_from_samples(A, B):
    """Diferencia de color medio (RGB) y de textura (desviación de gris)."""
    if len(A) < 4 or len(B) < 4: return 0.0
    A = np.array(A, float); B = np.array(B, float)
    dc = np.linalg.norm(A[:, :3].mean(0) - B[:, :3].mean(0)) / 255
    dt = abs(A[:, 3].std() - B[:, 3].std()) / 64
    return float(min(1, dc * 1.8 + dt * 0.5))


def edge_contrast(da, db):
    return float(abs(da - db) / (da + db + 0.03))


def detect(rgb, view_w):
    aw = P['analysisWidth']; ah = round(aw * rgb.shape[0] / rgb.shape[1])
    small = cv2.resize(rgb, (aw, ah), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY)
    blur = cv2.GaussianBlur(gray, (P['blur'], P['blur']), 0)
    gx = cv2.Sobel(blur, cv2.CV_16S, 1, 0, ksize=3).ravel(); gy = cv2.Sobel(blur, cv2.CV_16S, 0, 1, ksize=3).ravel()
    mag = np.minimum(1023, (np.abs(gx[::7].astype(int)) + np.abs(gy[::7].astype(int))) >> 2)
    hist = np.bincount(mag, minlength=1024); k = int(np.searchsorted(np.cumsum(hist), len(mag) * P['gradPercentile']))
    hi = max(P['hiMin'], min(P['hiMax'], k * 4 * 0.75)); lo = hi * P['loRatio']
    edges = cv2.Canny(blur, lo, hi, apertureSize=3, L2gradient=True)
    lines = cv2.HoughLinesP(edges, 1, math.pi / 180, round(aw * P['houghThreshold']), minLineLength=aw * P['minLineLength'], maxLineGap=aw * P['maxLineGap'])
    out = []; kx = view_w / aw; data = blur; rgbs = cv2.GaussianBlur(small, (P['blur'], P['blur']), 0)
    far = max(P['bandFar'] + 4, round(aw * P['bandEdge'])); sc = aw / 320
    for (x1, y1, x2, y2) in ([] if lines is None else lines.reshape(-1, 4).tolist()):
        dx, dy = x2 - x1, y2 - y1; L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        if ny > 0: nx, ny = -nx, -ny
        A, B, A2, B2 = [], [], [], []; ea = eb = na = nb = 0
        for i in range(P['samples']):
            t = (i + 0.5) / P['samples']; x = x1 + dx * t; y = y1 + dy * t
            for o in range(round(P['bandNear'] * sc), far + 1, max(1, round(2 * sc))):
                ax, ay, bx, by = round(x + nx * o), round(y + ny * o), round(x - nx * o), round(y - ny * o)
                if 0 <= ax < aw and 0 <= ay < ah:
                    na += 1; ea += edges[ay, ax] > 0
                    (A if o <= P['bandFar'] * sc else A2).append([*rgbs[ay, ax], data[ay, ax]])
                if 0 <= bx < aw and 0 <= by < ah:
                    nb += 1; eb += edges[by, bx] > 0
                    (B if o <= P['bandFar'] * sc else B2).append([*rgbs[by, bx], data[by, bx]])
        # Región: el color debe cambiar cerca Y lejos de la línea (una junta gruesa solo cambia cerca).
        cc = min(contrast_from_samples(A, B), contrast_from_samples(A2, B2) if len(A2) > 4 and len(B2) > 4 else 1.0); ec = edge_contrast(ea / max(na, 1), eb / max(nb, 1)) if na > 8 and nb > 8 else 0
        out.append(dict(x1=float(x1 * kx), y1=float(y1 * kx), x2=float(x2 * kx), y2=float(y2 * kx), contrast=0.85 * cc + 0.15 * ec, color=cc, texture=ec))
    return out, edges, (lo, hi)


if __name__ == '__main__':
    cases = json.load(open(sys.argv[1])); renders = sys.argv[3] if len(sys.argv) > 3 else None
    if renders: os.makedirs(renders, exist_ok=True)
    results = []
    for i, c in enumerate(cases):
        rgb = render(c)
        segs, edges, th = detect(rgb, rgb.shape[1])
        results.append(dict(segments=segs, thresholds=th))
        if renders:
            vis = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
            for s in segs:
                col = (40, 40, 220) if s['contrast'] > 0.2 else (60, 180, 60)
                cv2.line(vis, (int(s['x1']), int(s['y1'])), (int(s['x2']), int(s['y2'])), col, 2)
            cv2.imwrite(os.path.join(renders, f'caso{i + 1}.png'), np.hstack([cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), vis]))
    json.dump(results, open(sys.argv[2], 'w'))

#!/usr/bin/env python3
"""Prepara la foto de una terminación para el simulador 3D.

Uso:
  python3 scripts/texturas.py FOTO NOMBRE [--ranuras] [--relieve 2.2] [--suavizado 1.2]

Ejemplo:
  python3 scripts/texturas.py ~/Descargas/rustico.png rustico
  python3 scripts/texturas.py ~/Descargas/ranurado.png ranurado --ranuras --relieve 3.5 --suavizado 2

Escribe en assets/textures/NOMBRE/:
  color.jpg   1024 px, sRGB, sin el gradiente de luz de la foto y repetible sin costuras
  normal.jpg  relieve (mapa normal) calculado desde la luminancia
  thumb.jpg   miniatura para el botón de la terminación
y muestra la línea para pegar en CONFIG.textures (index.html).

La foto: de frente, luz pareja y difusa, enfocada, sin juntas ni bordes de
la pieza, idealmente cuadrada. Anota cuántos centímetros cubre (sizeM).
Requiere: pip install numpy scipy pillow
"""
import argparse, io, json, os, sys
import numpy as np
from PIL import Image, ImageCms
from scipy.ndimage import gaussian_filter

N = 1024
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def to_lin(a): return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def to_srgb(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055)


def open_srgb(path):
    """Abre la foto y la pasa a sRGB usando su perfil de color incrustado.
    Las fotos de producto vienen en ProPhoto RGB (Photoshop): leídas sin el
    perfil se ven apagadas, «color cartón» (así las muestra Paint)."""
    im = Image.open(path)
    icc = im.info.get('icc_profile')
    if icc:
        src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        im = ImageCms.profileToProfile(im.convert('RGB'), src, ImageCms.createProfile('sRGB'), renderingIntent=0, outputMode='RGB')
    return im.convert('RGB')


def luma(a): return a @ [0.2126, 0.7152, 0.0722]


def groove_pitch(lum):
    """Paso (px) de las ranuras verticales de la foto, por autocorrelación."""
    p = lum.mean(0); p = p - gaussian_filter(p, 40, mode='reflect')
    ac = np.correlate(p, p, 'full')[len(p) - 1:]
    lo = 20
    return lo + int(np.argmax(ac[lo:min(len(ac), 260)]))


def seam_axis(img, axis, shift, frac=0.22):
    """Fundido con la copia desplazada a lo largo de un eje, conservando el contraste."""
    n = img.shape[axis]
    t = np.arange(n); d = np.minimum(t, n - 1 - t) / (frac * n)
    w = np.clip(d, 0, 1); w = w * w * (3 - 2 * w)
    shape = [1, 1, 1]; shape[axis] = n; w = w.reshape(shape)
    other = np.roll(img, shift, axis=axis)
    mean = img.mean(axis=(0, 1), keepdims=True)
    mix = w * (img - mean) + (1 - w) * (other - mean)
    return mean + mix / np.sqrt(w * w + (1 - w) * (1 - w))


def process(photo, name, grooves=False, strength=2.2, blur=1.2, out_root=None):
    out = os.path.join(out_root or os.path.join(ROOT, 'assets', 'textures'), name)
    a = to_lin(np.asarray(open_srgb(photo)).astype(np.float64) / 255.0)
    s = min(a.shape[:2]); y0, x0 = (a.shape[0] - s) // 2, (a.shape[1] - s) // 2
    a = a[y0:y0 + s, x0:x0 + s]  # cuadrada, centrada
    # 1. Sin gradiente de luz: la luz la pone la escena 3D.
    lum = luma(a); a = a * (lum.mean() / gaussian_filter(lum, s * 0.075, mode='reflect'))[..., None]
    k = None
    if grooves:  # recorta a un número entero de ranuras para que el borde calce
        pitch = groove_pitch(luma(a)); k = a.shape[1] // pitch; a = a[:, :k * pitch]
    a = np.dstack([np.asarray(Image.fromarray(a[..., c].astype(np.float32), 'F').resize((N, N), Image.LANCZOS)) for c in range(3)]).astype(np.float64)
    # 2. Repetible: primero en x (con ranuras, desplazamiento múltiplo del paso), luego en y.
    sx = int(round(round(k / 2) * N / k)) if grooves else N // 2
    a = np.clip(seam_axis(seam_axis(a, 1, sx), 0, N // 2), 0, 1)
    os.makedirs(out, exist_ok=True)
    srgb = to_srgb(a); img = Image.fromarray((srgb * 255).round().astype(np.uint8))
    img.save(os.path.join(out, 'color.jpg'), quality=86, optimize=True, progressive=True)
    img.resize((96, 96), Image.LANCZOS).save(os.path.join(out, 'thumb.jpg'), quality=82, optimize=True)
    # 3. Relieve desde la luminancia (convención OpenGL, la de three.js).
    L = luma(srgb)
    h = gaussian_filter(L, blur, mode='wrap') - gaussian_filter(L, 50, mode='wrap')
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength * 4
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength * 4
    n = np.dstack([-dx, dy, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    Image.fromarray(((n * 0.5 + 0.5) * 255).round().clip(0, 255).astype(np.uint8)).save(os.path.join(out, 'normal.jpg'), quality=90, optimize=True)
    m = to_srgb(a.reshape(-1, 3).mean(0))
    return {'dir': name, 'mean': '#%02x%02x%02x' % tuple((m * 255).round().astype(int)), 'grooves': k}


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('foto'); ap.add_argument('nombre', help='carpeta en assets/textures (minúsculas, sin tildes)')
    ap.add_argument('--ranuras', action='store_true', help='la foto tiene ranuras verticales (las conserva al repetir)')
    ap.add_argument('--relieve', type=float, default=2.2, help='intensidad del relieve (1.5 liso … 3.5 ranurado)')
    ap.add_argument('--suavizado', type=float, default=1.2, help='desenfoque del relieve en px (más = relieve más suave)')
    ap.add_argument('--salida', default=None, help='carpeta raíz de texturas (por defecto assets/textures)')
    r = ap.parse_args()
    info = process(r.foto, r.nombre, r.ranuras, r.relieve, r.suavizado, r.salida)
    print(json.dumps(info), file=sys.stderr)
    rot = ',rotate:Math.PI/2' if r.ranuras else ',rotate:0'
    print(f"'Terminación':{{dir:'{info['dir']}',sizeM:0.10{rot},mean:'{info['mean']}',base:'Natural'}},")

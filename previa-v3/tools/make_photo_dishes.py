"""
Gera os pratos da demonstração em RA a partir de fotos vistas de cima.

A foto vira a textura e a geometria (prato + relevo da comida) é calculada por código:
perfil do prato, cornicione da pizza, monte de massa/risoto, conteúdo da tigela.
Escala real em metros. Uso: python3 tools/make_photo_dishes.py <pasta-das-fotos> models
Depende de numpy, scipy e Pillow e reaproveita a escrita de GLB de oak-ar/tools/make_dishes.py.
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import gaussian_filter
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'oak-ar', 'tools'))
from make_dishes import Mesh, lathe, GLB  # noqa: E402

class GLB16(GLB):
    """Índices em 16 bits quando cabem: arquivo menor para abrir rápido no celular."""
    def _acc(self, arr, ctype, typ, target, minmax=False):
        if ctype == 5125 and arr.max() < 65535: arr, ctype = arr.astype(np.uint16), 5123
        return super()._acc(arr, ctype, typ, target, minmax)

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

# foto, centro e raio do prato em pixels, raio da comida, raio real do prato (m)
DISHES = {
    'pizza-margherita': dict(src='margherita', cx=469, cy=569, R=398, rf=338, Rm=0.170, kind='pizza', rim=0.012),
    'poke-de-salmao':   dict(src='poke',       cx=464, cy=576, R=299, rf=262, Rm=0.090, kind='bowl'),
    'risoto-funghi':    dict(src='risoto',     cx=466, cy=577, R=398, rf=300, Rm=0.140, kind='mound', H=0.026, rim=0.024),
    'spaghetti-pomodoro': dict(src='pomodoro', cx=462, cy=573, R=344, rf=222, Rm=0.135, kind='mound', H=0.04, rim=0.022),
}

def plate_z(rn, rim):
    """Altura do topo do prato pelo raio normalizado: fundo plano, aba que sobe até a borda."""
    base = 0.008
    t = smooth(0.70, 0.985, rn)
    lip = np.where(rn > 0.985, -(rn - 0.985) / 0.015 * 0.004, 0)
    return base + (rim - base) * t ** 1.6 + lip

def build(name, d, photos):
    im = Image.open(os.path.join(photos, d['src'] + '.jpg')).convert('RGB')
    cx, cy, R, rf, Rm = d['cx'], d['cy'], d['R'], d['rf'], d['Rm']
    s = Rm / R                                  # metros por pixel
    a = np.asarray(im, np.float32) / 255
    H_, W_ = a.shape[:2]
    yy, xx = np.mgrid[0:H_, 0:W_].astype(np.float32)
    rr = np.hypot(xx - cx, yy - cy)
    # cor do prato: mediana numa faixa da aba
    ring = (rr > rf + (R - rf) * 0.35) & (rr < R * 0.95)
    pc = np.median(a[ring], axis=0)
    dist = np.linalg.norm(a - pc, axis=2)
    food = smooth(0.06, 0.22, dist) * (rr < rf * 1.06)
    food_s = np.asarray(Image.fromarray((food * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(R * 0.035)), np.float32) / 255
    lum = a.mean(2)
    detail = lum - np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6)), np.float32) / 255
    rn = rr / R
    kind = d['kind']
    if kind == 'pizza':
        prn = rr / rf
        base = plate_z(rn, d['rim'])
        dough = 0.004 * smooth(1.06, 0.97, prn)
        crust = 0.019 * np.exp(-((prn - 0.925) / np.where(prn > 0.925, 0.075, 0.055)) ** 2)
        crust *= 0.8 + 0.4 * np.clip(lum, 0, 1)   # cornicione mais alto onde a massa cresceu (claro)
        tops = 0.003 * food_s * (prn < 0.85)
        z = base + dough + crust + tops + detail * 0.004 * (prn < 1.0)
    elif kind == 'bowl':
        rim_h, fill = 0.070, 0.050
        inner = rn * R / rf
        wall = smooth(0.92, 1.0, inner)            # parede interna da tigela
        bump = 0.016 * food_s * smooth(1.0, 0.8, inner)
        z = fill + bump + (rim_h - fill - bump) * wall + detail * 0.003 * (inner < 0.95)
        z = np.where(rn > 0.985, rim_h - (rn - 0.985) / 0.015 * 0.004, z)
    else:
        base = plate_z(rn, d['rim'])
        frn = rr / rf
        dome = np.clip(1 - frn ** 2, 0, 1) ** 0.8
        z = base + d['H'] * dome * (0.45 + 0.55 * food_s) * smooth(1.14, 0.86, frn) + detail * 0.005 * (frn < 1.0)
    z = gaussian_filter(z.astype(np.float32), 1.2)

    # textura: recorte quadrado do prato
    pad = 6
    box = (cx - R - pad, cy - R - pad, cx + R + pad, cy + R + pad)
    T = 1280
    tex = im.crop(box).resize((T, T), Image.LANCZOS)
    side = 2 * (R + pad)

    def zs(px, py):
        x0 = np.clip(px, 0, W_ - 2); y0 = np.clip(py, 0, H_ - 2)
        i, j = np.floor(y0).astype(int), np.floor(x0).astype(int); fy, fx = y0 - i, x0 - j
        return (z[i, j] * (1 - fx) * (1 - fy) + z[i, j + 1] * fx * (1 - fy) + z[i + 1, j] * (1 - fx) * fy + z[i + 1, j + 1] * fx * fy)

    # topo: grade polar densa (mais anéis perto da borda da comida)
    rings, seg = 120, 240
    rs = R * np.sqrt(np.linspace(0, 1, rings + 1))[1:]
    P, UV = [[0, float(zs(np.float32(cx), np.float32(cy))), 0]], [[(cx - box[0]) / side, (cy - box[1]) / side]]
    th = np.linspace(0, 2 * np.pi, seg, endpoint=False)
    for r in rs:
        px = cx + r * np.cos(th); py = cy + r * np.sin(th)
        hz = zs(px, py)
        for k in range(seg):
            P.append([(px[k] - cx) * s, float(hz[k]), (py[k] - cy) * s]); UV.append([(px[k] - box[0]) / side, (py[k] - box[1]) / side])
    I = []
    for j in range(seg): I += [0, 1 + j, 1 + (j + 1) % seg]
    for i in range(1, rings):
        o0, o1 = 1 + (i - 1) * seg, 1 + i * seg
        for j in range(seg):
            j2 = (j + 1) % seg; a0, b0, c0, d0 = o0 + j, o1 + j, o0 + j2, o1 + j2
            I += [a0, b0, c0, c0, b0, d0]
    top = Mesh().add(P, UV, I)
    n = top.normals()
    if n[0][1] < 0:  # garante a face para cima
        top.I = [x for t in range(0, len(I), 3) for x in (I[t], I[t + 2], I[t + 1])]

    # lado de fora e fundo, na cor do prato
    edge = float(np.median(zs(cx + R * np.cos(th), cy + R * np.sin(th))))
    if kind == 'bowl':
        prof = [(0, 0.0), (Rm * 0.48, 0.0), (Rm * 0.5, 0.006), (Rm * 0.78, edge * 0.35), (Rm * 0.95, edge * 0.8), (Rm, edge)]
    else:
        prof = [(0, 0.0), (Rm * 0.66, 0.0), (Rm * 0.68, 0.004), (Rm * 0.9, edge * 0.55), (Rm, edge)]
    skirt = lathe(prof, seg=seg)

    g = GLB16()
    mt = g.material('comida', base_tex=g.texture(tex), rough=0.55)
    g.mesh(top, mt)
    g.mesh(skirt, g.material('prato', color=[float(c) ** 2.2 for c in pc], rough=0.25))
    return g

if __name__ == '__main__':
    photos, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    for name, d in DISHES.items():
        build(name, d, photos).save(os.path.join(out, name + '.glb'), name)

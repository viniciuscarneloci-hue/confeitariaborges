# Gera o modelo 3D "foto-texturizado" da Ganache de Limão a partir da colagem de fotos
# (tools/fotos/ganache-limao.jpg): vista de cima vira a textura do topo e a lateral da massa
# vira a textura da borda. Decorações (suspiros, rodelas de limão, bolinhas) ganham volume
# por um mapa de altura alinhado à foto de cima; lascas de chocolate branco são geometria.
#
# Saída: public/models/ganache-limao.glb (Android / web) e public/models/ganache-limao.usdz (iPhone).
# Uso: python3 tools/make_ganache_limao.py   (precisa de numpy, pillow e usd-core)
import io, json, math, struct, sys, os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, 'fotos', 'ganache-limao.jpg')
OUT = os.path.join(ROOT, 'public', 'models')

R = 0.10          # raio: 20 cm de diâmetro (mesma escala dos outros bolos de 1 kg)
H_WALL = 0.0365   # altura da borda externa
H_FILL = 0.0345   # nível do creme
H_RIM = 0.0385    # topo da massa

# ---------- fotos ----------
src = Image.open(SRC).convert('RGB')
# Foto 1 (vista de cima): elipse da torta na colagem, em pixels da imagem original
TOP = dict(cx=195.67, cy=155.0, ax=107.67, ay=108.33)

def top_texture(size=1024):
    # mapeia uv [0,1]² -> elipse da foto de cima (u = x, v = z)
    sx = 2 * TOP['ax'] / size; sy = 2 * TOP['ay'] / size
    big = src.resize((src.width * 4, src.height * 4), Image.LANCZOS)
    t = big.transform((size, size), Image.AFFINE,
                      (sx * 4, 0, (TOP['cx'] - TOP['ax']) * 4, 0, sy * 4, (TOP['cy'] - TOP['ay']) * 4),
                      resample=Image.BICUBIC)
    t = t.filter(ImageFilter.UnsharpMask(radius=2.2, percent=70, threshold=2))
    return ImageEnhance.Color(t).enhance(1.05)

def side_texture(w=512, h=128):
    # Foto central (45°): faixa da massa na frente da torta, "desenrolada" ao longo da elipse.
    # Coordenadas do recorte (x450..800, y300..515) ampliado 3x.
    cx, cy, a, b, H = 525, 291, 490, 203, 130
    arr = np.asarray(src, dtype=np.float32)
    out = np.zeros((h, w, 3), np.float32)
    for i in range(w):
        th = math.radians(62 + 56 * i / (w - 1))
        for j in range(h):
            t = 0.10 + 0.82 * j / (h - 1)
            X = 450 + (cx + a * math.cos(th)) / 3
            Y = 300 + (cy + b * math.sin(th) + t * H) / 3
            x0, y0 = int(X), int(Y); fx, fy = X - x0, Y - y0
            p = (arr[y0, x0] * (1 - fx) * (1 - fy) + arr[y0, x0 + 1] * fx * (1 - fy)
                 + arr[y0 + 1, x0] * (1 - fx) * fy + arr[y0 + 1, x0 + 1] * fx * fy)
            out[j, i] = p
    # tira a variação de luz da esquerda para a direita (a textura se repete ao redor da torta)
    col = out.mean(axis=(0, 2), keepdims=True)
    out = out / col * col.mean()
    # cor dourada da massa (a foto pequena escurece a faixa) + granulado fino de massa assada
    target = np.array([208, 162, 98], np.float32)
    out = (out - out.mean((0, 1))) * 0.8 + target
    rng = np.random.default_rng(7)
    grain = np.asarray(Image.fromarray((rng.random((h, w)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)), np.float32) - 127
    out += grain[..., None] * np.array([0.22, 0.18, 0.12])
    shade = np.linspace(1.04, 0.86, h)[:, None, None]          # base um pouco mais escura
    out *= shade
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    return img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=60, threshold=2))

# ---------- mapa de altura do topo ----------
# Decorações na foto de cima (coordenadas do recorte ampliado 3x: centro 497,375, raio 323)
def P(px, py): return ((px - 497) / 323 * R, (py - 375) / 325 * R)

# (centro, raio, altura, material): 4 = branco (açúcar), 5 = creme
DOMES = [(P(337, 220), 0.0118, 0.019, 4), (P(405, 280), 0.0098, 0.014, 5), (P(430, 228), 0.0082, 0.012, 5),
         (P(255, 405), 0.0110, 0.015, 4), (P(320, 480), 0.0105, 0.009, 5), (P(290, 470), 0.0080, 0.008, 5)]
KISSES = [(P(555, 138), 0.0125, 0.024), (P(400, 595), 0.0118, 0.022)]
LIMES = [(P(322, 322), 0.0230, 0.0205, 0.020, 0.55), (P(440, 168), 0.0170, 0.0150, 0.015, 0.75)]
FLATS = [(P(398, 480), 0.0120, 0.0022), (P(343, 543), 0.0120, 0.0022), (P(482, 128), 0.0080, 0.0030),
         (P(538, 212), 0.0080, 0.0030), (P(470, 600), 0.0100, 0.0015), (P(255, 445), 0.0080, 0.0020)]

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

def height(x, z):
    r = np.hypot(x, z)
    # perfil da borda de massa
    h = np.full_like(x, H_FILL)
    h = np.where(r > 0.0905, H_FILL + (H_RIM - H_FILL) * smooth(0.0905, 0.0935, r), h)
    ro = np.clip((r - 0.0975) / (R - 0.0975), 0, 1)       # arredonda a quina de fora
    h = np.where(r > 0.0975, H_RIM - (H_RIM - H_WALL) * (1 - np.sqrt(1 - ro ** 2)), h)
    bump = np.zeros_like(x)
    for (cx, cz), rad, hh in FLATS:                       # flores e folhas
        d = np.hypot(x - cx, z - cz)
        bump = np.maximum(bump, hh * smooth(1.0, 0.2, d / rad))
    return h + bump * (r < 0.091)

# ---------- malhas ----------
class Mesh:
    def __init__(s, name, mat): s.name, s.mat = name, mat; s.P, s.N, s.UV, s.I = [], [], [], []

def finalize_normals(P, I):
    P = np.asarray(P, np.float32); I = np.asarray(I, np.int64).reshape(-1, 3)
    fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
    N = np.zeros_like(P)
    for k in range(3): np.add.at(N, I[:, k], fn)
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)

def top_mesh():
    m = Mesh('topo', 0)
    na = 288
    rs = np.concatenate([np.linspace(0, 0.088, 90)[1:], np.linspace(0.0885, R, 40)])
    ths = np.linspace(0, 2 * math.pi, na, endpoint=False)
    RR, TT = np.meshgrid(rs, ths, indexing='ij')
    X, Z = RR * np.cos(TT), RR * np.sin(TT)
    Y = height(X, Z)
    pts = [[0, height(np.zeros(1), np.zeros(1))[0], 0]] + list(np.stack([X, Y, Z], -1).reshape(-1, 3))
    P_ = np.array(pts, np.float32)
    uv = np.stack([0.5 + P_[:, 0] / (2 * R), 0.5 + P_[:, 2] / (2 * R)], -1)
    I = []
    nrs = len(rs)
    idx = lambda i, j: 1 + i * na + (j % na)
    for j in range(na): I += [0, idx(0, j + 1), idx(0, j)]
    for i in range(nrs - 1):
        for j in range(na):
            a, b, c, d = idx(i, j), idx(i, j + 1), idx(i + 1, j + 1), idx(i + 1, j)
            I += [a, b, c, a, c, d]
    m.P, m.UV, m.I = P_, uv.astype(np.float32), I
    m.N = finalize_normals(P_, I)
    # normais da borda: alinhar com a parede (sem quina escura)
    return m

def wall_mesh():
    m = Mesh('borda', 1)
    na = 320; K = 4                                        # textura repetida (espelhada) K vezes
    prof = [(R, H_WALL), (R, H_WALL * 0.6), (R * 0.999, H_WALL * 0.25), (R * 0.996, 0.004), (R * 0.988, 0.0006), (R * 0.982, 0.0)]
    vs = [0.0, 0.42, 0.75, 0.93, 0.99, 1.0]
    P_, UV = [], []
    for j in range(na + 1):
        th = 2 * math.pi * j / na
        for (r, y), v in zip(prof, vs):
            P_.append([r * math.cos(th), y, r * math.sin(th)]); UV.append([K * j / na, v])
    I = []
    np_ = len(prof)
    for j in range(na):
        for k in range(np_ - 1):
            a = j * np_ + k; b = a + 1; c = a + np_ + 1; d = a + np_
            I += [a, d, c, a, c, b]
    m.P = np.array(P_, np.float32); m.UV = np.array(UV, np.float32); m.I = I
    m.N = finalize_normals(m.P, I)
    # topo da parede: normal horizontal para emendar com a quina arredondada do topo
    return m

def bottom_mesh():
    m = Mesh('fundo', 2)
    na = 96; r = R * 0.982
    P_ = [[0, 0, 0]] + [[r * math.cos(2 * math.pi * j / na), 0, r * math.sin(2 * math.pi * j / na)] for j in range(na)]
    m.P = np.array(P_, np.float32); m.UV = np.zeros((len(P_), 2), np.float32)
    m.I = sum(([0, 1 + j, 1 + (j + 1) % na] for j in range(na)), [])
    m.N = np.tile(np.array([[0, -1, 0]], np.float32), (len(P_), 1))
    return m

def shard_mesh():
    # lascas de chocolate branco: triângulos finos em pé, inclinados
    m = Mesh('chocolate-branco', 3)
    P_, I = [], []
    def surf(p): return float(height(np.array([p[0]]), np.array([p[1]]))[0])
    def shard(a, b, lift_a, lift_b, lean, th=0.0022):
        a = np.array([a[0], 0, a[1]]); b = np.array([b[0], 0, b[1]])
        d = b - a; d /= np.linalg.norm(d); n = np.array([-d[2], 0, d[0]])
        ya, yb = surf((a[0], a[2])), surf((b[0], b[2]))
        v1 = b + np.array([0, yb + 0.002, 0])               # pé (perto do centro)
        v2 = b + np.array([0, yb + lift_b, 0]) + n * lean   # canto alto
        v3 = a + np.array([0, ya + lift_a, 0]) + n * lean * 1.4  # ponta
        tri = [v1, v2, v3]
        off = n * th / 2
        front = [t + off for t in tri]; back = [t - off for t in tri]
        k = len(P_); P_.extend(front + back)
        I.extend([k, k + 1, k + 2, k + 3, k + 5, k + 4])
        for e0, e1 in ((0, 1), (1, 2), (2, 0)):
            I.extend([k + e0, k + 3 + e0, k + 3 + e1, k + e0, k + 3 + e1, k + e1])
    shard(*SHARDS[0], 0.030, 0.012, 0.004)
    shard(*SHARDS[1], 0.026, 0.010, -0.004)
    # vértices duplicados por face para normais retas
    P2, I2 = [], []
    P_ = np.array(P_, np.float32)
    for t in np.array(I).reshape(-1, 3):
        k = len(P2); P2.extend(P_[t]); I2 += [k, k + 1, k + 2]
    m.P = np.array(P2, np.float32); m.I = I2; m.N = finalize_normals(m.P, I2)
    m.UV = np.zeros((len(P2), 2), np.float32)
    return m

def revolve(m, cx, cz, base, prof, na=48, ridges=0, amp=0.0, twist=0.0):
    # prof: lista de (raio, altura) de baixo para cima; termina em raio 0 (ponta)
    k0 = len(m.P); n = len(prof)
    for i, (r, y) in enumerate(prof):
        t = i / (n - 1)
        for j in range(na):
            ph = 2 * math.pi * j / na
            rr = r * (1 + amp * math.cos(ridges * ph + twist * t) * min(1, (1 - t) * 3)) if ridges else r
            m.P.append([cx + rr * math.cos(ph), base + y, cz + rr * math.sin(ph)])
    for i in range(n - 1):
        for j in range(na):
            a = k0 + i * na + j; b = k0 + i * na + (j + 1) % na; c = b + na; d = a + na
            m.I += [a, d, c, a, c, b]

def deco_meshes():
    out = []
    sus = Mesh('suspiros', 4); sus.P, sus.I = [], []
    for (cx, cz), rad, hh in KISSES:                       # suspiro em gota, com gomos torcidos
        prof = []
        for i in range(26):
            t = i / 25
            r = rad * (1 - t) ** 0.8 * (1 + 0.55 * t * (1 - t) ** 0.6) if t < 1 else 0.0
            prof.append((r, -0.001 + hh * t))
        revolve(sus, cx, cz, H_FILL, prof, na=96, ridges=8, amp=0.26, twist=2.8)
    for (cx, cz), rad, hh, mat in DOMES:
        if mat != 4: continue
        prof = [(rad * math.cos(a), hh * math.sin(a) - 0.002) for a in np.linspace(0, math.pi / 2, 14)]
        revolve(sus, cx, cz, H_FILL, prof, na=40)
    cre = Mesh('creme', 5); cre.P, cre.I = [], []
    for (cx, cz), rad, hh, mat in DOMES:
        if mat != 5: continue
        prof = [(rad * math.cos(a), hh * math.sin(a) - 0.002) for a in np.linspace(0, math.pi / 2, 14)]
        revolve(cre, cx, cz, H_FILL, prof, na=40)
    for m in (sus, cre):
        m.P = np.array(m.P, np.float32); m.N = finalize_normals(m.P, m.I); m.UV = np.zeros((len(m.P), 2), np.float32)
        out.append(m)
    # rodelas de limão: disco inclinado; a face de cima usa a própria foto (vista de cima)
    top = Mesh('limao', 7); rind = Mesh('casca-limao', 6)
    for m in (top, rind): m.P, m.I = [], []
    for (cx, cz), ra, rb, lift, ang in LIMES:
        na = 64; th = 0.0025
        ca, sa = math.cos(ang), math.sin(ang)
        ring = []
        for j in range(na):
            ph = 2 * math.pi * j / na
            u, v = ra * math.cos(ph), rb * math.sin(ph)
            x = cx + u * ca - v * sa; z = cz + u * sa + v * ca
            y = H_FILL + lift * (0.5 - 0.5 * u / ra) + 0.002   # lado "de dentro" apoiado, borda de fora levantada
            ring.append((x, y, z))
        k = len(top.P); top.P.append([cx, H_FILL + lift * 0.5 + 0.002, cz]); top.P += [list(p) for p in ring]
        for j in range(na): top.I += [k, k + 1 + (j + 1) % na, k + 1 + j]
        k = len(rind.P)
        for x, y, z in ring: rind.P += [[x, y, z], [x, y - th, z]]
        for j in range(na):
            a, b = k + 2 * j, k + 2 * ((j + 1) % na)
            rind.I += [a, b, b + 1, a, b + 1, a + 1]
        # fundo da rodela
        kb = len(rind.P); rind.P.append([cx, H_FILL + lift * 0.5 + 0.002 - th, cz]); rind.P += [[x, y - th, z] for x, y, z in ring]
        for j in range(na): rind.I += [kb, kb + 1 + j, kb + 1 + (j + 1) % na]
    top.P = np.array(top.P, np.float32); top.N = finalize_normals(top.P, top.I)
    top.UV = np.stack([0.5 + top.P[:, 0] / (2 * R), 0.5 + top.P[:, 2] / (2 * R)], -1).astype(np.float32)
    rind.P = np.array(rind.P, np.float32); rind.N = finalize_normals(rind.P, rind.I); rind.UV = np.zeros((len(rind.P), 2), np.float32)
    return out + [top, rind]

def blur(a, r):
    # desfoque gaussiano aproximado (3 passadas de caixa), em float, nos dois eixos
    def box(x, axis):
        pad = [(0, 0)] * x.ndim; pad[axis] = (r + 1, r)
        c = np.cumsum(np.pad(x, pad, mode='edge'), axis=axis)
        hi = np.take(c, np.arange(2 * r + 1, c.shape[axis]), axis=axis)
        lo = np.take(c, np.arange(0, c.shape[axis] - 2 * r - 1), axis=axis)
        return (hi - lo) / (2 * r + 1)
    for _ in range(3): a = box(box(a, 0), 1)
    return a

SHARDS = [(P(328, 125), P(458, 268)), (P(212, 330), P(398, 428))]

def deco_mask(size):
    g = (np.arange(size) + 0.5) / size * 2 * R - R
    X, Z = np.meshgrid(g, g)
    mask = np.zeros_like(X, bool)
    for (cx, cz), rad, hh in KISSES: mask |= np.hypot(X - cx, Z - cz) < rad * 1.2
    for (cx, cz), rad, hh, mat in DOMES: mask |= np.hypot(X - cx, Z - cz) < rad * 1.15
    for (cx, cz), ra, rb, lift, ang in LIMES:
        u = (X - cx) * math.cos(ang) + (Z - cz) * math.sin(ang); v = -(X - cx) * math.sin(ang) + (Z - cz) * math.cos(ang)
        mask |= np.hypot(u / (ra * 1.15), v / (rb * 1.15)) < 1
    for (ax, az), (bx, bz) in SHARDS:
        dx, dz = bx - ax, bz - az; L2 = dx * dx + dz * dz
        t = np.clip(((X - ax) * dx + (Z - az) * dz) / L2, 0, 1)
        mask |= np.hypot(X - ax - t * dx, Z - az - t * dz) < 0.0035
    return mask

def clean_top(img):
    # Apaga da foto de cima o que virou geometria (suspiros, bolinhas, rodelas), para não
    # aparecer uma "cópia pintada" embaixo delas quando a câmera anda. Preenche com a cor em volta.
    size = img.width
    mask = deco_mask(size)
    a = np.asarray(img, np.float32); w = (~mask).astype(np.float32)[..., None]
    filled = a.copy()
    for rad in (48, 20, 8):                                # convolução normalizada (em float)
        num, den = blur(a * w, rad), blur(w, rad)
        est = num / np.maximum(den, 1e-4)
        filled = np.where(mask[..., None] & (den > 1e-3), est, filled)
    soft = blur(mask[..., None].astype(np.float32), 3)
    out = a * (1 - soft) + filled * soft
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

def rough_texture(size=512):
    # G = rugosidade, B = metal (0). Creme brilhante; massa, açúcar e decorações foscos.
    g = np.linspace(-R, R, size)
    X, Z = np.meshgrid(g, g)
    hh = height(X, Z) - H_FILL
    r = np.hypot(X, Z)
    rough = np.where((r < 0.0895) & (hh < 0.0005) & ~deco_mask(size), 0.22, 0.82)
    img = np.zeros((size, size, 3), np.uint8)
    img[..., 0] = 255; img[..., 1] = (rough * 255).astype(np.uint8)
    return Image.fromarray(img).filter(ImageFilter.GaussianBlur(1.2))

# ---------- GLB ----------
def jpg(img, q=90):
    b = io.BytesIO(); img.save(b, 'JPEG', quality=q, optimize=True); return b.getvalue()
def png(img):
    b = io.BytesIO(); img.save(b, 'PNG', optimize=True); return b.getvalue()

def write_glb(path, meshes, images, materials, samplers, textures):
    buf = bytearray(); views, accs, gm, nodes = [], [], [], []
    def add(data, target=None):
        while len(buf) % 4: buf.append(0)
        off = len(buf); buf.extend(data)
        v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target: v["target"] = target
        views.append(v); return len(views) - 1
    def acc(arr, comp, typ, target, minmax=False):
        a = {"bufferView": add(arr.tobytes(), target), "componentType": comp, "count": len(arr), "type": typ}
        if minmax: a["min"] = arr.min(0).tolist(); a["max"] = arr.max(0).tolist()
        accs.append(a); return len(accs) - 1
    for m in meshes:
        Pp = np.asarray(m.P, np.float32); Nn = np.asarray(m.N, np.float32); U = np.asarray(m.UV, np.float32)
        I = np.asarray(m.I, np.uint32 if len(Pp) > 65535 else np.uint16)
        attrs = {"POSITION": acc(Pp, 5126, "VEC3", 34962, True), "NORMAL": acc(Nn, 5126, "VEC3", 34962),
                 "TEXCOORD_0": acc(U, 5126, "VEC2", 34962)}
        ind = acc(I, 5125 if I.dtype == np.uint32 else 5123, "SCALAR", 34963)
        gm.append({"name": m.name, "primitives": [{"attributes": attrs, "indices": ind, "material": m.mat}]})
        nodes.append({"name": m.name, "mesh": len(gm) - 1})
    imgs = []
    for data, mime in images:
        imgs.append({"bufferView": add(data), "mimeType": mime})
    gltf = {"asset": {"version": "2.0", "generator": "Confeitaria Borges — make_ganache_limao.py"},
            "scene": 0, "scenes": [{"nodes": list(range(len(nodes)))}], "nodes": nodes, "meshes": gm,
            "materials": materials, "textures": textures, "images": imgs, "samplers": samplers,
            "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": len(buf)}]}
    js = json.dumps(gltf, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    while len(buf) % 4: buf.append(0)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(buf), 0x004E4942)); f.write(buf)

# ---------- USDZ ----------
def write_usdz(path, meshes, tex_files, mats):
    from pxr import Usd, UsdGeom, UsdShade, Sdf, Gf, Vt, UsdUtils
    tmpdir = os.path.join(OUT, '_usd'); os.makedirs(tmpdir, exist_ok=True)
    for name, img in tex_files.items(): img.save(os.path.join(tmpdir, name), quality=90)
    usda = os.path.join(tmpdir, 'ganache-limao.usdc')
    st = Usd.Stage.CreateNew(usda)
    UsdGeom.SetStageUpAxis(st, UsdGeom.Tokens.y); UsdGeom.SetStageMetersPerUnit(st, 1.0)
    root = UsdGeom.Xform.Define(st, '/GanacheLimao'); st.SetDefaultPrim(root.GetPrim())
    shaders = []
    for i, mm in enumerate(mats):
        mat = UsdShade.Material.Define(st, f'/GanacheLimao/Materiais/m{i}')
        sh = UsdShade.Shader.Define(st, f'/GanacheLimao/Materiais/m{i}/pbr'); sh.CreateIdAttr('UsdPreviewSurface')
        sh.CreateInput('metallic', Sdf.ValueTypeNames.Float).Set(0.0)
        mat.CreateSurfaceOutput().ConnectToSource(sh.ConnectableAPI(), 'surface')
        reader = None
        if mm.get('tex') or mm.get('rough_tex'):
            reader = UsdShade.Shader.Define(st, f'/GanacheLimao/Materiais/m{i}/st'); reader.CreateIdAttr('UsdPrimvarReader_float2')
            reader.CreateInput('varname', Sdf.ValueTypeNames.Token).Set('st')
        def texnode(nm, file, wrap):
            t = UsdShade.Shader.Define(st, f'/GanacheLimao/Materiais/m{i}/{nm}'); t.CreateIdAttr('UsdUVTexture')
            t.CreateInput('file', Sdf.ValueTypeNames.Asset).Set(file)
            t.CreateInput('st', Sdf.ValueTypeNames.Float2).ConnectToSource(reader.ConnectableAPI(), 'result')
            t.CreateInput('wrapS', Sdf.ValueTypeNames.Token).Set(wrap); t.CreateInput('wrapT', Sdf.ValueTypeNames.Token).Set('clamp')
            return t
        if mm.get('tex'):
            t = texnode('cor', mm['tex'], mm.get('wrap', 'clamp'))
            t.CreateInput('sourceColorSpace', Sdf.ValueTypeNames.Token).Set('sRGB')
            sh.CreateInput('diffuseColor', Sdf.ValueTypeNames.Color3f).ConnectToSource(t.ConnectableAPI(), 'rgb')
        else:
            sh.CreateInput('diffuseColor', Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*mm['color']))
        if mm.get('rough_tex'):
            t = texnode('rug', mm['rough_tex'], 'clamp')
            t.CreateInput('sourceColorSpace', Sdf.ValueTypeNames.Token).Set('raw')
            sh.CreateInput('roughness', Sdf.ValueTypeNames.Float).ConnectToSource(t.ConnectableAPI(), 'g')
        else:
            sh.CreateInput('roughness', Sdf.ValueTypeNames.Float).Set(mm['rough'])
        shaders.append(mat)
    for m in meshes:
        g = UsdGeom.Mesh.Define(st, f'/GanacheLimao/{m.name.replace("-", "_")}')
        Pp = np.asarray(m.P, np.float64); I = np.asarray(m.I).reshape(-1, 3)
        g.CreatePointsAttr(Vt.Vec3fArray.FromNumpy(Pp.astype(np.float32)))
        # USD usa ordem horária? Não: anti-horária por padrão (rightHanded), igual ao glTF.
        g.CreateFaceVertexCountsAttr([3] * len(I)); g.CreateFaceVertexIndicesAttr(Vt.IntArray.FromNumpy(I.reshape(-1).astype(np.int32)))
        g.CreateNormalsAttr(Vt.Vec3fArray.FromNumpy(np.asarray(m.N, np.float32))); g.SetNormalsInterpolation('vertex')
        g.CreateSubdivisionSchemeAttr('none')
        if m.mat == 3: g.CreateDoubleSidedAttr(True)
        uv = np.asarray(m.UV, np.float32).copy(); uv[:, 1] = 1 - uv[:, 1]
        pv = UsdGeom.PrimvarsAPI(g).CreatePrimvar('st', Sdf.ValueTypeNames.TexCoord2fArray, UsdGeom.Tokens.vertex)
        pv.Set(Vt.Vec2fArray.FromNumpy(uv))
        g.CreateExtentAttr([Gf.Vec3f(*Pp.min(0)), Gf.Vec3f(*Pp.max(0))])
        UsdShade.MaterialBindingAPI.Apply(g.GetPrim()).Bind(shaders[m.mat])
    st.GetRootLayer().Save()
    cwd = os.getcwd(); os.chdir(tmpdir)
    try:
        if os.path.exists(path): os.remove(path)
        ok = UsdUtils.CreateNewARKitUsdzPackage(Sdf.AssetPath('ganache-limao.usdc'), path)
    finally:
        os.chdir(cwd)
    import shutil; shutil.rmtree(tmpdir)
    if not ok: sys.exit('falha ao gerar USDZ')

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    photo_top, side, rough = top_texture(), side_texture(), rough_texture()
    top = clean_top(photo_top)
    meshes = [top_mesh(), wall_mesh(), bottom_mesh(), shard_mesh()] + deco_meshes()
    materials = [
        {"name": "torta-topo", "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicRoughnessTexture": {"index": 2},
                                                         "metallicFactor": 0.0, "roughnessFactor": 1.0}},
        {"name": "torta-massa", "pbrMetallicRoughness": {"baseColorTexture": {"index": 1}, "metallicFactor": 0.0, "roughnessFactor": 0.85}},
        {"name": "torta-fundo", "pbrMetallicRoughness": {"baseColorFactor": [0.42 ** 2.2, 0.26 ** 2.2, 0.12 ** 2.2, 1], "metallicFactor": 0.0, "roughnessFactor": 0.9}},
        {"name": "chocolate-branco", "doubleSided": True, "pbrMetallicRoughness": {"baseColorFactor": [0.93 ** 2.2, 0.89 ** 2.2, 0.76 ** 2.2, 1], "metallicFactor": 0.0, "roughnessFactor": 0.45}},
        {"name": "suspiro", "pbrMetallicRoughness": {"baseColorFactor": [0.97 ** 2.2, 0.955 ** 2.2, 0.93 ** 2.2, 1], "metallicFactor": 0.0, "roughnessFactor": 0.75}},
        {"name": "creme", "pbrMetallicRoughness": {"baseColorFactor": [0.96 ** 2.2, 0.89 ** 2.2, 0.62 ** 2.2, 1], "metallicFactor": 0.0, "roughnessFactor": 0.4}},
        {"name": "casca-limao", "pbrMetallicRoughness": {"baseColorFactor": [0.30 ** 2.2, 0.42 ** 2.2, 0.12 ** 2.2, 1], "metallicFactor": 0.0, "roughnessFactor": 0.5}},
        {"name": "rodela-limao", "pbrMetallicRoughness": {"baseColorTexture": {"index": 3}, "metallicFactor": 0.0, "roughnessFactor": 0.55}},
    ]
    write_glb(os.path.join(OUT, 'ganache-limao.glb'), meshes,
              [(jpg(top), 'image/jpeg'), (jpg(side), 'image/jpeg'), (png(rough), 'image/png'), (jpg(photo_top), 'image/jpeg')], materials,
              [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071},
               {"magFilter": 9729, "minFilter": 9987, "wrapS": 33648, "wrapT": 33071}],
              [{"source": 0, "sampler": 0}, {"source": 1, "sampler": 1}, {"source": 2, "sampler": 0}, {"source": 3, "sampler": 0}])
    usd_mats = [
        {"tex": 'topo.jpg', "rough_tex": 'rugosidade.png'},
        {"tex": 'massa.jpg', "wrap": 'mirror', "rough": 0.85},
        {"color": (0.42 ** 2.2, 0.26 ** 2.2, 0.12 ** 2.2), "rough": 0.9},
        {"color": (0.93 ** 2.2, 0.89 ** 2.2, 0.76 ** 2.2), "rough": 0.45},
        {"color": (0.97 ** 2.2, 0.955 ** 2.2, 0.93 ** 2.2), "rough": 0.75},
        {"color": (0.96 ** 2.2, 0.89 ** 2.2, 0.62 ** 2.2), "rough": 0.4},
        {"color": (0.30 ** 2.2, 0.42 ** 2.2, 0.12 ** 2.2), "rough": 0.5},
        {"tex": 'foto-topo.jpg', "rough": 0.55},
    ]
    write_usdz(os.path.join(OUT, 'ganache-limao.usdz'), meshes,
               {'topo.jpg': top, 'massa.jpg': side, 'rugosidade.png': rough, 'foto-topo.jpg': photo_top}, usd_mats)
    for f in ('ganache-limao.glb', 'ganache-limao.usdz'):
        print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, 'KB')

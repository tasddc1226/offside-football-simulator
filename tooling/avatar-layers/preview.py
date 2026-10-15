"""preview.py <atlas dir> <data json> out.png <row spec> [<row spec> ...]
row spec: "poses=runL,air,...;layers=kit,hair-afro;skin=e6b088;hair=6e4428;shirt=12a19a;..."
Composes like the renderer: base -> layers in order; tinted parts = colour * grey / 0.75."""
import sys, json
import numpy as np
from PIL import Image

D, out = sys.argv[1], sys.argv[3]
data = json.load(open(sys.argv[2]))
sheets = {}
DEF = {'skin': 'f2b48a', 'hair': '2b2522', 'shirt': '12a19a', 'shorts': '1d2f6b', 'socks': 'e2b13c', 'boots': 'ff7a3d',
       'tint': 'f4f4ef', 'frame': '1c1c1f', 'lens': '9fd3ff'}
ORDER = ['skin', 'line', 'shirt', 'shorts', 'socks', 'boots', 'hair', 'tint', 'frame', 'lens']


def img(name):
    if name not in sheets:
        sheets[name] = np.asarray(Image.open(f'{D}/{name}.png').convert('RGBA')).astype(np.float32)
    return sheets[name]


def hexrgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def doll(pose, layers, col, H=220):
    w, h = (int(v) + 1 for v in data['poses'][pose]['size'])
    pad = int(h * 0.3)
    C = np.zeros((h + pad * 2, w + pad * 2, 4), np.float32)
    for name in ['base', *layers]:
        a = data['atlases'][pose]
        if name not in a['parts']:
            continue
        parts = a['parts'][name]
        for part in sorted(parts, key=lambda p: ORDER.index(p) if p in ORDER else 99):
            px, py, pw, ph, ox, oy = parts[part]
            ox, oy = round(ox), round(oy)
            src = img(pose)[py:py + ph, px:px + pw].copy()
            if part != 'line':
                src[..., :3] = np.clip(hexrgb(col.get(part, DEF[part])) * src[..., :3] / 255 / 0.75, 0, 255)
            m = src[..., 3] > 0
            region = C[pad + oy:pad + oy + ph, pad + ox:pad + ox + pw]
            region[m] = src[m]
    im = Image.fromarray(C.astype(np.uint8), 'RGBA')
    bb = im.getbbox() or (0, 0, 1, 1)
    im = im.crop(bb)
    s = H / max(im.height, 1)
    return im.resize((max(1, int(im.width * s)), H), Image.NEAREST)


rows = []
for spec in sys.argv[4:]:
    kv = dict(x.split('=', 1) for x in spec.split(';'))
    poses = kv.pop('poses').split(',')
    layers = [l for l in kv.pop('layers', '').split(',') if l]
    tiles = [doll(p, layers, kv) for p in poses]
    W = sum(t.width for t in tiles) + 14 * len(tiles)
    row = Image.new('RGBA', (W, 230), (238, 241, 238, 255))
    x = 6
    for t in tiles:
        row.alpha_composite(t, (x, 5))
        x += t.width + 14
    rows.append(row)
W = max(r.width for r in rows)
sheet = Image.new('RGB', (W, 230 * len(rows)), (238, 241, 238))
for i, r in enumerate(rows):
    sheet.paste(r.convert('RGB'), (0, 230 * i))
sheet.save(out)

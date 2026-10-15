"""Build paper-doll avatar layer atlases from keyed pose sheets.

usage: build.py <work dir> <atlas dir> <data json>
work/cut/base-{A,B}.png and work/cut/<job>.png are keyed (key.py) RGBA sheets.
For every pose figure of the base sheet and every job sheet:
  1. crop a window around the base figure, keep only the edit's components touching that figure
  2. align the edit window to the base window (ECC, euclidean)
  3. layer = clearly changed pixels (+ dark outline pixels bridging them, + small enclosed holes)
  4. split into parts by colour: skin (tinted with skin colour), tintable materials stored as
     normalised greyscale, and fixed-colour 'line' pixels
Writes the standing-pose atlas <atlas dir>/stand.png, holding every layer, and the part table <data json>.
One bitmap per pose keeps decoded memory low on Android, where react-native-svg only draws images held in Fresco's memory cache.
"""
import sys, os, json
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage

W, OUT, JSON = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
POSES = {
    'A': ['runL', 'air', 'runR', 'juggle', 'balance', 'kick', 'fist', 'tuck', 'spread', 'jumpUp'],
    'B': ['kneelOut', 'kneelUp', 'kneelFist', 'waveHigh', 'waveLow', 'lift', 'sad', 'stand'],
}
HAIRS = ['short', 'fringe', 'long', 'mohawk', 'slick', 'buzz', 'afro', 'bun', 'spiky',
         'shaved', 'dread', 'fauxhawk', 'ponytail', 'mullet']
# 'bald' has no hair layer (the base head is already bald); only its headband is cut, against the base.
EXPRS = ['happy', 'wink', 'pain', 'tired', 'blink', 'shout']
# atlas -> (job prefix, kind). kind picks the part split.
ATLASES = {f'hair-{h}': (f'hair-{h}', 'hair') for h in HAIRS}
ATLASES.update({'kit': ('kit', 'kit'), 'army': ('army', 'fixed'), 'suit': ('suit', 'fixed')})
ATLASES.update({f'expr-{e}': (f'expr-{e}', 'fixed') for e in EXPRS})
ATLASES.update({'beard-stubble': ('beard-stubble', 'hair'), 'beard-full': ('beard-full', 'hair')})
ATLASES.update({
    'goggles': ('acc-goggles', 'goggles'), 'wrist': ('acc-wrist', 'tint'),
    'armband': ('acc-armband', 'tint'), 'bandage': ('acc-bandage', 'fixed'),
    'bouquet': ('prop-bouquet', 'fixed'), 'crutch': ('prop-crutch', 'fixed'),
    # goalkeeper equipment: the keeper kit uses the kit palette so it splits into the same tintable parts
    'keeper': ('keeper', 'kit'), 'gloves': ('acc-gloves', 'tint'), 'kneepads': ('acc-knee', 'tint'),
})
# headband worn over each hairstyle: cut against that hair edit instead of the base
ATLASES.update({f'band-{h}': (f'band-{h}', 'band') for h in [*HAIRS, 'bald']})
PARENT = {f'band-{h}': f'hair-{h}' for h in [*HAIRS, 'bald']}
STAND_ONLY = {'suit', 'bouquet', 'crutch', 'bandage'}
# light stubble differs from bare skin by less than the usual change threshold
THRESH = {'beard-stubble': 40}


def load(p):
    return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32)


def luma(rgb):
    return rgb @ np.array([0.299, 0.587, 0.114], np.float32)


def classes(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    L = luma(rgb)
    sat = rgb.max(-1) - rgb.min(-1)
    skin = (r > g + 18) & (g > b + 12) & (r - b > 55) & (L > 105) & (b > 60)
    return dict(L=L, sat=sat, skin=skin,
                teal=(g > r + 40) & (b > r + 25),
                navy=(b > r + 25) & (b > g + 5) & (L < 120),
                # sock yellow: like skin but with far less blue (b/r < 0.3 against ~0.45 for skin)
                mustard=(r > b + 70) & (g > b + 50) & (b < 0.3 * r),
                grey=(sat < 60))


def figure_boxes(alpha):
    lab, _ = ndimage.label(ndimage.binary_dilation(alpha, iterations=3))
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        ys, xs = sl
        if (lab[sl] == i + 1).sum() < 2000:
            continue
        boxes.append((xs.start, ys.start, xs.stop - xs.start, ys.stop - ys.start, i + 1))
    H = alpha.shape[0]
    boxes.sort(key=lambda b: (round((b[1] + b[3] / 2) / (H / 2.0) - 0.5), b[0]))
    return boxes, lab


def extract(B, E, figmask, others, thresh=90):
    """B, E: window crops (RGBA float). figmask: base figure mask in window. -> layer mask, aligned E"""
    ba = B[..., 3] > 0
    ea0 = E[..., 3] > 0
    # keep edit components touching this figure (drop neighbours reaching into the window)
    lab, n = ndimage.label(ndimage.binary_dilation(ea0, iterations=2))
    touch = np.unique(lab[ndimage.binary_dilation(figmask, iterations=8) & (lab > 0)])
    E = E.copy()
    E[~np.isin(lab, touch)] = 0
    # never take pixels that belong to a neighbouring figure of the base sheet
    E[ndimage.binary_dilation(others, iterations=4) & ~ndimage.binary_dilation(figmask, iterations=2)] = 0

    def gray(a):
        g = luma(a[..., :3])
        return np.where(a[..., 3] > 0, g, 255.0).astype(np.float32)

    def silhouette(a):
        return np.where(a[..., 3] > 0, 0.0, 255.0).astype(np.float32)

    def ecc(f):
        warp = np.eye(2, 3, dtype=np.float32)
        try:
            _, warp = cv2.findTransformECC(cv2.GaussianBlur(f(B), (0, 0), 2), cv2.GaussianBlur(f(E), (0, 0), 2), warp,
                                           cv2.MOTION_EUCLIDEAN,
                                           (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-5),
                                           ndimage.binary_dilation(figmask, iterations=6).astype(np.uint8), 5)
        except cv2.error:
            return None
        return warp if np.hypot(warp[0, 2], warp[1, 2]) < 12 else None
    # tones first; an outfit that recolours the whole body (suit) can throw that off, so fall back to the outline shape
    warp = ecc(gray)
    if warp is None:
        warp = ecc(silhouette)
    if warp is None:
        warp = np.eye(2, 3, dtype=np.float32)
    h, w = B.shape[:2]
    Ew = cv2.warpAffine(E, warp, (w, h), flags=cv2.INTER_NEAREST + cv2.WARP_INVERSE_MAP)
    ea = Ew[..., 3] > 0
    d = np.abs(Ew[..., :3] - B[..., :3]).sum(-1)
    changed = ea & (~ba | (d > thresh))
    changed = ndimage.binary_opening(changed, iterations=1)
    lab, n = ndimage.label(changed)
    if n:
        sizes = ndimage.sum(changed, lab, range(1, n + 1))
        keep = np.zeros(n + 1, bool)
        keep[1:] = sizes >= max(60, sizes.max() * 0.004)
        changed = keep[lab]
    dark = ea & (luma(Ew[..., :3]) < 95)
    layer = changed | (ndimage.binary_dilation(changed, iterations=10) & dark)
    closed = ndimage.binary_closing(layer, structure=np.ones((3, 3)), iterations=5)
    filled = ndimage.binary_fill_holes(closed)
    holes = filled & ~closed
    hl, hn = ndimage.label(holes)
    if hn:
        hs = ndimage.sum(holes, hl, range(1, hn + 1))
        small = np.zeros(hn + 1, bool)
        small[1:] = hs < 0.01 * figmask.sum()
        closed |= small[hl]
    layer = closed & ea
    # drop islands that do not touch this figure (bits of a neighbour's new hair etc.)
    lab, n = ndimage.label(ndimage.binary_dilation(layer, iterations=1))
    near = np.unique(lab[ndimage.binary_dilation(figmask, iterations=3) & (lab > 0)])
    layer &= np.isin(lab, near)
    return layer, Ew, float(np.hypot(warp[0, 2], warp[1, 2]))


def split(kind, rgb, m, Lfig):
    """-> {part: mask}. tint parts are later stored as greyscale."""
    c = classes(rgb)
    skin = m & c['skin']
    rest = m & ~skin
    if kind == 'hair':
        hair = rest & (c['L'] < 175) & (c['sat'] < 80)
        return {'skin': skin, 'hair': hair, 'line': rest & ~hair}
    if kind == 'kit':
        socks = m & c['mustard']
        skin &= ~socks
        rest = m & ~skin
        shirt = rest & c['teal']
        shorts = rest & c['navy'] & ~shirt
        # boots: grey (not outline-black, not white trim) pixels in the lower half of the figure
        ys = np.nonzero(m)[0]
        low = np.zeros_like(m)
        if len(ys):
            low[int(ys.min() + (ys.max() - ys.min()) * 0.45):, :] = True
        boots = rest & low & c['grey'] & (c['L'] > 22) & (c['L'] < 175) & ~socks & ~shorts
        line = rest & ~shirt & ~shorts & ~socks & ~boots
        return {'skin': skin, 'shirt': shirt, 'shorts': shorts, 'socks': socks, 'boots': boots, 'line': line}
    if kind == 'tint':
        return {'skin': skin, 'tint': rest}
    if kind == 'band':
        # white band; hair pixels the band pushed around keep the hair colour
        band = rest & (c['L'] > 140) & (c['sat'] < 60)
        hair = rest & ~band & (c['L'] > 28) & (c['sat'] < 80)
        return {'skin': skin, 'tint': band, 'hair': hair, 'line': rest & ~band & ~hair}
    if kind == 'goggles':
        lens = rest & (c['L'] > 120) & (c['sat'] < 60)
        return {'skin': skin, 'lens': lens, 'frame': rest & ~lens}
    return {'skin': skin, 'line': rest}


TINTED = {'skin', 'hair', 'shirt', 'shorts', 'socks', 'boots', 'tint', 'lens', 'frame'}


def part_pixels(name, rgb, mask):
    """RGBA uint8 crop. Tinted parts: grey = luminance normalised so the part's main tone is 0.75."""
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    if name in TINTED:
        L = luma(rgb) / 255.0
        body = mask & (L > 0.12)
        ref = np.percentile(L[body], 60) if body.sum() > 20 else max(0.05, float(np.percentile(L[mask], 60)))
        g = np.clip(L / max(ref, 0.04) * 0.75, 0, 1) * 255
        out[..., 0] = out[..., 1] = out[..., 2] = g.astype(np.uint8)
    else:
        out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[..., 3] = np.where(mask, 255, 0)
    out[~mask] = 0
    return out


# Atlas resolution relative to the generated sheets. Avatars draw at most ~330 device px tall,
# and Android's Fresco pool (192 MB) must hold every pose bitmap a screen shows.
SCALE = 0.6


def emit(pose, layer, parts, rgb, fx, fy):
    """Downscale one layer's parts together: a pixel is kept when the layer covers half of it and goes to the
    part covering most of it, so neighbouring parts never open a gap. Offsets are relative to the figure origin."""
    names = [k for k, m in parts.items() if m.any()]
    if not names:
        return
    h, w = rgb.shape[:2]
    size = (max(1, round(w * SCALE)), max(1, round(h * SCALE)))
    covs = np.stack([cv2.resize(parts[k].astype(np.float32), size, interpolation=cv2.INTER_AREA) for k in names])
    keep, best = covs.sum(0) >= 0.5, covs.argmax(0)
    for i, k in enumerate(names):
        m = keep & (best == i)
        if not m.any():
            continue
        mk = parts[k].astype(np.float32)
        col = np.stack([cv2.resize(rgb[..., c] * mk, size, interpolation=cv2.INTER_AREA) for c in range(3)], -1)
        col /= np.maximum(covs[i], 1e-6)[..., None]
        ys, xs = np.nonzero(m)
        c = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        atlases[pose].add((layer, k, round(c[0] - fx * SCALE, 2), round(c[1] - fy * SCALE, 2)),
                          part_pixels(k, col[c[1]:c[3], c[0]:c[2]], m[c[1]:c[3], c[0]:c[2]]))


class Atlas:
    def __init__(self):
        self.items = []  # (key, img)

    def add(self, key, img):
        self.items.append((key, img))

    def pack(self, width=2048):
        x = y = row = 0
        placed = {}
        for key, im in sorted(self.items, key=lambda t: -t[1].shape[0]):
            h, w = im.shape[:2]
            if x + w > width:
                x, y, row = 0, y + row + 2, 0
            placed[key] = (x, y, w, h)
            x += w + 2
            row = max(row, h)
        H = y + row
        sheet = np.zeros((H, width, 4), np.uint8)
        for key, im in self.items:
            px, py, w, h = placed[key]
            sheet[py:py + h, px:px + w] = im
        used = max(p[0] + p[2] for p in placed.values())
        return sheet[:, :used], placed


data = {'poses': {}, 'atlases': {}}
from collections import defaultdict
atlases = defaultdict(Atlas)
report = []
for s, poses in POSES.items():
    B = load(f'{W}/cut/base-{s}.png')
    boxes, lab = figure_boxes(B[..., 3] > 0)
    assert len(boxes) == len(poses), (s, len(boxes))
    H, Wd = B.shape[:2]
    edits = {}
    for name, (job, kind) in ATLASES.items():
        p = f'{W}/cut/{job}-{s}.png'
        if os.path.exists(p):
            # image_gen may return a sheet a pixel narrower/shorter; pad or crop to the base size (ECC fixes the offset)
            e = np.zeros_like(B)
            src = load(p)[:H, :Wd]
            e[:src.shape[0], :src.shape[1]] = src
            edits[name] = (e, kind)
    for (x, y, w, h, li), pose in zip(boxes, poses):
        # window: room for big hair above/sides, props beside
        x0, y0 = max(0, int(x - 0.35 * w)), max(0, int(y - 0.25 * h))
        x1, y1 = min(Wd, int(x + w * 1.35)), min(H, int(y + h * 1.04))
        Bw = B[y0:y1, x0:x1]
        fig = (lab[y0:y1, x0:x1] == li) & (Bw[..., 3] > 0)
        Bf = Bw.copy()
        Bf[~fig] = 0
        # base parts
        fx, fy = x - x0, y - y0  # figure origin in window
        info = {'sheet': s, 'size': [int(w), int(h)]}
        bparts = split('fixed', Bf[..., :3], fig, h)
        emit(pose, 'base', bparts, Bf[..., :3], fx, fy)
        aligned = {}
        collar = None
        # kit first (its shirt top splits hair into front/back), headbands last (they are cut against their hair)
        for name, (E, kind) in sorted(edits.items(), key=lambda t: (t[0] != 'kit') + (t[0] in PARENT)):
            if name in STAND_ONLY and pose != 'stand':
                continue
            others = (lab[y0:y1, x0:x1] > 0) & (lab[y0:y1, x0:x1] != li)
            if name in PARENT:
                if PARENT[name] == 'hair-bald':
                    P = Bf
                elif PARENT[name] not in aligned:
                    continue
                else:
                    P = aligned[PARENT[name]]
                m, Ew, shift = extract(P, E[y0:y1, x0:x1], P[..., 3] > 0, others)
            else:
                m, Ew, shift = extract(Bf, E[y0:y1, x0:x1], fig, others, THRESH.get(name, 60 if kind == 'kit' else 90))
            if name in THRESH:
                # the low threshold also picks up lip and cheek tone shifts: keep only skin and dark hair dots
                c = classes(Ew[..., :3])
                m &= c['skin'] | ((c['L'] < 175) & (c['sat'] < 80))
            if name.startswith('hair-'):
                aligned[name] = Ew
            report.append((name, s, pose, int(m.sum()), round(shift, 1)))
            if not m.any():
                continue
            if name.startswith('hair-') and collar is not None:
                # hair below the shirt collar hangs behind the shoulders: drawn under the body and outfit
                below = np.zeros_like(m)
                below[collar:] = True
                emit(pose, f'{name}-back', split(kind, Ew[..., :3], m & below, h), Ew[..., :3], fx, fy)
                m = m & ~below
            emit(pose, name, split(kind, Ew[..., :3], m, h), Ew[..., :3], fx, fy)
            if name == 'expr-blink':
                # eyes anchor: centre of the changed face pixels
                ys, xs = np.nonzero(m)
                info['eyes'] = [float(xs.mean() - fx), float(ys.mean() - fy)]
            if name == 'hair-buzz':
                ys, xs = np.nonzero(m)
                info['head'] = [int(xs.min() - fx), int(ys.min() - fy), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]
            if name == 'kit':
                sm = split('kit', Ew[..., :3], m, h)['shirt']
                if sm.any():
                    ys, xs = np.nonzero(sm)
                    collar = int(ys.min() + (ys.max() - ys.min()) * 0.06)
                    info['shirt'] = [int(xs.min() - fx), int(ys.min() - fy), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]
        for k in ('size', 'head', 'shirt', 'eyes'):
            if k in info:
                info[k] = [round(v * SCALE, 2) for v in info[k]]
        data['poses'][pose] = info
# The game draws only the standing pose (T-11-270). The other poses are still cut: the head scale
# reference is the median head width over every pose of the stand sheet, which keeps sizes unchanged.
SHIP = ['stand']
for pose in SHIP:
    sheet = data['poses'][pose]['sheet']
    ws = sorted(v['head'][2] for v in data['poses'].values() if v['sheet'] == sheet)
    data['poses'][pose]['headRef'] = ws[len(ws) // 2]
data['poses'] = {k: data['poses'][k] for k in SHIP}
for name, atlas in sorted(atlases.items()):
    if not atlas.items or name not in SHIP:
        continue
    sheet, placed = atlas.pack()
    Image.fromarray(sheet, 'RGBA').save(f'{OUT}/{name}.png', optimize=True)
    parts = {}
    for (layer, part, ox, oy), (px, py, w, h) in placed.items():
        parts.setdefault(layer, {})[part] = [px, py, w, h, ox, oy]
    data['atlases'][name] = {'width': int(sheet.shape[1]), 'height': int(sheet.shape[0]), 'parts': parts}
json.dump(data, open(JSON, 'w'), separators=(',', ':'))
for r in report:
    print(*r)

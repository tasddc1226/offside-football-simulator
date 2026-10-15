"""Clean cutout of an image_gen PNG drawn on a flat magenta background.

usage: key.py in.png out.png
- background = magenta-ish pixels
- alpha is binary (pixel-art style, no semi-transparent halo)
- edge pixels still tinted by magenta are recoloured to the nearby outline colour
- small floating islands are dropped
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGB')).astype(np.int16)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
# magenta score: red and blue high, green low
mag = np.minimum(r, b) - g
bgish = (mag > 90) & (r > 150) & (b > 150)
# characters never use magenta, so every magenta pocket (e.g. between arm and body) is background
bg = bgish
fg = ~bg
# drop specks and keep the biggest body (plus anything large)
lab2, n = ndimage.label(fg)
if n:
    sizes = ndimage.sum(fg, lab2, range(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes >= max(200, sizes.max() * 0.002)
    fg = keep[lab2]
# spill: foreground pixels that still lean magenta near the edge
edge = fg & ndimage.binary_dilation(~fg, iterations=3)
spill = edge & (mag > 25)
outline = np.array([24, 20, 26], np.int16)
rgb = im.copy()
rgb[spill] = outline
# one more pass: thin magenta-tinted pixels anywhere on the edge ring
ring = fg & ndimage.binary_dilation(~fg, iterations=1)
rgb[ring & (mag > 10)] = outline
a = np.where(fg, 255, 0).astype(np.uint8)
res = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), a])
Image.fromarray(res, 'RGBA').save(out)
ys, xs = np.nonzero(fg)
print(out, 'bbox', xs.min(), ys.min(), xs.max(), ys.max(), 'spill', int(spill.sum()))

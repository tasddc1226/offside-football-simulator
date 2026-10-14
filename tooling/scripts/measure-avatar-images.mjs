// Read source PNGs to record viewports/anchors. Never resize, repaint or re-encode an image.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
const sharp = createRequire(new URL('../../apps/web/package.json', import.meta.url))('sharp');

const root = new URL('../../packages/game/assets/avatar-images/', import.meta.url);
const parsed = JSON.parse(
  await readFile(process.argv[2] ?? new URL('generation.json', root), 'utf8'),
);
const inventory = parsed.assets ?? parsed;
const out = {};
const skin = (r, g, b, a) => a > 160 && r > 90 && r > g * 1.12 && r > b * 1.35 && b > 25;
for (const [name, item] of Object.entries(inventory)) {
  const path = new URL(`${name}.png`, root);
  const bytes = await readFile(path);
  const {
    data,
    info: { width: W, height: H },
  } = await sharp(fileURLToPath(path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const xcounts = new Uint32Array(W),
    ycounts = new Uint32Array(H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (data[(y * W + x) * 4 + 3] > 128) {
        xcounts[x]++;
        ycounts[y]++;
      }
  const cuts = (counts, n) => {
    const total = counts.length,
      result = [0];
    for (let i = 1; i < n; i++) {
      const at = (total * i) / n,
        span = (total / n) * 0.18;
      let best = Math.round(at),
        score = Infinity;
      for (let j = Math.round(at - span); j <= at + span; j++) {
        const s = counts[j] + Math.abs(j - at) * 0.001;
        if (s < score) {
          best = j;
          score = s;
        }
      }
      result.push(best);
    }
    result.push(total);
    return result;
  };
  const xs = cuts(xcounts, item.cols),
    ys = cuts(ycounts, item.rows),
    frames = [];
  for (let row = 0; row < item.rows; row++)
    for (let col = 0; col < item.cols; col++) {
      const x0 = xs[col],
        y0 = ys[row],
        w = xs[col + 1] - x0,
        h = ys[row + 1] - y0;
      let bx = W,
        by = H,
        ex = 0,
        ey = 0;
      const mask = new Uint8Array(w * h),
        components = [];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = ((y + y0) * W + x + x0) * 4;
          if (data[i + 3] > 128) {
            bx = Math.min(bx, x + x0);
            by = Math.min(by, y + y0);
            ex = Math.max(ex, x + x0);
            ey = Math.max(ey, y + y0);
          }
          if (skin(data[i], data[i + 1], data[i + 2], data[i + 3])) mask[y * w + x] = 1;
        }
      const queue = new Int32Array(w * h);
      for (let index = 0; index < mask.length; index++)
        if (mask[index]) {
          let start = 0,
            end = 1,
            minx = w,
            miny = h,
            maxx = 0,
            maxy = 0;
          queue[0] = index;
          mask[index] = 0;
          while (start < end) {
            const at = queue[start++],
              x = at % w,
              y = Math.floor(at / w);
            minx = Math.min(minx, x);
            miny = Math.min(miny, y);
            maxx = Math.max(maxx, x);
            maxy = Math.max(maxy, y);
            for (const next of [
              x > 0 ? at - 1 : -1,
              x + 1 < w ? at + 1 : -1,
              y > 0 ? at - w : -1,
              y + 1 < h ? at + w : -1,
            ])
              if (next >= 0 && mask[next]) {
                mask[next] = 0;
                queue[end++] = next;
              }
          }
          if (end > 20)
            components.push({
              box: [minx + x0, miny + y0, maxx - minx + 1, maxy - miny + 1],
              area: end,
            });
        }
      components.sort((a, b) => b.area - a.area);
      const face = components[0]?.box ?? [bx, by, ex - bx + 1, ey - by + 1];
      const bbox = [
        Math.max(x0, bx - 4),
        Math.max(y0, by - 4),
        Math.min(xs[col + 1], ex + 5) - Math.max(x0, bx - 4),
        Math.min(ys[row + 1], ey + 5) - Math.max(y0, by - 4),
      ];
      const grey = new Uint8Array(w * h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = ((y + y0) * W + x + x0) * 4,
            r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          if (
            y + y0 > face[1] + face[3] + face[2] * 0.1 &&
            data[i + 3] > 180 &&
            r > 35 &&
            r < 185 &&
            Math.max(r, g, b) - Math.min(r, g, b) < 32
          )
            grey[y * w + x] = 1;
        }
      const boots = regions(grey, w, h)
        .filter(
          (c) =>
            c.area > face[2] * face[2] * 0.001 &&
            c.box[2] < face[2] * 0.85 &&
            c.box[3] < face[2] * 0.5,
        )
        .sort((a, b) => b.area - a.area)
        .slice(0, 2)
        .map((c) => [c.box[0] + x0 - 2, c.box[1] + y0 - 2, c.box[2] + 4, c.box[3] + 4]);
      frames.push({ crop: bbox, face, skin: components.slice(1, 7).map((c) => c.box), boots });
    }
  out[name] = {
    width: W,
    height: H,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    cols: item.cols,
    rows: item.rows,
    frames,
  };
  console.log(name, `${W}x${H}`, frames.length);
}
await writeFile(
  new URL('../../packages/game/src/avatar-image-data.json', import.meta.url),
  await format(JSON.stringify(out), { parser: 'json' }),
);
await writeFile(
  new URL('../../packages/game/assets/avatar-images/generation.json', import.meta.url),
  JSON.stringify(
    {
      tool: 'built-in image_gen',
      processing: 'Original PNG bytes; read-only viewport/anchor measurement; no dot conversion',
      assets: Object.fromEntries(
        Object.entries(inventory).map(([name, it]) => [
          name,
          {
            file: `${name}.png`,
            prompt: it.prompt,
            cols: it.cols,
            rows: it.rows,
            sha256: out[name].sha256,
          },
        ]),
      ),
    },
    null,
    2,
  ) + '\n',
);

function regions(mask, w, h) {
  const out = [],
    queue = new Int32Array(w * h);
  for (let index = 0; index < mask.length; index++)
    if (mask[index]) {
      let start = 0,
        end = 1,
        minx = w,
        miny = h,
        maxx = 0,
        maxy = 0;
      queue[0] = index;
      mask[index] = 0;
      while (start < end) {
        const at = queue[start++],
          x = at % w,
          y = Math.floor(at / w);
        minx = Math.min(minx, x);
        miny = Math.min(miny, y);
        maxx = Math.max(maxx, x);
        maxy = Math.max(maxy, y);
        for (const next of [
          x > 0 ? at - 1 : -1,
          x + 1 < w ? at + 1 : -1,
          y > 0 ? at - w : -1,
          y + 1 < h ? at + w : -1,
        ])
          if (next >= 0 && mask[next]) {
            mask[next] = 0;
            queue[end++] = next;
          }
      }
      out.push({ box: [minx, miny, maxx - minx + 1, maxy - miny + 1], area: end });
    }
  return out;
}

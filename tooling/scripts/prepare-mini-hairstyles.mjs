// T-11-243: approved raster heads -> recolorable material maps. Run from the repository root.
// Keep the existing canonical body and 17 pose timings/anchors; preserve the canonical face and replace only scalp/hair artwork.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sharp = createRequire(path.join(root, 'apps/web/package.json'))('sharp');
const prettier = createRequire(path.join(root, 'package.json'))('prettier');
const writeFormatted = async (file, source) =>
  fs.writeFile(
    file,
    await prettier.format(source, { ...(await prettier.resolveConfig(file)), filepath: file }),
  );
const dir = path.join(root, 'docs/assets/mini-hairstyles-v2');
const game = path.join(root, 'packages/game/src');
const styles = ['bald', 'shaved', 'dread', 'fauxhawk', 'ponytail', 'mullet'];
const old = await fs.readFile(path.join(game, 'avatar-mini-data.ts'), 'utf8');
const body = [
  ...old.match(/short: \[([\s\S]*?)\n {2}\]/)[1].matchAll(/'([^.']*\.[^']*|[^']{48})'/g),
].map((m) => m[1]);
if (body.length !== 64 || body.some((r) => r.length !== 48)) throw new Error('Canonical body grid');
const poseSource = await fs.readFile(path.join(game, 'avatar-mini-motion/short.ts'), 'utf8');
const poseEntries = [...poseSource.matchAll(/(\w+): \[\s*'([^']+)',([\s\S]*?)\n {2}\]/g)];
if (poseEntries.length !== 17) throw new Error('Canonical pose count');
const decode = (rle) =>
  [...rle.matchAll(/([^\d])(\d*)/g)].map(([, c, n]) => c.repeat(Number(n || 1))).join('');
const encode = (s) =>
  s
    .match(/(.)\1*/g)
    .map((r) => r[0] + (r.length > 1 ? r.length : ''))
    .join('');
const hsv = (r, g, b) => {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  const h = !d ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, max ? d / max : 0, max / 255];
};
const sheets = {},
  metrics = {};
for (const style of styles) {
  const { data, info } = await sharp(path.join(dir, 'source', style + '.png'))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = (x, y) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
  // Shirt starts below the head. Ignore near-transparent colored outline artifacts.
  const tealRows = [];
  for (let y = 0; y < info.height; y++) {
    let n = 0;
    for (let x = 0; x < info.width; x++) {
      const [r, g, b, a] = rgba(x, y);
      if (a > 220 && r < g * 0.7 && g > 55 && b > g * 0.5 && b < g * 1.5) n++;
    }
    if (n > 20) tealRows.push(y);
  }
  const neck = tealRows[0];
  const white = [];
  for (let y = 40; y < neck - 25; y++)
    for (let x = 0; x < info.width; x++) {
      const [r, g, b, a] = rgba(x, y);
      if (a > 220 && Math.min(r, g, b) > 205 && Math.max(r, g, b) - Math.min(r, g, b) < 38)
        white.push([x, y]);
    }
  const eyeX = (Math.min(...white.map((p) => p[0])) + Math.max(...white.map((p) => p[0]))) / 2;
  const eyeY = (Math.min(...white.map((p) => p[1])) + Math.max(...white.map((p) => p[1]))) / 2;
  // Align hair to the existing face: eye whites span 11 cells centered at x=25.5.
  const scale =
    11 / (Math.max(...white.map((p) => p[0])) - Math.min(...white.map((p) => p[0])) + 1);
  let sourceTop = info.height;
  for (let y = 0; y < neck; y++)
    for (let x = 0; x < info.width; x++)
      if (rgba(x, y)[3] > 220) sourceTop = Math.min(sourceTop, y);
  const browY = eyeY - 4 / scale;
  const head = Array.from({ length: 36 }, () => Array(48).fill('.'));
  for (let y = 0; y < 36; y++)
    for (let x = 0; x < 48; x++) {
      const sx = Math.round((x - 25.5) / scale + eyeX);
      const sy = Math.round(
        y < 17 ? sourceTop + ((y - 2) * (browY - sourceTop)) / 15 : (y - 21) / scale + eyeY,
      );
      if (y < 2) continue;
      if (sx < 0 || sy < 0 || sx >= info.width || sy >= info.height) continue;
      const [r, g, b, a] = rgba(sx, sy),
        [h, s, v] = hsv(r, g, b);
      if (a < 220) continue;
      // Keep trailing locks behind the ear; exclude shoulders, white collar and neck below the chin.
      const tail = ['dread', 'mullet', 'ponytail'].includes(style) && x < 18 && v < 0.42;
      if (sy >= neck - 8 && !tail) continue;
      if (y >= 30 && !tail) continue;
      let token;
      if (v < 0.08) token = 'O';
      else if (style === 'shaved' && y < 17 && x < 21 && v > 0.35 && v < 0.85) token = 'r';
      else if (s < 0.2 && v > 0.8) token = 'w';
      else if (['fauxhawk', 'ponytail', 'mullet'].includes(style) && h > 34 && h < 65 && s > 0.25)
        token = v > 0.92 ? 'j' : v > 0.75 ? 'h' : v > 0.5 ? 'H' : 'J';
      else if (h < 40 && s > 0.24 && v > 0.35)
        token = v > 0.91 ? 'L' : v > 0.72 ? 's' : v > 0.48 ? 'S' : 'N';
      else if (['bald', 'shaved'].includes(style) && y < 16 && v > 0.35)
        token = style === 'bald' ? 'S' : 'r';
      else if (y >= 19 && y <= 24 && x >= 21 && v < 0.2) token = 'e';
      else if (y >= 25 && x >= 23 && v < 0.3) token = 'm';
      else if (style === 'mullet') token = v > 0.22 ? 'f' : v > 0.12 ? 'F' : 'O';
      else token = v > 0.28 ? 'j' : v > 0.18 ? 'h' : v > 0.11 ? 'H' : 'J';
      head[y][x] = token;
    }
  // An authored, smooth scalp replaces the old hair silhouette. Everything from
  // the eyebrows through ears/chin remains the exact canonical short-style face.
  const scalp = [
    [21, 27],
    [18, 30],
    [16, 32],
    [15, 33],
    [14, 34],
    [13, 34],
    [12, 34],
    [12, 34],
    [11, 34],
    [11, 34],
    [11, 34],
    [11, 34],
    [11, 34],
    [11, 34],
  ];
  const rows = body.map((r, y) => [...r].map((c) => (y < 16 ? '.' : c)));
  scalp.forEach(([left, right], i) => {
    const y = i + 2;
    for (let x = left; x <= right; x++)
      rows[y][x] =
        x === left || x === right || y === 2 || x < scalp[i - 1]?.[0] || x > scalp[i - 1]?.[1]
          ? 'O'
          : x < left + 3
            ? 'S'
            : 'L';
  });
  if (style === 'shaved') {
    for (let y = 4; y < 16; y++)
      for (let x = 12; x < 22; x++)
        if ('sSLN'.includes(rows[y][x]) && x < 18 + Math.floor((16 - y) / 3)) rows[y][x] = 'r';
  }
  // Ignore raster facial marks and skin. Source art contributes only hair and
  // its adjacent outline, never a second set of eyes, ears or a different chin.
  const hair = (c) => 'hHjJfF'.includes(c);
  const protectedFace = (x, y) => y >= 16 && y < 30 && body[y][x] !== '.';
  const hairCells = new Set();
  if (!['bald', 'shaved'].includes(style))
    head.forEach((r, y) =>
      r.forEach((c, x) => {
        if (protectedFace(x, y)) return;
        const nearHair = [-1, 0, 1].some((dy) =>
          [-1, 0, 1].some((dx) => hair(head[y + dy]?.[x + dx] ?? '.')),
        );
        if (hair(c) || (c === 'O' && nearHair)) {
          rows[y][x] = c;
          hairCells.add(y * 48 + x);
        }
      }),
    );
  // Dense hairstyles cover the scalp; source antialiasing must not leave tiny
  // skin-colored pinholes or transparent chips along the outer contour.
  if (['dread', 'ponytail', 'mullet'].includes(style))
    for (let y = 2; y < 12; y++)
      for (let x = 0; x < 48; x++)
        if ('sSLN'.includes(rows[y][x])) rows[y][x] = style === 'mullet' ? 'h' : 'H';
  const beforeContour = rows.map((r) => [...r]);
  for (let y = 2; y < 30; y++)
    for (let x = 1; x < 47; x++) {
      if (protectedFace(x, y)) continue;
      const adjacent = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ].map(([dx, dy]) => beforeContour[y + dy]?.[x + dx] ?? '.');
      if (rows[y][x] === '.' && adjacent.filter((c) => c !== '.').length >= 3) {
        rows[y][x] = 'O';
        hairCells.add(y * 48 + x);
      } else if (rows[y][x] !== '.' && adjacent.includes('.')) rows[y][x] = 'O';
    }
  const composedHead = rows
    .slice(0, 36)
    .map((r, y) => r.map((c, x) => (y < 30 || hairCells.has(y * 48 + x) ? c : '.')));
  sheets[style] = rows.map((r) => r.join(''));
  metrics[style] = { neck, scale, eye: [eyeX, eyeY] };
  const poses = [];
  for (const [, pose, rle, nums] of poseEntries) {
    const anchors = nums.match(/-?\d+/g).map(Number),
      [dx, dy] = anchors;
    const grid = Array.from({ length: 72 }, (_, y) => [...decode(rle).slice(y * 64, (y + 1) * 64)]);
    // Flood the face/hair inside its dark boundary, so raised arms remain in front of the head.
    const original = grid.map((r) => [...r]);
    // Authored overlapping forearms cannot be separated from face skin by a
    // flood fill alone. Keep these limbs in front, including their equipment.
    const foregroundArm = (x, y) =>
      (pose === 'waveLow' && x <= dx + 12 && y >= dy + 17) ||
      (pose === 'waveHigh' && x <= dx + 11 && y >= dy + 11) ||
      (pose === 'lift' && (x <= dx + 16 || x >= dx + 33) && y < dy + 27);

    const mask = new Set();
    const key = (x, y) => y * 64 + x;
    const inside = (x, y) => x >= dx + 5 && x < dx + 44 && y >= dy && y < dy + 30;
    const seeds = [];
    for (let y = Math.max(0, dy); y < Math.min(72, dy + 30); y++)
      for (let x = Math.max(0, dx + 5); x < Math.min(64, dx + 44); x++)
        if ('hHjJwem'.includes(grid[y][x])) mask.add(key(x, y));
    // Skin at the middle of the forehead joins cheek, ear and chin, not the separated arms.
    let seed = null,
      distance = Infinity;
    for (let y = dy + 10; y < dy + 29; y++)
      for (let x = dx + 16; x < dx + 39; x++)
        if ('sSLN'.includes(grid[y]?.[x] ?? '.')) {
          const d = Math.abs(x - dx - 29) + Math.abs(y - dy - 21);
          if (d < distance) {
            seed = [x, y];
            distance = d;
          }
        }
    if (seed) seeds.push(seed);
    while (seeds.length) {
      const [x, y] = seeds.pop();
      if (
        !inside(x, y) ||
        foregroundArm(x, y) ||
        !grid[y]?.[x] ||
        mask.has(key(x, y)) ||
        !'sSLN'.includes(grid[y][x])
      )
        continue;
      mask.add(key(x, y));
      seeds.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
    }
    const armMask = new Set();
    for (let y = Math.max(0, dy); y < Math.min(72, dy + 30); y++)
      for (let x = 0; x < 64; x++)
        if ('sSLN'.includes(original[y][x]) && (foregroundArm(x, y) || x < dx + 5 || x >= dx + 39))
          armMask.add(key(x, y));
    const outline = new Set(mask);
    for (const k of mask) {
      const x = k % 64,
        y = Math.floor(k / 64);
      for (let yy = y - 4; yy <= y + 4; yy++)
        for (let xx = x - 4; xx <= x + 4; xx++)
          if (inside(xx, yy) && original[yy]?.[xx] === 'O') outline.add(key(xx, yy));
    }
    const armOutline = new Set(armMask);
    for (const k of armMask) {
      const x = k % 64,
        y = Math.floor(k / 64);
      for (let yy = y - 1; yy <= y + 1; yy++)
        for (let xx = x - 1; xx <= x + 1; xx++)
          if (original[yy]?.[xx] === 'O') armOutline.add(key(xx, yy));
    }
    for (const k of outline) grid[Math.floor(k / 64)][k % 64] = '.';
    composedHead.forEach((r, y) =>
      r.forEach((c, x) => {
        const px = x + dx,
          py = y + dy;
        if (c !== '.' && px >= 0 && px < 64 && py >= 0 && py < 72) grid[py][px] = c;
      }),
    );
    for (let y = Math.max(0, dy); y < Math.min(72, dy + 30); y++)
      for (let x = 0; x < 64; x++)
        if (
          (armOutline.has(key(x, y)) ||
            (!outline.has(key(x, y)) && (composedHead[y - dy]?.[x - dx] ?? '.') === '.')) &&
          original[y][x] !== '.'
        ) {
          const c = original[y][x],
            skin = 'sSLN'.indexOf(c);
          grid[y][x] = skin >= 0 ? 'uUiI'[skin] : c;
        }
    poses.push(
      `  ${pose}: [${JSON.stringify(encode(grid.flat().join('')))}, ${anchors.join(', ')}],`,
    );
  }
  await writeFormatted(
    path.join(game, 'avatar-mini-motion', style + '.ts'),
    `// T-11-243 ${style}: hair-only layer on canonical short-style face/body poses.\nimport type { MiniPoseData } from '../avatar-motion.js';\nconst POSES: MiniPoseData = {\n${poses.join('\n')}\n};\nexport default POSES;\n`,
  );
}
await writeFormatted(
  path.join(game, 'avatar-mini-hair-data.ts'),
  `// T-11-243 generated by tooling/scripts/prepare-mini-hairstyles.mjs.\nexport const EXTRA_MINI_SPRITES = ${JSON.stringify(sheets, null, 2)} as const;\n`,
);
await writeFormatted(path.join(dir, 'normalization.json'), JSON.stringify(metrics, null, 2) + '\n');
console.log({ styles, canonicalBody: true, poses: poseEntries.length, materials: 'recolorable' });

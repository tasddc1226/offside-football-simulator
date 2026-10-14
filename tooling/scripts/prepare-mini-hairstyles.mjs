// T-11-243: approved raster heads -> recolorable material maps. Run from the repository root.
// Keep the existing canonical body and 17 pose timings/anchors; preserve the canonical face and replace only scalp/hair artwork.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const prettier = createRequire(path.join(root, 'package.json'))('prettier');
const writeFormatted = async (file, source) =>
  fs.writeFile(
    file,
    await prettier.format(source, { ...(await prettier.resolveConfig(file)), filepath: file }),
  );
const dir = path.join(root, 'docs/assets/mini-hairstyles-v2');
const game = path.join(root, 'packages/game/src');
const styles = ['bald', 'shaved', 'dread', 'fauxhawk', 'ponytail', 'mullet'];
const armRegions = JSON.parse(await fs.readFile(path.join(game, 'avatar-mini-limbs.json'), 'utf8'));
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
// Reviewed material layers retain the approved silhouette and volume.
// Never repeatedly rescale raster heads to fit facial landmarks: the face is
// immutable and only this scalp/hair layer is composited over it.
const layers = JSON.parse(await fs.readFile(path.join(dir, 'hair-layers.json'), 'utf8'));
const sheets = {};
for (const style of styles) {
  const head = layers[style].map((r) => [...r]);
  if (head.length !== 36 || head.some((r) => r.length !== 48)) throw new Error('Hair layer grid');
  const rows = body.map((r, y) => [...r].map((c) => (y < 16 ? '.' : c)));
  head.forEach((r, y) =>
    r.forEach((c, x) => {
      if (c !== '.') rows[y][x] = c;
    }),
  );
  const composedHead = rows
    .slice(0, 36)
    .map((r, y) => r.map((c, x) => (y < 30 || head[y][x] !== '.' ? c : '.')));
  sheets[style] = rows.map((r) => r.join(''));
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
      (armRegions[pose] ?? []).some(
        ([left, right, top, bottom]) =>
          x - dx >= left && x - dx <= right && y - dy >= top && y - dy < bottom,
      );

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
    // Sleeves are authored separately from the face. Preserve them even when a
    // bent upper arm crosses the standing-head projection (notably fist).
    for (let y = Math.max(0, dy); y < Math.min(72, dy + 36); y++)
      for (let x = 0; x < 64; x++) if ('vVgG'.includes(original[y][x])) armMask.add(key(x, y));
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
    for (let y = Math.max(0, dy); y < Math.min(72, dy + 36); y++)
      for (let x = 0; x < 64; x++)
        if (
          (y >= dy + 30 ||
            armOutline.has(key(x, y)) ||
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
console.log({ styles, canonicalBody: true, poses: poseEntries.length, materials: 'recolorable' });

// Image-only avatar composition. PNG pixels/geometry stay immutable; colours are rendering filters.
import data from './avatar-image-data.json';
import { isArmyAvatar, miniColors, type AvatarSpec } from './avatar.js';
import { motionDecorationRects, type MiniPose, type MotionFrame } from './avatar-motion.js';
import { kitColorAt } from './kits.js';
import { crestOf, crestSvg } from './crests.js';

export const IMAGE_HAIRS = [
  'short',
  'fringe',
  'long',
  'mohawk',
  'slick',
  'buzz',
  'afro',
  'bun',
  'spiky',
] as const;
export type ImageHair = (typeof IMAGE_HAIRS)[number];
export type ImageBox = readonly [number, number, number, number];
type Measured = { crop: number[]; face: number[]; skin: number[][]; boots: number[][] };
type Sheet = { width: number; height: number; frames: Measured[]; sha256: string };
export const IMAGE_SHEETS: Readonly<Record<string, Sheet>> = data;
export function avatarMotionImageSources(sp: AvatarSpec): string[] {
  const body = isArmyAvatar(sp) ? 'army' : sp.hairStyle;
  return [`${body}-A`, `${body}-B`, `heads-${sp.hairStyle}`];
}
export type FilterOp =
  | { kind: 'matrix'; input: string; result: string; values: number[] }
  | {
      kind: 'composite';
      input: string;
      input2: string;
      result: string;
      operator: 'in' | 'over' | 'arithmetic';
    };
export interface ImageLayer {
  source: string;
  crop: ImageBox;
  x: number;
  y: number;
  scale: number;
  exclude?: ImageBox;
  filters: FilterOp[];
  pattern?: {
    rects: { x: number; y: number; width: number; height: number; fill: string }[];
    mask: number[];
  };
}
export interface AvatarImagePlan {
  layers: ImageLayer[];
  width: number;
  height: number;
  crest?: { svg: string; x: number; y: number; size: number };
  decorations?: ReturnType<typeof motionDecorationRects>;
}
const poseIndex: Record<MiniPose | 'stand', [string, number]> = {
  runL: ['A', 0],
  air: ['A', 1],
  runR: ['A', 2],
  juggle: ['A', 3],
  balance: ['A', 4],
  kick: ['A', 5],
  fist: ['A', 6],
  tuck: ['A', 7],
  spread: ['A', 8],
  jumpUp: ['A', 9],
  kneelOut: ['B', 0],
  kneelUp: ['B', 1],
  kneelFist: ['B', 2],
  waveHigh: ['B', 3],
  waveLow: ['B', 4],
  lift: ['B', 5],
  sad: ['B', 6],
  stand: ['B', 7],
};
const moods: Record<NonNullable<AvatarSpec['expr']>, number> = {
  happy: 1,
  wink: 2,
  pain: 3,
  tired: 4,
  blink: 5,
  shout: 6,
};
const box = (a: readonly number[]): ImageBox => [a[0]!, a[1]!, a[2]!, a[3]!];
const rgb = (hex: string) => {
  const h = hex.replace('#', '');
  const s = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
};
const alphaMatrix = ([r, g, b, a, k]: readonly number[]) => [
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1,
  r!,
  g!,
  b!,
  a!,
  k!,
];
const toneMatrix = (colour: string, channel: readonly number[]) => {
  const c = rgb(colour);
  return c
    .flatMap((v) => [channel[0]! * v, channel[1]! * v, channel[2]! * v, 0, 0])
    .concat([0, 0, 0, 1, 0]);
};
// Every mask is calculated from the source colour, never from edited facial geometry.
const MASKS = {
  skin: [
    [80, -80, 0, -12, 0],
    [0, -30, 60, 0, 0],
  ],
  armySkin: [
    [80, -80, 0, -12, 0],
    [0, 80, -80, -12, 0],
  ],
  hair: [
    [0, 0, 0, 1.05, 0],
    [20, 20, 20, -5, 0],
    [-10, -10, -10, 22, 0],
    [-80, 80, 0, 8, 0],
    [80, -80, 0, 8, 0],
    [0, -80, 80, 8, 0],
    [0, 80, -80, 8, 0],
  ],
  shirt: [[-120, 170, -50, -5, 0]],
  shorts: [
    [-40, -120, 160, -6, 0],
    [80, -80, 0, 15, 0],
  ],
  socks: [
    [80, 50, -130, -8, 0],
    [0, 60, -120, 0, 0],
  ],
} as const;
function filters(sp: AvatarSpec, head: boolean, state: string): FilterOp[] {
  const c = miniColors(sp),
    colours: [string, string, readonly number[]][] = [
      [!head && state === 'army' ? 'armySkin' : 'skin', c.skin, [1, 0, 0]],
    ];
  if (head) colours.push(['hair', c.hair, [1.7, 1.7, 1.7]]);
  else if (state === 'normal')
    colours.push(
      ['shirt', sp.kit.sleeve, [0, 1.6, 0]],
      ['shorts', sp.kit.shorts, [0, 0, 2.8]],
      ['socks', c.sock, [0, 1.45, 0]],
    );
  else if (state === 'boots') colours.push(['hair', c.boot, [1.7, 1.7, 1.7]]);
  else if (state === 'feet')
    colours.push(['shirt', c.sock, [0, 1.6, 0]], ['hair', c.boot, [1.7, 1.7, 1.7]]);
  else if (state === 'injured')
    colours.push(['shirt', sp.kit.sleeve, [0, 1.6, 0]], ['shorts', sp.kit.shorts, [0, 0, 2.8]]);
  const ops: FilterOp[] = [];
  let previous = 'SourceGraphic';
  colours.forEach(([name, colour, tone], i) => {
    let mask = '';
    MASKS[name as keyof typeof MASKS].forEach((v, j) => {
      const id = `m${i}_${j}`;
      ops.push({ kind: 'matrix', input: 'SourceGraphic', result: id, values: alphaMatrix(v) });
      if (mask) {
        const combined = `c${i}_${j}`;
        ops.push({ kind: 'composite', input: id, input2: mask, result: combined, operator: 'in' });
        mask = combined;
      } else mask = id;
    });
    const coloured = `tone${i}`,
      inside = `inside${i}`,
      next = `out${i}`;
    ops.push({
      kind: 'matrix',
      input: 'SourceGraphic',
      result: coloured,
      values: toneMatrix(colour, tone),
    });
    ops.push({ kind: 'composite', input: coloured, input2: mask, result: inside, operator: 'in' });
    // Remove the original only under the colour mask before overlaying the replacement.
    const inverse = `inv${i}`,
      outside = `outside${i}`;
    ops.push({
      kind: 'matrix',
      input: mask,
      result: inverse,
      values: alphaMatrix([0, 0, 0, -1, 1]),
    });
    ops.push({
      kind: 'composite',
      input: previous,
      input2: inverse,
      result: outside,
      operator: 'in',
    });
    ops.push({
      kind: 'composite',
      input: inside,
      input2: outside,
      result: next,
      operator: 'arithmetic',
    });
    previous = next;
  });
  return ops;
}
function layer(
  source: string,
  index: number,
  x: number,
  y: number,
  scale: number,
  ops: FilterOp[],
): ImageLayer {
  return {
    source,
    crop: box(IMAGE_SHEETS[source]!.frames[index]!.crop),
    x,
    y,
    scale,
    filters: ops,
  };
}
/** The same plan drives Svelte and React Native. No game RNG, storage or network. */
export function avatarImagePlan(
  sp: AvatarSpec,
  f?: MotionFrame,
  portrait = false,
): AvatarImagePlan {
  const still = sp.acc.some((a) => a === 'crutch' || a === 'suit' || a === 'bouquet');
  const pose = still ? 'stand' : (f?.pose ?? 'stand');
  const [part, index] = poseIndex[pose];
  const state = sp.acc.includes('suit')
    ? 'retired'
    : sp.acc.includes('crutch')
      ? 'injured'
      : isArmyAvatar(sp)
        ? 'army'
        : 'normal';
  const movingBody = state === 'normal' || state === 'army';
  const source =
    state === 'normal' ? `${sp.hairStyle}-${part}` : state === 'army' ? `army-${part}` : state;
  const body = IMAGE_SHEETS[source]!.frames[movingBody ? index : 0]!;
  const [bx, by, bw, bh] = box(body.crop),
    [fx, fy, fw, fh] = box(body.face);
  const width = f ? 32 : 24,
    height = f ? 36 : 32;
  const scale = Math.min(13 / fw, (height - 2) / bh, (width - 1) / bw);
  const dx = Math.max(
      0.5,
      Math.min(width - bw * scale - 0.5, width / 2 - (fx + fw / 2 - bx) * scale),
    ),
    dy = height - 1 - bh * scale;
  const expression = sp.expr === 'pain' ? sp.expr : (f?.expr ?? sp.expr);
  const beard = sp.beard === 'full' ? 2 : sp.beard === 'stubble' ? 1 : 0;
  const headIndex = beard * 7 + (expression ? moods[expression] : 0);
  const headSource = `heads-${sp.hairStyle}`,
    head = IMAGE_SHEETS[headSource]!.frames[headIndex]!;
  const [hx, hy] = box(head.crop),
    [hfx, hfy, hfw] = box(head.face);
  const headScale = (fw * scale) / hfw;
  const headX = dx + (fx + fw / 2 - bx) * scale - (hfx + hfw / 2 - hx) * headScale;
  const neutralFace = IMAGE_SHEETS[headSource]!.frames[0]!.face;
  const neckJoin = state === 'normal' ? 0 : (fh - (neutralFace[3]! * fw) / neutralFace[2]!) * scale;
  const headY = dy + (fy - by) * scale - (hfy - hy) * headScale + neckJoin;
  const bodyLayer = layer(source, movingBody ? index : 0, dx, dy, scale, filters(sp, false, state));
  const headTop = Math.max(by, fy - fh * 0.95);
  bodyLayer.exclude =
    pose === 'stand'
      ? [bx, headTop, bw, fy + fh - headTop]
      : [fx - fw * 0.22, headTop, fw * 1.44, fy + fh - headTop];
  if (state === 'normal' || state === 'injured') {
    // Uniform pattern geometry is masked by the original jersey PNG, including its folds/sleeves.
    const rects: { x: number; y: number; width: number; height: number; fill: string }[] = [];
    const left = fx + fw * 0.05,
      top = fy + fh * 0.94,
      unitX = fw * 0.08,
      unitY = fh / 11;
    for (let row = 0; row < 14; row++) {
      let start = -4,
        colour = kitColorAt(sp.kit, start, 13 + row);
      for (let col = -3; col <= 28; col++) {
        const next = col < 28 ? kitColorAt(sp.kit, col, 13 + row) : '';
        if (next !== colour) {
          rects.push({
            x: left + (start - 7) * unitX,
            y: top + row * unitY,
            width: (col - start) * unitX + 0.02,
            height: unitY + 0.02,
            fill: colour,
          });
          start = col;
          colour = next;
        }
      }
    }
    bodyLayer.pattern = { rects, mask: alphaMatrix(MASKS.shirt[0]) };
  }
  const layers = [
    bodyLayer,
    layer(headSource, headIndex, headX, headY, headScale, filters(sp, true, state)),
  ];
  if (state === 'normal') {
    for (const a of body.boots) {
      const boot = layer(source, index, dx, dy, scale, filters(sp, false, 'boots'));
      boot.crop = box(a);
      boot.x += (a[0]! - bx) * scale;
      boot.y += (a[1]! - by) * scale;
      layers.push(boot);
    }
  }
  if (state === 'injured') {
    // Both feet lie inside the face width; leave the separate crutch shaft untouched.
    const feet = layer(source, 0, dx, dy, scale, filters(sp, false, 'feet'));
    const top = fy + fh * 1.9;
    feet.crop = [fx, top, fw, by + bh - top];
    feet.x += (feet.crop[0] - bx) * scale;
    feet.y += (feet.crop[1] - by) * scale;
    layers.push(feet);
  }
  const accessories = IMAGE_SHEETS.accessories!;
  const add = (i: number, x: number, y: number, w: number, colour?: string) => {
    const a = accessories.frames[i]!,
      s = w / a.crop[2]!;
    const ops: FilterOp[] = colour
      ? [
          {
            kind: 'matrix',
            input: 'SourceGraphic',
            result: 'tint',
            values: toneMatrix(colour, [0.35, 0.35, 0.35]),
          },
        ]
      : [];
    layers.push(layer('accessories', i, x, y, s, ops));
  };
  const faceX = dx + (fx - bx) * scale,
    faceY = dy + (fy - by) * scale,
    faceW = fw * scale,
    faceH = fh * scale;
  const c = miniColors(sp);
  if (c.band) add(0, faceX - faceW * 0.05, faceY - faceH * 0.12, faceW * 1.03, c.band);
  if (c.goggle) {
    add(1, faceX + faceW * 0.18, faceY + faceH * 0.24, faceW * 0.82, c.goggle.G);
    const lens = layers[layers.length - 1]!;
    lens.filters.push(
      {
        kind: 'matrix',
        input: 'SourceGraphic',
        result: 'lensMask',
        values: alphaMatrix([20, 20, 20, -45, 0]),
      },
      {
        kind: 'matrix',
        input: 'SourceGraphic',
        result: 'lensTone',
        values: toneMatrix(c.goggle.g, [0.35, 0.35, 0.35]),
      },
      {
        kind: 'composite',
        input: 'lensTone',
        input2: 'lensMask',
        result: 'lensInside',
        operator: 'in',
      },
      {
        kind: 'matrix',
        input: 'lensMask',
        result: 'lensInverse',
        values: alphaMatrix([0, 0, 0, -1, 1]),
      },
      {
        kind: 'composite',
        input: 'tint',
        input2: 'lensInverse',
        result: 'lensOutside',
        operator: 'in',
      },
      {
        kind: 'composite',
        input: 'lensInside',
        input2: 'lensOutside',
        result: 'lensResult',
        operator: 'arithmetic',
      },
    );
  }
  if (sp.acc.includes('bandage')) add(4, faceX + faceW * 0.55, faceY - faceH * 0.08, faceW * 0.28);
  const arms = body.skin.filter(
    (a) => a[2]! > fw * 0.08 && a[3]! > fh * 0.08 && a[1]! < fy + fh * 2.2,
  );
  if (c.wrist)
    for (const a of arms.slice(0, 2))
      add(
        2,
        dx + (a[0]! - bx) * scale,
        dy + (a[1]! + a[3]! * 0.65 - by) * scale,
        Math.max(1.4, a[2]! * scale * 0.65),
        c.wrist,
      );
  if (sp.acc.includes('armband'))
    add(3, faceX - faceW * 0.22, faceY + faceH * 1.25, faceW * 0.22, '#f0b437');
  const minX = Math.min(...layers.map((l) => l.x)),
    minY = Math.min(...layers.map((l) => l.y)),
    maxX = Math.max(...layers.map((l) => l.x + l.crop[2] * l.scale)),
    maxY = Math.max(...layers.map((l) => l.y + l.crop[3] * l.scale));
  const margin = f ? 3 : 0.5;
  const fit = Math.min(
    1,
    (width - margin * 2) / (maxX - minX),
    (height - margin * 2) / (maxY - minY),
  );
  const offsetX = Math.max(margin - minX * fit, Math.min(0, width - margin - maxX * fit));
  const offsetY = Math.max(margin - minY * fit, Math.min(0, height - margin - maxY * fit));
  for (const l of layers) {
    l.x = l.x * fit + offsetX;
    l.y = l.y * fit + offsetY;
    l.scale *= fit;
  }
  const shift = still ? 0 : (f?.sink ?? 0) - (f?.lift ?? 0);
  for (const l of layers) l.y += shift;
  const crest =
    sp.club.id && state !== 'retired' && state !== 'army'
      ? {
          svg:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
            crestSvg(crestOf(sp.club), 'avatar-kit-crest', 'transparent') +
            '</svg>',
          x: (faceX + faceW * 0.51) * fit + offsetX,
          y: (faceY + faceH * 1.25) * fit + offsetY + shift,
          size: faceW * 0.16 * fit,
        }
      : undefined;
  const decorations =
    f && !still
      ? motionDecorationRects(f, {
          face: [(faceX + faceW / 2) * fit + offsetX, faceY * fit + offsetY],
          foot: [width * 0.66, height - 4],
          top: [width / 2, Math.max(6.5, minY * fit + offsetY)],
        })
      : undefined;
  return {
    layers,
    width,
    height: portrait ? 21 : height,
    ...(crest ? { crest } : {}),
    ...(decorations ? { decorations } : {}),
  };
}

// 겹쳐 그리는 선수 그림. 자세마다 같은 맨몸 위에 옷 · 표정 · 수염 · 머리카락 · 꾸미기 층을 순서대로 얹는다.
// 층 PNG(assets/avatar-layers/stand.png)는 서 있는 자세의 모든 층을 한 장에 모은 아틀라스이고, 색은 그릴 때 입힌다.
// T-11-270 모션(뛰는 자세 17장)은 쓰는 화면이 없어져 지웠다. 선수는 언제나 서 있는 자세 한 장으로 그린다.
import data from './avatar-layers.json';
import { isArmyAvatar, miniColors, type AvatarSpec } from './avatar.js';
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
  'bald',
  'shaved',
  'dread',
  'fauxhawk',
  'ponytail',
  'mullet',
] as const;
export type ImageHair = (typeof IMAGE_HAIRS)[number];
export type ImageBox = readonly [number, number, number, number];
/** 아틀라스 안 조각: [아틀라스 x, y, 너비, 높이, 자세 원점 기준 x, y]. */
type Part = [number, number, number, number, number, number];
type Atlas = { width: number; height: number; parts: Record<string, Record<string, Part>> };
type Pose = {
  sheet: string;
  size: number[];
  /** 짧게 깎은 머리 층의 상자 = 머리통. 크기와 가로 위치의 기준이다. */
  head: number[];
  /** 같은 시트 자세들의 머리통 너비 중앙값(예전 18자세 기준, 크기를 그대로 두려고 남겼다). */
  headRef: number;
  /** 유니폼 상의 상자. 무늬 · 엠블럼 위치의 기준이다. */
  shirt?: number[];
};
const LAYERS = data as unknown as { poses: Record<string, Pose>; atlases: Record<string, Atlas> };
/** 층 아틀라스 크기. 이름은 자세 이름(stand)이다. */
export const IMAGE_SHEETS: Readonly<Record<string, { width: number; height: number }>> =
  LAYERS.atlases;
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
  /** 아틀라스(자세) 이름. */
  source: string;
  /** 층 이름(base · kit · hair-afro …). */
  layer: string;
  crop: ImageBox;
  x: number;
  y: number;
  scale: number;
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
}
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
/** 색칠 조각은 밝기만 담은 회색이고 주된 밝기가 0.75다. 색 × 밝기 ÷ 0.75로 칠하면 그림자 · 빛이 그대로 남는다. */
const tint = (colour: string): FilterOp[] => {
  const c = rgb(colour);
  return [
    {
      kind: 'matrix',
      input: 'SourceGraphic',
      result: 'tint',
      values: c.flatMap((v) => [v / 0.75, 0, 0, 0, 0]).concat([0, 0, 0, 1, 0]),
    },
  ];
};
/** 머리 너비(논리 칸). 머리 모양이 달라도 얼굴 크기는 같다. */
const HEAD_W = 13;
type State = 'normal' | 'army' | 'injured' | 'retired';
const stateOf = (sp: AvatarSpec): State =>
  sp.acc.includes('suit')
    ? 'retired'
    : sp.acc.includes('crutch')
      ? 'injured'
      : isArmyAvatar(sp)
        ? 'army'
        : 'normal';
/** 그릴 층 이름(시트 접미사 없이)과 조각별 색. 순서가 곧 그리는 순서다. */
function layerList(
  sp: AvatarSpec,
  state: State,
  expression: AvatarSpec['expr'],
): [string, Record<string, string>][] {
  const c = miniColors(sp);
  const skin = { skin: c.skin },
    hair = { ...skin, hair: c.hair };
  // 어깨 아래로 내려온 머리카락은 몸 · 옷 뒤에 그린다.
  const list: [string, Record<string, string>][] = [
    [`hair-${sp.hairStyle}-back`, hair],
    ['base', skin],
  ];
  if (state === 'retired') list.push(['suit', skin]);
  else if (state === 'army') list.push(['army', skin]);
  else if (c.keeper)
    list.push([
      'keeper',
      { ...skin, shirt: c.keeper, shorts: c.shorts, socks: c.sock, boots: c.boot },
    ]);
  else
    list.push([
      'kit',
      { ...skin, shirt: sp.kit.sleeve, shorts: sp.kit.shorts, socks: c.sock, boots: c.boot },
    ]);
  if (c.kneePad) list.push(['kneepads', { ...skin, tint: c.kneePad }]);
  if (expression) list.push([`expr-${expression}`, skin]);
  if (sp.beard) list.push([`beard-${sp.beard}`, hair]);
  list.push([`hair-${sp.hairStyle}`, hair]);
  // 헤어밴드는 머리 모양마다 그 머리 위에 따로 그렸다.
  if (c.band) list.push([`band-${sp.hairStyle}`, { ...hair, tint: c.band }]);
  if (c.goggle) list.push(['goggles', { ...skin, frame: c.goggle.G, lens: c.goggle.g }]);
  if (c.wrist) list.push(['wrist', { ...skin, tint: c.wrist }]);
  if (c.glove) list.push(['gloves', { ...skin, tint: c.glove }]);
  if (sp.acc.includes('armband')) list.push(['armband', { ...skin, tint: '#f0b437' }]);
  if (sp.acc.includes('bandage')) list.push(['bandage', skin]);
  if (sp.acc.includes('crutch')) list.push(['crutch', skin]);
  if (sp.acc.includes('bouquet')) list.push(['bouquet', skin]);
  return list;
}
/** The same plan drives Svelte and React Native. No game RNG, storage or network. */
export function avatarImagePlan(sp: AvatarSpec, portrait = false): AvatarImagePlan {
  const state = stateOf(sp);
  const pose = 'stand';
  const info = LAYERS.poses[pose]!;
  const [pw, ph] = info.size as [number, number];
  const [hx, , hw] = info.head as [number, number, number, number];
  const width = 24,
    height = 32;
  const scale = Math.min(HEAD_W / info.headRef, (height - 2) / ph, (width - 1) / pw);
  // 머리를 가운데에 두고 발을 바닥에 붙인다. 몸이 칸 밖으로 나가면 안쪽으로 민다.
  const dx = Math.max(0.5, Math.min(width - pw * scale - 0.5, width / 2 - (hx + hw / 2) * scale)),
    dy = height - 1 - ph * scale;
  const expression = sp.expr;
  const layers: ImageLayer[] = [];
  for (const [name, colours] of layerList(sp, state, expression)) {
    const parts = LAYERS.atlases[pose]!.parts[name];
    if (!parts) continue;
    for (const [part, [ax, ay, w, h, ox, oy]] of Object.entries(parts)) {
      const colour = colours[part];
      const l: ImageLayer = {
        source: pose,
        layer: name,
        crop: [ax, ay, w, h],
        x: dx + ox * scale,
        y: dy + oy * scale,
        scale,
        filters: colour ? tint(colour) : [],
      };
      if (name === 'kit' && part === 'shirt' && info.shirt) {
        // 무늬는 상의 조각 모양으로 자른다(소매 · 주름까지). 무늬 칸은 예전 24칸 그림의 몸통 x 7~16, y 13~26이다.
        const [, sy, , sh] = info.shirt as [number, number, number, number];
        const unitX = hw * 0.08,
          unitY = sh / 12,
          left = hx + hw * 0.05 - ox + ax,
          top = sy - oy + ay;
        const rects: NonNullable<ImageLayer['pattern']>['rects'] = [];
        for (let row = 0; row < 14; row++) {
          let start = -4,
            c = kitColorAt(sp.kit, start, 13 + row);
          for (let col = -3; col <= 28; col++) {
            const next = col < 28 ? kitColorAt(sp.kit, col, 13 + row) : '';
            if (next !== c) {
              rects.push({
                x: left + (start - 7) * unitX,
                y: top + row * unitY,
                width: (col - start) * unitX + 0.5,
                height: unitY + 0.5,
                fill: c,
              });
              start = col;
              c = next;
            }
          }
        }
        l.pattern = { rects, mask: alphaMatrix([0, 0, 0, 1, 0]) };
      }
      layers.push(l);
    }
  }
  const minX = Math.min(...layers.map((l) => l.x)),
    minY = Math.min(...layers.map((l) => l.y)),
    maxX = Math.max(...layers.map((l) => l.x + l.crop[2] * l.scale)),
    maxY = Math.max(...layers.map((l) => l.y + l.crop[3] * l.scale));
  const margin = 0.5;
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
  const at = (x: number, y: number): [number, number] => [
    (dx + x * scale) * fit + offsetX,
    (dy + y * scale) * fit + offsetY,
  ];
  const crest =
    sp.club.id && state === 'normal' && info.shirt
      ? (() => {
          const [cx, cy] = at(hx + hw * 0.56, info.shirt[1]! + hw * 0.22);
          return {
            svg:
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
              crestSvg(crestOf(sp.club), 'avatar-kit-crest', 'transparent') +
              '</svg>',
            x: cx,
            y: cy,
            size: hw * 0.17 * scale * fit,
          };
        })()
      : undefined;
  return {
    layers,
    width,
    height: portrait ? 21 : height,
    ...(crest ? { crest } : {}),
  };
}

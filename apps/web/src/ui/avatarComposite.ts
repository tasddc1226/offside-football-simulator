// T-11-270 선수 그림을 한 번만 합성해 캔버스 한 장으로 쓴다.
// 예전에는 선수마다 층 20~30개를 SVG <image> + 색 필터로 겹쳐 그려서, 선수가 많은 화면(팀 · 단체 사진)에서
// 노드 수만 개와 필터 합성 비용이 쌓이고 화면을 다시 그릴 때마다 필터를 다시 계산했다(1~2초씩 멈춤).
// 같은 합성 계획이면 같은 그림이라 계획을 키로 캐시하고, 보여 주는 캔버스는 그 결과를 옮겨 그리기만 한다.
import type { AvatarImagePlan, ImageLayer } from '@offside/game/avatar-image';
import { avatarImageUrl } from './avatarImageSources';

/** 계획 1칸당 캔버스 픽셀. 아틀라스 해상도(1칸 ≈ 8.6px)보다 조금 크게 둬 원본 디테일을 잃지 않는다. */
export const AVATAR_PX = 10;
const PX = AVATAR_PX;
/** 합성한 선수 그림 캐시(한 장 약 300KB). 한 화면의 선수 수보다 넉넉하게 둔다. */
const MAX = 120;
/** 색칠한 층 캐시. 피부 · 머리색 · 유니폼이 같은 선수끼리 같은 층을 다시 쓴다. */
const MAX_LAYERS = 240;
/** 한 번에 이어서 합성할 시간(ms). 넘으면 다음 작업으로 미뤄 화면이 멈추지 않게 한다. */
const BUDGET = 8;

type Atlas = { img: HTMLImageElement; data: Uint8ClampedArray; width: number };
const atlases = new Map<string, Promise<Atlas>>();
function atlas(source: string): Promise<Atlas> {
  let p = atlases.get(source);
  if (!p) {
    const url = avatarImageUrl(source);
    p = url
      ? loadImage(url).then((img) => {
          // 픽셀은 한 번만 읽는다(층마다 GPU에서 읽어 오지 않는다).
          const c = canvasOf(img.naturalWidth, img.naturalHeight);
          const ctx = c.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(img, 0, 0);
          return { img, data: ctx.getImageData(0, 0, c.width, c.height).data, width: c.width };
        })
      : Promise.reject(new Error(`avatar image missing: ${source}`));
    // 실패는 기억하지 않는다(다음 그림에서 다시 받는다).
    p.catch(() => atlases.delete(source));
    atlases.set(source, p);
  }
  return p;
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`avatar image failed: ${src.slice(0, 80)}`));
    img.src = src;
  });
}
const crests = new Map<string, Promise<HTMLImageElement>>();
function crestImage(svg: string): Promise<HTMLImageElement> {
  let p = crests.get(svg);
  if (!p) {
    p = loadImage(`data:image/svg+xml,${encodeURIComponent(svg)}`);
    p.catch(() => crests.delete(svg));
    crests.set(svg, p);
  }
  return p;
}

const canvasOf = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

/** 오래 안 쓴 것부터 버리는 작은 캐시. */
function lruGet<V>(m: Map<string, V>, key: string): V | undefined {
  const v = m.get(key);
  if (v !== undefined) {
    m.delete(key);
    m.set(key, v);
  }
  return v;
}
function lruSet<V>(m: Map<string, V>, key: string, v: V, max: number) {
  m.set(key, v);
  while (m.size > max) m.delete(m.keys().next().value!);
}

const layers = new Map<string, HTMLCanvasElement>();
/** 층 하나 = 아틀라스 조각(색칠 · 무늬까지)을 조각 크기 캔버스에 그린다. */
function layerCanvas(a: Atlas, l: ImageLayer): HTMLCanvasElement {
  const key = JSON.stringify([l.source, l.crop, l.filters, l.pattern]);
  const hit = lruGet(layers, key);
  if (hit) return hit;
  const [x, y, w, h] = l.crop;
  const c = canvasOf(w, h);
  const ctx = c.getContext('2d')!;
  // 그림 계획의 색칠은 색 행렬 하나다(avatar-image.ts tint). SVG feColorMatrix와 같은 식으로 칠한다.
  const m = l.filters.find((op) => op.kind === 'matrix')?.values;
  const out = ctx.createImageData(c.width, c.height);
  const d = out.data,
    src = a.data;
  for (let row = 0; row < h; row++) {
    let i = ((y + row) * a.width + x) * 4,
      o = row * c.width * 4;
    for (let col = 0; col < w; col++, i += 4, o += 4) {
      const al = src[i + 3]!;
      if (!al) continue;
      if (!m) {
        d[o] = src[i]!;
        d[o + 1] = src[i + 1]!;
        d[o + 2] = src[i + 2]!;
        d[o + 3] = al;
        continue;
      }
      const r = src[i]! / 255,
        g = src[i + 1]! / 255,
        b = src[i + 2]! / 255,
        k = al / 255;
      d[o] = (m[0]! * r + m[1]! * g + m[2]! * b + m[3]! * k + m[4]!) * 255;
      d[o + 1] = (m[5]! * r + m[6]! * g + m[7]! * b + m[8]! * k + m[9]!) * 255;
      d[o + 2] = (m[10]! * r + m[11]! * g + m[12]! * b + m[13]! * k + m[14]!) * 255;
      d[o + 3] = (m[15]! * r + m[16]! * g + m[17]! * b + m[18]! * k + m[19]!) * 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  if (l.pattern) {
    // 유니폼 무늬: 무늬 사각형을 상의 조각 모양(알파)으로 잘라 78% 불투명도로 얹는다.
    const p = canvasOf(w, h);
    const pc = p.getContext('2d')!;
    for (const r of l.pattern.rects) {
      pc.fillStyle = r.fill;
      pc.fillRect(r.x - x, r.y - y, r.width, r.height);
    }
    pc.globalCompositeOperation = 'destination-in';
    pc.drawImage(a.img, x, y, w, h, 0, 0, w, h);
    ctx.globalAlpha = 0.78;
    ctx.drawImage(p, 0, 0);
    ctx.globalAlpha = 1;
  }
  lruSet(layers, key, c, MAX_LAYERS);
  return c;
}

// 합성은 짧게 끊어서 한다. 목록이 한꺼번에 열려도 한 작업이 BUDGET을 넘기면 다음 작업으로 넘긴다.
let sliceStart = 0;
let queue: Promise<void> = Promise.resolve();
function turn(): Promise<void> {
  const next = queue.then(async () => {
    if (performance.now() - sliceStart > BUDGET) {
      await new Promise((r) => setTimeout(r, 0));
      sliceStart = performance.now();
    }
  });
  queue = next;
  return next;
}

async function draw(plan: AvatarImagePlan): Promise<HTMLCanvasElement> {
  const sheets = new Map<string, Atlas>();
  for (const s of new Set(plan.layers.map((l) => l.source))) sheets.set(s, await atlas(s));
  const crest = plan.crest ? await crestImage(plan.crest.svg) : undefined;
  await turn();
  const out = canvasOf(plan.width * PX, plan.height * PX);
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  for (const l of plan.layers) {
    const k = l.scale * PX;
    ctx.setTransform(k, 0, 0, k, l.x * PX, l.y * PX);
    ctx.drawImage(layerCanvas(sheets.get(l.source)!, l), 0, 0);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (crest && plan.crest) {
    const s = plan.crest.size * PX;
    ctx.drawImage(crest, plan.crest.x * PX, plan.crest.y * PX, s, s);
  }
  // PNG로 줄이지 않는다(인코딩이 합성보다 수십 배 느리다). 보여 줄 캔버스가 이 캔버스를 그대로 옮겨 그린다.
  return out;
}

const cache = new Map<string, Promise<HTMLCanvasElement>>();
/** 합성한 그림(캔버스). 같은 계획은 한 번만 그린다. 실패는 기억하지 않는다. */
export function composeAvatar(plan: AvatarImagePlan): Promise<HTMLCanvasElement> {
  const key = JSON.stringify(plan);
  const hit = lruGet(cache, key);
  if (hit) return hit;
  const p = draw(plan);
  lruSet(cache, key, p, MAX);
  p.catch(() => cache.delete(key));
  return p;
}

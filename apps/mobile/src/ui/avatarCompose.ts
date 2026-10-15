// T-11-276 선수 그림을 JS에서 한 번 합성해 PNG 한 장으로 쓴다(웹 avatarComposite.ts와 같은 계산).
// T-11-270은 층 20~30개를 화면 밖 react-native-svg 색 필터로 그린 뒤 찍었는데, iOS는 필터 층을 메인 스레드에서
// 하나씩 그려 그림 1장에 0.7초쯤 걸렸다. 처음 여는 화면에서 스크롤이 끊기고 팀 그라운드 카드 그림이 하나씩 떴다.
// 아틀라스 픽셀은 한 번만 풀어 두고, 색칠 · 겹치기 · PNG 만들기를 JS에서 끝내 화면 스레드를 쓰지 않는다.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Unzlib, zlibSync } from '../vendor/fflate';
import type { AvatarImagePlan, ImageLayer } from '@offside/game/avatar-image';
import { avatarAtlasBase64 } from './avatarImageSources';

/** 합성한 그림 캐시(PNG 한 장 수십 KB). 한 화면의 선수 수보다 넉넉하게 둔다. */
const MAX = 160;
/** 색칠한 층 캐시. 피부 · 머리색 · 유니폼이 같은 선수끼리 같은 층을 다시 쓴다. */
const MAX_LAYERS = 240;
/** 한 번에 이어서 합성할 시간(ms). 넘으면 다음 차례로 미뤄 터치 · 애니메이션이 밀리지 않게 한다. */
const BUDGET = 12;

type Atlas = { data: Uint8Array; width: number; height: number };
type Layer = { data: Float32Array; width: number; height: number };

// ───────── PNG 읽기 · 쓰기(RGBA 8비트, 인터레이스 없음만) ─────────
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = (() => {
  const t = new Uint8Array(128);
  for (let i = 0; i < 64; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();
function toBase64(b: Uint8Array): string {
  let s = '';
  let i = 0;
  for (; i + 2 < b.length; i += 3) {
    const n = (b[i]! << 16) | (b[i + 1]! << 8) | b[i + 2]!;
    s += B64[n >> 18]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!;
  }
  if (i < b.length) {
    const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8);
    s +=
      B64[n >> 18]! + B64[(n >> 12) & 63]! + (i + 1 < b.length ? B64[(n >> 6) & 63]! : '=') + '=';
  }
  return s;
}
const u32 = (b: Uint8Array, i: number) =>
  ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;

/**
 * 아틀라스 PNG를 조금씩 푼다. 한 번에 풀면 처음 그림 앞에서 JS가 0.5~1초 멈춰서(터치가 밀린다),
 * base64 풀기 · 압축 풀기 · 줄 복원을 잘게 나눠 yield 사이마다 화면에 차례를 넘긴다.
 */
function* decodeAtlas(b64: string): Generator<void, Atlas> {
  // base64 → 바이트
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((b64.length / 4) * 3 - pad);
  for (let i = 0, o = 0; i < b64.length;) {
    for (const end = Math.min(b64.length, i + 64_000); i < end; i += 4) {
      const n =
        (B64_INDEX[b64.charCodeAt(i)]! << 18) |
        (B64_INDEX[b64.charCodeAt(i + 1)]! << 12) |
        (B64_INDEX[b64.charCodeAt(i + 2)]! << 6) |
        B64_INDEX[b64.charCodeAt(i + 3)]!;
      bytes[o++] = n >> 16;
      if (o < bytes.length) bytes[o++] = (n >> 8) & 255;
      if (o < bytes.length) bytes[o++] = n & 255;
    }
    yield;
  }
  // 조각(chunk) 읽기
  let width = 0,
    height = 0;
  const idat: Uint8Array[] = [];
  for (let i = 8; i < bytes.length;) {
    const len = u32(bytes, i),
      type = String.fromCharCode(bytes[i + 4]!, bytes[i + 5]!, bytes[i + 6]!, bytes[i + 7]!);
    const body = bytes.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') {
      width = u32(body, 0);
      height = u32(body, 4);
      if (body[8] !== 8 || body[9] !== 6 || body[12] !== 0)
        throw new Error('avatar atlas: RGBA8 only');
    } else if (type === 'IDAT') idat.push(body);
    i += 12 + len;
  }
  // 압축 풀기 + 줄 복원. 풀린 만큼씩 줄을 복원한다.
  const stride = width * 4,
    line = stride + 1,
    raw = new Uint8Array(line * height),
    data = new Uint8Array(stride * height);
  let got = 0,
    y = 0;
  const inflate = new Unzlib({}, (chunk) => {
    raw.set(chunk, got);
    got += chunk.length;
  });
  const rows = () => {
    for (; y < height && (y + 1) * line <= got; y++) unfilterRow(raw, data, y, stride);
  };
  for (const body of idat)
    for (let i = 0; i < body.length; i += 32_000) {
      inflate.push(body.subarray(i, i + 32_000));
      rows();
      yield;
    }
  inflate.push(new Uint8Array(0), true);
  rows();
  if (y < height) throw new Error('avatar atlas: truncated');
  return { data, width, height };
}

/** 필터 종류별로 반복문을 나눈다(픽셀마다 분기하면 Hermes에서 몇 배 느리다). */
function unfilterRow(raw: Uint8Array, data: Uint8Array, y: number, stride: number) {
  const f = raw[y * (stride + 1)]!,
    s = y * (stride + 1) + 1,
    o = y * stride,
    up = o - stride;
  if (f === 0 || (f === 2 && !y)) data.set(raw.subarray(s, s + stride), o);
  else if (f === 1) {
    for (let x = 0; x < 4; x++) data[o + x] = raw[s + x]!;
    for (let x = 4; x < stride; x++) data[o + x] = (raw[s + x]! + data[o + x - 4]!) & 255;
  } else if (f === 2) {
    for (let x = 0; x < stride; x++) data[o + x] = (raw[s + x]! + data[up + x]!) & 255;
  } else if (f === 3) {
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? data[o + x - 4]! : 0,
        b = y ? data[up + x]! : 0;
      data[o + x] = (raw[s + x]! + ((a + b) >> 1)) & 255;
    }
  } else {
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? data[o + x - 4]! : 0,
        b = y ? data[up + x]! : 0,
        c = x >= 4 && y ? data[up + x - 4]! : 0;
      const p = a + b - c,
        pa = p > a ? p - a : a - p,
        pb = p > b ? p - b : b - p,
        pc = p > c ? p - c : c - p;
      data[o + x] = (raw[s + x]! + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
    }
  }
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  let c = 0xffffffff;
  for (let i = 4; i < 8 + body.length; i++) c = CRC[(c ^ out[i]!) & 255]! ^ (c >>> 8);
  dv.setUint32(8 + body.length, (c ^ 0xffffffff) >>> 0);
  return out;
}
function encodePng(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibSync(raw, { level: 1 })),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// ───────── 합성 ─────────
let atlasCache: Atlas | undefined;
let decoding: Generator<void, Atlas> | undefined;
let atlasFailed = false;
/** 아틀라스를 BUDGET만큼 더 푼다. 다 풀렸으면 true. */
function stepAtlas(start: number): boolean {
  if (atlasCache) return true;
  decoding ??= decodeAtlas(avatarAtlasBase64);
  for (;;) {
    const r = decoding.next();
    if (r.done) {
      atlasCache = r.value;
      decoding = undefined;
      return true;
    }
    if (Date.now() - start > BUDGET) return false;
  }
}

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

const hex = (c: string) => {
  const h = c.replace('#', '');
  const s = h.length === 3 ? [...h].map((x) => x + x).join('') : h;
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255) as [number, number, number];
};
/** 사각형이 픽셀 하나를 덮는 넓이(0~1). 캔버스 fillRect의 가장자리 반투명과 같게 칠한다. */
const cover = (
  r: { x: number; y: number; width: number; height: number },
  px: number,
  py: number,
) =>
  Math.max(0, Math.min(px + 1, r.x + r.width) - Math.max(px, r.x)) *
  Math.max(0, Math.min(py + 1, r.y + r.height) - Math.max(py, r.y));

const layers = new Map<string, Layer>();
/** 층 하나 = 아틀라스 조각(색칠 · 무늬까지). 미리 곱한 알파(premultiplied) RGBA 실수로 둔다. */
function layerPixels(a: Atlas, l: ImageLayer): Layer {
  const key = JSON.stringify([l.source, l.crop, l.filters, l.pattern]);
  const hit = lruGet(layers, key);
  if (hit) return hit;
  const [x, y, w, h] = l.crop;
  const data = new Float32Array(w * h * 4);
  // 그림 계획의 색칠은 색 행렬 하나다(avatar-image.ts tint). SVG feColorMatrix와 같은 식으로 칠한다.
  const m = l.filters.find((op) => op.kind === 'matrix')?.values;
  const src = a.data;
  for (let row = 0; row < h; row++) {
    let i = ((y + row) * a.width + x) * 4,
      o = row * w * 4;
    for (let col = 0; col < w; col++, i += 4, o += 4) {
      const al = src[i + 3]! / 255;
      if (!al) continue;
      let r = src[i]! / 255,
        g = src[i + 1]! / 255,
        b = src[i + 2]! / 255,
        k = al;
      if (m) {
        const r0 = r,
          g0 = g,
          b0 = b;
        r = m[0]! * r0 + m[1]! * g0 + m[2]! * b0 + m[3]! * al + m[4]!;
        g = m[5]! * r0 + m[6]! * g0 + m[7]! * b0 + m[8]! * al + m[9]!;
        b = m[10]! * r0 + m[11]! * g0 + m[12]! * b0 + m[13]! * al + m[14]!;
        k = m[15]! * r0 + m[16]! * g0 + m[17]! * b0 + m[18]! * al + m[19]!;
      }
      const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
      k = cl(k);
      data[o] = cl(r) * k;
      data[o + 1] = cl(g) * k;
      data[o + 2] = cl(b) * k;
      data[o + 3] = k;
    }
  }
  if (l.pattern) {
    // 유니폼 무늬: 무늬 사각형을 상의 조각 모양(알파)으로 잘라 78% 불투명도로 얹는다.
    const rects = l.pattern.rects.map((r) => ({ ...r, x: r.x - x, y: r.y - y, rgb: hex(r.fill) }));
    for (let row = 0; row < h; row++)
      for (let col = 0; col < w; col++) {
        const mask = src[((y + row) * a.width + x + col) * 4 + 3]! / 255;
        if (!mask) continue;
        let pr = 0,
          pg = 0,
          pb = 0,
          pa = 0;
        for (const r of rects) {
          const c = cover(r, col, row);
          if (!c) continue;
          // 겹친 사각형은 나중 것이 위(source-over).
          pr = r.rgb[0] * c + pr * (1 - c);
          pg = r.rgb[1] * c + pg * (1 - c);
          pb = r.rgb[2] * c + pb * (1 - c);
          pa = c + pa * (1 - c);
        }
        const s = pa * mask * 0.78;
        if (!s) continue;
        const o = (row * w + col) * 4,
          f = pa ? s / pa : 0;
        data[o] = pr * f + data[o]! * (1 - s);
        data[o + 1] = pg * f + data[o + 1]! * (1 - s);
        data[o + 2] = pb * f + data[o + 2]! * (1 - s);
        data[o + 3] = s + data[o + 3]! * (1 - s);
      }
  }
  const layer = { data, width: w, height: h };
  lruSet(layers, key, layer, MAX_LAYERS);
  return layer;
}

/**
 * 계획을 PNG data URI 한 장으로 합성한다. 엠블럼(crest)은 SVG라 그림 위에 따로 얹는다.
 * 한 그림의 층은 모두 같은 배율(scale)이라 아틀라스 해상도(1칸 ≈ 8.6px)에서 정수 위치로 겹치기만 하고,
 * 화면 크기에 맞게 늘이는 일은 그림을 보여 줄 때 맡긴다(층마다 늘여 읽던 계산이 사라진다).
 */
function compose(plan: AvatarImagePlan): string {
  const a = atlasCache!;
  const s = plan.layers[0]?.scale ?? 1;
  const W = Math.ceil(plan.width / s),
    H = Math.ceil(plan.height / s);
  const out = new Float32Array(W * H * 4);
  for (const l of plan.layers) {
    const src = layerPixels(a, l);
    const X = Math.round(l.x / s),
      Y = Math.round(l.y / s);
    const sw = src.width,
      d = src.data;
    const c0 = Math.max(0, -X),
      c1 = Math.min(sw, W - X);
    for (let row = Math.max(0, -Y), r1 = Math.min(src.height, H - Y); row < r1; row++) {
      let i = (row * sw + c0) * 4,
        o = ((Y + row) * W + X + c0) * 4;
      for (let col = c0; col < c1; col++, i += 4, o += 4) {
        const al = d[i + 3]!;
        if (!al) continue;
        if (al >= 1) {
          out[o] = d[i]!;
          out[o + 1] = d[i + 1]!;
          out[o + 2] = d[i + 2]!;
          out[o + 3] = 1;
          continue;
        }
        const inv = 1 - al;
        out[o] = d[i]! + out[o]! * inv;
        out[o + 1] = d[i + 1]! + out[o + 1]! * inv;
        out[o + 2] = d[i + 2]! + out[o + 2]! * inv;
        out[o + 3] = al + out[o + 3]! * inv;
      }
    }
  }
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H * 4; i += 4) {
    const al = out[i + 3]!;
    if (!al) continue;
    const f = 255 / al;
    rgba[i] = out[i]! * f;
    rgba[i + 1] = out[i + 1]! * f;
    rgba[i + 2] = out[i + 2]! * f;
    rgba[i + 3] = al * 255;
  }
  return `data:image/png;base64,${toBase64(encodePng(rgba, W, H))}`;
}

// ───────── 대기열: 짧게 끊어 합성하고, 다 되면 그 그림을 기다리는 화면에 알린다 ─────────
const done = new Map<string, string>();
const failed = new Set<string>();
/** 합성을 기다리는 그림과 그 그림을 기다리는 화면 수. 화면이 다 닫히면 합성하지 않는다. */
const waiting = new Map<string, { plan: AvatarImagePlan; users: number }>();
const subs = new Set<() => void>();
let scheduled = false;
const emit = () => {
  for (const f of subs) f();
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

function pump() {
  scheduled = false;
  const start = Date.now();
  let changed = false;
  if (!atlasFailed) {
    try {
      if (!stepAtlas(start)) return schedule();
    } catch {
      atlasFailed = true;
      decoding = undefined;
    }
  }
  for (const [key, { plan }] of waiting) {
    if (atlasFailed) {
      waiting.delete(key);
      failed.add(key);
      changed = true;
      continue;
    }
    waiting.delete(key);
    try {
      lruSet(done, key, compose(plan), MAX);
    } catch {
      failed.add(key);
    }
    changed = true;
    if (Date.now() - start > BUDGET) break;
  }
  if (changed) emit();
  if (waiting.size) schedule();
}
function schedule() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(pump, 0);
}

function want(key: string, plan: AvatarImagePlan) {
  if (done.has(key) || failed.has(key)) return () => {};
  const w = waiting.get(key);
  if (w) w.users++;
  else {
    waiting.set(key, { plan, users: 1 });
    schedule();
  }
  return () => {
    const cur = waiting.get(key);
    if (cur && --cur.users <= 0) waiting.delete(key);
  };
}

/** 합성한 그림 주소. 아직이면 대기열에 올린다. 실패하면 failed. */
export function useComposedAvatar(plan: AvatarImagePlan): { uri?: string; failed: boolean } {
  const key = useMemo(() => JSON.stringify(plan), [plan]);
  // 값을 스토어 구독 결과로 받는다(React Compiler가 렌더 중 Map 읽기를 key로만 메모하지 않게).
  const uri = useSyncExternalStore(subscribe, () => done.get(key));
  const isFailed = useSyncExternalStore(subscribe, () => failed.has(key));
  useEffect(() => want(key, plan), [key, plan]);
  useEffect(() => {
    if (uri) lruGet(done, key);
  }, [key, uri]);
  return uri ? { uri, failed: false } : { failed: isFailed };
}

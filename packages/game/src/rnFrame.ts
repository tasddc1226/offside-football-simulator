// ───────── 영구결번 도트 액자 ─────────
// 결번 유니폼(등 쪽)을 금빛 액자에 넣은 도트 그림. 은퇴 세리머니·기록실 결번 벽·결번 알림·공유 이미지(웹·앱)가 같이 쓴다.
// 유니폼은 도트 선수와 같은 구단 홈·원정 정의(kits.ts)를 40×44 등판 격자로 옮겨 그리고, 등번호는 4×7 도트 글꼴을 2배로 찍는다.
// 결과는 색마다 SVG path 하나(viewBox 0 0 RN_FRAME_W RN_FRAME_H)라 웹·앱·캔버스가 그대로 칠한다.
import { clubById } from './clubs.js';
import { dist, lum, mix, pixelPaths, type PixelPath } from './color.js';
import { kitOf, type KitSpec } from './kits.js';

export const RN_FRAME_W = 66;
/** 걸이(못·철사) 8칸 + 액자 80칸. */
export const RN_FRAME_H = 88;

type Grid = (string | null)[][];
const SW = 40;
const SH = 44;
const OUT = '#1d1813';
const dk = (c: string, t: number) => mix(c, '#000000', t);
const lt = (c: string, t: number) => mix(c, '#ffffff', t);
const key = (x: number, y: number) => `${x},${y}`;
const NEAR4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

// ── 셔츠 윤곽(등 쪽). 왼쪽 절반을 좌우 대칭으로 ──
const HALF: readonly (readonly [number, number])[] = [
  [15, 3],
  [10, 4],
  [4, 7],
  [0.5, 13],
  [5.5, 18.5],
  [10.5, 15],
  [10.5, 43.5],
];
const POLY = [...HALF, ...[...HALF].reverse().map(([x, y]) => [SW - x, y] as const)];
function inShirt(px: number, py: number): boolean {
  let c = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [xi, yi] = POLY[i]!;
    const [xj, yj] = POLY[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const onShirt = (x: number, y: number) =>
  x >= 0 && x < SW && y >= 0 && y < SH && inShirt(x + 0.5, y + 0.5);
const isSleeve = (x: number) => x <= 10 || x >= 29;
/** 소매 끝단: 바깥 모서리 (0.5,13)–(5.5,18.5)에서 2칸 안쪽까지. */
function isCuff(x: number, y: number): boolean {
  if (!isSleeve(x)) return false;
  const xx = x < SW / 2 ? x + 0.5 : SW - x - 0.5;
  const yy = y + 0.5;
  return Math.abs(5.5 * xx - 5 * yy + 5.5 * 13 - 18.5 * 0.5) / Math.hypot(5.5, 5) < 2.2;
}

/** 몸통(가로 11~28) 한 칸의 무늬 색. 무늬 키는 kits.ts KIT_PATTERNS와 같은 뜻을 큰 격자에 맞게 풀었다. */
function bodyColor(k: KitSpec, x: number, y: number): string {
  const { body, pc } = k;
  switch (k.pat) {
    case 'v':
      return Math.floor((x - 10) / 4) % 2 === 1 ? pc : body;
    case 'v1':
      return (x - 10) % 4 === 0 ? pc : body;
    case 'h':
      return Math.floor((y - 5) / 3) % 2 === 1 ? pc : body;
    case 'hoop':
      return y >= 14 && y <= 20 ? pc : body;
    case 'half':
      return x >= 20 ? pc : body;
    case 'hh':
      return y >= 26 ? pc : body;
    case 'band':
      return x >= 17 && x <= 22 ? pc : body;
    case 'sash':
      return Math.abs(x - (11 + (y - 5) * 0.55)) <= 2.6 ? pc : body;
    case 'ch': {
      const yc = 6 + (9 - Math.abs(x - 19.5)) * 0.9;
      return y >= yc && y < yc + 4 ? pc : body;
    }
    case 'q':
      return x >= 20 !== y >= 24 ? pc : body;
    case 'cr':
      return (x >= 18 && x <= 21) || (y >= 16 && y <= 19) ? pc : body;
    case 'dz':
      return ((x + y) & 4) ^ ((x - y + 80) & 4) ? pc : body;
    case 'tri':
      return x <= 16 ? body : x <= 22 ? pc : (k.pc2 ?? pc);
    case 'yoke':
      return y <= 11 ? pc : body;
    case 'side':
      return x === 11 || x === 12 || x === 27 || x === 28 ? pc : body;
    default:
      return body;
  }
}

// ── 등번호 도트 글꼴(4×7) ──
const DIGITS: Record<string, readonly string[]> = {
  '0': ['.##.', '#..#', '#..#', '#..#', '#..#', '#..#', '.##.'],
  '1': ['..#.', '.##.', '..#.', '..#.', '..#.', '..#.', '.###'],
  '2': ['.##.', '#..#', '...#', '..#.', '.#..', '#...', '####'],
  '3': ['###.', '...#', '...#', '.##.', '...#', '...#', '###.'],
  '4': ['#..#', '#..#', '#..#', '####', '...#', '...#', '...#'],
  '5': ['####', '#...', '###.', '...#', '...#', '#..#', '.##.'],
  '6': ['.##.', '#...', '#...', '###.', '#..#', '#..#', '.##.'],
  '7': ['####', '...#', '..#.', '..#.', '.#..', '.#..', '.#..'],
  '8': ['.##.', '#..#', '#..#', '.##.', '#..#', '#..#', '.##.'],
  '9': ['.##.', '#..#', '#..#', '.###', '...#', '...#', '.##.'],
};

/** 등번호 색: 깃 색(구단 강조색)이 바탕과 충분히 다르면 그 색, 아니면 흰색·검정·무늬색 중 가장 잘 보이는 것. */
function inkOf(k: KitSpec): string {
  const score = (c: string) => Math.min(dist(c, k.body), k.pat === '-' ? 999 : dist(c, k.pc));
  if (score(k.collar) > 150) return k.collar;
  return [k.collar, '#ffffff', '#111111', k.pc].sort((a, b) => score(b) - score(a))[0]!;
}

/** 등판 유니폼(바깥선 포함). 원단 결·골지 깃·박음질·주름·등번호 입체(테두리·빛·그늘·그림자)까지. */
function shirtGrid(k: KitSpec, number: number): Grid {
  const g: Grid = Array.from({ length: SH }, () => Array<string | null>(SW).fill(null));
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      if (!onShirt(x, y)) continue;
      let c = isCuff(x, y)
        ? k.collar
        : isSleeve(x)
          ? k.pat === 'half' && x >= 29 && k.sleeve === k.body
            ? k.pc
            : k.sleeve
          : bodyColor(k, x, y);
      // 뒷목 깃.
      if (y <= 5 && x >= 14 && x <= 25 && !onShirt(x, y - 2)) c = k.collar;
      // 왼쪽 빛, 오른쪽·아래 그늘, 소매 접힘.
      if (x === 11 || x === 1 || x === 2) c = lt(c, 0.14);
      if ((x >= 27 && x <= 28) || x >= 37) c = dk(c, 0.16);
      if (y >= 41) c = dk(c, 0.12);
      if (x === 10 || x === 29) c = dk(c, 0.22);
      g[y]![x] = c;
    }

  // 등번호 자리.
  const digits = String(number);
  const ink = inkOf(k);
  const tw = digits.length * 8 + (digits.length - 1) * 2;
  const x0 = Math.round(SW / 2 - tw / 2);
  const y0 = 17;
  const num = new Set<string>();
  [...digits].forEach((d, i) =>
    (DIGITS[d] ?? []).forEach((row, ry) =>
      [...row].forEach((ch, rx) => {
        if (ch !== '#') return;
        for (let a = 0; a < 2; a++)
          for (let b = 0; b < 2; b++) num.add(key(x0 + i * 10 + rx * 2 + a, y0 + ry * 2 + b));
      }),
    ),
  );
  // 번호 테두리(한 칸): 줄무늬 위에서도 읽히게.
  const edge = lum(ink) > 0.5 ? dk(k.body, 0.55) : lt(k.body, 0.7);
  const trimColor =
    k.pat !== '-' && dist(k.collar, ink) > 80 && dist(k.collar, k.body) > 60 ? k.collar : edge;
  const trim = new Set<string>();
  for (const p of num) {
    const [x, y] = p.split(',').map(Number) as [number, number];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const q = key(x + dx, y + dy);
        if (!num.has(q) && g[y + dy]?.[x + dx]) trim.add(q);
      }
  }

  const o = g.map((r) => r.slice());
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const c = g[y]![x];
      if (!c || num.has(key(x, y))) continue;
      if (trim.has(key(x, y))) {
        o[y]![x] = trimColor;
        continue;
      }
      let v = c;
      // 원단 결: 성긴 점.
      if ((x * 3 + y * 5) % 11 === 0) v = lt(v, 0.06);
      // 골지 깃.
      if (c === k.collar && y <= 6 && !isSleeve(x) && x % 2 === 1) v = dk(v, 0.16);
      // 소매 끝 박음질.
      if (isSleeve(x) && !isCuff(x, y) && NEAR4.some(([dx, dy]) => isCuff(x + dx, y + dy)))
        v = dk(v, 0.14);
      // 밑단 박음질.
      if (y === 40 && x % 2 === 0) v = dk(v, 0.2);
      // 아래쪽 주름(좌우 대칭 사선).
      const fx = 13 + Math.floor((y - 29) / 3);
      if (y >= 29 && y <= 39 && (x === fx || x === SW - 1 - fx)) v = dk(v, 0.1);
      o[y]![x] = v;
    }
  // 번호 그림자(오른쪽 아래 한 칸).
  for (const p of [...num, ...trim]) {
    const [x, y] = p.split(',').map(Number) as [number, number];
    const q = key(x + 1, y + 1);
    if (!num.has(q) && !trim.has(q) && o[y + 1]?.[x + 1])
      o[y + 1]![x + 1] = dk(g[y + 1]![x + 1]!, 0.32);
  }
  // 번호: 위·왼쪽 모서리는 밝게, 아래·오른쪽은 어둡게.
  const lightInk = lum(ink) > 0.5;
  for (const p of num) {
    const [x, y] = p.split(',').map(Number) as [number, number];
    if (!g[y]?.[x]) continue;
    let v = ink;
    if (!num.has(key(x, y - 1)) || !num.has(key(x - 1, y)))
      v = ink === '#ffffff' ? ink : lt(ink, lightInk ? 0.35 : 0.25);
    else if (!num.has(key(x, y + 1)) || !num.has(key(x + 1, y))) v = dk(ink, lightInk ? 0.18 : 0.3);
    o[y]![x] = v;
  }
  // 바깥선.
  const out = o.map((r) => r.slice());
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++)
      if (!o[y]![x] && NEAR4.some(([dx, dy]) => o[y + dy]?.[x + dx])) out[y]![x] = OUT;
  return out;
}

// ── 명판 글자(3×5) ──
const MINI: Record<string, readonly string[]> = {
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  '.': ['.', '.', '.', '.', '#'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
};
const textW = (t: string) => [...t].reduce((n, ch) => n + (MINI[ch]?.[0]?.length ?? 0) + 1, -1);

const GOLD = {
  line: '#2b1c06',
  hi: '#fbe9a6',
  light: '#f0cf6e',
  base: '#d6a73f',
  mid: '#b88a2c',
  low: '#8c6419',
  deep: '#5a3e0c',
};
const ROSE = ['.#.#.', '#ooo#', '.oxo.', '#ooo#', '.#.#.'];

/** 액자 전체 격자: 걸이 → 테(베벨·구슬 장식·모서리 장미) → 매트 → 뒤판(질감·조명) → 유니폼(그림자·핀) → 명판 → 유리 반사. */
function frameGrid(k: KitSpec, number: number): Grid {
  const FW = RN_FRAME_W;
  const TOP = 8;
  const FH = RN_FRAME_H - TOP;
  const G: Grid = Array.from({ length: RN_FRAME_H }, () => Array<string | null>(FW).fill(null));
  const put = (x: number, y: number, c: string) => {
    if (x >= 0 && x < FW && y >= 0 && y < RN_FRAME_H) G[y]![x] = c;
  };
  const rect = (x0: number, y0: number, w: number, h: number, c: string) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c);
  };

  // 걸이: 못과 철사.
  const cx = FW / 2;
  rect(cx - 1, 0, 2, 2, '#6d6a66');
  put(cx - 1, 0, '#b9b5ae');
  for (let i = 1; i <= 7; i++)
    for (const x of [cx - 1 - i * 2, cx - 2 - i * 2, cx + i * 2, cx + 1 + i * 2])
      put(x, 1 + i, '#4a4744');

  // 테(두께 7): 위·왼쪽은 빛, 아래·오른쪽은 그늘. 안쪽으로 갈수록 반대로 꺾여 홈이 진다.
  const ring = (d: number, top: string, bottom: string) => {
    for (let x = d; x < FW - d; x++) {
      put(x, TOP + d, top);
      put(x, TOP + FH - 1 - d, bottom);
    }
    for (let y = TOP + d; y < TOP + FH - d; y++) {
      put(d, y, top);
      put(FW - 1 - d, y, bottom);
    }
  };
  ring(0, GOLD.line, GOLD.line);
  ring(1, GOLD.hi, GOLD.low);
  ring(2, GOLD.light, GOLD.mid);
  ring(3, GOLD.base, GOLD.base);
  ring(4, GOLD.mid, GOLD.light);
  ring(5, GOLD.low, GOLD.hi);
  ring(6, GOLD.line, GOLD.line);
  // 구슬 장식.
  for (let x = 5; x < FW - 5; x += 3) {
    put(x, TOP + 3, GOLD.hi);
    put(x + 1, TOP + 3, GOLD.low);
    put(x, TOP + FH - 4, GOLD.hi);
    put(x + 1, TOP + FH - 4, GOLD.low);
  }
  for (let y = TOP + 5; y < TOP + FH - 5; y += 3) {
    put(3, y, GOLD.hi);
    put(3, y + 1, GOLD.low);
    put(FW - 4, y, GOLD.hi);
    put(FW - 4, y + 1, GOLD.low);
  }
  // 모서리 장미.
  for (const [ox, oy] of [
    [1, TOP + 1],
    [FW - 6, TOP + 1],
    [1, TOP + FH - 6],
    [FW - 6, TOP + FH - 6],
  ] as const)
    ROSE.forEach((r, ry) =>
      [...r].forEach((ch, rx) => {
        if (ch !== '.')
          put(ox + rx, oy + ry, ch === '#' ? GOLD.line : ch === 'o' ? GOLD.light : GOLD.hi);
      }),
    );

  // 매트: 구단색을 깊게(흰 유니폼이면 깃 색). 안쪽 베벨은 빛이 위에서 오는 쪽으로.
  const matBase = dk(dist(k.body, '#ffffff') < 40 ? k.collar : k.body, 0.62);
  const mx = 7;
  const my = TOP + 7;
  const mw = FW - 14;
  const mh = FH - 14;
  rect(mx, my, mw, mh, matBase);
  for (let y = my; y < my + mh; y++)
    for (let x = mx; x < mx + mw; x++)
      if ((x + y) % 2 === 0 && (x * 7 + y * 3) % 5 === 0) put(x, y, lt(matBase, 0.05));
  const ix = mx + 3;
  const iy = my + 3;
  const iw = mw - 6;
  const ih = mh - 6;
  for (let x = ix - 1; x <= ix + iw; x++) {
    put(x, iy - 1, dk(matBase, 0.45));
    put(x, iy + ih, lt(matBase, 0.28));
  }
  for (let y = iy - 1; y <= iy + ih; y++) {
    put(ix - 1, y, dk(matBase, 0.45));
    put(ix + iw, y, lt(matBase, 0.28));
  }

  // 뒤판: 짙은 천 + 위에서 비추는 조명(2단 디더링).
  const back = dk(matBase, 0.45);
  for (let y = iy; y < iy + ih; y++)
    for (let x = ix; x < ix + iw; x++) {
      const dx = (x - (ix + iw / 2)) / (iw / 2);
      const dy = (y - iy) / ih;
      // 조명은 0.06 단위 띠로 끊는다(도트 그림답게, 색 수가 줄어 path도 적다).
      const light =
        Math.round(Math.max(0, 0.36 - Math.hypot(dx * 0.75, dy * 1.15) * 0.36) / 0.06) * 0.06;
      let c = lt(back, (x + y) % 2 === 0 && light > 0.02 ? light + 0.03 : light);
      if ((x * 5 + y * 3) % 13 === 0) c = dk(c, 0.12);
      put(x, y, c);
    }

  // 유니폼 그림자(오른쪽 아래 2칸) → 유니폼 → 어깨 고정 핀.
  const shirt = shirtGrid(k, number);
  const sx = ix + Math.floor((iw - SW) / 2);
  const sy = iy + 2;
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      if (!shirt[y]![x]) continue;
      const tx = sx + x + 2;
      const ty = sy + y + 2;
      if (tx < ix + iw && ty < iy + ih) put(tx, ty, dk(G[ty]![tx]!, 0.4));
    }
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const c = shirt[y]![x];
      if (c) put(sx + x, sy + y, c);
    }
  for (const px of [sx + 12, sx + SW - 13]) {
    put(px, sy + 5, '#f6e7b0');
    put(px + 1, sy + 5, GOLD.mid);
    put(px, sy + 6, GOLD.mid);
    put(px + 1, sy + 6, GOLD.deep);
  }

  // 명판: 놋쇠 판 + 나사 + 새긴 글자 "NO.10".
  const label = `NO.${number}`;
  const pw = Math.max(24, textW(label) + 10);
  const ph = 9;
  const px0 = Math.round(FW / 2 - pw / 2);
  const py0 = iy + ih - ph - 2;
  rect(px0, py0, pw, ph, GOLD.line);
  rect(px0 + 1, py0 + 1, pw - 2, ph - 2, GOLD.base);
  for (let x = px0 + 1; x < px0 + pw - 1; x++) {
    put(x, py0 + 1, GOLD.hi);
    put(x, py0 + ph - 2, GOLD.low);
  }
  for (let y = py0 + 1; y < py0 + ph - 1; y++) {
    put(px0 + 1, y, GOLD.light);
    put(px0 + pw - 2, y, GOLD.mid);
  }
  for (const x of [px0 + 2, px0 + pw - 3]) {
    put(x, py0 + 4, GOLD.deep);
    put(x, py0 + 3, GOLD.low);
  }
  let tx = Math.round(FW / 2 - textW(label) / 2);
  for (const ch of label) {
    const glyph = MINI[ch] ?? [];
    // 새긴 글자: 홈(진한 색) 오른쪽 아래에 빛 받는 턱.
    glyph.forEach((r, ry) =>
      [...r].forEach((c, rx) => {
        if (c !== '#') return;
        put(tx + rx, py0 + 2 + ry, GOLD.deep);
        if (G[py0 + 3 + ry]?.[tx + rx + 1] !== GOLD.deep)
          put(tx + rx + 1, py0 + 3 + ry, GOLD.light);
      }),
    );
    tx += (glyph[0]?.length ?? 0) + 1;
  }
  for (let x = px0 + 1; x <= px0 + pw; x++) {
    const c = G[py0 + ph]?.[x];
    if (c) put(x, py0 + ph, dk(c, 0.35));
  }

  // 유리 반사: 사선 세 줄기.
  for (let y = my; y < my + mh; y++)
    for (let x = mx; x < mx + mw; x++) {
      const d = x + (y - TOP) * 0.9;
      const band =
        d >= 14 && d < 20 ? 0.13 : d >= 23 && d < 25 ? 0.09 : d >= 92 && d < 95 ? 0.06 : 0;
      const c = G[y]![x];
      if (band && c) put(x, y, mix(c, '#ffffff', band));
    }
  return G;
}

/** 모르는 구단(옛 기록)의 결번 유니폼 — rnStyle RN_DEFAULT와 같은 색. */
const DEFAULT_KIT: KitSpec = {
  body: '#1f6f4a',
  pat: '-',
  pc: '#1f6f4a',
  sleeve: '#1f6f4a',
  collar: '#f2c14e',
  shorts: '#1f6f4a',
  socks: '#1f6f4a',
  cuff: '#f2c14e',
};

const cache = new Map<string, readonly PixelPath[]>();

/**
 * 결번 액자 그림(색마다 path 하나, 구단 홈 유니폼). 모르는 구단이면 기본 색. 같은 구단·번호는 한 번만 만든다
 * (결번 벽 한 화면 분량을 넘으면 비운다). 등번호는 0~99.
 */
export function rnFramePaths(
  clubId: string | null | undefined,
  number: number,
): readonly PixelPath[] {
  const n = Math.max(0, Math.min(99, Math.trunc(number)));
  const club = clubId ? clubById(clubId) : null;
  // 구단 이름이 바뀌면 기본 유니폼 색(엠블럼)도 바뀔 수 있어 이름까지 키에 넣는다.
  const id = `${club?.id ?? ''}|${club?.name ?? ''}|${n}`;
  const hit = cache.get(id);
  if (hit) return hit;
  if (cache.size >= 256) cache.clear();
  const paths = pixelPaths(frameGrid(club ? kitOf(club, 'home') : DEFAULT_KIT, n));
  cache.set(id, paths);
  return paths;
}

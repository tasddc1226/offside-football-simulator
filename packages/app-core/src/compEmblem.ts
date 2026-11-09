// ───────── 리그 · 대회 기본 로고 (T-11-679) ─────────
// 실제 대회 로고는 쓰지 않는다(상표). 대신 종류마다 틀이 다른 엠블럼을 직접 그린다: 리그는 방패, 국내 컵은 원, 슈퍼컵은 톱니 원,
// 대륙 클럽 대회는 왕관 방패, 국가대표 대회는 별 셋을 단 원. 가운데 글자는 언어와 상관없는 영문 약칭이고, 유저가 이름을
// 바꿨으면(customNames) 바꾼 이름에서 딴다. 64×64 다각형 레이어 + 글자 하나라 웹(svg) · 앱(react-native-svg)이 같은 모양을 그린다.
// 유저가 고른 이미지(compIcons.ts)가 있으면 화면은 이 그림 대신 이미지를 그린다.
import { LEAGUE_BASE } from '@offside/contracts/club-names';
import { CONFEDS, type Confed } from '@offside/contracts/nations';
import { CONT, CUPS, SUPERCUP } from '@offside/game/comps';
import { tn, tnBase } from '@offside/game/i18n/names';
import { CLUB_WORLD, NATIONAL_EXTRA } from './customNamesCatalog.js';

export type CompKind = 'league' | 'cup' | 'super' | 'club' | 'national';
export interface CompEmblemArt {
  kind: CompKind;
  layers: { d: string; fill: string }[];
  mark: { text: string; size: number; y: number; fill: string };
}
export const COMP_EMBLEM_VIEWBOX = '0 0 64 64';

// ───────── 이름 → 종류 · 약칭 · 색 ─────────
const LEAGUE_MARK: Record<string, string> = {
  hs: 'HS',
  uni: 'U',
  k3: 'K3',
  k2: 'K2',
  k1: 'K1',
  csl: 'CSL',
  j1: 'J1',
  mls: 'MLS',
  spl: 'SPL',
  bra: 'BR',
  ere: 'ED',
  por: 'LP',
  l1: 'L1',
  bl: 'BL',
  sa: 'SA',
  ll: 'LL',
  pl: 'PL',
};
/** 리그 색(리그 · 그 리그 컵 · 슈퍼컵이 같은 계열을 쓴다). */
const LEAGUE_ACCENT: Record<string, string> = {
  hs: '#3f8fd1',
  uni: '#2f9a5a',
  k3: '#5c9a6b',
  k2: '#1a8a5a',
  k1: '#2a6fd6',
  csl: '#c4342c',
  j1: '#d13f3f',
  mls: '#27409c',
  spl: '#1f8a4a',
  bra: '#e8c21f',
  ere: '#e8743a',
  por: '#a83a2a',
  l1: '#1c3f8a',
  bl: '#c43f2f',
  sa: '#1a5fb4',
  ll: '#d97a1a',
  pl: '#5a2a8a',
};
/** 리그별 국내 컵 약칭(CUPS[리그] 순서). */
const CUP_MARK: Record<string, readonly string[]> = {
  hs: ['HS'],
  uni: ['UNI'],
  k3: ['KC'],
  k2: ['KC'],
  k1: ['KC'],
  j1: ['EC', 'JLC'],
  mls: ['USO', 'LC'],
  ere: ['KNVB'],
  l1: ['CDF'],
  bl: ['DFB'],
  sa: ['CI'],
  ll: ['CDR'],
  pl: ['FA', 'EFL'],
  csl: ['CFA'],
  spl: ['KING'],
  bra: ['CDB'],
  por: ['TP', 'TL'],
};
const SUPER_MARK: Record<string, string> = {
  pl: 'CS',
  ll: 'SCE',
  sa: 'SCI',
  bl: 'DFL',
  l1: 'TDC',
  ere: 'JCS',
  j1: 'JSC',
  csl: 'CSC',
  spl: 'SSC',
  bra: 'SCB',
  por: 'SCO',
};
const CONFED_CUP_MARK: Record<Confed, string> = {
  AFC: 'AC',
  UEFA: 'EURO',
  CONMEBOL: 'CA',
  CAF: 'AFCON',
  CONCACAF: 'GC',
  OFC: 'ONC',
};
const CONT_ACCENT: Record<string, string> = {
  UCL: '#1c2f6e',
  UEL: '#d9741a',
  UECL: '#1f9a6a',
  ACLE: '#7a2a8a',
  ACL2: '#2a7a9a',
  CCC: '#2a3f9c',
  LIB: '#c9a227',
};
const NATIONAL_ACCENT = ['#b8862a', '#1c5fa8', '#2a7a4a', '#a83a3a', '#5a3a9a', '#1a8a8a'];

interface Entry {
  kind: CompKind;
  mark: string;
  accent: string;
}
let table: Map<string, Entry> | null = null;
function entries(): Map<string, Entry> {
  if (table) return table;
  const m = new Map<string, Entry>();
  const put = (ko: string, e: Entry) => void (m.has(ko) || m.set(ko, e));
  for (const L of LEAGUE_BASE)
    put(L.name, {
      kind: 'league',
      mark: LEAGUE_MARK[L.id] ?? '',
      accent: LEAGUE_ACCENT[L.id] ?? '#2f9a5a',
    });
  for (const [id, cups] of Object.entries(CUPS))
    cups.forEach((ko, i) =>
      put(ko, {
        kind: 'cup',
        mark: CUP_MARK[id]?.[i] ?? '',
        accent: LEAGUE_ACCENT[id] ?? '#2f9a5a',
      }),
    );
  for (const [id, ko] of Object.entries(SUPERCUP))
    put(ko, { kind: 'super', mark: SUPER_MARK[id] ?? '', accent: LEAGUE_ACCENT[id] ?? '#2f9a5a' });
  for (const [key, c] of Object.entries(CONT))
    put(c.name, { kind: 'club', mark: key, accent: CONT_ACCENT[key] ?? '#1c2f6e' });
  put(CLUB_WORLD, { kind: 'club', mark: 'CWC', accent: '#8a6a1a' });
  const [worldCup, ...multi] = NATIONAL_EXTRA;
  put(worldCup, { kind: 'national', mark: 'WC', accent: NATIONAL_ACCENT[0]! });
  (Object.keys(CONFEDS) as Confed[]).forEach((k, i) =>
    put(CONFEDS[k].cup, {
      kind: 'national',
      mark: CONFED_CUP_MARK[k],
      accent: NATIONAL_ACCENT[(i + 1) % NATIONAL_ACCENT.length]!,
    }),
  );
  multi.forEach((ko, i) =>
    put(ko, { kind: 'national', mark: i === 0 ? 'AG' : 'OLY', accent: NATIONAL_ACCENT[i + 4]! }),
  );
  return (table = m);
}

/** 로고가 있는 리그 · 대회 이름인지(저장된 한국어 이름). 트로피 이름은 compOfTrophy로 먼저 바꾼다. */
export const hasCompEmblem = (ko: string): boolean => entries().has(ko);
/** 로고를 붙이는 종류. 로고가 없는 이름이면 null. */
export const compKindOf = (ko: string): CompKind | null => entries().get(ko)?.kind ?? null;

const WIN_TAIL = ' 우승'; // i18n-ignore 저장값(트로피 이름 꼬리)
/** 트로피 이름('프리미어리그 우승')에서 로고를 붙일 리그 · 대회 이름을 찾는다. 없으면 null. */
export function compOfTrophy(trophy: string): string | null {
  if (!trophy.endsWith(WIN_TAIL)) return null;
  const ko = trophy.slice(0, -WIN_TAIL.length);
  return hasCompEmblem(ko) ? ko : null;
}

/** 바꾼 이름에서 딴 약칭: 영문 · 숫자 위주면 단어 첫 글자(한 단어면 앞 4자), 아니면 앞 두 글자. */
export function markOf(name: string): string {
  const s = name.trim();
  if (!s) return '';
  const words = s.match(/[A-Za-z0-9]+/g) ?? [];
  const latin = words.join('').length;
  const all = s.replace(/[\s\-·.'()]/g, '').length;
  if (latin && latin * 2 >= all) {
    if (words.length === 1) return words[0]!.slice(0, 4).toUpperCase();
    return words
      .map((w) => (/^\d+$/.test(w) ? w : w[0]!.toUpperCase()))
      .join('')
      .slice(0, 4);
  }
  return Array.from(s.replace(/\s/g, '')).slice(0, 2).join('');
}

// 이름 해시(색이 정해지지 않은 이름).
function fnv(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}
const FALLBACK = ['#2f9a5a', '#2a6fd6', '#d97a1a', '#a83a2a', '#5a2a8a', '#1a8a8a', '#c9a227'];

// ───────── 그림 ─────────
type Pt = readonly [number, number];
const r1 = (n: number) => Math.round(n * 10) / 10;
const poly = (pts: readonly Pt[]) => `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}z`;
const flip = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [64 - x, y] as const);
/** 오른쪽 절반(위 가운데 → 아래 가운데)을 좌우로 이어 닫는다. */
const sym = (right: readonly Pt[]): Pt[] => [...right, ...flip(right.slice(1, -1)).reverse()];
/** 빛 받는 왼쪽 절반. */
const leftHalf = (right: readonly Pt[]): Pt[] => [
  right[0]!,
  ...flip(right.slice(1, -1)),
  right[right.length - 1]!,
];
const inset = (pts: readonly Pt[], k: number): Pt[] =>
  pts.map(([x, y]) => [32 + (x - 32) * k, 32 + (y - 32) * k] as const);
const ring = (cx: number, cy: number, r: number, n = 32): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (Math.PI * 2 * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
/** 위 가운데에서 아래 가운데까지 오른쪽 반원. */
const halfRing = (r: number): Pt[] => ring(32, 32, r, 32).slice(0, 17);
const star = (cx: number, cy: number, R: number, r: number, n = 5): Pt[] =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rr = i % 2 ? r : R;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  });
/** 톱니 원의 오른쪽 절반. */
const sealHalf = (): Pt[] => star(32, 32, 30.5, 27, 16).slice(0, 17);

const FRAME: Record<CompKind, readonly Pt[]> = {
  league: [
    [32, 3],
    [40, 7],
    [56, 6],
    [56, 33],
    [50, 46],
    [41, 55],
    [32, 61],
  ],
  cup: halfRing(29.5),
  super: sealHalf(),
  club: [
    [32, 2],
    [37, 8],
    [44, 3],
    [47, 9],
    [56, 6],
    [56, 34],
    [51, 46],
    [42, 55],
    [32, 62],
  ],
  national: halfRing(29.5),
};

const hex = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');
function mix(a: string, b: string, t: number) {
  const p = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  return `#${[1, 3, 5].map((i) => hex(p(a, i) + (p(b, i) - p(a, i)) * t)).join('')}`;
}

/** 글자 수에 맞춘 크기(64 칸 기준). */
function markSize(text: string, cjk: boolean): number {
  const n = Array.from(text).length;
  if (cjk) return n <= 1 ? 26 : 19;
  return n <= 2 ? 23 : n === 3 ? 18 : n === 4 ? 14 : 11.5;
}

const cache = new Map<string, CompEmblemArt>();
/** 리그 · 대회 기본 로고. 바꾼 이름이 있으면 약칭을 그 이름에서 딴다. */
export function compEmblem(ko: string): CompEmblemArt {
  // 바꾼 이름이 있으면 tn이 그 이름을 돌려준다(공유 이미지처럼 withDefaultNames 안이면 원래 이름).
  const shown = tn(ko);
  const custom = shown !== tnBase(ko) ? shown : null;
  const key = `${ko}\u0000${custom ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const e = entries().get(ko);
  const kind = e?.kind ?? 'cup';
  const accent = e?.accent ?? FALLBACK[fnv(ko) % FALLBACK.length]!;
  const text = (custom ? markOf(custom) : e?.mark) || markOf(ko);
  const cjk = !/^[A-Za-z0-9]+$/.test(text);
  const right = FRAME[kind];
  const inner = inset(right, kind === 'super' ? 0.8 : 0.86);
  const gold = '#f4d36b';
  const layers = [
    {
      d: poly(sym(right)),
      fill:
        kind === 'club' || kind === 'national'
          ? mix(gold, '#000000', 0.25)
          : mix(accent, '#000000', 0.5),
    },
    {
      d: poly(leftHalf(right)),
      fill: kind === 'club' || kind === 'national' ? gold : mix(accent, '#ffffff', 0.3),
    },
    { d: poly(sym(inner)), fill: mix(accent, '#000000', 0.18) },
    { d: poly(leftHalf(inner)), fill: accent },
  ];
  if (kind === 'national')
    for (const [x, y, r] of [
      [32, 13.5, 4.2],
      [22.5, 16.5, 3],
      [41.5, 16.5, 3],
    ] as const)
      layers.push({ d: poly(star(x, y, r, r * 0.42)), fill: gold });
  if (kind === 'cup' || kind === 'super')
    layers.push(
      { d: poly([...ring(32, 32, 21.5, 40)]), fill: mix(accent, '#ffffff', 0.12) },
      { d: poly(ring(32, 32, 20, 40)), fill: mix(accent, '#000000', 0.12) },
    );
  if (kind === 'league')
    layers.push({
      d: poly([
        [14, 45],
        [50, 45],
        [47, 49],
        [17, 49],
      ]),
      fill: mix(accent, '#ffffff', 0.35),
    });
  const size = markSize(text, cjk);
  const y = kind === 'national' ? 41 : kind === 'league' ? 37 : 32 + size * 0.36;
  // 노랑처럼 밝은 바탕에는 흰 글자가 묻혀 어두운 글자를 쓴다.
  const p = (i: number) => parseInt(accent.slice(i, i + 2), 16) / 255;
  const light = 0.2126 * p(1) + 0.7152 * p(3) + 0.0722 * p(5) > 0.55;
  const fill = light ? '#2a2108' : '#ffffff';
  const art: CompEmblemArt = { kind, layers, mark: { text, size, y, fill } };
  cache.set(key, art);
  return art;
}

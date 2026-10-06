// ───────── 도트 선수 아바타 (T-11-120) ─────────
// 24×32칸 2등신 선수를 부위별 글자 지도(레이어)로 쌓아 그린다. 이미지 파일 없이 색 격자 → SVG 문자열로 만들어
// 웹({@html})과 앱(SvgXml)이 같이 쓴다. 외형(피부·머리)은 커리어 ID 해시로 정해 게임 RNG를 절대 쓰지 않고,
// 세이브에도 저장하지 않는다. 수염·흰머리·목발·정장 같은 건 나이와 상태에서 그때그때 정한다.
import { CREST_PATTERNS, crestOf } from './crests.js';
import { hashStr } from './hash.js';
import { KIT_SPECS } from './kits-data.js';
import type { Club } from './data.js';
import type { GameState } from './types.js';

export const AVATAR_W = 24;
export const AVATAR_H = 32;

// '.'은 투명. O 바깥선, s/S 피부·그늘, e 눈, m 입, k/K 상의·그늘, t 깃, p/P 하의, c/C 양말·양말끝, b 축구화, n 그림자.
const BASE = [
  '........................',
  '........................',
  '........OOOOOOOO........',
  '.......OssssssssO.......',
  '......OssssssssssO......',
  '......OssssssssssO......',
  '......OssssssssssO......',
  '......OssessssessO......',
  '.....OSssessssessSO.....',
  '.....OSsssssSssssSO.....',
  '......OssssmmssssO......',
  '.......OssssssssO.......',
  '........OOSSSSOO........',
  '.....OkkkktSStkkkkO.....',
  '....OkkkkkkttkkkkkkO....',
  '...OkkOkkkkkkkkkkOkkO...',
  '...OKKOkkkkkktkkkOKKO...',
  '...OssOkkkkkkkkkkOssO...',
  '...OssOKkkkkkkkkKOssO...',
  '...OSSOKKKKKKKKKKOSSO...',
  '....OOOppppppppppOOO....',
  '......OppppppppppO......',
  '......OPPPPOOPPPPO......',
  '.......OssO..OssO.......',
  '.......OccO..OccO.......',
  '.......OCCO..OCCO.......',
  '.......OccO..OccO.......',
  '......ObbbO..ObbbO......',
  '......OOOOO..OOOOO......',
  '.....nnnnnnnnnnnnnn.....',
  '........................',
  '........................',
];
interface Layer {
  y: number;
  r: readonly string[];
}
// h/H 머리·그늘, a 헤어밴드.
const HAIR = {
  short: {
    y: 1,
    r: [
      '........OOOOOOOO........',
      '.......OhhhhhhhhO.......',
      '......OhhhhhhhhhhO......',
      '......OhHhhhhhhHhO......',
      '......OH........HO......',
    ],
  },
  fringe: {
    y: 1,
    r: [
      '.......OOOOOOOOOO.......',
      '......OhhhhhhhhhhO......',
      '.....OhhhhhhhhhhhhO.....',
      '.....OhhhhhhhhhhhhO.....',
      '.....OhhhHhhhHhhhhO.....',
      '.....OhH.hH..Hh.HhO.....',
      '.....Oh..........hO.....',
    ],
  },
  long: {
    y: 1,
    r: [
      '........OOOOOOOO........',
      '.......OhhhhhhhhO.......',
      '......OhhhhhhhhhhO......',
      '.....OaaaaaaaaaaaaO.....',
      '.....OhH........HhO.....',
      '.....Oh..........hO.....',
      '.....Oh..........hO.....',
      '.....Oh..........hO.....',
      '.....OH..........HO.....',
      '.....OO..........OO.....',
    ],
  },
  mohawk: {
    y: 0,
    r: [
      '...........OO...........',
      '..........OhhO..........',
      '........OOhhhhOO........',
      '.......OHHhhhhHHO.......',
      '......OHHHhhhhHHHO......',
      '......O.H......H.O......',
    ],
  },
  slick: {
    y: 1,
    r: [
      '........OOOOOOOO........',
      '.......OhhhhhhhhO.......',
      '......OhHhhhhhhHhO......',
      '......Oh.hHhhHh.hO......',
      '......OH........HO......',
    ],
  },
  buzz: {
    y: 2,
    r: [
      '........OOOOOOOO........',
      '.......OHHHHHHHHO.......',
      '......OHHHHHHHHHHO......',
      '......OH........HO......',
    ],
  },
} satisfies Record<string, Layer>;
// f 수염, F 짧은 수염.
const BEARD = {
  stubble: { y: 10, r: ['.......F........F.......', '........FFF..FFF........'] },
  full: {
    y: 10,
    r: ['......Offf.mm.fffO......', '.......OffffffffO.......', '........OOffffOO........'],
  },
} satisfies Record<string, Layer>;
const EXPR = {
  happy: { y: 8, r: ['........ese..ese........', '', '..........mmmm..........'] },
  pain: {
    y: 7,
    r: ['.........s....s.........', '........eee..eee........', '', '..........mmmm..........'],
  },
  tired: { y: 9, r: ['.........S....S.........'] },
} satisfies Record<string, Layer>;
// y 완장, W 목발, w 흰색(붕대·셔츠), r 넥타이, q/Q/v/x 꽃다발(꽃·잎·포장지).
const ACC = {
  armband: [{ y: 16, r: ['....yy..................'] }],
  crutch: [
    {
      y: 15,
      r: [
        '....................OOO.',
        ...Array<string>(12).fill('....................OWO.'),
        '....................OOO.',
      ],
    },
  ],
  bandage: [
    { y: 9, r: ['...............w........'] },
    { y: 23, r: ['........ww..............'] },
  ],
  suit: [
    {
      y: 13,
      r: [
        '...........ww...........',
        '...........rr...........',
        '...........rr...........',
        '...........rr...........',
        '...........rr...........',
      ],
    },
    { y: 17, r: ['....kk............kk....', '....kk............kk....'] },
    { y: 23, r: ['........pp....pp........'] },
  ],
  bouquet: [
    {
      y: 12,
      r: [
        '.................qQqQq..',
        '................qQqvqQq.',
        '................vqQqQqv.',
        '.................vxxxv..',
        '..................xxx...',
        '..................xxx...',
        '...................x....',
      ],
    },
  ],
} satisfies Record<string, Layer[]>;

export type HairStyle = keyof typeof HAIR;
export type AvatarAcc = keyof typeof ACC;

const OUT = '#1d1813';
export const AVATAR_SKINS = [
  { s: '#f7d3b3', S: '#dcaa84' },
  { s: '#e6b088', S: '#c4875e' },
  { s: '#c58858', S: '#9a623b' },
  { s: '#86553a', S: '#643c26' },
] as const;
export const AVATAR_HAIRS = [
  { h: '#2b2522', H: '#16110f' },
  { h: '#6e4428', H: '#4a2c19' },
  { h: '#e0b54e', H: '#b0832b' },
  { h: '#b04a2b', H: '#7c2f19' },
  { h: '#ebe5d6', H: '#bdb5a3' },
] as const;
const GRAY = { h: '#c9c6bf', H: '#8f8b84' };
const FIXED: Record<string, string> = {
  e: OUT,
  m: '#9b4136',
  w: '#f4f4ef',
  a: '#f4f4ef',
  y: '#f0b437',
  W: '#b7bec4',
  r: '#c23a30',
  q: '#ef7fa6',
  Q: '#c74a78',
  v: '#46a457',
  x: '#f4f0e4',
  b: '#ff7a3d',
};
const SHADOW = 'rgba(0,0,0,.28)';

const hex = (c: string) =>
  [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
function mix(a: string, b: string, t: number): string {
  const A = hex(a);
  const B = hex(b);
  return `#${A.map((v, i) =>
    Math.round(v + (B[i]! - v) * t)
      .toString(16)
      .padStart(2, '0'),
  ).join('')}`;
}
function lum(c: string): number {
  const [r, g, b] = hex(c).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const dist = (a: string, b: string) => {
  const A = hex(a);
  const B = hex(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
};
const neutral = (c: string) => lum(c) > 0.8 || lum(c) < 0.03;
const darken = (c: string, t: number) => mix(c, '#000000', t);

// ───────── 유니폼 ─────────
/** 상의 무늬(몸통 10×7칸에서 알아볼 수 있는 것만). */
export const KIT_PATTERNS = [
  '-',
  'v',
  'v1',
  'h',
  'hoop',
  'half',
  'hh',
  'band',
  'sash',
  'ch',
  'q',
  'cr',
  'dz',
  'tri',
  'yoke',
  'side',
] as const;
export type KitPattern = (typeof KIT_PATTERNS)[number];
export interface KitSpec {
  body: string;
  pat: KitPattern;
  pc: string;
  pc2?: string | undefined;
  sleeve: string;
  collar: string;
  shorts: string;
  socks: string;
  cuff: string;
}
export type KitSide = 'home' | 'away';

function parseKit(line: string): KitSpec {
  const [body, pat, pc, sleeve, collar, shorts, socks, cuff, pc2] = line.split(' ') as string[];
  if (!KIT_PATTERNS.includes(pat as KitPattern)) throw new Error(`유니폼 무늬 오류: ${line}`); // i18n-ignore 개발용 오류
  const c = (h: string | undefined) => `#${h}`;
  return {
    body: c(body),
    pat: pat as KitPattern,
    pc: c(pc),
    ...(pc2 ? { pc2: c(pc2) } : {}),
    sleeve: c(sleeve),
    collar: c(collar),
    shorts: c(shorts),
    socks: c(socks),
    cuff: c(cuff),
  };
}
// 엠블럼 무늬 → 유니폼 무늬(정의 없는 구단용). sl(소매)은 소매 색으로 따로 칠한다.
const CREST_TO_KIT: Record<string, KitPattern> = {
  v: 'v',
  h: 'h',
  hoop: 'hoop',
  half: 'half',
  hh: 'hh',
  band: 'band',
  sash: 'sash',
  ch: 'ch',
  q: 'q',
  cr: 'cr',
  dz: 'dz',
  tri: 'tri',
};

/** 유니폼 정의가 없는 구단(고교·대학): 엠블럼 바탕·강조색으로 홈을, 그 반대 밝기의 단색으로 원정을 만든다. */
function autoKits(club: Pick<Club, 'id' | 'name'>, patKey: string): [KitSpec, KitSpec] {
  const cr = crestOf(club);
  const base = cr.base;
  const plain = patKey === '-';
  let trim = plain ? (cr.edge ?? cr.motifColor) : cr.accent;
  if (dist(trim, base) < 60) trim = lum(base) > 0.4 ? '#1c1c1f' : '#f4f4ef';
  const acc = plain ? base : cr.accent;
  const shorts =
    patKey === 'hh' ? acc : plain ? (neutral(trim) ? trim : base) : neutral(acc) ? acc : base;
  const home: KitSpec = {
    body: base,
    pat: CREST_TO_KIT[patKey] ?? '-',
    pc: acc,
    ...(cr.third ? { pc2: cr.third } : {}),
    sleeve: patKey === 'sl' ? cr.accent : base,
    collar: trim,
    shorts,
    socks: base,
    cuff: trim,
  };
  const ab = lum(base) > 0.5 ? '#1c2333' : '#f4f4ef';
  const away: KitSpec = {
    body: ab,
    pat: '-',
    pc: ab,
    sleeve: ab,
    collar: base,
    shorts: ab,
    socks: ab,
    cuff: base,
  };
  return [home, away];
}

/** 엠블럼에 칠한 무늬 path → 무늬 키(정의 없는 구단의 엠블럼 무늬를 되찾는다). */
const CREST_PAT_KEY = new Map(Object.entries(CREST_PATTERNS).map(([k, d]) => [d, k]));
const autoPatKey = (club: Pick<Club, 'id' | 'name'>) => {
  const p = crestOf(club).pattern;
  return p ? (CREST_PAT_KEY.get(p) ?? '-') : '-';
};

const kitCache = new Map<string, KitSpec>();
/** 구단의 홈·원정 유니폼. 정의가 없으면 엠블럼 색에서 만든다. */
export function kitOf(club: Pick<Club, 'id' | 'name'>, side: KitSide = 'home'): KitSpec {
  const key = `${club.id}|${side}`;
  let k = kitCache.get(key);
  if (k) return k;
  const spec = KIT_SPECS[club.id];
  if (spec) k = parseKit(spec[side === 'home' ? 0 : 1]);
  else {
    const [home, away] = autoKits(club, autoPatKey(club));
    k = side === 'home' ? home : away;
  }
  kitCache.set(key, k);
  return k;
}

/** 현역 입대(상무 아님) 동안 입는 위장 무늬 훈련복. */
const ARMY_KIT: KitSpec = {
  body: '#5f6b3a',
  pat: '-',
  pc: '#3f4826',
  sleeve: '#5f6b3a',
  collar: '#7d8a4c',
  shorts: '#4a5430',
  socks: '#2b2b26',
  cuff: '#2b2b26',
};
/** 은퇴식 정장. */
const SUIT_KIT: KitSpec = {
  body: '#22314f',
  pat: '-',
  pc: '#22314f',
  sleeve: '#22314f',
  collar: '#f4f4ef',
  shorts: '#22314f',
  socks: '#22314f',
  cuff: '#22314f',
};

/** 몸통(가로 7~16, 세로 13~19) 한 칸의 상의 색. */
function torsoColor(k: KitSpec, x: number, y: number): string {
  const { body, pc } = k;
  switch (k.pat) {
    case 'v':
      return (x - 7) % 4 >= 2 ? pc : body;
    case 'v1':
      return (x - 7) % 3 === 1 ? pc : body;
    case 'h':
      return y === 15 || y === 16 || y === 18 || y === 19 ? pc : body;
    case 'hoop':
      return y === 16 || y === 17 ? pc : body;
    case 'half':
      return x >= 12 ? pc : body;
    case 'hh':
      return y >= 17 ? pc : body;
    case 'band':
      return x >= 10 && x <= 13 ? pc : body;
    case 'sash':
      return Math.abs(x - (7 + (y - 13) * 1.5)) <= 1.1 ? pc : body;
    case 'ch': {
      const yc = 14 + (5.5 - Math.abs(x - 11.5)) * 0.55;
      return y >= yc && y < yc + 2 ? pc : body;
    }
    case 'q':
      return x >= 12 !== y >= 16 ? pc : body;
    case 'cr':
      return x === 11 || x === 12 || y === 16 ? pc : body;
    case 'dz':
      return ((x + y) & 2) ^ ((x - y + 40) & 2) ? pc : body;
    case 'tri':
      return x <= 9 ? body : x <= 13 ? pc : (k.pc2 ?? pc);
    case 'yoke':
      return y <= 14 ? pc : body;
    case 'side':
      return x === 7 || x === 16 ? pc : body;
    default:
      return body;
  }
}
function shirtColor(k: KitSpec, x: number, y: number, camo: boolean): string {
  if (camo) {
    const h = (x * 7 + y * 11) % 6;
    return h === 0 ? k.pc : h === 3 ? k.collar : k.body;
  }
  if (x <= 6 || x >= 17)
    return k.pat === 'half' && x >= 17 && k.sleeve === k.body ? k.pc : k.sleeve;
  return torsoColor(k, x, y);
}

// ───────── 외형·모습 ─────────
export interface AvatarLook {
  skin: number;
  hair: number;
  style: HairStyle;
}
const STYLES: HairStyle[] = ['short', 'fringe', 'long', 'mohawk'];
// 검정·갈색이 흔하게(머리 색 5종에 가중치).
const HAIR_PICK = [0, 0, 0, 1, 1, 2, 3, 4];
/** 커리어 ID에서 기본 외형을 뽑는다. 같은 ID는 언제나 같은 얼굴이고 게임 RNG는 쓰지 않는다. */
export function lookOf(id: string): AvatarLook {
  const h = hashStr(`avatar:${id}`);
  return {
    skin: h % AVATAR_SKINS.length,
    hair: HAIR_PICK[(h >>> 4) % HAIR_PICK.length]!,
    style: STYLES[(h >>> 8) % STYLES.length]!,
  };
}

export interface AvatarSpec {
  look: AvatarLook;
  hairStyle: HairStyle;
  /** 흰머리 비율(0~1). */
  gray: number;
  beard: keyof typeof BEARD | null;
  expr: keyof typeof EXPR | null;
  acc: AvatarAcc[];
  kit: KitSpec;
  /** 가슴 엠블럼 점을 찍을 구단(정장·훈련복이면 없다). */
  crestClub: Pick<Club, 'id' | 'name'> | null;
  camo: boolean;
}

/** 커리어 상태 → 지금 모습. 나이에 따라 수염·흰머리가 생기고, 부상·입대·은퇴 때 옷과 소품이 바뀐다. */
export function avatarSpec(s: GameState, side: KitSide = 'home'): AvatarSpec {
  const look = lookOf(s.cid);
  const army = s.mil.serving && s.mil.type === 'army';
  const spec: AvatarSpec = {
    look,
    hairStyle: s.mil.serving ? 'buzz' : s.age < 20 ? 'fringe' : look.style,
    gray: s.age >= 29 ? Math.min(0.45, (s.age - 28) * 0.1) : 0,
    beard: s.mil.serving ? null : s.age >= 28 ? 'full' : s.age >= 24 ? 'stubble' : null,
    expr: s.age >= 30 ? 'tired' : null,
    acc: s.nat.captain ? ['armband'] : [],
    kit: army ? ARMY_KIT : kitOf(s.club, side),
    crestClub: army ? null : s.club,
    camo: army,
  };
  if (s.retired) {
    spec.kit = SUIT_KIT;
    spec.crestClub = null;
    spec.expr = 'happy';
    spec.acc = ['suit', 'bouquet'];
    if (spec.beard === 'full') spec.beard = 'stubble';
  } else if (s.injury > 0) {
    spec.expr = 'pain';
    spec.acc = ['bandage', 'crutch'];
  }
  return spec;
}

/** 모습 → 24×32 색 격자(null은 투명). */
export function avatarPixels(sp: AvatarSpec): (string | null)[][] {
  const g = BASE.map((r) => r.split(''));
  const lay = (o: Layer) =>
    o.r.forEach((row, i) => {
      for (let x = 0; x < row.length; x++) if (row[x] !== '.') g[o.y + i]![x] = row[x]!;
    });
  if (sp.beard) lay(BEARD[sp.beard]);
  lay(HAIR[sp.hairStyle]);
  if (sp.expr) lay(EXPR[sp.expr]);
  for (const a of sp.acc) ACC[a].forEach(lay);

  const skin = AVATAR_SKINS[sp.look.skin % AVATAR_SKINS.length]!;
  const hc = AVATAR_HAIRS[sp.look.hair % AVATAR_HAIRS.length]!;
  const hair = mix(hc.h, GRAY.h, sp.gray);
  const hairS = mix(hc.H, GRAY.H, sp.gray);
  const k = sp.kit;
  const isSuit = sp.acc.includes('suit');
  // 가슴 왼쪽 2×2 엠블럼 점: 바탕색이 상의와 비슷하면 상징 색으로 칠한다.
  let mark: string[] | null = null;
  if (sp.crestClub) {
    const cr = crestOf(sp.crestClub);
    const cb = dist(cr.base, torsoColor(k, 13, 15)) < 60 ? cr.motifColor : cr.base;
    const cm =
      dist(cr.motifColor, cb) < 40 ? (lum(cb) > 0.5 ? '#1c1c1f' : '#f4f4ef') : cr.motifColor;
    mark = [cb, cb, cb, cm];
  }
  const color = (ch: string, x: number, y: number): string | null => {
    if (mark && y >= 15 && y <= 16 && x >= 13 && x <= 14 && 'kKt'.includes(ch))
      return mark[(y - 15) * 2 + (x - 13)]!;
    switch (ch) {
      case '.':
        return null;
      case 'O':
        return OUT;
      case 's':
        return skin.s;
      case 'S':
        return skin.S;
      case 'h':
        return hair;
      case 'H':
      case 'f':
        return hairS;
      case 'F':
        return mix(skin.S, hairS, 0.45);
      case 'k':
        return shirtColor(k, x, y, sp.camo);
      case 'K':
        return darken(shirtColor(k, x, y, sp.camo), 0.28);
      case 't':
        return k.collar;
      case 'p':
        return k.shorts;
      case 'P':
        return darken(k.shorts, 0.25);
      case 'c':
        return k.socks;
      case 'C':
        return k.cuff;
      case 'b':
        return isSuit ? '#18181b' : FIXED.b!;
      case 'n':
        return SHADOW;
      default:
        return FIXED[ch] ?? null;
    }
  };
  return g.map((row, y) => row.map((ch, x) => color(ch, x, y)));
}

export interface AvatarRect {
  x: number;
  y: number;
  w: number;
  fill: string;
  /** 그림자처럼 반투명한 칸. */
  opacity?: number;
}
/** 색 격자 → 사각형 목록(viewBox 0 0 24 32). 같은 색이 이어진 가로 칸은 사각형 하나로 합친다. */
export function avatarRects(px: (string | null)[][]): AvatarRect[] {
  const out: AvatarRect[] = [];
  px.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === c) w++;
      if (c)
        out.push(c === SHADOW ? { x, y, w, fill: '#000', opacity: 0.28 } : { x, y, w, fill: c });
      x += w;
    }
  });
  return out;
}

/** 완성된 SVG 문서(앱 SvgXml용). 웹은 avatarRects를 직접 그린다. */
export function avatarSvg(sp: AvatarSpec, width = AVATAR_W * 3): string {
  const height = (width / AVATAR_W) * AVATAR_H;
  const body = avatarRects(avatarPixels(sp))
    .map(
      (r) =>
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"${r.opacity ? ` fill-opacity="${r.opacity}"` : ''}/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${AVATAR_W} ${AVATAR_H}" width="${width}" height="${height}" shape-rendering="crispEdges">${body}</svg>`;
}

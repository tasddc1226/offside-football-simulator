// ───────── 도트 선수 아바타 (T-11-120) ─────────
// 24×32칸 2등신 선수를 부위별 글자 지도(레이어)로 쌓아 그린다. 이미지 파일 없이 색 격자 → 사각형 목록으로 만들어
// 웹(<svg><rect>)과 앱(react-native-svg Rect)이 같이 그린다. 외형(피부·머리)은 커리어 ID 해시로 정해 게임 RNG를 절대 쓰지 않고,
// 세이브에도 저장하지 않는다. 수염·흰머리·목발·정장 같은 건 나이와 상태에서 그때그때 정한다.
import { dist, lum, mix } from './color.js';
import { crestOf } from './crests.js';
import type { Club } from './data.js';
import { hashStr } from './hash.js';
import { kitColorAt, kitOf, type KitSide, type KitSpec } from './kits.js';
import { LOOK_BEARDS, LOOK_EXPRS, LOOK_STYLES, parseLookCode } from './look.js';
import type { GameState, LookState } from './types.js';

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
  // T-11-191 꾸미기 전용 머리 모양(기본 모습에는 나오지 않는다).
  afro: {
    y: 0,
    r: [
      '.......OOOOOOOOOO.......',
      '.....OOhhhhhhhhhhOO.....',
      '....OhhhhhhhhhhhhhhO....',
      '....OhhhhhhhhhhhhhhO....',
      '....OhhHhhhhhhhhhHhO....',
      '....OhhO........OhhO....',
      '....OhO..........OhO....',
      '.....O............O.....',
    ],
  },
  bun: {
    y: 0,
    r: [
      '..........OOOO..........',
      '.........OhhhhO.........',
      '.........OhHHhO.........',
      '........OOOOOOOO........',
      '.......OhhhhhhhhO.......',
      '......OhhhhhhhhhhO......',
      '......OH........HO......',
    ],
  },
  spiky: {
    y: 0,
    r: [
      '.......O..O..O..O.......',
      '......OhOOhOOhOOhO......',
      '......OhhhhhhhhhhO......',
      '......OhhhhhhhhhhO......',
      '......OhHhhhhhhHhO......',
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
  // T-11-191 꾸미기: 오른쪽 눈을 감고 웃는다.
  wink: {
    y: 7,
    r: ['..............s.........', '.............eee........', '', '..........mmmm..........'],
  },
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

type HairStyle = keyof typeof HAIR;
type AvatarAcc = keyof typeof ACC;

const OUT = '#1d1813';
const AVATAR_SKINS = [
  { s: '#f7d3b3', S: '#dcaa84' },
  { s: '#e6b088', S: '#c4875e' },
  { s: '#c58858', S: '#9a623b' },
  { s: '#86553a', S: '#643c26' },
  // T-11-191 꾸미기 전용.
  { s: '#fde6d2', S: '#e8c2a4' },
  { s: '#5e3a28', S: '#432819' },
] as const;
const AVATAR_HAIRS = [
  { h: '#2b2522', H: '#16110f' },
  { h: '#6e4428', H: '#4a2c19' },
  { h: '#e0b54e', H: '#b0832b' },
  { h: '#b04a2b', H: '#7c2f19' },
  { h: '#ebe5d6', H: '#bdb5a3' },
  // T-11-191 꾸미기 전용(기본 모습에는 나오지 않는다 — lookOf는 HAIR_PICK만 고른다).
  { h: '#3f6fd8', H: '#2a4c9c' },
  { h: '#e06aa5', H: '#a84478' },
  { h: '#4aa865', H: '#2f7442' },
  { h: '#b9c0c8', H: '#868d96' },
  { h: '#8a55c9', H: '#5f3790' },
  { h: '#e8823a', H: '#b05a20' },
  { h: '#7cc6ec', H: '#4f97bf' },
] as const;
/** T-11-191 헤어밴드 색(0은 없음). */
const BANDS = [
  null,
  '#f4f4ef',
  '#d63a33',
  '#1c1c1f',
  '#f0b437',
  '#3f6fd8',
  '#4aa865',
  '#ef7fa6',
] as const;
/** T-11-191 손목 밴드 색(0은 없음). */
const WRISTS = [null, '#f4f4ef', '#d63a33', '#1c1c1f', '#3f6fd8', '#f0b437'] as const;
/** T-11-191 양말 색(0은 구단 양말). */
const SOCKS = [null, '#f4f4ef', '#1c1c1f', '#d63a33', '#3f6fd8', '#f0b437', '#ef7fa6'] as const;
/** T-11-191 축구화 색(0은 기본 주황). */
const BOOTS = [
  '#ff7a3d',
  '#1c1c1f',
  '#f4f4ef',
  '#e2b13c',
  '#3f6fd8',
  '#ef7fa6',
  '#4aa865',
  '#8a55c9',
  '#d63a33',
  '#c9ced4',
] as const;
/** T-11-191 고글 테 · 알 색(0은 없음). */
const GOGGLES = [
  null,
  { G: '#1c1c1f', g: '#3a4252' },
  { G: '#2c6fd6', g: '#9fd3ff' },
  { G: '#b52a24', g: '#ff9b8f' },
  { G: '#b8860b', g: '#ffe08a' },
  { G: '#1c1c1f', g: '#1c1c1f' },
] as const;
/** T-11-191 꾸미기 선택지 색(웹 · 앱 견본). 색이 아닌 항목(머리 모양 · 수염)은 null, 선택지 '없음'은 null. */
export const LOOK_SWATCHES: Record<
  'skin' | 'hair' | 'band' | 'wrist' | 'socks' | 'boots' | 'glasses',
  readonly (string | null)[]
> = {
  skin: AVATAR_SKINS.map((c) => c.s),
  hair: AVATAR_HAIRS.map((c) => c.h),
  band: BANDS,
  wrist: WRISTS,
  socks: SOCKS,
  boots: BOOTS,
  glasses: GOGGLES.map((c) => c?.g ?? null),
};
/** T-11-191 헤어밴드 줄(이마)과 고글(눈 두 줄). A 밴드, G 고글 테, g 고글 알. */
const BAND_LAYER: Layer = { y: 5, r: ['......OAAAAAAAAAAO......'] };
/** T-11-191 손목 밴드(X). */
const WRIST_LAYER: Layer = { y: 18, r: ['....XX............XX....'] };
const GOGGLE_LAYER: Layer = {
  y: 7,
  r: ['.......GggGGGggG........', '.......GggG.GggG........'],
};
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

const darken = (c: string, t: number) => mix(c, '#000000', t);

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
function shirtColor(k: KitSpec, x: number, y: number): string {
  if (k === ARMY_KIT) {
    const h = (x * 7 + y * 11) % 6;
    return h === 0 ? k.pc : h === 3 ? k.collar : k.body;
  }
  return kitColorAt(k, x, y);
}

/** 화면 너비에 맞는 아바타 너비(px). 칸이 고르게 보이게 정수배(좁으면 2배, 아니면 3배)로만 키운다. 웹 CSS도 같은 값이다. */
export const avatarWidth = (viewportW: number) => (viewportW < 360 ? AVATAR_W * 2 : AVATAR_W * 3);

// ───────── 외형·모습 ─────────
interface AvatarLook {
  skin: number;
  hair: number;
  style: HairStyle;
}
const STYLES: HairStyle[] = ['short', 'fringe', 'long', 'mohawk'];
const BASE_SKINS = 4;
// 검정·갈색이 흔하게(머리 색 5종에 가중치).
const HAIR_PICK = [0, 0, 0, 1, 1, 2, 3, 4];
/** 커리어 ID에서 기본 외형을 뽑는다. 같은 ID는 언제나 같은 얼굴이고 게임 RNG는 쓰지 않는다. */
export function lookOf(id: string): AvatarLook {
  const h = hashStr(`avatar:${id}`);
  return {
    // 기본 모습은 처음 4가지 피부색에서만 고른다(T-11-191 꾸미기 색이 늘어도 얼굴이 바뀌지 않게).
    skin: h % BASE_SKINS,
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
  /** 가슴 엠블럼 점의 구단(구단 유니폼일 때만 찍는다). */
  club: Pick<Club, 'id' | 'name'>;
  /** T-11-191 꾸미기: 헤어밴드 · 축구화 · 고글 선택지 번호(없으면 기본). */
  band?: number;
  boots?: number;
  glasses?: number;
  wrist?: number;
  socks?: number;
}

/**
 * T-11-191 산 꾸미기를 모습에 입힌다. 피부 · 머리색 · 머리 모양 · 수염은 고른 값이 나이로 정한 값을 이긴다(흰머리는 나이 그대로).
 * 군 복무 중 까까머리는 그대로 둔다.
 */
function withLook(sp: AvatarSpec, pick: LookState['pick'], forceStyle = false): AvatarSpec {
  const out = { ...sp, look: { ...sp.look } };
  if (pick.skin !== undefined) out.look.skin = pick.skin;
  if (pick.hair !== undefined) out.look.hair = pick.hair;
  if (pick.style !== undefined && !forceStyle) out.hairStyle = LOOK_STYLES[pick.style]!;
  if (pick.beard !== undefined) out.beard = LOOK_BEARDS[pick.beard] ?? null;
  if (pick.band) out.band = pick.band;
  if (pick.boots) out.boots = pick.boots;
  if (pick.glasses) out.glasses = pick.glasses;
  if (pick.wrist) out.wrist = pick.wrist;
  if (pick.socks) out.socks = pick.socks;
  // 표정: 부상 중 아픈 표정은 그대로 둔다.
  if (pick.expr && sp.expr !== 'pain') out.expr = LOOK_EXPRS[pick.expr] ?? sp.expr;
  return out;
}

const grayAt = (age: number) => (age >= 29 ? Math.min(0.45, (age - 28) * 0.1) : 0);

/** 은퇴한 선수(은퇴 리포트·명예의 전당): 커리어 ID와 은퇴 나이만으로 은퇴식 정장 모습을 그린다. */
export function retiredAvatarSpec(id: string, age: number, code?: string | null): AvatarSpec {
  const look = lookOf(id);
  return withLook(
    {
      look,
      club: { id: '', name: '' },
      hairStyle: look.style,
      gray: grayAt(age),
      beard: age >= 24 ? 'stubble' : null,
      expr: 'happy',
      acc: ['suit', 'bouquet'],
      kit: SUIT_KIT,
    },
    parseLookCode(code),
  );
}

/** 명예의 전당 시상대: 커리어 ID로 얼굴을, 마지막 소속 구단으로 홈 유니폼을 정한 전성기 모습.
 * 실제 전성기 나이는 목록 응답에 없어 27세(짧은 수염·흰머리 없음)로 그린다. 구단 id가 없는 옛 기록은 이름으로 유니폼을 찾는다. */
export function primeAvatarSpec(e: {
  id: string;
  lastClub: string;
  lastClubId?: string | null | undefined;
  /** T-11-191 은퇴 때 올린 꾸미기 코드(look.ts lookCode). */
  look?: string | null | undefined;
}): AvatarSpec {
  const look = lookOf(e.id);
  const club = { id: e.lastClubId ?? '', name: e.lastClub };
  return withLook(
    {
      look,
      club,
      hairStyle: look.style,
      gray: 0,
      beard: 'stubble',
      expr: 'happy',
      acc: [],
      kit: kitOf(club),
    },
    parseLookCode(e.look),
  );
}

/** 커리어 상태 → 지금 모습. 나이에 따라 수염·흰머리가 생기고, 부상·입대·은퇴 때 옷과 소품이 바뀐다. */
export function avatarSpec(s: GameState, side: KitSide = 'home'): AvatarSpec {
  const pick = s.look?.pick ?? {};
  if (s.retired) return withLook(retiredAvatarSpec(s.cid, s.age), pick);
  const look = lookOf(s.cid);
  const serving = s.mil.serving;
  return withLook(
    {
      look,
      club: s.club,
      hairStyle: serving ? 'buzz' : s.age < 20 ? 'fringe' : look.style,
      gray: grayAt(s.age),
      beard: serving ? null : s.age >= 28 ? 'full' : s.age >= 24 ? 'stubble' : null,
      kit: serving && s.mil.type === 'army' ? ARMY_KIT : kitOf(s.club, side),
      expr: s.injury > 0 ? 'pain' : s.age >= 30 ? 'tired' : null,
      acc: s.injury > 0 ? ['bandage', 'crutch'] : s.nat.captain ? ['armband'] : [],
    },
    pick,
    serving,
  );
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
  if (sp.band) lay(BAND_LAYER);
  if (sp.expr) lay(EXPR[sp.expr]);
  if (sp.glasses) lay(GOGGLE_LAYER);
  if (sp.wrist) lay(WRIST_LAYER);
  for (const a of sp.acc) ACC[a].forEach(lay);
  const band = BANDS[sp.band ?? 0] ?? null;
  const goggle = GOGGLES[sp.glasses ?? 0] ?? null;
  const wrist = WRISTS[sp.wrist ?? 0] ?? null;

  const skin = AVATAR_SKINS[sp.look.skin % AVATAR_SKINS.length]!;
  const hc = AVATAR_HAIRS[sp.look.hair % AVATAR_HAIRS.length]!;
  const hair = mix(hc.h, GRAY.h, sp.gray);
  const hairS = mix(hc.H, GRAY.H, sp.gray);
  const k = sp.kit;
  const socks = k === SUIT_KIT ? null : (SOCKS[sp.socks ?? 0] ?? null);
  // 가슴 왼쪽 2×2 엠블럼 점: 바탕색이 상의와 비슷하면 상징 색으로 칠한다.
  let mark: string[] | null = null;
  if (k !== ARMY_KIT && k !== SUIT_KIT) {
    const cr = crestOf(sp.club);
    const cb = dist(cr.base, kitColorAt(k, 13, 15)) < 60 ? cr.motifColor : cr.base;
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
        return shirtColor(k, x, y);
      case 'K':
        return darken(shirtColor(k, x, y), 0.28);
      case 't':
        return k.collar;
      case 'p':
        return k.shorts;
      case 'P':
        return darken(k.shorts, 0.25);
      case 'c':
        return socks ?? k.socks;
      case 'C':
        return socks ? darken(socks, 0.2) : k.cuff;
      case 'X':
        return wrist;
      case 'b':
        return k === SUIT_KIT ? '#18181b' : (BOOTS[sp.boots ?? 0] ?? FIXED.b!);
      case 'A':
        return band;
      case 'G':
        return goggle?.G ?? null;
      case 'g':
        return goggle?.g ?? null;
      case 'n':
        return SHADOW;
      default:
        return FIXED[ch] ?? null;
    }
  };
  return g.map((row, y) => row.map((ch, x) => color(ch, x, y)));
}

/** 색 격자 → 사각형 목록(viewBox 0 0 24 32). 같은 색이 이어진 가로 칸은 사각형 하나로 합치고, 그림자 칸은 반투명 검정이다. */
export function avatarRects(px: (string | null)[][]) {
  const out: { x: number; y: number; w: number; fill: string; opacity?: number }[] = [];
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

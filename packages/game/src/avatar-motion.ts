// ───────── T-11-191 도트 선수 모션 ─────────
// 서 있는 모습(avatar.ts의 글자 지도)에서 팔 · 다리를 바꾸고, 칠한 뒤 몸을 올리거나(점프) 내리고(웅크림 · 무릎),
// 공 · 트로피 같은 소품을 얹어 프레임을 만든다. 꾸미기(피부 · 머리 · 축구화 · 손목 밴드 등)와 유니폼은 서 있는 모습과 같은
// 규칙으로 칠하므로 모든 모션에 그대로 나온다. 프레임은 24×36(머리 위 4줄 여유)이고, 게임 RNG는 쓰지 않는다.
import { AVATAR_H, AVATAR_W, avatarChars, paintChars, type AvatarSpec } from './avatar.js';

/** 머리 위 여유 줄(점프 · 헤딩 · 트로피). 프레임의 y = 서 있는 자세 y + MOTION_TOP. */
export const MOTION_TOP = 4;
export const MOTION_H = AVATAR_H + MOTION_TOP;

/** 부분 그림. '.'은 그대로 두고 '_'는 지운다. 좌표는 서 있는 자세 기준(y는 음수 가능). */
interface Part {
  x: number;
  y: number;
  r: readonly string[];
}
const mirror = (p: Part): Part => {
  const w = Math.max(...p.r.map((row) => row.length));
  return {
    x: AVATAR_W - p.x - w,
    y: p.y,
    r: p.r.map((row) => [...row.padEnd(w, '.')].reverse().join('')),
  };
};

// ── 팔(화면 왼쪽 팔 기준, 오른쪽은 좌우를 뒤집는다). 기본 팔(가로 3~5, 세로 15~20)을 지우고 새로 그린다.
const ARM_CLEAR: Part[] = [
  { x: 3, y: 15, r: ['___', '___', '___', '___', '___'] },
  { x: 4, y: 20, r: ['__'] },
];
const ARMS = {
  down: [],
  /** 팔꿈치를 굽혀 손이 한 칸 위(달리기). */
  bent: [...ARM_CLEAR, { x: 3, y: 15, r: ['OkkO', 'OKKO', 'OZZO', 'OssO', '.OO.'] }],
  /** 머리 옆으로 곧게 든 팔(만세 · 인사). */
  up: [
    ...ARM_CLEAR,
    {
      x: 1,
      y: 5,
      r: ['.OO.', 'OssO', 'OssO', 'OZZO', 'OkkO', 'OkkO', 'OkkO', 'OKkO', 'OKkkk'],
    },
    { x: 2, y: 14, r: ['OKkk'] },
  ],
  /** 손을 흔드는 팔(up에서 손만 한 칸 바깥). */
  wave: [
    ...ARM_CLEAR,
    { x: 0, y: 5, r: ['.OO.', 'OssO', 'OssO'] },
    { x: 1, y: 8, r: ['OZZO', 'OkkO', 'OkkO', 'OkkO', 'OKkO', 'OKkkk'] },
    { x: 2, y: 14, r: ['OKkk'] },
  ],
  /** 머리 위로 모은 팔(트로피 들기). 머리 가장자리를 살짝 가린다. */
  hold: [
    ...ARM_CLEAR,
    {
      x: 3,
      y: 0,
      r: [
        '.OO.',
        'OssO',
        'OssO',
        'OZZO',
        'OkkO',
        'OkkO',
        'OkkO',
        'OkkO',
        'OkkO',
        'OkkO',
        'OkkO',
        'OkkO',
        'OKkO',
        'OKkk',
      ],
    },
    { x: 4, y: 14, r: ['K'] },
  ],
  /** 주먹을 어깨 위로(주먹 세리머니). */
  fist: [...ARM_CLEAR, { x: 2, y: 9, r: ['.OO.', 'OssO', 'OZZO', 'OkkO', 'Okkk', 'OKKk', '.OOO'] }],
  /** 옆으로 뻗은 팔(균형 · 비행기 세리머니). */
  out: [...ARM_CLEAR, { x: 0, y: 13, r: ['.OOOOO', 'OsZkkkk', 'OsZKKkk', '.OOOOOO'] }],
} satisfies Record<string, Part[]>;
export type MotionArm = keyof typeof ARMS;

// ── 다리(세로 23~28 여섯 줄 전체). runL은 화면 왼쪽 다리를 든 것, runR은 그 거울.
const LEG_STAND = [
  '.......OssO..OssO.......',
  '.......OccO..OccO.......',
  '.......OCCO..OCCO.......',
  '.......OccO..OccO.......',
  '......ObbbO..ObbbO......',
  '......OOOOO..OOOOO......',
];
const LEG_RUN_L = [
  '.......OssO..OssO.......',
  '.......OccO..OccO.......',
  '.......ObbbO.OCCO.......',
  '.......OOOOO.OccO.......',
  '.............ObbbO......',
  '.............OOOOO......',
];
const LEGS = {
  stand: LEG_STAND,
  runL: LEG_RUN_L,
  runR: mirror({ x: 0, y: 23, r: LEG_RUN_L }).r,
  /** 무릎 꿇기: 다리를 지우고, 몸을 내린 뒤(sink 3) 무릎을 따로 그린다. */
  kneel: Array<string>(6).fill('________________________'),
} satisfies Record<string, readonly string[]>;
export type MotionLegs = keyof typeof LEGS;
const KNEES: Part = {
  x: 0,
  y: 26,
  r: ['.......OssO..OssO.......', '.......OssO..OssO.......', '.......OOOO..OOOO.......'],
};

// ── 소품
const BALL = ['.OOO.', 'OBBBO', 'OBDBO', 'OBBBO', '.OOO.'];
const TROPHY = [
  '...OOOOOO...',
  '..OyyyyyyO..',
  'OOOyyyyyyOOO',
  'Oy.OyyyYO.yO',
  '.OOOyyyYOOO.',
  '....OyYO....',
  '...OYYYYO...',
  '...OOOOOO...',
];
const SPARKLE = ['.Y.', 'YyY', '.Y.'];
const DUST = ['u.u.', '.u.u'];

export interface MotionFrame {
  /** 이 프레임을 보여 줄 시간(ms). */
  ms: number;
  /** [화면 왼쪽 팔, 화면 오른쪽 팔] — 없으면 기본(내린 팔). */
  arms?: [MotionArm, MotionArm];
  legs?: MotionLegs;
  /** 표정 덮어쓰기(부상 중 아픈 표정은 그대로). */
  expr?: AvatarSpec['expr'];
  /** 윗몸(세로 0~22)을 n칸 내린다 — 숨쉬기 · 웅크림 · 무릎 꿇기. */
  sink?: number;
  /** 몸 전체(세로 0~28)를 n칸 올린다 — 점프. 그림자는 바닥에 남는다. */
  lift?: number;
  /** 머리(세로 0~12)만 n칸 숙인다. */
  bow?: number;
  /** 그림자 폭(기본 14). */
  shadow?: number;
  /** 공 왼쪽 위 좌표(서 있는 자세 기준). */
  ball?: [number, number];
  /** 트로피 위쪽 y(가로는 가운데). */
  trophy?: number;
  sparkle?: boolean;
  dust?: boolean;
}

export interface Motion {
  frames: MotionFrame[];
  /** false면 한 번 재생하고 마지막 프레임에 멈춘다. */
  loop: boolean;
}

const stepF = (legs: MotionLegs, arms: [MotionArm, MotionArm], ms = 130): MotionFrame => ({
  ms,
  legs,
  arms,
});
const RUN: MotionFrame[] = [
  stepF('runL', ['down', 'bent']),
  { ms: 110, arms: ['bent', 'bent'], lift: 1, shadow: 12 },
  stepF('runR', ['bent', 'down']),
  { ms: 110, arms: ['bent', 'bent'], lift: 1, shadow: 12 },
];

/** 모션 목록. 순서가 화면(모션 고르기 · 견본) 순서다. */
export const MOTIONS = {
  /** 숨쉬기 + 가끔 눈 깜빡임(기본 대기). */
  idle: {
    loop: true,
    frames: [
      { ms: 600 },
      { ms: 600, sink: 1 },
      { ms: 600 },
      { ms: 600, sink: 1 },
      { ms: 120, expr: 'blink' },
    ],
  },
  run: { loop: true, frames: RUN },
  dribble: {
    loop: true,
    frames: [
      { ...RUN[0]!, ball: [14, 26] },
      { ...RUN[1]!, ball: [13, 24] },
      { ...RUN[2]!, ball: [6, 26] },
      { ...RUN[3]!, ball: [7, 24] },
    ],
  },
  /** 공 리프팅(오른발로 띄우기). */
  juggle: {
    loop: true,
    frames: [
      { ms: 160, legs: 'runR', arms: ['out', 'down'], ball: [13, 21] },
      { ms: 140, arms: ['out', 'down'], ball: [13, 16] },
      { ms: 180, arms: ['out', 'down'], ball: [13, 12] },
      { ms: 140, arms: ['out', 'down'], ball: [13, 16] },
    ],
  },
  /** 슈팅: 들어 올렸다 차고 공이 날아간다. */
  shoot: {
    loop: true,
    frames: [
      { ms: 300, ball: [13, 26] },
      { ms: 260, legs: 'runR', arms: ['out', 'down'], ball: [11, 26], expr: 'happy' },
      { ms: 90, arms: ['out', 'bent'], ball: [15, 23], expr: 'shout', sink: 1 },
      { ms: 90, arms: ['out', 'bent'], ball: [19, 15], expr: 'shout' },
      { ms: 90, arms: ['out', 'bent'], ball: [19, 5], expr: 'shout' },
      { ms: 600, arms: ['fist', 'down'], expr: 'shout' },
    ],
  },
  /** 헤딩: 웅크렸다 뛰어올라 머리로 받는다. */
  header: {
    loop: true,
    frames: [
      { ms: 260, sink: 1, ball: [10, -12] },
      { ms: 120, lift: 2, arms: ['bent', 'bent'], shadow: 12, ball: [10, -9] },
      { ms: 160, lift: 3, arms: ['out', 'out'], shadow: 10, ball: [10, -5], expr: 'blink' },
      { ms: 120, lift: 2, arms: ['out', 'out'], shadow: 12, ball: [16, -9], expr: 'shout' },
      { ms: 160, sink: 1, ball: [21, -12] },
      { ms: 500 },
    ],
  },
  /** 주먹 세리머니. */
  fist: {
    loop: true,
    frames: [
      { ms: 300 },
      { ms: 200, arms: ['down', 'fist'], expr: 'shout' },
      { ms: 160, arms: ['down', 'fist'], expr: 'shout', sink: 1 },
      { ms: 200, arms: ['down', 'fist'], expr: 'shout' },
      { ms: 160, arms: ['down', 'fist'], expr: 'shout', sink: 1 },
    ],
  },
  /** 만세 점프. */
  banzai: {
    loop: true,
    frames: [
      { ms: 200, sink: 1, expr: 'happy' },
      { ms: 160, lift: 2, arms: ['up', 'up'], expr: 'shout', shadow: 12 },
      { ms: 200, lift: 3, arms: ['up', 'up'], expr: 'shout', shadow: 10 },
      { ms: 160, lift: 1, arms: ['up', 'up'], expr: 'shout', shadow: 12 },
    ],
  },
  /** 무릎 슬라이딩. */
  slide: {
    loop: true,
    frames: [
      { ...RUN[0]! },
      { ...RUN[1]! },
      { ms: 160, legs: 'kneel', sink: 3, arms: ['out', 'out'], expr: 'shout', dust: true },
      { ms: 400, legs: 'kneel', sink: 3, arms: ['up', 'up'], expr: 'shout' },
      { ms: 400, legs: 'kneel', sink: 3, arms: ['fist', 'fist'], expr: 'shout' },
    ],
  },
  /** 관중에게 손 흔들기. */
  wave: {
    loop: true,
    frames: [
      { ms: 260, arms: ['down', 'up'], expr: 'happy' },
      { ms: 260, arms: ['down', 'wave'], expr: 'happy' },
    ],
  },
  /** 트로피 들기. */
  trophy: {
    loop: true,
    frames: [
      { ms: 300, arms: ['hold', 'hold'], trophy: -4, expr: 'shout' },
      { ms: 300, arms: ['hold', 'hold'], trophy: -4, expr: 'shout', sparkle: true },
      { ms: 220, arms: ['hold', 'hold'], trophy: -3, expr: 'happy', sink: 1 },
    ],
  },
  /** 좌절(무릎 꿇고 고개 숙임). */
  sad: {
    loop: true,
    frames: [
      { ms: 900, legs: 'kneel', sink: 3, bow: 1, expr: 'tired' },
      { ms: 600, legs: 'kneel', sink: 3, bow: 2, expr: 'tired' },
    ],
  },
} satisfies Record<string, Motion>;
export type MotionId = keyof typeof MOTIONS;
export const MOTION_IDS = Object.keys(MOTIONS) as MotionId[];

type Px = (string | null)[][];

/** 글자 지도에 부분 그림을 얹는다(top: 지도 위쪽 여유 줄). */
function put(g: string[][], p: Part, top: number) {
  p.r.forEach((row, i) => {
    const y = p.y + i + top;
    if (y < 0 || y >= g.length) return;
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      const gx = p.x + x;
      if (ch === '.' || gx < 0 || gx >= AVATAR_W) continue;
      g[y]![gx] = ch === '_' ? '.' : ch;
    }
  });
}

/** 색 격자에서 세로 from~to 줄을 dy만큼 옮긴다(빈 칸은 덮지 않는다). */
function shift(px: Px, from: number, to: number, dy: number) {
  if (!dy) return;
  const rows = px.slice(from, to + 1).map((r) => [...r]);
  for (let y = from; y <= to; y++) px[y] = Array<string | null>(AVATAR_W).fill(null);
  rows.forEach((r, i) => {
    const y = from + i + dy;
    if (y < 0 || y >= px.length) return;
    r.forEach((c, x) => {
      if (c) px[y]![x] = c;
    });
  });
}

/** 한 프레임 → 24×36 색 격자. */
export function motionFrame(sp: AvatarSpec, f: MotionFrame): Px {
  const T = MOTION_TOP;
  const spec = f.expr !== undefined && sp.expr !== 'pain' ? { ...sp, expr: f.expr } : sp;
  const blank = () => Array.from({ length: MOTION_H }, () => Array<string>(AVATAR_W).fill('.'));
  const g = [
    ...Array.from({ length: T }, () => Array<string>(AVATAR_W).fill('.')),
    ...avatarChars(spec),
  ];
  // 그림자는 따로 그린다(몸이 떠도 바닥에 남게).
  g[29 + T] = Array<string>(AVATAR_W).fill('.');
  const [la, ra] = f.arms ?? ['down', 'down'];
  for (const p of ARMS[la]) put(g, p, T);
  for (const p of ARMS[ra]) put(g, mirror(p), T);
  if (f.legs) put(g, { x: 0, y: 23, r: LEGS[f.legs] }, T);
  const px = paintChars(spec, g, T);
  // 몸 옮기기: 머리 숙이기 → 윗몸 내리기 → 몸 전체 올리기.
  if (f.bow) shift(px, T, 12 + T, f.bow);
  if (f.sink) shift(px, 0, 22 + T, f.sink);
  if (f.lift) shift(px, 0, 28 + T, -f.lift);
  // 몸을 옮긴 뒤에 얹는 것: 무릎 · 그림자 · 소품.
  const over = blank();
  if (f.legs === 'kneel') put(over, KNEES, T);
  const sw = f.shadow ?? 14;
  put(over, { x: (AVATAR_W - sw) / 2, y: 29, r: ['n'.repeat(sw)] }, T);
  if (f.dust) {
    put(over, { x: 2, y: 27, r: DUST }, T);
    put(over, mirror({ x: 2, y: 27, r: DUST }), T);
  }
  if (f.trophy !== undefined) put(over, { x: 6, y: f.trophy, r: TROPHY }, T);
  if (f.sparkle) {
    put(over, { x: 1, y: -3, r: SPARKLE }, T);
    put(over, mirror({ x: 1, y: -3, r: SPARKLE }), T);
  }
  if (f.ball) put(over, { x: f.ball[0], y: f.ball[1], r: BALL }, T);
  const top = paintChars(spec, over, T);
  // 그림자는 몸 뒤, 나머지 소품은 몸 앞.
  return px.map((row, y) =>
    row.map((c, x) => {
      const o = top[y]![x];
      if (!o) return c;
      return over[y]![x] === 'n' ? (c ?? o) : o;
    }),
  );
}

/** 모션 → 프레임 색 격자 목록. */
export function motionFrames(sp: AvatarSpec, id: MotionId): Px[] {
  return MOTIONS[id].frames.map((f) => motionFrame(sp, f));
}

// ───────── T-11-191 도트 선수 모션 ─────────
// 미니형 선수(avatar-mini.ts)의 모션. 자세 그림은 머리 모양마다 생성 시트에서 옮긴 64×72 재질 글자 지도이고
// (avatar-mini-motion/<머리 모양>.ts, 무대가 열릴 때 그 선수 머리 모양 하나만 불러온다), 서 있는 자세는 카드와 같은 그림을 쓴다.
// 색(피부 · 머리 · 유니폼 · 축구화 · 양말 · 밴드 · 고글)은 서 있는 모습과 같은 규칙으로 칠하고, 점프 · 숨쉬기는 칠한 뒤 몸을 옮기며,
// 공 · 트로피 · 반짝임 · 흙먼지는 마지막에 얹는다. 프레임은 64×72(논리 32×36)이고, 게임 RNG는 쓰지 않는다.
import { avatarPixels, miniColors, type AvatarSpec } from './avatar.js';
import { MINI_SPRITES } from './avatar-mini-data.js';
import { MINI_W, paintMini, type MiniBody } from './avatar-mini.js';

/** 머리 위 여유 줄(논리 칸). 프레임의 y = 서 있는 자세 y + MOTION_TOP. */
export const MOTION_TOP = 4;
/** 프레임 논리 크기(viewBox). 실제 픽셀은 두 배다. */
export const MOTION_W = 32;
export const MOTION_H = 36;
const FW = MOTION_W * 2;
const FH = MOTION_H * 2;
/** 서 있는 그림(48×64)을 놓는 자리. */
const SX = (FW - MINI_W) / 2;
const SY = MOTION_TOP * 2;

/** 생성 시트에서 옮긴 자세. stand는 카드와 같은 서 있는 그림이다. */
export const MINI_POSES = [
  'runL',
  'air',
  'runR',
  'juggle',
  'balance',
  'kick',
  'fist',
  'tuck',
  'spread',
  'jumpUp',
  'kneelOut',
  'kneelUp',
  'kneelFist',
  'waveHigh',
  'waveLow',
  'lift',
  'sad',
] as const;
export type MiniPose = (typeof MINI_POSES)[number];
/** [지도(길이 압축), 얼굴 x, y, 엠블럼 x, y, 완장 x, y, 앞발 x, y, 맨 위 손 x, y] — 좌표는 64×72 프레임 기준, -1은 없음. */
export type MiniPoseData = Record<MiniPose, readonly [string, ...number[]]>;

type Px = (string | null)[][];
type Pt = readonly [number, number];
interface PoseInfo {
  rows: string[];
  face: Pt;
  crest: Pt | null;
  arm: Pt;
  foot: Pt;
  top: Pt;
}
export type MiniPoses = Record<MiniPose, PoseInfo>;

const decode = (rle: string): string[] => {
  let s = '';
  for (const [, ch, n] of rle.matchAll(/([^\d])(\d*)/g)) s += ch!.repeat(n ? Number(n) : 1);
  return Array.from({ length: FH }, (_, y) => s.slice(y * FW, (y + 1) * FW));
};

const LOADERS: Record<keyof typeof MINI_SPRITES, () => Promise<{ default: MiniPoseData }>> = {
  short: () => import('./avatar-mini-motion/short.js'),
  fringe: () => import('./avatar-mini-motion/fringe.js'),
  long: () => import('./avatar-mini-motion/long.js'),
  mohawk: () => import('./avatar-mini-motion/mohawk.js'),
  slick: () => import('./avatar-mini-motion/slick.js'),
  buzz: () => import('./avatar-mini-motion/buzz.js'),
  afro: () => import('./avatar-mini-motion/afro.js'),
  bun: () => import('./avatar-mini-motion/bun.js'),
  spiky: () => import('./avatar-mini-motion/spiky.js'),
};
const loaded = new Map<string, Promise<MiniPoses>>();
/** 머리 모양 하나의 자세 그림을 불러온다(한 번만). 무대(진행 시트)가 열릴 때 부른다. */
export function loadMotionPoses(style: AvatarSpec['hairStyle']): Promise<MiniPoses> {
  let p = loaded.get(style);
  if (!p) {
    p = LOADERS[style]()
      .then(({ default: d }) => {
        const out = {} as MiniPoses;
        for (const k of MINI_POSES) {
          const [rle, fx, fy, cx, cy, ax, ay, px, py, tx, ty] = d[k] as [string, ...number[]];
          out[k] = {
            rows: decode(rle),
            face: [fx!, fy!],
            crest: cx! < 0 ? null : [cx!, cy!],
            arm: [ax!, ay!],
            foot: [px!, py!],
            top: [tx!, ty!],
          };
        }
        return out;
      })
      .catch((error: unknown) => {
        loaded.delete(style);
        throw error;
      });
    loaded.set(style, p);
  }
  return p;
}

export interface MotionFrame {
  /** 이 프레임을 보여 줄 시간(ms). */
  ms: number;
  /** 자세(없으면 서 있는 그림). */
  pose?: MiniPose;
  /** 표정 덮어쓰기(부상 중 아픈 표정은 그대로). */
  expr?: AvatarSpec['expr'];
  /** 윗몸을 n칸(논리) 내린다 — 숨쉬기 · 웅크림. */
  sink?: number;
  /** 몸 전체를 n칸(논리) 올린다 — 점프. 그림자는 바닥에 남는다. */
  lift?: number;
  /** 그림자 폭(실제 픽셀, 기본 30). */
  shadow?: number;
  /** 공: 앞발(foot) · 얼굴(head) 기준이나 프레임 좌표(at)로 왼쪽 위를 정한다(실제 픽셀). */
  ball?: { from: 'foot' | 'head' | 'at'; d: Pt };
  /** 트로피: 맨 위 손 위에 얹는다. */
  trophy?: boolean;
  sparkle?: boolean;
  dust?: boolean;
}

export interface Motion {
  frames: MotionFrame[];
  /** false면 한 번 재생하고 마지막 프레임에 멈춘다. */
  loop: boolean;
}

const RUN: MotionFrame[] = [
  { ms: 130, pose: 'runL' },
  { ms: 110, pose: 'air', lift: 1, shadow: 26 },
  { ms: 130, pose: 'runR' },
  { ms: 110, pose: 'air', lift: 1, shadow: 26 },
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
      { ...RUN[0]!, ball: { from: 'foot', d: [1, -7] } },
      { ...RUN[1]!, ball: { from: 'foot', d: [0, -6] } },
      { ...RUN[2]!, ball: { from: 'foot', d: [1, -7] } },
      { ...RUN[3]!, ball: { from: 'foot', d: [0, -6] } },
    ],
  },
  /** 공 리프팅(오른발로 띄우기). */
  juggle: {
    loop: true,
    frames: [
      { ms: 160, pose: 'juggle', ball: { from: 'foot', d: [-4, -12] } },
      { ms: 140, pose: 'juggle', ball: { from: 'foot', d: [-4, -22] } },
      { ms: 180, pose: 'juggle', ball: { from: 'foot', d: [-4, -32] } },
      { ms: 140, pose: 'juggle', ball: { from: 'foot', d: [-4, -22] } },
    ],
  },
  /** 슈팅: 들어 올렸다 차고 공이 날아간다. */
  shoot: {
    loop: true,
    frames: [
      { ms: 300, pose: 'balance', ball: { from: 'at', d: [42, 62] } },
      { ms: 260, pose: 'juggle', ball: { from: 'at', d: [42, 62] } },
      { ms: 90, pose: 'kick', ball: { from: 'foot', d: [1, -6] } },
      { ms: 90, pose: 'kick', ball: { from: 'at', d: [54, 30] } },
      { ms: 90, pose: 'kick', ball: { from: 'at', d: [56, 8] } },
      { ms: 600, pose: 'fist' },
    ],
  },
  /** 헤딩: 웅크렸다 뛰어올라 머리로 받는다. */
  header: {
    loop: true,
    frames: [
      { ms: 260, sink: 1, ball: { from: 'head', d: [18, -22] } },
      { ms: 120, pose: 'tuck', lift: 2, shadow: 26, ball: { from: 'head', d: [18, -14] } },
      { ms: 160, pose: 'spread', lift: 3, shadow: 22, ball: { from: 'head', d: [18, -8] } },
      { ms: 120, pose: 'spread', lift: 2, shadow: 26, ball: { from: 'head', d: [30, -16] } },
      { ms: 160, sink: 1, ball: { from: 'head', d: [40, -24] } },
      { ms: 500 },
    ],
  },
  /** 주먹 세리머니. */
  fist: {
    loop: true,
    frames: [
      { ms: 300 },
      { ms: 200, pose: 'fist' },
      { ms: 160, pose: 'fist', sink: 1 },
      { ms: 200, pose: 'fist' },
      { ms: 160, pose: 'fist', sink: 1 },
    ],
  },
  /** 만세 점프. */
  banzai: {
    loop: true,
    frames: [
      { ms: 200, sink: 1, expr: 'happy' },
      { ms: 160, pose: 'jumpUp', lift: 2, shadow: 26 },
      { ms: 200, pose: 'jumpUp', lift: 3, shadow: 22 },
      { ms: 160, pose: 'jumpUp', lift: 1, shadow: 26 },
    ],
  },
  /** 무릎 슬라이딩. */
  slide: {
    loop: true,
    frames: [
      { ...RUN[0]! },
      { ...RUN[1]! },
      { ms: 160, pose: 'kneelOut', dust: true },
      { ms: 400, pose: 'kneelUp' },
      { ms: 400, pose: 'kneelFist' },
    ],
  },
  /** 관중에게 손 흔들기. */
  wave: {
    loop: true,
    frames: [
      { ms: 260, pose: 'waveHigh' },
      { ms: 260, pose: 'waveLow' },
    ],
  },
  /** 트로피 들기. */
  trophy: {
    loop: true,
    frames: [
      { ms: 300, pose: 'lift', trophy: true },
      { ms: 300, pose: 'lift', trophy: true, sparkle: true },
      { ms: 220, pose: 'lift', trophy: true, sink: 1 },
    ],
  },
  /** 좌절(무릎 꿇고 고개 숙임). */
  sad: {
    loop: true,
    frames: [
      { ms: 900, pose: 'sad' },
      { ms: 600, pose: 'sad', sink: 1 },
    ],
  },
} satisfies Record<string, Motion>;
export type MotionId = keyof typeof MOTIONS;
export const MOTION_IDS = Object.keys(MOTIONS) as MotionId[];

// ── 소품(실제 픽셀). O 바깥선, B/D 공 흰 · 검은 조각, y/Y 트로피 금 · 그늘, w 반짝임, u 흙먼지.
const BALL = ['.OOOO.', 'OBBDBO', 'OBDDBO', 'ODBBBO', 'OBBDBO', '.OOOO.'];
const TROPHY = [
  '..OOOOOOOOOO..',
  '.OyyyyyyyyyYO.',
  'OOyyyyyyyyyYOO',
  'OyOyyyyyyyYOyO',
  'OyOyyyyyyyYOyO',
  '.OOyyyyyyyYOO.',
  '...OyyyyyYO...',
  '....OyyyYO....',
  '.....OyYO.....',
  '.....OyYO.....',
  '....OYYYYO....',
  '...OyyyyyYO...',
  '...OOOOOOOO...',
];
const SPARKLE = ['..w..', '..w..', 'wwyww', '..w..', '..w..'];
const DUST = ['.u..u.', 'uu.uu.', '.uu..u'];
const PROP: Record<string, string> = {
  O: '#16171e',
  B: '#f4f4ef',
  D: '#1c1c1f',
  y: '#f0b437',
  Y: '#b8860b',
  w: '#fff6c8',
  u: '#c9b48a',
};
const SHADOW = 'rgba(0,0,0,.28)';

const stamp = (px: Px, art: readonly string[], x0: number, y0: number) =>
  art.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      const yy = y0 + y,
        xx = x0 + x;
      if (ch !== '.' && yy >= 0 && yy < FH && xx >= 0 && xx < FW) px[yy]![xx] = PROP[ch]!;
    }
  });

/** 칠한 격자의 from~to 줄을 dy만큼 옮긴다(빈 줄은 투명). */
function shiftRows(px: Px, from: number, to: number, dy: number) {
  const band = px.slice(from, to).map((r) => [...r]);
  for (let y = from; y < to; y++) px[y] = Array<string | null>(FW).fill(null);
  band.forEach((r, i) => {
    const y = from + i + dy;
    if (y < 0 || y >= FH) return;
    r.forEach((c, x) => {
      if (c) px[y]![x] = c;
    });
  });
}

/** 한 프레임 → 64×72 색 격자. poses가 아직 없으면(불러오는 중) 서 있는 그림으로 그린다. */
export function motionFrame(sp: AvatarSpec, f: MotionFrame, poses?: MiniPoses | null): Px {
  // 목발을 짚거나 은퇴식 소품을 든 선수는 준비 운동 대신 정지 자세로 둔다. 소품도 함께 보존한다.
  if (sp.acc.some((a) => a === 'crutch' || a === 'suit' || a === 'bouquet')) f = { ms: f.ms };
  const spec = f.expr !== undefined && sp.expr !== 'pain' ? { ...sp, expr: f.expr } : sp;
  const info = f.pose && poses ? poses[f.pose] : null;
  let px: Px;
  let face: Pt = [SX, SY];
  if (info) {
    face = info.face;
    const body: MiniBody = {
      crest: info.crest,
      arm: info.arm,
      wrists: [],
      ox: face[0],
      collarY: face[1] + 34,
    };
    px = paintMini(info.rows, spec, miniColors(spec), body, {
      stand: MINI_SPRITES[sp.hairStyle],
      at: face,
    });
  } else {
    const still = avatarPixels(spec);
    px = Array.from({ length: FH }, () => Array<string | null>(FW).fill(null));
    still.forEach((row, y) => row.forEach((c, x) => (px[SY + y]![SX + x] = c)));
  }
  // 몸 옮기기(논리 1칸 = 실제 2줄): 윗몸 내리기 → 몸 전체 올리기.
  const waist = face[1] + 44;
  if (f.sink) shiftRows(px, 0, waist, f.sink * 2);
  const lift = (f.lift ?? 0) * 2;
  if (lift) shiftRows(px, 0, FH, -lift);
  // 그림자(몸 뒤, 바닥에 남는다).
  const sw = f.shadow ?? 30;
  for (let y = FH - 3; y < FH - 1; y++)
    for (
      let x = (FW - sw) / 2 + (y === FH - 3 ? 2 : 0);
      x < (FW + sw) / 2 - (y === FH - 3 ? 2 : 0);
      x++
    )
      if (!px[y]![x]) px[y]![x] = SHADOW;
  // 소품(몸 앞).
  if (f.dust) {
    stamp(px, DUST, 6, FH - 6);
    stamp(px, DUST, FW - 12, FH - 6);
  }
  if (f.trophy) {
    const top = info?.top ?? [FW / 2, 12];
    stamp(px, TROPHY, top[0] - 7, top[1] - TROPHY.length - lift + (f.sink ?? 0) * 2);
  }
  if (f.sparkle) {
    stamp(px, SPARKLE, 4, 2);
    stamp(px, SPARKLE, FW - 9, 4);
  }
  if (f.ball) {
    const [dx, dy] = f.ball.d;
    const [bx, by] =
      f.ball.from === 'foot'
        ? [(info?.foot[0] ?? SX + 36) + dx, (info?.foot[1] ?? FH - 4) + dy - lift]
        : f.ball.from === 'head'
          ? [face[0] + dx, face[1] + dy - lift]
          : [dx, dy];
    stamp(px, BALL, bx, by);
  }
  return px;
}

/** 모션 → 프레임 색 격자 목록. */
export function motionFrames(sp: AvatarSpec, id: MotionId, poses?: MiniPoses | null): Px[] {
  return MOTIONS[id].frames.map((f) => motionFrame(sp, f, poses));
}

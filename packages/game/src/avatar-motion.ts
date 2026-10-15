// ───────── T-11-191 선수 모션 ─────────
// 모션은 자세(PNG 시트의 포즈, avatar-image.ts)와 시간의 목록이다. 점프 · 숨쉬기는 몸을 옮기고,
// 공 · 트로피 · 반짝임 · 흙먼지는 그 위에 얹는다. 프레임은 논리 32×36이고, 게임 RNG는 쓰지 않는다.
import { avatarRects, type AvatarSpec } from './avatar.js';

/** 머리 위 여유 줄(논리 칸). 프레임의 y = 서 있는 자세 y + MOTION_TOP. */
export const MOTION_TOP = 4;
/** 프레임 논리 크기(viewBox). 실제 픽셀은 두 배다. */
export const MOTION_W = 32;
export const MOTION_H = 36;
const FW = MOTION_W * 2;
const FH = MOTION_H * 2;

/** PNG 시트의 자세. stand는 카드와 같은 서 있는 그림이다. */
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
type Px = (string | null)[][];
type Pt = readonly [number, number];

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

const stamp = (px: Px, art: readonly string[], x0: number, y0: number) =>
  art.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]!;
      const yy = y0 + y,
        xx = x0 + x;
      if (ch !== '.' && yy >= 0 && yy < FH && xx >= 0 && xx < FW) px[yy]![xx] = PROP[ch]!;
    }
  });

/** Existing non-player dot props remain unchanged alongside the PNG player. Anchors use 32x36 units. */
export function motionDecorationRects(f: MotionFrame, at: { face: Pt; foot: Pt; top: Pt }) {
  const px: Px = Array.from({ length: FH }, () => Array<string | null>(FW).fill(null));
  if (f.dust) {
    stamp(px, DUST, 6, FH - 6);
    stamp(px, DUST, FW - 12, FH - 6);
  }
  if (f.sparkle) {
    stamp(px, SPARKLE, 4, 2);
    stamp(px, SPARKLE, FW - 9, 4);
  }
  const shift = (f.sink ?? 0) - (f.lift ?? 0);
  if (f.trophy)
    stamp(
      px,
      TROPHY,
      Math.round(at.top[0] * 2 - 7),
      Math.round((at.top[1] + shift) * 2 - TROPHY.length),
    );
  if (f.ball) {
    const base = f.ball.from === 'foot' ? at.foot : f.ball.from === 'head' ? at.face : [0, 0];
    stamp(
      px,
      BALL,
      Math.round(base[0]! * 2 + f.ball.d[0]),
      Math.round((base[1]! + shift) * 2 + f.ball.d[1]),
    );
  }
  return avatarRects(px);
}

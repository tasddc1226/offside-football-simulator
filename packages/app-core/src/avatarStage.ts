// T-11-191 진행 시트(프리시즌 준비) 위에서 내 도트 선수가 돌아다니는 연출(웹 ui/sheets/AvatarStage.svelte ·
// 앱 sheets/AvatarStage.tsx 공용). 무대 안 아무 곳으로 뛰어가거나 드리블해 간 뒤 그 자리에서 동작 하나를 하고,
// 다시 다른 곳으로 간다. 화면 연출이라 게임 RNG가 아니라 Math.random을 쓴다(결과에 영향 없음).
import { MOTIONS, type MotionId } from '@offside/game/avatar-motion';

export interface StageBeat {
  motion: MotionId;
  /** 이 동작이 끝날 때 선수 가운데의 가로 위치(무대 폭 비율 0~1). 제자리 동작은 앞 박자와 같다. */
  x: number;
  /** 왼쪽을 본다(그림을 좌우로 뒤집는다). */
  flip: boolean;
  ms: number;
  /** 전체 경기장 연출의 세로 위치와 박자. 일반 작은 무대에는 없다. */
  y?: number;
  step?: number;
}

/** 연출용 고정 동선. 게임 RNG나 결과와 무관하며 짧은 프리시즌에도 달리기→슈팅을 보여 준다. */
export const fieldBeat = (step = 0): StageBeat => {
  const beats: StageBeat[] = [
    { motion: 'idle', x: 0.32, y: 0.66, flip: false, ms: 120 },
    { motion: 'run', x: 0.66, y: 0.55, flip: false, ms: 600 },
    { motion: 'shoot', x: 0.66, y: 0.55, flip: false, ms: cycle('shoot') },
    { motion: 'dribble', x: 0.32, y: 0.72, flip: true, ms: 900 },
    { motion: 'juggle', x: 0.32, y: 0.72, flip: false, ms: cycle('juggle') * 2 },
    { motion: 'run', x: 0.55, y: 0.48, flip: false, ms: 700 },
    { motion: 'header', x: 0.55, y: 0.48, flip: false, ms: cycle('header') },
  ];
  return { ...beats[step % beats.length]!, step };
};

/** 제자리 동작. 우승 · 아쉬움(trophy · sad)은 준비 장면에 어울리지 않아 뺐다. */
const ACTS: MotionId[] = ['juggle', 'shoot', 'header', 'fist', 'banzai', 'wave', 'idle'];
/** 옮겨 가는 동작과 무대 폭을 가로지르는 데 걸리는 시간(ms). */
const MOVES: { motion: MotionId; across: number }[] = [
  { motion: 'run', across: 1500 },
  { motion: 'dribble', across: 2200 },
  { motion: 'slide', across: 900 },
];
const LEFT = 0.12;
const RIGHT = 0.88;

const cycle = (id: MotionId) => MOTIONS[id].frames.reduce((t, f) => t + f.ms, 0);

/** 첫 박자: 가운데에서 숨 고르기. */
export const firstBeat = (): StageBeat => ({ motion: 'idle', x: 0.5, flip: false, ms: 400 });

/** 다음 박자. 옮겨 갔으면 제자리 동작, 제자리 동작을 했으면 다른 곳으로 옮겨 간다. */
export function nextBeat(prev: StageBeat, rand: () => number = Math.random): StageBeat {
  const moved = MOVES.some((m) => m.motion === prev.motion);
  if (!moved) {
    const m = MOVES[Math.floor(rand() * MOVES.length)]!;
    // 너무 가까운 곳은 고르지 않는다(무대 폭의 25% 이상 옮겨 간다). 슬라이딩은 짧게.
    const span = m.motion === 'slide' ? 0.3 : RIGHT - LEFT;
    let x = prev.x;
    for (let i = 0; i < 6 && Math.abs(x - prev.x) < 0.25; i++)
      x = Math.min(RIGHT, Math.max(LEFT, prev.x + (rand() * 2 - 1) * span));
    if (Math.abs(x - prev.x) < 0.25) x = prev.x < 0.5 ? prev.x + 0.3 : prev.x - 0.3;
    return {
      motion: m.motion,
      x,
      flip: x < prev.x,
      ms: Math.round(Math.abs(x - prev.x) * m.across),
    };
  }
  const motion = ACTS[Math.floor(rand() * ACTS.length)]!;
  // 짧은 동작은 두 번 되풀이한다.
  const one = cycle(motion);
  return { motion, x: prev.x, flip: prev.flip, ms: one < 900 ? one * 2 : one };
}

/** Viewport-shaped pitch markings; circles stay circular on narrow and wide screens. */
export function fieldGeometry(width: number, height: number) {
  const w = Math.max(1, width),
    h = Math.max(1, height);
  const p = Math.min(w, h) * 0.05;
  const wide = w > h;
  return {
    w,
    h,
    p,
    halfway: wide ? `M${w / 2} ${p}V${h - p}` : `M${p} ${h / 2}H${w - p}`,
    radius: Math.min(w, h) * 0.14,
    boxes: wide
      ? [
          { x: p, y: h * 0.27, w: w * 0.16, h: h * 0.46 },
          { x: w * 0.84 - p, y: h * 0.27, w: w * 0.16, h: h * 0.46 },
        ]
      : [
          { x: w * 0.27, y: p, w: w * 0.46, h: h * 0.16 },
          { x: w * 0.27, y: h * 0.84 - p, w: w * 0.46, h: h * 0.16 },
        ],
  };
}

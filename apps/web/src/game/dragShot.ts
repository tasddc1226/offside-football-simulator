// ───────── 드래그 슛 (T-10-089 프로토타입) ─────────
// 페널티킥을 손가락으로 찬다. 공에서 골문 쪽으로 끌어 올린 경로에서 방향·강도·정확성을 뽑아 공이 닿는 자리를
// 정하고, 골문 안이면서 키퍼 손이 닿지 않으면 골이다. 능력치(성공 확률 p)는 흩어짐과 키퍼가 닿는 범위를 줄인다.
// 키퍼가 어느 쪽으로 뛸지만 운이다. 좌표는 미니게임 장면(viewBox 300×170)과 같다.

/** 드래그 경로의 한 점(장면 좌표, ms). */
export type DragPoint = { x: number; y: number; t: number };

export type ShotOutcome = 'goal' | 'saved' | 'post' | 'over' | 'wide' | 'late';
export interface ShotResult {
  ok: boolean;
  outcome: ShotOutcome;
  /** 공이 닿은 자리(장면 좌표). */
  x: number;
  y: number;
  /** 키퍼가 뛴 쪽(-1 왼쪽 · 0 가운데 · 1 오른쪽). */
  keeper: -1 | 0 | 1;
  /** 1이 가장 좋은 세기(0.6 미만은 약하고, 1.3을 넘으면 뜬다). */
  power: number;
  /** 경로가 곧은 정도(1 = 완전한 직선). */
  straight: number;
}

/** 골대 안쪽(장면 좌표). */
export const GOAL = { left: 70, right: 230, top: 28, bottom: 112 } as const;
/** 페널티 지점. */
export const SPOT = { x: 150, y: 148 } as const;
/** 이만큼(장면 단위)은 끌어야 슛으로 본다. */
export const MIN_DRAG = 24;
/** 세기 1에 해당하는 손가락 속도(장면 단위/ms). 마지막 FLICK_MS 동안의 속도를 잰다. */
const REF_SPEED = 1.1;
const FLICK_MS = 110;

/** 제한 시간 안에 차지 않았다(실패). */
export const lateShot = (): ShotResult => ({
  ok: false,
  outcome: 'late',
  x: SPOT.x,
  y: SPOT.y,
  keeper: 0,
  power: 0,
  straight: 0,
});

/** 드래그가 슛이 되는지 — 충분히 길고 위쪽(골문 쪽)으로 끌었는가. */
export function isShot(path: readonly DragPoint[]): boolean {
  if (path.length < 2) return false;
  const a = path[0]!,
    b = path.at(-1)!;
  return a.y - b.y >= MIN_DRAG * 0.7 && Math.hypot(b.x - a.x, b.y - a.y) >= MIN_DRAG;
}

/** 경로에서 방향(겨냥 x)·세기·곧은 정도를 뽑는다. */
export function readDrag(path: readonly DragPoint[]) {
  const a = path[0]!,
    b = path.at(-1)!;
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len = Math.hypot(dx, dy);
  // 겨냥: 끈 방향을 골라인까지 연장한다. 45°로 끌면 골대 밖(가운데에서 110)이다.
  const aimX = SPOT.x + (dx / Math.max(1, -dy)) * 110;
  // 세기: 손을 떼기 직전의 속도(튕기듯 끌수록 세다).
  const tail = path.filter((p) => b.t - p.t <= FLICK_MS);
  const from = tail[0] ?? a;
  const dt = Math.max(16, b.t - from.t);
  const speed = Math.hypot(b.x - from.x, b.y - from.y) / dt;
  const power = speed / REF_SPEED;
  // 곧은 정도: 경로가 시작–끝 직선에서 가장 멀리 벗어난 거리 ÷ 길이.
  let dev = 0;
  for (const p of path)
    dev = Math.max(dev, Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / (len || 1));
  const straight = Math.max(0, 1 - dev / (len || 1));
  return { aimX, power, straight };
}

/** 정규분포 난수(Box–Muller). */
function gauss(rand: () => number): number {
  const u = Math.max(1e-9, rand());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/**
 * 슛 판정. p: 능력치로 정해진 성공 확률(선택 창의 %). rand: 흩어짐과 키퍼 방향에 쓰는 난수 — 화면 연출이라
 * 게임 RNG가 아니라 Math.random을 넘긴다(테스트는 고정값).
 */
export function evalShot(
  path: readonly DragPoint[],
  p: number,
  rand: () => number = Math.random,
): ShotResult {
  return judgeShot(readDrag(path), p, rand);
}

/** 방향·세기·곧은 정도로 판정한다(evalShot의 본체 — 보정 시뮬레이션이 경로 없이 부른다). */
export function judgeShot(
  { aimX, power, straight }: ReturnType<typeof readDrag>,
  p: number,
  rand: () => number = Math.random,
): ShotResult {
  const skill = Math.min(1, Math.max(0, p));
  // 높이: 세기 1이면 골대 위쪽 3분의 1쯤, 1.3을 넘으면 크로스바 위로 뜬다.
  const aimY = GOAL.bottom - power * 0.77 * (GOAL.bottom - GOAL.top);
  // 흩어짐: 능력치가 낮을수록, 경로가 휠수록, 너무 세게 찰수록 커진다.
  const spread =
    (3 + 12 * (1 - skill)) * (1 + 3 * (1 - straight)) * (1 + Math.max(0, power - 1) * 1.5);
  const x = aimX + gauss(rand) * spread;
  const y = aimY + gauss(rand) * spread * 0.6;
  const k = rand();
  const keeper: -1 | 0 | 1 = k < 0.35 ? -1 : k < 0.7 ? 1 : 0;
  const base = { x, y, keeper, power, straight };

  if (x < GOAL.left - 3 || x > GOAL.right + 3) return { ...base, ok: false, outcome: 'wide' };
  if (y < GOAL.top - 3) return { ...base, ok: false, outcome: 'over' };
  if (x < GOAL.left + 3 || x > GOAL.right - 3 || y < GOAL.top + 3)
    return { ...base, ok: false, outcome: 'post' };

  // 키퍼: 뛴 쪽(가운데면 제자리)에서 손이 닿는 거리. 능력치가 높을수록 좁고, 약한 슛일수록 넓다.
  const reach = (16 + 30 * (1 - skill)) * (1 + Math.max(0, 0.75 - power) * 2.2);
  // 제자리에 선 키퍼는 몸통과 두 팔로 가운데를 넓게 막고, 옆으로 뛴 키퍼는 가운데 낮은 공만 남은 발로 걷어낸다.
  const kx = SPOT.x + keeper * 44,
    ky = keeper ? 70 : 74;
  const saved =
    Math.hypot((x - kx) * 0.85, y - ky) < reach * (keeper ? 1 : 1.45) ||
    (keeper !== 0 && Math.abs(x - SPOT.x) < 14 && y > 94);
  return { ...base, ok: !saved, outcome: saved ? 'saved' : 'goal' };
}

// T-11-600 라운지 필드 — 쿼터뷰 축구장에서 아바타가 걷고 공을 찬다. 화면 없이 도는 순수 계산만 둔다(그리기는 draw.ts).
// 좌표는 미터 단위 월드 좌표다. x는 골대에서 골대 방향, y는 터치라인에서 터치라인 방향, z는 높이.

import type { Ctx2D } from './canvas.js';
import type { EmoteKey } from './emotes.js';

/** 경기장 크기(실제보다 작게 — 30명이 모여도 서로 보이게). */
export const PITCH_L = 36;
export const PITCH_W = 24;
/** 터치라인 밖으로 걸어 다닐 수 있는 여백. */
export const APRON = 3;
export const GOAL_W = 5;
export const GOAL_H = 1.8;
const BALL_R = 0.22;
const WALK = 5;
const KICK_REACH = 1.3;
const FRICTION = 1.4;
const GRAVITY = 18;

export interface Kit {
  body: string;
  sleeve: string;
  shorts: string;
  socks: string;
  skin: string;
  hair: string;
}

export interface Actor {
  id: string;
  name: string;
  kit: Kit;
  x: number;
  y: number;
  /** 바라보는 방향(월드 단위 벡터). */
  fx: number;
  fy: number;
  /** 지금 움직이는 속도(월드). */
  vx: number;
  vy: number;
  /** 클릭으로 정한 목적지. */
  target: { x: number; y: number } | null;
  /** 걸음 애니메이션 위상. */
  step: number;
  bubble: { text: string; until: number } | null;
  emote: { key: EmoteKey; until: number } | null;
  /** 남의 아바타가 쉬었다 다시 걷는 시각. */
  idleUntil: number;
  /** 1인칭으로 볼 때는 뒤로 걸어도 바라보는 쪽을 바꾸지 않는다. */
  lockFace: boolean;
  /** 태클 · 개인기 동작. (dx, dy)는 시작할 때 바라본 쪽, side는 도는 · 빠지는 쪽(±1), ball은 공을 데리고 하는지. */
  move: {
    kind: MoveKind;
    start: number;
    until: number;
    dx: number;
    dy: number;
    side: 1 | -1;
    ball: boolean;
  } | null;
  /** 다음 동작을 할 수 있는 시각. */
  readyAt: number;
  /** 태클에 걸려 넘어져 있는 동안은 움직이지 못한다. */
  fallUntil: number;
  /** 개인기를 돌아가며 고르는 순번. */
  trickN: number;
  /** T-11-600 서버에서 받은 남의 위치 · 바라보는 쪽. 있으면 거닐지 않고 이 자리로 부드럽게 따라간다. */
  net: { x: number; y: number; fx: number; fy: number } | null;
}

export type MoveKind = 'tackle' | TrickKind;
export const TRICKS = ['flick', 'spin', 'stepover'] as const;
export type TrickKind = (typeof TRICKS)[number];
const MOVE_MS: Record<MoveKind, number> = { tackle: 520, flick: 520, spin: 620, stepover: 460 };
const FALL_MS = 1100;

export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface World {
  actors: Map<string, Actor>;
  ball: Ball;
  /** 골이 들어가면 축하를 보여 주고 공을 가운데로 돌린다. */
  /** by · byId는 마지막으로 공을 만진 선수 이름 · 아이디(없으면 null). */
  goal: { side: 0 | 1; until: number; by: string | null; byId: string | null } | null;
  /** 마지막으로 공을 건드린 아바타. */
  touch: string | null;
  /**
   * T-11-600 이 화면이 골을 정하는지(마지막 터치가 나 · 봇 · 아무도 아님). 남이 건드린 공이 들어가면 그 사람
   * 화면이 정한 골을 서버에서 받을 때까지 골망에 둔다. 기본은 모두 이 화면이 정한다.
   */
  localGoal: (touch: string | null) => boolean;
  /** 남이 건드린 공이 골망에 들어간 시각(서버 골이 안 오면 잠시 뒤 가운데로 돌린다). */
  netAt: number;
}

const KITS: Kit[] = [
  {
    body: '#d7263d',
    sleeve: '#d7263d',
    shorts: '#ffffff',
    socks: '#d7263d',
    skin: '#f1c7a5',
    hair: '#2b1b12',
  },
  {
    body: '#1d4ed8',
    sleeve: '#1d4ed8',
    shorts: '#ffffff',
    socks: '#1d4ed8',
    skin: '#e0ac85',
    hair: '#1a1a1a',
  },
  {
    body: '#facc15',
    sleeve: '#111827',
    shorts: '#111827',
    socks: '#facc15',
    skin: '#c68b62',
    hair: '#120c08',
  },
  {
    body: '#ffffff',
    sleeve: '#ffffff',
    shorts: '#111827',
    socks: '#ffffff',
    skin: '#f3d2b5',
    hair: '#6b3e1e',
  },
  {
    body: '#16a34a',
    sleeve: '#ffffff',
    shorts: '#16a34a',
    socks: '#16a34a',
    skin: '#8d5a3b',
    hair: '#0d0905',
  },
  {
    body: '#6d28d9',
    sleeve: '#6d28d9',
    shorts: '#f8fafc',
    socks: '#6d28d9',
    skin: '#f1c7a5',
    hair: '#d4a24c',
  },
  {
    body: '#0ea5e9',
    sleeve: '#0ea5e9',
    shorts: '#0f172a',
    socks: '#0ea5e9',
    skin: '#e8b48f',
    hair: '#3a2416',
  },
  {
    body: '#f97316',
    sleeve: '#111827',
    shorts: '#111827',
    socks: '#f97316',
    skin: '#a86f4c',
    hair: '#140d09',
  },
  {
    body: '#111827',
    sleeve: '#111827',
    shorts: '#111827',
    socks: '#e11d48',
    skin: '#f3d2b5',
    hair: '#8a5a2b',
  },
  {
    body: '#e11d48',
    sleeve: '#ffffff',
    shorts: '#1e3a8a',
    socks: '#e11d48',
    skin: '#c68b62',
    hair: '#1a1a1a',
  },
];

/** 같은 작성자는 늘 같은 값이 나오게 하는 작은 해시. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 구단 유니폼을 받기 전까지는 작성자 키로 유니폼을 고른다. */
export const kitFor = (id: string): Kit => KITS[hash(id) % KITS.length]!;

const minX = -APRON;
const maxX = PITCH_L + APRON;
const minY = -APRON;
const maxY = PITCH_W + APRON;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function createWorld(): World {
  return {
    actors: new Map(),
    ball: centerBall(),
    goal: null,
    touch: null,
    localGoal: () => true,
    netAt: 0,
  };
}

const centerBall = (): Ball => ({ x: PITCH_L / 2, y: PITCH_W / 2, z: 0, vx: 0, vy: 0, vz: 0 });

/** 작성자 키로 정한 자리(처음 들어올 때). 가운데 원은 비워 둔다. */
export function spawnPoint(id: string) {
  const h = hash(id);
  const x = 4 + ((h % 1000) / 1000) * (PITCH_L - 8);
  const y = 3 + (((h >>> 10) % 1000) / 1000) * (PITCH_W - 6);
  return { x, y };
}

export function addActor(world: World, id: string, name: string, at = spawnPoint(id)): Actor {
  const old = world.actors.get(id);
  if (old) {
    old.name = name;
    return old;
  }
  const a: Actor = {
    id,
    name,
    kit: kitFor(id),
    x: at.x,
    y: at.y,
    fx: 1,
    fy: 1,
    vx: 0,
    vy: 0,
    target: null,
    step: 0,
    bubble: null,
    emote: null,
    idleUntil: 0,
    lockFace: false,
    move: null,
    readyAt: 0,
    fallUntil: 0,
    trickN: 0,
    net: null,
  };
  world.actors.set(id, a);
  return a;
}

/** 키보드 · 조이스틱 입력(-1..1)을 그 아바타의 속도로 둔다. 입력이 있으면 목적지는 버린다. */
export function steer(a: Actor, dx: number, dy: number) {
  const n = Math.hypot(dx, dy);
  if (n < 0.05) {
    if (!a.target) a.vx = a.vy = 0;
    return;
  }
  const k = Math.min(1, n) / n;
  a.target = null;
  a.vx = dx * k * WALK;
  a.vy = dy * k * WALK;
}

export function walkTo(a: Actor, x: number, y: number) {
  a.target = { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) };
}

/** 가까우면 바라보는 쪽으로 공을 찬다. 찼으면 true. */
export function kick(world: World, a: Actor): boolean {
  const b = world.ball;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d > KICK_REACH || b.z > 1) return false;
  // 공 쪽을 보고 있으면 공 쪽으로, 아니면 바라보는 쪽으로 찬다.
  const fn = Math.hypot(a.fx, a.fy) || 1;
  let ux = a.fx / fn;
  let uy = a.fy / fn;
  if (d > 0.05 && (dx * ux + dy * uy) / d < 0.3) {
    ux = dx / d;
    uy = dy / d;
  }
  b.vx = ux * 15;
  b.vy = uy * 15;
  b.vz = 4.5;
  world.touch = a.id;
  return true;
}

/** 동작 진행도(0~1). 동작 중이 아니면 0. */
export function moveT(a: Actor, now: number) {
  const m = a.move;
  return m ? clamp((now - m.start) / (m.until - m.start), 0, 1) : 0;
}
const canAct = (a: Actor, now: number) => !a.move && now >= a.readyAt && now >= a.fallUntil;
function facing(a: Actor): [number, number] {
  const n = Math.hypot(a.fx, a.fy) || 1;
  return [a.fx / n, a.fy / n];
}
const ballNear = (world: World, a: Actor) =>
  world.ball.z < 0.8 && Math.hypot(world.ball.x - a.x, world.ball.y - a.y) < KICK_REACH;

/** 바라보는 쪽으로 미끄러지며 태클한다. 공은 쳐 내고, 닿은 선수는 넘어진다. 시작했으면 true. */
export function tackle(world: World, a: Actor, now: number, remote = false): boolean {
  // remote: 남이 한 태클을 받아 그대로 보여 준다(쿨다운 · 골 축하 중이어도).
  if (!remote && (!canAct(a, now) || world.goal)) return false;
  const [dx, dy] = facing(a);
  a.target = null;
  a.move = {
    kind: 'tackle',
    start: now,
    until: now + MOVE_MS.tackle,
    dx,
    dy,
    side: 1,
    ball: false,
  };
  a.readyAt = a.move.until + 450;
  return true;
}

/** 개인기: 레인보우 플릭 → 마르세유 턴 → 헛다리 순서로 돌아간다. 공이 가까우면 공을 데리고 한다. */
export function trick(
  world: World,
  a: Actor,
  now: number,
  remote?: { kind: TrickKind; side: 1 | -1 },
): TrickKind | null {
  // remote: 남이 한 개인기를 받아 같은 동작 · 같은 쪽으로 보여 준다.
  if (!remote && !canAct(a, now)) return null;
  const kind = remote?.kind ?? TRICKS[a.trickN++ % TRICKS.length]!;
  const [dx, dy] = facing(a);
  const ball = ballNear(world, a) && !world.goal;
  a.target = null;
  a.move = {
    kind,
    start: now,
    until: now + MOVE_MS[kind],
    dx,
    dy,
    side: remote?.side ?? (Math.random() < 0.5 ? 1 : -1),
    ball,
  };
  a.readyAt = a.move.until + 250;
  if (ball && kind === 'flick') {
    // 뒤꿈치로 공을 떠 올려 머리 위로 넘긴다: 내 바로 뒤에서 떠서 앞쪽에 떨어진다.
    const b = world.ball;
    b.x = a.x - dx * 0.25;
    b.y = a.y - dy * 0.25;
    b.z = 0.3;
    b.vx = dx * 4.6;
    b.vy = dy * 4.6;
    b.vz = 7.4;
    world.touch = a.id;
  }
  return kind;
}

/** 헛다리 뒤 빠져나가는 쪽(바라보는 쪽에서 side 쪽으로 비스듬히). */
function burstDir(m: NonNullable<Actor['move']>): [number, number] {
  const x = m.dx - m.dy * m.side * 1.1;
  const y = m.dy + m.dx * m.side * 1.1;
  const n = Math.hypot(x, y) || 1;
  return [x / n, y / n];
}

function stepMove(world: World, a: Actor, now: number) {
  const m = a.move!;
  const b = world.ball;
  if (now >= m.until) {
    a.move = null;
    if (m.kind === 'tackle') a.vx = a.vy = 0;
    if (m.ball && m.kind === 'spin') {
      b.vx = m.dx * 5.5;
      b.vy = m.dy * 5.5;
    }
    if (m.ball && m.kind === 'stepover') {
      const [ux, uy] = burstDir(m);
      b.vx = ux * 7;
      b.vy = uy * 7;
    }
    return;
  }
  const t = moveT(a, now);
  const glue = (ux: number, uy: number, r = 0.55) => {
    b.x = a.x + ux * r;
    b.y = a.y + uy * r;
    b.z = 0;
    b.vx = a.vx;
    b.vy = a.vy;
    b.vz = 0;
    world.touch = a.id;
  };
  if (m.kind === 'tackle') {
    const speed = 9 * (1 - t * 0.75);
    a.vx = m.dx * speed;
    a.vy = m.dy * speed;
    // 뻗은 발 앞에 공이 있으면 쳐 낸다.
    const fx = a.x + m.dx * 0.6;
    const fy = a.y + m.dy * 0.6;
    if (b.z < 0.7 && Math.hypot(b.x - fx, b.y - fy) < 0.85) {
      b.vx = m.dx * 9 + b.vx * 0.2;
      b.vy = m.dy * 9 + b.vy * 0.2;
      b.vz = 1.8;
      world.touch = a.id;
    }
    for (const o of world.actors.values()) {
      if (o === a || now < o.fallUntil || Math.hypot(o.x - fx, o.y - fy) > 0.8) continue;
      o.fallUntil = now + FALL_MS;
      o.move = null;
      o.target = null;
      o.vx = o.vy = 0;
    }
  } else if (m.kind === 'spin') {
    // 마르세유 턴: 공을 발밑에 붙인 채 한 바퀴 돌며 앞으로 나아간다.
    a.vx = m.dx * 3;
    a.vy = m.dy * 3;
    if (m.ball) {
      const ang = m.side * t * Math.PI * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      glue(m.dx * c - m.dy * s, m.dx * s + m.dy * c, 0.5);
    }
  } else if (m.kind === 'stepover') {
    // 헛다리: 제자리에서 두 번 속이고 비스듬히 치고 나간다.
    if (t < 0.55) a.vx = a.vy = 0;
    else {
      const [ux, uy] = burstDir(m);
      a.vx = ux * 6.5;
      a.vy = uy * 6.5;
    }
    if (m.ball) glue(...(t < 0.55 ? ([m.dx, m.dy] as [number, number]) : burstDir(m)));
  }
}

/** 남의 아바타 — 진짜 위치를 받기 전까지는 근처를 천천히 거닌다. */
function wander(a: Actor, now: number) {
  if (a.target || now < a.idleUntil) return;
  const h = hash(`${a.id}:${Math.floor(now / 1000)}`);
  if (h % 3) {
    a.idleUntil = now + 1500 + (h % 3000);
    return;
  }
  const r = 2 + (h % 5);
  const ang = ((h >>> 8) % 628) / 100;
  walkTo(a, a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r);
}

/** dt초만큼 진행한다. mine은 내가 움직이는 아바타(거닐지 않는다). 골이 들어가면 그 쪽을 돌려준다. */
export function stepWorld(
  world: World,
  dt: number,
  now: number,
  mine: string | null,
): 0 | 1 | null {
  for (const a of world.actors.values()) {
    if (now < a.fallUntil) {
      a.vx = a.vy = 0;
      a.target = null;
      a.step = 0;
      continue;
    }
    if (a.move) {
      stepMove(world, a, now);
      if (a.move && a.move.kind !== 'flick') a.target = null;
    }
    if (a.net && !a.move) chase(a);
    else if (a.id !== mine && !a.move && !a.net) wander(a, now);
    if (a.target) {
      const dx = a.target.x - a.x;
      const dy = a.target.y - a.y;
      const d = Math.hypot(dx, dy);
      const speed = a.id === mine ? WALK : WALK * 0.45;
      if (d < 0.1) {
        a.target = null;
        a.vx = a.vy = 0;
      } else {
        a.vx = (dx / d) * speed;
        a.vy = (dy / d) * speed;
      }
    }
    const moving = Math.hypot(a.vx, a.vy) > 0.01;
    if (moving) {
      a.x = clamp(a.x + a.vx * dt, minX, maxX);
      a.y = clamp(a.y + a.vy * dt, minY, maxY);
      if (!a.lockFace && (!a.move || a.move.kind === 'flick' || a.move.kind === 'stepover')) {
        a.fx = a.vx;
        a.fy = a.vy;
      }
      a.step = a.move?.kind === 'tackle' ? 0 : a.step + dt * 10;
      if (!a.move || a.move.kind === 'flick') dribble(world, a);
    } else a.step = 0;
  }
  return stepBall(world, dt, now);
}

/**
 * 한 프레임만큼 월드를 돌린다. 프레임이 느린 기기에서도 걷기 · 공 속도가 같도록 0.05초씩 나눠 돌린다
 * (멈췄다 돌아온 탭처럼 너무 긴 간격은 0.25초까지만). 골이 나면 그 골대를 돌려준다.
 */
export function stepFrame(
  world: World,
  dt: number,
  now: number,
  mine: string | null,
): 0 | 1 | null {
  const total = Math.min(0.25, Math.max(0, dt));
  const n = Math.max(1, Math.ceil(total / 0.05));
  let goal: 0 | 1 | null = null;
  for (let i = 0; i < n; i++) {
    const g = stepWorld(world, total / n, now, mine);
    if (g !== null) goal = g;
  }
  return goal;
}

/** T-11-600 서버에서 받은 남의 자리로 따라간다: 멀면 순간 이동, 가까우면 0.15초 안에 닿을 속도로 걷는다. */
function chase(a: Actor) {
  const n = a.net!;
  const dx = n.x - a.x;
  const dy = n.y - a.y;
  const d = Math.hypot(dx, dy);
  a.target = null;
  if (d > 4) {
    a.x = n.x;
    a.y = n.y;
    a.vx = a.vy = 0;
  } else if (d < 0.04) {
    a.vx = a.vy = 0;
  } else {
    const speed = Math.min(WALK * 1.6, d / 0.15);
    a.vx = (dx / d) * speed;
    a.vy = (dy / d) * speed;
    return;
  }
  a.fx = n.fx;
  a.fy = n.fy;
}

/** 걷다가 공에 닿으면 앞으로 툭 민다. */
function dribble(world: World, a: Actor) {
  const b = world.ball;
  if (b.z > 0.5) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const reach = 0.45 + BALL_R;
  if (d >= reach) return;
  const v = Math.hypot(a.vx, a.vy);
  const ux = d > 0.01 ? dx / d : a.vx / v;
  const uy = d > 0.01 ? dy / d : a.vy / v;
  b.x = a.x + ux * reach;
  b.y = a.y + uy * reach;
  const speed = Math.max(b.vx * ux + b.vy * uy, v * 1.25);
  b.vx = speed * ux;
  b.vy = speed * uy;
  world.touch = a.id;
}

function stepBall(world: World, dt: number, now: number): 0 | 1 | null {
  const b = world.ball;
  if (world.goal) {
    if (now < world.goal.until) {
      b.vx *= 0.9;
      b.vy *= 0.9;
    } else {
      world.goal = null;
      world.ball = centerBall();
      world.touch = null;
    }
  }
  const px = b.x;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  if (b.z <= 0) {
    b.z = 0;
    b.vz = b.vz < -2 ? -b.vz * 0.45 : 0;
  } else b.vz -= GRAVITY * dt;
  // 땅에 있으면 구름 마찰로 멈춘다.
  const f = b.z > 0 ? 0.2 : FRICTION;
  const k = Math.max(0, 1 - f * dt);
  b.vx *= k;
  b.vy *= k;
  if (Math.hypot(b.vx, b.vy) < 0.05) b.vx = b.vy = 0;

  // 골: 골대 사이로 골라인을 넘었다.
  const mouth = Math.abs(b.y - PITCH_W / 2) < GOAL_W / 2;
  if (!world.goal && mouth && b.z < GOAL_H) {
    const side = px >= 0 && b.x < 0 ? 0 : px <= PITCH_L && b.x > PITCH_L ? 1 : null;
    if (side !== null) {
      if (world.localGoal(world.touch)) return scored(world, side, now);
      // 남이 건드린 공: 그 사람 화면의 골을 기다린다.
      world.netAt = now;
    }
  }
  // 서버 골이 3초 안에 안 오면 공을 가운데로 돌린다.
  if (world.netAt && !world.goal && now - world.netAt > 3000) {
    world.netAt = 0;
    world.ball = centerBall();
    world.touch = null;
    return null;
  }
  // 골망 안이면 골망에서 멈추고, 밖이면 걸어 다니는 구역 가장자리에서 튕긴다.
  const inNet = mouth && (b.x < 0 || b.x > PITCH_L);
  const lo = inNet ? -1.2 : minX + BALL_R;
  const hi = inNet ? PITCH_L + 1.2 : maxX - BALL_R;
  if (b.x < lo || b.x > hi) {
    b.x = clamp(b.x, lo, hi);
    b.vx = inNet ? 0 : -b.vx * 0.5;
  }
  if (inNet) b.y = clamp(b.y, PITCH_W / 2 - GOAL_W / 2 + BALL_R, PITCH_W / 2 + GOAL_W / 2 - BALL_R);
  else if (b.y < minY + BALL_R || b.y > maxY - BALL_R) {
    b.y = clamp(b.y, minY + BALL_R, maxY - BALL_R);
    b.vy = -b.vy * 0.5;
  }
  return null;
}

function scored(world: World, side: 0 | 1, now: number): 0 | 1 {
  const scorer = world.touch ? world.actors.get(world.touch) : undefined;
  world.goal = { side, until: now + 2200, by: scorer?.name ?? null, byId: scorer?.id ?? null };
  return side;
}

/** T-11-600 서버가 알린 남의 골을 보여 준다(이미 같은 골을 보여 주는 중이면 그대로). */
export function remoteGoal(world: World, side: 0 | 1, id: string, name: string, now: number) {
  if (world.goal && world.goal.byId === id) return;
  world.netAt = 0;
  world.touch = id;
  world.goal = { side, until: now + 2200, by: name, byId: id };
  // 골망 안에 공을 둔다(내 화면에서 아직 안 들어갔어도).
  world.ball = { x: side ? PITCH_L + 0.8 : -0.8, y: PITCH_W / 2, z: 0, vx: 0, vy: 0, vz: 0 };
}

/** 카메라. k는 월드 1미터가 화면에서 차지하는 반폭(px), rot은 경기장을 도는 각(라디안, π/4가 기본 쿼터뷰),
 * tilt는 내려다보는 정도(0.5가 기본, 1에 가까울수록 하늘에서 내려다본다). fp가 참이면 eye 자리에서 yaw 쪽을 보는
 * 1인칭 원근 시점이다(k는 쓰지 않고 fov로 확대한다). */
export interface View {
  k: number;
  rot: number;
  tilt: number;
  /** 화면 가운데에 올 월드 좌표. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  fp: boolean;
  eye: { x: number; y: number; yaw: number };
  fov: number;
}

/** 1인칭 눈높이 · 내려다보는 각 · 이보다 가까운 것은 자른다. */
const EYE_Z = 1.6;
const FP_PITCH = 0.12;
const NEAR = 0.25;

/** 월드 (dx, dy)를 화면 가로(u) · 깊이(d) 축으로 돌린다. 깊이가 클수록 화면 아래(카메라 쪽)다. */
export function rotate(v: Pick<View, 'rot'>, dx: number, dy: number) {
  const c = Math.cos(v.rot);
  const s = Math.sin(v.rot);
  return { u: dx * c - dy * s, d: dx * s + dy * c };
}

/** 1인칭 카메라 좌표: right(화면 오른쪽) · up · depth(앞으로 얼마나 먼가). */
function camSpace(v: View, x: number, y: number, z: number) {
  const fx = Math.cos(v.eye.yaw);
  const fy = Math.sin(v.eye.yaw);
  const rx = x - v.eye.x;
  const ry = y - v.eye.y;
  const rz = z - EYE_Z;
  // 쿼터뷰와 같은 손잡이: 앞이 (fx, fy)면 화면 오른쪽은 (-fy, fx).
  const right = rx * -fy + ry * fx;
  const fwd = rx * fx + ry * fy;
  const c = Math.cos(FP_PITCH);
  const s = Math.sin(FP_PITCH);
  return { right, up: fwd * s + rz * c, depth: fwd * c - rz * s };
}

const focal = (v: View) => Math.min(v.w, v.h * 1.4) * 0.75 * v.fov;

function projectCam(v: View, c: { right: number; up: number; depth: number }) {
  const f = focal(v) / c.depth;
  return { sx: v.w / 2 + c.right * f, sy: v.h * 0.45 - c.up * f, s: f, ok: c.depth > NEAR };
}

/** 그리는 순서용 깊이(작을수록 멀다). */
export const depthOf = (v: View, x: number, y: number) =>
  v.fp ? -camSpace(v, x, y, 0).depth : rotate(v, x, y).d;

export const zScale = (tilt: number) => Math.sqrt(1 - tilt * tilt) * 1.27;

/** 화면 위치와 그 자리의 축척 s(월드 1미터가 몇 px인지). ok가 거짓이면 카메라 뒤라 그리지 않는다. */
export function toScreen(v: View, x: number, y: number, z = 0) {
  if (v.fp) return projectCam(v, camSpace(v, x, y, z));
  const { u, d } = rotate(v, x - v.cx, y - v.cy);
  const S = v.k * Math.SQRT2;
  return {
    sx: v.w / 2 + u * S,
    sy: v.h / 2 + d * S * v.tilt - z * v.k * zScale(v.tilt),
    s: v.k,
    ok: true,
  };
}

type P3 = readonly [number, number, number];

/** 월드 점들로 경로를 만든다. 1인칭이면 카메라 앞쪽만 남게 잘라낸다. 그릴 게 없으면 false. */
export function tracePath(ctx: Ctx2D, v: View, pts: readonly P3[], close = true): boolean {
  ctx.beginPath();
  if (!v.fp) {
    pts.forEach(([x, y, z], i) => {
      const p = toScreen(v, x, y, z);
      if (i) ctx.lineTo(p.sx, p.sy);
      else ctx.moveTo(p.sx, p.sy);
    });
    if (close) ctx.closePath();
    return pts.length > 1;
  }
  const cs = pts.map(([x, y, z]) => camSpace(v, x, y, z));
  const cut = (a: (typeof cs)[number], b: (typeof cs)[number]) => {
    const t = (NEAR - a.depth) / (b.depth - a.depth);
    return { right: a.right + (b.right - a.right) * t, up: a.up + (b.up - a.up) * t, depth: NEAR };
  };
  if (close) {
    // 서덜랜드-호지먼: 가까운 면 하나로 자른다.
    const out: (typeof cs)[number][] = [];
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i]!;
      const b = cs[(i + 1) % cs.length]!;
      const ain = a.depth >= NEAR;
      const bin = b.depth >= NEAR;
      if (ain) out.push(a);
      if (ain !== bin) out.push(cut(a, b));
    }
    if (out.length < 3) return false;
    out.forEach((c, i) => {
      const p = projectCam(v, c);
      if (i) ctx.lineTo(p.sx, p.sy);
      else ctx.moveTo(p.sx, p.sy);
    });
    ctx.closePath();
    return true;
  }
  let any = false;
  for (let i = 0; i + 1 < cs.length; i++) {
    let a = cs[i]!;
    let b = cs[i + 1]!;
    if (a.depth < NEAR && b.depth < NEAR) continue;
    if (a.depth < NEAR) a = cut(a, b);
    else if (b.depth < NEAR) b = cut(a, b);
    const pa = projectCam(v, a);
    const pb = projectCam(v, b);
    ctx.moveTo(pa.sx, pa.sy);
    ctx.lineTo(pb.sx, pb.sy);
    any = true;
  }
  return any;
}

export function toWorld(v: View, sx: number, sy: number) {
  if (v.fp) {
    // 화면 점을 지나는 시선이 바닥(z=0)과 만나는 곳.
    const f = focal(v);
    const right = (sx - v.w / 2) / f;
    const up = (v.h * 0.45 - sy) / f;
    const c = Math.cos(FP_PITCH);
    const s = Math.sin(FP_PITCH);
    const fwd = c + up * s;
    const dz = -s + up * c;
    const t = dz < -1e-3 ? EYE_Z / -dz : 60;
    const fx = Math.cos(v.eye.yaw);
    const fy = Math.sin(v.eye.yaw);
    return { x: v.eye.x + (fwd * fx - right * fy) * t, y: v.eye.y + (fwd * fy + right * fx) * t };
  }
  const S = v.k * Math.SQRT2;
  const u = (sx - v.w / 2) / S;
  const d = (sy - v.h / 2) / (S * v.tilt);
  const c = Math.cos(v.rot);
  const s = Math.sin(v.rot);
  return { x: v.cx + u * c + d * s, y: v.cy - u * s + d * c };
}

/** 화면 방향(오른쪽 x, 아래 y)을 월드 방향으로 — 카메라를 돌려도 W는 화면 위쪽이다. */
export function screenDir(v: Pick<View, 'rot'>, x: number, y: number) {
  const c = Math.cos(v.rot);
  const s = Math.sin(v.rot);
  return { dx: x * c + y * s, dy: -x * s + y * c };
}

/** 화면 크기에 맞춘 축척 — 넓으면 경기장 전체가 보이고, 폰에서는 너무 작아지지 않게 하한을 둔다. */
export function fitScale(w: number, h: number) {
  const span = PITCH_L + PITCH_W + APRON * 2;
  return Math.max(Math.min(w / span, h / (span * 0.5 + 4)), 13);
}

/** 시점 프리셋. */
export const CAMERAS = [
  { key: 'quarter', rot: Math.PI / 4, tilt: 0.5, zoom: 1, fp: false },
  { key: 'broadcast', rot: 0, tilt: 0.42, zoom: 0.95, fp: false },
  { key: 'goal', rot: Math.PI / 2, tilt: 0.55, zoom: 1, fp: false },
  { key: 'sky', rot: Math.PI / 4, tilt: 0.9, zoom: 0.75, fp: false },
  { key: 'close', rot: Math.PI / 4, tilt: 0.5, zoom: 1.8, fp: false },
  // 내 선수 눈으로 본다(로그인해 필드에 선 사람만).
  { key: 'fp', rot: Math.PI / 4, tilt: 0.5, zoom: 1, fp: true },
] as const;
export type CameraKey = (typeof CAMERAS)[number]['key'];

/** 지금 각에서 목표 각으로 가장 짧게 도는 차이. */
export function angleGap(from: number, to: number) {
  const t = Math.PI * 2;
  return ((((to - from) % t) + t * 1.5) % t) - Math.PI;
}

/** 카메라가 나를 따라가되 경기장 밖 빈 곳이 너무 보이지 않게 가둔다. */
export function follow(v: View, x: number, y: number, dt: number) {
  const t = 1 - Math.exp(-dt * 6);
  v.cx += (x - v.cx) * t;
  v.cy += (y - v.cy) * t;
}

/** 화면 한 점에서 가장 가까운 아바타(발밑 기준 반경 안). */
export function pickActor(world: World, v: View, sx: number, sy: number, skip: string | null) {
  let best: Actor | null = null;
  let bestD = Infinity;
  for (const a of world.actors.values()) {
    if (a.id === skip) continue;
    const p = toScreen(v, a.x, a.y);
    if (!p.ok) continue;
    // 머리가 큰 꼬마 선수라 몸통 가운데(발 위로 1.3m쯤)를 기준으로 잰다.
    const d = Math.hypot(sx - p.sx, sy - (p.sy - p.s * 1.4));
    if (d < Math.max(p.s * 1.6, 14) && d < bestD) {
      best = a;
      bestD = d;
    }
  }
  return best;
}

export function say(a: Actor, text: string, now: number) {
  a.bubble = { text, until: now + Math.min(9000, 4000 + text.length * 120) };
}

export function emote(a: Actor, key: EmoteKey, now: number) {
  a.emote = { key, until: now + 2500 };
}

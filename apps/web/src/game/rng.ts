// ───────── 시드 기반 PRNG (mulberry32) ─────────
// 풀타임 원본은 전역 rnd = Math.random 을 그대로 썼습니다. 이 포트는 저장 가능한 시드 상태를 가진
// mulberry32 제너레이터로 대체해, 같은 시드 + 같은 선택이면 항상 같은 커리어가 재현되도록 합니다.

export interface RngState {
  seed: number;
}

export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    getState(): RngState {
      return { seed: a >>> 0 };
    },
    setState(state: RngState) {
      a = state.seed >>> 0;
    },
  };
}

export type Rng = ReturnType<typeof createRng>;

/** 새 게임을 시작할 때 쓰는 무작위 시드(비결정적: 여기서만 Math.random을 허용). */
export function freshSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

// ───────── 현재 활성 RNG (게임 인스턴스 하나당 하나) ─────────
let active: Rng = createRng(freshSeed());

export function setActiveRng(rng: Rng) {
  active = rng;
}
export function getActiveRng(): Rng {
  return active;
}

export const rnd = (): number => active.next();
/** 문자열을 32비트 정수로 접는 FNV-1a 해시. 암호학적 용도 아님 — RNG를 소비하지 않는 결정적 선택용. */
export function hashStr(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const ri = (a: number, b: number): number => Math.floor(a + rnd() * (b - a + 1));
export function pick<T>(a: readonly T[]): T {
  return a[Math.floor(rnd() * a.length)] as T;
}
export const chance = (p: number): boolean => rnd() < p;
export function gauss(): number {
  let u = 0,
    v = 0;
  while (!u) u = rnd();
  while (!v) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function poisson(l: number): number {
  if (l <= 0) return 0;
  const L = Math.exp(-l);
  let k = 0,
    p = 1;
  do {
    k++;
    p *= rnd();
  } while (p > L);
  return k - 1;
}

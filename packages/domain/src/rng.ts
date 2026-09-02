import { utf8Encode } from './canonical.js';

export type RngState = { readonly s: readonly [number, number, number, number]; readonly draws: number };

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** FNV-1a 32bit. seed 문자열을 splitmix32 씨앗용 단일 32비트 정수로 접는다. */
function fnv1a32(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function splitmix32Next(state: number): { value: number; next: number } {
  const next = (state + 0x9e3779b9) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 16), 0x21f0aaad) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 0x735a2d97) >>> 0;
  t = (t ^ (t >>> 15)) >>> 0;
  return { value: t, next };
}

/** xoshiro128** 한 스텝. 다음 상태와 32비트 출력값을 함께 돌려준다(불변 갱신). */
function xoshiro128ssNext(s: readonly [number, number, number, number]): {
  value: number;
  next: [number, number, number, number];
} {
  const [s0, s1, s2, s3] = s;
  const value = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
  const t = (s1 << 9) >>> 0;

  let ns2 = (s2 ^ s0) >>> 0;
  const ns3a = (s3 ^ s1) >>> 0;
  const ns1 = (s1 ^ ns2) >>> 0;
  const ns0 = (s0 ^ ns3a) >>> 0;
  ns2 = (ns2 ^ t) >>> 0;
  const ns3 = rotl(ns3a, 11);

  return { value, next: [ns0, ns1, ns2, ns3] };
}

/** seed 문자열 → FNV-1a 32bit → splitmix32로 4워드 생성. 네 워드가 모두 0이면 첫 워드에 1을 OR한다. */
export function seedRng(seed: string): RngState {
  const folded = fnv1a32(utf8Encode(seed));
  const words: [number, number, number, number] = [0, 0, 0, 0];
  let state = folded;
  for (let i = 0; i < 4; i++) {
    const step = splitmix32Next(state);
    words[i] = step.value;
    state = step.next;
  }
  if (words[0] === 0 && words[1] === 0 && words[2] === 0 && words[3] === 0) {
    words[0] = 1;
  }
  return { s: words, draws: 0 };
}

export function nextUint32(state: RngState): { value: number; state: RngState } {
  const { value, next } = xoshiro128ssNext(state.s);
  return { value, state: { s: next, draws: state.draws + 1 } };
}

/** 0..maxExclusive-1. rejection sampling으로 모듈로 편향을 제거한다. */
export function rollInt(state: RngState, maxExclusive: number): { value: number; state: RngState } {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError(`rollInt: maxExclusive는 1 이상의 정수여야 한다. 받은 값: ${maxExclusive}`);
  }
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  let current = state;
  for (;;) {
    const drawn = nextUint32(current);
    current = drawn.state;
    if (drawn.value < limit) {
      return { value: drawn.value % maxExclusive, state: current };
    }
  }
}

/** 1..100. 이벤트 outcome roll 전용 d100. */
export function roll100(state: RngState): { value: number; state: RngState } {
  const rolled = rollInt(state, 100);
  return { value: rolled.value + 1, state: rolled.state };
}

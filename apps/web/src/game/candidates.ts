// ───────── 선수 생성 후보 카드 (T-10-002) ─────────
// 이름/등번호/포지션/주발/플레이 유형/성장 특성을 고른 다음, 같은 총합(능력치 합)을 가지되
// 분포가 서로 다른 후보 3명을 보여준다. 이 파일은 game/rng.ts의 시드 RNG(활성 게임의 rnd/ri/
// pick/gauss/poisson)를 절대 쓰지 않는다 — 로컬 mulberry32 인스턴스를 매 호출마다 새로 만들어
// 쓰고 저장하지 않는(non-persisted) "별도의 랜덤 소스"만 사용한다. 그래서 후보 카드를 몇 번을
// 다시 뽑든 메인 게임 RNG 스트림은 전혀 움직이지 않고, newGame()에 최종 선택한 분포를
// presetAttrs로 넘기면(엔진 쪽 ri(-4,4) 루프를 건너뛰므로) fulltime-sim이 쓰는 newGame() 기본
// 경로(코치/시뮬레이터가 직접 호출하는 경로, presetAttrs 없음)의 RNG 소비 순서도 그대로다.
import { ATTR_KEYS, POS, TYPES, type AttrKey, type Pos } from './data.js';

// 로컬(비영속) mulberry32 — game/rng.ts의 활성 RNG와 완전히 분리되어 있다.
function localRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Candidate {
  attrs: Record<AttrKey, number>;
  total: number;
  /** 카드가 뒤집히기 전 표시할 짧은 스카우트 힌트(강점 2개). */
  hintKeys: AttrKey[];
}

const CLAMP = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** pos/type에 대한 "기준 분포"(랜덤 없음) — 세 후보 모두 이 총합을 공유한다. */
function baseline(pos: Pos, typeId: string): Record<AttrKey, number> {
  const type = TYPES[pos].find((t) => t.id === typeId) ?? TYPES[pos][0]!;
  const out = {} as Record<AttrKey, number>;
  for (const k of ATTR_KEYS) out[k] = CLAMP(POS[pos].base[k] + (type.mod[k] ?? 0), 20, 70);
  return out;
}

/** 총합을 유지한 채(한 능력치에서 다른 능력치로 옮기는 방식) 무작위로 재분배한다. */
function redistribute(base: Record<AttrKey, number>, rand: () => number, rounds = 10, step = 3): Record<AttrKey, number> {
  const out = { ...base };
  for (let i = 0; i < rounds; i++) {
    const from = ATTR_KEYS[Math.floor(rand() * ATTR_KEYS.length)]!;
    const to = ATTR_KEYS[Math.floor(rand() * ATTR_KEYS.length)]!;
    if (from === to) continue;
    const amt = Math.min(step, out[from] - 20, 70 - out[to]);
    if (amt <= 0) continue;
    out[from] -= amt;
    out[to] += amt;
  }
  return out;
}

/** 후보 3명을 만든다. 세 후보의 attrs 합계는 모두 같다(baseline 총합과 동일) — 분포만 다르다. */
export function generateCandidates(pos: Pos, typeId: string, n = 3): Candidate[] {
  const base = baseline(pos, typeId);
  const rand = localRng((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  const out: Candidate[] = [];
  for (let i = 0; i < n; i++) {
    const attrs = i === 0 ? { ...base } : redistribute(base, rand, 8 + i * 4, 4);
    const sorted = ATTR_KEYS.slice().sort((a, b) => attrs[b] - attrs[a]);
    out.push({ attrs, total: ATTR_KEYS.reduce((sum, k) => sum + attrs[k], 0), hintKeys: sorted.slice(0, 2) });
  }
  return out;
}

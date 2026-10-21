// T-11-432 이벤트 선택지 득실(event-peek-data.ts)을 만드는 생성기. 테스트(event-peek.test.ts)에서만 부른다.
// 효과(fx)는 함수라 정적으로 읽을 수 없다. 그래서 고정 시드 커리어(play-career.ts)를 돌리며 이벤트 조건이 맞는
// 구간마다 상태 사본에 각 선택지의 ok·fail 효과를 따로 적용해 보고, 모든 사본에서 같은 방향으로 바뀐 항목만
// "확정 득실"로 남긴다. 실제 화면은 생성된 데이터만 읽으므로 게임 진행 중 시뮬레이션·난수 소비는 없다.
// 사본 적용은 별도 RNG로 하고 끝나면 원래 RNG로 되돌린다(커리어 진행 결과는 골든과 같다).
import { ATTR_KEYS } from '../data.js';
import { EVENTS } from '../events-data.js';
import '../event-registry.js';
import { createRng, getActiveRng, setActiveRng } from '../rng.js';
import { setJitter, snapshot, type Snapshot } from '../stats.js';
import type { GameState } from '../types.js';
import type { ChoicePeek, PeekKey, PeekStat } from '../event-peek.js';
import { playCareer } from './play-career.js';

type Stat = PeekStat;
/** 같은 크기라도 체감이 다른 항목을 맞춰 순위를 매기는 기준(이만큼 바뀌면 1점). */
const SCALE: Record<Stat, number> = {
  cond: 10,
  morale: 10,
  fame: 5,
  trust: 1.5,
  money: 0, // 돈은 액수가 상태마다 크게 달라 1점으로 둔다.
  attr: 1,
  pot: 0.5,
};
/** 값이 이 경계에 닿아 있으면 그 방향으로는 더 바뀌지 않는다(그 사본은 판정에서 뺀다). */
const BOUND: Partial<Record<Stat, [number, number]>> = {
  cond: [0, 100],
  morale: [0, 100],
  trust: [-6, 6],
  fame: [0, Infinity],
};

type Acc = {
  n: number;
  signs: Map<Stat, { pos: number; neg: number; zero: number; mag: number }>;
  stories: Map<string, number>;
  out: number;
};

const attrSum = (x: Snapshot) => ATTR_KEYS.reduce((a, k) => a + x[k], 0);

function statOf(sn: Snapshot, k: Stat): number {
  return k === 'attr' ? attrSum(sn) : k === 'pot' ? sn.potB : sn[k];
}

function tryFx(base: GameState, fx: (s: GameState) => void, seed: number) {
  const c = structuredClone(base);
  const before = snapshot(c);
  const prev = getActiveRng();
  setActiveRng(createRng(seed));
  setJitter(false);
  try {
    fx(c);
  } catch {
    return null;
  } finally {
    setActiveRng(prev);
  }
  return { c, before, after: snapshot(c) };
}

function record(acc: Acc, r: NonNullable<ReturnType<typeof tryFx>>) {
  acc.n++;
  for (const k of Object.keys(SCALE) as Stat[]) {
    const a = statOf(r.before, k),
      d = statOf(r.after, k) - a;
    const e = acc.signs.get(k) ?? { pos: 0, neg: 0, zero: 0, mag: 0 };
    if (Math.abs(d) < 1e-9) {
      const b = BOUND[k];
      // 경계에 닿아 못 바뀐 사본은 세지 않는다(예: 컨디션 100에서 회복).
      if (!b || (a > b[0] && a < b[1])) e.zero++;
    } else {
      if (d > 0) e.pos++;
      else e.neg++;
      e.mag += Math.abs(d);
    }
    acc.signs.set(k, e);
  }
  for (const k of r.after.stories)
    if (!r.before.stories.includes(k)) acc.stories.set(k, (acc.stories.get(k) ?? 0) + 1);
  if (r.after.injury > r.before.injury) acc.out++;
}

function summarize(acc: Acc): PeekKey[] | undefined {
  // 표본이 적으면 확정이라 말하지 않는다.
  if (acc.n < 3) return undefined;
  const out: { k: PeekKey; score: number }[] = [];
  for (const [k, n] of acc.stories) if (n === acc.n) out.push({ k: `story:${k}`, score: 9 });
  if (acc.out === acc.n) out.push({ k: 'out', score: 8 });
  for (const [k, e] of acc.signs) {
    const moved = e.pos + e.neg;
    if (!moved || e.zero || (e.pos && e.neg)) continue;
    const score = SCALE[k] ? e.mag / moved / SCALE[k] : 1;
    // 아주 작은 변화(사기 +1 같은)는 "주요 득실"이 아니다.
    if (score < 0.3) continue;
    out.push({ k: `${k}${e.pos ? '+' : '-'}`, score });
  }
  if (!out.length) return undefined;
  return out
    .sort((a, b) => b.score - a.score || (a.k < b.k ? -1 : 1))
    .slice(0, 4)
    .map((x) => x.k);
}

/** 한 커리어에서 이벤트 하나를 몇 번까지 표본으로 쓰는지. */
const PER_CAREER = 3;

const newAcc = (): Acc => ({ n: 0, signs: new Map(), stories: new Map(), out: 0 });

/** 생성에 쓰는 고정 시드 커리어 수. */
export const PEEK_CAREERS = 32;

/** 고정 시드 커리어 careers개로 이벤트별 선택지 득실을 만든다. onCareer는 각 커리어의 최종 상태(테스트용). */
export function buildEventPeek(
  careers = PEEK_CAREERS,
  onCareer?: (s: GameState, i: number) => void,
): Record<string, ChoicePeek[]> {
  const accs = new Map<string, { ok: Acc; fail: Acc }[]>();
  let seed = 1;
  const visit = (s: GameState) => {
    // 조건 함수가 혹시 난수를 써도 커리어 진행 RNG는 건드리지 않는다.
    const prev = getActiveRng();
    setActiveRng(createRng(seed++));
    try {
      visitEvents(s);
    } finally {
      setActiveRng(prev);
    }
  };
  const visitEvents = (s: GameState) => {
    for (const ev of EVENTS) {
      let ok: boolean;
      try {
        ok = ev.cond(s);
      } catch {
        ok = false;
      }
      // 한 커리어에서 같은 이벤트는 몇 번만 본다(비슷한 상태를 되풀이하지 않고 여러 커리어로 넓힌다).
      const seen = perCareer.get(ev.id) ?? 0;
      if (!ok || seen >= PER_CAREER) continue;
      perCareer.set(ev.id, seen + 1);
      const list = accs.get(ev.id) ?? ev.choices.map(() => ({ ok: newAcc(), fail: newAcc() }));
      accs.set(ev.id, list);
      ev.choices.forEach((c, i) => {
        const r = tryFx(s, c.ok.fx, seed++);
        if (r) record(list[i]!.ok, r);
        if (c.fail) {
          const f = tryFx(s, c.fail.fx, seed++);
          if (f) record(list[i]!.fail, f);
        }
      });
    }
  };
  const perCareer = new Map<string, number>();
  for (let i = 0; i < careers; i++) {
    perCareer.clear();
    const s = playCareer(i, visit);
    onCareer?.(s, i);
  }
  const out: Record<string, ChoicePeek[]> = {};
  for (const ev of EVENTS) {
    const list = accs.get(ev.id);
    if (!list) continue;
    const peeks = list.map(({ ok, fail }) => {
      const p: ChoicePeek = {};
      const o = summarize(ok),
        f = summarize(fail);
      if (o) p.ok = o;
      if (f) p.fail = f;
      return p;
    });
    if (peeks.some((p) => p.ok || p.fail)) out[ev.id] = peeks;
  }
  return out;
}

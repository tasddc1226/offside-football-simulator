// ───────── 확률 도감(T-10-012) ─────────
// 이벤트 선택지의 성공 확률은 선수 상태로 계산하는 식이라 숫자 하나로 적을 수 없다. 그래서 가상의
// 선수 상태를 넣어 "나올 수 있는 범위"와 "무엇이 확률을 올리고 내리는지"를 코드에서 직접 뽑는다 —
// 밸런스를 바꾸면 도감도 자동으로 따라간다. 계산은 게임 RNG를 건드리지 않도록 따로 돌린다.
import { ATTR_KEYS, ATTR_LABEL, CLUBS, LEAGUES, POS, TRAITS, TYPES, type AttrKey, type Pos } from './data.js';
import { initSubs, spreadAttr, syncFace } from './attributes.js';
import { STORIES, isSafe, leagueOf, newGame, txt } from './engine.js';
import { EVENTS } from './events-data.js';
import { groupOf, posOf, type DexGroup } from './dexGroups.js';
import { createRng, getActiveRng, setActiveRng } from './rng.js';
import type { Choice, EventDef, GameState } from './types.js';

export { DEX_GROUPS, isHiddenEvent, type DexGroup } from './dexGroups.js';

export interface DexFactor {
  label: string;
  /** true면 값이 클수록 성공 확률이 오른다. */
  up: boolean;
}
export interface DexChoice {
  label: string;
  /** odds: 확률 판정, safe: 확정이지만 대가가 따를 수 있는 선택, sure: 판정 없는 선택. */
  kind: 'odds' | 'safe' | 'sure';
  /** 나올 수 있는 성공 확률 범위(%). 계산할 수 없으면(상황에 따라 다름) null. */
  min: number | null;
  max: number | null;
  factors: DexFactor[];
}
export interface DexEntry {
  /** 같은 제목의 변형 이벤트는 한 항목으로 묶는다. 하나라도 겪으면 열린다. */
  ids: string[];
  title: string;
  group: DexGroup;
  pos: Pos | null;
  story: { name: string; stage: number; total: number } | null;
  /** 스토리 2단계부터는 앞 단계의 선택이 확률에 영향을 준다. */
  dependsOnPast: boolean;
  choices: DexChoice[];
}

// ───────── 가상의 선수 상태 ─────────
const SAMPLES = 240;
const FACTOR_SAMPLES = 60;
/** 이만큼(확률 0.4%p) 이상 움직여야 영향 요인으로 본다. */
const EPS = 0.004;

function sampleStates(pos: Pos | null, n: number, seed: number): GameState[] {
  const r = createRng(seed).next;
  const at = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)]!;
  const out: GameState[] = [];
  for (let i = 0; i < n; i++) {
    const p = pos ?? at(Object.keys(POS) as Pos[]);
    const s = newGame({ name: '도감', number: 10, pos: p, foot: '오른발', trait: at(TRAITS).id, type: at(TYPES[p]).id }, 1);
    const L = at(LEAGUES);
    s.leagueId = L.id;
    s.club = { ...at(CLUBS.filter((c) => c.leagueId === L.id)) };
    const level = L.avg + (r() - 0.5) * 20;
    const base = {} as Record<AttrKey, number>;
    for (const k of ATTR_KEYS) base[k] = Math.max(25, Math.min(95, Math.round(level + (r() - 0.5) * 24)));
    // 능력치는 세부 능력치(sub)에서 나온다 — OVR·얼굴 능력치가 서로 맞도록 sub부터 만든다.
    initSubs(s, base);
    syncFace(s);
    s.age = 18 + Math.floor(r() * 19);
    s.trust = Math.round(r() * 12 - 6);
    s.morale = Math.round(r() * 100);
    s.fame = Math.round(r() * 100);
    s.cond = Math.round(40 + r() * 60);
    s.phase = 1 + Math.floor(r() * 2);
    s.injury = Math.floor(r() * 13);
    s.contract = L.amateur ? null : { years: 1 + Math.floor(r() * 4), salary: 1000 };
    out.push(s);
  }
  return out;
}

// ───────── 영향 요인 ─────────
/** 상태를 조금 바꾸고 되돌리는 함수를 돌려준다(복제 비용 없이 같은 상태를 재사용). 적용할 수 없으면 null. */
type Bump = (s: GameState) => (() => void) | null;
const statBump =
  (k: 'trust' | 'morale' | 'fame' | 'cond' | 'age' | 'injury', d: number): Bump =>
  (s) => {
    const v = s[k];
    s[k] = v + d;
    return () => (s[k] = v);
  };
/** 능력치는 세부 능력치를 거쳐 올린다(게임의 성장과 같은 경로). k가 없으면 모든 세부 능력치를 올린다(OVR). */
const attrBump =
  (k: AttrKey | null, d: number): Bump =>
  (s) => {
    const sub = { ...s.sub };
    const attrs = { ...s.attrs };
    if (k) spreadAttr(s, k, d);
    else {
      for (const key in s.sub) s.sub[key] = s.sub[key]! + d;
      syncFace(s);
    }
    return () => {
      s.sub = sub;
      s.attrs = attrs;
    };
  };
const FACTORS: { label: string; bump: Bump }[] = [
  {
    label: '소속팀 전력',
    bump: (s) => {
      const v = s.club.str;
      s.club.str = v + 5;
      return () => (s.club.str = v);
    },
  },
  {
    label: '리그 수준',
    bump: (s) => {
      const cur = s.leagueId;
      const up = LEAGUES.filter((l) => l.avg > leagueOf(cur).avg).sort((a, b) => a.avg - b.avg)[0];
      if (!up) return null;
      s.leagueId = up.id;
      return () => (s.leagueId = cur);
    },
  },
  { label: '감독 신뢰', bump: statBump('trust', 2) },
  { label: '사기', bump: statBump('morale', 15) },
  { label: '명성', bump: statBump('fame', 15) },
  { label: '컨디션', bump: statBump('cond', 15) },
  { label: '나이', bump: statBump('age', 3) },
  { label: '부상 정도', bump: statBump('injury', 2) },
  {
    label: '남은 계약 기간',
    bump: (s) => {
      const c = s.contract;
      if (!c) return null;
      c.years += 1;
      return () => (c.years -= 1);
    },
  },
];

function effect(p: (s: GameState) => number, states: GameState[], bump: Bump): number {
  let sum = 0;
  let n = 0;
  for (const s of states) {
    const base = p(s);
    const undo = bump(s);
    if (!undo) continue;
    const d = p(s) - base;
    undo();
    if (Number.isNaN(d)) continue;
    sum += d;
    n++;
  }
  return n ? sum / n : 0;
}

function factorsOf(p: (s: GameState) => number, states: GameState[]): DexFactor[] {
  const found: { label: string; e: number }[] = [];
  for (const f of FACTORS) {
    const e = effect(p, states, f.bump);
    if (Math.abs(e) > EPS) found.push({ label: f.label, e });
  }
  // 능력치: 여러 능력치가 비슷하게 움직이면 종합 능력치(OVR)로, 한두 개만 크게 움직이면 그 능력치로 적는다.
  const per = ATTR_KEYS.map((k) => ({ k, e: effect(p, states, attrBump(k, 10)) })).filter((x) => Math.abs(x.e) > EPS);
  if (per.length > 3) {
    found.push({ label: '종합 능력치(OVR)', e: effect(p, states, attrBump(null, 5)) });
    const mid = per.map((x) => Math.abs(x.e)).sort((a, b) => a - b)[Math.floor(per.length / 2)]!;
    for (const x of per) if (Math.abs(x.e) >= mid * 2.5) found.push({ label: ATTR_LABEL[x.k], e: x.e });
  } else for (const x of per) found.push({ label: ATTR_LABEL[x.k], e: x.e });
  // 특성은 크기가 없으니 가장 유리한 특성 하나만 적는다.
  const byTrait = TRAITS.map((t) => {
    let sum = 0;
    let n = 0;
    for (const s of states) {
      const v = s.trait;
      s.trait = t.id;
      const x = p(s);
      s.trait = v;
      if (Number.isNaN(x)) continue;
      sum += x;
      n++;
    }
    return { t, avg: n ? sum / n : 0 };
  }).sort((a, b) => b.avg - a.avg);
  const spread = byTrait[0]!.avg - byTrait[byTrait.length - 1]!.avg;
  if (spread > 0.02) found.push({ label: `특성 '${byTrait[0]!.t.name}'`, e: spread });
  return found
    .sort((a, b) => Math.abs(b.e) - Math.abs(a.e))
    .slice(0, 4)
    .map(({ label, e }) => ({ label, up: e > 0 }));
}

/** 확률 식이 그 상태에서 계산되지 않으면(필요한 이야기 상태가 없는 등) NaN. */
const safely =
  (p: (s: GameState) => number) =>
  (s: GameState): number => {
    try {
      const v = p(s);
      return Number.isFinite(v) ? v : NaN;
    } catch {
      return NaN;
    }
  };

function labelOf(c: Choice, s: GameState): string {
  try {
    return txt(c.label, s);
  } catch {
    return typeof c.label === 'string' ? c.label : '(상황에 따라 달라지는 선택지)';
  }
}

function analyzeChoice(ev: EventDef, c: Choice, states: GameState[]): DexChoice {
  const label = labelOf(c, states[0]!);
  if (!c.p) return { label, kind: isSafe(ev, c) ? 'safe' : 'sure', min: 100, max: 100, factors: [] };
  const p = safely(c.p);
  const values = states.map(p).filter((v) => !Number.isNaN(v));
  if (!values.length) return { label, kind: 'odds', min: null, max: null, factors: [] };
  const pct = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 100);
  return { label, kind: 'odds', min: pct(Math.min(...values)), max: pct(Math.max(...values)), factors: factorsOf(p, states.slice(0, FACTOR_SAMPLES)) };
}

/** 스토리 2단계 이후는 앞 단계를 먼저 겪은 상태가 있어야 확률이 계산된다 — 앞 단계 선택을 무작위로 밟아 둔다. */
function withPastStages(ev: EventDef, states: GameState[], seed: number): GameState[] {
  const past = EVENTS.filter((e) => e.story === ev.story && (e.stage ?? 0) < (ev.stage ?? 0)).sort((a, b) => (a.stage ?? 0) - (b.stage ?? 0));
  const r = createRng(seed).next;
  for (const s of states) {
    for (const e of past) {
      const c = e.choices[Math.floor(r() * e.choices.length)]!;
      try {
        (c.fail && r() < 0.5 ? c.fail : c.ok).fx(s);
      } catch {
        // 앞 단계가 이 상태에서 성립하지 않으면 건너뛴다(확률 계산은 safely가 거른다).
      }
    }
  }
  return states;
}

/** 게임 RNG를 잠시 다른 것으로 바꿔 계산한다 — 진행 중인 커리어의 난수 흐름을 건드리지 않는다. */
function sandboxed<T>(fn: () => T): T {
  const prev = getActiveRng();
  setActiveRng(createRng(20260925));
  try {
    return fn();
  } finally {
    setActiveRng(prev);
  }
}

let cache: DexEntry[] | null = null;
/** 전체 도감. 처음 한 번 계산해 둔다(수십 ms). */
export function eventDex(): DexEntry[] {
  if (cache) return cache;
  cache = sandboxed(() => {
    const byTitle = new Map<string, EventDef[]>();
    for (const ev of EVENTS) byTitle.set(ev.title, [...(byTitle.get(ev.title) ?? []), ev]);
    // 앞 단계가 없는 이벤트는 포지션별 상태를 함께 쓰고, 스토리 후속 단계는 따로 만든다(앞 단계가 상태를 바꾼다).
    const shared = new Map<string, GameState[]>();
    return [...byTitle.values()].map((evs, i) => {
      const ev = evs.reduce((a, b) => (b.choices.length > a.choices.length ? b : a));
      const pos = posOf(ev);
      const dependsOnPast = !!ev.story && (ev.stage ?? 0) > 1;
      let states: GameState[];
      if (dependsOnPast) states = withPastStages(ev, sampleStates(pos, SAMPLES, 5000 + i), 9000 + i);
      else {
        const key = pos ?? 'any';
        if (!shared.has(key)) shared.set(key, sampleStates(pos, SAMPLES, 1000 + i));
        states = shared.get(key)!;
      }
      const story = ev.story ? { name: STORIES[ev.story]!.name, stage: ev.stage ?? 0, total: STORIES[ev.story]!.total } : null;
      return {
        ids: evs.map((e) => e.id),
        title: ev.title,
        group: groupOf(ev),
        pos,
        story,
        dependsOnPast,
        choices: ev.choices.map((c) => analyzeChoice(ev, c, states)),
      };
    });
  });
  return cache;
}

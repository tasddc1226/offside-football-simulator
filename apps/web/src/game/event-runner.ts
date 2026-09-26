import { ATTR_KEYS, type AttrKey, type Pos } from './data.js';
import { wOf } from './attributes.js';
import { ri, pick, chance, rnd } from './rng.js';
import { EVENTS, eventById } from './events-data.js';
import { BAL, choiceOdds, eventWeight } from './balance.js';
import type { GameState, Choice, EventDef } from './types.js';
import { leagueOf, labelOf } from './player.js';
import {
  setJitter,
  addAttr,
  addStat,
  fameEff,
  log,
  snapshot,
  diffChips,
  type Chip,
} from './stats.js';
import { STORIES, turnNo, storyActive, endStory } from './story.js';

// ───────── 이벤트 문구/조건 공용 헬퍼 (원본 events.js) ─────────
export const isPro = (s: GameState): boolean => !leagueOf(s.leagueId).amateur;
export const byPos =
  <T>(m: Partial<Record<Pos | 'def', T>>) =>
  (s: GameState): T =>
    (m[s.pos] ?? m.def) as T;
export const txt = <T>(v: T | ((s: GameState) => T), s: GameState): T =>
  typeof v === 'function' ? (v as (s: GameState) => T)(s) : v;
export const isAtk = (s: GameState): boolean => s.pos === 'FW' || s.pos === 'MF';
export function adFee(s: GameState): number {
  const f = fameEff(s);
  return Math.round((f * f * 1.2) / 10) * 10 + 200;
}
export function trainerFee(s: GameState): number {
  return Math.max(1000, Math.round(((s.contract ? s.contract.salary : 0) * 0.15) / 10) * 10);
}
export function bestKey(s: GameState): AttrKey {
  return ATTR_KEYS.filter((k) => wOf(s)[k] > 0.05).sort((a, b) => s.attrs[b] - s.attrs[a])[0]!;
}
export function weakKey(s: GameState): AttrKey {
  return ATTR_KEYS.filter((k) => wOf(s)[k] > 0.09).sort((a, b) => s.attrs[a] - s.attrs[b])[0]!;
}
export function agentFee(s: GameState): number {
  return Math.max(500, Math.round(((s.contract ? s.contract.salary : 0) * 0.1) / 10) * 10);
}

/** 이벤트 규칙. 확률 도감(T-10-012)이 이 값을 그대로 읽어 공개한다 — 숫자를 바꾸면 도감도 따라 바뀐다. */
export const EVENT_RULES = {
  /** 구간마다 이벤트가 생길 확률(프리시즌 / 전·후반기). 연쇄 이벤트는 예정대로 따로 온다. */
  // T-10-016 확률 세 개는 서버 밸런스 설정(BAL)을 읽는다.
  rate: {
    get preseason() {
      return BAL.eventRatePreseason;
    },
    get season() {
      return BAL.eventRateSeason;
    },
  },
  /** 같은 이벤트가 다시 나오기까지 최소 구간 수. 이미 본 이벤트는 가중치가 1/(1+본 횟수)로 준다. */
  cooldown: 9,
  /** 선택 뒤 반전이 붙을 확률. 안전한 선택은 먼저 이 확률로 대가를 치른다. */
  get twist() {
    return BAL.eventTwist;
  },
  /** 반전이 능력치 변화일 때 오를 확률(안전 / 도전 성공·확정 / 도전 실패). */
  twistUp: { safe: 0.3, ok: 0.65, fail: 0.4 },
  /** 안전한 선택의 대가(셋 중 하나, 폭 안에서 무작위). */
  safeCost: [
    { k: 'morale', label: '사기', min: 3, max: 6, why: '도전하지 않은 아쉬움' },
    { k: 'trust', label: '감독 신뢰', min: 1, max: 1, why: '감독의 미지근한 평가' },
    { k: 'fame', label: '명성', min: 2, max: 4, why: '"무난했다"는 평가' },
  ],
} as const;
const EV_COOLDOWN = EVENT_RULES.cooldown;
export const isSafe = (ev: EventDef, c: Choice): boolean =>
  !c.fail && ev.choices.some((x) => !!x.fail);
export function rollEvent(s: GameState): string | null {
  // 정의 모듈은 event-registry.ts가 EVENTS에 채운다. 그 import가 빠지면 이벤트가 조용히 하나도 안 나오므로 바로 알린다.
  if (!EVENTS.length)
    throw new Error('EVENTS가 비어 있다 — game/event-registry.js를 import해야 한다');
  const t = turnNo(s);
  s.chains = s.chains || [];
  for (const c of s.chains.filter((c) => c.until < t)) {
    const e = eventById(c.id);
    if (e && e.story) endStory(s, e.story, e.expireEnding || '흐지부지 끝난 이야기');
  }
  s.chains = s.chains.filter((c) => c.until >= t);
  const due = s.chains.find((c) => c.at <= t && eventById(c.id)!.cond(s));
  if (due) {
    s.chains = s.chains.filter((c) => c !== due);
    s.flags.lastEvent = due.id;
    return due.id;
  }
  if (!chance(s.phase === 0 ? EVENT_RULES.rate.preseason : EVENT_RULES.rate.season)) return null;
  // 대입식의 값(원본 객체)이 아니라 다시 읽은 값을 쓴다 — s가 Svelte $state 프록시면 원본에 쓴 값이 반영되지 않을 수 있다.
  if (!s.flags.evSeen) s.flags.evSeen = {};
  const seen = s.flags.evSeen;
  const pool = EVENTS.filter(
    (e) =>
      !e.chain &&
      e.cond(s) &&
      s.flags.lastEvent !== e.id &&
      !(seen[e.id] && t - seen[e.id]!.t < EV_COOLDOWN),
  );
  if (!pool.length) return null;
  const weightOf = (e: EventDef) =>
    (e.w * eventWeight(e.id)) / (1 + (seen[e.id] ? seen[e.id]!.n : 0));
  const tot = pool.reduce((a, e) => a + weightOf(e), 0);
  let x = rnd() * tot;
  const ev = pool.find((e) => (x -= weightOf(e)) <= 0) || pool[0]!;
  s.flags.lastEvent = ev.id;
  seen[ev.id] = { t, n: (seen[ev.id] ? seen[ev.id]!.n : 0) + 1 };
  return ev.id;
}
export interface ResolveResult {
  ok: boolean;
  text: string;
  chips: Chip[];
  p: number;
  roll: number;
  story: { name: string; ending: string | null; started: boolean } | null;
  twist: string | null;
}
export function resolveChoice(s: GameState, evId: string, idx: number): ResolveResult {
  const ev = eventById(evId)!;
  const c = ev.choices[idx]!;
  const p = choiceOdds(c.p?.(s), evId, idx);
  const roll = rnd();
  const ok = roll < p;
  const out = ok || !c.fail ? c.ok : c.fail;
  const before = snapshot(s);
  const text = txt(out.text, s);
  log(s, `[${ev.title}] ${text}`, ok ? 'good' : 'bad', Math.max(0, s.phase - 1));
  const safe = isSafe(ev, c);
  setJitter(safe ? 'safe' : true);
  try {
    out.fx(s);
  } finally {
    setJitter(false);
  }
  let twist: string | null = null;
  if (safe && chance(EVENT_RULES.twist)) {
    // 폭이 있는 항목만 RNG를 쓴다(원래 호출 순서: 사기 → 명성 → pick).
    const [k, d, why] = pick(
      EVENT_RULES.safeCost.map(
        ({ k, min, max, why }) => [k, -(min === max ? min : ri(min, max)), why] as const,
      ),
    );
    addStat(s, k, d);
    twist = '안전한 선택의 대가 · ' + why;
  } else if (chance(EVENT_RULES.twist)) {
    const k = pick(ATTR_KEYS.filter((x) => wOf(s)[x] > 0.09));
    const up = chance(
      safe ? EVENT_RULES.twistUp.safe : ok ? EVENT_RULES.twistUp.ok : EVENT_RULES.twistUp.fail,
    );
    const d = up ? ri(1, 2) : -1;
    addAttr(s, k, d);
    twist = up ? `뜻밖의 수확 · ${labelOf(s, k)} +${d}` : `예상 못 한 여파 · ${labelOf(s, k)} ${d}`;
  }
  const key =
    ev.story ||
    Object.keys(s.story || {}).find((k) => !before.stories.includes(k) && storyActive(s, k));
  const st = key ? s.story[key] : undefined;
  const story = st
    ? { name: STORIES[key!]!.name, ending: st.done ? st.ending! : null, started: !ev.story }
    : null;
  return { ok, text, chips: diffChips(s, before, snapshot(s)), p, roll, story, twist };
}
export function pkWin(s: GameState) {
  const S = s.season;
  if (S.d > 0) {
    S.d--;
    S.w++;
    S.pts += 2;
  }
}

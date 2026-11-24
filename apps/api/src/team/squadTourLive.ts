// T-11-825 원정 투어 작전 경기. 한 판을 구간으로 나눠 치르고 구간 사이 작전 타임에 전술 · 교체를 받는다. 투어 전용이다.
// 상태는 값(JSON)이라 서버가 경기 행에 그대로 저장했다가 다음 요청에서 이어 간다. 난수는 seed와 구간 번호로만 정해진다.
import { addLines } from '@offside/contracts/manager-rules';
import { FORMATIONS, type FormationId } from '@offside/contracts/owner-team';
import {
  TOUR,
  TOUR_LIVE,
  TOUR_TACTICS,
  tourAiTactic,
  tourDrained,
  tourFatigue,
  tourLineupOk,
  tourTacticEdge,
  type TourRule,
  type TourTactic,
} from '@offside/contracts/squad-tour';
import {
  SIM,
  addGoalEvents,
  expectedGoals,
  matchSetup,
  penaltyShootout,
  poisson,
  rngOf,
  seedOf,
  type LineupCareer,
  type LineupSlot,
  type SimEvent,
} from './sim.js';
import { tourCardOf, tourLineup } from './squadTour.js';

/** 작전 경기 상태. mine은 원정 팀(구단주), opp는 홈 팀(AI). */
export type TourLive = {
  seed: string;
  season: number;
  /** 끝난 구간 수(0 ~ TOUR_LIVE.segments). */
  done: number;
  formation: FormationId;
  slotIds: (string | null)[];
  /** 교체 명단에 남은 카드 id. */
  bench: string[];
  subsLeft: number;
  tactic: TourTactic;
  /** 자리별 체력(선발 순서). */
  stamina: number[];
  merc: number;
  oppStart: TourTactic;
  oppTactic: TourTactic;
  oppStamina: number[];
  goalsFor: number;
  goalsAgainst: number;
  events: SimEvent[];
};

export type TourLiveInput = {
  seed: string;
  season: number;
  formation: FormationId;
  slotIds: readonly (string | null)[];
  bench: readonly string[];
  tactic: TourTactic;
  merc: number;
  oppTactic: TourTactic;
};

/** n번째 경기 AI 구단의 시작 전술(같은 주 · 같은 경기면 모두에게 같다). */
export const tourOppTactic = (week: string, stage: number): TourTactic =>
  TOUR_TACTICS[Math.floor(rngOf(seedOf(`tour-tactic:${week}:${stage}`))() * TOUR_TACTICS.length)]!;

export function startTourLive(input: TourLiveInput): TourLive {
  const n = FORMATIONS[input.formation].length;
  return {
    seed: input.seed,
    season: input.season,
    done: 0,
    formation: input.formation,
    slotIds: [...input.slotIds],
    bench: input.bench.slice(0, TOUR_LIVE.bench),
    subsLeft: TOUR_LIVE.subs,
    tactic: input.tactic,
    stamina: Array.from({ length: n }, () => 100),
    merc: input.merc,
    oppStart: input.oppTactic,
    oppTactic: input.oppTactic,
    oppStamina: Array.from({ length: n }, () => 100),
    goalsFor: 0,
    goalsAgainst: 0,
    events: [],
  };
}

export const tourLiveOver = (s: TourLive): boolean => s.done >= TOUR_LIVE.segments;

const tired = (lineup: readonly LineupSlot[], stamina: readonly number[]): LineupSlot[] =>
  lineup.map((x, i) => ({ ...x, rating: x.rating - tourFatigue(stamina[i] ?? 100) }));

/** 지금 뛰는 내 선발(제한 · 용병 · 체력 반영). */
export const tourLiveMine = (
  s: TourLive,
  cards: readonly LineupCareer[],
  rules: readonly TourRule[],
): LineupSlot[] => tired(tourLineup(s.formation, s.slotIds, cards, rules, s.merc), s.stamina);

/** 한 구간의 두 팀 기대 득점(내 것, 상대 것). 전술의 줄 힘 보정 · 상성 · 체력을 반영한다. 난수를 쓰지 않는다. */
export function tourSegmentXg(
  s: TourLive,
  mine: readonly LineupSlot[],
  opp: readonly LineupSlot[],
  tactic: TourTactic = s.tactic,
  atkK: number = TOUR.atkK,
): { mine: number; opp: number } {
  const setup = matchSetup(tired(opp, s.oppStamina), mine, s.season, { atkK });
  const zero = { gk: 0 };
  const my = addLines(setup.report.away.lines, { ...TOUR_LIVE.lines[tactic], ...zero });
  const their = addLines(setup.report.home.lines, { ...TOUR_LIVE.lines[s.oppTactic], ...zero });
  const edge = tourTacticEdge(tactic, s.oppTactic) * TOUR_LIVE.edge;
  const part = 1 / TOUR_LIVE.segments;
  return {
    mine: expectedGoals(my, their, false, undefined, atkK) * (1 + edge) * part,
    opp: expectedGoals(their, my, true, SIM.homeAdv, atkK) * (1 - edge) * part,
  };
}

const pmf = (lambda: number, max = 12): number[] => {
  const out = [Math.exp(-lambda)];
  for (let k = 1; k <= max; k++) out.push((out[k - 1]! * lambda) / k);
  return out;
};

/**
 * 지금 점수에서 그 전술로 끝까지 갈 때 이길 가망(90분 승 + 무승부의 절반). 남은 구간마다 그 전술로 빠질 체력까지 따라가며
 * 기대 득점을 더한다(상대가 뒤에 전술을 바꾸는 것은 넣지 않는다). 화면의 작전 비교와 시뮬레이션의 선택에 쓴다.
 */
export function tourLiveChance(
  s: TourLive,
  cards: readonly LineupCareer[],
  rules: readonly TourRule[],
  opp: readonly LineupSlot[],
  tactic: TourTactic = s.tactic,
): number {
  const diff = s.goalsFor - s.goalsAgainst;
  if (tourLiveOver(s)) return diff > 0 ? 1 : diff < 0 ? 0 : 0.5;
  let st = { ...s, tactic };
  let mineXg = 0;
  let oppXg = 0;
  for (let k = s.done; k < TOUR_LIVE.segments; k++) {
    const xg = tourSegmentXg(st, tourLiveMine(st, cards, rules), opp, tactic);
    mineXg += xg.mine;
    oppXg += xg.opp;
    st = {
      ...st,
      stamina: st.stamina.map((x) => tourDrained(x, tactic)),
      oppStamina: st.oppStamina.map((x) => tourDrained(x, st.oppTactic)),
    };
  }
  const a = pmf(mineXg);
  const b = pmf(oppXg);
  let p = 0;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) {
      const d = diff + i - j;
      p += a[i]! * b[j]! * (d > 0 ? 1 : d === 0 ? 0.5 : 0);
    }
  return p;
}

/** 다음 구간을 치른다. 구간이 끝나면 체력이 빠지고, 남은 구간이 있으면 AI 구단이 전술을 고친다. */
export function playTourSegment(
  s: TourLive,
  cards: readonly LineupCareer[],
  rules: readonly TourRule[],
  opp: readonly LineupSlot[],
): TourLive {
  if (tourLiveOver(s)) return s;
  const mine = tourLiveMine(s, cards, rules);
  const xg = tourSegmentXg(s, mine, opp);
  const rng = rngOf(seedOf(`${s.seed}:seg:${s.done}`));
  const gf = poisson(xg.mine, rng);
  const ga = poisson(xg.opp, rng);
  const span = 90 / TOUR_LIVE.segments;
  const fresh: SimEvent[] = [];
  addGoalEvents(fresh, 'away', mine, gf, rng);
  addGoalEvents(fresh, 'home', opp, ga, rng);
  // addGoalEvents는 1~90분을 뽑는다 → 이 구간 안의 분으로 옮긴다.
  const events = fresh
    .map((e) => ({ ...e, minute: Math.floor(s.done * span + 1 + ((e.minute - 1) * span) / 90) }))
    .sort((x, y) => x.minute - y.minute);
  const done = s.done + 1;
  const goalsFor = s.goalsFor + gf;
  const goalsAgainst = s.goalsAgainst + ga;
  return {
    ...s,
    done,
    goalsFor,
    goalsAgainst,
    events: [...s.events, ...events],
    stamina: s.stamina.map((st) => tourDrained(st, s.tactic)),
    oppStamina: s.oppStamina.map((st) => tourDrained(st, s.oppTactic)),
    oppTactic:
      done < TOUR_LIVE.segments ? tourAiTactic(s.oppStart, goalsAgainst - goalsFor) : s.oppTactic,
  };
}

/** 작전 타임에 받는 지시: 전술과 교체(선발 자리 번호 ← 교체 명단 카드 id). */
export type TourOrder = { tactic?: TourTactic; subs?: readonly { slot: number; cardId: string }[] };
export type TourOrderError = 'over' | 'subs' | 'bench' | 'slot' | 'rule';

/** 작전 타임 지시를 반영한다. 받아들일 수 없으면 이유를 돌려준다(상태는 그대로). */
export function applyTourOrder(
  s: TourLive,
  order: TourOrder,
  cards: readonly LineupCareer[],
  rules: readonly TourRule[],
): TourLive | TourOrderError {
  if (tourLiveOver(s) || s.done === 0) return 'over';
  const subs = order.subs ?? [];
  if (subs.length > s.subsLeft) return 'subs';
  const slotIds = [...s.slotIds];
  const stamina = [...s.stamina];
  let bench = [...s.bench];
  for (const sub of subs) {
    if (!bench.includes(sub.cardId)) return 'bench';
    if (!Number.isInteger(sub.slot) || sub.slot < 0 || sub.slot >= slotIds.length) return 'slot';
    slotIds[sub.slot] = sub.cardId;
    stamina[sub.slot] = 100;
    // 나간 선수는 돌아오지 못한다.
    bench = bench.filter((id) => id !== sub.cardId);
  }
  // 출전 제한은 지금 뛰는 11명으로 본다.
  const byId = new Map(cards.map((c) => [c.id, c]));
  const on = slotIds.filter((id): id is string => id !== null).map((id) => byId.get(id));
  if (on.some((c) => !c) || new Set(slotIds.filter(Boolean)).size !== on.length) return 'slot';
  if (
    !tourLineupOk(
      rules,
      on.map((c) => tourCardOf(c!)),
      s.season,
    )
  )
    return 'rule';
  return {
    ...s,
    slotIds,
    stamina,
    bench,
    subsLeft: s.subsLeft - subs.length,
    tactic: order.tactic ?? s.tactic,
  };
}

/** 끝난 경기의 승패. 90분 무승부는 승부차기로 가른다(그때 뛰고 있던 선수로). */
export function tourLiveResult(
  s: TourLive,
  cards: readonly LineupCareer[],
  rules: readonly TourRule[],
  opp: readonly LineupSlot[],
): { win: boolean; pens: boolean } {
  if (s.goalsFor !== s.goalsAgainst) return { win: s.goalsFor > s.goalsAgainst, pens: false };
  const pens = penaltyShootout(s.seed, opp, tourLiveMine(s, cards, rules));
  return { win: pens.away > pens.home, pens: true };
}

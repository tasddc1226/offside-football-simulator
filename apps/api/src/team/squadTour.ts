// T-11-825 원정 투어 경기 계산. AI 구단은 DB 없이 자리 실력만으로 만든 선발이고, 경기는 랭크와 같은 엔진(sim.ts)으로 굴린다.
// 원정이라 AI 구단이 홈 이점을 받는다. 비기면 승부차기로 가른다(다시 도전을 줄인다).
import { FORMATIONS, YOUTH_NAME, type FormationId } from '@offside/contracts/owner-team';
import { tourAutoPick } from '@offside/contracts/squad-tour-lineup';
import {
  TOUR,
  tourClub,
  tourLineupOk,
  tourOpp,
  tourPlain,
  type TourCard,
  type TourRule,
} from '@offside/contracts/squad-tour';
import { tourClubs as KO_CLUBS } from '../i18n/ko/tourClubs.js';
import {
  buildLineup,
  matchOdds,
  penaltyShootout,
  rngOf,
  seedOf,
  simulateMatch,
  type LineupCareer,
  type LineupSlot,
} from './sim.js';

/** AI 구단이 쓰는 포메이션(주 · 경기 번호로 고른다). */
const AI_FORMATIONS: readonly FormationId[] = ['4-3-3', '4-4-2', '3-5-2'];

/** n번째 경기 AI 구단의 포메이션(tourOpponent와 같은 값). */
export const tourOppFormation = (week: string, stage: number): FormationId =>
  AI_FORMATIONS[Math.floor(rngOf(seedOf(`tour:${week}:${stage}`))() * AI_FORMATIONS.length)]!;

/** n번째 경기의 AI 구단 선발. 선수 이름은 그 주 그 경기의 상대 구단(tourClub) 명단이다. 자리 실력은 목표 평균 ±2 안에서 흩고 합을 목표에 맞춘다. 같은 주 · 같은 경기면 모두에게 같다. */
export function tourOpponent(week: string, stage: number): LineupSlot[] {
  const rng = rngOf(seedOf(`tour:${week}:${stage}`));
  const formation = AI_FORMATIONS[Math.floor(rng() * AI_FORMATIONS.length)]!;
  const target = tourOpp(stage);
  const names = KO_CLUBS[tourClub(week, stage)];
  const jitter = FORMATIONS[formation].map(() => Math.round(rng() * 4 - 2));
  const drift = Math.round(jitter.reduce((a, b) => a + b, 0) / jitter.length);
  return FORMATIONS[formation].map((slot, i) => ({
    slot,
    careerId: null,
    pos: null,
    rating: target + jitter[i]! - drift,
    fit: 1,
    ref: { careerId: null, anon: names[i] ?? YOUTH_NAME },
    publicName: null,
    syn: null,
  }));
}

/** 제한을 따질 카드 값. */
export const tourCardOf = (c: LineupCareer): TourCard => ({
  peak: c.peak,
  enhance: c.enhance ?? 0,
  season: c.season ?? 0,
  nation: c.nation ?? null,
  type: c.type ?? null,
  mainLeague: c.mainLeague ?? null,
});

/** 강화 OVR을 빼고 재는 경기면 강화 단계를 0으로 본 카드. */
const forRules = (c: LineupCareer, rules: readonly TourRule[]): LineupCareer =>
  tourPlain(rules) ? { ...c, enhance: 0 } : c;

/**
 * 제한 아래에서 뛸 수 있는 카드로 자리마다 가장 잘 맞는 선수를 놓는다(계산은 화면과 같은 contracts의 tourAutoPick). 시뮬레이션이
 * 쓴다. 놓을 카드가 없으면 빈 자리(null)로 두고 현지 용병이 뛴다.
 */
export const tourAutoSlots = (
  formation: FormationId,
  cards: readonly LineupCareer[],
  rules: readonly TourRule[],
  season: number,
  merc: number,
): (string | null)[] =>
  tourAutoPick(
    formation,
    cards.map((c) => ({
      ...c,
      season: c.season ?? 0,
      nation: c.nation ?? null,
      mainLeague: c.mainLeague ?? null,
    })),
    rules,
    season,
    merc,
  );

/**
 * 그 편성의 선발(제한을 반영한 자리 실력). 빈 자리는 유스 선수 대신 현지 용병(merc 실력)이 뛴다 — 카드가 적은 구단주도 제한 때문에
 * 경기가 성립하지 않는 일이 없게 한다.
 */
export function tourLineup(
  formation: FormationId,
  slotIds: readonly (string | null)[],
  cards: readonly LineupCareer[],
  rules: readonly TourRule[],
  merc: number,
): LineupSlot[] {
  return buildLineup(formation, slotIds, new Map(cards.map((c) => [c.id, forRules(c, rules)]))).map(
    (s) => (s.careerId === null ? { ...s, rating: merc } : s),
  );
}

/** 편성이 받아들여지지 않는 이유. */
export type TourSlotsError = 'shape' | 'duplicate' | 'notOwned' | 'rule';

/**
 * 서버가 경기를 시작하기 전에 보는 편성 검사. cards에는 지금 그 구단주가 가진(방출 · 판매 등록되지 않은) 카드만 넣는다 — 여기 없는
 * id는 남의 카드거나 이미 떠난 카드다. 통과하면 null. 경기 한 판의 도전권 차감 · 결과 · 첫 승리 대전료는 서버가 만든 도전 id 하나에
 * 묶어 한 번만 반영한다(같은 요청이 다시 와도, 자정에 걸쳐도).
 */
export function tourSlotsError(
  formation: FormationId,
  slotIds: readonly (string | null)[],
  cards: readonly LineupCareer[],
  rules: readonly TourRule[],
  season: number,
): TourSlotsError | null {
  if (slotIds.length !== FORMATIONS[formation].length) return 'shape';
  const ids = slotIds.filter((id): id is string => id !== null);
  if (new Set(ids).size !== ids.length) return 'duplicate';
  const byId = new Map(cards.map((c) => [c.id, c]));
  const picked = ids.map((id) => byId.get(id));
  if (picked.some((c) => !c)) return 'notOwned';
  return tourLineupOk(
    rules,
    picked.map((c) => tourCardOf(c!)),
    season,
  )
    ? null
    : 'rule';
}

/**
 * 한 판을 이길 가망(난수 없이): 90분 승 + 무승부의 절반. 화면의 경기 전 예상과 진 뒤 편성 비교(다른 편성이면 얼마나 달라지는지)에 쓴다.
 */
export function tourWinChance(
  mine: readonly LineupSlot[],
  opp: readonly LineupSlot[],
  season: number,
  atkK: number = TOUR.atkK,
): number {
  const o = matchOdds(opp, mine, season, { atkK });
  return o.loss + o.draw / 2;
}

export type TourMatch = {
  win: boolean;
  goalsFor: number;
  goalsAgainst: number;
  /** 90분 무승부라 승부차기로 갈랐는가. */
  pens: boolean;
};

/** 원정 한 판. seed는 경기 id. AI 구단이 홈이다. */
export function playTourMatch(
  seed: string,
  mine: readonly LineupSlot[],
  opp: readonly LineupSlot[],
  season: number,
  atkK: number = TOUR.atkK,
): TourMatch {
  const r = simulateMatch(seed, opp, mine, season, { atkK });
  if (r.homeGoals !== r.awayGoals)
    return {
      win: r.awayGoals > r.homeGoals,
      goalsFor: r.awayGoals,
      goalsAgainst: r.homeGoals,
      pens: false,
    };
  const pens = penaltyShootout(seed, opp, mine);
  return {
    win: pens.away > pens.home,
    goalsFor: r.awayGoals,
    goalsAgainst: r.homeGoals,
    pens: true,
  };
}

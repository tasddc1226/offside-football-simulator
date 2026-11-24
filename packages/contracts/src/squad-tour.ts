/**
 * T-11-825 원정 투어(주간 스쿼드 챌린지) 규칙. 매주 같은 AI 구단 사다리를 차례로 원정 가서 이기고, 경기마다 붙는 출전 제한에
 * 맞춰 가진 카드로 팀을 새로 짠다. 제한에 맞지 않는 카드는 뛰지 못하고 빈 자리는 현지 용병이 채운다(입장 요건이 아니다).
 * 여기에는 제한 · 단계 · 점수 · 대전료의 정의만 둔다. 경기 계산은 apps/api/src/team/squadTour.ts.
 * zod가 없는 서브패스(`@offside/contracts/squad-tour`)라 웹 · 앱 번들에 넣어도 가볍다.
 */
import { DEFAULT_NATION } from './nations.js';

/** 제한을 따질 때 보는 카드 값(모두 cards · careers에 이미 있는 값). */
export type TourCard = {
  peak: number;
  enhance: number;
  /** 카드 시즌(cards.service_season, 0 = 프리시즌). */
  season: number;
  /** 국적(null은 기본 국적으로 센다 — 팀 시너지와 같은 기준). */
  nation: string | null;
  type: string | null;
  mainLeague: string | null;
};

/**
 * 출전 제한. 앞의 다섯은 카드 한 장으로 가르고(eligible), 뒤의 셋은 선발 전체에서 센다(cap).
 * - peakMax: 최고 OVR이 max 이하인 카드만
 * - enhanceMax: 강화 단계가 max 이하인 카드만
 * - plain: 모든 카드가 뛰지만 강화 OVR을 빼고 잰다
 * - season: 이번 시즌 카드만('now') · 이번 시즌보다 앞선 모든 시즌(프리시즌 포함) 카드만('past')
 * - leagueBan: 그 리그 출신은 뛰지 못한다
 * - typeCap · nationCap · leagueCap: 같은 유형 · 같은 국적 · 그 리그 출신을 max명까지만
 */
export type TourRule =
  | { kind: 'peakMax'; max: number }
  | { kind: 'enhanceMax'; max: number }
  | { kind: 'plain' }
  | { kind: 'season'; when: 'now' | 'past' }
  | { kind: 'leagueBan'; league: string }
  | { kind: 'typeCap'; max: number }
  | { kind: 'nationCap'; max: number }
  | { kind: 'leagueCap'; league: string; max: number };

/** 카드 한 장이 그 제한 아래에서 뛸 수 있는가(선발 전체 제한은 늘 true). season은 지금 서비스 시즌. */
export function tourEligible(rule: TourRule, card: TourCard, season: number): boolean {
  switch (rule.kind) {
    case 'peakMax':
      return card.peak <= rule.max;
    case 'enhanceMax':
      return card.enhance <= rule.max;
    case 'season':
      return rule.when === 'now' ? card.season === season : card.season < season;
    case 'leagueBan':
      return card.mainLeague !== rule.league;
    default:
      return true;
  }
}

/** 선발 전체 제한에서 그 카드가 속한 묶음 키(같은 키는 max명까지). 그 제한과 상관없는 카드는 null. */
export function tourCapKey(rule: TourRule, card: TourCard): string | null {
  switch (rule.kind) {
    case 'typeCap':
      return card.type ?? null;
    case 'nationCap':
      return card.nation ?? DEFAULT_NATION;
    case 'leagueCap':
      return card.mainLeague === rule.league ? rule.league : null;
    default:
      return null;
  }
}
export const tourCapMax = (rule: TourRule): number | null =>
  rule.kind === 'typeCap' || rule.kind === 'nationCap' || rule.kind === 'leagueCap'
    ? rule.max
    : null;

/** 강화 OVR을 빼고 재는 경기인가. */
export const tourPlain = (rules: readonly TourRule[]): boolean =>
  rules.some((r) => r.kind === 'plain');

/**
 * 선발(카드 목록)이 제한을 모두 지키는가. 카드 소유 · 같은 카드 중복은 여기서 보지 않는다 — 서버가 경기를 시작할 때 함께
 * 확인한다(apps/api squadTour.ts tourSlotsError).
 */
export function tourLineupOk(
  rules: readonly TourRule[],
  cards: readonly TourCard[],
  season: number,
): boolean {
  for (const rule of rules) {
    const max = tourCapMax(rule);
    const seen = new Map<string, number>();
    for (const c of cards) {
      if (!tourEligible(rule, c, season)) return false;
      if (max === null) continue;
      const key = tourCapKey(rule, c);
      if (key === null) continue;
      const n = (seen.get(key) ?? 0) + 1;
      if (n > max) return false;
      seen.set(key, n);
    }
  }
  return true;
}

/** 본선 경기 수. 그 뒤는 무한 원정이다. */
export const TOUR_MAIN_STAGES = 7;
/** 하루 도전 횟수(한국 시각 자정에 다시 찬다). */
export const TOUR_TRIES_PER_DAY = 3;

/**
 * 조절 수치. 시뮬레이션(apps/api squadTour.sim)으로 맞춘 값이고, 운영 중 조절할 값은 밸런스 키로 옮긴다.
 * - opp: 본선 상대의 자리 실력 평균
 * - endlessStep: 무한 원정에서 경기마다 오르는 상대 실력
 * - fee: 본선 대전료(만 원) — 그 경기를 처음 이겼을 때 한 번 받는다. 진 경기 · 이미 이긴 경기는 받지 않는다.
 * - endlessFee: 무한 원정 한 경기 대전료(만 원, 같은 조건)
 */
export const TOUR = {
  opp: [70, 76, 82, 86, 90, 93, 96],
  endlessStep: 1,
  /** 빈 자리를 채우는 현지 용병의 실력 = 그 경기 상대 실력 − mercGap, 많아야 mercCap. */
  mercGap: 12,
  mercCap: 80,
  fee: [500000, 650000, 900000, 1100000, 1350000, 1600000, 1900000],
  endlessFee: 500000,
  /** 공격 계수. 랭크 계수(밸런스 rankAtkK)가 시즌 중 바뀌어도 한 주 안의 난도가 흔들리지 않게 투어는 따로 둔다. */
  atkK: 0.55,
  /** 점수: 경기 번호 × base + 골득실(0~gdCap) × gd + 첫 도전 승리 first. 승부차기 승은 골득실 0으로 센다. */
  score: { base: 100, gd: 10, gdCap: 3, first: 50 },
} as const;

/** n번째 경기(1부터) 상대의 자리 실력 평균. */
export const tourOpp = (stage: number): number =>
  stage <= TOUR_MAIN_STAGES
    ? TOUR.opp[stage - 1]!
    : TOUR.opp[TOUR_MAIN_STAGES - 1]! + TOUR.endlessStep * (stage - TOUR_MAIN_STAGES);

/** n번째 경기에서 빈 자리를 채우는 현지 용병의 자리 실력. */
export const tourMerc = (stage: number): number =>
  Math.min(TOUR.mercCap, tourOpp(stage) - TOUR.mercGap);

/** n번째 경기를 처음 이기면 받는 대전료(만 원). */
export const tourFee = (stage: number): number =>
  stage <= TOUR_MAIN_STAGES ? TOUR.fee[stage - 1]! : TOUR.endlessFee;

/** n번째 경기를 이겼을 때의 점수. goalDiff는 90분 골득실(승부차기 승은 0), tries는 그 경기 도전 횟수(이긴 판 포함). */
export function tourScore(stage: number, goalDiff: number, tries: number): number {
  const s = TOUR.score;
  return (
    stage * s.base + Math.min(s.gdCap, Math.max(0, goalDiff)) * s.gd + (tries === 1 ? s.first : 0)
  );
}

/**
 * 주간 순위 값. score는 그 주에 이긴 모든 경기 점수의 합, triesAtScore는 그 점수에 이를 때까지 쓴 도전 수, reachedAt은 그 점수에
 * 이른 서버 시각(ISO). 뒤의 둘은 마지막으로 이긴 순간의 값이라, 그 뒤에 진 경기로는 순위가 내려가지 않는다.
 */
export type TourStanding = { score: number; triesAtScore: number; reachedAt: string };

/** 주간 순위 비교(앞이 위면 음수): 점수 → 도전 수가 적은 쪽 → 먼저 이른 쪽. 전체를 이 순서로 세운 뒤 위에서 자른다. */
export const tourRankCompare = (a: TourStanding, b: TourStanding): number =>
  b.score - a.score ||
  a.triesAtScore - b.triesAtScore ||
  (a.reachedAt < b.reachedAt ? -1 : a.reachedAt > b.reachedAt ? 1 : 0);

/**
 * 주마다 뽑는 제한 후보. light는 본선 1~2차전, mid는 3~5차전, late는 6~7차전, extra는 무한 원정에만 나온다(무한 원정은 mid도 쓴다).
 * 본선 대전료는 편성을 바꿔서 닿을 수 있어야 하므로, 강화 · 높은 OVR 카드를 통째로 막거나 팀을 크게 깎는 제한은 extra에만 둔다.
 * 이번 시즌 카드가 적으면 용병으로만 뛰게 되는 시즌 제한은 6~7차전에 두지 않는다.
 */
export const TOUR_POOL: {
  light: readonly TourRule[];
  mid: readonly TourRule[];
  late: readonly TourRule[];
  extra: readonly TourRule[];
} = {
  light: [
    { kind: 'typeCap', max: 3 },
    { kind: 'peakMax', max: 96 },
    { kind: 'leagueCap', league: 'pl', max: 6 },
    { kind: 'leagueBan', league: 'll' },
    { kind: 'nationCap', max: 6 },
  ],
  mid: [
    { kind: 'typeCap', max: 2 },
    { kind: 'leagueCap', league: 'pl', max: 5 },
    { kind: 'enhanceMax', max: 5 },
    { kind: 'plain' },
    { kind: 'nationCap', max: 5 },
    { kind: 'season', when: 'now' },
    { kind: 'leagueBan', league: 'bl' },
  ],
  late: [
    { kind: 'typeCap', max: 2 },
    { kind: 'leagueCap', league: 'pl', max: 5 },
    { kind: 'enhanceMax', max: 5 },
    { kind: 'plain' },
    { kind: 'nationCap', max: 5 },
    { kind: 'leagueBan', league: 'bl' },
  ],
  extra: [
    { kind: 'leagueCap', league: 'pl', max: 3 },
    { kind: 'enhanceMax', max: 2 },
    { kind: 'peakMax', max: 95 },
    { kind: 'peakMax', max: 92 },
    { kind: 'nationCap', max: 4 },
    { kind: 'season', when: 'past' },
    { kind: 'leagueBan', league: 'pl' },
  ],
};

/** 문자열 → [0, 1) 난수열(FNV-1a 시드 + mulberry32). 같은 주 id면 모두에게 같은 투어다. */
function rngOf(key: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(xs: readonly T[], rng: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** 본선 7경기의 제한(종류가 서로 다르다). 섞은 후보에서 되짚어 가며 고르므로 후보가 모자라 겹치는 일이 없다. */
function mainRules(week: string): TourRule[] {
  const rng = rngOf(week);
  const pools = Array.from({ length: TOUR_MAIN_STAGES }, (_, i) =>
    shuffled(i < 2 ? TOUR_POOL.light : i < 5 ? TOUR_POOL.mid : TOUR_POOL.late, rng),
  );
  const out: TourRule[] = [];
  const fill = (i: number): boolean => {
    if (i === TOUR_MAIN_STAGES) return true;
    for (const r of pools[i]!) {
      if (out.some((u) => u.kind === r.kind)) continue;
      out.push(r);
      if (fill(i + 1)) return true;
      out.pop();
    }
    return false;
  };
  if (!fill(0)) throw new Error('tour rule pool cannot fill distinct kinds');
  return out;
}

/**
 * 그 주(week = 한국 시각 월요일 날짜)의 n번째 경기 제한. 본선은 경기마다 하나씩이고 한 주 본선 안에서는 같은 종류가 겹치지
 * 않는다. 무한 원정은 mid · extra 후보 가운데 하나다. 서버는 주가 열릴 때 이 결과를 한 번 저장해 두고 모두에게 같은 것을 준다.
 */
export function tourRules(week: string, stage: number): TourRule[] {
  if (stage > TOUR_MAIN_STAGES) {
    const rng = rngOf(`${week}:${stage}`);
    const pool = [...TOUR_POOL.mid, ...TOUR_POOL.extra];
    return [pool[Math.floor(rng() * pool.length)]!];
  }
  return [mainRules(week)[stage - 1]!];
}

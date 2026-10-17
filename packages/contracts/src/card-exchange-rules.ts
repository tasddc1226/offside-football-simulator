// T-11-374 카드 바치기 과제. 이번 주 과제 목록 · 조건 판정 · 맞는 카드 고르기를 서버와 화면이 같이 쓴다(zod 없음).
// 과제는 코드에 둔 묶음을 주마다 차례로 연다. 서버를 부르지 않고도 화면이 같은 목록을 그린다(이름은 화면 사전의 key).
import { DAY_MS, KST_MS } from './kst.js';
import type { CareerPos } from './careers.js';
import type { OwnerItem } from './cup.js';

export const EXCHANGE_TIERS = ['easy', 'normal', 'hard', 'season'] as const;
export type ExchangeTier = (typeof EXCHANGE_TIERS)[number];

/** 낸 카드 묶음이 모두 맞아야 하는 조건. 비어 있는 칸은 따지지 않는다. */
export type ExchangeRule = {
  /** 장수(정확히). */
  count: number;
  /** 모든 카드가 이 포지션 중 하나. */
  pos?: readonly CareerPos[];
  /** 포지션별 장수(정확히). 합이 count와 같다. */
  shape?: Partial<Record<CareerPos, number>>;
  /** 모든 카드의 최고 OVR 범위. */
  peakMin?: number;
  peakMax?: number;
  /** 묶음 평균 최고 OVR 이상. */
  avgPeakMin?: number;
  /** 모두 같은 국적. */
  sameNation?: boolean;
  /** 레전드 점수가 이 값 이상인 카드를 한 장 이상 포함. */
  legendOne?: number;
  /** 모든 카드의 출신 서비스 시즌이 이 중 하나. 'prev' = 지난 시즌 · 'now' = 이번 시즌. */
  seasons?: readonly (number | 'prev' | 'now')[];
  /** 모든 카드의 주발('왼발' · '오른발' · '양발', 저장값). */
  foot?: string;
};

export type ExchangeReward = { item: OwnerItem; qty: number };

/** 과제 묶음의 한 칸. key는 화면 사전의 이름 · 설명 키다. */
export type ExchangeSpec = {
  key: string;
  rule: ExchangeRule;
  reward: readonly ExchangeReward[];
};

export type ExchangeDef = ExchangeSpec & {
  /** 이번 주 과제면 '2026-10-19-easy', 시즌 과제면 's1-season'. 남은 횟수는 이 id로 센다. */
  id: string;
  tier: ExchangeTier;
  maxClaims: number;
  startsAt: string;
  /** 시즌 과제는 null(시즌 마감까지). */
  endsAt: string | null;
};

/** 과제 한 칸에서 한 주(시즌 과제는 한 시즌)에 낼 수 있는 횟수. */
export const EXCHANGE_MAX_CLAIMS: Record<ExchangeTier, number> = {
  easy: 3,
  normal: 2,
  hard: 1,
  season: 1,
};

const reroll2 = [{ item: 'reroll', qty: 2 }] as const;
const boost1 = [{ item: 'boost', qty: 1 }] as const;
const scout1 = [{ item: 'scout', qty: 1 }] as const;

/** 주마다 칸별로 다음 과제를 연다(칸마다 묶음 길이가 달라도 된다). */
export const EXCHANGE_POOL: Record<Exclude<ExchangeTier, 'season'>, readonly ExchangeSpec[]> = {
  easy: [
    { key: 'keepers', rule: { count: 3, pos: ['GK'] }, reward: reroll2 },
    {
      key: 'midWorkers',
      rule: { count: 4, pos: ['MF'], peakMin: 70, peakMax: 79 },
      reward: reroll2,
    },
    { key: 'backline', rule: { count: 4, pos: ['DF'], peakMax: 79 }, reward: reroll2 },
    { key: 'founders', rule: { count: 3, seasons: [0] }, reward: reroll2 },
    { key: 'strikers', rule: { count: 4, pos: ['FW'], peakMax: 79 }, reward: reroll2 },
    // i18n-ignore: 주발은 커리어 저장값(한국어) 그대로 비교한다
    { key: 'leftFoot', rule: { count: 3, foot: '왼발' }, reward: reroll2 },
  ],
  normal: [
    { key: 'nationalCall', rule: { count: 5, sameNation: true }, reward: boost1 },
    {
      key: 'spine',
      rule: { count: 5, shape: { GK: 1, DF: 2, MF: 2 }, avgPeakMin: 75 },
      reward: boost1,
    },
    {
      key: 'frontLine',
      rule: { count: 5, shape: { MF: 2, FW: 3 }, avgPeakMin: 77 },
      reward: boost1,
    },
    { key: 'veterans', rule: { count: 6, peakMin: 80 }, reward: boost1 },
  ],
  hard: [
    {
      key: 'bestEleven',
      rule: { count: 11, shape: { GK: 1, DF: 4, MF: 3, FW: 3 }, avgPeakMin: 80 },
      reward: scout1,
    },
    { key: 'legendGift', rule: { count: 7, legendOne: 600, avgPeakMin: 78 }, reward: scout1 },
    { key: 'oneNation', rule: { count: 11, sameNation: true }, reward: scout1 },
  ],
};

/** 시즌 과제(시즌마다 한 번). 지난 시즌 · 이번 시즌 카드 11장, 레전드 점수 800 이상 한 장 포함. */
export const SEASON_EXCHANGE: ExchangeSpec = {
  key: 'legacy',
  rule: { count: 11, seasons: ['prev', 'now'], legendOne: 800 },
  reward: [{ item: 'scout', qty: 2 }],
};

const WEEK_MS = 7 * DAY_MS;

/** 이번 주(월요일 0시 KST 시작)의 KST 날짜 키와 UTC ISO 경계. */
export function exchangeWeek(nowIso: string): { key: string; startsAt: string; endsAt: string } {
  const k = new Date(Date.parse(nowIso) + KST_MS);
  k.setUTCHours(0, 0, 0, 0);
  const start = k.getTime() - ((k.getUTCDay() + 6) % 7) * DAY_MS;
  return {
    key: new Date(start).toISOString().slice(0, 10),
    startsAt: new Date(start - KST_MS).toISOString(),
    endsAt: new Date(start + WEEK_MS - KST_MS).toISOString(),
  };
}

/** 1970-01-05(월)부터 센 주 번호. 묶음 순서를 주마다 하나씩 넘긴다. */
const weekIndex = (key: string) =>
  Math.round((Date.parse(key) - Date.parse('1970-01-05')) / WEEK_MS);

/** 지금 열린 과제(쉬움 · 보통 · 어려움, 시즌 중이면 시즌 과제). season은 지금 서비스 시즌(휴식기면 null). */
export function exchangesAt(nowIso: string, season: number | null): ExchangeDef[] {
  const week = exchangeWeek(nowIso);
  const n = weekIndex(week.key);
  const out: ExchangeDef[] = (['easy', 'normal', 'hard'] as const).map((tier) => {
    const pool = EXCHANGE_POOL[tier];
    return {
      ...pool[n % pool.length]!,
      id: `${week.key}-${tier}`,
      tier,
      maxClaims: EXCHANGE_MAX_CLAIMS[tier],
      startsAt: week.startsAt,
      endsAt: week.endsAt,
    };
  });
  if (season !== null && season >= 1)
    out.push({
      ...SEASON_EXCHANGE,
      rule: resolveSeasons(SEASON_EXCHANGE.rule, season),
      id: `s${season}-season`,
      tier: 'season',
      maxClaims: EXCHANGE_MAX_CLAIMS.season,
      startsAt: week.startsAt,
      endsAt: null,
    });
  return out;
}

/** 'prev' · 'now'를 시즌 번호로 바꾼다. */
function resolveSeasons(rule: ExchangeRule, season: number): ExchangeRule {
  if (!rule.seasons) return rule;
  return {
    ...rule,
    seasons: rule.seasons.map((s) => (s === 'prev' ? season - 1 : s === 'now' ? season : s)),
  };
}

export const exchangeById = (nowIso: string, season: number | null, id: string) =>
  exchangesAt(nowIso, season).find((d) => d.id === id) ?? null;

/** 조건 판정에 쓰는 카드 값(서버 카드 행 · 화면 TeamPlayer가 같은 모양으로 넘긴다). */
export type ExchangeCard = {
  careerId: string;
  pos: CareerPos;
  nation?: string | null;
  peak: number;
  legendScore?: number | null;
  season?: number;
  foot?: string | null;
};

export const EXCHANGE_CONDITIONS = [
  'count',
  'pos',
  'shape',
  'peak',
  'avgPeak',
  'sameNation',
  'legendOne',
  'seasons',
  'foot',
] as const;
export type ExchangeCondition = (typeof EXCHANGE_CONDITIONS)[number];

/** 카드 한 장이 묶음 전체 조건과 상관없이 혼자 맞아야 하는 조건(포지션 · 최고 OVR 범위 · 시즌 · 주발). */
export function cardFits(rule: ExchangeRule, c: ExchangeCard): boolean {
  if (rule.pos && !rule.pos.includes(c.pos)) return false;
  if (rule.shape && !rule.shape[c.pos]) return false;
  if (rule.peakMin !== undefined && c.peak < rule.peakMin) return false;
  if (rule.peakMax !== undefined && c.peak > rule.peakMax) return false;
  if (rule.seasons && !rule.seasons.includes(c.season ?? 0)) return false;
  if (rule.foot && c.foot !== rule.foot) return false;
  return true;
}

/** 조건마다 채워졌는지(화면 체크리스트 · 서버 판정이 같은 결과를 쓴다). 규칙에 없는 조건은 빠진다. */
export function exchangeChecks(
  rule: ExchangeRule,
  picked: readonly ExchangeCard[],
): { condition: ExchangeCondition; met: boolean }[] {
  const out: { condition: ExchangeCondition; met: boolean }[] = [
    { condition: 'count', met: picked.length === rule.count },
  ];
  const each = (ok: (c: ExchangeCard) => boolean) => picked.length > 0 && picked.every(ok);
  if (rule.pos) out.push({ condition: 'pos', met: each((c) => rule.pos!.includes(c.pos)) });
  if (rule.shape) {
    const shape = rule.shape;
    const met = (Object.keys(shape) as CareerPos[]).every(
      (p) => picked.filter((c) => c.pos === p).length === shape[p],
    );
    out.push({ condition: 'shape', met: met && each((c) => !!shape[c.pos]) });
  }
  if (rule.peakMin !== undefined || rule.peakMax !== undefined)
    out.push({
      condition: 'peak',
      met: each((c) => c.peak >= (rule.peakMin ?? 0) && c.peak <= (rule.peakMax ?? 999)),
    });
  if (rule.avgPeakMin !== undefined)
    out.push({
      condition: 'avgPeak',
      met: picked.length > 0 && avgPeak(picked) >= rule.avgPeakMin,
    });
  if (rule.sameNation)
    out.push({
      condition: 'sameNation',
      met: each((c) => !!c.nation && c.nation === picked[0]!.nation),
    });
  if (rule.legendOne !== undefined)
    out.push({
      condition: 'legendOne',
      met: picked.some((c) => (c.legendScore ?? 0) >= rule.legendOne!),
    });
  if (rule.seasons)
    out.push({ condition: 'seasons', met: each((c) => rule.seasons!.includes(c.season ?? 0)) });
  if (rule.foot) out.push({ condition: 'foot', met: each((c) => c.foot === rule.foot) });
  return out;
}

export const avgPeak = (cards: readonly ExchangeCard[]) =>
  cards.length ? cards.reduce((a, c) => a + c.peak, 0) / cards.length : 0;

/** 고른 카드 묶음이 과제를 채우는가(장수 · 중복 포함). */
export function exchangeMet(rule: ExchangeRule, picked: readonly ExchangeCard[]): boolean {
  return (
    new Set(picked.map((c) => c.careerId)).size === picked.length &&
    exchangeChecks(rule, picked).every((x) => x.met)
  );
}

/**
 * "맞는 카드로 채우기": 낼 수 있는 카드 중 혼자 맞는 카드를 가치가 낮은 순으로 골라 조건을 채운다. 포지션 구성은 자리마다,
 * 같은 국적은 가장 많은 국적에서, 레전드 점수 한 장은 그 조건을 채우는 가장 싼 카드부터 넣는다. 평균 OVR이 모자라면
 * 고른 카드 중 가장 낮은 카드를 남은 카드 중 더 높은 카드로 바꾼다. 못 채우면 null.
 */
export function autoFill<T extends ExchangeCard & { cardValue?: number | null }>(
  rule: ExchangeRule,
  cards: readonly T[],
): T[] | null {
  const value = (c: T) => c.cardValue ?? 0;
  const fit = cards.filter((c) => cardFits(rule, c)).sort((a, b) => value(a) - value(b));
  const groups: T[][] = [];
  if (rule.sameNation) {
    const by = new Map<string, T[]>();
    for (const c of fit) if (c.nation) by.set(c.nation, [...(by.get(c.nation) ?? []), c]);
    groups.push(...[...by.values()].sort((a, b) => b.length - a.length));
  } else groups.push(fit);
  for (const pool of groups) {
    const picked = pick(rule, pool);
    if (picked && exchangeMet(rule, picked)) return picked;
  }
  return null;
}

function pick<T extends ExchangeCard & { cardValue?: number | null }>(
  rule: ExchangeRule,
  pool: readonly T[],
): T[] | null {
  const chosen: T[] = [];
  const take = (c: T) => chosen.push(c);
  const left = () => pool.filter((c) => !chosen.includes(c));
  if (rule.legendOne !== undefined) {
    const star = pool.find((c) => (c.legendScore ?? 0) >= rule.legendOne!);
    if (!star) return null;
    take(star);
  }
  if (rule.shape) {
    for (const [p, n] of Object.entries(rule.shape) as [CareerPos, number][]) {
      const have = chosen.filter((c) => c.pos === p).length;
      const more = left()
        .filter((c) => c.pos === p)
        .slice(0, n - have);
      if (more.length < n - have) return null;
      more.forEach(take);
    }
  } else {
    const more = left().slice(0, rule.count - chosen.length);
    if (more.length < rule.count - chosen.length) return null;
    more.forEach(take);
  }
  if (rule.avgPeakMin === undefined) return chosen;
  // 평균이 모자라면 가장 낮은 카드를 같은 포지션(포지션 구성이 없으면 아무)의 더 높은 카드로 바꾼다.
  for (let guard = 0; guard < 64 && avgPeak(chosen) < rule.avgPeakMin; guard++) {
    const swappable = chosen.filter((c) => (rule.legendOne === undefined ? true : c !== chosen[0]));
    const low = swappable.sort((a, b) => a.peak - b.peak)[0];
    if (!low) return null;
    const up = left()
      .filter((c) => c.peak > low.peak && (!rule.shape || c.pos === low.pos))
      .sort((a, b) => a.peak - b.peak)[0];
    if (!up) return null;
    chosen[chosen.indexOf(low)] = up;
  }
  return avgPeak(chosen) >= rule.avgPeakMin ? chosen : null;
}

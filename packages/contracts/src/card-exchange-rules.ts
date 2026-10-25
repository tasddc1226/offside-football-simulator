// T-11-374 카드 바치기 과제. 오늘의 과제 목록 · 조건 판정 · 맞는 카드 고르기를 서버와 화면이 같이 쓴다(zod 없음).
// 과제는 코드에 둔 묶음을 하루마다 차례로 연다(0시 KST). 서버를 부르지 않고도 화면이 같은 목록을 그린다(이름은 화면 사전의 key).
// 보상은 과제마다가 아니라 오늘 과제 세 개를 모두 냈을 때 한 번 준다(일일 퀘스트). 직접 키워 은퇴시킨 선수만 낼 수 있다.
import { DAY_MS, KST_MS } from './kst.js';
import type { CareerPos } from './careers.js';
import type { OwnerItem } from './cup.js';
import type { DetailPos } from './positions.js';

export const EXCHANGE_TIERS = ['easy', 'normal', 'hard'] as const;
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
  /** 모든 카드의 출신 서비스 시즌이 이 중 하나(0 = 프리시즌). */
  seasons?: readonly number[];
  /** 모든 카드의 주발('왼발' · '오른발' · '양발', 저장값). */
  foot?: string;
  /** T-11-374d 모든 카드의 세부 포지션이 이 중 하나. 세부 포지션이 없는 프리시즌 카드는 맞지 않는다. */
  dpos?: readonly DetailPos[];
  /** T-11-374d 모두 가장 오래 뛴 프로 리그가 같다(리그를 모르는 카드는 맞지 않는다). */
  sameLeague?: boolean;
  /** T-11-374d 모두 국적이 다르다. */
  distinctNations?: boolean;
};

export type ExchangeReward = { item: OwnerItem; qty: number };

/** 과제 묶음의 한 칸. key는 화면 사전의 이름 · 설명 키다. */
export type ExchangeSpec = {
  key: string;
  rule: ExchangeRule;
};

export type ExchangeDef = ExchangeSpec & {
  /** 오늘(KST 날짜) 과제 id, 예: '2026-10-25-easy'. 낸 기록은 이 id로 센다. */
  id: string;
  tier: ExchangeTier;
  startsAt: string;
  endsAt: string;
};

/**
 * 오늘 과제 세 개를 모두 냈을 때 한 번 받는 보상. 수량은 운영 도구 밸런스 설정(카드 과제 묶음)의 활성 버전에서 온다.
 * 0장인 아이템은 빠진다.
 */
export const exchangeReward = (b: {
  exchangeRewardReroll: number;
  exchangeRewardBoost: number;
  exchangeRewardScout: number;
}): ExchangeReward[] =>
  (
    [
      { item: 'reroll', qty: b.exchangeRewardReroll },
      { item: 'boost', qty: b.exchangeRewardBoost },
      { item: 'scout', qty: b.exchangeRewardScout },
    ] as const
  ).filter((w) => w.qty > 0);

/** 하루마다 칸별로 다음 과제를 연다(칸마다 묶음 길이가 달라 날마다 조합이 바뀐다). */
export const EXCHANGE_POOL: Record<ExchangeTier, readonly ExchangeSpec[]> = {
  easy: [
    { key: 'keepers', rule: { count: 2, pos: ['GK'] } },
    { key: 'midWorkers', rule: { count: 3, pos: ['MF'], peakMin: 70, peakMax: 79 } },
    { key: 'backline', rule: { count: 3, pos: ['DF'], peakMax: 79 } },
    // T-11-374c 프리시즌 카드 2장(founders)은 새로 만들 수 없어 프리시즌 뒤 시작한 구단주가 오늘 과제를 끝낼 수 없었다. 같은 칸을
    // 누구나 가진 낮은 카드 과제로 바꿔 다른 날의 회전은 그대로 둔다.
    { key: 'quietFarewell', rule: { count: 3, peakMax: 74 } },
    { key: 'strikers', rule: { count: 3, pos: ['FW'], peakMax: 79 } },
    // i18n-ignore: 주발은 커리어 저장값(한국어) 그대로 비교한다
    { key: 'leftFoot', rule: { count: 3, foot: '왼발' } },
    // T-11-374d 여기부터 늘린 과제(POOL_GROWN). 묶음 뒤에만 더한다.
    { key: 'centerBacks', rule: { count: 2, dpos: ['CB', 'SW'] } },
    { key: 'wingers', rule: { count: 2, dpos: ['LW', 'RW', 'W', 'LM', 'RM'] } },
    // i18n-ignore: 주발은 커리어 저장값(한국어) 그대로 비교한다
    { key: 'twoFooted', rule: { count: 2, foot: '양발' } },
  ],
  normal: [
    { key: 'nationalCall', rule: { count: 4, sameNation: true } },
    { key: 'spine', rule: { count: 4, shape: { DF: 2, MF: 2 }, avgPeakMin: 75 } },
    { key: 'frontLine', rule: { count: 4, shape: { MF: 2, FW: 2 }, avgPeakMin: 77 } },
    { key: 'veterans', rule: { count: 4, peakMin: 80 } },
    { key: 'seasonOne', rule: { count: 4, seasons: [1] } },
    { key: 'worldTour', rule: { count: 4, distinctNations: true } },
    { key: 'leagueMates', rule: { count: 4, sameLeague: true } },
    { key: 'engineRoom', rule: { count: 4, dpos: ['DM', 'CM'], avgPeakMin: 75 } },
  ],
  hard: [
    {
      key: 'bestEleven',
      rule: { count: 7, shape: { GK: 1, DF: 2, MF: 2, FW: 2 }, avgPeakMin: 80 },
    },
    { key: 'legendGift', rule: { count: 5, legendOne: 600, avgPeakMin: 78 } },
    { key: 'oneNation', rule: { count: 6, sameNation: true, avgPeakMin: 78 } },
    { key: 'elite', rule: { count: 5, peakMin: 85 } },
    { key: 'worldSelect', rule: { count: 5, distinctNations: true, avgPeakMin: 80 } },
    { key: 'leagueStars', rule: { count: 5, sameLeague: true, avgPeakMin: 79 } },
  ],
};

/**
 * T-11-374d 과제를 늘린 날(KST). 그 전 날은 늘리기 전 묶음 길이로 돌아, 배포한 날 이미 연 과제가 하루 중간에 바뀌지 않는다.
 * 늘린 날에는 새로 더한 과제부터 차례로 연다.
 * 묶음을 다시 늘릴 때는 from을 배포 다음 날로 옮기고 before에 지금 길이를 적는다.
 */
export const POOL_GROWN = {
  from: '2026-10-27',
  before: { easy: 6, normal: 5, hard: 4 } satisfies Record<ExchangeTier, number>,
};

/** 오늘(0시 KST 시작)의 KST 날짜 키와 UTC ISO 경계. */
export function exchangeDay(nowIso: string): { key: string; startsAt: string; endsAt: string } {
  const k = new Date(Date.parse(nowIso) + KST_MS);
  k.setUTCHours(0, 0, 0, 0);
  const start = k.getTime();
  return {
    key: new Date(start).toISOString().slice(0, 10),
    startsAt: new Date(start - KST_MS).toISOString(),
    endsAt: new Date(start + DAY_MS - KST_MS).toISOString(),
  };
}

/** 1970-01-01부터 센 날 번호. 묶음 순서를 하루마다 하나씩 넘긴다. */
const dayIndex = (key: string) => Math.round(Date.parse(key) / DAY_MS);

/** 오늘 열린 과제(쉬움 · 보통 · 어려움). */
export function exchangesAt(nowIso: string): ExchangeDef[] {
  const day = exchangeDay(nowIso);
  const n = dayIndex(day.key);
  return EXCHANGE_TIERS.map((tier) => {
    const pool = EXCHANGE_POOL[tier];
    const before = POOL_GROWN.before[tier];
    // 늘린 날부터는 새 과제(묶음 뒤쪽)부터 연다.
    const i =
      day.key < POOL_GROWN.from
        ? n % before
        : (n - dayIndex(POOL_GROWN.from) + before) % pool.length;
    return {
      ...pool[i]!,
      id: `${day.key}-${tier}`,
      tier,
      startsAt: day.startsAt,
      endsAt: day.endsAt,
    };
  });
}

export const exchangeById = (nowIso: string, id: string) =>
  exchangesAt(nowIso).find((d) => d.id === id) ?? null;

/** 조건 판정에 쓰는 카드 값(서버 카드 행 · 화면 TeamPlayer가 같은 모양으로 넘긴다). */
export type ExchangeCard = {
  careerId: string;
  pos: CareerPos;
  nation?: string | null;
  peak: number;
  legendScore?: number | null;
  season?: number;
  foot?: string | null;
  dpos?: DetailPos | null;
  /** 가장 오래 뛴 프로 리그 id(careers.main_league). 모르면 null. */
  league?: string | null;
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
  'dpos',
  'sameLeague',
  'distinctNations',
] as const;
export type ExchangeCondition = (typeof EXCHANGE_CONDITIONS)[number];

/** 카드 한 장이 묶음 전체 조건과 상관없이 혼자 맞아야 하는 조건(포지션 · 최고 OVR 범위 · 시즌 · 주발 · 세부 포지션 · 리그 유무). */
export function cardFits(rule: ExchangeRule, c: ExchangeCard): boolean {
  if (rule.pos && !rule.pos.includes(c.pos)) return false;
  if (rule.shape && !rule.shape[c.pos]) return false;
  if (rule.peakMin !== undefined && c.peak < rule.peakMin) return false;
  if (rule.peakMax !== undefined && c.peak > rule.peakMax) return false;
  if (rule.seasons && !rule.seasons.includes(c.season ?? 0)) return false;
  if (rule.foot && c.foot !== rule.foot) return false;
  if (rule.dpos && !(c.dpos && rule.dpos.includes(c.dpos))) return false;
  if (rule.sameLeague && !c.league) return false;
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
  if (rule.dpos)
    out.push({ condition: 'dpos', met: each((c) => !!c.dpos && rule.dpos!.includes(c.dpos)) });
  if (rule.sameLeague)
    out.push({
      condition: 'sameLeague',
      met: each((c) => !!c.league && c.league === picked[0]!.league),
    });
  if (rule.distinctNations)
    out.push({
      condition: 'distinctNations',
      met: each((c) => !!c.nation) && new Set(picked.map((c) => c.nation)).size === picked.length,
    });
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
 * 같은 국적 · 같은 리그는 가장 많은 국적 · 리그에서, 다른 국적은 국적마다 한 장씩, 레전드 점수 한 장은 그 조건을 채우는 가장 싼 카드부터 넣는다. 평균 OVR이 모자라면
 * 고른 카드 중 가장 낮은 카드를 남은 카드 중 더 높은 카드로 바꾼다. 못 채우면 null.
 */
export function autoFill<T extends ExchangeCard & { cardValue?: number | null }>(
  rule: ExchangeRule,
  cards: readonly T[],
): T[] | null {
  const value = (c: T) => c.cardValue ?? 0;
  const fit = cards.filter((c) => cardFits(rule, c)).sort((a, b) => value(a) - value(b));
  const groups: T[][] = [];
  const key = rule.sameNation ? (c: T) => c.nation : rule.sameLeague ? (c: T) => c.league : null;
  if (key) {
    const by = new Map<string, T[]>();
    for (const c of fit) {
      const k = key(c);
      if (k) by.set(k, [...(by.get(k) ?? []), c]);
    }
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
  // 다른 국적 과제는 이미 고른 카드(바꿔 뺄 카드는 빼고)와 국적이 겹치지 않는 카드만 남긴다.
  const free = (c: T, but?: T) =>
    !rule.distinctNations || !chosen.some((x) => x !== but && x.nation === c.nation);
  const left = (but?: T) => pool.filter((c) => !chosen.includes(c) && free(c, but));
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
    while (chosen.length < rule.count) {
      const next = left()[0];
      if (!next) return null;
      take(next);
    }
  }
  if (rule.avgPeakMin === undefined) return chosen;
  // 평균이 모자라면 가장 낮은 카드를 같은 포지션(포지션 구성이 없으면 아무)의 더 높은 카드로 바꾼다.
  for (let guard = 0; guard < 64 && avgPeak(chosen) < rule.avgPeakMin; guard++) {
    const swappable = chosen.filter((c) => (rule.legendOne === undefined ? true : c !== chosen[0]));
    const low = swappable.sort((a, b) => a.peak - b.peak)[0];
    if (!low) return null;
    const up = left(low)
      .filter((c) => c.peak > low.peak && (!rule.shape || c.pos === low.pos))
      .sort((a, b) => a.peak - b.peak)[0];
    if (!up) return null;
    chosen[chosen.indexOf(low)] = up;
  }
  return avgPeak(chosen) >= rule.avgPeakMin ? chosen : null;
}

/**
 * 오늘 남은 과제를 지금 낼 수 있는 카드로 모두 채울 수 있나(남은 과제를 차례로 "맞는 카드로 채우기", 앞 과제가 쓴 카드는 뺀다).
 * 일부만 내면 보상이 없어서, 화면이 첫 카드를 내기 전에 알린다. 순서대로 채우는 어림이라 못 채운다고 나와도 손으로는 될 수 있다.
 */
export function canFinishAll<T extends ExchangeCard & { cardValue?: number | null }>(
  defs: readonly ExchangeDef[],
  cards: readonly T[],
): boolean {
  let left = [...cards];
  for (const d of [...defs].sort((a, b) => b.rule.count - a.rule.count)) {
    const got = autoFill(d.rule, left);
    if (!got) return false;
    left = left.filter((c) => !got.includes(c));
  }
  return true;
}

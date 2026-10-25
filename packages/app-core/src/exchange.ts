// T-11-374 카드 바치기 과제 화면 문구 · 고르기 규칙. 웹 owner/CardExchange.svelte와 앱 screens/owner/CardExchange.tsx가 같이 쓴다.
import {
  cardFits,
  exchangeChecks,
  type ExchangeCard,
  type ExchangeCondition,
  type ExchangeDef,
  type ExchangeReward,
  type ExchangeRule,
  type ExchangeTier,
} from '@offside/contracts/card-exchange-rules';
import { DETAIL_LABEL, POS_LABEL, type PosGroup } from '@offside/contracts/positions';
import { tn } from '@offside/game/i18n/names';
import type { TeamPlayer } from './api/team.js';
import { exchangeText as L } from './i18n/ko/exchange.js';

export {
  autoFill,
  canFinishAll,
  exchangeMet,
  exchangesAt,
  type ExchangeDef,
} from '@offside/contracts/card-exchange-rules';

const NAMES: Record<string, () => string> = {
  keepers: () => L.nameKeepers,
  midWorkers: () => L.nameMidWorkers,
  backline: () => L.nameBackline,
  quietFarewell: () => L.nameQuietFarewell,
  strikers: () => L.nameStrikers,
  leftFoot: () => L.nameLeftFoot,
  nationalCall: () => L.nameNationalCall,
  spine: () => L.nameSpine,
  frontLine: () => L.nameFrontLine,
  veterans: () => L.nameVeterans,
  bestEleven: () => L.nameBestEleven,
  legendGift: () => L.nameLegendGift,
  oneNation: () => L.nameOneNation,
  seasonOne: () => L.nameSeasonOne,
  elite: () => L.nameElite,
  centerBacks: () => L.nameCenterBacks,
  wingers: () => L.nameWingers,
  twoFooted: () => L.nameTwoFooted,
  worldTour: () => L.nameWorldTour,
  leagueMates: () => L.nameLeagueMates,
  engineRoom: () => L.nameEngineRoom,
  worldSelect: () => L.nameWorldSelect,
  leagueStars: () => L.nameLeagueStars,
};
export const exchangeName = (key: string) => NAMES[key]?.() ?? key;

export const tierLabel = (t: ExchangeTier) =>
  ({ easy: L.tierEasy, normal: L.tierNormal, hard: L.tierHard })[t];

const seasonLabel = (s: number) => (s === 0 ? L.seasonPre : L.seasonN({ n: s }));
const footLabel = (f: string) =>
  f === '왼발' ? L.condFootLeft : f === '오른발' ? L.condFootRight : L.condFootBoth; // i18n-ignore 저장값

/** 조건 한 줄 문구(규칙에 있는 조건만, exchangeChecks와 같은 순서). */
export function conditionText(rule: ExchangeRule, c: ExchangeCondition): string {
  switch (c) {
    case 'count':
      return L.condCount({ n: rule.count });
    case 'pos':
      return L.condPos({ list: (rule.pos ?? []).map((p) => tn(POS_LABEL[p])).join(' · ') });
    case 'shape':
      // T-11-374d 'DF 2'처럼 약어로 보여 수비형 미드필더를 수비수로 읽는 일이 있었다. 큰 포지션 이름으로 쓴다.
      return L.condShape({
        list: (Object.entries(rule.shape ?? {}) as [PosGroup, number][])
          .map(([p, n]) => L.shapeItem({ pos: tn(POS_LABEL[p]), n }))
          .join(' · '),
      });
    case 'peak':
      return rule.peakMin !== undefined && rule.peakMax !== undefined
        ? L.condPeakRange({ min: rule.peakMin, max: rule.peakMax })
        : rule.peakMin !== undefined
          ? L.condPeakMin({ n: rule.peakMin })
          : L.condPeakMax({ n: rule.peakMax ?? 0 });
    case 'avgPeak':
      return L.condAvgPeak({ n: rule.avgPeakMin ?? 0 });
    case 'sameNation':
      return L.condSameNation;
    case 'legendOne':
      return L.condLegendOne({ n: rule.legendOne ?? 0 });
    case 'seasons':
      return L.condSeasons({
        list: (rule.seasons ?? []).map((s) => seasonLabel(Number(s))).join(' · '),
      });
    case 'foot':
      return footLabel(rule.foot ?? '');
    case 'dpos':
      return L.condDpos({ list: (rule.dpos ?? []).map((d) => tn(DETAIL_LABEL[d])).join(' · ') });
    case 'sameLeague':
      return L.condSameLeague;
    case 'distinctNations':
      return L.condDistinctNations;
  }
}

/** 조건 체크리스트(고른 카드 기준으로 채워졌는지). */
export const exchangeChecklist = (rule: ExchangeRule, picked: readonly ExchangeCard[]) =>
  exchangeChecks(rule, picked).map((x) => ({ ...x, text: conditionText(rule, x.condition) }));

export const rewardText = (rewards: readonly ExchangeReward[]) =>
  rewards
    .map((w) =>
      w.item === 'reroll'
        ? L.rewardReroll({ n: w.qty })
        : w.item === 'boost'
          ? L.rewardBoost({ n: w.qty })
          : L.rewardScout({ n: w.qty }),
    )
    .join(' · ');

/** 오늘 과제가 바뀔 때까지 남은 시간(다음 0시 KST). */
export function endsText(def: ExchangeDef, nowMs: number): string {
  const m = Math.max(0, Math.floor((Date.parse(def.endsAt) - nowMs) / 60_000));
  return L.endsIn({ h: Math.floor(m / 60), m: m % 60 });
}

/** 판정용 카드 값. */
export const exchangeCardOf = (p: TeamPlayer): ExchangeCard & { cardValue: number | null } => ({
  careerId: p.careerId,
  pos: p.pos,
  nation: p.nation ?? null,
  peak: p.peak,
  legendScore: p.legendScore,
  season: p.season ?? 0,
  foot: p.foot ?? null,
  dpos: p.dpos,
  league: p.mainLeague ?? null,
  cardValue: p.cardValue ?? null,
});

/** 이 과제에 낼 수 없는 이유(영입 · 잠김 · 판매 중 · 선발 · 조건 밖). 낼 수 있으면 null. 직접 키운 선수만 낼 수 있다. */
export function exchangeLock(
  p: TeamPlayer,
  lineup: ReadonlySet<string>,
  rule: ExchangeRule,
): string | null {
  if (!p.raised) return L.lockBought;
  if (p.locked) return L.lockLocked;
  if (p.listing) return L.lockListed;
  if (lineup.has(p.careerId)) return L.lockStarter;
  if (!cardFits(rule, exchangeCardOf(p))) return L.lockNotFit;
  return null;
}

// T-11-080 이적시장 화면(웹 ui/market · 앱 screens/owner/Market.tsx 공용) — 그리기 전에 계산하는 것과 문구만 둔다.
import type { CareerPos } from '@offside/contracts';
import { anonName, fmtValue, withEulReul } from './format.js';
import type { MarketCard, MarketRules, MarketTrade } from './api/market.js';
import type { OwnerTeamResponse, TeamPlayer } from './api/team.js';
import { marketFee, priceBand } from './api/market.js';

/** 구단 자금 표기(0이면 '0원' — fmtValue는 0을 '-'로 쓴다). */
export const fundsText = (man: number) => (man > 0 ? fmtValue(man) : '0원');

export type MarketTab = 'market' | 'mine' | 'trades';
export const MARKET_TABS: readonly [MarketTab, string][] = [
  ['market', '시장'],
  ['mine', '내 선수'],
  ['trades', '내 거래'],
];
export const MARKET_SORT_LABEL = { new: '최신순', price: '낮은 가격순' } as const;
export const MARKET_POS_FILTERS: readonly (CareerPos | undefined)[] = [
  undefined,
  'FW',
  'MF',
  'DF',
  'GK',
];

/** 이 기기에서 키운 선수면 이 기기의 이름, 아니면 공개 이름, 없으면 익명 표기. */
export const marketName = (
  c: Pick<MarketCard, 'careerId' | 'publicName' | 'pos' | 'number'>,
  local: ReadonlyMap<string, string>,
) => local.get(c.careerId) ?? c.publicName ?? anonName(c.pos, c.number);

/** 판매가 대비 기준가(%). 100보다 크면 기준가보다 비싸다. */
export const priceRatio = (price: number, cardValue: number) =>
  cardValue > 0 ? Math.round((price / cardValue) * 100) : 100;

/** 판매 시트 — 고를 수 있는 범위, 수수료, 받을 돈. 가격이 범위를 벗어나면 error. */
export function sellQuote(cardValue: number, price: number, rules: MarketRules) {
  const band = priceBand(cardValue, rules);
  const fee = marketFee(price, rules.feeRate);
  const error =
    !Number.isInteger(price) || price < band.min
      ? `${fmtValue(band.min)}부터 정할 수 있어요.`
      : price > band.max
        ? `${fmtValue(band.max)}까지 정할 수 있어요.`
        : null;
  return { band, fee, gets: price - fee, error };
}

/** 판매가 입력(억 단위, 소수 허용) → 만 원. 빈 값·숫자 아님은 NaN. */
export const parseEok = (s: string) => {
  const v = Number(s.replace(/,/g, '').trim());
  return s.trim() === '' || !Number.isFinite(v) ? NaN : Math.round(v * 10_000);
};
/** 만 원 → 판매가 입력칸 값(억). */
export const toEok = (man: number) => String(Math.round(man / 100) / 100);

/** 영입 시트 — 살 수 있으면 null, 아니면 막는 이유. */
export function buyBlock(price: number, balance: number, buysLeft: number): string | null {
  if (buysLeft <= 0) return '오늘 영입 횟수를 다 썼어요. 내일 다시 영입할 수 있어요.';
  if (balance < price)
    return `구단 자금이 ${fmtValue(price - balance)} 모자라요. 직접 키운 선수를 방출하면 자금이 생겨요.`;
  return null;
}

/** 지금 시즌 선발(방출을 막는다). 지난 시즌 팀은 고칠 수 없어 막지 않는다. */
export const lineupOf = (d: OwnerTeamResponse): ReadonlySet<string> =>
  new Set(
    d.season === d.current && d.team
      ? d.team.slots.flatMap((s) => (s.careerId ? [s.careerId] : []))
      : [],
  );

/** 내 선수 탭의 한 줄 상태. current: 보고 있는 시즌이 지금 시즌인가(지금 시즌 선수만 내놓을 수 있다). */
export function mineState(p: TeamPlayer, lineup: ReadonlySet<string>, current: boolean) {
  return {
    listed: !!p.listing,
    starter: lineup.has(p.careerId),
    /** 방출할 수 있다: 직접 키웠고, 판매 중이 아니고, 지금 시즌 선발에 없다. */
    releasable: !!p.raised && !p.listing && !lineup.has(p.careerId),
    /** 내놓을 수 있다: 지금 시즌이고, 기준가가 있고, 판매 중이 아니다. */
    listable: current && p.cardValue != null && !p.listing,
  };
}

export const TRADE_LABEL: Record<MarketTrade['kind'], string> = {
  sold: '판매',
  bought: '영입',
  released: '방출',
};
/** 거래 금액 표기. 들어온 돈은 +, 나간 돈은 −. */
export const tradeAmount = (t: MarketTrade) =>
  `${t.kind === 'bought' ? '−' : '+'}${fmtValue(t.amount)}`;

/** 방출 확인 문구. 되돌릴 수 없다는 것을 꼭 보여 준다. */
export const releaseConfirmText = (count: number, amount: number) =>
  `${count}명을 방출하고 구단 자금 ${withEulReul(fmtValue(amount))} 받아요. 방출한 선수는 다시 데려올 수 없어요. 명예의 전당 기록은 그대로 남아요.`;

/** 시장이 빈 때 안내. 시즌 사이 휴식기(season null)면 닫혀 있다. */
export const marketEmptyText = (season: number | null, filtered: boolean) =>
  season === null
    ? '지금은 시즌 사이 휴식기라 이적시장이 닫혀 있어요.'
    : filtered
      ? '이 포지션에는 아직 나온 선수가 없어요.'
      : '아직 시장에 나온 선수가 없어요. 이번 시즌에 은퇴한 선수가 나오면 여기에 올라와요.';

/** 방출하면 받을 자금(서버와 같은 계산: 은퇴 가치 × 지급률을 천 단위로 반올림, 만 원). */
export const releaseAmount = (players: readonly Pick<TeamPlayer, 'retireValue'>[], rate: number) =>
  players.reduce((s, p) => s + Math.round(((p.retireValue ?? 0) * rate) / 1000) * 1000, 0);

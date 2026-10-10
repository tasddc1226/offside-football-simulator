// T-11-080 이적시장 화면(웹 ui/market · 앱 screens/owner/Market.tsx 공용) — 그리기 전에 계산하는 것과 문구만 둔다.
import type { CareerPos } from '@offside/contracts';
import { fmtValue, playerName } from './format.js';
import type { MarketCard, MarketRules, MarketSale, MarketTrade } from './api/market.js';
import type { FundsItem } from '@offside/contracts';
import type { OwnerTeamResponse, TeamPlayer } from './api/team.js';
import { marketFee, priceBand, releasePayout } from '@offside/contracts/market-value';
import { POS_GROUPS, detailPosOf } from '@offside/contracts/positions';
import { typeName } from '@offside/game/data';
import { marketText as L } from './i18n/ko/market.js';
import { intlLocale } from './i18n/core.js';

export { fundsText } from './funds.js';

/** 탭 셋 + '자금 만들기'(방출) 화면. 방출은 탭이 아니라 자금 옆 버튼으로 연다. */
export type MarketView = 'market' | 'sell' | 'trades' | 'release';
export const marketTabs = (): [Exclude<MarketView, 'release'>, string][] => [
  ['market', L.tabBuy],
  ['sell', L.tabSell],
  ['trades', L.tabTrades],
];
/** 문구는 읽을 때 지금 언어로 고른다(getter) — 모듈을 불러올 때 굳히지 않는다. */
export const MARKET_SORT_LABEL = {
  get new() {
    return L.sortNew;
  },
  get price() {
    return L.sortPrice;
  },
  get ovr() {
    return L.sortOvr;
  },
};
export const MARKET_POS_FILTERS: readonly (CareerPos | undefined)[] = [undefined, ...POS_GROUPS];

/** 이 기기에서 키운 선수면 이 기기의 이름, 아니면 공개 이름, 없으면 익명 표기. */
export const marketName = (
  c: Pick<MarketCard, 'careerId' | 'publicName' | 'pos' | 'number'>,
  local: ReadonlyMap<string, string>,
) => playerName(local.get(c.careerId) ?? c.publicName, c.pos, c.number);

/** 판매가 대비 기준가(%). 100보다 크면 기준가보다 비싸다. */
const priceRatio = (price: number, cardValue: number) =>
  cardValue > 0 ? Math.round((price / cardValue) * 100) : 100;

/** 판매가 옆 표시: 기준가와 같으면 '기준가', 아니면 차이(%). 비싸면 up, 싸면 down. */
export function priceDiff(
  price: number,
  cardValue: number,
): { text: string; tone: 'up' | 'down' | 'same' } {
  const d = priceRatio(price, cardValue) - 100;
  if (d === 0) return { text: L.priceSame, tone: 'same' };
  return d > 0
    ? { text: L.priceUp({ d }), tone: 'up' }
    : { text: L.priceDown({ d: -d }), tone: 'down' };
}

/** 판매가 슬라이더 범위(기준가의 %)와 한 칸, 수수료(%). priceAtPct와 같은 규칙을 쓴다. */
export const sellSlider = (rules: MarketRules) => ({
  minPct: Math.round(rules.priceMin * 100),
  maxPct: Math.round(rules.priceMax * 100),
  step: 5,
  feePct: Math.round(rules.feeRate * 100),
});

/** 판매가 슬라이더(기준가의 %)를 만 원으로. 100 단위로 맞추고 고를 수 있는 범위 안에 둔다. */
export function priceAtPct(cardValue: number, pct: number, rules: MarketRules): number {
  const band = priceBand(cardValue, rules);
  return Math.min(band.max, Math.max(band.min, Math.round((cardValue * pct) / 100 / 100) * 100));
}

/** 판매 시트 — 고를 수 있는 범위, 수수료, 받을 돈. 가격이 범위를 벗어나면 error. */
export function sellQuote(cardValue: number, price: number, rules: MarketRules) {
  const band = priceBand(cardValue, rules);
  const fee = marketFee(price, rules.feeRate);
  const error =
    !Number.isInteger(price) || price < band.min
      ? L.sellMin({ value: fmtValue(band.min) })
      : price > band.max
        ? L.sellMax({ value: fmtValue(band.max) })
        : null;
  return { band, fee, gets: price - fee, error };
}

/** 영입 시트 — 살 수 있으면 null, 아니면 막는 이유. */
export function buyBlock(price: number, balance: number, buysLeft: number): string | null {
  if (buysLeft <= 0) return L.buyLimit;
  if (balance < price) return L.buyShort({ short: fmtValue(price - balance) });
  return null;
}

/** 지금 시즌 선발(방출을 막는다). 지난 시즌 팀은 고칠 수 없어 막지 않는다. */
export const lineupOf = (d: OwnerTeamResponse): ReadonlySet<string> =>
  new Set(
    d.season === d.current && d.team
      ? d.team.slots.flatMap((s) => (s.careerId ? [s.careerId] : []))
      : [],
  );

/** 팔기 탭에서 고를 수 있는 선수: 판매 중이 아니고 기준가가 있고 잠기지 않았다. */
export const sellable = (p: TeamPlayer) => !p.listing && p.cardValue != null && !p.locked;

/** 팔기 탭 카드 아래 한 줄: 판매 중이면 막고, 선발이면 알려 준다(팔리면 유스 선수가 채운다). */
export function sellNote(p: TeamPlayer, lineup: ReadonlySet<string>): string {
  if (p.listing) return L.noteListed;
  if (p.cardValue == null) return L.noteNoValue;
  if (p.locked) return L.noteLocked;
  return lineup.has(p.careerId) ? L.noteStarter : '';
}

/** T-11-188 잠금 버튼을 누를 수 있나: 판매 중인 선수는 내린 뒤에 잠근다(잠긴 선수는 판매 중일 수 없어 늘 풀 수 있다). */
export const lockToggleable = (p: TeamPlayer) => !!p.locked || !p.listing;

/** 방출 화면에서 고를 수 없는 이유(고를 수 있으면 null). */
export function releaseLock(p: TeamPlayer, lineup: ReadonlySet<string>): string | null {
  if (!p.raised) return L.lockBought;
  if (p.listing) return L.lockListed;
  if (p.locked) return L.lockPlayerLocked;
  if (lineup.has(p.careerId)) return L.lockStarter;
  return null;
}

/** '방금 이적' 띠가 다음 거래로 넘어가는 간격(ms). 화면 안에서만 돌고 서버를 다시 부르지 않는다. */
export const MARKET_TICKER_MS = 3500;
/** '방금 이적' 한 줄: 누가 얼마에 팔렸는지. 산 사람·판 사람은 없다. */
export const saleText = (s: MarketSale, local: ReadonlyMap<string, string>) =>
  L.saleLine({
    name: marketName(s.card, local),
    pos: detailPosOf(s.card),
    peak: s.card.peak,
    price: fmtValue(s.price),
  });

export const TRADE_LABEL: Record<MarketTrade['kind'], string> = {
  get sold() {
    return L.tradeSold;
  },
  get bought() {
    return L.tradeBought;
  },
  get released() {
    return L.tradeReleased;
  },
};
/** T-11-153 구단 자금으로 산 것의 이름. */
export const SPEND_LABEL: Record<FundsItem, string> = {
  get reroll() {
    return L.spendReroll;
  },
  get 'reward:candidates'() {
    return L.spendCandidates;
  },
  get 'reward:peek'() {
    return L.spendPeek;
  },
  get 'reward:boost'() {
    return L.spendBoost;
  },
};

/** 방출 확인 문구. 되돌릴 수 없다는 것을 꼭 보여 준다. */
export const releaseConfirmText = (count: number, amount: number) =>
  L.releaseConfirm({ count, amount: fmtValue(amount) });

/** 시장이 빈 때 안내. 시즌 사이 휴식기(season null)면 닫혀 있다. */
export const marketEmptyText = (season: number | null, filtered: boolean) =>
  season === null ? L.emptyClosed : filtered ? L.emptyFiltered : L.empty;

/** 한 선수를 방출하면 받을 자금(서버와 같은 releasePayout — 카드 기준가 × 지급률). */
export const releaseValue = (p: Pick<TeamPlayer, 'cardValue'>, rate: number) =>
  releasePayout(p.cardValue, rate);
/** 여러 선수를 방출하면 받을 자금. */
export const releaseAmount = (players: readonly Pick<TeamPlayer, 'cardValue'>[], rate: number) =>
  players.reduce((s, p) => s + releaseValue(p, rate), 0);

/** 쓰기가 끝나면 띄우는 알림(웹·앱 같은 문구). */
export const MARKET_TOAST = {
  get listed() {
    return L.toastListed;
  },
  get unlisted() {
    return L.toastUnlisted;
  },
  get bought() {
    return L.toastBought;
  },
  released: (n: number) => L.toastReleased({ n }),
  get locked() {
    return L.toastLocked;
  },
  get unlocked() {
    return L.toastUnlocked;
  },
};

/** 구단주 로그인이 필요해서 실패했는가(세션 없음 · 구글/애플 연결 전). 이적시장·내 팀이 오류 대신 로그인을 권한다. */
export const needsOwnerLogin = (e: { code: string; reason?: string }) =>
  e.code === 'PROFILE_REQUIRED' || e.reason === 'GOOGLE_LOGIN_REQUIRED';

/** 시장 줄 아래 한 줄(레전드 점수 · 이적 횟수). */
export function cardMeta(c: Pick<MarketCard, 'pos' | 'type' | 'legendScore' | 'transfers'>) {
  const meta = L.cardMeta({
    score: c.legendScore.toLocaleString(intlLocale()),
    transfers: c.transfers,
  });
  // T-11-164 유형(스피드스터·윙어 등)을 앞에 붙인다 — 카드 상세(PlayerCard)의 유형 띠와 같은 이름.
  const style = typeName(c.pos, c.type);
  return style ? `${style} · ${meta}` : meta;
}

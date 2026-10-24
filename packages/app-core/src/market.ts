// T-11-080 이적시장 화면(웹 ui/market · 앱 screens/owner/Market.tsx 공용) — 그리기 전에 계산하는 것과 문구만 둔다.
import type { CareerPos } from '@offside/contracts';
import { fmtValue, playerName } from './format.js';
import type {
  MarketCard,
  MarketListing,
  MarketRules,
  MarketSale,
  MarketTrade,
} from './api/market.js';
import type { FundsItem } from '@offside/contracts';
import { ATTR_KEYS, attrLabels, type AttrKey } from '@offside/game/data';
import type { OwnerTeamResponse, TeamPlayer } from './api/team.js';
import {
  MARKET_TYPES,
  RELEASE_MAX,
  marketFee,
  priceBand,
  releasePayout,
  type MarketType,
} from '@offside/contracts/market-value';
import {
  FILTER_DETAILS_OF,
  POS_GROUPS,
  detailPosOf,
  type DetailPos,
} from '@offside/contracts/positions';
import { typeName } from '@offside/game/data';
import { marketText as L } from './i18n/ko/market.js';
import { intlLocale } from './i18n/core.js';
import { teamSeasonLabel } from './seasonName.js';
import { isWildcardSeason, salaryOf } from '@offside/contracts/owner-team';

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

/** T-11-474 선수 사기 목록 필터. 세부 포지션 · 유형은 포지션군을 고른 뒤에만 고른다(명예의 전당과 같다). */
export interface MarketFilter {
  pos?: CareerPos | undefined;
  dpos?: DetailPos | undefined;
  type?: MarketType | undefined;
}
/** 포지션군 안의 세부 포지션(골키퍼처럼 하나뿐이면 고를 것이 없다). */
export const marketDetailFilters = (pos: CareerPos | undefined): readonly DetailPos[] =>
  pos && FILTER_DETAILS_OF[pos].length > 1 ? FILTER_DETAILS_OF[pos] : [];
/** 포지션군의 선수 유형 [id, 이름]. */
export const marketTypeFilters = (pos: CareerPos | undefined): [MarketType, string][] =>
  pos ? MARKET_TYPES[pos].map((id) => [id, typeName(pos, id) ?? id]) : [];
/** 필터 하나를 바꾼다. 포지션군이 바뀌면 그 안의 세부 포지션 · 유형은 풀린다. */
export function pickMarketFilter(f: MarketFilter, next: MarketFilter): MarketFilter {
  if ('pos' in next && next.pos !== f.pos) return { pos: next.pos };
  return { ...f, ...next };
}
export const marketFiltered = (f: MarketFilter) => !!(f.pos || f.dpos || f.type);

/** 이 기기에서 키운 선수면 이 기기의 이름, 아니면 공개 이름, 없으면 익명 표기. */
export const marketName = (
  c: Pick<MarketCard, 'careerId' | 'publicName' | 'pos' | 'number'>,
  local: ReadonlyMap<string, string>,
) => playerName(local.get(c.careerId) ?? c.publicName, c.pos, c.number);

/** 판매가 대비 기준가(%). 100보다 크면 기준가보다 비싸다. */
const priceRatio = (price: number, cardValue: number) =>
  cardValue > 0 ? Math.round((price / cardValue) * 100) : 100;

/** 판매가 옆 표시: 기준가와 같으면 '기준가', 아니면 차이(%). 비싸면 up, 싸면 down. */
/**
 * T-11-477 매물 줄 아래 능력치 6개(카드 능력치 그대로, 골키퍼는 골키퍼 이름). 90 이상은 강조, 60 미만은 흐리게.
 * 옛 기록처럼 능력치가 없으면 빈 배열 — 줄을 그리지 않는다.
 */
export function cardAttrStrip(
  card: Pick<MarketCard, 'pos' | 'attrs'>,
): { key: AttrKey; label: string; value: number; tone: 'hi' | 'lo' | '' }[] {
  const a = card.attrs;
  if (!a) return [];
  const labels = attrLabels(card.pos);
  return ATTR_KEYS.map((key) => {
    const value = Math.round(a[key]);
    return { key, label: labels[key], value, tone: value >= 90 ? 'hi' : value < 60 ? 'lo' : '' };
  });
}

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
export function buyBlock(price: number, balance: number): string | null {
  if (balance < price) return L.buyShort({ short: fmtValue(price - balance) });
  return null;
}

/**
 * T-11-434 영입 · 판매 내리기가 낡은 매물(LISTING_GONE · PRICE_CHANGED)이라 실패한 뒤 새로 받은 첫 페이지(fresh, 못 받았으면
 * null)로 시트를 어떻게 할지 고른다. 새 목록에 다른 가격으로 있으면 그 매물로 시트를 바꾸고 안내를 띄운다. 팔렸거나 내렸거나,
 * 목록이 아직 같은 가격을 들고 있으면(엣지 캐시) 시트를 닫고 토스트로 알린다. 낡은 가격으로 다시 보내지 않게 하려는 것이다.
 */
export function staleListingNext(
  sent: Pick<MarketListing, 'id' | 'price'>,
  reason: string | undefined,
  fresh: readonly MarketListing[] | null,
): { listing: MarketListing; notice: string } | { toast: string } {
  if (reason === 'LISTING_GONE') return { toast: L.staleGone };
  const found = fresh?.find((l) => l.id === sent.id);
  if (found && found.price !== sent.price)
    return { listing: found, notice: L.priceMoved({ price: fmtValue(found.price) }) };
  return { toast: L.staleRecheck };
}

/** 지금 시즌 선발(판매 · 방출을 막는다). 지난 시즌 팀은 고칠 수 없어 막지 않는다. */
export const lineupOf = (d: OwnerTeamResponse): ReadonlySet<string> =>
  new Set(
    d.season === d.current && d.team
      ? d.team.slots.flatMap((s) => (s.careerId ? [s.careerId] : []))
      : [],
  );

/** 팔기 탭에서 고를 수 있는 선수: 판매 중이 아니고 기준가가 있고 잠기지 않았다. */
export const sellable = (p: TeamPlayer) => !p.listing && p.cardValue != null && !p.locked;

/** T-11-474 팔기 탭에 보이는 선수: 지금 시즌 선발은 팀에서 뺀 뒤에 내놓는다(서버도 막는다). */
export const sellCandidates = (players: readonly TeamPlayer[], lineup: ReadonlySet<string>) =>
  players.filter((p) => !lineup.has(p.careerId));

/** 팔기 탭 카드 아래 한 줄: 고를 수 없는 이유. */
export function sellNote(p: TeamPlayer): string {
  if (p.listing) return L.noteListed;
  if (p.cardValue == null) return L.noteNoValue;
  if (p.locked) return L.noteLocked;
  return '';
}

/** T-11-188 잠금 버튼을 누를 수 있나: 판매 중인 선수는 내린 뒤에 잠근다(잠긴 선수는 판매 중일 수 없어 늘 풀 수 있다). */
export const lockToggleable = (p: TeamPlayer) => !!p.locked || !p.listing;

/** T-11-442 방출 한 번에 고를 수 있는 최대 인원(서버 검증과 같은 값). */
export { RELEASE_MAX };

/**
 * T-11-442 방출 '전체 선택'. 서버가 한 번에 RELEASE_MAX명까지만 받으니 앞에서부터 그만큼만 고른다. 이미 다 골랐으면
 * (또는 한도만큼 골랐으면) 모두 푼다.
 */
export function pickAllIds(
  releasable: readonly { careerId: string }[],
  picked: ReadonlySet<string>,
): Set<string> {
  const ids = releasable.map((p) => p.careerId);
  const want = Math.min(ids.length, RELEASE_MAX);
  const chosen = ids.filter((id) => picked.has(id)).length;
  return want > 0 && chosen >= want ? new Set() : new Set(ids.slice(0, RELEASE_MAX));
}
/** 방출 '전체 선택' 버튼 이름. 고를 선수가 한도보다 많으면 '최대 N명 선택'. */
export function pickAllLabel(releasable: number, allPicked: boolean): string {
  if (allPicked) return L.pickNone;
  return releasable > RELEASE_MAX ? L.pickAllMax({ n: RELEASE_MAX }) : L.pickAll;
}
/** 방출 '전체 선택'이 끝난 상태인가(한도보다 많으면 한도만큼 골랐을 때). */
export const allReleasePicked = (releasable: number, picked: number) =>
  releasable > 0 && picked >= Math.min(releasable, RELEASE_MAX);
/** 방출할 선수 하나를 넣거나 뺀다. 한도에 닿았는데 더 넣으려 하면 그대로 두고 full을 돌려준다. */
export function togglePickId(
  picked: ReadonlySet<string>,
  id: string,
): { next: Set<string>; full: boolean } {
  const next = new Set(picked);
  if (next.delete(id)) return { next, full: false };
  if (next.size >= RELEASE_MAX) return { next, full: true };
  next.add(id);
  return { next, full: false };
}

/** T-11-442 로그인 전 기기에서 팔기 · 내 거래 · 방출 화면을 열면 오류 대신 보이는 안내. */
export function marketGuestText(view: MarketView): string {
  if (view === 'sell') return L.guestSell;
  if (view === 'release') return L.guestRelease;
  return L.guestTrades;
}

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
  get scout() {
    return L.spendScout;
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
/** T-11-443 내 선수 방출 목록 한 줄: 세부 포지션 · 최고 OVR · 레전드 점수. */
export const releaseRowInfo = (p: Pick<TeamPlayer, 'pos' | 'dpos' | 'peak' | 'legendScore'>) =>
  L.releaseRowInfo({
    pos: detailPosOf(p),
    peak: p.peak,
    score: (p.legendScore ?? 0).toLocaleString(intlLocale()),
  });
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

/**
 * 시장 줄 아래 한 줄(레전드 점수 · 이적 횟수). T-11-425 지난 시즌 카드면 출신 시즌과 급여를 앞에 붙인다 — 지금 시즌 팀
 * 선발에 넣으면 급여 예산을 쓴다.
 */
export function cardMeta(
  c: Pick<MarketCard, 'legendScore' | 'transfers' | 'peak' | 'season'>,
  current: number | null = null,
) {
  const meta = L.cardMeta({
    score: c.legendScore.toLocaleString(intlLocale()),
    transfers: c.transfers,
  });
  return current !== null && isWildcardSeason(c.season, current)
    ? L.pastCardMeta({ season: teamSeasonLabel(c.season), salary: salaryOf(c.peak), meta })
    : meta;
}

/**
 * T-11-164 · T-11-356 선수 유형(스피드스터·플레이메이커 등) — 카드 상세(PlayerCard)의 유형 띠와 같은 이름.
 * 시장 줄·내 등록·방금 이적 줄에 따로 띠로 그린다. 유형이 없거나 모르는 id면 null.
 */
export const cardStyle = (c: Pick<MarketCard, 'pos' | 'type'>): string | null =>
  typeName(c.pos, c.type);

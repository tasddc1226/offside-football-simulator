// ───────── T-11-735 명품 경매 ─────────
// 30대엔 선수 자금이 쌓이기만 한다. 시즌마다 경매품 3개가 올라오고(종류만 보인다), 사서 열면 등급(일반 · 고급 · 명품 · 전설)이
// 정해진다. 소장품 가치는 은퇴 유산에 더해지고, 한 종류 네 등급 세트는 경기력에 작은 보정을 준다(collection.ts).
// 명품 · 전설은 인기도 올린다. 같은 종류 · 등급을 또 얻으면 산 값의 절반에 되판다.
// 한 종류의 네 등급을 모두 모으거나 전설 소장품을 얻으면 칭호를 받고, 은퇴하면 대표 소장품 3개가 명예의 전당에 남는다.
// 경매품 종류는 커리어 ID · 연도로 정해(hashStr) 게임 RNG를 쓰지 않는다. 등급 판정만 살 때 게임 RNG를 한 번 쓴다 —
// 사지 않은 커리어는 결과가 예전과 같다(golden.test.ts). 앱에서는 시즌에 한 번 광고를 보고 경매품을 새로 받을 수 있다.
import { BAL } from './balance.js';
import { hashStr } from './hash.js';
import { fmtMoney } from './player.js';
import { rnd } from './rng.js';
import { log } from './stats.js';
import { salaryCost } from './training.js';
import type { AuctionGrade, AuctionKind, AuctionState, GameState } from './types.js';
import { gAuctionText as T } from './i18n/ko/gAuction.js';
import { AUCTION_KINDS, ITEM_VALUE, completeKinds, hasItem } from './collection.js';

export { AUCTION_GRADES, AUCTION_KINDS, completeKinds, hasItem } from './collection.js';
export const AUCTION = {
  /** 등급(일반 · 고급 · 명품 · 전설)별 확률. 합 1. */
  p: [0.6, 0.3, 0.09, 0.01],
  /** 한 개 값 = max(min, 연봉 × rate)(만 원) × BAL.auctionCost. */
  rate: 0.5,
  min: 3000,
  /** 겹친 소장품을 되팔 때 산 값에 곱한다. */
  refund: 0.5,
  /** 시즌마다 올라오는 경매품 수. */
  lots: 3,
  /** 시즌마다 광고로 경매품을 새로 받을 수 있는 횟수(앱). */
  adPerSeason: 1,
  /** 새 소장품이 명품 · 전설이면 오르는 인기. */
  fame: [0, 0, 3, 10],
} as const;
export const AUCTION_PCT: readonly number[] = AUCTION.p.map((p) => Math.round(p * 1000) / 10);

const empty = (year: number): AuctionState => ({ y: year, r: 0, got: [], items: [] });

/** 이번 시즌 기준 상태(시즌이 바뀌었으면 새로 고침 · 산 표시를 비운 모양). 저장하지 않는다. */
export function auctionState(s: Pick<GameState, 'auction' | 'year'>): AuctionState {
  const a = s.auction;
  if (!a) return empty(s.year);
  return a.y === s.year ? a : { ...a, y: s.year, r: 0, got: [] };
}

/** 경매장을 열어 두는 때 — 프로 계약이 있고 은퇴 전. */
export const auctionOpen = (s: GameState): boolean => !s.retired && !!s.contract;

/** 이번 시즌 경매품 종류(서로 다른 AUCTION.lots개). 커리어 ID · 연도 · 새로 받은 횟수로 정한다(RNG 없음). */
export function auctionLots(s: Pick<GameState, 'auction' | 'year' | 'cid'>): AuctionKind[] {
  const r = auctionState(s).r;
  const pool = [...AUCTION_KINDS];
  const out: AuctionKind[] = [];
  let h = hashStr(`${s.cid}:auction:${s.year}:${r}`);
  for (let i = 0; i < AUCTION.lots; i++) {
    const at = h % pool.length;
    out.push(pool.splice(at, 1)[0]!);
    h = hashStr(`${h}:${i}`);
  }
  return out;
}

/** 경매품 한 개 값(만 원, 10 단위). */
export const auctionCost = (s: GameState): number =>
  salaryCost(s, AUCTION.rate, AUCTION.min, BAL.auctionCost);

export type AuctionLotStatus = 'got' | 'short' | 'ready';

export function auctionLotStatus(s: GameState, i: number): AuctionLotStatus {
  if (auctionState(s).got.includes(i)) return 'got';
  return s.money < auctionCost(s) ? 'short' : 'ready';
}

/** 광고로 경매품을 새로 받을 수 있는 이번 시즌 남은 횟수. */
export function auctionAdLeft(s: GameState): number {
  if (!auctionOpen(s)) return 0;
  return Math.max(0, AUCTION.adPerSeason - auctionState(s).r);
}

export interface AuctionResult {
  k: AuctionKind;
  g: AuctionGrade;
  cost: number;
  /** 이미 있던 소장품이라 되판 값(만 원). 새 소장품이면 0. */
  refund: number;
  /** 새 소장품의 가치(만 원, 은퇴 유산에 더해진다). 되팔았으면 0. */
  value: number;
  /** 이 구매로 네 등급을 다 모은 종류. */
  completed?: AuctionKind;
}

/** 등급을 고른다. 0~1 난수 하나로. */
export function rollGrade(x: number): AuctionGrade {
  let acc = 0;
  for (let i = 0; i < AUCTION.p.length; i++) {
    acc += AUCTION.p[i]!;
    if (x < acc) return (i + 1) as AuctionGrade;
  }
  return 1;
}

/** i번째 경매품을 산다. 살 수 없으면 null(상태를 바꾸지 않는다). */
export function buyLot(s: GameState, i: number): AuctionResult | null {
  if (!auctionOpen(s) || i < 0 || i >= AUCTION.lots) return null;
  if (auctionLotStatus(s, i) !== 'ready') return null;
  const a = auctionState(s);
  const k = auctionLots(s)[i]!;
  const cost = auctionCost(s);
  const g = rollGrade(rnd());
  const dupe = hasItem(a.items, k, g);
  const refund = dupe ? Math.round((cost * AUCTION.refund) / 10) * 10 : 0;
  const before = completeKinds(a.items);
  const value = Math.round((cost * ITEM_VALUE[g - 1]!) / 10) * 10;
  const items = dupe ? a.items : [...a.items, { k, g, y: s.year, v: value }];
  const completed = completeKinds(items).find((x) => !before.includes(x));
  s.money += refund - cost;
  s.auction = { ...a, got: [...a.got, i], items };
  // 명품 · 전설 소장품은 소문이 난다(인기). RNG를 쓰지 않으려고 addStat 대신 바로 더한다.
  if (!dupe) s.fame += AUCTION.fame[g - 1]!;
  const p = { item: T[k], grade: T[`g${g}`], cost: fmtMoney(cost), refund: fmtMoney(refund) };
  log(s, dupe ? T.dupe(p) : T.bought(p), g >= 3 && !dupe ? 'big' : 'good');
  if (completed) log(s, T.complete({ item: T[completed] }), 'big');
  return { k, g, cost, refund, value: dupe ? 0 : value, ...(completed ? { completed } : {}) };
}

/** 광고를 다 본 뒤 경매품을 새로 받는다. 받을 수 없으면 false. */
export function refreshLots(s: GameState): boolean {
  if (auctionAdLeft(s) <= 0) return false;
  const a = auctionState(s);
  s.auction = { ...a, r: a.r + 1, got: [] };
  return true;
}

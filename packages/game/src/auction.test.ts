import { describe, expect, it } from 'vitest';
import {
  AUCTION,
  auctionAdLeft,
  auctionCost,
  auctionLotStatus,
  auctionLots,
  auctionOpen,
  buyLot,
  completeKinds,
  refreshLots,
  rollGrade,
} from './auction.js';
import { collectionEdge, ITEM_VALUE, SET_EDGE } from './collection.js';
import { newGame } from './engine.js';
import { legacyFund, legacyItemsValue, legacyTierOf, settleLegacy } from './legacy.js';
import { sponsorPay } from './season.js';
import { legendSnapshot } from './legend.js';
import { createRng, getActiveRng, setActiveRng } from './rng.js';
import { TITLES } from './titles.js';
import type { AuctionKind, GameState } from './types.js';

function pro(money = 1e7): GameState {
  setActiveRng(createRng(7));
  const s = newGame(
    { name: 'a', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'normal' },
    7,
  );
  s.contract = { years: 3, salary: 20000 };
  s.money = money;
  return s;
}

describe('T-11-735 명품 경매', () => {
  it('프로 계약이 있고 은퇴 전에만 열린다', () => {
    const s = pro();
    expect(auctionOpen(s)).toBe(true);
    s.contract = null;
    expect(auctionOpen(s)).toBe(false);
    expect(buyLot(s, 0)).toBeNull();
  });

  it('경매품은 서로 다른 종류 3개이고 RNG를 쓰지 않는다', () => {
    const s = pro();
    const before = JSON.stringify(getActiveRng().getState());
    const lots = auctionLots(s);
    expect(lots).toHaveLength(AUCTION.lots);
    expect(new Set(lots).size).toBe(AUCTION.lots);
    expect(auctionLots(s)).toEqual(lots);
    expect(JSON.stringify(getActiveRng().getState())).toBe(before);
  });

  it('값은 연봉 × 0.5, 최소 3,000만', () => {
    const s = pro();
    expect(auctionCost(s)).toBe(10000);
    s.contract = { years: 1, salary: 1000 };
    expect(auctionCost(s)).toBe(3000);
  });

  it('등급 확률표를 따른다', () => {
    expect(rollGrade(0)).toBe(1);
    expect(rollGrade(0.59)).toBe(1);
    expect(rollGrade(0.6)).toBe(2);
    expect(rollGrade(0.9)).toBe(3);
    expect(rollGrade(0.995)).toBe(4);
  });

  it('사면 자금이 줄고 그 칸은 이번 시즌에 다시 살 수 없다', () => {
    const s = pro();
    const money = s.money;
    const r = buyLot(s, 1)!;
    expect(r.k).toBe(auctionLots(s)[1]);
    expect(s.money).toBe(money - r.cost + r.refund);
    expect(auctionLotStatus(s, 1)).toBe('got');
    expect(buyLot(s, 1)).toBeNull();
    expect(s.auction!.items).toHaveLength(r.refund ? 0 : 1);
  });

  it('겹친 소장품은 산 값의 절반에 되판다', () => {
    const s = pro();
    const k = auctionLots(s)[0]!;
    s.auction = {
      y: s.year,
      r: 0,
      got: [],
      items: [1, 2, 3, 4].map((g) => ({ k, g: g as 1, y: s.year })),
    };
    const money = s.money;
    const r = buyLot(s, 0)!;
    expect(r.refund).toBe(r.cost / 2);
    expect(s.money).toBe(money - r.cost / 2);
    expect(s.auction!.items).toHaveLength(4);
  });

  it('시즌이 바뀌면 다시 살 수 있고, 자금이 모자라면 살 수 없다', () => {
    const s = pro();
    buyLot(s, 0);
    s.year += 1;
    expect(auctionLotStatus(s, 0)).toBe('ready');
    s.money = 0;
    expect(auctionLotStatus(s, 0)).toBe('short');
    expect(buyLot(s, 0)).toBeNull();
  });

  it('광고로 시즌에 한 번 경매품을 새로 받는다', () => {
    const s = pro();
    const lots = auctionLots(s);
    buyLot(s, 0);
    expect(auctionAdLeft(s)).toBe(1);
    expect(refreshLots(s)).toBe(true);
    expect(auctionLotStatus(s, 0)).toBe('ready');
    expect(auctionAdLeft(s)).toBe(0);
    expect(refreshLots(s)).toBe(false);
    // 같은 시즌의 새 경매품은 대개 다르다(같아도 규칙상 문제는 없다).
    expect(auctionLots(s)).toHaveLength(lots.length);
  });

  it('네 등급을 모으면 칭호, 은퇴 스냅샷엔 높은 등급 3개만 남는다', () => {
    const s = pro();
    const k: AuctionKind = 'watch';
    s.auction = {
      y: s.year,
      r: 0,
      got: [],
      items: [
        { k, g: 1, y: 2030 },
        { k: 'wine', g: 2, y: 2030 },
        { k, g: 4, y: 2031 },
        { k, g: 2, y: 2031 },
        { k, g: 3, y: 2032 },
      ],
    };
    expect(completeKinds(s.auction.items)).toEqual(['watch']);
    const earned = (id: string) => TITLES.find((t) => t.id === id)!.earned(s, {} as never);
    expect(earned('auction_set')).toBe(true);
    expect(earned('auction_legend')).toBe(true);
    expect(legendSnapshot(s).items).toEqual([
      { k, g: 4 },
      { k, g: 3 },
      { k: 'wine', g: 2 },
    ]);
  });

  it('사지 않은 커리어는 스냅샷에 소장품이 없다', () => {
    expect(legendSnapshot(pro()).items).toBeUndefined();
  });
});

describe('T-11-735 소장품의 쓸모 · 인기 스폰서', () => {
  it('새 소장품은 가치가 매겨지고, 명품 이상이면 인기가 오른다', () => {
    const s = pro();
    const fame = s.fame;
    const r = buyLot(s, 0)!;
    if (r.refund) return;
    expect(r.value).toBe(Math.round((r.cost * ITEM_VALUE[r.g - 1]!) / 10) * 10);
    expect(s.auction!.items[0]!.v).toBe(r.value);
    expect(s.fame).toBe(fame + AUCTION.fame[r.g - 1]!);
  });

  it('은퇴 유산은 남은 자금 + 소장품 가치(인기 100이면 1.5배)로 정한다', () => {
    const s = pro(0);
    s.fame = 0;
    s.auction = { y: s.year, r: 0, got: [], items: [{ k: 'watch', g: 4, y: 2030, v: 700_000 }] };
    expect(legacyFund(s)).toBe(700_000);
    expect(legacyTierOf(legacyFund(s))).toBe(1);
    s.fame = 300;
    expect(legacyItemsValue(s)).toBe(1_050_000);
    s.legacyPick = 'academy';
    settleLegacy(s);
    expect(s.legacy).toEqual({ k: 'academy', t: 1 });
  });

  it('세트(한 종류 네 등급)마다 경기력 보정, 없으면 0', () => {
    const s = pro();
    expect(collectionEdge(s)).toBe(0);
    s.auction = {
      y: s.year,
      r: 0,
      got: [],
      items: [1, 2, 3, 4].map((g) => ({ k: 'car' as const, g: g as 1, y: 2030 })),
    };
    expect(collectionEdge(s)).toBe(SET_EDGE);
  });

  it('스폰서 수입은 연봉 × 인기(100까지)/100 × 0.2, 계약이 없으면 0', () => {
    const s = pro();
    s.fame = 50;
    expect(sponsorPay(s)).toBe(2000);
    s.fame = 500;
    expect(sponsorPay(s)).toBe(4000);
    s.contract = null;
    expect(sponsorPay(s)).toBe(0);
  });
});

describe('T-11-735 경매 칭호 추가', () => {
  it('소장품 12개면 경매장 단골, 세트 3개면 컬렉션의 제왕', () => {
    const s = pro();
    const earned = (id: string) => TITLES.find((t) => t.id === id)!.earned(s, {} as never);
    const kinds: AuctionKind[] = ['watch', 'car', 'art'];
    s.auction = {
      y: s.year,
      r: 0,
      got: [],
      items: kinds.flatMap((k) => [1, 2, 3, 4].map((g) => ({ k, g: g as 1, y: 2030 }))),
    };
    expect(earned('auction_collector')).toBe(true);
    expect(earned('auction_tycoon')).toBe(true);
    s.auction.items = s.auction.items.slice(0, 11);
    expect(earned('auction_collector')).toBe(false);
    expect(earned('auction_tycoon')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { newGame } from '@offside/game/engine';
import { createRng, setActiveRng } from '@offside/game/rng';
import type { GameState } from '@offside/game/types';
import {
  auctionCredit,
  auctionView,
  doAuction,
  doAuctionRefresh,
  legendItems,
} from './auction-view';

function pro(money = 1e7): GameState {
  setActiveRng(createRng(3));
  const s = newGame(
    { name: 'a', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'normal' },
    3,
  );
  s.contract = { years: 3, salary: 20000 };
  s.money = money;
  return s;
}

describe('T-11-735 명품 경매 카드', () => {
  it('프로 계약 전 · 은퇴 뒤에는 숨긴다', () => {
    const s = pro();
    s.contract = null;
    expect(auctionView(s)).toBeNull();
    s.contract = { years: 1, salary: 1 };
    s.retired = true;
    expect(auctionView(s)).toBeNull();
  });

  it('경매품 3개 · 확률 · 24칸 진열장을 보인다', () => {
    const v = auctionView(pro())!;
    expect(v.lots).toHaveLength(3);
    expect(v.lots.every((x) => x.status === 'ready' && x.icon)).toBe(true);
    expect(v.odds).toContain('60%');
    expect(v.odds).toContain('1%');
    expect(v.shelf.rows).toHaveLength(6);
    expect(v.shelf.rows.flatMap((r) => r.cells)).toHaveLength(24);
    expect(v.adButton).toBeUndefined();
  });

  it('사면 결과와 진열장이 바뀌고, 다 사면 안내가 바뀐다', () => {
    const s = pro();
    expect(doAuction(s, 0)!.title).toBeTruthy();
    const v = auctionView(s)!;
    expect(v.lots[0]!.status).toBe('got');
    expect(v.shelf.count).toContain('1/24');
    doAuction(s, 1);
    doAuction(s, 2);
    expect(auctionView(s)!.line).toContain('모두 샀어요');
  });

  it('광고 자리는 시즌에 한 번', () => {
    const s = pro();
    expect(auctionView(s, 'ad')!.adBadge).toBe('광고');
    expect(auctionView(s, 'free')!.adBadge).toBeUndefined();
    expect(doAuctionRefresh(s)).toBeTruthy();
    expect(auctionView(s, 'ad')!.adButton).toBeUndefined();
    expect(doAuctionRefresh(s)).toBeNull();
  });

  it('대표 소장품 장면 문구', () => {
    expect(auctionCredit([{ k: 'watch', g: 4 }])).toEqual([
      expect.objectContaining({ name: '명품 시계', grade: '전설', g: 4 }),
    ]);
  });
});

describe('T-11-735 은퇴 리포트 대표 소장품', () => {
  it('스냅샷은 items, 방금 은퇴한 세이브는 auction.items에서 고른다', () => {
    expect(legendItems({ items: [{ k: 'car', g: 4 }] })).toEqual([{ k: 'car', g: 4 }]);
    expect(
      legendItems({
        auction: {
          items: [
            { k: 'wine', g: 1 },
            { k: 'watch', g: 4 },
          ],
        },
      }),
    ).toEqual([
      { k: 'watch', g: 4 },
      { k: 'wine', g: 1 },
    ]);
    expect(legendItems(null)).toEqual([]);
    expect(legendItems({})).toEqual([]);
  });
});

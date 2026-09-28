import { describe, expect, it } from 'vitest';
import { LegendSnapshotSchema } from '@offside/contracts';
import { newGame } from './engine.js';
import { noteChoice, noteMarket } from './playStyle.js';
import { createRng, setActiveRng } from './rng.js';
import { legendSnapshot } from './season.js';
import type { GameState, MarketOption, OfferOption } from './types.js';

function game(leagueId = 'k1', salary = 1000): GameState {
  setActiveRng(createRng(5));
  const g = newGame(
    { name: '성향', number: 7, pos: 'MF', foot: '오른발', type: 'maker', trait: 'late' },
    5,
  );
  g.leagueId = leagueId;
  g.age = 24;
  g.contract = { years: 2, salary };
  return g;
}
const offer = (leagueId: string, salary: number): OfferOption => ({
  kind: 'offer',
  clubId: `${leagueId}-1`,
  name: 'X',
  leagueId,
  str: 70,
  years: 3,
  salary,
  role: '',
  fee: 0,
});
const stay: MarketOption = { kind: 'stay', name: '잔류', desc: '' };

describe('T-10-077 플레이 성향 카운터', () => {
  it('확률 선택·승부수·안전·확정을 세고, 가장 낮은 확률의 성공을 남긴다', () => {
    const g = game();
    noteChoice(g, 'a', 0.7, true, false);
    noteChoice(g, 'b', 0.3, false, false);
    noteChoice(g, 'c', 0.25, true, false);
    noteChoice(g, 'd', 0.35, true, false);
    noteChoice(g, 'e', 1, true, true);
    noteChoice(g, 'f', 1, true, false);
    expect(g.style).toMatchObject({
      from: 24,
      betOdds: 160,
      bets: 4,
      betWins: 3,
      longshots: 3,
      longshotWins: 2,
      safe: 1,
      sure: 1,
      best: { id: 'c', p: 0.25 },
    });
  });

  it('이적 방향과 연봉 우선 이적, 제의를 뿌리친 잔류를 센다', () => {
    const g = game('k1', 1000);
    noteMarket(g, offer('pl', 900), [offer('pl', 900)]);
    noteMarket(g, offer('k2', 1500), [offer('k2', 1500)]);
    noteMarket(g, offer('k1', 1200), [offer('k1', 1200)]);
    noteMarket(g, stay, [stay, offer('ll', 5000)]);
    noteMarket(g, stay, [stay]);
    expect(g.style).toMatchObject({
      moves: 3,
      tierUp: 1,
      tierDown: 1,
      payFirst: 1,
      loyal: 1,
      snubUp: 1,
    });
  });

  it('아마추어(고교·대학) 시절의 이적 시장은 세지 않는다', () => {
    const g = game('uni');
    noteMarket(g, offer('k1', 500), [offer('k1', 500)]);
    expect(g.style).toBeUndefined();
  });

  it('은퇴 스냅샷에 실리고 서버 계약을 통과한다', () => {
    const g = game();
    expect(legendSnapshot(g)).not.toHaveProperty('style');
    noteChoice(g, 'a', 0.2, true, false);
    const snap = legendSnapshot(g);
    expect(snap.style?.best).toEqual({ id: 'a', p: 0.2 });
    expect(() => LegendSnapshotSchema.parse(snap)).not.toThrow();
  });
});

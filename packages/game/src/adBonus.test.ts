import { afterEach, describe, expect, it } from 'vitest';
import { canClaimSeasonAdBonus, claimSeasonAdBonus, seasonAdBonus } from './adBonus.js';
import { applyBalance } from './balance.js';
import { newGame } from './engine.js';
import { createRng, getActiveRng, setActiveRng } from './rng.js';
import type { GameState } from './types.js';

// T-11-720 시즌 결산 광고 보너스: 연봉 비율 · 하한, 시즌마다 한 번, 게임 난수를 쓰지 않는다.
const fw = (): GameState => {
  setActiveRng(createRng(7));
  const s = newGame(
    { name: '테스트', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'normal' },
    3,
  );
  s.money = 0;
  return s;
};

describe('시즌 결산 광고 보너스 (T-11-720)', () => {
  afterEach(() => applyBalance());

  it('계약이 없으면 하한, 있으면 연봉의 10%', () => {
    const s = fw();
    expect(seasonAdBonus(s)).toBe(200);
    s.contract = { years: 2, salary: 50_000 };
    expect(seasonAdBonus(s)).toBe(5_000);
  });

  it('시즌마다 한 번만 주고, 난수 상태를 건드리지 않는다', () => {
    const s = fw();
    s.contract = { years: 2, salary: 50_000 };
    const seed = getActiveRng().getState().seed;
    expect(claimSeasonAdBonus(s, 2027)).toBe(5_000);
    expect(s.money).toBe(5_000);
    expect(canClaimSeasonAdBonus(s, 2027)).toBe(false);
    expect(claimSeasonAdBonus(s, 2027)).toBe(0);
    expect(s.money).toBe(5_000);
    expect(canClaimSeasonAdBonus(s, 2028)).toBe(true);
    expect(getActiveRng().getState().seed).toBe(seed);
  });

  it('비율과 하한이 모두 0이면 받을 수 없다', () => {
    const s = fw();
    applyBalance({ adSeasonBonus: 0, adSeasonBonusMin: 0 });
    expect(seasonAdBonus(s)).toBe(0);
    expect(canClaimSeasonAdBonus(s, 2027)).toBe(false);
  });

  it('은퇴한 선수는 받을 수 없다', () => {
    const s = fw();
    s.retired = true;
    expect(canClaimSeasonAdBonus(s, 2027)).toBe(false);
  });
});

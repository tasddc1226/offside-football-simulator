import { describe, expect, it } from 'vitest';
import { newGame } from './engine.js';
import { legacyTierOf, legacyToNext, pickLegacy } from './legacy.js';
import { legendSnapshot } from './legend.js';
import { createRng, setActiveRng } from './rng.js';
import { retirementEntry } from './season.js';
import type { GameState } from './types.js';

function vet(money: number): GameState {
  setActiveRng(createRng(3));
  const s = newGame(
    { name: 'a', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'normal' },
    3,
  );
  s.age = 36;
  s.money = money;
  return s;
}

describe('T-11-733 은퇴 유산', () => {
  it('남은 자금으로 등급을 정한다', () => {
    expect(legacyTierOf(699_999)).toBe(0);
    expect(legacyTierOf(700_000)).toBe(1);
    expect(legacyTierOf(3_700_000)).toBe(3);
    expect(legacyTierOf(9e9)).toBe(4);
    expect(legacyToNext(1_000_000)).toBe(700_000);
    expect(legacyToNext(9e9)).toBe(0);
  });

  it('고른 종류로 은퇴하면 유산 · 칭호를 남기고 자금을 쓴다', () => {
    const s = vet(4_000_000);
    pickLegacy(s, 'charity');
    const entry = retirementEntry(s, false, '2026-11-16');
    expect(s.legacy).toEqual({ k: 'charity', t: 3 });
    expect(s.money).toBe(0);
    expect(s.titles?.some((x) => x.id === 'legacy_charity')).toBe(true);
    expect(s.titles?.some((x) => x.id === 'legacy_legend')).toBe(false);
    expect(entry.detail?.legacy).toEqual({ k: 'charity', t: 3 });
  });

  it('고르지 않았거나 동 등급에 못 미치면 아무 일도 없다', () => {
    const a = vet(9e9);
    retirementEntry(a, false, '2026-11-16');
    expect(a.legacy).toBeUndefined();
    expect(a.money).toBe(9e9);
    const b = vet(100);
    pickLegacy(b, 'club');
    retirementEntry(b, false, '2026-11-16');
    expect(b.legacy).toBeUndefined();
    expect(legendSnapshot(b).legacy).toBeUndefined();
  });

  it('같은 종류를 다시 고르면 취소한다', () => {
    const s = vet(0);
    pickLegacy(s, 'academy');
    pickLegacy(s, 'academy');
    expect(s.legacyPick).toBeUndefined();
  });
});

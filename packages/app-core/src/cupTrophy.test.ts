import { describe, expect, it } from 'vitest';
import { cupTrophy, plateText, trophyStage, trophyVariant } from './cupTrophy.js';

describe('cupTrophy (T-11-145)', () => {
  it('우승·준우승·4강만 트로피를 받는다', () => {
    expect(trophyStage('champion')).toBe('champion');
    expect(trophyStage('runnerup')).toBe('runnerup');
    expect(trophyStage('sf')).toBe('sf');
    expect(trophyStage('qf')).toBeNull();
    expect(trophyStage('group')).toBeNull();
  });

  it('단계마다 금·은·동 잔과 브랜드 받침대를 그리고, 우승만 월계수를 단다', () => {
    const gold = cupTrophy('champion');
    const silver = cupTrophy('runnerup');
    const bronze = cupTrophy('sf');
    expect(new Set([gold.palette.base, silver.palette.base, bronze.palette.base]).size).toBe(3);
    for (const t of [gold, silver, bronze]) {
      expect(t.palette.plinth).toBe('#0F2219');
      expect(t.layers.every((l) => l.d.startsWith('M') && l.tone in t.palette)).toBe(true);
    }
    expect(gold.layers.some((l) => l.tone === 'trim')).toBe(true);
    expect(silver.layers.some((l) => l.tone === 'trim')).toBe(false);
    expect(cupTrophy('champion')).toBe(gold);
    // 받침대 레이어만 떼어 낼 수 있다(작은 트로피는 컵만).
    expect(gold.layers.filter((l) => l.plinth)).toHaveLength(4);
  });

  it('받침대에는 구단주 닉네임을, 없으면 시즌을 새긴다', () => {
    expect(plateText('  골든보이 ', 1)).toBe('골든보이');
    expect(plateText(null, 1)).toBe('S1');
    expect(plateText('', 2)).toBe('S2');
    // T-11-253 회차를 함께 새긴다.
    expect(plateText('골든보이', 1, 3)).toBe('제3회 골든보이');
  });

  it('T-11-253 회차마다 모양과 보석이 바뀌고 10회차마다 돈다', () => {
    const paths = (n: number) =>
      cupTrophy('champion', n)
        .layers.filter((l) => !l.plinth)
        .map((l) => l.d)
        .join();
    expect(new Set(Array.from({ length: 10 }, (_, i) => paths(i + 1))).size).toBe(10);
    expect(
      new Set(Array.from({ length: 10 }, (_, i) => cupTrophy('sf', i + 1).palette.gem)).size,
    ).toBe(10);
    expect([trophyVariant(1), trophyVariant(10), trophyVariant(11), trophyVariant(0)]).toEqual([
      0, 9, 0, 0,
    ]);
    expect(cupTrophy('champion', 11)).toBe(cupTrophy('champion', 1));
    // 같은 회차는 금·은·동이 같은 보석을 쓴다. 모든 회차·단계가 받침대 4장을 떼어 낼 수 있다.
    expect(cupTrophy('runnerup', 2).palette.gem).toBe(cupTrophy('champion', 2).palette.gem);
    for (let n = 1; n <= 10; n++)
      for (const s of ['champion', 'runnerup', 'sf'] as const) {
        const t = cupTrophy(s, n);
        expect(t.layers.filter((l) => l.plinth)).toHaveLength(4);
        expect(t.layers.every((l) => l.tone in t.palette)).toBe(true);
      }
  });
});

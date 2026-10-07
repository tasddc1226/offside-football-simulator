import { describe, expect, it } from 'vitest';
import { cupTrophy, plateText, trophyStage } from './cupTrophy.js';

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
  });

  it('받침대에는 구단주 닉네임을, 없으면 시즌을 새긴다', () => {
    expect(plateText('  골든보이 ', 1)).toBe('골든보이');
    expect(plateText(null, 1)).toBe('S1');
    expect(plateText('', 2)).toBe('S2');
  });
});

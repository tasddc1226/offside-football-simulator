import { loadRuleset } from '@offside/content';
import { career06Settled } from '@offside/fixtures';
import { describe, expect, it } from 'vitest';
import { appearanceSummary } from './appearance-summary.js';
import { activeRuleset } from '../engine/content.js';

describe('실제 출전 집계 (#60)', () => {
  it('26경기 중 0분 12경기를 빼고 미사용 교체 6회를 제외한다', () => {
    const stored = { total: 26, started: 8, sub: 12, zeroMinute: 12, out: 6 };
    expect(appearanceSummary(stored)).toEqual({ total: 14, started: 8, sub: 6, zeroMinute: 12, out: 6 });
    expect(stored.total).toBe(26);
    expect(stored.sub).toBe(12);
  });

  it.each([
    { total: 0, started: 0, sub: 0, zeroMinute: 0, out: 0 },
    { total: 10, started: 0, sub: 6, zeroMinute: 10, out: 4 },
    { total: 10, started: 10, sub: 0, zeroMinute: 0, out: 0 },
    career06Settled.golden.beforeSettlement.playerStats.appearances,
  ])('빈 시즌·전 경기 0분·전 경기 선발·골든 기록에서도 출전=선발+실제 교체', (stored) => {
    const actual = appearanceSummary(stored);
    expect(actual.total).toBe(actual.started + actual.sub);
    expect(actual.total).toBeGreaterThanOrEqual(0);
    expect(actual.sub).toBeGreaterThanOrEqual(0);
  });

  it('지원 룰셋에서 0분 선발은 없다는 파생 전제를 검증한다', () => {
    for (const ruleset of [loadRuleset('1.0.0'), activeRuleset]) {
      for (const option of ruleset.matchRules.minutesTable.start) {
        expect(option.subOut ? option.minute : 90).toBeGreaterThan(0);
      }
    }
  });
});

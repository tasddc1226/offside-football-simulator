import type { KpiReport } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import { avgUse, inflow, inflowSplit, itemName, supplyDays } from './kpi-items.ts';
import { viewOf } from './kpi-page.ts';

const report = (rows: KpiReport['rows'], days = ['2026-11-15', '2026-11-16', '2026-11-17']) =>
  viewOf({ generatedAt: '2026-11-18T00:00:00Z', days, rows, sources: [] });
const row = (day: string, metric: string, dim: string, value: number) => ({
  day,
  metric,
  dim,
  value,
});

describe('T-11-739 아이템 화면 계산', () => {
  it('들어온 양 = 남은 장수 변화 + 그날 사용, 첫날 · 빈 날은 null', () => {
    const v = report([
      row('2026-11-15', 'items_held', 'boost', 100),
      row('2026-11-16', 'items_held', 'boost', 90),
      row('2026-11-16', 'items_used', 'boost', 30),
      row('2026-11-16', 'items_bought', 'boost', 13),
    ]);
    expect(inflow(v, 'boost')).toEqual([null, 20, null]);
    expect(inflowSplit(v, 'boost')).toEqual({ bought: [null, 13, null], free: [null, 7, null] });
  });

  it('환불 회수로 들어온 양이 산 장수보다 적으면 받은 것은 0', () => {
    const v = report([
      row('2026-11-15', 'items_held', 'scout', 50),
      row('2026-11-16', 'items_held', 'scout', 40),
      row('2026-11-16', 'items_bought', 'scout', 5),
    ]);
    expect(inflowSplit(v, 'scout')).toEqual({ bought: [null, 5, null], free: [null, 0, null] });
  });

  it('최근 하루 평균 사용과 버티는 날 수, 쓰지 않으면 null', () => {
    const v = report([
      row('2026-11-16', 'items_used', 'reroll', 10),
      row('2026-11-17', 'items_used', 'reroll', 20),
    ]);
    expect(avgUse(v, 'reroll')).toBe(15);
    expect(avgUse(v, 'rename')).toBeNull();
    expect(supplyDays(300, 15)).toBe(20);
    expect(supplyDays(300, null)).toBeNull();
    expect(supplyDays(null, 15)).toBeNull();
    expect(itemName('boost')).toBe('잠재력 강화권');
  });
});

import type { KpiReport } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import { balanceHealth, formatName, placementTotals } from './kpi-insights.ts';
import { viewOf } from './kpi-page.ts';

const report = (rows: KpiReport['rows'], days = ['2026-11-15', '2026-11-16', '2026-11-17']) =>
  viewOf({ generatedAt: '2026-11-18T00:00:00Z', days, rows, sources: [] });
const row = (day: string, metric: string, dim: string, value: number) => ({
  day,
  metric,
  dim,
  value,
});

describe('T-11-741 밸런스 · 새 기능 · 광고 자리 계산', () => {
  it('평균은 은퇴 수로 가중하고 비율은 기간 합으로 낸다', () => {
    const v = report([
      row('2026-11-15', 'bal_retired_peak_band', 'lt80', 1),
      row('2026-11-15', 'bal_retired_age', 'all', 30),
      row('2026-11-16', 'bal_retired_peak_band', '95p', 2),
      row('2026-11-16', 'bal_retired_peak_band', '80_89', 1),
      row('2026-11-16', 'bal_retired_age', 'all', 36),
      row('2026-11-16', 'bal_retired_ballon', 'all', 1),
      row('2026-11-16', 'bal_elite_seasons', 'all', 10),
      row('2026-11-16', 'bal_elite_moved', 'all', 2),
      row('2026-11-16', 'retired_item_top', '0', 2),
      row('2026-11-16', 'retired_item_top', '3', 1),
    ]);
    const h = balanceHealth(v);
    expect(h.age).toBe((30 * 1 + 36 * 3) / 4);
    expect(h.ballon).toEqual({ values: [0, 1 / 3, null], period: 1 / 4 });
    expect(h.eliteMoved).toEqual({ values: [null, 0.2, null], period: 0.2 });
    expect(h.itemTop).toEqual({ values: [null, 1 / 3, null], period: 1 / 3 });
    expect(h.legacy.period).toBeNull();
  });

  it('광고 자리는 시청 · 받은 보상 합이 큰 순, 0인 자리는 빠진다', () => {
    const v = report([
      row('2026-11-15', 'ads_rewarded', 'b', 5),
      row('2026-11-16', 'ads_rewarded', 'b', 5),
      row('2026-11-16', 'ads_free_rewards', 'b', 3),
      row('2026-11-16', 'ads_rewarded', 's', 20),
      row('2026-11-16', 'ads_rewarded', 'a', 0),
    ]);
    expect(placementTotals(v)).toEqual([
      { key: 's', label: '시즌 결산 보너스', watched: 20, free: 0 },
      { key: 'b', label: '잠재력 강화', watched: 10, free: 3 },
    ]);
  });

  it('AdMob 형식 나눔 이름표', () => {
    expect(formatName('android:rewarded')).toBe('Android 보상형');
    expect(formatName('ios:interstitial')).toBe('iOS 전면');
    expect(formatName('web:odd')).toBe('웹 odd');
  });
});

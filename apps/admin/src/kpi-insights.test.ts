import type { KpiReport } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import {
  acqFunnel,
  adFunnel,
  balanceHealth,
  campaignName,
  formatName,
  placementTotals,
  seasonsPerDau,
  webPayFunnel,
} from './kpi-insights.ts';
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

  it('T-11-742 유입 캠페인 단계는 방문 많은 순, 비율은 방문 대비', () => {
    const v = report([
      row('2026-11-15', 'acq_visits', 'meta:-:jp_a', 10),
      row('2026-11-16', 'acq_visits', 'meta:-:jp_a', 10),
      row('2026-11-16', 'acq_started', 'meta:-:jp_a', 5),
      row('2026-11-16', 'acq_store_clicks', 'meta:-:jp_a', 2),
      row('2026-11-16', 'acq_visits', 'direct', 3),
    ]);
    expect(acqFunnel(v)).toEqual([
      {
        dim: 'meta:-:jp_a',
        label: 'meta · jp_a',
        visits: 20,
        started: 5,
        clicks: 2,
        startRate: 0.25,
        clickRate: 0.1,
      },
      {
        dim: 'direct',
        label: '캠페인 없음',
        visits: 3,
        started: 0,
        clicks: 0,
        startRate: 0,
        clickRate: 0,
      },
    ]);
    expect(campaignName('x:x_jp:x_bio')).toBe('x · x_jp · x_bio');
  });

  it('T-11-742 웹 결제 완료율 · DAU당 시즌', () => {
    const v = report([
      row('2026-11-16', 'webpay_orders', 'reroll_40', 4),
      row('2026-11-16', 'webpay_paid', 'reroll_40', 1),
      row('2026-11-16', 'webpay_canceled', 'reroll_40', 1),
      row('2026-11-16', 'seasons_played', 'all', 300),
      row('2026-11-16', 'seasons_played', 'careers', 100),
      row('2026-11-16', 'dau', 'all', 100),
      row('2026-11-17', 'seasons_played', 'all', 50),
      row('2026-11-17', 'active', 'app', 25),
    ]);
    expect(webPayFunnel(v)).toMatchObject({
      orders: 4,
      paid: 1,
      canceled: 1,
      open: 2,
      paidRate: 0.25,
      daily: [null, 0.25, null],
    });
    expect(seasonsPerDau(v)).toEqual([null, 3, 2]);
  });
});

describe('T-11-761 광고 유입 퍼널', () => {
  it('Meta 소재 지출과 서버 유입 단계를 같은 utm 나눔으로 잇는다', () => {
    const jp = 'meta:global_test:jp_reels';
    const hk = 'meta:global_test:zh_reels';
    const v = report([
      // 소재 지출이 없는 날의 방문은 퍼널에서 빠진다(지출과 같은 날들로만 잇는다).
      row('2026-11-15', 'acq_visits', jp, 999),
      row('2026-11-16', 'ad_spend_content_krw', jp, 10000),
      row('2026-11-16', 'ad_impr_content', jp, 2000),
      row('2026-11-16', 'ad_clicks_content', jp, 100),
      row('2026-11-16', 'ad_lpv_content', jp, 80),
      row('2026-11-16', 'acq_visits', jp, 50),
      row('2026-11-16', 'acq_started', jp, 20),
      row('2026-11-16', 'acq_retired', jp, 5),
      row('2026-11-16', 'acq_linked', jp, 2),
      row('2026-11-16', 'acq_store_clicks', jp, 1),
      row('2026-11-17', 'ad_spend_content_krw', hk, 5000),
      row('2026-11-17', 'ad_lpv_content', hk, 10),
      // 유료가 아닌 유입 · 지출 없는 소재 방문
      row('2026-11-17', 'acq_visits', 'direct', 300),
      row('2026-11-17', 'acq_visits', 'meta:global_test:jp_c', 4),
      row('2026-11-17', 'acq_started', 'meta:global_test:jp_c', 1),
    ]);
    const f = adFunnel(v);
    expect(f.creatives.map((c) => c.dim)).toEqual([jp, hk, 'meta:global_test:jp_c']);
    expect(f.creatives[0]).toMatchObject({
      costPerStart: 500,
      costPerRetired: 2000,
      startRate: 0.4,
    });
    expect(f.creatives[1]).toMatchObject({ started: 0, costPerStart: null });
    expect(f.spend).toBe(15000);
    expect(f.steps.map((s) => [s.key, s.value])).toEqual([
      ['impressions', 2000],
      ['clicks', 100],
      ['lpv', 90],
      ['visits', 54],
      ['started', 21],
      ['retired', 5],
      ['linked', 2],
    ]);
    expect(f.steps[0]).toMatchObject({ rate: null, cost: 7500 });
    expect(f.steps[4]!.rate).toBeCloseTo(21 / 54);
    expect(f.dailyCostPerStart).toEqual([null, 500, 5000]);
    expect(f.spendDays).toBe(2);
    expect(f.storeClicks).toBe(1);
  });

  it('기록이 없으면 빈 퍼널', () => {
    const f = adFunnel(report([row('2026-11-16', 'acq_visits', 'direct', 3)]));
    expect(f.creatives).toEqual([]);
    expect(f.spendDays).toBe(0);
    expect(f.steps.every((s) => s.value === 0 && s.cost === null)).toBe(true);
  });
});

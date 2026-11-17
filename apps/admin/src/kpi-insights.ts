// T-11-741 밸런스 이상 감시 · 새 기능 쓰는 비율 · 광고 자리별 시청 · AdMob 형식 이름표. 모두 일일 수집(kpi_daily) 값으로 계산한다.
import { dimLabel, valueOn } from './kpi.ts';
import type { KpiView } from './kpi-page.ts';

/** 보상형 광고 자리(시즌 업로드 ads_json 키). */
export const PLACEMENT_LABEL: Record<string, string> = {
  c: '후보 잠재력',
  p: '잠재력 엿보기',
  b: '잠재력 강화',
  s: '시즌 결산 보너스',
  a: '출석 한 번 더',
  e: '전성기 연장',
  u: '명품 경매',
};
export const placementName = (k: string) => PLACEMENT_LABEL[k] ?? k;

const FORMAT_LABEL: Record<string, string> = {
  banner: '배너',
  interstitial: '전면',
  rewarded: '보상형',
  rewarded_interstitial: '보상형 전면',
  app_open: '앱 열기',
  native: '네이티브',
};
/** 'android:rewarded' → 'Android 보상형'. */
export function formatName(dim: string) {
  const [platform = '', format = ''] = dim.split(':');
  return `${dimLabel(platform)} ${FORMAT_LABEL[format] ?? format}`.trim();
}

/** 은퇴 최고 OVR 구간(작은 순). */
export const PEAK_BANDS = [
  { key: 'lt80', label: '80 미만' },
  { key: '80_89', label: '80~89' },
  { key: '90_94', label: '90~94' },
  { key: '95p', label: '95 이상' },
] as const;

type Ratio = { values: (number | null)[]; period: number | null };
/** 날짜별 비율과 기간 합 비율(분모가 없는 날은 null · 기간 합에서 빠진다). */
function ratioOf(
  v: KpiView,
  num: (d: string) => number | null,
  den: (d: string) => number | null,
): Ratio {
  let n = 0;
  let m = 0;
  const values = v.days.map((d) => {
    const b = den(d);
    if (!b) return null;
    const a = num(d) ?? 0;
    n += a;
    m += b;
    return a / b;
  });
  return { values, period: m ? n / m : null };
}

/** 그날 은퇴 수(최고 OVR 구간 합). 평균 지표의 가중치이자 비율의 분모. */
export const retiredOn = (v: KpiView, d: string) => valueOn(v.idx, d, 'bal_retired_peak_band');

/** 은퇴 수로 가중한 기간 평균(나이 · 최고 OVR · 레전드 점수). */
function weightedAvg(v: KpiView, metric: string) {
  let s = 0;
  let w = 0;
  for (const d of v.days) {
    const x = valueOn(v.idx, d, metric);
    const n = retiredOn(v, d);
    if (x === null || !n) continue;
    s += x * n;
    w += n;
  }
  return w ? s / w : null;
}

/** 기능을 한 번이라도 쓴 은퇴 비율(나눔 '0' = 안 씀). */
const usedShare = (v: KpiView, metric: string) =>
  ratioOf(
    v,
    (d) => {
      const all = valueOn(v.idx, d, metric);
      return all === null ? null : all - (valueOn(v.idx, d, metric, ['0']) ?? 0);
    },
    (d) => valueOn(v.idx, d, metric),
  );

export function balanceHealth(v: KpiView) {
  return {
    age: weightedAvg(v, 'bal_retired_age'),
    peak: weightedAvg(v, 'bal_retired_peak'),
    legend: weightedAvg(v, 'bal_retired_legend'),
    /** 발롱도르를 한 번이라도 받고 은퇴한 비율. */
    ballon: ratioOf(
      v,
      (d) => valueOn(v.idx, d, 'bal_retired_ballon'),
      (d) => retiredOn(v, d),
    ),
    /** 최상위 시즌(OVR 95+ · 31세 이하) 가운데 전 시즌과 구단이 다른 비율. */
    eliteMoved: ratioOf(
      v,
      (d) => valueOn(v.idx, d, 'bal_elite_moved'),
      (d) => valueOn(v.idx, d, 'bal_elite_seasons'),
    ),
    itemTop: usedShare(v, 'retired_item_top'),
    legacy: usedShare(v, 'retired_legacy'),
  };
}

/** 보상형 광고 자리별 기간 합(시청 · 광고 제거로 받은 보상), 큰 순. */
export function placementTotals(v: KpiView) {
  const sum = (metric: string, k: string) =>
    v.days.reduce((s, d) => s + (valueOn(v.idx, d, metric, [k]) ?? 0), 0);
  return Object.keys(PLACEMENT_LABEL)
    .map((k) => ({
      key: k,
      label: placementName(k),
      watched: sum('ads_rewarded', k),
      free: sum('ads_free_rewards', k),
    }))
    .filter((x) => x.watched || x.free)
    .sort((a, b) => b.watched + b.free - (a.watched + a.free));
}

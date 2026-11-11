// T-11-577 kpi_daily(일일 수집) 화면 공용: 보고서 색인 · 나눔별 계열.
import type { KpiReport } from '@offside/contracts';
import { dimSeries, dimsOf, indexRows, nonEmpty, valueOn, type Index } from './kpi.ts';

export type KpiView = { report: KpiReport; idx: Index; days: string[] };
export const viewOf = (report: KpiReport): KpiView => ({
  report,
  idx: indexRows(report),
  days: report.days,
});

/** 나눔(dim)별로 쌓은 계열. 값이 없으면 빈 배열(차트가 빈 글을 보인다). */
export const byDim = (v: KpiView, metric: string) =>
  nonEmpty(dimSeries(v.idx, v.days, metric, dimsOf(v.report, metric)));

/** 기간 안 나눔별 합(큰 순). 값이 한 번도 없는 나눔은 빠진다. */
export const dimTotals = (v: KpiView, metric: string) =>
  dimsOf(v.report, metric)
    .map(({ dim }) => ({
      dim,
      value: v.days.reduce((s, d) => s + (valueOn(v.idx, d, metric, [dim]) ?? 0), 0),
    }))
    .sort((a, b) => b.value - a.value);

/**
 * 기간 재방문(가중 평균) = 돌아온 사람 합 ÷ 그 코호트(첫 방문) 합. 값은 코호트 날짜(가입한 날)에 있어 D7은 일주일 늦게 찬다.
 * cohorts는 셀 수 있었던 코호트 날 수.
 */
export function retention(v: KpiView, n: 1 | 7) {
  let back = 0;
  let base = 0;
  let cohorts = 0;
  for (const d of v.days) {
    const r = valueOn(v.idx, d, `d${n}_retained`);
    const c = valueOn(v.idx, d, 'retention_cohort');
    if (r === null || !c) continue;
    back += r;
    base += c;
    cohorts++;
  }
  return { rate: base ? back / base : null, cohorts };
}

// T-11-693 일일 수집으로 옮긴 지표(알림 · 서비스 상태 · 새 원천) 화면 공용.

/** 기간 합(나눔을 주면 그 나눔만). 하루도 없으면 null. */
export function periodTotal(v: KpiView, metric: string, dims?: readonly string[]) {
  let sum: number | null = null;
  for (const d of v.days) {
    const x = valueOn(v.idx, d, metric, dims);
    if (x !== null) sum = (sum ?? 0) + x;
  }
  return sum;
}

/** 그 지표 · 나눔의 날짜별 값(추세선용). */
export const trendOf = (v: KpiView, metric: string, dims?: readonly string[]) =>
  v.days.map((d) => valueOn(v.idx, d, metric, dims));

/** 기간 안 마지막으로 들어온 값과 그 날(지금 상태 지표: 팔로워 · 기기 수 · DB 크기). */
export function lastValue(v: KpiView, metric: string, dims?: readonly string[]) {
  for (const day of v.days.toReversed()) {
    const value = valueOn(v.idx, day, metric, dims);
    if (value !== null) return { day, value };
  }
  return null;
}

/** 값이 들어온 마지막 날 기준으로 그 지표의 나눔별 값(큰 순). */
export function lastDims(v: KpiView, metric: string) {
  const last = lastValue(v, metric);
  if (!last) return { day: null, items: [] as { dim: string; value: number }[] };
  return {
    day: last.day,
    items: dimsOf(v.report, metric)
      .map(({ dim }) => ({ dim, value: valueOn(v.idx, last.day, metric, [dim]) ?? 0 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value),
  };
}

/**
 * 매일 들어와야 하는 지표 가운데 늦는 것. 원천 단위 확인은 한 지표만 끊겨도 놓친다(스토어 리뷰는 오는데 설치 수가 안 오던 경우).
 * allow = 원래 늦게 확정되는 날 수(스토어 설치 · 검색은 며칠 늦다). 기간 안에 한 번도 없으면 lag는 null.
 */
export const EXPECTED_METRICS: readonly {
  metric: string;
  dim?: string;
  label: string;
  allow: number;
}[] = [
  { metric: 'signups', label: '가입 (운영 DB)', allow: 0 },
  { metric: 'push_recipients', label: '보낸 알림 (운영 DB)', allow: 0 },
  { metric: 'api_requests', label: 'API 요청 (운영 DB)', allow: 0 },
  { metric: 'chat', label: '라운지 채팅 (운영 DB)', allow: 0 },
  { metric: 'dau', label: 'DAU (GA4)', allow: 0 },
  { metric: 'push_optin_users', label: '알림 권유 퍼널 (GA4)', allow: 0 },
  { metric: 'ad_spend_krw', label: '광고 지출 (Meta)', allow: 0 },
  { metric: 'ad_revenue_krw', label: '광고 수익 (AdMob)', allow: 0 },
  { metric: 'store_reviews_new', label: '새 리뷰 (스토어)', allow: 0 },
  { metric: 'store_installs', dim: 'ios', label: 'iOS 설치 (App Store)', allow: 2 },
  { metric: 'store_installs', dim: 'android', label: 'Android 설치 (Play)', allow: 5 },
  { metric: 'followers', label: 'SNS 팔로워', allow: 0 },
  { metric: 'search_clicks', label: '검색 클릭 (Search Console)', allow: 4 },
  { metric: 'voice_open', label: '유저 반응 표', allow: 0 },
  { metric: 'support_mails', label: '고객 문의 메일', allow: 0 },
  { metric: 'ota_published', label: 'OTA 게시 (EAS)', allow: 0 },
];
export function laggingMetrics(v: KpiView) {
  const yesterday = v.days.at(-1);
  return EXPECTED_METRICS.flatMap((e) => {
    const last = lastValue(v, e.metric, e.dim ? [e.dim] : undefined);
    const lag =
      last && yesterday
        ? Math.round((Date.parse(yesterday) - Date.parse(last.day)) / 86_400_000)
        : null;
    return lag !== null && lag <= e.allow ? [] : [{ ...e, lastDay: last?.day ?? null, lag }];
  });
}

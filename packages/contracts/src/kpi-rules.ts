// T-11-572 운영 지표 대시보드 상수. zod 없는 서브패스(`@offside/contracts/kpi-rules`) — 대시보드 번들이 zod를 싣지 않게. 모양은 kpi.ts.
export const KPI_SOURCES = ['d1', 'ga4', 'admob', 'meta', 'store'] as const;
export type KpiSource = (typeof KPI_SOURCES)[number];

/** 외부 원천이 넣을 수 있는 지표 이름(원천마다). 운영 D1 지표는 서버 일일 cron만 쓴다. */
export const KPI_EXTERNAL_METRICS = {
  ga4: ['dau', 'new_users', 'd1_retention', 'd7_retention', 'sessions'],
  admob: ['ad_revenue_krw', 'ad_impressions', 'ad_requests', 'ad_matched'],
  meta: ['ad_spend_krw', 'ad_impressions_paid', 'ad_clicks', 'ad_installs'],
  store: ['store_rating', 'store_reviews_new', 'store_installs'],
} as const satisfies Record<Exclude<KpiSource, 'd1'>, readonly string[]>;

export const KPI_DAYS = [7, 30, 90] as const;

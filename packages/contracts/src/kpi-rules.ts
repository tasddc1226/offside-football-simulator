// T-11-572 운영 지표 대시보드 상수. zod 없는 서브패스(`@offside/contracts/kpi-rules`) — 대시보드 번들이 zod를 싣지 않게. 모양은 kpi.ts.
export const KPI_SOURCES = ['d1', 'ga4', 'admob', 'meta', 'store'] as const;
export type KpiSource = (typeof KPI_SOURCES)[number];

/**
 * 외부 원천이 넣을 수 있는 지표 이름(원천마다). 운영 D1 지표는 서버 일일 cron만 쓴다.
 * 한 지표의 나눔(dim)은 서로 겹치지 않아야 한다(대시보드가 나눔을 더해 전체를 만든다). 같은 값을 다른 기준으로 나누면 지표 이름을 따로 둔다.
 * T-11-577: d1 · d7_retention(day = 가입한 날, dim all, 0~1) · *_retained/*_cohort(분자 · 분모), Meta 국가별(*_country, dim = 국가 코드),
 * 스토어 새 리뷰 · 평균 별점(store_review_stars, 그날 새 리뷰 평균) · App Store 전체 평점(store_rating, dim ios).
 */
export const KPI_EXTERNAL_METRICS = {
  ga4: [
    'dau',
    'new_users',
    'sessions',
    'd1_retention',
    'd7_retention',
    'retention_cohort',
    'd1_retained',
    'd7_retained',
  ],
  admob: ['ad_revenue_krw', 'ad_impressions', 'ad_requests', 'ad_matched'],
  meta: [
    'ad_spend_krw',
    'ad_impressions_paid',
    'ad_clicks',
    'ad_installs',
    'ad_spend_country_krw',
    'ad_installs_country',
    'ad_clicks_country',
  ],
  store: ['store_rating', 'store_reviews_new', 'store_review_stars', 'store_installs'],
} as const satisfies Record<Exclude<KpiSource, 'd1'>, readonly string[]>;

export const KPI_DAYS = [7, 30, 90] as const;

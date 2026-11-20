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

// T-11-742 플레이 깊이 · 유입 단계 · 웹 결제 단계 · 구단 자금 흐름.

/** 'meta:-:jp_a' → 'meta · jp_a', 'direct' → '캠페인 없음'. */
export function campaignName(dim: string) {
  if (dim === 'direct') return '캠페인 없음';
  return dim
    .split(':')
    .filter((x) => x && x !== '-')
    .join(' · ');
}

/** 유입 캠페인별 기간 합과 단계 전환(방문 → 커리어 시작 → 스토어 클릭), 방문 많은 순. */
export function acqFunnel(v: KpiView) {
  const sum = (metric: string, dim: string) =>
    v.days.reduce((s, d) => s + (valueOn(v.idx, d, metric, [dim]) ?? 0), 0);
  const dims = new Set(v.report.rows.filter((r) => r.metric === 'acq_visits').map((r) => r.dim));
  return [...dims]
    .map((dim) => {
      const visits = sum('acq_visits', dim);
      const started = sum('acq_started', dim);
      const clicks = sum('acq_store_clicks', dim);
      return {
        dim,
        label: campaignName(dim),
        visits,
        started,
        clicks,
        startRate: visits ? started / visits : null,
        clickRate: visits ? clicks / visits : null,
      };
    })
    .filter((x) => x.visits > 0)
    .sort((a, b) => b.visits - a.visits);
}

/** 웹 결제 기간 합과 결제 완료율(주문 → 결제 완료). */
export function webPayFunnel(v: KpiView) {
  const total = (metric: string) =>
    v.days.reduce((s, d) => s + (valueOn(v.idx, d, metric) ?? 0), 0);
  const orders = total('webpay_orders');
  const paid = total('webpay_paid');
  const canceled = total('webpay_canceled');
  return {
    orders,
    paid,
    canceled,
    open: Math.max(0, orders - paid - canceled),
    paidRate: orders ? paid / orders : null,
    daily: v.days.map((d) => {
      const o = valueOn(v.idx, d, 'webpay_orders');
      return o ? (valueOn(v.idx, d, 'webpay_paid') ?? 0) / o : null;
    }),
  };
}

const FUND_KIND: Record<string, string> = {
  opening: '시작 자금',
  item: '아이템 상점',
  enhance: '카드 강화',
  market_buy: '이적시장 구매',
  market_sale: '이적시장 판매',
  release: '방출',
  manager_release: '감독 방출',
};
export const fundKindName = (k: string) => FUND_KIND[k] ?? k;

/** 날짜별 DAU당 시즌 수. DAU는 GA4, 없으면 운영 DB 접속. */
export const seasonsPerDau = (v: KpiView) =>
  v.days.map((d) => {
    const n = valueOn(v.idx, d, 'seasons_played', ['all']);
    const dau = valueOn(v.idx, d, 'dau') ?? valueOn(v.idx, d, 'active');
    return n === null || !dau ? null : n / dau;
  });

// T-11-761 광고 유입 퍼널: Meta 광고(지출 · 노출 · 클릭 · 랜딩 조회, 에이전트 수집)와 서버 유입 단계(방문 · 커리어 시작 · 은퇴 ·
// 로그인 연결 · 스토어 클릭, 일일 수집)를 같은 utm 소재 나눔('meta:global_test:jp_reels')으로 잇는다.

/** 퍼널에 넣을 유료 출처(utm_source). */
const PAID_SOURCES = ['meta'];
const isPaid = (dim: string) => PAID_SOURCES.includes(dim.split(':')[0] ?? '');

export type AdCreativeFunnel = {
  dim: string;
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  lpv: number;
  visits: number;
  started: number;
  retired: number;
  linked: number;
  storeClicks: number;
  /** 커리어 시작 1건당 지출. 지출이나 시작이 없으면 null. */
  costPerStart: number | null;
  costPerRetired: number | null;
  /** 서버 방문 가운데 커리어를 시작한 비율. */
  startRate: number | null;
};

export type AdFunnelStep = {
  key: string;
  label: string;
  value: number;
  /** 바로 앞 단계 대비. 첫 단계는 null. */
  rate: number | null;
  /** 이 단계 1건당 지출. */
  cost: number | null;
};

const per = (a: number, b: number) => (a && b ? a / b : null);

export function adFunnel(v: KpiView) {
  const dims = new Set(
    v.report.rows
      .filter(
        (r) => (r.metric === 'ad_spend_content_krw' || r.metric === 'acq_visits') && isPaid(r.dim),
      )
      .map((r) => r.dim),
  );
  const paidDims = [...dims];
  // 지출과 서버 단계를 같은 날들로만 잇는다. 소재 지출이 들어온 날이 있으면 그날들만, 하나도 없으면 기간 전체(서버 단계만 보인다).
  const spendDays = v.days.filter(
    (d) => valueOn(v.idx, d, 'ad_spend_content_krw', paidDims) !== null,
  );
  const span = spendDays.length ? spendDays : v.days;
  const total = (metric: string, dim: string) =>
    span.reduce((s, d) => s + (valueOn(v.idx, d, metric, [dim]) ?? 0), 0);
  const creatives: AdCreativeFunnel[] = [...dims]
    .map((dim) => {
      const spend = total('ad_spend_content_krw', dim);
      const visits = total('acq_visits', dim);
      const started = total('acq_started', dim);
      const retired = total('acq_retired', dim);
      return {
        dim,
        label: campaignName(dim),
        spend,
        impressions: total('ad_impr_content', dim),
        clicks: total('ad_clicks_content', dim),
        lpv: total('ad_lpv_content', dim),
        visits,
        started,
        retired,
        linked: total('acq_linked', dim),
        storeClicks: total('acq_store_clicks', dim),
        costPerStart: per(spend, started),
        costPerRetired: per(spend, retired),
        startRate: per(started, visits),
      };
    })
    .filter((c) => c.spend > 0 || c.visits > 0)
    .sort((a, b) => b.spend - a.spend || b.visits - a.visits);

  const sum = (k: keyof AdCreativeFunnel) => creatives.reduce((s, c) => s + (c[k] as number), 0);
  const spend = sum('spend');
  const raw: [string, string, number][] = [
    ['impressions', '노출', sum('impressions')],
    ['clicks', '클릭', sum('clicks')],
    ['lpv', '랜딩 페이지 조회', sum('lpv')],
    ['visits', '서버 방문', sum('visits')],
    ['started', '커리어 시작', sum('started')],
    ['retired', '은퇴까지', sum('retired')],
    ['linked', '로그인 연결', sum('linked')],
  ];
  const steps: AdFunnelStep[] = raw.map(([key, label, value], i) => ({
    key,
    label,
    value,
    rate: i ? per(value, raw[i - 1]![2]) : null,
    cost: key === 'impressions' ? per(spend * 1000, value) : per(spend, value),
  }));

  // 날짜별 커리어 시작당 지출(그날 소재 지출 ÷ 그날 방문에서 이어진 시작). 지출이 없는 날은 null.
  const dailyCostPerStart = v.days.map((d) => {
    const s = valueOn(v.idx, d, 'ad_spend_content_krw', paidDims);
    const st = valueOn(v.idx, d, 'acq_started', paidDims);
    return s && st ? s / st : null;
  });
  return {
    spend,
    storeClicks: sum('storeClicks'),
    steps,
    creatives,
    dailyCostPerStart,
    /** 퍼널을 센 날 수(소재 지출이 들어온 날). 0이면 지출 없이 기간 전체 서버 단계만 셌다. */
    spendDays: spendDays.length,
    platforms: adPlatforms(v),
  };
}

const PLATFORM_NAMES: Record<string, string> = {
  ig: 'Instagram',
  fb: 'Facebook',
  an: 'Audience Network',
  msg: 'Messenger',
  th: 'Threads',
  wa: 'WhatsApp',
};
export type AdPlatformRow = {
  dim: string;
  label: string;
  spend: number;
  share: number | null;
  lpv: number;
  visits: number;
  started: number;
  costPerStart: number | null;
};
/**
 * T-11-769 게재 플랫폼별 지출(Meta) ↔ 서버 방문 · 커리어 시작(광고 링크 utm_term 앞부분). 플랫폼 지출이 들어온 날만 센다.
 * 광고 링크에 utm_term을 붙이기 전 방문은 서버 쪽 칸이 0이다(hasServer로 알린다).
 */
export function adPlatforms(v: KpiView) {
  const pick = (m: string) =>
    v.report.rows.filter((r) => r.metric === m && isPaid(r.dim)).map((r) => r.dim);
  const dims = [...new Set([...pick('ad_spend_platform_krw'), ...pick('acq_visits_place')])];
  const days = v.days.filter((d) => valueOn(v.idx, d, 'ad_spend_platform_krw', dims) !== null);
  const total = (metric: string, dim: string) =>
    days.reduce((s, d) => s + (valueOn(v.idx, d, metric, [dim]) ?? 0), 0);
  const rows = dims.map((dim) => {
    const spend = total('ad_spend_platform_krw', dim);
    const started = total('acq_started_place', dim);
    const key = dim.split(':')[1] ?? dim;
    return {
      dim,
      label: PLATFORM_NAMES[key] ?? key,
      spend,
      share: null as number | null,
      lpv: total('ad_lpv_platform', dim),
      visits: total('acq_visits_place', dim),
      started,
      costPerStart: per(spend, started),
    };
  });
  const all = rows.reduce((s, r) => s + r.spend, 0);
  for (const r of rows) r.share = per(r.spend, all);
  return {
    rows: rows
      .filter((r) => r.spend > 0 || r.visits > 0)
      .sort((a, b) => b.spend - a.spend || b.visits - a.visits) as AdPlatformRow[],
    days: days.length,
    hasServer: rows.some((r) => r.visits > 0),
  };
}

// T-11-080f 시세 차트(웹 ui/MarketChart · 앱 screens/owner/MarketChart.tsx 공용) — 좌표·문구만 계산한다.
// 비율은 기준가 대비 천분율(1000 = 기준가 그대로). 좌표는 0~100 상자(위가 높은 값)라 SVG viewBox에 그대로 쓴다.
import type { MarketCardTradesResponse, MarketChartPoint } from '@offside/contracts';
import { DAY_MS, kstDay } from '@offside/contracts/kst';
import { MARKET_CHART_DAYS, type MarketChartRange } from '@offside/contracts/market-value';

export const CHART_RANGES: readonly [MarketChartRange, string][] = [
  ['week', '1주'],
  ['month', '1달'],
  ['season', '시즌'],
];

const dayNum = (d: string) => Date.parse(`${d}T00:00:00Z`) / DAY_MS;
/** 10/5 */
const dayLabel = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const pct1 = (r: number) => Number((r / 10).toFixed(1));

/** 천분율 → '98.6%' · '100%'. */
export const ratioPct = (r: number) => `${pct1(r)}%`;

export type ChartTone = 'up' | 'down' | 'same';
const toneOf = (d: number): ChartTone => (d > 0 ? 'up' : d < 0 ? 'down' : 'same');

export type CardTrade = MarketCardTradesResponse['trades'][number];

export interface ChartModel {
  /** 하루 평균 꺾은선(SVG path). 점이 하나면 짧은 가로선. */
  line: string;
  /** 하루 최저~최고 띠(SVG path, 닫힌 도형). */
  band: string;
  /** 기준가(100%) 점선 높이. */
  base: number;
  /** 하루 평균 점(누르면 그날 값을 보여 준다). */
  days: { x: number; y: number; p: MarketChartPoint }[];
  /** 이 선수의 실제 거래. */
  dots: { x: number; y: number; t: CardTrade }[];
  /** 세로축 위·아래 눈금 문구. */
  top: string;
  bottom: string;
  /** 가로축 처음·끝 날짜. */
  from: string;
  to: string;
  tone: ChartTone;
}

/**
 * 기간 안의 하루치 시세와 이 선수 거래로 그림 좌표를 만든다. 둘 다 없으면 null(빈 상태 문구).
 * 가로축은 기간 첫날~오늘(시즌이면 첫 거래일~오늘), 세로축은 값과 기준가를 모두 담고 위아래 50(5%p)씩 띄운다.
 */
export function chartModel(
  points: readonly MarketChartPoint[],
  trades: readonly CardTrade[],
  range: MarketChartRange,
  today = kstDay(new Date().toISOString()),
): ChartModel | null {
  const days = MARKET_CHART_DAYS[range];
  const end = dayNum(today);
  const sold = trades.map((t) => ({ t, day: kstDay(t.soldAt) }));
  const start = days
    ? end - (days - 1)
    : Math.min(end - 1, ...points.map((p) => dayNum(p.day)), ...sold.map((s) => dayNum(s.day)));
  const inRange = sold.filter((s) => dayNum(s.day) >= start);
  if (!points.length && !inRange.length) return null;

  const vals = [1000, ...points.flatMap((p) => [p.min, p.max]), ...inRange.map((s) => s.t.ratio)];
  const lo = Math.floor((Math.min(...vals) - 50) / 50) * 50;
  const hi = Math.ceil((Math.max(...vals) + 50) / 50) * 50;
  const span = Math.max(1, end - start);
  const x = (day: string) => Math.round(((dayNum(day) - start) / span) * 1000) / 10;
  const y = (v: number) => Math.round((8 + ((hi - v) / (hi - lo)) * 84) * 10) / 10;

  const pts = points.map((p) => ({ x: x(p.day), y: y(p.avg), p }));
  const line =
    pts.length === 1
      ? `M${Math.max(0, pts[0]!.x - 2)},${pts[0]!.y}L${Math.min(100, pts[0]!.x + 2)},${pts[0]!.y}`
      : pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join('');
  const band = points.length
    ? `${points.map((p, i) => `${i ? 'L' : 'M'}${x(p.day)},${y(p.max)}`).join('')}${[...points]
        .reverse()
        .map((p) => `L${x(p.day)},${y(p.min)}`)
        .join('')}Z`
    : '';
  const first = points[0]?.avg;
  const last = points.at(-1)?.avg;
  return {
    line: pts.length ? line : '',
    band,
    base: y(1000),
    days: pts,
    dots: inRange.map((s) => ({ x: x(s.day), y: y(s.t.ratio), t: s.t })),
    top: ratioPct(hi),
    bottom: ratioPct(lo),
    from: dayLabel(new Date(start * DAY_MS).toISOString().slice(0, 10)),
    to: dayLabel(today),
    tone: first !== undefined && last !== undefined ? toneOf(last - first) : 'same',
  };
}

/**
 * 이적시장 머리의 시장 지수 한 줄: 마지막 거래일 평균, 그 전 거래일과의 차이(%p), 기간 거래 수,
 * 작은 꺾은선(거래가 있는 날만 펼친 선과 기준가 높이).
 */
export function marketIndex(points: readonly MarketChartPoint[]) {
  const last = points.at(-1);
  if (!last) return null;
  const prev = points.at(-2);
  const d = prev ? last.avg - prev.avg : 0;
  const spark = chartModel(points, [], 'season', last.day)!;
  return {
    pct: ratioPct(last.avg),
    tone: toneOf(d),
    change: d === 0 ? '변동 없음' : `${d > 0 ? '▲' : '▼'} ${pct1(Math.abs(d))}%p`,
    trades: points.reduce((n, p) => n + p.trades, 0),
    spark: { line: spark.line, base: spark.base },
  };
}

/** 하루 평균 점을 눌렀을 때 위에 보여 주는 한 줄. */
export const dayText = (p: MarketChartPoint) =>
  `${dayLabel(p.day)} · 평균 ${ratioPct(p.avg)} · ${p.trades}건`;
/** 이 선수 거래 점을 눌렀을 때. */
export const tradeText = (t: CardTrade) =>
  `${dayLabel(kstDay(t.soldAt))} 이 선수 · ${ratioPct(t.ratio)}`;

export const CHART_COPY = {
  title: '같은 포지션 · 등급 시세',
  /** 묶음 설명: '공격수 OVR 85~89' */
  group: (posLabel: string, band: number) => `${posLabel} OVR ${band}~${band + 4}`,
  legendLine: '하루 평균',
  legendDot: '이 선수 거래',
  empty: '아직 거래가 없어요.',
  failed: '시세를 불러오지 못했어요.',
  index: '시장 시세',
  indexSub: (trades: number) => `최근 7일 거래 ${trades}건 · 기준가 대비`,
} as const;

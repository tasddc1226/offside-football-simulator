// T-11-321 설정의 '서버 상태'. GET /v1/status(5분 칸 실측)를 화면에 그릴 값으로 바꾼다(웹 ServerStatus.svelte · 앱
// screens/settings/ServerStatus.tsx는 그리기만 한다). 칸을 펼칠 때만 불러온다.
import type { ServerStatus, ServerStatusBucket } from '@offside/contracts';
import { DAY_MS, kstDay } from '@offside/contracts/kst';
import { cachedGet } from './api/client';
import { serverStatusText as L } from './i18n/ko/serverStatus';

const BUCKET_MS = 5 * 60_000;
/** '최근 15분'에 쓰는 끝난 칸 수. 지금 칸은 아직 차는 중이라 뺀다. */
const RECENT_BUCKETS = 3;
const SLOW_AVG_MS = 800;
const SLOW_SHARE = 0.1;
const ERROR_SHARE = 0.02;

export type StatusLevel = 'ok' | 'slow' | 'down' | 'unknown';

export interface ServerStatusView {
  level: StatusLevel;
  headline: string;
  /** [이름, 값]. 최근 끝난 칸 셋이 없으면 비어 있다. */
  recent: (readonly [string, string])[];
  /** 최근 24시간, 한 시간 묶음(오래된 순). value는 막대 높이 0~1. */
  hours: { label: string; requests: number; avgMs: number; reqBar: number; avgBar: number }[];
  /** 최근 30일, 최신순. */
  days: { day: string; requests: string; avg: string; slow: string }[];
  /** 어제 요청 수와 일주일 전 비교. 어제 기록이 없으면 null. */
  trend: string | null;
}

const num = (n: number) => Math.round(n).toLocaleString('en-US');
const ms = (n: number) => `${num(n)}ms`;
const pct = (part: number, whole: number) =>
  whole && part ? `${((part / whole) * 100).toFixed(part / whole < 0.1 ? 1 : 0)}%` : '0%';

function sum(list: Pick<ServerStatusBucket, 'requests' | 'avgMs' | 'slow' | 'errors'>[]) {
  let requests = 0;
  let totalMs = 0;
  let slow = 0;
  let errors = 0;
  for (const b of list) {
    requests += b.requests;
    totalMs += b.avgMs * b.requests;
    slow += b.slow;
    errors += b.errors;
  }
  return { requests, avgMs: requests ? totalMs / requests : 0, slow, errors };
}

export function levelOf(s: ReturnType<typeof sum>): StatusLevel {
  if (!s.requests) return 'unknown';
  if (s.errors / s.requests >= ERROR_SHARE) return 'down';
  if (s.avgMs >= SLOW_AVG_MS || s.slow / s.requests >= SLOW_SHARE) return 'slow';
  return 'ok';
}

const HEADLINE: Record<StatusLevel, string> = {
  ok: L.levelOk,
  slow: L.levelSlow,
  down: L.levelDown,
  unknown: L.levelUnknown,
};

export function serverStatusView(data: ServerStatus, now = Date.now()): ServerStatusView {
  const currentStart = Math.floor(now / BUCKET_MS) * BUCKET_MS;
  const done = data.buckets.filter((b) => Date.parse(b.at) < currentStart);
  const recentFrom = currentStart - RECENT_BUCKETS * BUCKET_MS;
  const recentSum = sum(done.filter((b) => Date.parse(b.at) >= recentFrom));
  const level = levelOf(recentSum);
  const recent: (readonly [string, string])[] = recentSum.requests
    ? [
        [L.perMinute, num(recentSum.requests / (RECENT_BUCKETS * 5))],
        [L.avgResponse, ms(recentSum.avgMs)],
        [L.slowShare, pct(recentSum.slow, recentSum.requests)],
        [L.errorShare, pct(recentSum.errors, recentSum.requests)],
      ]
    : [];

  // 24시간을 한 시간씩(지금 시각이 든 시간이 마지막 막대).
  const hourStart = Math.floor(now / 3_600_000) * 3_600_000;
  const groups = Array.from({ length: 24 }, (_, i) => {
    const from = hourStart - (23 - i) * 3_600_000;
    const s = sum(
      data.buckets.filter((b) => {
        const t = Date.parse(b.at);
        return t >= from && t < from + 3_600_000;
      }),
    );
    const kstHour = new Date(from + 9 * 3_600_000).getUTCHours();
    return { label: `${kstHour}`, requests: s.requests, avgMs: Math.round(s.avgMs) };
  });
  const maxReq = Math.max(1, ...groups.map((g) => g.requests));
  const maxAvg = Math.max(1, ...groups.map((g) => g.avgMs));
  const hours = groups.map((g) => ({
    ...g,
    reqBar: g.requests / maxReq,
    avgBar: g.avgMs / maxAvg,
  }));

  const days = [...data.days].reverse().map((d) => ({
    day: d.day.slice(5).replace('-', '.'),
    requests: num(d.requests),
    avg: ms(d.avgMs),
    slow: pct(d.slow, d.requests),
  }));

  const yesterday = kstDay(new Date(now - DAY_MS).toISOString());
  const weekAgo = kstDay(new Date(now - 8 * DAY_MS).toISOString());
  const y = data.days.find((d) => d.day === yesterday);
  const w = data.days.find((d) => d.day === weekAgo);
  let trend: string | null = null;
  if (y) {
    const n = num(y.requests);
    if (!w || !w.requests) trend = L.yesterday({ n });
    else {
      const change = (y.requests - w.requests) / w.requests;
      const p = `${Math.round(Math.abs(change) * 100)}%`;
      trend =
        Math.abs(change) < 0.05
          ? L.trendFlat({ n })
          : change > 0
            ? L.trendUp({ n, pct: p })
            : L.trendDown({ n, pct: p });
    }
  }

  return { level, headline: HEADLINE[level], recent, hours, days, trend };
}

export const loadServerStatus = (): Promise<ServerStatusView | 'error'> =>
  cachedGet<ServerStatus>('/v1/status', 60_000).then((r) =>
    r.ok ? serverStatusView(r.data) : 'error',
  );

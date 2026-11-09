// ───────── T-11-675 은퇴 동기 비교(웹 · 앱 공용) ─────────
// 서버가 하루 한 번 만든 같은 시즌 은퇴 선수 분포(포지션별)에서 내 기록의 자리를 고른다. 판정은 기기에서 하고 서버에는
// 분포 한 번만 묻는다(10분 메모 · 엣지 캐시 한 시간).
import {
  COHORT_METRICS,
  COHORT_MIN,
  COHORT_SHOW_MAX,
  cohortPctLabel,
  cohortTop,
  RETIRE_COHORT_PATH,
  RetireCohortResponseSchema,
  type CohortMetric,
  type CohortPos,
  type RetireCohort,
  type RetireCohortResponse,
} from '@offside/contracts/retire-cohort';
import { POS_LABEL } from '@offside/game/pos-label';
import { tn } from '@offside/game/i18n/names';
import { cachedGet, type ApiResult } from './api/client.js';
import { retiredText as L } from './i18n/ko/retired.js';
import type { LegendView } from './state.js';

export type CohortTotals = Record<CohortMetric, number>;
export type CohortLine = { metric: CohortMetric; value: number; pct: number; top: string };
export type CohortView = { season: number; pos: CohortPos; n: number; lines: CohortLine[] };

/** 은퇴 리포트가 그리는 숫자(LegendView)를 비교 기록으로. 서버 은퇴 요약 · careers 열과 같은 값이다. */
export const cohortTotalsOf = (v: Pick<LegendView, 'score' | 'peak' | 'totals'>): CohortTotals => ({
  score: v.score,
  peak: v.peak,
  apps: v.totals.apps,
  goals: v.totals.goals,
  assists: v.totals.assists,
  trophies: v.totals.trophies,
  caps: v.totals.caps,
  ballon: v.totals.ballon,
});

/**
 * 같은 포지션 동기 중 상위 COHORT_SHOW_MAX% 안에 드는 기록을 자리가 좋은 순으로 max개까지. 분포가 없거나, 그 포지션
 * 인원이 COHORT_MIN보다 적거나, 드는 기록이 없으면 null(화면은 아무것도 그리지 않는다).
 */
export function cohortView(
  cohort: RetireCohort | null | undefined,
  pos: string,
  totals: CohortTotals,
  max = 3,
): CohortView | null {
  const group = cohort?.pos[pos as CohortPos];
  if (!cohort || !group || group.n < COHORT_MIN) return null;
  const lines: CohortLine[] = [];
  for (const metric of COHORT_METRICS) {
    const value = totals[metric];
    const pct = cohortTop(group.m[metric] ?? [], value);
    if (pct === null || pct > COHORT_SHOW_MAX) continue;
    lines.push({ metric, value, pct, top: cohortPctLabel(pct) });
  }
  if (!lines.length) return null;
  lines.sort(
    (a, b) => a.pct - b.pct || COHORT_METRICS.indexOf(a.metric) - COHORT_METRICS.indexOf(b.metric),
  );
  return { season: cohort.season, pos: pos as CohortPos, n: group.n, lines: lines.slice(0, max) };
}

/** 분포 한 번 읽기. 실패 · 아직 계산 전이면 null. */
export async function loadRetireCohort(): Promise<RetireCohort | null> {
  const r: ApiResult<RetireCohortResponse> = await cachedGet<RetireCohortResponse>(
    RETIRE_COHORT_PATH,
    10 * 60_000,
  );
  if (!r.ok) return null;
  const parsed = RetireCohortResponseSchema.safeParse(r.data);
  return parsed.success ? parsed.data : null;
}

const LABEL: Record<CohortMetric, () => string> = {
  score: () => L.cohortScore,
  peak: () => L.cohortPeak,
  apps: () => L.cohortApps,
  goals: () => L.cohortGoals,
  assists: () => L.cohortAssists,
  trophies: () => L.cohortTrophies,
  caps: () => L.cohortCaps,
  ballon: () => L.cohortBallon,
};
/** 화면 문구: 제목 한 줄과 기록마다 [이름, 값, 상위 %]. */
export const cohortText = (v: CohortView) => ({
  title: L.cohortTitle({
    season: v.season,
    pos: tn(POS_LABEL[v.pos]),
    n: v.n.toLocaleString('en-US'),
  }),
  lines: v.lines.map((x) => ({
    metric: x.metric,
    label: LABEL[x.metric](),
    value: x.value.toLocaleString('en-US'),
    top: L.cohortTop({ pct: x.top }),
  })),
  note: L.cohortNote,
});

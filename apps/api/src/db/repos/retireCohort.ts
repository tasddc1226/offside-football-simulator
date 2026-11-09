import {
  COHORT_METRICS,
  COHORT_MIN,
  COHORT_POSITIONS,
  cohortPoints,
  RetireCohortSchema,
  type CohortMetric,
  type CohortPos,
  type RetireCohort,
} from '@offside/contracts/retire-cohort';
import { displaySeasonAt } from '@offside/contracts/service-seasons';

// T-11-675 은퇴 동기 비교. 하루 한 번(일일 cron) 그 시즌에 은퇴한 커리어의 포지션별 분포 지점을 app_meta 한 행에 둔다.
// 공개 조회(GET /v1/retire-cohort)는 이 행 하나를 읽어 엣지 캐시하고, 은퇴할 때마다 careers를 훑지 않는다.

export const RETIRE_COHORT_KEY = 'retire:cohort';

const COLUMN: Record<CohortMetric, string> = {
  score: 'legend_score',
  peak: 'peak',
  apps: 'apps',
  goals: 'goals',
  assists: 'assists',
  trophies: 'trophies',
  caps: 'caps',
  ballon: 'ballon',
};

type Row = Record<CohortMetric, number | null>;

/** 한 시즌 · 한 포지션의 은퇴 커리어 기록(careers_hof_season_score_order_idx로 그 시즌 행만 찾는다). */
async function rowsOf(d1: D1Database, season: number, pos: string): Promise<Row[]> {
  const cols = COHORT_METRICS.map((m) => `${COLUMN[m]} AS ${m}`).join(', ');
  const { results } = await d1
    .prepare(
      `SELECT ${cols} FROM careers WHERE status = 'retired' AND hidden = 0 AND service_season = ? AND pos = ?`,
    )
    .bind(season, pos)
    .all<Row>();
  return results;
}

async function cohortOf(d1: D1Database, season: number, now: string): Promise<RetireCohort> {
  const pos: RetireCohort['pos'] = {};
  for (const p of COHORT_POSITIONS) {
    const rows = await rowsOf(d1, season, p);
    if (rows.length < COHORT_MIN) {
      pos[p] = { n: rows.length, m: {} };
      continue;
    }
    const m: NonNullable<RetireCohort['pos'][CohortPos]> = { n: rows.length, m: {} };
    for (const metric of COHORT_METRICS) {
      const points = cohortPoints(rows.map((r) => r[metric] ?? 0));
      if (points.length) m.m[metric] = points;
    }
    pos[p] = m;
  }
  return { season, asOf: now, pos };
}

const enough = (c: RetireCohort) => Object.values(c.pos).some((p) => p && p.n >= COHORT_MIN);

/**
 * 기록을 보여 주는 시즌(displaySeasonAt)의 분포를 만들고, 시즌이 막 열려 어느 포지션도 COHORT_MIN에 못 미치면 바로 앞
 * 시즌으로 비교한다. 결과를 app_meta에 쓰고 돌려준다.
 */
export async function buildRetireCohort(d1: D1Database, now: string): Promise<RetireCohort> {
  const season = displaySeasonAt(now);
  let cohort = await cohortOf(d1, season, now);
  if (!enough(cohort) && season > 0) {
    const prev = await cohortOf(d1, season - 1, now);
    if (enough(prev)) cohort = prev;
  }
  await d1
    .prepare(
      'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .bind(RETIRE_COHORT_KEY, JSON.stringify(cohort))
    .run();
  return cohort;
}

/** 저장된 분포(없거나 깨졌으면 undefined). */
export async function readRetireCohort(d1: D1Database): Promise<RetireCohort | undefined> {
  const row = await d1
    .prepare('SELECT value FROM app_meta WHERE key = ?')
    .bind(RETIRE_COHORT_KEY)
    .first<{ value: string }>();
  if (!row) return undefined;
  try {
    const parsed = RetireCohortSchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

import { z } from 'zod';

// ───────── T-11-675 은퇴 동기 비교 ─────────
// 하루 한 번 cron이 그 시즌에 은퇴한(숨기지 않은) 커리어의 포지션별 분포를 계산해 두고, 은퇴 화면은 그 결과를 한 번 읽어
// "같은 시즌 은퇴한 FW 중 통산 득점 상위 4%"처럼 내 기록의 자리를 보여 준다. 은퇴할 때마다 DB를 훑지 않는다.

/** 비교하는 기록(은퇴 요약 · careers 표 열과 같은 값). */
export const COHORT_METRICS = [
  'score',
  'peak',
  'apps',
  'goals',
  'assists',
  'trophies',
  'caps',
  'ballon',
] as const;
export type CohortMetric = (typeof COHORT_METRICS)[number];

export const COHORT_POSITIONS = ['FW', 'MF', 'DF', 'GK'] as const;
export type CohortPos = (typeof COHORT_POSITIONS)[number];

/** 이 비율(%) 지점의 값을 잡아 둔다. 그 사이 값은 아래 지점으로 내려 읽어 실제보다 높게 말하지 않는다. */
export const COHORT_LEVELS = [0.1, 0.5, 1, 2, 3, 5, 10, 20, 30, 50] as const;
/** 이보다 적은 포지션 묶음은 비교하지 않는다(몇 명 안 되는 묶음의 '상위 1%'는 뜻이 없다). */
export const COHORT_MIN = 200;
/** 화면에 보이는 가장 낮은 자리. 이보다 아래면 그 기록은 말하지 않는다. */
export const COHORT_SHOW_MAX = 50;

/** [값, 그 값 이상인 선수 비율(%)]. 값이 큰 것부터. */
const PointSchema = z.tuple([z.number().int().min(0), z.number().min(0).max(100)]);

export const RetireCohortSchema = z.strictObject({
  /** 비교 대상 시즌(서비스 시즌). 그 시즌에 처음 올라온 커리어 중 은퇴한 것. */
  season: z.number().int().min(0),
  /** 계산한 시각(UTC ISO). */
  asOf: z.string(),
  pos: z.partialRecord(
    z.enum(COHORT_POSITIONS),
    z.strictObject({
      n: z.number().int().min(0),
      m: z.partialRecord(z.enum(COHORT_METRICS), z.array(PointSchema).max(COHORT_LEVELS.length)),
    }),
  ),
});
export type RetireCohort = z.infer<typeof RetireCohortSchema>;

/** 공개 조회 응답. 아직 한 번도 계산하지 않았으면 null(화면은 비교 줄을 그리지 않는다). */
export const RetireCohortResponseSchema = RetireCohortSchema.nullable();
export type RetireCohortResponse = z.infer<typeof RetireCohortResponseSchema>;

export const RETIRE_COHORT_PATH = '/v1/retire-cohort';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 한 기록의 지점들. values는 아무 순서나 된다. 각 COHORT_LEVELS 지점에 드는 가장 낮은 값과, 그 값 이상인 선수의 실제
 * 비율을 담는다(같은 값이 많으면 비율이 지점보다 커진다). 값이 0인 지점은 담지 않는다(0은 비교하지 않는다).
 */
export function cohortPoints(values: readonly number[]): [number, number][] {
  const n = values.length;
  if (!n) return [];
  const desc = [...values].sort((a, b) => b - a);
  // 값 v 이상인 수: 내림차순에서 v보다 작은 첫 자리.
  const atLeast = (v: number) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (desc[mid]! >= v) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const out: [number, number][] = [];
  for (const level of COHORT_LEVELS) {
    const v = desc[Math.max(0, Math.ceil((level / 100) * n) - 1)]!;
    if (v <= 0 || out.some(([x]) => x === v)) continue;
    out.push([v, round2((atLeast(v) / n) * 100)]);
  }
  return out;
}

/**
 * 내 기록 mine이 드는 자리(%): mine 이하인 지점 중 가장 높은 값의 비율. 지점 사이 값은 아래 지점으로 읽으므로 실제
 * 자리보다 좋게 말하지 않는다. 0이거나 어느 지점에도 들지 못하면 null.
 */
export function cohortTop(
  points: readonly (readonly [number, number])[],
  mine: number,
): number | null {
  if (!(mine > 0)) return null;
  let best: number | null = null;
  for (const [v, pct] of points) if (mine >= v && (best === null || pct < best)) best = pct;
  return best;
}

/** 화면에 쓰는 자리 표기: 1% 미만은 소수 한 자리(최소 0.1), 그 위는 올림한 정수. */
export const cohortPctLabel = (pct: number): string =>
  pct < 1 ? String(Math.max(0.1, Math.ceil(pct * 10) / 10)) : String(Math.ceil(pct));

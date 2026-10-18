// T-11-376 급여 안내 시트의 순수 로직(웹 team/SalaryGuide.svelte · 앱 screens/owner/SalaryGuide.tsx 공용).
import { PAST_SALARY_TABLE, isWildcardSeason, salaryOf } from '@offside/contracts/owner-team';
import { salaryText as S } from './i18n/ko/salary.js';
import { teamCoreText as L } from './i18n/ko/teamCore.js';

/** 이적시장 매물 상세의 급여 줄: 지난 시즌 카드면 그 급여, 이번 시즌 카드면 다음 시즌부터 받을 급여. */
export const marketSalaryText = (
  card: { peak: number; season?: number | null | undefined },
  current: number | null,
) =>
  current !== null && isWildcardSeason(card.season, current)
    ? L.salaryChip({ n: salaryOf(card.peak) })
    : L.salaryLater({ n: salaryOf(card.peak) });

/** 급여표 줄(낮은 구간부터) — '74 이하 1' · '75~79 2' … '96 이상 20'. */
export function salaryRows(): { band: string; salary: number }[] {
  const asc = [...PAST_SALARY_TABLE].reverse();
  return asc.map((t, i) => {
    const next = asc[i + 1];
    const band =
      i === 0
        ? S.bandLow({ n: next!.min - 1 })
        : next
          ? S.bandRange({ a: t.min, b: next.min - 1 })
          : S.bandHigh({ n: t.min });
    return { band, salary: t.salary };
  });
}

/** 예산 안에서 고르는 예: 급여 20 · 10 · 6 구간을 몇 명까지 넣을 수 있는지. */
export function salaryExamples(budget: number): string[] {
  const rows = salaryRows();
  return [20, 10, 6].flatMap((salary) => {
    const row = rows.find((r) => r.salary === salary);
    const n = Math.floor(budget / salary);
    return row && n > 0 ? [S.example({ band: row.band, n, sum: n * salary })] : [];
  });
}

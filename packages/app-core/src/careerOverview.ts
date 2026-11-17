import type { GameState } from '@offside/game/types';
import { nationalCalendar } from '@offside/game/national';
import { scoringTable, scoringRank } from '@offside/game/scoring-table';
import { clubById } from '@offside/game/clubs';
import { tn } from '@offside/game/i18n/names';
import { careerOverviewText as L } from './i18n/ko/careerOverview.js';

export type CalendarStatus = 'qualified' | 'eliminated' | 'pending';

/** 대회 이름 앞뒤의 연도를 뗀다(연도는 묶음 머리에 따로 쓴다). */
const dropYear = (title: string, year: number) =>
  title.replace(new RegExp(`^${year}\\s+|\\s+${year}$`), '').trim() || title;

/** 대회 일정을 연도별로 묶는다. 상태(본선 진출)는 줄 글자와 따로 알약으로 보인다. */
export function careerCalendarYears(s: GameState) {
  const years: {
    year: number;
    current: boolean;
    head: string;
    items: {
      key: string;
      title: string;
      detail: string;
      status: CalendarStatus | null;
      statusText: string;
    }[];
  }[] = [];
  for (const r of nationalCalendar(s)) {
    let y = years.find((x) => x.year === r.year);
    if (!y) {
      const current = r.year === s.year;
      y = {
        year: r.year,
        current,
        head: current ? L.thisYear({ year: r.year }) : String(r.year),
        items: [],
      };
      years.push(y);
    }
    const status: CalendarStatus | null =
      r.key === 'wc' || r.key === 'olympic'
        ? r.qualified === true
          ? 'qualified'
          : r.qualified === false
            ? 'eliminated'
            : 'pending'
        : null;
    y.items.push({
      key: `${r.year}-${r.key}`,
      title: dropYear(tn(r.name), r.year),
      detail: `${L.atAge({ age: r.age })} · ${r.youth ? (r.age > 23 ? L.wildcard : L.youth) : L.senior}`,
      status,
      statusText:
        status === 'qualified'
          ? L.qualified
          : status === 'eliminated'
            ? L.eliminated
            : status
              ? L.qualification
              : '',
    });
  }
  return years;
}

/** 접힌 대회 일정 줄 오른쪽 요약. */
export function calendarSummary(s: GameState): string {
  const rows = nationalCalendar(s);
  const now = rows.filter((r) => r.year === s.year).length;
  if (now) return L.summaryThisYear({ n: now });
  const next = rows[0];
  return next ? L.summaryNext({ year: next.year }) : '';
}

/** 리그 기록이 비어 있는 때(개막 전). 시즌 결산 · 이적시장에서는 끝난 시즌 기록을 보인다. */
export const scoringNotStarted = (s: GameState) =>
  s.pending?.type !== 'market' && (s.season.played ?? 0) === 0;

/** 접힌 리그 기록 줄 오른쪽 요약. */
export function scoringSummary(s: GameState): string {
  const rows = scoringTable(s);
  if (!rows) return L.summaryLegacy;
  if (scoringNotStarted(s)) return L.summaryNotStarted;
  const mine = rows.find((r) => r.me)!;
  return L.summaryMine({
    goals: mine.goals,
    assists: mine.assists,
    rank: scoringRank(rows, mine, 'goals'),
  });
}

export function careerScoring(s: GameState, key: 'goals' | 'assists') {
  const rows = scoringTable(s);
  if (!rows) return null;
  // Store app Hermes does not provide Array.prototype.toSorted.
  const sorted = [...rows].sort(
    (a, b) => b[key] - a[key] || Number(b.me) - Number(a.me) || a.id.localeCompare(b.id),
  );
  const shown = sorted.slice(0, 5);
  const mine = sorted.find((r) => r.me)!;
  const below = !shown.includes(mine);
  if (below) shown.push(mine);
  return shown.map((r) => ({
    id: r.id,
    me: r.me,
    /** 5위 밖 내 줄 — 앞에 "…" 구분을 둔다. */
    gap: below && r.me,
    rank: scoringRank(rows, r, key),
    value: r[key],
    name: r.me
      ? s.name
      : `${tn(clubById(r.clubId)?.name ?? r.clubId)} ${r.slot ? L.rivalCreator : L.rivalForward}`,
  }));
}

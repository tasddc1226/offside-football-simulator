import type { GameState } from '@offside/game/types';
import { nationalCalendar } from '@offside/game/national';
import { scoringTable, scoringRank } from '@offside/game/scoring-table';
import { clubById } from '@offside/game/clubs';
import { tn } from '@offside/game/i18n/names';
import { PHASES, LAST_PHASE } from '@offside/game/data';
import { careerOverviewText as L } from './i18n/ko/careerOverview.js';

export function careerDate(s: GameState): string {
  const ended = s.pending?.type === 'market';
  return `${ended ? L.endYear : L.currentYear} · ${L.yearLabel({ year: ended ? s.year - 1 : s.year })} · ${ended ? L.seasonOver : tn(PHASES[Math.min(s.phase, LAST_PHASE)]!)}`;
}
export function careerCalendar(s: GameState) {
  return nationalCalendar(s).map((r) => ({
    ...r,
    title: tn(r.name),
    detail: [
      `${r.age}${L.calendarAge}`,
      r.youth ? (r.age > 23 ? L.wildcard : L.youth) : L.senior,
      r.key === 'wc' || r.key === 'olympic'
        ? r.qualified === true
          ? L.qualified
          : r.qualified === false
            ? L.eliminated
            : L.qualification
        : '',
    ]
      .filter(Boolean)
      .join(' · '),
  }));
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
  if (!shown.includes(mine)) shown.push(mine);
  return shown.map((r) => ({
    id: r.id,
    me: r.me,
    rank: scoringRank(rows, r, key),
    value: r[key],
    name: r.me
      ? s.name
      : `${tn(clubById(r.clubId)?.name ?? r.clubId)} ${r.slot ? L.rivalCreator : L.rivalForward}`,
  }));
}

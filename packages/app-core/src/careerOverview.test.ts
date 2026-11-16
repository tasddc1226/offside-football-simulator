import { expect, it } from 'vitest';
import '@offside/game/index';
import { newGame } from '@offside/game/engine';
import { loadSave } from '@offside/game/save';
import { setActiveRng, createRng } from '@offside/game/rng';
import {
  careerScoring,
  careerCalendarYears,
  calendarSummary,
  scoringSummary,
  scoringNotStarted,
} from './careerOverview.js';
it('shows the current year, completed season and my place below the leaders', () => {
  setActiveRng(createRng(599));
  const s = newGame(
    { name: 'T', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    599,
  );
  expect(scoringNotStarted(s)).toBe(true);
  expect(scoringSummary(s)).toBe('개막 전');
  s.season.played = 20;
  expect(scoringNotStarted(s)).toBe(false);
  const rows = careerScoring(s, 'goals')!;
  expect(rows).toHaveLength(6);
  expect(rows.at(-1)).toMatchObject({ me: true, value: 0, gap: true });
  expect(rows.slice(0, 5).every((r) => !r.gap)).toBe(true);
  expect(scoringSummary(s)).toMatch(/^0골 · 0도움 · 득점 \d+위$/);
  s.season.played = 0;
  s.pending = { type: 'market', res: null, m: null };
  expect(scoringNotStarted(s)).toBe(false);
  delete s.season.scoringVersion;
  expect(careerScoring(s, 'goals')).toBeNull();
  expect(scoringSummary(s)).toBe('다음 시즌부터');
});

it('shows new and resumed career rankings without the native-unsupported toSorted API', () => {
  setActiveRng(createRng(599));
  const s = newGame(
    { name: 'T', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    599,
  );
  const resumed = loadSave(JSON.parse(JSON.stringify(s)))!.G;
  const before = JSON.stringify(s);
  const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'toSorted')!;
  Object.defineProperty(Array.prototype, 'toSorted', { ...descriptor, value: undefined });
  try {
    for (const key of ['goals', 'assists'] as const) {
      const rows = careerScoring(s, key)!;
      expect(rows.some((r) => r.me)).toBe(true);
      expect(careerScoring(resumed, key)).toEqual(rows);
    }
    expect(JSON.stringify(s)).toBe(before);
  } finally {
    Object.defineProperty(Array.prototype, 'toSorted', descriptor);
  }
});

it('groups the national calendar by year with the status apart from the requirement', () => {
  setActiveRng(createRng(599));
  const s = newGame(
    { name: 'T', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    599,
  );
  const years = careerCalendarYears(s);
  expect(years.length).toBeGreaterThan(0);
  expect(new Set(years.map((y) => y.year)).size).toBe(years.length);
  for (const y of years) {
    expect(y.current).toBe(y.year === s.year);
    for (const r of y.items) {
      expect(r.title.startsWith(String(y.year))).toBe(false);
      expect(r.detail).toMatch(/세 때 · .*발탁 필요$/);
      expect(r.detail).not.toMatch(/본선|예선/);
      if (r.status) expect(r.statusText).toBeTruthy();
    }
  }
  const now = years.find((y) => y.current);
  expect(calendarSummary(s)).toBe(now ? `올해 ${now.items.length}개` : `다음 ${years[0]!.year}년`);
});

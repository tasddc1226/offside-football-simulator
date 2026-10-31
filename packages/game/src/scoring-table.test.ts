import { expect, it } from 'vitest';
import './index.js';
import { newGame, newSeason } from './engine.js';
import { scoringTable, scoringRank } from './scoring-table.js';
import { createRng, setActiveRng, getActiveRng } from './rng.js';
import { seasonAwards } from './comps.js';
import { endSeason } from './season.js';

const player = () => {
  setActiveRng(createRng(599));
  return newGame(
    { name: 'T', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    599,
  );
};
it('ranking reads are stable, monotone and do not use the career RNG', () => {
  const s = player();
  const rng = getActiveRng().getState();
  expect(scoringTable(s)!.every((r) => !r.goals && !r.assists)).toBe(true);
  s.season.played = 10;
  const half = scoringTable(s)!;
  expect(scoringTable(s)).toEqual(half);
  s.season.played = 20;
  const full = scoringTable(s)!;
  for (const row of half) {
    const next = full.find((r) => r.id === row.id)!;
    expect(next.goals).toBeGreaterThanOrEqual(row.goals);
    expect(next.assists).toBeGreaterThanOrEqual(row.assists);
  }
  expect(getActiveRng().getState()).toEqual(rng);
});
it('joint first place gets the same league award shown in the table', () => {
  const s = player();
  s.season.played = 20;
  const rivals = scoringTable(s)!.filter((r) => !r.me);
  s.season.goals = Math.max(...rivals.map((r) => r.goals));
  s.season.assists = Math.max(...rivals.map((r) => r.assists));
  const rows = scoringTable(s)!;
  expect(
    scoringRank(
      rows,
      rows.find((r) => r.me)!,
      'goals',
    ),
  ).toBe(1);
  const ctx = { rank: 8, avg: 6, trophies: [], tours: [] };
  expect(seasonAwards(s, ctx).awards).toEqual(expect.arrayContaining(['득점왕', '도움왕']));
  s.season.goals--;
  s.season.assists--;
  expect(seasonAwards(s, ctx).awards).not.toContain('득점왕');
  expect(seasonAwards(s, ctx).awards).not.toContain('도움왕');
});
it('season-end and save recovery keep the same competitors and records', () => {
  const s = player();
  s.season.played = 20;
  const before = scoringTable(s);
  const res = endSeason(s);
  s.pending = { type: 'market', res, m: null };
  expect(scoringTable(s)).toEqual(before);
  expect(scoringTable(JSON.parse(JSON.stringify(s)))).toEqual(before);
});
it('old seasons keep legacy rules until a new season', () => {
  const s = player();
  delete s.season.scoringVersion;
  expect(scoringTable(s)).toBeNull();
  s.season = newSeason(s);
  expect(scoringTable(s)).not.toBeNull();
});

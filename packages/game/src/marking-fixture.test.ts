import { expect, it } from 'vitest';
import './event-registry.js';
import { newGame } from './engine.js';
import { rollEvent, resolveChoice } from './event-runner.js';
import { firstMarkingGame, MARKING_RETURN } from './marking-fixture.js';
import { scoringTable } from './scoring-table.js';
import { loadSave } from './save.js';
import type { MatchGame } from './match.js';

const match = (opp: string, rd: number, mins: number, inj = false): MatchGame => ({
  opp,
  rd,
  mins,
  inj,
  res: 'D',
});
function setup() {
  const s = newGame(
    { name: 'Fixture', number: 4, pos: 'DF', type: 'stopper', foot: '오른발', trait: 'late' },
    771,
  );
  s.phase = 1;
  s.season.played = 12;
  const rows = scoringTable(s)!;
  const leader = rows.find(
    (r) => r.goals === Math.max(...rows.map((row) => row.goals)) && r.clubId !== s.club.id,
  )!;
  const source = match(leader.clubId, 7, 68);
  s.markingFixture = firstMarkingGame(s, [source])!;
  expect(s.markingFixture.opponent).toBe(leader.clubId);
  resolveChoice(s, 'df-marking', 1, 0);
  return { s, source };
}
it('matches the first later fixture against the saved club across a season and reload', () => {
  const { s, source } = setup();
  const restored = loadSave(JSON.parse(JSON.stringify(s)))!.G;
  expect(rollEvent(restored, [source, match('other', 8, 90)])).not.toBe(MARKING_RETURN);
  restored.year++;
  restored.injury = 2;
  expect(rollEvent(restored, [match(source.opp!, 2, 15), match('other', 3, 0, true)])).toBe(
    MARKING_RETURN,
  );
  expect(restored.markingFixture?.returnRound).toBe(2);
  expect(restored.flags.markApproach).toBe('zone');
  resolveChoice(restored, MARKING_RETURN, 1);
  expect(restored.markingFixture).toBeUndefined();
});
it.each([true, false])('records a missed fixture once (injured: %s)', (inj) => {
  const { s, source } = setup();
  const games = [match(source.opp!, 13, 0, inj), match(source.opp!, 16, 90)];
  const n = s.miles?.length ?? 0;
  expect(rollEvent(s, games)).not.toBe(MARKING_RETURN);
  expect(s.miles?.at(-1)?.t).toContain('13R');
  expect(s.miles?.at(-1)?.t).toContain(inj ? '부상 결장' : '미출전');
  rollEvent(s, games);
  expect(s.miles).toHaveLength(n + 1);
});
it('cancels the old assignment on transfer', () => {
  const { s, source } = setup();
  s.club = { ...s.club, id: 'other' };
  expect(rollEvent(s, [match(source.opp!, 13, 90)])).not.toBe(MARKING_RETURN);
  expect(s.markingFixture).toBeUndefined();
});

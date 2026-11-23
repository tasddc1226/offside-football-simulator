import { expect, it } from 'vitest';
import './event-registry.js';
import { newGame } from './engine.js';
import { rollEvent, resolveChoice } from './event-runner.js';
import { firstMarkingGame, MARKING_RETURN } from './marking-fixture.js';
import { createRng, setActiveRng } from './rng.js';
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
  setActiveRng(createRng(771));
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
it.each([
  [0, '공격수 추적'],
  [1, '중앙 침투 차단'],
] as const)('records rematch choice %i once across a season and reload', (choice, action) => {
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
  restored.markingFixture!.returnScore = '2-2';
  const pending = loadSave(JSON.parse(JSON.stringify(restored)))!.G;
  const before = pending.miles!.length;
  resolveChoice(pending, MARKING_RETURN, choice);
  expect(pending.markingFixture).toBeUndefined();
  const done = loadSave(JSON.parse(JSON.stringify(pending)))!.G;
  expect(done.miles?.at(-1)).toMatchObject({
    year: restored.year,
    t: expect.stringContaining('2R '),
  });
  expect(done.miles?.at(-1)?.t).toContain(action + ' · 팀 무승부 2-2');
  resolveChoice(done, MARKING_RETURN, choice);
  expect(done.miles).toHaveLength(before + 1);
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

it('keeps an older pending rematch playable without inventing a result', () => {
  const { s } = setup();
  s.markingFixture!.returnRound = 15;
  const restored = loadSave(JSON.parse(JSON.stringify(s)))!.G;
  resolveChoice(restored, MARKING_RETURN, 0);
  expect(restored.miles?.at(-1)?.t).toMatch(/^15R .+ 재대결 · 공격수 추적$/);
});

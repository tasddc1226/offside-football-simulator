import { expect, it } from 'vitest';
import './event-registry.js';
import { newGame } from './engine.js';
import { TRAITS, TYPES, type Pos } from './data.js';
import { eventById } from './events-data.js';
import { resolveChoice, rollEvent } from './event-runner.js';
import { natRefusing } from './national.js';
import { loadSave } from './save.js';

const player = (pos: Pos) =>
  newGame(
    { name: 'Test', number: 8, pos, foot: '오른발', type: TYPES[pos][0]!.id, trait: TRAITS[0]!.id },
    767,
  );
it.each([
  ['MF', 'mf-role', 0, 0, 'mf-pivot-return', 'pivotCoverWorked', true],
  ['MF', 'mf-role', 0, 1, 'mf-pivot-return', 'pivotCoverWorked', false],
  ['DF', 'df-marking', 0, 1, 'df-marking-rematch', 'markApproach', 'man'],
  ['DF', 'df-marking', 1, 0, 'df-marking-rematch', 'markApproach', 'zone'],
  ['MF', 'mf-freekick', 1, 0, 'mf-read-freekick', 'freekickClub', null],
  ['MF', 'mf-freekick', 1, 1, 'mf-read-freekick', 'freekickClub', null],
  ['MF', 'coach-farewell', 0, 0, 'academy-invitation', 'academyKeepsake', 'photo'],
  ['MF', 'coach-farewell', 1, 1, 'academy-invitation', 'academyKeepsake', 'armband'],
  ['MF', 'coach-farewell', 1, 0, 'academy-invitation', 'academyKeepsake', 'armband'],
  ['DF', 'wc-snub', 1, 0, 'squad-list-call', 'squadCallReply', 'calm'],
] as const)(
  '%s %s choice %i roll %i survives reload',
  (pos, source, choice, r, id, flag, value) => {
    const s = player(pos);
    resolveChoice(s, source, choice, r);
    const next = loadSave(JSON.parse(JSON.stringify(s)))!.G;
    const slot = next.chains!.find((c) => c.id === id)!;
    next.year = 2026 + Math.floor(slot.at / 3);
    next.phase = slot.at % 3;
    if (next.phase === 0 && (id === 'df-marking-rematch' || id === 'mf-read-freekick'))
      next.phase = 1;
    expect(next.flags[flag]).toBe(value ?? next.club.id);
    expect(rollEvent(next)).toBe(id);
    expect(next.chains!.some((c) => c.id === id)).toBe(false);
  },
);
it.each([0, 1])('only consenting players reopen selection, reply %i', (choice) => {
  const s = player('DF');
  resolveChoice(s, 'wc-snub', 0);
  expect(natRefusing(s)).toBe(true);
  s.nat.retired = s.year;
  expect(eventById('squad-list-call')!.cond(s)).toBe(false);
  delete s.nat.retired;
  expect(rollEvent(s)).toBe('squad-list-call');
  resolveChoice(s, 'squad-list-call', choice);
  expect(natRefusing(s)).toBe(choice === 1);
});
it.each([
  ['mf-role', 0, 'mf-pivot-return'],
  ['mf-freekick', 1, 'mf-read-freekick'],
  ['df-marking', 0, 'df-marking-rematch'],
] as const)('keeps %s at the original club', (source, pick, id) => {
  const s = player(source === 'df-marking' ? 'DF' : 'MF');
  s.phase = 1;
  resolveChoice(s, source, pick, 0);
  expect(eventById(id)!.cond(s)).toBe(true);
  s.club = { ...s.club, id: 'elsewhere' };
  expect(eventById(id)!.cond(s)).toBe(false);
});

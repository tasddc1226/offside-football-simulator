import { expect, it } from 'vitest';
import { newGame } from './engine.js';
import './event-registry.js';
import { resolveChoice, rollEvent } from './event-runner.js';
import { loadSave } from './save.js';
import { TRAITS, TYPES } from './data.js';

const keeper = () =>
  newGame(
    {
      name: 'GK',
      number: 1,
      pos: 'GK',
      foot: '오른발',
      type: TYPES.GK[0]!.id,
      trait: TRAITS[0]!.id,
    },
    766,
  );

it.each([
  [0, 'pas'],
  [1, 'dri'],
] as const)('trains choice %i after a break and a reload', (choice, skill) => {
  const s = keeper();
  s.phase = 3;
  resolveChoice(s, 'gk-error', 1);
  const restored = loadSave(JSON.parse(JSON.stringify(s)))!.G;
  restored.year++;
  restored.phase = 0;
  restored.injury = 1;
  expect(rollEvent(restored)).not.toBe('gk-backpass');
  restored.injury = 0;
  restored.phase = 1;
  expect(rollEvent(restored)).toBe('gk-backpass');
  const before = restored.attrs[skill];
  const cs = restored.season.cs;
  resolveChoice(restored, 'gk-backpass', choice);
  expect(restored.attrs[skill]).toBeGreaterThan(before);
  expect(restored.season.cs).toBe(cs);
  expect(rollEvent(restored)).not.toBe('gk-backpass');
});

it.each([0, 1])('keeps the immediate comeback separate on roll %i', (roll) => {
  const s = keeper();
  resolveChoice(s, 'gk-error', 0, roll);
  expect(s.chains?.some((c) => c.id === 'gk-backpass')).toBeFalsy();
});

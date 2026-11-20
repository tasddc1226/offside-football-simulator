import { expect, it } from 'vitest';
import './event-registry.js';
import { resolveChoice, rollEvent } from './event-runner.js';
import { loadSave } from './save.js';
import fixture from './__fixtures__/save-fw26.json';
import type { GameState } from './types.js';

const fromFixture = () => loadSave(structuredClone(fixture) as unknown as GameState)!.G;

it.each([
  [0, 'pas'],
  [1, 'sho'],
] as const)('replays the assist after reload and trains %s / %s', (choice, skill) => {
  const s = fromFixture();
  s.phase = 3;
  s.chains = [];
  resolveChoice(s, 'fw-drought', 1);
  const restored = loadSave(JSON.parse(JSON.stringify(s)))!.G;
  restored.year++;
  restored.phase = 0;
  restored.injury = 1;
  expect(rollEvent(restored)).not.toBe('fw-link-drill');
  restored.injury = 0;
  restored.phase = 1;
  expect(rollEvent(restored)).toBe('fw-link-drill');
  const before = restored.attrs[skill];
  const { goals, assists } = restored.season;
  resolveChoice(restored, 'fw-link-drill', choice);
  expect(restored.attrs[skill]).toBeGreaterThan(before);
  expect(restored.season).toMatchObject({ goals, assists });
  expect(rollEvent(restored)).not.toBe('fw-link-drill');
});

it('keeps solo shooting practice on its original path', () => {
  const s = fromFixture();
  resolveChoice(s, 'fw-drought', 0);
  expect(s.chains?.some((c) => c.id === 'fw-link-drill')).toBeFalsy();
});

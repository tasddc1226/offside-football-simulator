import { expect, it } from 'vitest';
import { positionGuide, teamNameIssues } from './careerGuide.js';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import { MANAGER_NAME_MAX, TEAM_NAME_MAX } from '@offside/contracts/owner-team';
it('reading every position guide does not consume career RNG and uses goalkeeper-specific names', () => {
  setActiveRng(createRng(71));
  const before = getActiveRng().getState();
  for (const pos of ['FW', 'MF', 'DF', 'GK'] as const) {
    const guide = positionGuide(pos);
    expect(guide.length).toBeGreaterThan(0);
    expect(guide.every((x) => x.focus && x.desc)).toBe(true);
  }
  const sweeper = positionGuide('GK').find((x) => x.id === 'sweeper');
  expect(sweeper).toBeDefined();
  expect(sweeper!.focus).not.toContain('패스');
  expect(getActiveRng().getState()).toEqual(before);
});
it('save explanation uses the existing trimmed name boundaries', () => {
  expect(teamNameIssues('  ', '감독').name).toBeTruthy();
  expect(teamNameIssues('구단', ' ').manager).toBeTruthy();
  expect(teamNameIssues('가'.repeat(TEAM_NAME_MAX + 1), '감독').name).toBeTruthy();
  expect(teamNameIssues('구단', '가'.repeat(MANAGER_NAME_MAX + 1)).manager).toBeTruthy();
  expect(teamNameIssues('  구단  ', ' 감독 ')).toEqual({ name: '', manager: '' });
});

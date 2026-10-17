import { expect, it } from 'vitest';
import { positionGuide, teamNameIssues } from './careerGuide.js';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import { DUOS, MANAGER_NAME_MAX, TEAM_NAME_MAX } from '@offside/contracts/owner-team';
import { ATTR_KEYS, attrLabels, typeForFocus } from '@offside/game/data';
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
it('type guide derives every focus pair from the creation rule and lists the duo synergies of each type', () => {
  setActiveRng(createRng(72));
  const before = getActiveRng().getState();
  for (const pos of ['FW', 'MF', 'DF', 'GK'] as const) {
    const guide = positionGuide(pos);
    // 6개 중 2개 조합 15가지가 정확히 한 유형씩에 들어간다(선수 생성의 typeForFocus와 같은 결과).
    expect(guide.reduce((n, e) => n + e.combos.length, 0)).toBe(15);
    const labels = attrLabels(pos);
    for (const e of guide) {
      for (const a of ATTR_KEYS)
        for (const b of ATTR_KEYS) {
          if (ATTR_KEYS.indexOf(b) <= ATTR_KEYS.indexOf(a)) continue;
          const listed = e.combos.includes(`${labels[a]} · ${labels[b]}`);
          expect(listed).toBe(typeForFocus(pos, [a, b]) === e.id);
        }
      for (const s of e.synergies) {
        const duo = DUOS.find((d) => d.id === s.id)!;
        expect(duo.needs.some((n) => n.types.includes(e.id))).toBe(true);
        expect(s.slots.length).toBeGreaterThan(0);
      }
    }
  }
  const speed = positionGuide('FW').find((e) => e.id === 'speed')!;
  expect(speed.synergies.map((s) => s.id)).toEqual(['counter']);
  expect(speed.synergies[0]!.slots.split('·')).toEqual(['ST', 'CF', 'SS', 'LW', 'RW']);
  const stopper = positionGuide('DF').find((e) => e.id === 'stopper')!;
  expect(stopper.synergies.map((s) => s.id)).toEqual(['wall', 'cb_pair', 'guardian']);
  expect(stopper.synergies[0]!.slots).toBe('CB·SW');
  expect(getActiveRng().getState()).toEqual(before);
});
it('save explanation uses the existing trimmed name boundaries', () => {
  expect(teamNameIssues('  ', '감독').name).toBeTruthy();
  expect(teamNameIssues('구단', ' ').manager).toBeTruthy();
  expect(teamNameIssues('가'.repeat(TEAM_NAME_MAX + 1), '감독').name).toBeTruthy();
  expect(teamNameIssues('구단', '가'.repeat(MANAGER_NAME_MAX + 1)).manager).toBeTruthy();
  expect(teamNameIssues('  구단  ', ' 감독 ')).toEqual({ name: '', manager: '' });
});

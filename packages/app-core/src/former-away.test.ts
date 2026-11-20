import { expect, it, vi } from 'vitest';
import fixture from '../../game/src/__fixtures__/save-fw26.json';
import type { GameState } from '@offside/game/types';
import type { BlockResult } from '@offside/game/match';
import { afterFormerAway, formerAwayFixture, showFormerAway } from './former-away';
import { createSheetController, initialSheetState } from './sheet-controller';

const visit = { rd: 20, clubId: 'pl-3', apps: 28, seasons: 1 };
const career = () => structuredClone(fixture) as unknown as GameState;

it('offers only the return leg in the season after leaving the club', () => {
  const s = career();
  s.career[s.career.length - 1]!.clubId = visit.clubId;
  s.phase = 1;
  expect(formerAwayFixture(s)).toBeNull();
  s.season.opp = [visit.clubId, ...Array(18).fill('pl-1')];
  expect(formerAwayFixture(s)).toBeNull();
  s.phase = 2;
  s.season.played = 19;
  expect(formerAwayFixture(s)).toEqual(visit);
  s.season.played = 20;
  expect(formerAwayFixture(s)).toBeNull();
  s.season.played = 19;
  s.year++;
  expect(formerAwayFixture(s)).toBeNull();
});

it.each([
  [2, 1, 90, 'goal', 2],
  [0, 1, 70, 'assist', 1],
  [0, 0, 20, 'played', 1],
  [0, 0, 0, 'bench', 1],
] as const)(
  'uses the final match line (%i goals, %i assists, %i minutes)',
  (g, a, mins, result, buttons) => {
    const s = career();
    const block = { games: [{ rd: 20, opp: 'pl-3', g, a, mins }] } as BlockResult;
    const next = { type: 'seasonEnd' } as const;
    s.pending = afterFormerAway(visit, 'respect', block, next);
    if (s.pending?.type !== 'formerAway') throw new Error('Missing return scene');
    expect(s.pending.result).toBe(result);
    const sheet = createSheetController(initialSheetState(), {
      tick: async () => {},
      painted: async () => {},
      motionOK: () => false,
    });
    const before = s.miles!.length;
    const save = vi.fn();
    showFormerAway(sheet, s, s.pending, save, sheet.closeSheet);
    expect(sheet.state.buttons).toHaveLength(buttons);
    const finish = sheet.state.buttons[buttons - 1]!.fn;
    finish();
    finish();
    expect(s.miles).toHaveLength(before + 1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(s.pending).toEqual(next);
  },
);

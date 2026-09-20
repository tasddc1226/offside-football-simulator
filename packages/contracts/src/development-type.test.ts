import { expect, expectTypeOf, it } from 'vitest';
import type { DevelopmentState } from '@offside/domain';
import type { z } from 'zod';
import { DevelopmentStateSchema, DevelopmentPlanSchema } from './career-state.js';
it('persists player development without changing the domain shape', () => {
  expectTypeOf<z.infer<typeof DevelopmentStateSchema>>().toEqualTypeOf<DevelopmentState>();
  const state: DevelopmentState = {
    mastery: { CONTROL: 6, ENGINE: 0, VISION: 0 },
    sessions: [
      {
        season: 1,
        block: 1,
        drill: 'CONTROL',
        load: 'PUSH',
        partner: 'COACH',
        gains: [{ attribute: 'passing', delta: 2 }],
        fitnessDelta: -18,
        relationDelta: 6,
        response: 'SUPPORT',
        breakthrough: false,
      },
    ],
    duels: [
      {
        season: 1,
        matchId: 'm1',
        optionId: 'SAFE',
        tactic: 'CONTROL',
        successBp: 6200,
        result: 'SUCCESS',
      },
    ],
  };
  expect(DevelopmentStateSchema.parse(JSON.parse(JSON.stringify(state)))).toEqual(state);
  expect(
    DevelopmentPlanSchema.safeParse({ drill: 'ANYTHING', load: 'PUSH', partner: 'COACH' }).success,
  ).toBe(false);
  expect(
    DevelopmentStateSchema.safeParse({ ...state, mastery: { ...state.mastery, CONTROL: 101 } })
      .success,
  ).toBe(false);
});

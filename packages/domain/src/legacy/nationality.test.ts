import { describe, expect, it } from 'vitest';
import {
  assessNationalityAtSeasonBoundary,
  grantTournamentException,
  initializeNationalityModule,
  isU23Eligible,
  resolveNationalityChoice,
} from './nationality.js';

describe('game-only nationality module', () => {
  it('initializes Korea male as pending and all other profiles as default', () => {
    expect(initializeNationalityModule('KR', 'MALE')).toMatchObject({ moduleId: 'KOREA', serviceStatus: 'PENDING' });
    for (const [code, gender] of [['KR', 'FEMALE'], ['KR', 'UNSPECIFIED'], ['JP', 'MALE']] as const) {
      expect(initializeNationalityModule(code, gender)).toMatchObject({ moduleId: 'DEFAULT', serviceStatus: 'NOT_APPLICABLE' });
    }
  });

  it('offers routes at age 18 without mutating pending state', () => {
    const pending = initializeNationalityModule('KR', 'MALE');
    const assessment = assessNationalityAtSeasonBoundary(pending, 18, 0);
    expect(assessment.routeChoices).toEqual(['MILITARY_CLUB', 'CAREER_BREAK']);
    expect(assessment.state).toBe(pending);
    expect(assessment.u23Eligible).toBe(true);
  });

  it('resolves either route into serving and completes exactly two seasons later', () => {
    const serving = resolveNationalityChoice(initializeNationalityModule('KR', 'MALE'), 'MILITARY_CLUB', 3);
    expect(serving.serviceStatus).toBe('SERVING');
    expect(assessNationalityAtSeasonBoundary(serving, 21, 4).state.serviceStatus).toBe('SERVING');
    const completed = assessNationalityAtSeasonBoundary(serving, 22, 5).state;
    expect(completed).toMatchObject({ serviceStatus: 'COMPLETED', startSeasonIndex: 3, completedSeasonIndex: 5 });
    expect(assessNationalityAtSeasonBoundary(completed, 23, 99).state).toEqual(completed);
  });

  it('grants only qualifying tournament exceptions, idempotently', () => {
    const pending = initializeNationalityModule('KR', 'MALE');
    expect(grantTournamentException(pending, 'ASIAN_GAMES', 'SILVER', 'ag-silver', 1)).toBe(pending);
    expect(grantTournamentException(pending, 'OLYMPICS', 'BRONZE', 'olympics-bronze', 1)).toMatchObject({ serviceStatus: 'SPECIAL_SERVICE', route: 'SPORTS_SERVICE', startSeasonIndex: 1 });
    const gold = grantTournamentException(pending, 'ASIAN_GAMES', 'GOLD', 'ag-gold', 2);
    expect(gold.serviceStatus).toBe('SPECIAL_SERVICE');
    expect(grantTournamentException(gold, 'ASIAN_GAMES', 'GOLD', 'ag-gold', 2)).toBe(gold);
  });

  it('enforces U23 boundaries and validates inputs', () => {
    expect(isU23Eligible(23)).toBe(true);
    expect(isU23Eligible(24)).toBe(false);
    for (const invalid of [-1, 1.5, Infinity, NaN]) expect(() => isU23Eligible(invalid)).toThrow(RangeError);
    expect(() => assessNationalityAtSeasonBoundary(initializeNationalityModule('KR', 'MALE'), 18, -1)).toThrow(RangeError);
    expect(() => resolveNationalityChoice(initializeNationalityModule('KR', 'MALE'), 'MILITARY_CLUB', -1)).toThrow(RangeError);
  });

  it('returns frozen immutable values', () => {
    const state = initializeNationalityModule('KR', 'MALE');
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.exceptions)).toBe(true);
    const result = grantTournamentException(state, 'OLYMPICS', 'GOLD', 'olympics-gold', 0);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.exceptions)).toBe(true);
  });

  it('rejects malformed default-module service status and invalid medal payloads', () => {
    const defaultState = initializeNationalityModule('JP', 'MALE');
    const malformed = { ...defaultState, serviceStatus: 'SERVING' } as typeof defaultState;
    expect(() => assessNationalityAtSeasonBoundary(malformed, 20, 1)).toThrow(RangeError);
    const korea = initializeNationalityModule('KR', 'MALE');
    expect(() =>
      grantTournamentException(korea, 'ASIAN_GAMES', 'PLATINUM' as never, 'bad-medal', 1),
    ).toThrow(RangeError);
  });
});

/** A game-only nationality service module; this is not a real-world eligibility determination. */
export type NationalityModuleId = 'DEFAULT' | 'KOREA';
export type NationalityServiceStatus =
  'NOT_APPLICABLE' | 'PENDING' | 'SERVING' | 'COMPLETED' | 'SPECIAL_SERVICE';
export type NationalityRoute = null | 'MILITARY_CLUB' | 'CAREER_BREAK' | 'SPORTS_SERVICE';
export type NationalityState = Readonly<{
  moduleId: NationalityModuleId;
  exceptions: readonly string[];
  serviceStatus: NationalityServiceStatus;
  route: NationalityRoute;
  startSeasonIndex: number | null;
  completedSeasonIndex: number | null;
}>;

export type NationalityBoundaryAssessment = Readonly<{
  state: NationalityState;
  routeChoices: readonly Exclude<NationalityRoute, null>[];
  u23Eligible: boolean;
}>;

function seasonIndex(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError(`Nationality: invalid ${label}.`);
}

function ageValue(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Nationality: invalid age.');
}

function frozenState(value: {
  moduleId: NationalityModuleId;
  exceptions: readonly string[];
  serviceStatus: NationalityServiceStatus;
  route: NationalityRoute;
  startSeasonIndex: number | null;
  completedSeasonIndex: number | null;
}): NationalityState {
  return Object.freeze({ ...value, exceptions: Object.freeze([...value.exceptions]) });
}

function validateState(state: NationalityState): void {
  if (!Object.values<NationalityModuleId>(['DEFAULT', 'KOREA']).includes(state.moduleId)) {
    throw new RangeError('Nationality: invalid module.');
  }
  if (
    !Array.isArray(state.exceptions) ||
    new Set(state.exceptions).size !== state.exceptions.length ||
    state.exceptions.some((id) => typeof id !== 'string' || id.length === 0)
  ) {
    throw new RangeError('Nationality: exceptions must be unique non-empty IDs.');
  }
  if (
    !['NOT_APPLICABLE', 'PENDING', 'SERVING', 'COMPLETED', 'SPECIAL_SERVICE'].includes(
      state.serviceStatus,
    )
  )
    throw new RangeError('Nationality: invalid service status.');
  if (![null, 'MILITARY_CLUB', 'CAREER_BREAK', 'SPORTS_SERVICE'].includes(state.route))
    throw new RangeError('Nationality: invalid route.');
  if (
    state.moduleId === 'DEFAULT' &&
    (state.serviceStatus !== 'NOT_APPLICABLE' ||
      state.route !== null ||
      state.startSeasonIndex !== null ||
      state.completedSeasonIndex !== null ||
      state.exceptions.length !== 0)
  )
    throw new RangeError('Nationality: default module has no service.');
  if (state.moduleId === 'KOREA' && state.serviceStatus === 'NOT_APPLICABLE')
    throw new RangeError('Nationality: inconsistent Korea status.');
  if (
    state.serviceStatus === 'PENDING' &&
    (state.route !== null || state.startSeasonIndex !== null || state.completedSeasonIndex !== null)
  )
    throw new RangeError('Nationality: pending state cannot have a route.');
  if (
    ['SERVING', 'SPECIAL_SERVICE', 'COMPLETED'].includes(state.serviceStatus) &&
    state.route === null
  )
    throw new RangeError('Nationality: service requires route.');
  if (state.serviceStatus === 'SPECIAL_SERVICE' && state.route !== 'SPORTS_SERVICE')
    throw new RangeError('Nationality: special service requires sports route.');
  if (state.serviceStatus === 'SERVING' && state.route === 'SPORTS_SERVICE')
    throw new RangeError('Nationality: sports route requires special service.');
  if (state.serviceStatus !== 'COMPLETED' && state.completedSeasonIndex !== null)
    throw new RangeError('Nationality: premature completion.');
  if (state.startSeasonIndex !== null) seasonIndex(state.startSeasonIndex, 'start season');
  if (state.completedSeasonIndex !== null)
    seasonIndex(state.completedSeasonIndex, 'completed season');
  if (
    (state.serviceStatus === 'SERVING' || state.serviceStatus === 'SPECIAL_SERVICE') !==
    (state.startSeasonIndex !== null)
  ) {
    if (state.serviceStatus !== 'COMPLETED')
      throw new RangeError('Nationality: serving state requires a start season.');
  }
  if (
    state.serviceStatus === 'COMPLETED' &&
    (state.startSeasonIndex === null || state.completedSeasonIndex === null)
  ) {
    throw new RangeError('Nationality: completed state requires season boundaries.');
  }
  if (
    state.serviceStatus === 'COMPLETED' &&
    state.completedSeasonIndex! < state.startSeasonIndex! + 2
  )
    throw new RangeError('Nationality: incomplete service period.');
}

export function initializeNationalityModule(
  nationalityCode: string,
  gender: string,
): NationalityState {
  const korea = nationalityCode === 'KR' && gender === 'MALE';
  return frozenState({
    moduleId: korea ? 'KOREA' : 'DEFAULT',
    exceptions: [],
    serviceStatus: korea ? 'PENDING' : 'NOT_APPLICABLE',
    route: null,
    startSeasonIndex: null,
    completedSeasonIndex: null,
  });
}

/** Returns the boundary assessment and a detached completed state when two seasons are done. */
export function assessNationalityAtSeasonBoundary(
  state: NationalityState,
  age: number,
  completedSeasonIndex: number,
): NationalityBoundaryAssessment {
  validateState(state);
  ageValue(age);
  seasonIndex(completedSeasonIndex, 'boundary season');
  let next = state;
  if (
    (state.serviceStatus === 'SERVING' || state.serviceStatus === 'SPECIAL_SERVICE') &&
    state.startSeasonIndex !== null &&
    completedSeasonIndex >= state.startSeasonIndex + 2
  ) {
    next = frozenState({
      ...state,
      serviceStatus: 'COMPLETED',
      completedSeasonIndex: state.startSeasonIndex + 2,
    });
  }
  const routeChoices =
    state.serviceStatus === 'PENDING' && age >= 18
      ? (['MILITARY_CLUB', 'CAREER_BREAK'] as const)
      : ([] as const);
  return Object.freeze({
    state: next,
    routeChoices: Object.freeze([...routeChoices]),
    u23Eligible: age <= 23,
  });
}

export function resolveNationalityChoice(
  state: NationalityState,
  route: Exclude<NationalityRoute, null>,
  startSeasonIndex: number,
): NationalityState {
  validateState(state);
  seasonIndex(startSeasonIndex, 'start season');
  if (!Number.isSafeInteger(startSeasonIndex + 2))
    throw new RangeError('Nationality: service period overflow.');
  if (state.serviceStatus !== 'PENDING' || state.moduleId !== 'KOREA') {
    throw new RangeError('Nationality: no pending Korea choice.');
  }
  if (route !== 'MILITARY_CLUB' && route !== 'CAREER_BREAK')
    throw new RangeError('Nationality: invalid route.');
  return frozenState({
    ...state,
    serviceStatus: 'SERVING',
    route,
    startSeasonIndex,
    completedSeasonIndex: null,
  });
}

export function grantTournamentException(
  state: NationalityState,
  tournament: 'ASIAN_GAMES' | 'OLYMPICS',
  medal: 'GOLD' | 'SILVER' | 'BRONZE',
  sourceId: string,
  startSeasonIndex: number,
): NationalityState {
  validateState(state);
  if (typeof sourceId !== 'string' || sourceId.length === 0)
    throw new RangeError('Nationality: invalid exception source.');
  seasonIndex(startSeasonIndex, 'start season');
  if (!Number.isSafeInteger(startSeasonIndex + 2))
    throw new RangeError('Nationality: service period overflow.');
  if (
    !['ASIAN_GAMES', 'OLYMPICS'].includes(tournament) ||
    !['GOLD', 'SILVER', 'BRONZE'].includes(medal)
  )
    throw new RangeError('Nationality: invalid tournament result.');
  if (state.moduleId !== 'KOREA' || state.serviceStatus !== 'PENDING') return state;
  const qualifies = (tournament === 'ASIAN_GAMES' && medal === 'GOLD') || tournament === 'OLYMPICS';
  if (!qualifies || state.exceptions.includes(sourceId)) return state;
  return frozenState({
    ...state,
    exceptions: [...state.exceptions, sourceId],
    serviceStatus: 'SPECIAL_SERVICE',
    route: 'SPORTS_SERVICE',
    startSeasonIndex,
    completedSeasonIndex: null,
  });
}

export function isU23Eligible(age: number): boolean {
  ageValue(age);
  return age <= 23;
}

import { roll100 } from '../rng.js';
import type { CareerState, CareerTournament } from '../types.js';
import {
  assessNationalityAtSeasonBoundary,
  grantTournamentException,
  initializeNationalityModule,
  resolveNationalityChoice,
} from './nationality.js';

export type CareerEventChoice = 'MILITARY_CLUB' | 'CAREER_BREAK' | 'INTERNATIONAL' | 'MENTOR';
export function nationalityForCareer(state: CareerState) {
  if ('serviceStatus' in state.nationalityRuleState) return state.nationalityRuleState;
  const profile = state.player.profile;
  return initializeNationalityModule(
    profile?.nationalityCode ?? '',
    profile?.gender ?? 'UNSPECIFIED',
  );
}

/** Version 1 compact U23 tournament, not a real competition calendar or legal entitlement. */
export function careerEventChoices(state: CareerState): CareerEventChoice[] {
  if (
    state.status !== 'ACTIVE' ||
    state.player.profile === null ||
    state.season !== null ||
    state.pending !== null
  )
    return [];
  const seasonIndex = state.seasonHistory.length;
  const nationality = assessNationalityAtSeasonBoundary(
    nationalityForCareer(state),
    state.age,
    seasonIndex,
  );
  const choices: CareerEventChoice[] = nationality.routeChoices.filter(
    (route): route is 'MILITARY_CLUB' | 'CAREER_BREAK' => route !== 'SPORTS_SERVICE',
  );
  if (
    seasonIndex > 0 &&
    seasonIndex % 2 === 0 &&
    state.age >= 18 &&
    state.age <= 23 &&
    state.player.profile.baseOvr >= 65 &&
    !state.health.episodes.some(
      (episode) => episode.status === 'ACTIVE' || episode.status === 'REHAB',
    ) &&
    !state.legacyEvents?.tournaments.some((event) => event.seasonIndex === seasonIndex) &&
    nationality.state.serviceStatus !== 'SERVING'
  )
    choices.push('INTERNATIONAL');
  if (
    seasonIndex > 0 &&
    state.age >= 30 &&
    state.relationships.captain >= 50 &&
    !state.legacyEvents?.mentoredSeasonIndices.includes(seasonIndex)
  )
    choices.push('MENTOR');
  return choices;
}

export function resolveCareerEvent(
  state: CareerState,
  choice: CareerEventChoice,
  revision: number,
): CareerState {
  if (!careerEventChoices(state).includes(choice))
    throw new RangeError('Career event is unavailable at this boundary.');
  const index = state.seasonHistory.length;
  const events = state.legacyEvents ?? {
    policyVersion: '1.0.0' as const,
    tournaments: [],
    mentoredSeasonIndices: [],
  };
  if (choice === 'MILITARY_CLUB' || choice === 'CAREER_BREAK') {
    const nationality = resolveNationalityChoice(nationalityForCareer(state), choice, index);
    return {
      ...state,
      nationalityRuleState: nationality,
      timeline: [
        ...state.timeline,
        {
          revision,
          kind: 'SERVICE_STARTED',
          refId: choice,
          age: state.age,
          step: state.currentStep,
        },
      ],
    };
  }
  if (choice === 'MENTOR') {
    return {
      ...state,
      legacyEvents: { ...events, mentoredSeasonIndices: [...events.mentoredSeasonIndices, index] },
      tags: [...new Set([...state.tags, `MENTOR_SUCCESS:${index}`])].sort(),
      relationships: {
        ...state.relationships,
        captain: Math.min(100, state.relationships.captain + 2),
      },
      timeline: [
        ...state.timeline,
        {
          revision,
          kind: 'MENTORED',
          refId: `MENTOR_SUCCESS:${index}`,
          age: state.age,
          step: state.currentStep,
        },
      ],
    };
  }
  let rng = state.rngState;
  const matches: CareerTournament['matches'] = [];
  // Six short-form games, one draw per game. The same archived decision replays identically.
  // OVR influences only tournament performance, never the final Legacy formula directly.
  const threshold = Math.min(85, Math.max(25, state.player.profile!.baseOvr - 10));
  for (let match = 1; match <= 6; match += 1) {
    const rolled = roll100(rng);
    rng = rolled.state;
    matches.push({ index: match, roll: rolled.value, won: rolled.value <= threshold, minutes: 90 });
  }
  const wins = matches.filter((match) => match.won).length;
  const medal =
    wins >= 5
      ? ('GOLD' as const)
      : wins === 4
        ? ('SILVER' as const)
        : wins === 3
          ? ('BRONZE' as const)
          : null;
  const tournament = index % 4 === 0 ? ('OLYMPICS' as const) : ('ASIAN_GAMES' as const);
  const sourceId = `U23:${tournament}:${index}`;
  const entry: CareerTournament = {
    sourceId,
    seasonIndex: index,
    age: state.age,
    tournament,
    medal,
    matches,
  };
  const nationality = nationalityForCareer(state);
  const after =
    medal === null
      ? nationality
      : grantTournamentException(nationality, tournament, medal, sourceId, index);
  return {
    ...state,
    rngState: rng,
    nationalityRuleState: after,
    legacyEvents: { ...events, tournaments: [...events.tournaments, entry] },
    timeline: [
      ...state.timeline,
      {
        revision,
        kind: 'INTERNATIONAL_TOURNAMENT',
        refId: sourceId,
        age: state.age,
        step: state.currentStep,
      },
    ],
  };
}

export function settleNationality(state: CareerState, revision: number): CareerState {
  if (!('serviceStatus' in state.nationalityRuleState)) return state;
  const before = state.nationalityRuleState;
  const after = assessNationalityAtSeasonBoundary(
    before,
    state.age,
    state.seasonHistory.length,
  ).state;
  if (before.serviceStatus === after.serviceStatus) return state;
  return {
    ...state,
    nationalityRuleState: after,
    timeline: [
      ...state.timeline,
      {
        revision,
        kind: 'SERVICE_COMPLETED',
        refId: after.route,
        age: state.age,
        step: state.currentStep,
      },
    ],
  };
}

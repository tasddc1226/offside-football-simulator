import { projectLeagueCompetition } from './league-ledger.js';
import { buildLeagueFixtures, findLeague } from './schedule.js';
import {
  applyPlayedMatch,
  initialSeasonPlayerStats,
  type SeasonMatchBooks,
} from './season-stats.js';
import { computeSquadStatus } from './selection.js';
import type { Ruleset } from './ruleset.js';
import type { CareerState, ChapterOutcomeKind, MatchRecord } from './types.js';

/** A late play adds a new goal or prevents a new concession; it never erases earlier goals. */
export function applyMatchDecision(
  match: MatchRecord,
  decisionId: string,
  optionId: string,
  outcomeKind: ChapterOutcomeKind,
  managerTrustDelta: number,
): MatchRecord {
  const action =
    match.stats.group === 'GK'
      ? 'SAVE'
      : match.stats.group === 'DF'
        ? 'BLOCK'
        : match.stats.group === 'MF' || optionId === 'LINK'
          ? 'PASS'
          : 'SHOT';
  const success = outcomeKind === 'SUCCESS';
  const conceded = (action === 'SAVE' || action === 'BLOCK') && outcomeKind === 'FAIL';
  const scored = (action === 'SHOT' || action === 'PASS') && success;
  const goalsFor = match.result.goalsFor + (scored ? 1 : 0);
  const goalsAgainst = match.result.goalsAgainst + (conceded ? 1 : 0);
  let stats = match.stats;
  switch (stats.group) {
    case 'FW':
      stats = {
        ...stats,
        goals: stats.goals + (scored && action === 'SHOT' ? 1 : 0),
        assists: stats.assists + (scored && action === 'PASS' ? 1 : 0),
        shots: stats.shots + (action === 'SHOT' ? 1 : 0),
        xgCenti: stats.xgCenti + (action === 'SHOT' ? 35 : 0),
      };
      break;
    case 'MF':
      stats = {
        ...stats,
        assists: stats.assists + (scored ? 1 : 0),
        chancesCreated: stats.chancesCreated + 1,
        passesAttempted: stats.passesAttempted + 1,
        passesCompleted: stats.passesCompleted + (success ? 1 : 0),
      };
      break;
    case 'DF':
      stats = {
        ...stats,
        tackles: stats.tackles + (success ? 1 : 0),
        goalsConcededInvolved: stats.goalsConcededInvolved + (conceded ? 1 : 0),
        cleanSheet: stats.cleanSheet && goalsAgainst === 0,
      };
      break;
    case 'GK':
      stats = {
        ...stats,
        saves: stats.saves + (success ? 1 : 0),
        psxgMinusGoalsCenti: stats.psxgMinusGoalsCenti + (success ? 50 : conceded ? -50 : 0),
        cleanSheet: stats.cleanSheet && goalsAgainst === 0,
      };
      break;
  }
  return {
    ...match,
    stats,
    result: {
      goalsFor,
      goalsAgainst,
      outcome: goalsFor > goalsAgainst ? 'WIN' : goalsFor < goalsAgainst ? 'LOSS' : 'DRAW',
    },
    decisionImpact: {
      originalRatingTenths: match.decisionImpact?.originalRatingTenths ?? match.ratingTenths,
      receipts: [
        ...(match.decisionImpact?.receipts ?? []),
        {
          decisionId,
          action,
          outcomeKind,
          before: { goalsFor: match.result.goalsFor, goalsAgainst: match.result.goalsAgainst },
          after: { goalsFor, goalsAgainst },
          managerTrustDelta,
        },
      ],
    },
  };
}

/** Rebuild all projections from the match source of truth. No RNG and no second application of effects. */
export function reconcileMatchDecision(state: CareerState, ruleset: Ruleset): CareerState {
  const season = state.season;
  if (season === null || state.contract === null)
    throw new RangeError('Match decision requires an active club season');
  const team = ruleset.teams.find((t) => t.id === season.teamId)!;
  const league = findLeague(ruleset, team.leagueId);
  let books: SeasonMatchBooks = {
    matches: [],
    competitions: season.competitions.map((c) => ({
      ...c,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      position: null,
      cupRound: c.kind === 'CUP' ? (ruleset.leagueCalendar.cupRounds[0]?.round ?? null) : null,
    })),
    playerStats: initialSeasonPlayerStats(season.playerStats.group),
    schedule: season.schedule.map(({ skipped: _skipped, ...entry }) => entry),
  };
  for (const match of season.matches)
    books = applyPlayedMatch(ruleset, team, league, ruleset.leagueCalendar, books, match);
  let ledger = season.leagueLedger;
  if (ledger !== undefined) {
    const fixtures = buildLeagueFixtures(ledger.seasonIndex, ledger.leagueId, ledger.teams);
    const updated = new Map<number, MatchRecord>();
    for (const match of season.matches.filter((m) => m.kind === 'LEAGUE')) {
      const entry = season.schedule.find((e) => e.step === match.step && e.order === match.order);
      const index = fixtures.findIndex((f) => f.fixtureId === entry?.fixtureId);
      if (index < 0) throw new RangeError('Match decision fixture missing');
      updated.set(index, match);
    }
    ledger = {
      ...ledger,
      results: ledger.results.map((tuple) => {
        const match = updated.get(tuple[0]);
        return match === undefined
          ? tuple
          : [
              tuple[0],
              match.home ? match.result.goalsFor : match.result.goalsAgainst,
              match.home ? match.result.goalsAgainst : match.result.goalsFor,
            ];
      }),
    };
    books.competitions = projectLeagueCompetition(ruleset, ledger, books.competitions);
  }
  const lastRatingTenths =
    [...season.matches].reverse().find((m) => m.ratingTenths !== null)?.ratingTenths ?? null;
  const squadStatus = computeSquadStatus(
    {
      rolePromise: state.contract.rolePromise,
      captaincy: state.captaincy,
      lastRating: lastRatingTenths === null ? null : lastRatingTenths / 10,
    },
    ruleset.selectionRules,
    ruleset.contractRules.squadStatusByRole,
  );
  return {
    ...state,
    context: { ...state.context, squadStatus },
    season: {
      ...season,
      ...books,
      lastRatingTenths,
      ...(ledger === undefined ? {} : { leagueLedger: ledger }),
    },
  };
}

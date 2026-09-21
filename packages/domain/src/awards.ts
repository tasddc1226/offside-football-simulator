import { canonicalize, compareCodePoints } from './canonical.js';
import { sha256Hex } from './hash.js';
import { seasonWonTitle } from './reputation.js';
import type { Ruleset } from './ruleset.js';
import type {
  CareerMilestone,
  CareerState,
  FinalLeagueTableRow,
  SeasonAward,
  SeasonPlayerStats,
  SeasonResult,
  StatGroup,
} from './types.js';

const POSITION_GROUPS: readonly StatGroup[] = ['GK', 'DF', 'MF', 'FW'];
const BEST_XI_SLOTS: Record<StatGroup, number> = { GK: 1, DF: 4, MF: 3, FW: 3 };
const PLAYER_ID = 'PLAYER';

type RecognitionResult = Pick<
  SeasonResult,
  'index' | 'teamId' | 'competitions' | 'playerStats' | 'selectionSummary' | 'finalLeagueTable' | 'chapters'
>;

/** Candidate gate. Published rulesets never gain retroactive award fields or hash changes. */
export function recognitionEnabled(state: Pick<CareerState, 'rulesetVersion' | 'contentPackVersion'>): boolean {
  return state.rulesetVersion === '3.4.0' && state.contentPackVersion === '0.13.0';
}

export function realAppearances(stats: Pick<SeasonPlayerStats, 'appearances'>): number {
  // `zeroMinute` already includes OUT records (OUT has 0 minutes), so subtract it once.
  return Math.max(0, stats.appearances.total - stats.appearances.zeroMinute);
}

type PerformanceLine = {
  group: StatGroup;
  minutes: number;
  appearances: number;
  averageRatingTenths: number;
  goals: number;
  assists: number;
  xgCenti: number;
  shots: number;
  tackles: number;
  interceptions: number;
  aerialsWon: number;
  goalsConcededInvolved: number;
  cleanSheet: number;
  saves: number;
  psxgMinusGoalsCenti: number;
  crossesClaimed: number;
  buildUpPasses: number;
  chancesCreated: number;
  progressivePasses: number;
  ballRecoveries: number;
};

function performanceScore(line: PerformanceLine, rankBonus: number): number {
  const average = line.averageRatingTenths;
  let contribution = 0;
  switch (line.group) {
    case 'GK':
      contribution =
        line.saves * 3 +
        line.cleanSheet * 22 +
        Math.round(line.psxgMinusGoalsCenti / 10) +
        line.crossesClaimed +
        line.buildUpPasses;
      break;
    case 'DF':
      contribution =
        line.tackles * 3 +
        line.interceptions * 3 +
        line.aerialsWon * 2 +
        line.cleanSheet * 22 -
        line.goalsConcededInvolved * 2;
      break;
    case 'MF':
      contribution =
        line.assists * 8 +
        line.chancesCreated * 2 +
        line.progressivePasses +
        line.ballRecoveries * 2;
      break;
    case 'FW':
      contribution =
        line.goals * 12 +
        line.assists * 5 +
        Math.round(line.xgCenti / 10) +
        line.shots;
      break;
  }
  // Rating is the common, cross-position anchor. Position contribution is
  // normalized to a bounded band so raw tackles/goals cannot dominate it.
  const normalizedContribution = Math.max(-150, Math.min(300, contribution));
  return average * 10 + normalizedContribution + rankBonus;
}

function emptyPerformanceLine(group: StatGroup): PerformanceLine {
  return {
    group,
    minutes: 0,
    appearances: 0,
    averageRatingTenths: 0,
    goals: 0,
    assists: 0,
    xgCenti: 0,
    shots: 0,
    tackles: 0,
    interceptions: 0,
    aerialsWon: 0,
    goalsConcededInvolved: 0,
    cleanSheet: 0,
    saves: 0,
    psxgMinusGoalsCenti: 0,
    crossesClaimed: 0,
    buildUpPasses: 0,
    chancesCreated: 0,
    progressivePasses: 0,
    ballRecoveries: 0,
  };
}

function playerLeagueLine(state: CareerState, result: RecognitionResult): PerformanceLine {
  const line = emptyPerformanceLine(result.playerStats.group);
  let ratingSumTenths = 0;
  let ratedMatches = 0;
  for (const match of state.season?.matches ?? []) {
    if (match.kind !== 'LEAGUE' || match.minutes <= 0 || match.stats.group !== line.group) continue;
    line.minutes += match.minutes;
    line.appearances += 1;
    if (match.ratingTenths !== null) {
      ratingSumTenths += match.ratingTenths;
      ratedMatches += 1;
    }
    switch (match.stats.group) {
      case 'GK':
        line.saves += match.stats.saves;
        line.psxgMinusGoalsCenti += match.stats.psxgMinusGoalsCenti;
        line.cleanSheet += match.stats.cleanSheet ? 1 : 0;
        line.crossesClaimed += match.stats.crossesClaimed;
        line.buildUpPasses += match.stats.buildUpPasses;
        break;
      case 'DF':
        line.tackles += match.stats.tackles;
        line.interceptions += match.stats.interceptions;
        line.aerialsWon += match.stats.aerialsWon;
        line.goalsConcededInvolved += match.stats.goalsConcededInvolved;
        line.cleanSheet += match.stats.cleanSheet ? 1 : 0;
        break;
      case 'MF':
        line.assists += match.stats.assists;
        line.chancesCreated += match.stats.chancesCreated;
        line.progressivePasses += match.stats.progressivePasses;
        line.ballRecoveries += match.stats.ballRecoveries;
        break;
      case 'FW':
        line.goals += match.stats.goals;
        line.assists += match.stats.assists;
        line.xgCenti += match.stats.xgCenti;
        line.shots += match.stats.shots;
        break;
    }
  }
  line.averageRatingTenths = ratedMatches === 0 ? 0 : Math.round(ratingSumTenths / ratedMatches);
  return line;
}

function npcLine(
  row: FinalLeagueTableRow,
  group: StatGroup,
  seed: string,
  squadStrength: number,
): PerformanceLine {
  const matches = row[3];
  const variation = hashNumber(`${seed}|stats`) % 11;
  const averageRatingTenths = Math.max(55, Math.min(88, squadStrength + variation - 5));
  const cleanSheet = Math.max(0, Math.floor((row[4] + variation) / (group === 'GK' ? 3 : 5)));
  const line: PerformanceLine = {
    group,
    minutes: matches * 90,
    appearances: matches,
    averageRatingTenths,
    goals: 0,
    assists: 0,
    xgCenti: 0,
    shots: 0,
    tackles: 0,
    interceptions: 0,
    aerialsWon: 0,
    goalsConcededInvolved: 0,
    cleanSheet,
    saves: 0,
    psxgMinusGoalsCenti: 0,
    crossesClaimed: 0,
    buildUpPasses: 0,
    chancesCreated: 0,
    progressivePasses: 0,
    ballRecoveries: 0,
  };
  switch (group) {
    case 'GK':
      line.saves = matches * 2 + variation;
      line.psxgMinusGoalsCenti = variation * 15 - 30;
      line.crossesClaimed = Math.floor(matches / 2);
      line.buildUpPasses = matches * 3;
      break;
    case 'DF':
      line.tackles = matches * 2 + variation;
      line.interceptions = matches + Math.floor(variation / 2);
      line.aerialsWon = matches + variation;
      line.goalsConcededInvolved = Math.max(0, Math.floor((matches - row[4]) / 4));
      break;
    case 'MF':
      line.assists = Math.floor(matches / 8) + (variation % 3);
      line.chancesCreated = matches * 2 + variation;
      line.progressivePasses = matches * 3 + variation * 2;
      line.ballRecoveries = matches * 2 + variation;
      break;
    case 'FW':
      line.goals = 3 + (hashNumber(`${seed}|goals`) % Math.max(6, Math.floor(matches / 2) + 3));
      line.assists = Math.floor(matches / 9) + (variation % 3);
      line.xgCenti = line.goals * 100 + variation * 8;
      line.shots = line.goals * 3 + variation;
      break;
  }
  return line;
}

function hashNumber(value: string): number {
  const digest = sha256Hex(canonicalize(value));
  return Number.parseInt(digest.slice(0, 8), 16);
}

function leagueRows(result: RecognitionResult): readonly FinalLeagueTableRow[] {
  return result.finalLeagueTable?.rows ?? [];
}

function playerRankBonus(result: RecognitionResult, rowCount: number): number {
  const rank = result.finalLeagueTable?.rows.find((row) => row[1] === result.teamId)?.[0] ??
    result.competitions.find((competition) => competition.kind === 'LEAGUE')?.position ??
    rowCount;
  return Math.max(0, rowCount - rank) * 10;
}

type NpcCandidate = {
  recipientId: string;
  recipientName: string;
  recipientGroup: StatGroup;
  score: number;
};

function npcCandidates(
  ruleset: Ruleset,
  result: RecognitionResult,
  group: StatGroup,
): NpcCandidate[] {
  const rows = leagueRows(result);
  const leagueId = result.finalLeagueTable?.leagueId ?? 'league-unknown';
  const names = ruleset.competitorNames;
  return rows.map((row) => {
    const team = ruleset.teams.find((candidate) => candidate.id === row[1]);
    const strength = team?.squadStrength ?? 60;
    const seed = `${leagueId}|${result.index}|${row[1]}|${group}`;
    const line = npcLine(row, group, seed, strength);
    const base = performanceScore(line, Math.max(0, rows.length - row[0]) * 10);
    const nameIndex = names.length === 0 ? 0 : hashNumber(`${row[1]}|${group}|${result.index}`) % names.length;
    return {
      recipientId: `NPC:${leagueId}:${result.index}:${row[1]}:${group}`,
      recipientName: names[nameIndex] ?? `League contender ${row[0]}`,
      recipientGroup: group,
      score: base,
    };
  });
}

function sortCandidates<T extends { recipientId: string; score: number }>(candidates: readonly T[]): T[] {
  return [...candidates].sort((a, b) => b.score - a.score || compareCodePoints(a.recipientId, b.recipientId));
}

function chooseWinner<T extends { recipientId: string; score: number }>(candidates: readonly T[]): T | undefined {
  return sortCandidates(candidates)[0];
}

function buildAward(
  awardId: SeasonAward['awardId'],
  winner: NpcCandidate | { recipientId: string; recipientName: string; recipientGroup: StatGroup; score: number },
  eligibility: SeasonAward['criteria']['eligibility'],
  playerScore: number,
  contenderCount: number,
  playerMinutes: number,
  minimumAppearances: number,
  minimumMinutes: number,
): SeasonAward {
  return {
    awardId,
    recipientId: winner.recipientId,
    recipientName: winner.recipientName,
    recipientGroup: winner.recipientGroup,
    score: winner.score,
    criteria: {
      eligibility,
      comparison: winner.recipientId === PLAYER_ID ? 'PLAYER_ACTUAL' : 'NPC_LEAGUE_MODEL',
      playerMinutes,
      playerScore,
      winningScore: winner.score,
      contenderCount,
      minimumAppearances,
      minimumMinutes,
    },
  };
}

function playerCandidate(state: CareerState, group: StatGroup, score: number): NpcCandidate {
  return {
    recipientId: PLAYER_ID,
    recipientName: state.player.profile?.name ?? 'Player',
    recipientGroup: group,
    score,
  };
}

/**
 * Evaluate the bounded candidate awards. The comparison pool is deliberately
 * synthetic and deterministic: each active league-table team contributes one
 * seeded NPC candidate, while the player's score is made solely from persisted
 * minutes, ratings and position-appropriate totals.
 */
export function evaluateSeasonAwards(
  state: CareerState,
  ruleset: Ruleset,
  result: RecognitionResult,
): SeasonAward[] {
  const rows = leagueRows(result);
  const leagueLine = playerLeagueLine(state, result);
  const playerMinutes = leagueLine.minutes;
  const teamRow = rows.find((row) => row[1] === result.teamId);
  const teamPlayed = teamRow?.[3] ?? 0;
  const minimumAppearances = Math.max(1, Math.ceil(teamPlayed / 4));
  const minimumMinutes = Math.max(90, Math.ceil((teamPlayed * 90) / 4));
  const hasRealAppearance = leagueLine.appearances > 0 && playerMinutes > 0;
  if (rows.length === 0 || !hasRealAppearance) return [];
  const performanceEligible = leagueLine.appearances >= minimumAppearances && playerMinutes >= minimumMinutes;

  const playerGroup = result.playerStats.group;
  const playerScore = performanceScore(leagueLine, playerRankBonus(result, rows.length));
  const awards: SeasonAward[] = [];

  const allMvpCandidates = POSITION_GROUPS.flatMap((group) => npcCandidates(ruleset, result, group));
  const mvpWinner = chooseWinner(
    performanceEligible
      ? [...allMvpCandidates, playerCandidate(state, playerGroup, playerScore)]
      : allMvpCandidates,
  );
  if (mvpWinner !== undefined) {
    awards.push(buildAward('SEASON_MVP', mvpWinner, 'POSITION_STATS', playerScore, allMvpCandidates.length, playerMinutes, minimumAppearances, minimumMinutes));
  }

  for (const group of POSITION_GROUPS) {
    const npcs = npcCandidates(ruleset, result, group);
    const candidates = group === playerGroup && performanceEligible ? [...npcs, playerCandidate(state, group, playerScore)] : npcs;
    const winners = sortCandidates(candidates).slice(0, BEST_XI_SLOTS[group]);
    if (winners.length === 0) continue;
    const groupPlayerScore = group === playerGroup && performanceEligible ? playerScore : 0;
    for (const winner of winners) {
      awards.push(buildAward('BEST_XI', winner, 'POSITION_STATS', groupPlayerScore, npcs.length, playerMinutes, minimumAppearances, minimumMinutes));
    }
    const positionWinner = winners[0];
    if (positionWinner !== undefined) {
      awards.push(buildAward('POSITION_LEADER', positionWinner, 'POSITION_STATS', groupPlayerScore, npcs.length, playerMinutes, minimumAppearances, minimumMinutes));
    }
  }

  const scoringNpcs = rows.map((row) => {
    const team = ruleset.teams.find((candidate) => candidate.id === row[1]);
    const line = npcLine(row, 'FW', `${result.finalLeagueTable?.leagueId ?? 'league-unknown'}|${result.index}|${row[1]}|FW`, team?.squadStrength ?? 60);
    const goals = line.goals;
    return {
      recipientId: `NPC:${result.finalLeagueTable?.leagueId ?? 'league-unknown'}:${result.index}:${row[1]}:FW`,
      recipientName: ruleset.competitorNames[hashNumber(`${row[1]}|SCORING|${result.index}`) % Math.max(1, ruleset.competitorNames.length)] ?? `League striker ${row[0]}`,
      recipientGroup: 'FW' as const,
      score: goals,
    };
  });
  if (playerGroup === 'FW') {
    // Scoring leader is league-only. Cup goals remain in the player's season totals
    // and milestone accounting, but never enter this league comparison.
    const playerGoals = state.season === null
      ? 0
      : state.season.matches.reduce(
          (total, match) => total + (match.kind === 'LEAGUE' && match.stats.group === 'FW' ? match.stats.goals : 0),
          0,
        );
    const scoringWinner = chooseWinner([...scoringNpcs, playerCandidate(state, 'FW', playerGoals)]);
    if (scoringWinner !== undefined) {
      awards.push(buildAward('SCORING_LEADER', scoringWinner, 'GOALS', playerGoals, scoringNpcs.length, playerMinutes, 0, 1));
    }
  }

  const priorRealAppearances = state.seasonHistory.reduce((total, season) => total + realAppearances(season.result.playerStats), 0);
  if (state.age <= 21 && priorRealAppearances === 0) {
    const rookieNpcs = POSITION_GROUPS.flatMap((group) => npcCandidates(ruleset, result, group));
    const rookieWinner = chooseWinner(
      performanceEligible
        ? [...rookieNpcs, playerCandidate(state, playerGroup, playerScore)]
        : rookieNpcs,
    );
    if (rookieWinner !== undefined) {
      awards.push(buildAward('ROOKIE_OF_SEASON', rookieWinner, 'REAL_APPEARANCE', playerScore, rookieNpcs.length, playerMinutes, minimumAppearances, minimumMinutes));
    }
  }
  return awards;
}

function previousGoals(state: CareerState): number {
  return state.seasonHistory.reduce(
    (total, season) => total + (season.result.playerStats.totals.group === 'FW' ? season.result.playerStats.totals.goals : 0),
    0,
  );
}

function previousTitles(state: CareerState): boolean {
  return state.seasonHistory.some((season) => seasonWonTitle(season.result));
}

function previousNationalDebut(state: CareerState): boolean {
  return state.seasonHistory.some((season) => season.result.chapters.some((chapter) => chapter.trigger === 'NATIONAL_DEBUT'));
}

/** Evaluate one-time milestones from actual saved results; zero-minute records never qualify. */
export function evaluateCareerMilestones(state: CareerState, result: RecognitionResult): CareerMilestone[] {
  const currentAppearances = realAppearances(result.playerStats);
  if (currentAppearances === 0 || result.playerStats.minutes === 0) return [];
  const beforeAppearances = state.seasonHistory.reduce((total, season) => total + realAppearances(season.result.playerStats), 0);
  const totalAppearances = beforeAppearances + currentAppearances;
  const beforeGoals = previousGoals(state);
  const currentGoals = result.playerStats.totals.group === 'FW' ? result.playerStats.totals.goals : 0;
  const totalGoals = beforeGoals + currentGoals;
  const priorTeamIds = state.seasonHistory.map((season) => season.teamId);
  const oneClub = [...priorTeamIds, result.teamId].every((teamId) => teamId === result.teamId);
  const criteria = { realAppearances: totalAppearances, goals: totalGoals, teamId: result.teamId };
  const milestones: CareerMilestone[] = [];
  if (beforeAppearances === 0) milestones.push({ milestoneId: 'FIRST_APPEARANCE', seasonIndex: result.index, criteria });
  if (beforeAppearances < 100 && totalAppearances >= 100) milestones.push({ milestoneId: 'HUNDRED_APPEARANCES', seasonIndex: result.index, criteria });
  if (result.playerStats.group === 'FW' && beforeGoals < 50 && totalGoals >= 50) milestones.push({ milestoneId: 'FIFTY_GOALS', seasonIndex: result.index, criteria });
  if (!previousTitles(state) && seasonWonTitle(result)) milestones.push({ milestoneId: 'FIRST_TITLE', seasonIndex: result.index, criteria });
  if (state.seasonHistory.length < 5 && state.seasonHistory.length + 1 >= 5 && oneClub) {
    milestones.push({ milestoneId: 'FIVE_SEASON_ONE_CLUB', seasonIndex: result.index, criteria });
  }
  if (!previousNationalDebut(state) && result.chapters.some((chapter) => chapter.trigger === 'NATIONAL_DEBUT')) {
    milestones.push({ milestoneId: 'NATIONAL_DEBUT', seasonIndex: result.index, criteria });
  }
  return milestones;
}

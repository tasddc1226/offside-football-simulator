import { playMatch, type PlayMatchResult } from './match.js';
import { seedRng } from './rng.js';
import { findLeague, resolveOpponent } from './schedule.js';
import { compareCodePoints } from './canonical.js';
import { findTacticalStyle } from './selection.js';
import type { League, Ruleset, Team } from './ruleset.js';
import type { MatchRecord, Position, ScheduleEntry } from './types.js';

/** The competition is a thin, immutable scenario wrapper around the shipped match kernel. */
export const COMPETITION_MATCH_VERSION = 'MATCH_EVIDENCE_V1' as const;
export const COMPETITION_MAX_SCORE = 400;

export type CompetitionMatchDefinition = {
  dayKey: string;
  seed: string;
  position: Position;
  teamId: string;
  leagueId: string;
  opponentId: string;
  styleId: string;
  baseOvr: number;
  tacticalFit: number;
  managerTrust: number;
  form: number;
  fitness: number;
  morale: number;
  positionProficiency: number;
};

export type CompetitionActionState = {
  actionIds: string[];
  tacticalFit: number;
  managerTrust: number;
  form: number;
  fitness: number;
  morale: number;
  positionProficiency: number;
};

/**
 * Choices intentionally carry effects, never points or authored outcomes. The effect is fed into
 * playMatch's normal selection/performance inputs, so a result can only be obtained by executing
 * the pinned match rules with the frozen day definition.
 */
const ACTION_EFFECTS: Record<
  string,
  Pick<CompetitionActionState, 'tacticalFit' | 'managerTrust' | 'form' | 'fitness' | 'morale' | 'positionProficiency'>
> = {
  PRESS_HIGH: { tacticalFit: 7, managerTrust: 1, form: 1, fitness: -8, morale: 0, positionProficiency: 1 },
  HOLD_SHAPE: { tacticalFit: 2, managerTrust: 3, form: 0, fitness: -2, morale: 1, positionProficiency: 2 },
  COUNTER_SPACE: { tacticalFit: 5, managerTrust: 0, form: 1, fitness: -4, morale: 2, positionProficiency: 3 },
  RECOVER: { tacticalFit: 0, managerTrust: 0, form: 0, fitness: 10, morale: 3, positionProficiency: 0 },
  SHARPEN: { tacticalFit: 3, managerTrust: 1, form: 2, fitness: -5, morale: 0, positionProficiency: 4 },
  STUDY: { tacticalFit: 5, managerTrust: 2, form: 0, fitness: 0, morale: 1, positionProficiency: 5 },
  ATTACK_WIDE: { tacticalFit: 6, managerTrust: 1, form: 2, fitness: -4, morale: 1, positionProficiency: 2 },
  PLAY_THROUGH: { tacticalFit: 4, managerTrust: 2, form: 1, fitness: -2, morale: 2, positionProficiency: 4 },
  SET_PIECES: { tacticalFit: 3, managerTrust: 4, form: 0, fitness: 0, morale: 1, positionProficiency: 5 },
};

export const COMPETITION_CHOICE_CATALOG = [
  [
    ['PRESS_HIGH', '전방 압박', '전술 적합도와 폼을 높이는 대신 체력을 더 소모합니다.'],
    ['HOLD_SHAPE', '간격 유지', '전술 적합도·신뢰·사기를 조금 높이고 체력 부담을 줄입니다.'],
    ['COUNTER_SPACE', '빈 공간 역습', '전술 적합도·폼·포지션 숙련을 높이지만 체력을 일부 사용합니다.'],
  ],
  [
    ['RECOVER', '회복 우선', '체력과 사기를 높이지만 전술·포지션 숙련 변화는 없습니다.'],
    ['SHARPEN', '마무리 훈련', '전술 적합도·폼·포지션 숙련을 높이지만 체력을 일부 사용합니다.'],
    ['STUDY', '상대 분석', '전술 적합도·신뢰·포지션 숙련을 높이고 체력은 유지합니다.'],
  ],
  [
    ['ATTACK_WIDE', '측면 전개', '전술 적합도·폼·포지션 숙련을 높이지만 체력을 일부 사용합니다.'],
    ['PLAY_THROUGH', '중앙 연계', '전술 적합도·신뢰·폼·포지션 숙련을 높이고 체력을 조금 사용합니다.'],
    ['SET_PIECES', '세트피스 준비', '전술 적합도·신뢰·사기·포지션 숙련을 높이고 체력은 유지합니다.'],
  ],
] as const;

export const COMPETITION_CHOICE_STEPS = [
  { id: 'approach', title: '경기 접근', prompt: '첫 장면에서 어떤 전술 준비를 할까요?', choices: COMPETITION_CHOICE_CATALOG[0] },
  { id: 'training', title: '짧은 훈련', prompt: '경기 전 제한된 시간을 어디에 쓸까요?', choices: COMPETITION_CHOICE_CATALOG[1] },
  { id: 'final-plan', title: '마지막 계획', prompt: '경기에서 어떤 실행 계획을 택할까요?', choices: COMPETITION_CHOICE_CATALOG[2] },
] as const;

const ROTATING_POSITIONS: Position[] = ['GK', 'CB', 'CM', 'ST'];

/** Immutable day provisioning input. Position rotation is a day-definition rule, not a request value. */
export function buildCompetitionMatchDefinition(ruleset: Ruleset, dayKey: string): CompetitionMatchDefinition {
  const teams = [...ruleset.teams].sort((a, b) => compareCodePoints(a.id, b.id));
  if (teams.length === 0) throw new RangeError('Competition requires a ruleset team');
  const dayOrdinal = Math.floor(Date.parse(`${dayKey}T00:00:00Z`) / 86_400_000);
  const eligibleTeams = teams.filter((candidate) => {
    const style = findTacticalStyle(ruleset, candidate.tacticalStyleId);
    return ROTATING_POSITIONS.every((position) => style.slots[position] > 0);
  });
  if (eligibleTeams.length === 0) throw new RangeError('Competition requires a style with all rotating positions');
  const team = eligibleTeams[((dayOrdinal % eligibleTeams.length) + eligibleTeams.length) % eligibleTeams.length]!;
  const league = findLeague(ruleset, team.leagueId);
  const opponents = teams.filter((candidate) => candidate.leagueId === team.leagueId && candidate.id !== team.id).sort((a, b) => compareCodePoints(a.id, b.id));
  const opponentId = opponents[0]?.id ?? `${league.id}-opp-1`;
  const styleId = team.tacticalStyleId;
  return {
    dayKey,
    seed: `competition-match:${dayKey}:3.3.0:0.12.0`,
    position: ROTATING_POSITIONS[((dayOrdinal % ROTATING_POSITIONS.length) + ROTATING_POSITIONS.length) % ROTATING_POSITIONS.length]!,
    teamId: team.id,
    leagueId: league.id,
    opponentId,
    styleId,
    baseOvr: 72,
    tacticalFit: 62,
    managerTrust: 64,
    form: 68,
    fitness: 82,
    morale: 75,
    positionProficiency: 95,
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function applyCompetitionAction(
  _definition: CompetitionMatchDefinition,
  state: CompetitionActionState,
  actionId: string,
): CompetitionActionState {
  const effect = ACTION_EFFECTS[actionId];
  if (effect === undefined) throw new RangeError(`Unknown competition action: ${actionId}`);
  return {
    actionIds: [...state.actionIds, actionId],
    tacticalFit: clamp(state.tacticalFit + effect.tacticalFit),
    managerTrust: clamp(state.managerTrust + effect.managerTrust),
    form: clamp(state.form + effect.form),
    fitness: clamp(state.fitness + effect.fitness),
    morale: clamp(state.morale + effect.morale),
    positionProficiency: clamp(state.positionProficiency + effect.positionProficiency),
  };
}

export function initialCompetitionActionState(definition: CompetitionMatchDefinition): CompetitionActionState {
  return {
    actionIds: [],
    tacticalFit: definition.tacticalFit,
    managerTrust: definition.managerTrust,
    form: definition.form,
    fitness: definition.fitness,
    morale: definition.morale,
    positionProficiency: definition.positionProficiency,
  };
}

export function scoreCompetitionMatch(match: MatchRecord): { score: number; maxScore: number } {
  let evidence = 0;
  switch (match.stats.group) {
    case 'FW':
      evidence = match.stats.goals * 35 + match.stats.assists * 18 + Math.round(match.stats.xgCenti / 10) + match.stats.shots * 2 - match.stats.offsides * 3;
      break;
    case 'MF':
      evidence = match.stats.assists * 18 + match.stats.chancesCreated * 5 + match.stats.progressivePasses * 3 + Math.round(match.stats.passesCompleted / 8) + match.stats.ballRecoveries * 2;
      break;
    case 'DF':
      evidence = match.stats.tackles * 4 + match.stats.interceptions * 5 + match.stats.aerialsWon * 3 + (match.stats.cleanSheet ? 24 : 0) - match.stats.goalsConcededInvolved * 10;
      break;
    case 'GK':
      evidence = match.stats.saves * 6 + Math.round(match.stats.psxgMinusGoalsCenti / 10) + match.stats.crossesClaimed * 3 + match.stats.buildUpPasses + (match.stats.cleanSheet ? 24 : 0);
      break;
  }
  const score = Math.max(0, Math.min(COMPETITION_MAX_SCORE, (match.minutes ?? 0) + (match.ratingTenths ?? 0) + evidence));
  return { score, maxScore: COMPETITION_MAX_SCORE };
}

export type CompetitionMatchResult = {
  match: MatchRecord;
  score: number;
  maxScore: number;
  definition: CompetitionMatchDefinition;
};

function teamAndLeague(ruleset: Ruleset, definition: CompetitionMatchDefinition): { team: Team; league: League } {
  const team = ruleset.teams.find((candidate) => candidate.id === definition.teamId);
  if (team === undefined) throw new RangeError(`Unknown competition team: ${definition.teamId}`);
  const league = findLeague(ruleset, definition.leagueId);
  if (team.leagueId !== league.id) throw new RangeError('Competition team/league mismatch');
  resolveOpponent(ruleset, league, definition.opponentId);
  return { team, league };
}

/** Executes one immutable day definition through the actual shipped match simulation. */
export function playCompetitionMatch(
  ruleset: Ruleset,
  definition: CompetitionMatchDefinition,
  state: CompetitionActionState,
): CompetitionMatchResult {
  const { team, league } = teamAndLeague(ruleset, definition);
  const scheduleEntry: ScheduleEntry = {
    step: 0,
    order: 0,
    competitionId: `competition:${definition.dayKey}`,
    kind: 'LEAGUE',
    round: null,
    opponentId: definition.opponentId,
    home: true,
  };
  const result: PlayMatchResult = playMatch({
    ruleset,
    // The day seed is immutable; the selected, server-validated action sequence is the normal
    // domain input that derives this match's deterministic RNG stream.
    // The day seed is immutable. Choices affect actual selection/performance inputs, never the RNG
    // stream, so a participant cannot turn a tactical decision into a lottery.
    rngState: seedRng(definition.seed),
    seasonIndex: 0,
    matchIndex: 0,
    scheduleEntry,
    team,
    league,
    styleId: definition.styleId,
    playerName: 'Competition player',
    primaryPosition: definition.position,
    baseOvr: definition.baseOvr,
    tacticalFit: state.tacticalFit,
    managerTrust: state.managerTrust,
    form: state.form,
    fitness: state.fitness,
    morale: state.morale,
    positionProficiency: state.positionProficiency,
    squadStatus: 65,
    rolePromise: 'STARTER',
    competitors: [],
    availability: null,
    seasonYellowCount: 0,
    lastRatingTenths: null,
  });
  const score = scoreCompetitionMatch(result.match);
  return { match: result.match, ...score, definition };
}

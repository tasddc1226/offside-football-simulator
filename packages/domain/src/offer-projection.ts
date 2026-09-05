import { buildDefaultManager } from './manager.js';
import { generateCompetitors } from './competitors.js';
import { seedRng } from './rng.js';
import type { Ruleset, Team } from './ruleset.js';
import type { CareerState, SquadRole } from './types.js';
import {
  computeSquadStatus,
  computeTacticalFit,
  familiarityOf,
  findTacticalStyle,
  rankPositionForPlayer,
  squadRoleFromSelection,
} from './selection.js';

/** Versioned stream used only by the 1.1 offer preview and the following season. */
export function seasonSquadSeed(teamId: string, seasonIndex: number): string {
  return `squad:season-team-v1:${teamId}:${seasonIndex}`;
}

export type OfferProjection = Readonly<{
  tacticalFit: number;
  competitorSummary: { rank: number; ovrGap: number };
  projectedRole: SquadRole;
}>;

/**
 * Projects the same ranking that START_SEASON will use for a 1.1 offer.
 * This is deliberately a pure preview: it does not consume the career RNG.
 */
export function projectOfferSelection(input: {
  state: CareerState;
  ruleset: Ruleset;
  team: Team;
  rolePromise: SquadRole;
  seasonIndex: number;
  managerTrust?: number;
}): OfferProjection {
  const profile = input.state.player.profile;
  if (profile === null) throw new RangeError('projectOfferSelection: player.profile is null');
  const style = findTacticalStyle(input.ruleset, input.team.tacticalStyleId);
  const reserved = input.state.nextManager;
  const manager =
    reserved !== null && reserved.id.startsWith(`${input.team.id}-mgr-`)
      ? reserved
      : buildDefaultManager({
          teamId: input.team.id,
          tacticalStyleId: input.team.tacticalStyleId,
          primaryPosition: profile.primaryPosition,
          seasonHistory: input.state.seasonHistory,
          ruleset: input.ruleset,
          timeline: input.state.timeline,
        });
  const previous = input.state.seasonHistory.at(-1);
  const reservedManagerBelongsToTeam =
    reserved !== null && reserved.id.startsWith(`${input.team.id}-mgr-`);
  const managerChanged =
    reservedManagerBelongsToTeam &&
    (reserved!.id !== previous?.result.managerId || previous?.teamId !== input.team.id);
  const tacticalFit = computeTacticalFit(
    input.state.attributes,
    profile.archetypeId,
    profile.primaryPosition,
    style,
    input.ruleset.selectionRules,
    manager.preferredArchetypeIds,
  );
  const managerTrust =
    input.managerTrust ??
    (managerChanged
      ? manager!.trustBase
      : input.state.contract !== null && input.state.contract.teamId === input.team.id
      ? input.state.relationships.managerTrust
        : input.ruleset.transferRules.relationshipCarry.newManagerTrustBase);
  const sameClub =
    (input.state.contract !== null && input.state.contract.teamId === input.team.id) ||
    (input.state.contract === null &&
      input.ruleset.backgrounds.find((candidate) => candidate.id === profile.backgroundId)?.startTeamId === input.team.id);
  const squadStatus = computeSquadStatus(
    { rolePromise: input.rolePromise, captaincy: sameClub ? input.state.captaincy : 'NONE', lastRating: null },
    input.ruleset.selectionRules,
    input.ruleset.contractRules.squadStatusByRole,
  );
  const competitors = generateCompetitors(
    input.ruleset,
    input.team,
    seedRng(seasonSquadSeed(input.team.id, input.seasonIndex)),
  ).competitors;
  const ranking = rankPositionForPlayer({
    ruleset: input.ruleset,
    styleId: input.team.tacticalStyleId,
    position: profile.primaryPosition,
    playerName: profile.name,
    baseOvr: profile.baseOvr,
    tacticalFit,
    managerTrust,
    form: input.state.state.form,
    fitness: input.state.state.fitness,
    morale: input.state.state.morale,
    familiarity: familiarityOf(input.state.context.positionProficiency, input.ruleset.selectionRules),
    squadStatus,
    competitors,
  });
  const player = ranking.candidates.find((candidate) => candidate.id === 'PLAYER');
  if (player === undefined) throw new RangeError('projectOfferSelection: player is absent from ranking');
  const topOvr = competitors
    .filter((candidate) => candidate.position === profile.primaryPosition)
    .reduce((max, candidate) => Math.max(max, candidate.baseOvr), 0);
  return {
    tacticalFit,
    competitorSummary: { rank: player.rank, ovrGap: profile.baseOvr - topOvr },
    projectedRole: squadRoleFromSelection(ranking),
  };
}

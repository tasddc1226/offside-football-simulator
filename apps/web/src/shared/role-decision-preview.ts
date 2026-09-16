import {
  isSquadRoleBetter,
  type CareerState,
  type Position,
  type RoleProposal,
  type Ruleset,
  type SquadRole,
} from '@offside/domain';

export type RoleDecisionOutcomePreview = Readonly<{
  primaryPosition: Position;
  contractRole: SquadRole;
  appearancePromiseMinutesShareBp: number;
  managerTrustDelta: number;
  managerTrustAfter: number;
  /** Proposal-time ranking only. resolveRole re-ranks after trust/context changes. */
  proposalSquadRole: SquadRole | null;
}>;

export type RoleDecisionPreview = Readonly<{
  accept: RoleDecisionOutcomePreview;
  decline: RoleDecisionOutcomePreview;
}>;

function clampedTrustChange(
  current: number,
  configuredDelta: number,
): {
  delta: number;
  after: number;
} {
  const after = Math.max(0, Math.min(100, current + configuredDelta));
  return { delta: after - current, after };
}

/**
 * Build only source-backed choice facts. It deliberately does not invent an appearance count:
 * resolveRole re-ranks the squad after applying the decision, and every match ranks again.
 */
export function buildRoleDecisionPreview(
  state: CareerState,
  ruleset: Ruleset,
  proposal: RoleProposal,
): RoleDecisionPreview {
  const contract = state.contract;
  const profile = state.player.profile;
  if (contract === null || profile === null) {
    throw new RangeError('buildRoleDecisionPreview: role proposal requires contract and profile');
  }

  const roleRules = ruleset.selectionRules.roleProposal;
  const currentTrust = state.relationships.managerTrust;
  const acceptTrust = clampedTrustChange(
    currentTrust,
    proposal.type === 'KEEP' ? roleRules.keepConfirmTrustDelta : roleRules.acceptTrustDelta,
  );
  const downgrade =
    proposal.type === 'ROLE_CHANGE' && isSquadRoleBetter(contract.rolePromise, proposal.to);
  const configuredDeclineDelta =
    downgrade && roleRules.declineDowngradeTrustDelta !== undefined
      ? roleRules.declineDowngradeTrustDelta
      : roleRules.declineTrustDelta;
  const declineTrust = clampedTrustChange(currentTrust, configuredDeclineDelta);

  const acceptedContractRole =
    proposal.type === 'ROLE_CHANGE' && roleRules.acceptedRoleUpdatesPromise === true
      ? proposal.to
      : contract.rolePromise;
  const acceptedMinutesShareBp =
    acceptedContractRole === contract.rolePromise
      ? contract.appearancePromise.minutesShareBp
      : ruleset.contractRules.promiseMinutesShareBp[acceptedContractRole];

  return {
    accept: {
      primaryPosition: proposal.type === 'POSITION_CHANGE' ? proposal.to : profile.primaryPosition,
      contractRole: acceptedContractRole,
      appearancePromiseMinutesShareBp: acceptedMinutesShareBp,
      managerTrustDelta: acceptTrust.delta,
      managerTrustAfter: acceptTrust.after,
      proposalSquadRole:
        proposal.type === 'POSITION_CHANGE'
          ? proposal.squadRoleAfter
          : proposal.type === 'ROLE_CHANGE'
            ? proposal.to
            : proposal.squadRole,
    },
    decline: {
      primaryPosition: profile.primaryPosition,
      contractRole: contract.rolePromise,
      appearancePromiseMinutesShareBp: contract.appearancePromise.minutesShareBp,
      managerTrustDelta: declineTrust.delta,
      managerTrustAfter: declineTrust.after,
      proposalSquadRole: null,
    },
  };
}

export function formatTrustDelta(delta: number): string {
  if (delta === 0) return '변화 없음';
  return `${delta > 0 ? '+' : ''}${delta}`;
}

export function formatPromisePercent(minutesShareBp: number): string {
  return `${minutesShareBp / 100}%`;
}

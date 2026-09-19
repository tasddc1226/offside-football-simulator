import {
  generatePlayerProfile,
  type CareerState,
  type ConfirmedPlayerDraft,
  type Ruleset,
} from '@offside/domain';

/** Preview the exact CONFIRM_PLAYER calculation without advancing the career RNG.
 * Only public starting stats leave this projection; hidden potential stays hidden. */
export function creationCandidates(state: CareerState, ruleset: Ruleset) {
  const draft = state.player.draft;
  if (
    !draft.name ||
    !draft.gender ||
    !draft.nationalityCode ||
    !draft.preferredFoot ||
    !draft.position ||
    !draft.backgroundId
  )
    return [];
  return ruleset.archetypes
    .filter((item) => item.position === draft.position)
    .map((archetype) => {
      const generated = generatePlayerProfile(
        { ...draft, archetypeId: archetype.id } as ConfirmedPlayerDraft,
        ruleset,
        state.rngState,
      );
      return {
        id: archetype.id,
        name: archetype.name,
        description: archetype.summary,
        attributes: generated.attributes,
        ovr: generated.profile.baseOvr,
      };
    });
}

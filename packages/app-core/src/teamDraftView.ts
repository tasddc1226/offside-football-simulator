import type { TeamPlayer, TeamPreset } from '@offside/contracts';
import {
  positionedLayout,
  presetLayout,
  slotRating,
  teamOvr,
  type FormationId,
  type TeamPosition,
} from '@offside/contracts/owner-team';
import { draftLines, pastInSlots, slotsSynergy } from './teamOwner.js';

type TeamDraftInput = {
  formation: FormationId;
  layout: TeamPosition[] | null;
  slots: readonly (string | null)[];
  byId: ReadonlyMap<string, TeamPlayer>;
  season: number;
  editable: boolean;
  // The caller owns preset selection (including an unsaved web preset).
  cupPreset: Pick<TeamPreset, 'slots' | 'ovr' | 'filled'> | null;
};

/** Shared draft calculations only; loading, persistence, clock and UI remain caller-owned. */
export function projectTeamDraft({
  formation,
  layout,
  slots,
  byId,
  season,
  editable,
  cupPreset,
}: TeamDraftInput) {
  const base = layout ?? presetLayout(formation);
  const positions = editable && season > 0 ? positionedLayout(base) : base;
  const slotCodes = positions.map((p) => p.slot);
  const ratings = slotCodes.map((slot, i) => {
    const id = slots[i];
    const player = id ? byId.get(id) : undefined;
    return player ? slotRating(slot, player) : null;
  });
  const ovr = teamOvr(ratings);
  const synergy = slotsSynergy(positions, slots, byId, season);
  const filled = slots.filter((id) => id !== null).length;
  const cupDraft = cupPreset
    ? {
        ovr: cupPreset.ovr ?? 0,
        filled: cupPreset.filled ?? cupPreset.slots.filter(Boolean).length,
        past: pastInSlots(cupPreset.slots, byId, season),
      }
    : { ovr, filled, past: pastInSlots(slots, byId, season) };
  return {
    positions,
    slotCodes,
    ratings,
    ovr,
    synergy,
    lines: draftLines(slotCodes, ratings, synergy, season),
    filled,
    cupDraft,
  };
}

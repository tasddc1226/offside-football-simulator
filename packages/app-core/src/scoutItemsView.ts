import type { OwnerItemsResponse } from '@offside/contracts';
import { REROLL_MILEAGE, scoutPityAt, type ScoutPity } from '@offside/contracts/cup';
import { scoutText as SL } from './i18n/ko/scout';
import { cupText as CL } from './i18n/ko/cup';

export const EMPTY_SCOUT_PITY: ScoutPity = { used: 0, streak: 0, elites: 0 };

/** The same item-load fallback on both clients; adapters decide when to request it. */
export function scoutItemsView(
  result:
    | {
        ok: true;
        data: Pick<OwnerItemsResponse, 'reroll'> &
          Partial<Pick<OwnerItemsResponse, 'scout' | 'pity' | 'mileage'>>;
      }
    | { ok: false },
) {
  return {
    owner: result.ok,
    rerolls: result.ok ? result.data.reroll : 0,
    scouts: result.ok ? (result.data.scout ?? 0) : 0,
    pity: result.ok ? (result.data.pity ?? EMPTY_SCOUT_PITY) : EMPTY_SCOUT_PITY,
    mileage: result.ok ? (result.data.mileage ?? 0) : 0,
  };
}
export function scoutUseFeedback(data: Pick<OwnerItemsResponse, 'scout' | 'scoutMode' | 'pity'>) {
  const n = data.scout;
  const mode = data.scoutMode ?? 'normal';
  const reset = mode === 'normal' && data.pity?.streak === 0;
  return mode === 'elite'
    ? SL.doneElite({ n, elite: scoutPityAt().elite })
    : mode === 'sure'
      ? SL.doneSure({ n })
      : reset
        ? SL.doneReset({ n })
        : SL.done({ n });
}
export const rerollUseFeedback = (data: Pick<OwnerItemsResponse, 'reroll' | 'mileageScout'>) =>
  data.mileageScout
    ? CL.rerollMileageDone({ n: data.reroll, need: REROLL_MILEAGE })
    : CL.rerollDone({ n: data.reroll });

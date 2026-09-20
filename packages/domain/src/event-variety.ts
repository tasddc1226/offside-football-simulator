import type { CareerState, TimelineEntry } from './types.js';
import type { EligibleEvent } from './season.js';

export type EventSelectionRules = {
  version: 'FRESH_WEIGHTED_V1';
  maxEventsPerSeason?: number | undefined;
  repeatCooldownSeasons: number;
  unseenWeightMultiplier: number;
};

/** Preserve candidate order and historical weights unless the new ruleset opts in.
 * Required injury, contract and national-team decisions never pass through this pool.
 * No random roll is consumed here: the existing seeded weighted draw selects the winner.
 */
export function freshEventPool(
  events: readonly EligibleEvent[],
  state: Pick<CareerState, 'timeline' | 'resolvedEventIds'>,
  policy: EventSelectionRules | undefined,
): readonly EligibleEvent[] {
  if (policy === undefined) return events;
  if (policy.maxEventsPerSeason !== undefined) {
    let resolvedThisSeason = 0;
    for (const entry of [...state.timeline].reverse()) {
      if (entry.kind === 'SEASON_STARTED') break;
      if (
        entry.kind === 'EVENT_RESOLVED' &&
        !['EVT-INJ-001', 'EVT-NAT-001'].includes(entry.refId?.split(':')[0] ?? '')
      )
        resolvedThisSeason += 1;
    }
    if (resolvedThisSeason >= policy.maxEventsPerSeason) return [];
  }
  const resolved = new Map<string, number>();
  let seasonsAgo = 0;
  for (let index = state.timeline.length - 1; index >= 0; index -= 1) {
    const entry: TimelineEntry = state.timeline[index]!;
    if (entry.kind === 'SEASON_SETTLED') seasonsAgo += 1;
    if (entry.kind !== 'EVENT_RESOLVED' || entry.refId === null) continue;
    const id = entry.refId.split(':')[0]!;
    if (!resolved.has(id)) resolved.set(id, seasonsAgo);
  }
  return events
    .filter(
      (event) =>
        (resolved.get(event.eventId) ?? policy.repeatCooldownSeasons) >=
        policy.repeatCooldownSeasons,
    )
    .map((event) => ({
      ...event,
      weight:
        event.weight *
        (state.resolvedEventIds.includes(event.eventId) ? 1 : policy.unseenWeightMultiplier),
    }));
}

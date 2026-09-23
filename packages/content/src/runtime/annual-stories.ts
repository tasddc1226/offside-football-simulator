import type { CareerState } from '@offside/domain';
import type { ContentPack } from '../packs/load-content-pack.ts';
import { evaluateCondition } from '../schema/condition.ts';
import { buildConditionContext } from './condition-context.ts';

const OPEN = {
  OPPORTUNITY: 'EVT-DEV-140',
  ROLE_TENSION: 'EVT-MGR-142',
  SCOUT_INTEREST: 'EVT-REL-144',
} as const;
const FOLLOW = {
  OPPORTUNITY: 'EVT-DEV-141',
  ROLE_TENSION: 'EVT-MGR-143',
  SCOUT_INTEREST: 'EVT-REL-145',
} as const;
export function annualStoryCandidates(pack: ContentPack, state: CareerState) {
  if (
    pack.manifest.contentPackVersion !== '0.14.0' ||
    state.season === null ||
    state.pending !== null ||
    state.season.manager === null ||
    state.currentStep < 2 ||
    state.currentStep > 10
  )
    return [];
  const threads = state.annualStories?.threads ?? [];
  const active = threads.find(
    (thread) =>
      thread.stage === 'FOLLOW_UP' &&
      thread.actor.id === state.season!.manager!.id &&
      thread.actor.teamId === state.season!.teamId,
  );
  const step = (state.season.index - 1) * 12 + state.currentStep;
  if (active) {
    const event = pack.eventsById.get(FOLLOW[active.family]);
    return step >= active.dueCareerStep && event
      ? [{ eventId: event.id, version: event.version, weight: event.weight }]
      : [];
  }
  if (threads.some((thread) => thread.sourceSeason === state.season!.index)) return [];
  const context = buildConditionContext(state);
  return Object.entries(OPEN).flatMap(([family, id]) => {
    if (
      threads.some(
        (thread) => thread.family === family && state.season!.index - thread.sourceSeason < 2,
      )
    )
      return [];
    const event = pack.eventsById.get(id);
    if (!event || !evaluateCondition(event.triggers, context)) return [];
    // Relative specialism and current pressure affect which eligible situation wins;
    // there is no minimum overall rating that locks weaker players out of stories.
    const weight =
      event.weight +
      (family === 'OPPORTUNITY'
        ? Math.max(0, state.attributes.stamina - state.attributes.passing)
        : family === 'ROLE_TENSION'
          ? Math.max(0, 65 - state.context.tacticalFit)
          : Math.max(
              0,
              state.season!.playerStats.ratingSumTenths -
                65 * state.season!.playerStats.ratedMatches,
            ));
    return [{ eventId: event.id, version: event.version, weight }];
  });
}

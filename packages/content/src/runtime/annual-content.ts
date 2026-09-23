import type { AnnualContentContext, AnnualChoice, CareerState } from '@offside/domain';
import type { ContentPack } from '../packs/load-content-pack.ts';
import { selectEligibleEvents } from './select-eligible-events.ts';
import { selectChapterCandidates } from './select-chapter-candidates.ts';

/** Canonical registered payloads only: the HTTP client sends a choice id, never outcomes. */
export function buildAnnualContentContext(
  pack: ContentPack,
  state: CareerState,
): AnnualContentContext {
  const context: AnnualContentContext = {
    advance: {
      eligibleEvents: selectEligibleEvents(pack, state),
      chapterCandidates: selectChapterCandidates(pack, state),
    },
  };
  const pending = state.pending;
  if (
    pending?.kind === 'EVENT' ||
    pending?.kind === 'INJURY' ||
    pending?.kind === 'NATIONAL_TEAM'
  ) {
    const event = pack.eventsById.get(pending.eventId);
    if (!event || event.version !== pending.version) return context;
    const activeStory = state.annualStories?.threads.find((thread) => thread.stage === 'FOLLOW_UP');
    const followUp = /^EVT-(DEV|MGR|REL)-14[135]$/.test(event.id) ? activeStory : undefined;
    const minutesSinceSource =
      followUp === undefined
        ? 0
        : state.seasonHistory
            .filter((season) => season.index >= followUp.sourceSeason)
            .reduce((sum, season) => sum + season.result.playerStats.minutes, 0) +
          (state.season !== null && state.season.index >= followUp.sourceSeason
            ? state.season.playerStats.minutes
            : 0) -
          followUp.sourceMinutes;
    const followChoice =
      followUp?.outcome === 'FAIL' ||
      (followUp?.family === 'OPPORTUNITY' && minutesSinceSource <= 0)
        ? 'B'
        : followUp?.choiceId;
    const choices: AnnualChoice[] = event.choices
      .filter(
        (choice) =>
          (followUp === undefined || choice.id === followChoice) &&
          (pending.kind !== 'INJURY' || choice.rehabPlan !== undefined) &&
          (pending.kind !== 'NATIONAL_TEAM' || choice.callUp !== undefined),
      )
      .map((choice) => ({
        id: choice.id,
        label: choice.label,
        risk: choice.riskLabel,
        command: {
          type: 'RESOLVE_EVENT',
          payload: {
            eventId: event.id,
            definitionVersion: event.version,
            choiceId: choice.id,
            outcomes: choice.outcomes.map(({ id, kind, weight, effects, addTags, removeTags }) => ({
              id,
              kind,
              weight,
              effects,
              ...(addTags === undefined ? {} : { addTags }),
              ...(removeTags === undefined ? {} : { removeTags }),
            })),
            ...(pending.kind === 'INJURY' && choice.rehabPlan !== undefined
              ? { rehabPlan: choice.rehabPlan }
              : {}),
            ...(pending.kind === 'NATIONAL_TEAM' && choice.callUp !== undefined
              ? { callUp: choice.callUp }
              : {}),
          },
        },
      }));
    context.pending = {
      title: event.narrative.situation,
      important:
        pending.kind !== 'EVENT' ||
        /^EVT-(CON|ETH)-/.test(event.id) ||
        /^EVT-(DEV|MGR|REL)-14[024]$/.test(event.id),
      choices,
    };
  } else if (pending?.kind === 'CHAPTER') {
    const chapter = pack.chaptersById.get(pending.chapterId);
    const decision = chapter?.decisions[pending.resolved.length];
    if (!chapter || chapter.version !== pending.version || !decision) return context;
    context.pending = {
      title: decision.prompt,
      important: false,
      choices: decision.options.map((option) => ({
        id: option.id,
        label: option.label,
        command: {
          type: 'RESOLVE_CHAPTER',
          payload: {
            chapterId: chapter.id,
            definitionVersion: chapter.version,
            decisionId: decision.id,
            optionId: option.id,
            outcomes: option.outcomes.map(
              ({ id, kind, weight, effects, ratingDeltaTenths, addTags, removeTags }) => ({
                id,
                kind,
                weight,
                effects,
                ratingDeltaTenths,
                ...(addTags === undefined ? {} : { addTags }),
                ...(removeTags === undefined ? {} : { removeTags }),
              }),
            ),
          },
        },
      })),
    };
  }
  return context;
}

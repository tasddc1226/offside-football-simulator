import type { ContentPack } from '../../packages/content/src/packs/load-content-pack.ts';
import { selectChapterCandidates } from '../../packages/content/src/runtime/select-chapter-candidates.ts';
import { selectEligibleEvents } from '../../packages/content/src/runtime/select-eligible-events.ts';
import { sha256Hex } from '../../packages/domain/src/hash.ts';
import type { Command } from '../../packages/domain/src/simulate.ts';
import type { CareerState, DomainSnapshot } from '../../packages/domain/src/types.ts';

/** Stable, seed-derived selection. `count` must describe a non-empty registered choice list. */
export function chooseDeterministicIndex(seed: string, key: string, count: number): number {
  if (!Number.isInteger(count) || count < 1)
    throw new RangeError('choice count must be a positive integer');
  const digest = sha256Hex(`${seed}\u0000${key}`);
  return Number.parseInt(digest.slice(0, 8), 16) % count;
}

function eventCommand(state: CareerState, pack: ContentPack, seed: string): Command | undefined {
  const pending = state.pending;
  if (
    pending === null ||
    (pending.kind !== 'EVENT' && pending.kind !== 'INJURY' && pending.kind !== 'NATIONAL_TEAM')
  ) {
    return undefined;
  }
  const definition = pack.eventsById.get(pending.eventId);
  if (definition === undefined || definition.version !== pending.version) return undefined;
  if (
    (pending.kind === 'INJURY' && definition.presentation !== 'INJURY') ||
    (pending.kind === 'EVENT' && definition.presentation === 'INJURY') ||
    (pending.kind === 'NATIONAL_TEAM' && definition.presentation !== 'NATIONAL_TEAM')
  ) {
    return undefined;
  }
  const choice =
    definition.choices[
      chooseDeterministicIndex(
        seed,
        `${pending.kind}:${pending.eventId}:${pending.version}`,
        definition.choices.length,
      )
    ];
  if (choice === undefined) return undefined;
  if (pending.kind === 'INJURY' && choice.rehabPlan === undefined) return undefined;
  if (pending.kind === 'NATIONAL_TEAM' && choice.callUp === undefined) return undefined;
  return {
    type: 'RESOLVE_EVENT',
    payload: {
      eventId: definition.id,
      definitionVersion: definition.version,
      choiceId: choice.id,
      outcomes: choice.outcomes.map(({ id, kind, weight, effects, addTags, removeTags }) => ({
        id,
        kind,
        weight,
        effects,
        ...(addTags === undefined ? {} : { addTags }),
        ...(removeTags === undefined ? {} : { removeTags }),
      })),
      ...(pending.kind === 'INJURY' ? { rehabPlan: choice.rehabPlan } : {}),
      ...(pending.kind === 'NATIONAL_TEAM' ? { callUp: choice.callUp } : {}),
    },
  } as Command;
}

function chapterCommand(state: CareerState, pack: ContentPack, seed: string): Command | undefined {
  const pending = state.pending;
  if (pending === null || pending.kind !== 'CHAPTER') return undefined;
  const definition = pack.chaptersById.get(pending.chapterId);
  if (definition === undefined || definition.version !== pending.version) return undefined;
  const decision = definition.decisions[pending.resolved.length];
  if (decision === undefined) return undefined;
  const option =
    decision.options[
      chooseDeterministicIndex(
        seed,
        `CHAPTER:${pending.chapterId}:${decision.id}`,
        decision.options.length,
      )
    ];
  if (option === undefined) return undefined;
  return {
    type: 'RESOLVE_CHAPTER',
    payload: {
      chapterId: definition.id,
      definitionVersion: definition.version,
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
  } as Command;
}

/** Return a command only when its pending item has a matching registered definition. */
export function commandForPending(
  state: CareerState,
  pack: ContentPack,
  seed: string,
): Command | undefined {
  return eventCommand(state, pack, seed) ?? chapterCommand(state, pack, seed);
}

/** Build the same content-backed ADVANCE payload used by the web action adapter. */
export function advancePayload(
  stateOrSnapshot: CareerState | DomainSnapshot,
  pack: ContentPack,
): Extract<Command, { type: 'ADVANCE' }>['payload'] | undefined {
  const state = 'revision' in stateOrSnapshot ? stateOrSnapshot.state : stateOrSnapshot;
  if (state.status !== 'ACTIVE' || state.pending !== null) return undefined;
  return {
    eligibleEvents: selectEligibleEvents(pack, state),
    chapterCandidates: selectChapterCandidates(pack, state),
  };
}

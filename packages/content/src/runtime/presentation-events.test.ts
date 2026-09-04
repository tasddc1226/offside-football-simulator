import { describe, expect, it } from 'vitest';
import {
  hashState,
  simulate,
  verifySnapshot,
  type Command,
  type DomainSnapshot,
} from '@offside/domain';
import { type EventDefinition } from '../schema/event.ts';
import { loadContentPack } from '../packs/load-content-pack.ts';
import { loadRuleset } from '../rulesets/load-ruleset.ts';
import { buildTestState } from './build-test-state.ts';

const RULESET_VERSION = '1.0.0';
const CONTENT_PACK_VERSION = '0.2.0';
const PRESENTATION_EVENT_IDS = [
  'EVT-SLUMP-010',
  'EVT-REL-010',
  'EVT-ETH-010',
  'EVT-MEDIA-010',
] as const;

type EngineCommand = Command & { commandId: string; expectedRevision: number };
type ResolveEventPayload = Extract<EngineCommand, { type: 'RESOLVE_EVENT' }>['payload'];

const pack = loadContentPack(CONTENT_PACK_VERSION);
const ruleset = loadRuleset(RULESET_VERSION);

function eventById(eventId: string): EventDefinition {
  const event = pack.eventsById.get(eventId);
  if (event === undefined) throw new Error(`팩에 이벤트 정의가 없다: ${eventId}`);
  return event;
}

function pendingSnapshot(definition: EventDefinition, controversyFailures = 0): DomainSnapshot {
  const state = buildTestState({
    contentPackVersion: CONTENT_PACK_VERSION,
    controversyFailures,
    pending: { kind: 'EVENT', eventId: definition.id, version: definition.version },
  });
  return {
    revision: 1,
    checkpoint: 'EVENT_OFFERED',
    state,
    stateHash: hashState(state),
    rulesetVersion: RULESET_VERSION,
    contentPackVersion: CONTENT_PACK_VERSION,
  };
}

function resolveEventCommand(
  snapshot: DomainSnapshot,
  definition: EventDefinition,
  choiceId: string,
): EngineCommand {
  const choice = definition.choices.find((candidate) => candidate.id === choiceId);
  if (choice === undefined) throw new Error(`이벤트에 choice가 없다: ${definition.id}.${choiceId}`);

  const outcomes: ResolveEventPayload['outcomes'] = choice.outcomes.map((outcome) => {
    const payload: ResolveEventPayload['outcomes'][number] = {
      id: outcome.id,
      kind: outcome.kind,
      weight: outcome.weight,
      effects: outcome.effects,
    };
    if (outcome.addTags !== undefined) payload.addTags = outcome.addTags;
    if (outcome.removeTags !== undefined) payload.removeTags = outcome.removeTags;
    return payload;
  });

  return {
    type: 'RESOLVE_EVENT',
    commandId: `cmd-resolve-${definition.id}-${choiceId}`,
    expectedRevision: snapshot.revision,
    payload: {
      eventId: definition.id,
      definitionVersion: definition.version,
      choiceId,
      outcomes,
    },
  };
}

function resolveChoice(definition: EventDefinition, choiceId: string, controversyFailures = 0) {
  const snapshot = pendingSnapshot(definition, controversyFailures);
  return simulate({
    snapshot,
    command: resolveEventCommand(snapshot, definition, choiceId),
    ruleset,
    rulesetVersion: RULESET_VERSION,
    contentPackVersion: CONTENT_PACK_VERSION,
  });
}

describe('simulate — presentation controversyFailures', () => {
  it.each([
    { eventId: 'EVT-ETH-010', choiceId: 'A', expectedDelta: 0 },
    { eventId: 'EVT-MEDIA-010', choiceId: 'A', expectedDelta: 0 },
    { eventId: 'EVT-ETH-010', choiceId: 'C', expectedDelta: 1 },
    { eventId: 'EVT-MEDIA-010', choiceId: 'C', expectedDelta: 1 },
    { eventId: 'EVT-SLUMP-010', choiceId: 'C', expectedDelta: 0 },
  ])(
    '$eventId $choiceId의 실제 outcome kind에 따라 controversyFailures를 갱신한다',
    ({ eventId, choiceId, expectedDelta }) => {
      const result = resolveChoice(eventById(eventId), choiceId, 7);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.snapshot.state.controversyFailures).toBe(7 + expectedDelta);
      expect(result.snapshot.state.pending).toBeNull();
      expect(result.nextAction).toBe('ADVANCE');
      expect(verifySnapshot(result.snapshot)).toEqual({ ok: true });
    },
  );
});

describe('simulate — 0.2.0 presentation event choices', () => {
  const cases = PRESENTATION_EVENT_IDS.flatMap((eventId) => {
    const definition = eventById(eventId);
    return definition.choices.map((choice) => ({
      eventId,
      presentation: definition.presentation,
      choiceId: choice.id,
    }));
  });

  it.each(cases)(
    '$eventId($presentation) $choiceId를 실제 RESOLVE_EVENT payload로 해소한다',
    ({ eventId, choiceId }) => {
      const result = resolveChoice(eventById(eventId), choiceId);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.snapshot.state.pending).toBeNull();
      expect(result.nextAction).toBe('ADVANCE');
      expect(verifySnapshot(result.snapshot)).toEqual({ ok: true });
    },
  );
});

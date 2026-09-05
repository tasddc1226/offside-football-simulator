import seasonRaw from '../__fixtures__/career-06-settled-season.json';
import { describe, expect, it } from 'vitest';
import { runSettledFixture } from '../__fixtures__/career-06-settled.js';
import { rulesetProto } from '../__fixtures__/career-01.js';
import { hashState } from '../hash.js';
import { initializeNationalityModule } from './nationality.js';
import { careerEventChoices, resolveCareerEvent } from './career-event.js';
import { simulate, type Command } from '../simulate.js';
import type { DomainSnapshot } from '../types.js';
import { createCareerArchiveCore } from './archive.js';
import { createLegacyResult } from './result.js';

const seasonFixture = seasonRaw as { startSeason: { simulationMode: 'FAST'; serviceSeasonId: string }; commands: Array<{ type: Command['type']; payload: unknown }> };

type EngineCommand = Command & { commandId: string; expectedRevision: number };
function run(snapshot: DomainSnapshot, command: EngineCommand): DomainSnapshot {
  const result = simulate({
    snapshot,
    command,
    ruleset: rulesetProto,
    rulesetVersion: snapshot.rulesetVersion,
    contentPackVersion: snapshot.contentPackVersion,
  });
  if (!result.ok) throw new Error(`${command.type} failed: ${result.error.code} ${result.error.message} rev=${snapshot.revision} step=${snapshot.state.season?.steps.at(-1)?.index ?? 'none'} phase=${snapshot.state.season?.phase ?? 'none'}`);
  return result.snapshot;
}

function koreanBoundary(): DomainSnapshot {
  const source = runSettledFixture().snapshot;
  const profile = source.state.player.profile;
  if (profile === null) throw new Error('fixture profile missing');
  const state = {
    ...source.state,
    age: 18,
    player: { ...source.state.player, profile: { ...profile, nationalityCode: 'KR', gender: 'MALE' as const, baseOvr: Math.max(70, profile.baseOvr) } },
    nationalityRuleState: initializeNationalityModule('KR', 'MALE'),
    pending: null,
  };
  return {
    ...source,
    state,
    stateHash: hashState(state),
  };
}

function runOptInSeason(snapshot: DomainSnapshot, id: string): DomainSnapshot {
  let prepared = snapshot;
  for (let close = 0; close < 8 && (prepared.state.pending?.kind === 'OFFERS' || prepared.state.pending?.kind === 'CONTRACT'); close += 1) {
    prepared = run(prepared, { type: 'REJECT_OFFER', payload: { offerId: null }, commandId: `${id}-before-market-${close}`, expectedRevision: prepared.revision } as EngineCommand);
  }
  let next = run(prepared, {
    commandId: `${id}-start`,
    expectedRevision: prepared.revision,
    type: 'START_SEASON',
    payload: { ...seasonFixture.startSeason, legacyLedger: true },
  });
  const advancePayload = seasonFixture.commands.find((command) => command.type === 'ADVANCE')?.payload ?? { eligibleEvents: [] };
  for (let step = 0; step < 150; step += 1) {
    const pending = next.state.pending;
    if (pending?.kind === 'OFFERS' || pending?.kind === 'CONTRACT') {
      next = run(next, { type: 'REJECT_OFFER', payload: { offerId: null }, commandId: `${id}-${step}-market`, expectedRevision: next.revision } as EngineCommand);
    } else if (pending?.kind === 'INJURY') {
      next = run(next, { type: 'RESOLVE_EVENT', payload: { eventId: pending.eventId, definitionVersion: pending.version, choiceId: 'A', outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [] }], rehabPlan: 'STANDARD' }, commandId: `${id}-${step}-injury`, expectedRevision: next.revision } as EngineCommand);
    } else if (pending?.kind === 'NATIONAL_TEAM') {
      next = run(next, { type: 'RESOLVE_EVENT', payload: { eventId: pending.eventId, definitionVersion: pending.version, choiceId: 'C', outcomes: [{ id: 'C1', kind: 'FIXED', weight: 100, effects: [] }], callUp: 'DECLINE' }, commandId: `${id}-${step}-national`, expectedRevision: next.revision } as EngineCommand);
    } else if (pending?.kind === 'ROLE_PROPOSAL') {
      next = run(next, { type: 'RESOLVE_ROLE', payload: { decision: 'ACCEPT' }, commandId: `${id}-${step}-role`, expectedRevision: next.revision } as EngineCommand);
    } else if (pending?.kind === 'EVENT') {
      next = run(next, { type: 'RESOLVE_EVENT', payload: { eventId: pending.eventId, definitionVersion: pending.version, choiceId: 'A', outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [] }] }, commandId: `${id}-${step}-event`, expectedRevision: next.revision } as EngineCommand);
    } else if (pending?.kind === 'SETTLEMENT') {
      next = run(next, { type: 'SETTLE_SEASON', payload: {}, commandId: `${id}-${step}-settle`, expectedRevision: next.revision } as EngineCommand);
      break;
    } else if (pending?.kind === 'LOAN_RETURN') {
      next = run(next, { type: 'LOAN_RETURN', payload: { decision: 'RETURN' }, commandId: `${id}-${step}-loan`, expectedRevision: next.revision } as EngineCommand);
    } else {
      next = run(next, { type: 'ADVANCE', payload: advancePayload, commandId: `${id}-${step}-advance`, expectedRevision: next.revision } as EngineCommand);
    }
  }
  if (next.state.season !== null) throw new Error(`season did not settle: pending=${next.state.pending?.kind ?? 'none'} phase=${next.state.season.phase} step=${next.state.season.steps.at(-1)?.index ?? 'none'}`);
  return next;
}

function retireWithLegacy(snapshot: DomainSnapshot) {
  let current = snapshot;
  if (current.state.pending?.kind === 'OFFERS' || current.state.pending?.kind === 'CONTRACT') current = run(current, { type: 'REJECT_OFFER', payload: { offerId: null }, commandId: 'legacy-close-market', expectedRevision: current.revision } as EngineCommand);
  current = run(current, { type: 'RETIRE', payload: { choice: 'RETIRE' }, commandId: 'legacy-retire', expectedRevision: current.revision } as EngineCommand);
  const context = { binding: { careerId: current.state.careerId, createdServiceSeasonId: 'career-event-test', rulesetVersion: current.rulesetVersion, contentPackVersion: current.contentPackVersion }, artifacts: { rulesetVersion: current.rulesetVersion, contentPackVersion: current.contentPackVersion, rulesetChecksum: 'a'.repeat(64), contentPackChecksum: 'b'.repeat(64) } } as const;
  return { snapshot: current, legacy: createLegacyResult(createCareerArchiveCore(current, context), context) };
}

describe('CAREER_EVENT legacy wiring', () => {
  it('CAREER_BREAK blocks two real fixture seasons, settles zero income, then completes service', () => {
    let snapshot = koreanBoundary();
    expect(careerEventChoices(snapshot.state)).toContain('CAREER_BREAK');
    snapshot = run(snapshot, {
      type: 'CAREER_EVENT', payload: { choice: 'CAREER_BREAK' }, commandId: 'career-break', expectedRevision: snapshot.revision,
    } as EngineCommand);
    expect((snapshot.state.nationalityRuleState as { serviceStatus: string }).serviceStatus).toBe('SERVING');
    snapshot = runOptInSeason(snapshot, 'service-season-1');
    snapshot = runOptInSeason(snapshot, 'service-season-2');
    expect((snapshot.state.nationalityRuleState as { serviceStatus: string }).serviceStatus).toBe('COMPLETED');
    expect(snapshot.state.timeline.some((entry) => entry.kind === 'SERVICE_STARTED')).toBe(true);
    expect(snapshot.state.timeline.some((entry) => entry.kind === 'SERVICE_COMPLETED')).toBe(true);
    const results = snapshot.state.seasonHistory.slice(-2).map((season) => season.result);
    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result?.legacy?.incomeMinor).toBe(0);
      expect(result?.selectionSummary.minutes).toBe(0);
      expect(result?.playerStats.injuries).toBe(0);
    }
    const retired = retireWithLegacy(snapshot);
    expect(retired.legacy.coverage.income).toBe('PARTIAL');
    expect(retired.legacy.incomeMinor).toBe(0);
    expect(retired.legacy.tags).not.toContain('TAG-COMEBACK');
  }, 60_000);

  it('MILITARY_CLUB keeps the player available and international choice is deterministic and U23-gated', () => {
    const source = koreanBoundary();
    expect(careerEventChoices(source.state)).toContain('MILITARY_CLUB');
    const military = resolveCareerEvent(source.state, 'MILITARY_CLUB', 99);
    expect((military.nationalityRuleState as { route: string | null }).route).toBe('MILITARY_CLUB');
    expect(military.timeline.at(-1)?.kind).toBe('SERVICE_STARTED');

    const internationalSource = { ...source, state: { ...source.state, seasonHistory: [...source.state.seasonHistory, source.state.seasonHistory[0]!], nationalityRuleState: initializeNationalityModule('KR', 'MALE') } };
    const first = resolveCareerEvent(internationalSource.state, 'INTERNATIONAL', 99);
    const second = resolveCareerEvent(internationalSource.state, 'INTERNATIONAL', 99);
    expect(first.rngState).toEqual(second.rngState);
    expect(first.legacyEvents?.tournaments[0]?.matches).toHaveLength(6);
    expect(careerEventChoices({ ...internationalSource.state, age: 24 })).not.toContain('INTERNATIONAL');
  });

  it('MILITARY_CLUB real seasons retain minutes and ledger income, while an active injury blocks U23 events', () => {
    let snapshot = run(koreanBoundary(), { type: 'CAREER_EVENT', payload: { choice: 'MILITARY_CLUB' }, commandId: 'military-event', expectedRevision: koreanBoundary().revision } as EngineCommand);
    snapshot = runOptInSeason(snapshot, 'military-season-1');
    snapshot = runOptInSeason(snapshot, 'military-season-2');
    for (const season of snapshot.state.seasonHistory.slice(-2)) {
      expect(season.result.selectionSummary.minutes).toBeGreaterThan(0);
      expect(season.result.legacy?.incomeMinor).toBeGreaterThan(0);
    }
    const injuredState = { ...snapshot.state, pending: { kind: 'INJURY' as const, step: 1, episodeId: 'active-injury', eventId: 'active-injury', version: 1 } };
    expect(careerEventChoices({ ...snapshot, state: injuredState, stateHash: hashState(injuredState) }.state)).toEqual([]);
  }, 60_000);

  it('MENTOR is offered once per season only after age 30 with captaincy threshold', () => {
    const source = koreanBoundary();
    const state = { ...source.state, age: 30, relationships: { ...source.state.relationships, captain: 50 } };
    expect(careerEventChoices(state)).toContain('MENTOR');
    const mentored = resolveCareerEvent(state, 'MENTOR', 100);
    expect(mentored.legacyEvents?.mentoredSeasonIndices).toContain(state.seasonHistory.length);
    expect(mentored.tags).toContain(`MENTOR_SUCCESS:${state.seasonHistory.length}`);
    expect(careerEventChoices({ ...mentored, age: 30 })).not.toContain('MENTOR');
  });

  it('three real mentor seasons produce the retirement MENTOR tag', () => {
    let snapshot = koreanBoundary();
    for (let index = 0; index < 3; index += 1) {
      if (snapshot.state.pending?.kind === 'OFFERS' || snapshot.state.pending?.kind === 'CONTRACT') snapshot = run(snapshot, { type: 'REJECT_OFFER', payload: { offerId: null }, commandId: `mentor-close-${index}`, expectedRevision: snapshot.revision } as EngineCommand);
      const state = { ...snapshot.state, age: Math.max(30, snapshot.state.age), relationships: { ...snapshot.state.relationships, captain: 50 } };
      snapshot = { ...snapshot, state, stateHash: hashState(state) };
      snapshot = run(snapshot, { type: 'CAREER_EVENT', payload: { choice: 'MENTOR' }, commandId: `mentor-${index}`, expectedRevision: snapshot.revision } as EngineCommand);
      snapshot = runOptInSeason(snapshot, `mentor-season-${index}`);
    }
    const retired = retireWithLegacy(snapshot);
    expect(retired.legacy.tags).toContain('TAG-MENTOR');
  }, 60_000);

  it('rejects ordinary commands after explicit retirement', () => {
    let snapshot = runSettledFixture().snapshot;
    // The settled fixture retains a pending market decision; close it before the terminal command.
    if (snapshot.state.pending?.kind === 'OFFERS' || snapshot.state.pending?.kind === 'CONTRACT') {
      snapshot = run(snapshot, { type: 'REJECT_OFFER', payload: { offerId: null }, commandId: 'close-market', expectedRevision: snapshot.revision } as EngineCommand);
    }
    snapshot = run(snapshot, { type: 'RETIRE', payload: { choice: 'RETIRE' }, commandId: 'retire', expectedRevision: snapshot.revision } as EngineCommand);
    const result = simulate({ snapshot, command: { type: 'ADVANCE', payload: { eligibleEvents: [] }, commandId: 'after-retire', expectedRevision: snapshot.revision } as EngineCommand, ruleset: rulesetProto, rulesetVersion: snapshot.rulesetVersion, contentPackVersion: snapshot.contentPackVersion });
    expect(result.ok).toBe(false);
  });
});

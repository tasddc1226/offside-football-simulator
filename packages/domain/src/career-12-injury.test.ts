import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-12-injury.golden.json';
import { careerInjuryFixture, runInjuryFixture } from './__fixtures__/career-12-injury.js';
import { runCareerFixture, rulesetProto } from './__fixtures__/career-01.js';
import { applyCondition } from './condition.js';
import { hashState } from './hash.js';
import { computeBaseOvr } from './player.js';
import { simulate, verifySnapshot, type Command } from './simulate.js';
import type { DomainSnapshot } from './types.js';
import type { Ruleset } from './ruleset.js';

function runCommand(
  snapshot: DomainSnapshot,
  command: Omit<Command, 'commandId' | 'expectedRevision'>,
  ruleset: Ruleset = rulesetProto,
): DomainSnapshot {
  const result = simulate({
    snapshot,
    command: { ...command, commandId: `career12-timing-${snapshot.revision}`, expectedRevision: snapshot.revision } as Command & {
      commandId: string;
      expectedRevision: number;
    },
    ruleset,
    rulesetVersion: careerInjuryFixture.rulesetVersion,
    contentPackVersion: careerInjuryFixture.contentPackVersion,
  });
  if (!result.ok) throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  return result.snapshot;
}

describe('career-12-injury fixture — 실제 중증→재활→회복→재발 golden', () => {
  it('golden revision/hash/rng draws와 정확히 일치한다', () => {
    const { snapshot } = runInjuryFixture();
    expect(snapshot.revision).toBe(golden.revision);
    expect(snapshot.stateHash).toBe(golden.stateHash);
    expect(snapshot.state.rngState.draws).toBe(golden.rngStateDraws);
    expect(snapshot.state.age).toBe(golden.age);
    expect(snapshot.state.seasonHistory).toHaveLength(golden.seasonHistoryLength);
    // Step 5 is the production fixture's forced INJURY-only step: its RESOLVE_EVENT decision must
    // survive same-step resumption and be reflected in the eventual SeasonResult exactly once.
    expect(snapshot.state.seasonHistory[0]?.result.stepSummaries.find((summary) => summary.step === 5)?.decisionsOpened).toBe(1);
    // Step 7 has the second forced injury followed by a normal market decision, so the aggregate is
    // forced(1) + normal(1), without counting either side twice.
    expect(snapshot.state.seasonHistory[0]?.result.stepSummaries.find((summary) => summary.step === 7)?.decisionsOpened).toBe(2);
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  it('초기 중증 episode가 재활·회복되고 같은 부위 MAJOR 재발과 즉시 후유증을 남긴다', () => {
    const { snapshot } = runInjuryFixture();
    expect(snapshot.state.health.episodes).toEqual(golden.episodes);
    expect(snapshot.state.health.episodes[0]?.severity).toBe('MODERATE');
    expect(snapshot.state.health.episodes[0]?.status).toBe('RECURRED');
    expect(snapshot.state.health.episodes[1]?.severity).toBe('MAJOR');
    expect(snapshot.state.health.episodes[1]?.bodyPart).toBe(snapshot.state.health.episodes[0]?.bodyPart);
    expect(snapshot.state.timeline.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining(['INJURED', 'RECOVERED', 'INJURY_RECURRED']),
    );
  });

  it('같은 fixture를 반복 실행해도 state hash가 같다', () => {
    const first = runInjuryFixture().snapshot;
    const second = runInjuryFixture().snapshot;
    expect(second.stateHash).toBe(first.stateHash);
  });

  it('한 step의 첫 forced injury 직후 멈추고, RESOLVE_EVENT 뒤 미실행 경기만 재개한다', () => {
    let snapshot = runCareerFixture(careerInjuryFixture);
    snapshot = runCommand(snapshot, {
      type: 'START_SEASON',
      payload: { simulationMode: 'FAST', serviceSeasonId: 'svc-injury-12-timing' },
    });
    snapshot = runCommand(snapshot, { type: 'RESOLVE_ROLE', payload: { decision: 'ACCEPT' } });

    const firstPending = runCommand(snapshot, { type: 'ADVANCE', payload: { eligibleEvents: [] } });
    const firstSeason = firstPending.state.season!;
    const pending = firstPending.state.pending;
    expect(pending?.kind).toBe('INJURY');
    if (pending?.kind !== 'INJURY') return;

    const stepEntries = firstSeason.schedule.filter((entry) => entry.step === pending.step && entry.skipped === undefined);
    const stepMatches = firstSeason.matches.filter((match) => match.step === pending.step);
    expect(stepEntries.length).toBeGreaterThan(1);
    // The first candidate is recorded, but later matches in the same step are not simulated before diagnosis.
    expect(stepMatches).toHaveLength(1);
    expect(stepMatches[0]?.id).toBe(`${firstSeason.index}-${stepEntries[0]!.step}-${stepEntries[0]!.order}`);
    expect(firstSeason.steps.find((step) => step.index === pending.step)?.summary).toBeNull();
    const activeEpisode = firstPending.state.health.episodes.find((episode) => episode.id === pending.episodeId)!;
    expect(firstSeason.availability).toMatchObject({ kind: 'INJURY', matchesRemaining: activeEpisode.remainingMatches });

    const resolved = runCommand(firstPending, {
      type: 'RESOLVE_EVENT',
      payload: {
        eventId: pending.eventId,
        definitionVersion: pending.version,
        choiceId: 'A',
        rehabPlan: 'STANDARD',
        outcomes: [{ id: 'A1', weight: 100, effects: [] }],
      },
    });
    const firstMatchBeforeResume = resolved.state.season!.matches.find((match) => match.id === stepMatches[0]!.id);
    const resumed = runCommand(resolved, { type: 'ADVANCE', payload: { eligibleEvents: [] } });
    const resumedSeason = resumed.state.season!;
    const resumedStepMatches = resumedSeason.matches.filter((match) => match.step === pending.step);
    const expectedIds = resumedSeason.schedule
      .filter((entry) => entry.step === pending.step && entry.skipped === undefined)
      .map((entry) => `${resumedSeason.index}-${entry.step}-${entry.order}`);
    expect(resumedStepMatches.map((match) => match.id)).toEqual(expectedIds);
    expect(new Set(resumedStepMatches.map((match) => match.id)).size).toBe(resumedStepMatches.length);
    expect(resumedSeason.matches.find((match) => match.id === stepMatches[0]!.id)).toEqual(firstMatchBeforeResume);
    expect(resumed.revision).toBe(resolved.revision + 1);
    expect(resumed.state.rngState.draws).toBe(resolved.state.rngState.draws);
    expect(resumedSeason.steps.find((step) => step.index === pending.step)?.summary?.decisionsOpened).toBe(1);
  });

  it('복수 경기 step의 재개는 duration·condition·match RNG를 이어서 적용하고 일반 slot은 그 뒤에 연다', () => {
    // First reach the production fixture's forced pending with the unmodified ruleset. Only then clone
    // the current pending step for this timing test, so the added deterministic EVENT cannot alter the
    // injury occurrence, profile selection, or match RNG that produced the pending snapshot.
    let snapshot = runCareerFixture(careerInjuryFixture);
    snapshot = runCommand(snapshot, {
      type: 'START_SEASON',
      payload: { simulationMode: 'FAST', serviceSeasonId: 'svc-injury-12-resume-evidence' },
    });
    snapshot = runCommand(snapshot, { type: 'RESOLVE_ROLE', payload: { decision: 'ACCEPT' } });
    const productionPending = runCommand(snapshot, { type: 'ADVANCE', payload: { eligibleEvents: [] } });
    const productionSeason = productionPending.state.season!;
    const pending = productionPending.state.pending;
    expect(pending?.kind).toBe('INJURY');
    if (pending?.kind !== 'INJURY') return;

    const timingRuleset: Ruleset = {
      ...rulesetProto,
      leagueCalendar: {
        ...rulesetProto.leagueCalendar,
        steps: rulesetProto.leagueCalendar.steps.map((step) =>
          step.index === pending.step ? { ...step, slots: [...step.slots, { kind: 'EVENT' as const, required: true }] } : step,
        ),
      },
    };
    // The engine stores the built steps in FootballSeason, so mirror the cloned calendar only on this
    // test snapshot as well. `required:true` makes the EVENT eligible in FAST without changing production
    // mode or any match decision; its presence guarantees the resumed walk stops on this same step.
    const timingState: DomainSnapshot['state'] = {
      ...productionPending.state,
      season: {
        ...productionSeason,
        steps: productionSeason.steps.map((step) =>
          step.index === pending.step ? { ...step, decisionSlots: [...step.decisionSlots, { kind: 'EVENT' as const, required: true }] } : step,
        ),
      },
    };
    const firstPending: DomainSnapshot = { ...productionPending, state: timingState, stateHash: hashState(timingState) };
    const firstSeason = firstPending.state.season!;
    const conditionBeforeInterruptedStep = firstPending.state.state;
    // The test-only calendar clone must not rewrite the production pending snapshot. In particular,
    // earlier no-decision steps are already reflected, while the interrupted step itself is not.
    expect(firstPending.state.state).toEqual(productionPending.state.state);
    expect(firstPending.state.season!.matches).toEqual(productionSeason.matches);
    expect(firstPending.state.season!.availability).toEqual(productionSeason.availability);
    expect(firstPending.state.season!.matchRngState).toEqual(productionSeason.matchRngState);
    expect(firstPending.state.rngState).toEqual(productionPending.state.rngState);
    const firstStep = pending.step;
    const firstStepEntries = firstSeason.schedule.filter((entry) => entry.step === firstStep && entry.skipped === undefined);
    expect(firstStepEntries.length).toBeGreaterThan(1);
    expect(firstSeason.matches.filter((match) => match.step === firstStep)).toHaveLength(1);
    const firstEpisode = firstPending.state.health.episodes.find((episode) => episode.id === pending.episodeId)!;
    expect(firstEpisode.remainingMatches).toBe(
      productionPending.state.health.episodes.find((episode) => episode.id === pending.episodeId)?.remainingMatches,
    );
    expect(firstEpisode.remainingMatches).toBe(firstSeason.availability?.kind === 'INJURY' ? firstSeason.availability.matchesRemaining : -1);
    const matchRngAfterFirst = firstSeason.matchRngState;

    const resolved = runCommand(firstPending, {
      type: 'RESOLVE_EVENT',
      payload: {
        eventId: pending.eventId,
        definitionVersion: pending.version,
        choiceId: 'A',
        rehabPlan: 'STANDARD',
        outcomes: [{ id: 'A1', weight: 100, effects: [] }],
      },
    }, timingRuleset);
    expect(resolved.state.season!.matchRngState).toEqual(matchRngAfterFirst);
    const selectedDuration = resolved.state.health.episodes.find((episode) => episode.id === pending.episodeId)!.remainingMatches!;
    expect(selectedDuration).toBe(4);

    // The cloned required EVENT slot makes the resumed walk stop immediately after the remaining
    // same-step matches, exposing the exact post-resume availability and condition.
    const resumed = runCommand(resolved, {
      type: 'ADVANCE',
      payload: { eligibleEvents: [{ eventId: 'EVT-TIMING-GENERAL', version: 1, weight: 100 }] },
    }, timingRuleset);
    const resumedSeason = resumed.state.season!;
    const resumedStepMatches = resumedSeason.matches.filter((match) => match.step === firstStep);
    expect(resumedStepMatches).toHaveLength(firstStepEntries.length);
    expect(resumedSeason.availability).toMatchObject({
      kind: 'INJURY',
      matchesRemaining: selectedDuration - (firstStepEntries.length - 1),
      sinceMatchId: firstSeason.matches.filter((match) => match.step === firstStep)[0]!.id,
    });
    expect(resumed.state.health.episodes.find((episode) => episode.id === pending.episodeId)?.remainingMatches).toBe(
      selectedDuration - (firstStepEntries.length - 1),
    );
    const conditionAfterOneApplication = applyCondition(
      conditionBeforeInterruptedStep,
      resumedStepMatches,
      rulesetProto.conditionRules,
      rulesetProto.seasonBoundaryReset.form,
    );
    const conditionAfterTwoApplications = applyCondition(
      conditionAfterOneApplication,
      resumedStepMatches,
      rulesetProto.conditionRules,
      rulesetProto.seasonBoundaryReset.form,
    );
    expect(resumed.state.state).toEqual(conditionAfterOneApplication);
    expect(resumed.state.state).not.toEqual(conditionAfterTwoApplications);
    expect(resumedSeason.matchRngState.draws - resolved.state.season!.matchRngState.draws).toBeGreaterThan(0);
    expect(resumed.state.pending?.kind).toBe('EVENT');
    expect(resumedSeason.steps.find((step) => step.index === firstStep)?.summary).toBeNull();

    // Replaying the continuation from the same post-RESOLVE snapshot is byte-identical: no reset or duplicate
    // match RNG consumption is hidden behind the transient resume adapter.
    const resumedAgain = runCommand(resolved, {
      type: 'ADVANCE',
      payload: { eligibleEvents: [{ eventId: 'EVT-TIMING-GENERAL', version: 1, weight: 100 }] },
    }, timingRuleset);
    expect(resumedAgain.state.season!.matches).toEqual(resumedSeason.matches);
    expect(resumedAgain.state.season!.matchRngState).toEqual(resumedSeason.matchRngState);

    const eventPending = resumed.state.pending;
    if (eventPending?.kind !== 'EVENT') return;
    const afterEvent = runCommand(resumed, {
      type: 'RESOLVE_EVENT',
      payload: {
        eventId: eventPending.eventId,
        definitionVersion: eventPending.version,
        choiceId: 'A',
        outcomes: [{ id: 'A1', weight: 100, effects: [] }],
      },
    }, timingRuleset);
    const afterStepClose = runCommand(afterEvent, { type: 'ADVANCE', payload: { eligibleEvents: [] } }, timingRuleset);
    expect(afterStepClose.state.season!.steps.find((step) => step.index === firstStep)?.summary?.decisionsOpened).toBe(2);
  });

  it('시즌 경계 active injury는 remainingMatches를 carry해 두 경기 후 회복·재발 창을 연다', () => {
    const settled = runInjuryFixture().snapshot;
    const contracted = runCareerFixture(careerInjuryFixture).state;
    const carriedEpisode = {
      id: 'INJ-1-11-carry',
      severity: 'MAJOR' as const,
      bodyPart: 'KNEE' as const,
      occurredAt: { seasonIndex: 1, step: 11, matchId: '1-11-1' },
      diagnosisRange: { minMatches: 7, maxMatches: 14 },
      rehab: 'STANDARD' as const,
      recurrenceRiskBp: 0,
      recurrenceChecksRemaining: 0,
      status: 'REHAB' as const,
      permanentDelta: null,
      remainingMatches: 2,
    };
    const carryState: DomainSnapshot['state'] = {
      ...settled.state,
      contract: contracted.contract,
      season: null,
      pending: null,
      health: { episodes: [carriedEpisode] },
    };
    const carrySnapshot: DomainSnapshot = { ...settled, state: carryState, stateHash: hashState(carryState) };
    expect(verifySnapshot(carrySnapshot)).toEqual({ ok: true });

    const carryRuleset: Ruleset = {
      ...rulesetProto,
      leagueCalendar: {
        ...rulesetProto.leagueCalendar,
        steps: rulesetProto.leagueCalendar.steps.map((step) =>
          step.index === 3 ? { ...step, slots: [...step.slots, { kind: 'EVENT' as const, required: true }] } : step,
        ),
      },
    };

    let started = runCommand(carrySnapshot, {
      type: 'START_SEASON',
      payload: { simulationMode: 'FAST', serviceSeasonId: 'svc-injury-12-carry' },
    }, carryRuleset);
    const startedSeason = started.state.season!;
    expect(startedSeason.index).toBe(2);
    expect(startedSeason.matches).toHaveLength(0);
    expect(startedSeason.availability).toEqual({ kind: 'INJURY', matchesRemaining: 2, sinceMatchId: '1-11-1' });
    expect(started.state.health.episodes[0]?.remainingMatches).toBe(2);
    expect(startedSeason.steps.find((step) => step.index === 3)?.decisionSlots).toContainEqual({ kind: 'EVENT', required: true });
    expect(started.state.health.episodes[0]?.status).toBe('REHAB');
    expect(started.state.health.episodes[0]?.permanentDelta).toBeNull();

    const rolePending = started.state.pending;
    expect(rolePending?.kind).toBe('ROLE_PROPOSAL');
    started = runCommand(started, { type: 'RESOLVE_ROLE', payload: { decision: 'ACCEPT' } }, carryRuleset);
    // The test-only required EVENT is after step 3's matches, so the walk stops immediately after
    // the two carried absences and the first actual return check (one deterministic failed roll).
    const resumed = runCommand(started, {
      type: 'ADVANCE',
      payload: { eligibleEvents: [{ eventId: 'EVT-CARRY-EVIDENCE', version: 1, weight: 100 }] },
    }, carryRuleset);
    const resumedSeason = resumed.state.season!;
    const injuryAbsences = resumedSeason.matches.filter((match) => match.outReason === 'INJURY');
    expect(injuryAbsences).toHaveLength(2);
    expect(injuryAbsences.map((match) => match.minutes)).toEqual([0, 0]);
    expect(resumed.state.health.episodes[0]).toMatchObject({
      status: 'RECOVERED',
      recurrenceChecksRemaining: rulesetProto.injuryRules.recurrenceWindowMatches - 1,
      permanentDelta: [{ key: 'durability', delta: -1 }],
    });
    expect(resumed.state.health.episodes[0]?.remainingMatches).toBeUndefined();
    expect(resumed.state.attributes.durability).toBe(settled.state.attributes.durability - 1);
    const archetype = carryRuleset.archetypes.find((candidate) => candidate.id === resumed.state.player.profile?.archetypeId)!;
    expect(resumed.state.player.profile?.baseOvr).toBe(computeBaseOvr(resumed.state.attributes, archetype.roleWeights));
    expect(resumed.state.season?.availability).toBeNull();
    expect(resumed.state.pending).toMatchObject({ kind: 'EVENT', eventId: 'EVT-CARRY-EVIDENCE' });
    expect(resumedSeason.steps.find((step) => step.index === 3)?.summary).toBeNull();
    expect(resumed.state.season?.matches.find((match) => match.outReason === null && match.minutes > 0)).toBeDefined();
    expect(verifySnapshot(resumed)).toEqual({ ok: true });
  });
});

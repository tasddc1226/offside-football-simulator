import { describe, expect, it } from 'vitest';
import seasonRaw from '../__fixtures__/career-06-settled-season.json';
import { runSettledFixture } from '../__fixtures__/career-06-settled.js';
import { rulesetProto } from '../__fixtures__/career-01.js';
import { hashState } from '../hash.js';
import { simulate } from '../simulate.js';
import {
  assessCareerRetirement,
  retirementContinuationOptions,
  retirementDecisionRequired,
  RETIREMENT_POLICY,
} from './career-retirement.js';
import { careerEventChoices } from './career-event.js';
import { initializeNationalityModule, resolveNationalityChoice } from './nationality.js';
import type { DomainSnapshot } from '../types.js';
import type { Command } from '../simulate.js';

const seasonFixture = seasonRaw as {
  startSeason: { simulationMode: 'FAST'; serviceSeasonId: string };
  commands: Array<{ type: Command['type']; payload: unknown }>;
};
type EngineCommand = Command & { commandId: string; expectedRevision: number };

function runSeason(snapshot: DomainSnapshot): DomainSnapshot {
  let current = snapshot;
  for (let n = 0; n < 150; n += 1) {
    const pending = current.state.pending;
    let command: EngineCommand;
    if (pending?.kind === 'OFFERS' || pending?.kind === 'CONTRACT')
      command = {
        type: 'REJECT_OFFER',
        payload: { offerId: null },
        commandId: `retirement-season-${n}-market`,
        expectedRevision: current.revision,
      } as EngineCommand;
    else if (pending?.kind === 'INJURY')
      command = {
        type: 'RESOLVE_EVENT',
        payload: {
          eventId: pending.eventId,
          definitionVersion: pending.version,
          choiceId: 'A',
          outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [] }],
          rehabPlan: 'STANDARD',
        },
        commandId: `retirement-season-${n}-injury`,
        expectedRevision: current.revision,
      } as EngineCommand;
    else if (pending?.kind === 'NATIONAL_TEAM')
      command = {
        type: 'RESOLVE_EVENT',
        payload: {
          eventId: pending.eventId,
          definitionVersion: pending.version,
          choiceId: 'C',
          outcomes: [{ id: 'C1', kind: 'FIXED', weight: 100, effects: [] }],
          callUp: 'DECLINE',
        },
        commandId: `retirement-season-${n}-national`,
        expectedRevision: current.revision,
      } as EngineCommand;
    else if (pending?.kind === 'ROLE_PROPOSAL')
      command = {
        type: 'RESOLVE_ROLE',
        payload: { decision: 'ACCEPT' },
        commandId: `retirement-season-${n}-role`,
        expectedRevision: current.revision,
      } as EngineCommand;
    else if (pending?.kind === 'EVENT')
      command = {
        type: 'RESOLVE_EVENT',
        payload: {
          eventId: pending.eventId,
          definitionVersion: pending.version,
          choiceId: 'A',
          outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [] }],
        },
        commandId: `retirement-season-${n}-event`,
        expectedRevision: current.revision,
      } as EngineCommand;
    else if (pending?.kind === 'SETTLEMENT')
      command = {
        type: 'SETTLE_SEASON',
        payload: {},
        commandId: `retirement-season-${n}-settle`,
        expectedRevision: current.revision,
      } as EngineCommand;
    else
      command = {
        type: 'ADVANCE',
        payload: seasonFixture.commands.find((item) => item.type === 'ADVANCE')?.payload ?? {
          eligibleEvents: [],
        },
        commandId: `retirement-season-${n}-advance`,
        expectedRevision: current.revision,
      } as EngineCommand;
    const result = simulate({
      snapshot: current,
      command,
      ruleset: rulesetProto,
      rulesetVersion: current.rulesetVersion,
      contentPackVersion: current.contentPackVersion,
    });
    if (!result.ok)
      throw new Error(
        `${command.type} failed: ${result.error.message}; pending=${current.state.pending?.kind ?? 'none'}`,
      );
    current = result.snapshot;
    if (current.state.season === null && n > 0) return current;
  }
  throw new Error('retirement continuation season did not settle');
}

function singleOfferBoundary(): DomainSnapshot {
  const source = runSettledFixture().snapshot;
  if (source.state.pending?.kind !== 'OFFERS' || source.state.pending.offers[0] === undefined) {
    throw new Error(
      `fixture must expose OFFERS at retirement boundary; pending=${source.state.pending?.kind ?? 'none'}`,
    );
  }
  const state = {
    ...source.state,
    pending: {
      ...source.state.pending,
      offers: [{ ...source.state.pending.offers[0], lengthSeasons: 1 }],
    },
    retirement: {
      policyVersion: '1.0.0' as const,
      marketOffers: 1,
      lastChanceConsumed: false,
      lastChanceSeasonIndex: null,
    },
  };
  return { ...source, state, stateHash: hashState(state) };
}

function retireContinuation(snapshot: DomainSnapshot) {
  const option = retirementContinuationOptions(snapshot.state)[0];
  if (option === undefined) throw new Error('fixture offer is not eligible for continuation');
  const result = simulate({
    snapshot,
    command: {
      type: 'RETIRE',
      commandId: `last-chance-${option.offerId}`,
      expectedRevision: snapshot.revision,
      payload: { choice: option.choice, offerId: option.offerId },
    },
    ruleset: rulesetProto,
    rulesetVersion: snapshot.rulesetVersion,
    contentPackVersion: snapshot.contentPackVersion,
  });
  if (!result.ok)
    throw new Error(`continuation failed: ${result.error.code} ${result.error.message}`);
  return { option, snapshot: result.snapshot };
}

describe('career retirement continuation', () => {
  it('accepts an eligible one-season offer through the available continuation selection', () => {
    const prepared = singleOfferBoundary();
    const { option, snapshot } = retireContinuation(prepared);
    expect(['LAST_CONTRACT', 'LOWER_LEAGUE']).toContain(option.choice);
    expect(snapshot.state.status).toBe('ACTIVE');
    expect(snapshot.checkpoint).not.toBe('RETIREMENT');
    expect(snapshot.checkpoint).toBe('CONTRACT_CONFIRMED');
    expect(snapshot.state.contract).not.toBeNull();
    expect(snapshot.state.retirement).toMatchObject({
      lastChanceConsumed: true,
      lastChanceSeasonIndex: prepared.state.seasonHistory.length + 1,
    });
    expect(snapshot.state.pending).toBeNull();
  });

  it('allows the granted season, then requires a decision at the target boundary and rejects reuse', () => {
    const prepared = singleOfferBoundary();
    const { snapshot } = retireContinuation(prepared);
    expect(retirementDecisionRequired(snapshot.state)).toBe(false);
    const nextStart = simulate({
      snapshot,
      command: {
        type: 'START_SEASON',
        commandId: 'last-chance-start',
        expectedRevision: snapshot.revision,
        payload: { simulationMode: 'FAST', serviceSeasonId: 'last-chance-season' },
      },
      ruleset: rulesetProto,
      rulesetVersion: snapshot.rulesetVersion,
      contentPackVersion: snapshot.contentPackVersion,
    });
    expect(nextStart.ok).toBe(true);
    const finished = runSeason(nextStart.ok ? nextStart.snapshot : snapshot);
    expect(finished.state.seasonHistory.length).toBe(snapshot.state.seasonHistory.length + 1);
    expect(retirementDecisionRequired(finished.state)).toBe(true);
    const blocked = simulate({
      snapshot: finished,
      command: {
        type: 'START_SEASON',
        commandId: 'retirement-blocked',
        expectedRevision: finished.revision,
        payload: { simulationMode: 'FAST', serviceSeasonId: 'blocked' },
      },
      ruleset: rulesetProto,
      rulesetVersion: finished.rulesetVersion,
      contentPackVersion: finished.contentPackVersion,
    });
    expect(blocked).toMatchObject({
      ok: false,
      error: { details: { reason: 'RETIREMENT_DECISION_REQUIRED' } },
    });
    const reused = retirementContinuationOptions(snapshot.state);
    expect(reused).toHaveLength(0);
  });

  it('does not offer a two-season service route after a one-season last chance is consumed', () => {
    const prepared = singleOfferBoundary();
    const { snapshot } = retireContinuation(prepared);
    const state = {
      ...snapshot.state,
      age: 18,
      nationalityRuleState: initializeNationalityModule('KR', 'MALE'),
    };
    expect(retirementDecisionRequired(state)).toBe(false);
    expect(careerEventChoices(state)).not.toContain('CAREER_BREAK');
    expect(careerEventChoices(state)).not.toContain('MILITARY_CLUB');
  });

  it('keeps the promised last-chance season available before its target despite high pressure', () => {
    const prepared = singleOfferBoundary();
    const { snapshot } = retireContinuation(prepared);
    const highPressure = { ...snapshot.state, age: 38 };
    expect(retirementDecisionRequired(highPressure)).toBe(false);
  });

  it('removes all CAREER_EVENT choices once the explicit last-chance target is reached', () => {
    const prepared = singleOfferBoundary();
    const { snapshot } = retireContinuation(prepared);
    const started = simulate({
      snapshot,
      command: {
        type: 'START_SEASON',
        commandId: 'target-season-start',
        expectedRevision: snapshot.revision,
        payload: { simulationMode: 'FAST', serviceSeasonId: 'target-season' },
      },
      ruleset: rulesetProto,
      rulesetVersion: snapshot.rulesetVersion,
      contentPackVersion: snapshot.contentPackVersion,
    });
    expect(started.ok).toBe(true);
    const finished = runSeason(started.ok ? started.snapshot : snapshot);
    const targetState = {
      ...finished.state,
      pending: null,
    };
    expect(retirementDecisionRequired(targetState)).toBe(true);
    expect(careerEventChoices(targetState)).toEqual([]);
  });

  it('does not force a high-pressure retirement review while CAREER_BREAK service is serving', () => {
    const source = runSettledFixture().snapshot;
    const service = resolveNationalityChoice(
      initializeNationalityModule('KR', 'MALE'),
      'CAREER_BREAK',
      0,
    );
    const state = {
      ...source.state,
      age: 38,
      nationalityRuleState: service,
      retirement: {
        policyVersion: '1.0.0' as const,
        marketOffers: 0,
        lastChanceConsumed: false,
        lastChanceSeasonIndex: null,
      },
    };
    expect(retirementDecisionRequired(state)).toBe(false);
  });

  it('does not expose one-season continuation offers while two-season service is serving', () => {
    const source = runSettledFixture().snapshot;
    const service = resolveNationalityChoice(
      initializeNationalityModule('KR', 'MALE'),
      'CAREER_BREAK',
      0,
    );
    const pending = source.state.pending;
    if (pending?.kind !== 'OFFERS') throw new Error('fixture must expose offers');
    const state = {
      ...source.state,
      nationalityRuleState: service,
      pending: { ...pending, offers: [{ ...pending.offers[0]!, lengthSeasons: 1 }] },
    };
    expect(retirementContinuationOptions(state)).toEqual([]);
  });

  it('does not infer review from age alone or absent market evidence', () => {
    const source = runSettledFixture().snapshot;
    const state = {
      ...source.state,
      age: 100,
      retirement: {
        policyVersion: '1.0.0' as const,
        marketOffers: null,
        lastChanceConsumed: false,
        lastChanceSeasonIndex: null,
      },
    };
    expect(retirementDecisionRequired(state)).toBe(false);
  });

  // T-7-031 D-80 1라운드 ②: 정책은 인자로만 받는다(기본값은 RETIREMENT_POLICY 1.0.0). 룰셋에
  // retirementRules가 없으면 이 기본값이 그대로 재현돼야 한다.
  it('defaults to RETIREMENT_POLICY when no policy argument is given', () => {
    const source = runSettledFixture().snapshot;
    const state = { ...source.state, age: 38 };
    expect(assessCareerRetirement(state)?.policyVersion).toBe(RETIREMENT_POLICY.version);
    expect(assessCareerRetirement(state, 'UNDECIDED', RETIREMENT_POLICY)?.total).toBe(
      assessCareerRetirement(state)?.total,
    );
  });

  it('honors an explicit policy argument: a stricter policy requires review where the default policy does not', () => {
    const prepared = singleOfferBoundary();
    const { snapshot } = retireContinuation(prepared);
    const started = simulate({
      snapshot,
      command: {
        type: 'START_SEASON',
        commandId: 'target-season-start-policy',
        expectedRevision: snapshot.revision,
        payload: {
          simulationMode: 'FAST',
          serviceSeasonId: 'target-season-policy',
          legacyLedger: true,
        },
      },
      ruleset: rulesetProto,
      rulesetVersion: snapshot.rulesetVersion,
      contentPackVersion: snapshot.contentPackVersion,
    });
    expect(started.ok).toBe(true);
    const finished = runSeason(started.ok ? started.snapshot : snapshot);
    // Strip the last-chance boundary (which forces review independently of the assessment) so the
    // gate exercised here is purely the policy-driven assessCareerRetirement branch.
    const targetState = {
      ...finished.state,
      pending: null,
      retirement: {
        policyVersion: '1.0.0' as const,
        marketOffers: 0,
        lastChanceConsumed: false,
        lastChanceSeasonIndex: null,
      },
    };
    // Baseline: the default policy (no argument) does not require review for this evidence.
    const baseline = assessCareerRetirement(targetState);
    expect(baseline?.policyVersion).toBe(RETIREMENT_POLICY.version);
    expect(baseline?.status).not.toBe('REVIEW');
    expect(retirementDecisionRequired(targetState)).toBe(false);
    // A stricter policy (lower reviewThreshold, same weights so age/injury alone still can't force
    // review) passed explicitly must flip the same evidence to REVIEW.
    const stricterPolicy = {
      ...RETIREMENT_POLICY,
      version: 'test-strict',
      watchThreshold: 20,
      reviewThreshold: 26,
    };
    const assessment = assessCareerRetirement(targetState, 'UNDECIDED', stricterPolicy);
    expect(assessment?.policyVersion).toBe('test-strict');
    expect(assessment?.status).toBe('REVIEW');
    expect(retirementDecisionRequired(targetState, stricterPolicy)).toBe(true);
  });
});

it('finishes the bounded journey at twelve seasons without another contract or season', () => {
  const prepared = singleOfferBoundary();
  const policy = { ...RETIREMENT_POLICY, maxCareerSeasons: 12 };
  const state = {
    ...prepared.state,
    seasonHistory: Array.from({ length: 12 }, () => prepared.state.seasonHistory[0]!),
  };
  expect(retirementDecisionRequired(state, policy)).toBe(true);
  expect(retirementContinuationOptions(state, policy)).toEqual([]);
  expect(retirementContinuationOptions(state)).not.toEqual([]);
  const ready = { ...state, pending: null };
  const result = simulate({
    snapshot: { ...prepared, state: ready, stateHash: hashState(ready) },
    command: {
      type: 'START_SEASON',
      commandId: 'journey-completed',
      expectedRevision: prepared.revision,
      payload: { simulationMode: 'FAST', serviceSeasonId: 'test' },
    },
    ruleset: { ...rulesetProto, retirementRules: policy },
    rulesetVersion: prepared.rulesetVersion,
    contentPackVersion: prepared.contentPackVersion,
  });
  expect(result.ok).toBe(false);
});

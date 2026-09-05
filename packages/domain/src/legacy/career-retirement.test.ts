import { describe, expect, it } from 'vitest';
import seasonRaw from '../__fixtures__/career-06-settled-season.json';
import { runSettledFixture } from '../__fixtures__/career-06-settled.js';
import { rulesetProto } from '../__fixtures__/career-01.js';
import { hashState } from '../hash.js';
import { simulate } from '../simulate.js';
import { retirementContinuationOptions, retirementDecisionRequired } from './career-retirement.js';
import type { DomainSnapshot } from '../types.js';
import type { Command } from '../simulate.js';

const seasonFixture = seasonRaw as { startSeason: { simulationMode: 'FAST'; serviceSeasonId: string }; commands: Array<{ type: Command['type']; payload: unknown }> };
type EngineCommand = Command & { commandId: string; expectedRevision: number };

function runSeason(snapshot: DomainSnapshot): DomainSnapshot {
  let current = snapshot;
  for (let n = 0; n < 150; n += 1) {
    const pending = current.state.pending;
    let command: EngineCommand;
    if (pending?.kind === 'OFFERS' || pending?.kind === 'CONTRACT') command = { type: 'REJECT_OFFER', payload: { offerId: null }, commandId: `retirement-season-${n}-market`, expectedRevision: current.revision } as EngineCommand;
    else if (pending?.kind === 'INJURY') command = { type: 'RESOLVE_EVENT', payload: { eventId: pending.eventId, definitionVersion: pending.version, choiceId: 'A', outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [] }], rehabPlan: 'STANDARD' }, commandId: `retirement-season-${n}-injury`, expectedRevision: current.revision } as EngineCommand;
    else if (pending?.kind === 'NATIONAL_TEAM') command = { type: 'RESOLVE_EVENT', payload: { eventId: pending.eventId, definitionVersion: pending.version, choiceId: 'C', outcomes: [{ id: 'C1', kind: 'FIXED', weight: 100, effects: [] }], callUp: 'DECLINE' }, commandId: `retirement-season-${n}-national`, expectedRevision: current.revision } as EngineCommand;
    else if (pending?.kind === 'ROLE_PROPOSAL') command = { type: 'RESOLVE_ROLE', payload: { decision: 'ACCEPT' }, commandId: `retirement-season-${n}-role`, expectedRevision: current.revision } as EngineCommand;
    else if (pending?.kind === 'EVENT') command = { type: 'RESOLVE_EVENT', payload: { eventId: pending.eventId, definitionVersion: pending.version, choiceId: 'A', outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [] }] }, commandId: `retirement-season-${n}-event`, expectedRevision: current.revision } as EngineCommand;
    else if (pending?.kind === 'SETTLEMENT') command = { type: 'SETTLE_SEASON', payload: {}, commandId: `retirement-season-${n}-settle`, expectedRevision: current.revision } as EngineCommand;
    else command = { type: 'ADVANCE', payload: seasonFixture.commands.find((item) => item.type === 'ADVANCE')?.payload ?? { eligibleEvents: [] }, commandId: `retirement-season-${n}-advance`, expectedRevision: current.revision } as EngineCommand;
    const result = simulate({ snapshot: current, command, ruleset: rulesetProto, rulesetVersion: current.rulesetVersion, contentPackVersion: current.contentPackVersion });
    if (!result.ok) throw new Error(`${command.type} failed: ${result.error.message}; pending=${current.state.pending?.kind ?? 'none'}`);
    current = result.snapshot;
    if (current.state.season === null && n > 0) return current;
  }
  throw new Error('retirement continuation season did not settle');
}

function singleOfferBoundary(): DomainSnapshot {
  const source = runSettledFixture().snapshot;
  if (source.state.pending?.kind !== 'OFFERS' || source.state.pending.offers[0] === undefined) {
    throw new Error(`fixture must expose OFFERS at retirement boundary; pending=${source.state.pending?.kind ?? 'none'}`);
  }
  const state = {
    ...source.state,
    pending: { ...source.state.pending, offers: [{ ...source.state.pending.offers[0], lengthSeasons: 1 }] },
    retirement: { policyVersion: '1.0.0' as const, marketOffers: 1, lastChanceConsumed: false, lastChanceSeasonIndex: null },
  };
  return { ...source, state, stateHash: hashState(state) };
}

function retireContinuation(snapshot: DomainSnapshot) {
  const option = retirementContinuationOptions(snapshot.state)[0];
  if (option === undefined) throw new Error('fixture offer is not eligible for continuation');
  const result = simulate({
    snapshot,
    command: { type: 'RETIRE', commandId: `last-chance-${option.offerId}`, expectedRevision: snapshot.revision, payload: { choice: option.choice, offerId: option.offerId } },
    ruleset: rulesetProto,
    rulesetVersion: snapshot.rulesetVersion,
    contentPackVersion: snapshot.contentPackVersion,
  });
  if (!result.ok) throw new Error(`continuation failed: ${result.error.code} ${result.error.message}`);
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
    expect(snapshot.state.retirement).toMatchObject({ lastChanceConsumed: true, lastChanceSeasonIndex: prepared.state.seasonHistory.length + 1 });
    expect(snapshot.state.pending).toBeNull();
  });

  it('allows the granted season, then requires a decision at the target boundary and rejects reuse', () => {
    const prepared = singleOfferBoundary();
    const { snapshot } = retireContinuation(prepared);
    expect(retirementDecisionRequired(snapshot.state)).toBe(false);
    const nextStart = simulate({
      snapshot,
      command: { type: 'START_SEASON', commandId: 'last-chance-start', expectedRevision: snapshot.revision, payload: { simulationMode: 'FAST', serviceSeasonId: 'last-chance-season' } },
      ruleset: rulesetProto,
      rulesetVersion: snapshot.rulesetVersion,
      contentPackVersion: snapshot.contentPackVersion,
    });
    expect(nextStart.ok).toBe(true);
    const finished = runSeason(nextStart.ok ? nextStart.snapshot : snapshot);
    expect(finished.state.seasonHistory.length).toBe(snapshot.state.seasonHistory.length + 1);
    expect(retirementDecisionRequired(finished.state)).toBe(true);
    const blocked = simulate({ snapshot: finished, command: { type: 'START_SEASON', commandId: 'retirement-blocked', expectedRevision: finished.revision, payload: { simulationMode: 'FAST', serviceSeasonId: 'blocked' } }, ruleset: rulesetProto, rulesetVersion: finished.rulesetVersion, contentPackVersion: finished.contentPackVersion });
    expect(blocked).toMatchObject({ ok: false, error: { details: { reason: 'RETIREMENT_DECISION_REQUIRED' } } });
    const reused = retirementContinuationOptions(snapshot.state);
    expect(reused).toHaveLength(0);
  });

  it('does not infer review from age alone or absent market evidence', () => {
    const source = runSettledFixture().snapshot;
    const state = { ...source.state, age: 100, retirement: { policyVersion: '1.0.0' as const, marketOffers: null, lastChanceConsumed: false, lastChanceSeasonIndex: null } };
    expect(retirementDecisionRequired(state)).toBe(false);
  });
});

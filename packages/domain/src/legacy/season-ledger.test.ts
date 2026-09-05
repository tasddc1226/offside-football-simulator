import { describe, expect, it } from 'vitest';
import seasonRaw from '../__fixtures__/career-02-season.json';
import { runCareerFixture, rulesetProto } from '../__fixtures__/career-01.js';
import { simulate, type Command } from '../simulate.js';
import type { DomainSnapshot, SimulationMode } from '../types.js';
import { runSeasonFixture } from '../__fixtures__/career-02-season.js';
import { hashState } from '../hash.js';

type SeasonLog = { commands: Array<{ type: Command['type']; payload: unknown }> };
const seasonCommands = (seasonRaw as { commands: Record<SimulationMode, SeasonLog['commands']> }).commands.FAST;

function run(snapshot: DomainSnapshot, type: Command['type'], payload: unknown): DomainSnapshot {
  const result = simulate({
    snapshot,
    command: { type, payload, commandId: `ledger-${snapshot.revision}`, expectedRevision: snapshot.revision } as Command & { commandId: string; expectedRevision: number },
    ruleset: rulesetProto,
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
  });
  if (!result.ok) throw new Error(`${type} failed: ${result.error.code} ${result.error.message}`);
  return result.snapshot;
}

function runOptInSeason(): { snapshot: DomainSnapshot; result: NonNullable<DomainSnapshot['state']['seasonHistory'][number]['result']> } {
  let snapshot = runCareerFixture();
  snapshot = run(snapshot, 'START_SEASON', {
    simulationMode: 'FAST',
    serviceSeasonId: 'ledger-test-season',
    legacyLedger: true,
  });
  for (const command of seasonCommands) snapshot = run(snapshot, command.type, command.payload);
  const result = snapshot.state.seasonHistory[0]?.result;
  if (result === undefined) throw new Error('season result missing');
  return { snapshot, result };
}

describe('Phase 5 opt-in season Legacy ledger', () => {
  it('preserves contract salary/bonus at START and settles income, relationships, age, and promotion evidence', () => {
    const before = runCareerFixture();
    const wage = before.state.contract!.wageMinorPerWeek;
    const bonus = before.state.contract!.signingBonusMinor;
    const signedSeason = before.state.contract!.signedSeasonIndex;
    const startAge = before.state.age;
    const { snapshot, result } = runOptInSeason();
    expect(result.legacy).toMatchObject({
      policyVersion: '1.0.0',
      incomeMinor: wage * 52 + (signedSeason === 1 ? bonus : 0),
      contractId: before.state.contract!.id,
      relationships: snapshot.state.relationships,
      ageAtStart: startAge,
    });
    const league = result.competitions.find((competition) => competition.kind === 'LEAGUE');
    const promotionSlots = rulesetProto.leagues.find((candidate) => candidate.id === league?.competitionId)?.promotionSlots ?? 0;
    expect(result.legacy!.promotion).toBe(league?.position !== null && league?.position !== undefined && league.position <= promotionSlots);
    expect(result.selectionSummary.finalRank).toBeDefined();
  });

  it('keeps historical command logs without the opt-in ledger absent', () => {
    const { snapshot } = runSeasonFixture('FAST');
    expect(snapshot.state.seasonHistory[0]?.result.legacy).toBeUndefined();
  });

  it('rejects unsafe wage/bonus totals at the START boundary even when the mutated snapshot is rehashed', () => {
    const source = runCareerFixture();
    if (source.state.contract === null) throw new Error('fixture contract missing');
    const state = {
      ...source.state,
      contract: {
        ...source.state.contract,
        wageMinorPerWeek: Number.MAX_SAFE_INTEGER,
        signingBonusMinor: 1,
      },
    };
    const snapshot: DomainSnapshot = { ...source, state, stateHash: hashState(state) };
    const result = simulate({
      snapshot,
      command: {
        type: 'START_SEASON',
        payload: { simulationMode: 'FAST', serviceSeasonId: 'ledger-overflow', legacyLedger: true },
        commandId: 'ledger-overflow',
        expectedRevision: snapshot.revision,
      },
      ruleset: rulesetProto,
      rulesetVersion: snapshot.rulesetVersion,
      contentPackVersion: snapshot.contentPackVersion,
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
    if (result.ok) throw new Error('unsafe ledger input unexpectedly accepted');
    expect(result.error.message).toContain('안전한 정수');
    expect(snapshot.stateHash).toBe(hashState(snapshot.state));
  });
});

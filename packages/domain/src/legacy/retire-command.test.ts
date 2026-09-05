import { describe, expect, it } from 'vitest';
import { rulesetProto } from '../__fixtures__/career-01.js';
import { runSettledFixture } from '../__fixtures__/career-06-settled.js';
import { hashState } from '../hash.js';
import { simulate, verifySnapshot, type Command } from '../simulate.js';
import type { DomainSnapshot } from '../types.js';
import { createCareerArchiveCore } from './archive.js';
import { archiveFixture } from './__fixtures__/archive.js';

function run(snapshot: DomainSnapshot, command: Command, revision = snapshot.revision) {
  return simulate({
    snapshot,
    command: { ...command, commandId: 'retire-test', expectedRevision: revision },
    ruleset: rulesetProto,
    rulesetVersion: snapshot.rulesetVersion,
    contentPackVersion: snapshot.contentPackVersion,
  });
}

function boundary(): DomainSnapshot {
  let snapshot = runSettledFixture().snapshot;
  if (snapshot.state.pending?.kind === 'OFFERS') {
    const result = run(snapshot, { type: 'REJECT_OFFER', payload: { offerId: null } });
    if (!result.ok) throw new Error(result.error.message);
    snapshot = result.snapshot;
  }
  return snapshot;
}

describe('RETIRE command', () => {
  it.each(['RETIRE', 'COACH_EPILOGUE'] as const)(
    'confirms %s without RNG, aging or changing settled records',
    (choice) => {
      const snapshot = boundary();
      const before = JSON.stringify(snapshot);
      const result = run(snapshot, { type: 'RETIRE', payload: { choice } });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error.message);
      expect(result.snapshot.revision).toBe(snapshot.revision + 1);
      expect(result.snapshot.checkpoint).toBe('RETIREMENT');
      expect(result.snapshot.state.status).toBe('RETIRED');
      expect(result.snapshot.state.rngState).toEqual(snapshot.state.rngState);
      expect(result.snapshot.state.seasonHistory).toEqual(snapshot.state.seasonHistory);
      expect(result.snapshot.state.age).toBe(snapshot.state.age);
      expect(result.snapshot.state.timeline.at(-1)).toMatchObject({
        kind: 'RETIRED',
        refId: choice,
      });
      expect(verifySnapshot(result.snapshot)).toEqual({ ok: true });
      expect(JSON.stringify(snapshot)).toBe(before);
      expect(run(snapshot, { type: 'RETIRE', payload: { choice } })).toEqual(result);
      const { context } = archiveFixture();
      expect(createCareerArchiveCore(result.snapshot, context).source.stateHash).toBe(
        result.snapshot.stateHash,
      );
    },
  );

  it('rejects stale revisions, active seasons, unresolved choices and invalid source hashes', () => {
    const snapshot = boundary();
    const command = { type: 'RETIRE', payload: { choice: 'RETIRE' } } as const;
    expect(run(snapshot, command, snapshot.revision - 1)).toMatchObject({
      ok: false,
      error: { code: 'CAREER_REVISION_CONFLICT' },
    });
    const seasonState = runSettledFixture().beforeSettlementState;
    const active = { ...snapshot, state: seasonState, stateHash: hashState(seasonState) };
    expect(run(active, command)).toMatchObject({ ok: false });
    const pending = {
      ...snapshot,
      state: { ...snapshot.state, pending: { kind: 'SETTLEMENT' as const, step: 12 } },
    };
    pending.stateHash = hashState(pending.state);
    expect(run(pending, command)).toMatchObject({ ok: false });
    expect(run({ ...snapshot, stateHash: 'a'.repeat(64) }, command)).toMatchObject({ ok: false });
    expect(run({ ...snapshot, revision: Number.MAX_SAFE_INTEGER }, command)).toMatchObject({
      ok: false,
    });
    const empty = { ...snapshot, state: { ...snapshot.state, seasonHistory: [] } };
    empty.stateHash = hashState(empty.state);
    expect(run(empty, command)).toMatchObject({ ok: false });
    expect(
      run(snapshot, { type: 'RETIRE', payload: { choice: 'UNCONFIRMED' } } as unknown as Command),
    ).toMatchObject({ ok: false });
  });

  it.each(['RETIRED', 'ARCHIVED'] as const)(
    'blocks every ordinary command after %s without mutation',
    (status) => {
      const snapshot = boundary();
      snapshot.state.status = status;
      snapshot.stateHash = hashState(snapshot.state);
      const before = JSON.stringify(snapshot);
      const types = [
        'UPDATE_PLAYER_DRAFT',
        'CONFIRM_PLAYER',
        'START_SEASON',
        'ADVANCE',
        'SETTLE_SEASON',
        'RESOLVE_ROLE',
        'RESOLVE_EVENT',
        'RESOLVE_CHAPTER',
        'ACCEPT_OFFER',
        'NEGOTIATE',
        'REJECT_OFFER',
        'LOAN_RETURN',
        'RETIRE',
      ] as const;
      for (const type of types) {
        expect(run(snapshot, { type, payload: {} } as Command)).toMatchObject({
          ok: false,
          error: { details: { reason: type === 'START_SEASON' ? 'NOT_ACTIVE' : 'CAREER_RETIRED' } },
        });
      }
      expect(JSON.stringify(snapshot)).toBe(before);
    },
  );
});

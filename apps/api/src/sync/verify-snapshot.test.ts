import type { PutCareerBody } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../db/hash.js';
import { verifyIncomingSnapshot } from './verify-snapshot.js';

const CAREER_ID = 'car_contract_integrity';

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function makeBody(stateOverrides: Record<string, unknown> = {}): Promise<PutCareerBody> {
  const state = canonicalize({
    schemaVersion: 1,
    careerId: CAREER_ID,
    status: 'ACTIVE',
    rngState: { s: [1, 2, 3, 4], draws: 0 },
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    ...stateOverrides,
  });
  const stateHash = await sha256Hex(state);
  return {
    baseRevision: 0,
    snapshot: {
      revision: 1,
      checkpoint: 'CONTRACT_CONFIRMED',
      state,
      stateHash,
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
      rngState: { s: [1, 2, 3, 4], draws: 0 },
    },
    commands: [
      {
        revision: 1,
        commandId: 'cmd-contract-integrity',
        commandType: 'ADVANCE',
        payload: { eligibleEvents: [] },
        resultHash: stateHash,
      },
    ],
    createdServiceSeasonId: 'svc_contract_integrity',
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
  };
}

const loanContract = {
  id: 'CTR-loan',
  teamId: 'loan-team',
  kind: 'LOAN',
  loan: { parentTeamId: 'source-team' },
};

const loanStint = { contractId: 'CTR-loan', teamId: 'loan-team', kind: 'LOAN', toSeasonIndex: null };

describe('verifyIncomingSnapshot 계약·소속 교차 불변식', () => {
  it('정상 LOAN 상태는 통과한다', async () => {
    const body = await makeBody({
      contract: loanContract,
      parentContract: { id: 'CTR-parent', teamId: 'source-team', kind: 'PERMANENT', suspended: true },
      clubHistory: [loanStint],
    });

    await expect(verifyIncomingSnapshot(body, CAREER_ID)).resolves.toEqual({ ok: true, status: 'ACTIVE' });
  });

  it.each([
    {
      label: 'LOAN parentContract null',
      state: { contract: loanContract, parentContract: null, clubHistory: [loanStint] },
    },
    {
      label: 'wrong parentContract',
      state: {
        contract: loanContract,
        parentContract: { id: 'CTR-parent', teamId: 'wrong-source-team', kind: 'PERMANENT', suspended: true },
        clubHistory: [loanStint],
      },
    },
    {
      label: 'contractId-only mismatch',
      state: {
        contract: loanContract,
        parentContract: { id: 'CTR-parent', teamId: 'source-team', kind: 'PERMANENT', suspended: true },
        clubHistory: [{ ...loanStint, contractId: 'CTR-other' }],
      },
    },
    {
      label: 'overlapping open stints',
      state: {
        contract: { id: 'CTR-current', teamId: 'current-team', kind: 'PERMANENT' },
        parentContract: null,
        clubHistory: [
          { contractId: 'CTR-current', teamId: 'current-team', kind: 'PERMANENT', toSeasonIndex: null },
          { contractId: 'CTR-other', teamId: 'other-team', kind: 'PERMANENT', toSeasonIndex: null },
        ],
      },
    },
  ])('$label 조작 Snapshot은 STATE_INVARIANT_VIOLATION으로 거부한다', async ({ state }) => {
    const body = await makeBody(state);
    await expect(verifyIncomingSnapshot(body, CAREER_ID)).resolves.toEqual({
      ok: false,
      reason: 'STATE_INVARIANT_VIOLATION',
    });
  });
});

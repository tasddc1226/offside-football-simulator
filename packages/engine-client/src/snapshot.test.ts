import type { CareerSnapshot } from '@offside/contracts';
import { career04GkEngineCommands } from '@offside/fixtures';
import { ATTRIBUTE_KEYS, hashState, type AttributeKey, type CareerState, type DomainSnapshot, type Ruleset } from '@offside/domain';
import ruleset170Raw from '../../content/rulesets/1.7.0/ruleset.json' with { type: 'json' };
import { describe, expect, it } from 'vitest';
import { createEngineClient } from './engine.js';
import { inlineSimulator } from './simulator/index.js';
import { decodeSnapshot, encodeSnapshot } from './snapshot.js';
import { MemoryLocalStore } from './store/memory.js';

function buildAttributes(value: number): Record<AttributeKey, number> {
  const attributes = {} as Record<AttributeKey, number>;
  for (const key of ATTRIBUTE_KEYS) attributes[key] = value;
  return attributes;
}

function buildValidDomainSnapshot(): DomainSnapshot {
  const state: CareerState = {
    schemaVersion: 1,
    careerId: 'car_snapshot_test',
    status: 'ACTIVE',
    stage: 'YOUTH',
    age: 17,
    currentStep: 0,
    seasonPhase: 'PRESEASON',
    simulationMode: 'CHAPTER',
    attributes: buildAttributes(50),
    growthCarryCenti: buildAttributes(0),
    state: { form: 50, fitness: 80, morale: 60 },
    context: { tacticalFit: 50, squadStatus: 50, positionProficiency: 100 },
    relationships: { managerTrust: 50, captain: 50, rival: 50, fans: 50, agent: 50 },
    tags: ['aa', 'bb'],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    resolvedChapterIds: [],
    careerTags: [],
    careerTagGrants: [],
    rngState: { s: [1, 2, 3, 4], draws: 2 },
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    player: {
      draft: { name: null, gender: null, nationalityCode: null, preferredFoot: null, position: null, archetypeId: null, backgroundId: null },
      profile: null,
    },
    pending: null,
    contract: null,
    parentContract: null,
    clubHistory: [],
    timeline: [],
    season: null,
    seasonHistory: [],
    nextManager: null,
    captaincy: 'NONE',
    captaincySeasons: 0,
    controversyFailures: 0,
    nationalityRuleState: { moduleId: 'DEFAULT', exceptions: [] },
    nationalTeam: { callUps: [], debuted: false, pendingDebut: null },
    health: { episodes: [] },
    relationshipLog: [],
    memoryTags: { managerTrust: [], captain: [], rival: [], fans: [], agent: [] },
    reputation: { popularityCenti: 5000, mediaCenti: 5000 },
  };
  return {
    revision: 1,
    checkpoint: 'CAREER_CREATED',
    state,
    stateHash: hashState(state),
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
  };
}

async function buildLedgerSnapshot(stopAfterSeasonStart = true): Promise<DomainSnapshot> {
  let id = 0;
  const commands = career04GkEngineCommands(() => `ledger-snapshot-${++id}`);
  const ruleset = ruleset170Raw as unknown as Ruleset;
  const engine = createEngineClient({ store: new MemoryLocalStore(), simulator: inlineSimulator, ruleset });
  let careerId = '';
  let snapshot: DomainSnapshot | undefined;
  for (const source of commands) {
    const command = structuredClone(source);
    if (command.type === 'CREATE_CAREER') {
      command.payload.rulesetVersion = '1.7.0';
      command.payload.contentPackVersion = '0.6.2';
      careerId = command.payload.careerId;
    }
    const result = await engine.execute({
      careerId,
      command,
      ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: 'svc-ledger-snapshot' } : {}),
    });
    if (!result.ok) throw new Error(`${command.type}: ${result.error.message}`);
    snapshot = result.domainSnapshot;
    if (stopAfterSeasonStart && command.type === 'START_SEASON') return result.domainSnapshot;
  }
  if (snapshot === undefined) throw new Error('ledger snapshot을 만들지 못했다.');
  return snapshot;
}

describe('encodeSnapshot / decodeSnapshot', () => {
  it('정상 왕복: encode 후 decode하면 원래 DomainSnapshot과 같다', () => {
    const domain = buildValidDomainSnapshot();
    const encoded = encodeSnapshot(domain, { careerId: domain.state.careerId, createdAt: '2026-01-01T00:00:00.000Z' });

    expect(encoded.id).toBe(`${domain.state.careerId}:${domain.revision}`);
    expect(encoded.careerId).toBe(domain.state.careerId);

    const decoded = decodeSnapshot(encoded);
    expect(decoded).toEqual({ ok: true, snapshot: domain });
  });

  it('state가 JSON으로 파싱되지 않으면 PARSE_FAILED', () => {
    const domain = buildValidDomainSnapshot();
    const encoded = encodeSnapshot(domain, { careerId: domain.state.careerId, createdAt: '2026-01-01T00:00:00.000Z' });
    const tampered: CareerSnapshot = { ...encoded, state: '{not valid json' };

    expect(decodeSnapshot(tampered)).toEqual({ ok: false, reason: 'PARSE_FAILED' });
  });

  it('rngState.draws가 변조되면 RNG_STATE_MISMATCH', () => {
    const domain = buildValidDomainSnapshot();
    const encoded = encodeSnapshot(domain, { careerId: domain.state.careerId, createdAt: '2026-01-01T00:00:00.000Z' });
    const tampered: CareerSnapshot = { ...encoded, rngState: { ...encoded.rngState, draws: encoded.rngState.draws + 1 } };

    expect(decodeSnapshot(tampered)).toEqual({ ok: false, reason: 'RNG_STATE_MISMATCH' });
  });

  it('tags 정렬 또는 신규 compact ledger canonical 형태가 깨지면(해시는 재계산) INVALID_STATE', async () => {
    const domain = buildValidDomainSnapshot();
    const reversedState: CareerState = { ...domain.state, tags: [...domain.state.tags].reverse() };
    const reversedDomain: DomainSnapshot = { ...domain, state: reversedState, stateHash: hashState(reversedState) };
    const encoded = encodeSnapshot(reversedDomain, {
      careerId: reversedDomain.state.careerId,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(decodeSnapshot(encoded)).toEqual({ ok: false, reason: 'INVALID_STATE' });

    const missingLedgerState = {
      ...domain.state,
      rulesetVersion: '1.7.0',
      season: { index: 1, teamId: 'team-1' } as CareerState['season'],
    };
    const missingLedgerDomain: DomainSnapshot = {
      ...domain,
      state: missingLedgerState,
      stateHash: hashState(missingLedgerState),
      rulesetVersion: '1.7.0',
    };
    expect(decodeSnapshot(encodeSnapshot(missingLedgerDomain, {
      careerId: domain.state.careerId,
      createdAt: '2026-01-01T00:00:00.000Z',
    }))).toEqual({ ok: false, reason: 'INVALID_STATE' });

    const ledgerDomain = await buildLedgerSnapshot();
    const ledger = ledgerDomain.state.season?.leagueLedger;
    if (ledger === undefined) throw new Error('ledger setup 실패');
    for (const results of [
      [[Number.MAX_SAFE_INTEGER, 0, 0]],
      [[0, 0, 0], [0, 1, 0]],
      [[0, 0, 0]],
    ] as const) {
      const corruptedState: CareerState = {
        ...ledgerDomain.state,
        season: { ...ledgerDomain.state.season!, leagueLedger: { ...ledger, results: results.map((row) => [...row]) } },
      };
      const corruptedDomain: DomainSnapshot = {
        ...ledgerDomain,
        state: corruptedState,
        stateHash: hashState(corruptedState),
      };
      expect(decodeSnapshot(encodeSnapshot(corruptedDomain, {
        careerId: corruptedState.careerId,
        createdAt: '2026-01-01T00:00:00.000Z',
      }))).toEqual({ ok: false, reason: 'INVALID_STATE' });
    }

    const finalDomain = await buildLedgerSnapshot(false);
    const finalTable = finalDomain.state.seasonHistory.at(-1)?.result.finalLeagueTable;
    if (finalTable === undefined) throw new Error('final table setup 실패');
    const finalEncoded = encodeSnapshot(finalDomain, {
      careerId: finalDomain.state.careerId,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(decodeSnapshot(finalEncoded)).toEqual({ ok: true, snapshot: finalDomain });
    const malformedFinalState = structuredClone(finalDomain.state);
    const malformedFinalTable = malformedFinalState.seasonHistory.at(-1)?.result.finalLeagueTable;
    if (malformedFinalTable === undefined) throw new Error('malformed final table setup 실패');
    malformedFinalTable.rows[0] = {
      rank: 1,
      teamId: 'old-object-row',
    } as unknown as typeof malformedFinalTable.rows[number];
    const malformedFinalDomain: DomainSnapshot = {
      ...finalDomain,
      state: malformedFinalState,
      stateHash: hashState(malformedFinalState),
    };
    expect(decodeSnapshot(encodeSnapshot(malformedFinalDomain, {
      careerId: malformedFinalState.careerId,
      createdAt: '2026-01-01T00:00:00.000Z',
    }))).toEqual({ ok: false, reason: 'INVALID_STATE' });
  });

  it('wrapper의 careerId가 state.careerId와 다르면 CAREER_ID_MISMATCH', () => {
    const domain = buildValidDomainSnapshot();
    const encoded = encodeSnapshot(domain, { careerId: domain.state.careerId, createdAt: '2026-01-01T00:00:00.000Z' });
    const otherCareerId = 'car_other';
    const tampered: CareerSnapshot = { ...encoded, careerId: otherCareerId, id: `${otherCareerId}:${encoded.revision}` };

    expect(decodeSnapshot(tampered)).toEqual({ ok: false, reason: 'CAREER_ID_MISMATCH' });
  });

  it('id가 careerId:revision 형태가 아니면 REVISION_MISMATCH', () => {
    const domain = buildValidDomainSnapshot();
    const encoded = encodeSnapshot(domain, { careerId: domain.state.careerId, createdAt: '2026-01-01T00:00:00.000Z' });
    const tampered: CareerSnapshot = { ...encoded, id: 'not-matching-id' };

    expect(decodeSnapshot(tampered)).toEqual({ ok: false, reason: 'REVISION_MISMATCH' });
  });

  it('stateHash가 맞지 않으면 STATE_HASH_MISMATCH', () => {
    const domain = buildValidDomainSnapshot();
    const encoded = encodeSnapshot(domain, { careerId: domain.state.careerId, createdAt: '2026-01-01T00:00:00.000Z' });
    const tampered: CareerSnapshot = { ...encoded, stateHash: 'f'.repeat(64) };

    expect(decodeSnapshot(tampered)).toEqual({ ok: false, reason: 'STATE_HASH_MISMATCH' });
  });
});

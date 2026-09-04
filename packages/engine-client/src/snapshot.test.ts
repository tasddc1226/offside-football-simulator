import type { CareerSnapshot } from '@offside/contracts';
import { ATTRIBUTE_KEYS, hashState, type AttributeKey, type CareerState, type DomainSnapshot } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import { decodeSnapshot, encodeSnapshot } from './snapshot.js';

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

  it('tags 정렬이 깨지면(해시는 재계산) INVALID_STATE', () => {
    const domain = buildValidDomainSnapshot();
    const reversedState: CareerState = { ...domain.state, tags: [...domain.state.tags].reverse() };
    const reversedDomain: DomainSnapshot = { ...domain, state: reversedState, stateHash: hashState(reversedState) };
    const encoded = encodeSnapshot(reversedDomain, {
      careerId: reversedDomain.state.careerId,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(decodeSnapshot(encoded)).toEqual({ ok: false, reason: 'INVALID_STATE' });
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

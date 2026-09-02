import { ATTRIBUTE_KEYS, type AttributeKey, type CareerState, type PlayerDraft } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import { screenForCareer } from './career-route.js';

const FULL_DRAFT: PlayerDraft = {
  name: '김서준',
  nationalityCode: 'KR',
  preferredFoot: 'LEFT',
  position: 'W',
  archetypeId: 'inside-forward',
  backgroundId: 'club-academy',
};

const EMPTY_DRAFT: PlayerDraft = {
  name: null,
  nationalityCode: null,
  preferredFoot: null,
  position: null,
  archetypeId: null,
  backgroundId: null,
};

const ZERO_ATTRIBUTES = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 50])) as Record<AttributeKey, number>;

function baseState(overrides: Partial<CareerState>): CareerState {
  return {
    schemaVersion: 1,
    careerId: 'car_test',
    status: 'DRAFT',
    stage: 'YOUTH',
    age: 17,
    currentStep: 0,
    seasonPhase: 'PRESEASON',
    simulationMode: 'FAST',
    attributes: ZERO_ATTRIBUTES,
    state: { form: 50, fitness: 100, morale: 50 },
    context: { tacticalFit: 50, squadStatus: 50, positionProficiency: 50 },
    relationships: { managerTrust: 50, captain: 0, rival: 0, fans: 0, agent: 0 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    rngState: { s: [1, 2, 3, 4], draws: 0 },
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    player: { draft: EMPTY_DRAFT, profile: null },
    pending: null,
    contract: null,
    timeline: [],
    ...overrides,
  };
}

describe('screenForCareer', () => {
  it.each([
    ['DRAFT, 핵심 필드 일부 비어있음 → SCR-002', baseState({ player: { draft: { ...FULL_DRAFT, name: null }, profile: null } }), 'SCR-002'],
    ['DRAFT, 필드 전부 비어있음 → SCR-002', baseState({ player: { draft: EMPTY_DRAFT, profile: null } }), 'SCR-002'],
    ['DRAFT, archetypeId만 비어있음 → SCR-003', baseState({ player: { draft: { ...FULL_DRAFT, archetypeId: null }, profile: null } }), 'SCR-003'],
    ['DRAFT, 모든 필드 채움 → SCR-004', baseState({ player: { draft: FULL_DRAFT, profile: null } }), 'SCR-004'],
    ['ACTIVE, pending 없음 → SCR-029', baseState({ status: 'ACTIVE', pending: null }), 'SCR-029'],
    [
      'ACTIVE, pending EVENT(EVT-CON-002) → SCR-007',
      baseState({ status: 'ACTIVE', pending: { kind: 'EVENT', eventId: 'EVT-CON-002', version: 1 } }),
      'SCR-007',
    ],
    [
      'ACTIVE, pending EVENT(EVT-CON-003) → SCR-008',
      baseState({ status: 'ACTIVE', pending: { kind: 'EVENT', eventId: 'EVT-CON-003', version: 1 } }),
      'SCR-008',
    ],
    [
      'ACTIVE, pending EVENT(그 외) → SCR-013',
      baseState({ status: 'ACTIVE', pending: { kind: 'EVENT', eventId: 'EVT-DEV-001', version: 1 } }),
      'SCR-013',
    ],
    ['ACTIVE, pending OFFERS → SCR-009', baseState({ status: 'ACTIVE', pending: { kind: 'OFFERS', offers: [] } }), 'SCR-009'],
    ['RETIRED → SCR-029', baseState({ status: 'RETIRED' }), 'SCR-029'],
    ['ARCHIVED → SCR-029', baseState({ status: 'ARCHIVED' }), 'SCR-029'],
  ] as const)('%s', (_label, state, expected) => {
    expect(screenForCareer(state).screenId).toBe(expected);
  });

  it('careerId를 params.careerId로 그대로 돌려준다', () => {
    const state = baseState({ status: 'ACTIVE', pending: null, careerId: 'car_abc' });
    expect(screenForCareer(state).params).toEqual({ careerId: 'car_abc' });
  });
});

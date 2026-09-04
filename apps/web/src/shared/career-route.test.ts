import { ATTRIBUTE_KEYS, type AttributeKey, type CareerState, type PlayerDraft } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import { guardCareerStep, screenForCareer } from './career-route.js';

const FULL_DRAFT: PlayerDraft = {
  name: '김서준',
  gender: 'UNSPECIFIED',
  nationalityCode: 'KR',
  preferredFoot: 'LEFT',
  position: 'W',
  archetypeId: 'inside-forward',
  backgroundId: 'club-academy',
};

const EMPTY_DRAFT: PlayerDraft = {
  name: null,
  gender: null,
  nationalityCode: null,
  preferredFoot: null,
  position: null,
  archetypeId: null,
  backgroundId: null,
};

const ZERO_ATTRIBUTES = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 50])) as Record<AttributeKey, number>;
const ZERO_GROWTH_CARRY = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 0])) as Record<AttributeKey, number>;

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
    growthCarryCenti: ZERO_GROWTH_CARRY,
    state: { form: 50, fitness: 100, morale: 50 },
    context: { tacticalFit: 50, squadStatus: 50, positionProficiency: 50 },
    relationships: { managerTrust: 50, captain: 0, rival: 0, fans: 0, agent: 0 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    resolvedChapterIds: [],
    careerTags: [],
    careerTagGrants: [],
    rngState: { s: [1, 2, 3, 4], draws: 0 },
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    player: { draft: EMPTY_DRAFT, profile: null },
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
    ...overrides,
  };
}

const TEST_MARKET_SUMMARY = { openedAtRevision: 1, seasonIndex: 0, reason: 'FIRST_CONTRACT', safeOfferId: null } as const;

describe('screenForCareer', () => {
  it.each([
    ['DRAFT, 핵심 필드 일부 비어있음 → SCR-002', baseState({ player: { draft: { ...FULL_DRAFT, name: null }, profile: null } }), 'SCR-002'],
    ['DRAFT, gender만 비어있음 → SCR-002', baseState({ player: { draft: { ...FULL_DRAFT, gender: null }, profile: null } }), 'SCR-002'],
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
    ['ACTIVE, pending OFFERS → SCR-009', baseState({ status: 'ACTIVE', pending: { kind: 'OFFERS', offers: [], market: TEST_MARKET_SUMMARY } }), 'SCR-009'],
    [
      'ACTIVE, pending ROLE_PROPOSAL → SCR-012',
      baseState({
        status: 'ACTIVE',
        pending: { kind: 'ROLE_PROPOSAL', step: 1, proposal: { type: 'KEEP', position: 'W', squadRole: 'STARTER' } },
      }),
      'SCR-012',
    ],
    [
      'ACTIVE, pending CHAPTER → SCR-031(자리표시, T-2-008이 채운다)',
      baseState({
        status: 'ACTIVE',
        pending: {
          kind: 'CHAPTER',
          step: 3,
          chapterId: 'CH-001',
          version: 1,
          importance: 'MAJOR',
          matchId: 'match-1',
          decisionsTotal: 3,
          trigger: 'DEBUT',
          resolved: [],
        },
      }),
      'SCR-031',
    ],
    ['ACTIVE, pending SETTLEMENT → SCR-029(대시보드가 결산 CTA를 보여준다)', baseState({ status: 'ACTIVE', pending: { kind: 'SETTLEMENT', step: 12 } }), 'SCR-029'],
    [
      'ACTIVE, pending CONTRACT(offers 없음) → SCR-029(자동 통과, 대시보드 진행 버튼)',
      baseState({ status: 'ACTIVE', pending: { kind: 'CONTRACT', step: 7, offers: [], market: TEST_MARKET_SUMMARY } }),
      'SCR-029',
    ],
    [
      'ACTIVE, pending CONTRACT(offers 있음) → SCR-009(재계약 사전 협상, T-3-003 §9)',
      baseState({
        status: 'ACTIVE',
        pending: {
          kind: 'CONTRACT',
          step: 7,
          offers: [
            {
              id: 'OFR-1-0',
              kind: 'RENEWAL',
              teamId: 'seoul-tier1',
              teamName: '서울 유나이티드',
              fromTeamId: 'seoul-tier1',
              leagueTier: 1,
              lengthSeasons: 2,
              wageMinorPerWeek: 1000000,
              signingBonusMinor: 0,
              transferFeeMinor: null,
              rolePromise: 'BENCH',
              positionPlan: 'W',
              shirtNumber: 7,
              appearancePromise: { minutesShareBp: 0 },
              tacticalFitEstimate: 50,
              competitorSummary: null,
              validUntilRevision: null,
              negotiable: { wage: true, role: false, length: true },
              negotiationState: 'OPEN',
              negotiatedAsk: null,
              loan: null,
            },
          ],
          market: TEST_MARKET_SUMMARY,
        },
      }),
      'SCR-009',
    ],
    [
      'ACTIVE, pending INJURY → SCR-029(자동 통과, 대시보드 진행 버튼)',
      baseState({ status: 'ACTIVE', pending: { kind: 'INJURY', step: 4, episodeId: '', eventId: '', version: 0 } }),
      'SCR-029',
    ],
    [
      'ACTIVE, pending NATIONAL_TEAM → SCR-029(자동 통과, 대시보드 진행 버튼)',
      baseState({ status: 'ACTIVE', pending: { kind: 'NATIONAL_TEAM', step: 5, eventId: '', version: 0 } }),
      'SCR-029',
    ],
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

describe('guardCareerStep', () => {
  const missingCoreDraft = baseState({ player: { draft: { ...FULL_DRAFT, name: null }, profile: null } });
  const missingArchetypeDraft = baseState({ player: { draft: { ...FULL_DRAFT, archetypeId: null }, profile: null } });
  const fullDraft = baseState({ player: { draft: FULL_DRAFT, profile: null } });
  const active = baseState({ status: 'ACTIVE', pending: { kind: 'EVENT', eventId: 'EVT-CON-002', version: 1 } });

  it('DRAFT: archetypeId 없이 SCR-004 진입 → SCR-003으로 막는다', () => {
    expect(guardCareerStep(missingArchetypeDraft, 'SCR-004')).toEqual({
      allowed: false,
      target: { screenId: 'SCR-003', params: { careerId: 'car_test' } },
    });
  });

  it('DRAFT: 핵심 필드 없이 SCR-003 진입 → SCR-002로 막는다', () => {
    expect(guardCareerStep(missingCoreDraft, 'SCR-003')).toEqual({
      allowed: false,
      target: { screenId: 'SCR-002', params: { careerId: 'car_test' } },
    });
  });

  it('DRAFT: 더 앞선 화면(SCR-002)으로 되돌아오는 방문은 막지 않는다(브라우저 뒤로 가기 허용)', () => {
    expect(guardCareerStep(fullDraft, 'SCR-002')).toEqual({ allowed: true });
  });

  it('DRAFT: 이미 채워진 단계에 맞는 화면 진입은 허용한다', () => {
    expect(guardCareerStep(fullDraft, 'SCR-004')).toEqual({ allowed: true });
  });

  it('ACTIVE: recoveryStepActive 없이 SCR-004 재진입은 실제 목적지로 보낸다(확정 반복 방지)', () => {
    expect(guardCareerStep(active, 'SCR-004')).toEqual({
      allowed: false,
      target: { screenId: 'SCR-007', params: { careerId: 'car_test' } },
    });
  });

  it('ACTIVE: recoveryStepActive면 SCR-004(복구 코드 단계) 진입을 허용한다', () => {
    expect(guardCareerStep(active, 'SCR-004', { recoveryStepActive: true })).toEqual({ allowed: true });
  });

  it('ACTIVE: recoveryStepActive여도 SCR-002·SCR-003은 여전히 막는다', () => {
    expect(guardCareerStep(active, 'SCR-002', { recoveryStepActive: true }).allowed).toBe(false);
    expect(guardCareerStep(active, 'SCR-003', { recoveryStepActive: true }).allowed).toBe(false);
  });
});

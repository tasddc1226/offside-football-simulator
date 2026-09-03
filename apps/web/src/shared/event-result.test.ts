import { describe, expect, it } from 'vitest';
import type { CareerState } from '@offside/domain';
import { activeContentPack } from '../engine/content.js';
import { resolveEventResultView } from './event-result.js';

function baseState(overrides: Partial<CareerState>): CareerState {
  return {
    schemaVersion: 1,
    careerId: 'car_test',
    status: 'ACTIVE',
    stage: 'YOUTH',
    age: 17,
    currentStep: 12,
    seasonPhase: 'LEAGUE',
    simulationMode: 'FAST',
    attributes: {} as CareerState['attributes'],
    state: { form: 50, fitness: 100, morale: 50 },
    context: { tacticalFit: 0, squadStatus: 0, positionProficiency: 0 },
    relationships: { managerTrust: 0, captain: 0, rival: 0, fans: 0, agent: 0 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    rngState: { s: [1, 2, 3, 4], draws: 0 },
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    player: {
      draft: { name: '김서준', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'LEFT', position: 'W', archetypeId: 'inside-forward', backgroundId: 'club-academy' },
      profile: null,
    },
    pending: null,
    contract: null,
    timeline: [],
    season: null,
    seasonHistory: [],
    ...overrides,
  };
}

describe('resolveEventResultView', () => {
  it('EVENT_RESOLVED 항목을 refId로 풀어 outcome 정의로 결과를 만든다(EVT-CON-003 A A1: SUCCESS)', () => {
    const state = baseState({
      timeline: [{ revision: 4, kind: 'EVENT_RESOLVED', refId: 'EVT-CON-003:A:A1', age: 17, step: 12 }],
    });

    const view = resolveEventResultView(state, activeContentPack, 4);

    expect(view).toEqual({
      kind: 'SUCCESS',
      kindLabel: '성공',
      title: '스카우트 노트에 "결정력"',
      body: '공격적으로 보여주기',
      effects: ['폼 +5(2스텝 동안)'],
      tags: ['입단테스트_완료', '테스트_성공'],
    });
  });

  it('addTags가 없는 outcome은 빈 tags 배열을 돌려준다', () => {
    const state = baseState({
      timeline: [{ revision: 2, kind: 'EVENT_RESOLVED', refId: 'EVT-CON-002:C:C1', age: 17, step: 10 }],
    });

    const view = resolveEventResultView(state, activeContentPack, 2);

    expect(view?.tags).toEqual(['밑바닥부터', '진로_하부리그']);
    expect(view?.kind).toBe('FIXED');
    expect(view?.kindLabel).toBe('확정');
  });

  it('rev에 맞는 EVENT_RESOLVED 항목이 없으면 null이다', () => {
    const state = baseState({
      timeline: [{ revision: 4, kind: 'EVENT_RESOLVED', refId: 'EVT-CON-003:A:A1', age: 17, step: 12 }],
    });

    expect(resolveEventResultView(state, activeContentPack, 99)).toBeNull();
  });

  it('같은 rev를 다시 조회해도(새로고침·뒤로 가기 시뮬레이션) 같은 결과를 돌려준다', () => {
    const state = baseState({
      timeline: [{ revision: 4, kind: 'EVENT_RESOLVED', refId: 'EVT-CON-003:B:B2', age: 17, step: 12 }],
    });

    const first = resolveEventResultView(state, activeContentPack, 4);
    const second = resolveEventResultView(state, activeContentPack, 4);

    expect(first).toEqual(second);
    expect(first?.kind).toBe('NEUTRAL');
  });

  it('refId가 없는(CONTRACT_SIGNED 등) 항목이면 null이다', () => {
    const state = baseState({
      timeline: [{ revision: 4, kind: 'CONTRACT_SIGNED', refId: 'CTR-4', age: 17, step: 12 }],
    });

    expect(resolveEventResultView(state, activeContentPack, 4)).toBeNull();
  });
});

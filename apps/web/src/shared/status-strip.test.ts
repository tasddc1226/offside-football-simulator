import { describe, expect, it } from 'vitest';
import type { CareerState } from '@offside/domain';
import { proStatusStripItems, u18StatusStripItems } from './status-strip.js';

function baseState(overrides: Partial<CareerState>): CareerState {
  return {
    schemaVersion: 1,
    careerId: 'car_test',
    status: 'ACTIVE',
    stage: 'YOUTH',
    age: 17,
    currentStep: 12,
    seasonPhase: 'SETTLEMENT',
    simulationMode: 'FAST',
    attributes: {} as CareerState['attributes'],
    growthCarryCenti: {} as CareerState['growthCarryCenti'],
    state: { form: 55, fitness: 90, morale: 50 },
    context: { tacticalFit: 12, squadStatus: 0, positionProficiency: 0 },
    relationships: { managerTrust: 8, captain: 0, rival: 0, fans: 0, agent: 0 },
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
      profile: {
        name: '김서준',
        gender: 'UNSPECIFIED',
        nationalityCode: 'KR',
        preferredFoot: 'LEFT',
        preferredPosition: 'W',
        primaryPosition: 'W',
        archetypeId: 'inside-forward',
        backgroundId: 'club-academy',
        truePotential: 70,
        scoutedPotentialMin: 60,
        scoutedPotentialMax: 75,
        baseOvr: 61,
      },
    },
    pending: null,
    contract: null,
    timeline: [],
    season: null,
    seasonHistory: [],
    ...overrides,
  };
}

describe('u18StatusStripItems', () => {
  it('기본 OVR·폼·체력 3개만 돌려준다', () => {
    const items = u18StatusStripItems(baseState({}));
    expect(items).toEqual([
      { id: 'baseOvr', label: '기본 OVR', value: 61 },
      { id: 'form', label: '폼', value: 55 },
      { id: 'fitness', label: '체력', value: 90 },
    ]);
  });

  it('profile이 없으면 baseOvr는 0이다', () => {
    const items = u18StatusStripItems(baseState({ player: { draft: baseState({}).player.draft, profile: null } }));
    expect(items[0]).toEqual({ id: 'baseOvr', label: '기본 OVR', value: 0 });
  });
});

describe('proStatusStripItems', () => {
  it('U18 3개에 전술 적합도·감독 신뢰를 더한다', () => {
    const items = proStatusStripItems(baseState({}));
    expect(items).toEqual([
      { id: 'baseOvr', label: '기본 OVR', value: 61 },
      { id: 'form', label: '폼', value: 55 },
      { id: 'fitness', label: '체력', value: 90 },
      { id: 'tacticalFit', label: '전술 적합도', value: 12 },
      { id: 'managerTrust', label: '감독 신뢰', value: 8 },
    ]);
  });
});

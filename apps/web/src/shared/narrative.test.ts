import { describe, expect, it } from 'vitest';
import { buildNarrativeTokens, renderNarrative, type NarrativeTokenValues } from './narrative.js';
import { activeContentPack, activeRuleset } from '../engine/content.js';
import type { CareerState } from '@offside/domain';

const TOKENS: NarrativeTokenValues = {
  name: '김서준',
  club: '한강 FC',
  team: '한강 FC U18',
  manager: '정우성',
  rival: '이도현',
  captain: '박준서',
};

describe('renderNarrative', () => {
  it('받침 있는 이름 뒤 {name:이/가}는 "이"를 고른다 (김서준이)', () => {
    expect(renderNarrative('{name:이/가} 왔다', TOKENS)).toBe('김서준이 왔다');
  });

  it('받침 없는 이름 뒤 {name:이/가}는 "가"를 고른다', () => {
    expect(renderNarrative('{name:이/가} 왔다', { ...TOKENS, name: '메시' })).toBe('메시가 왔다');
  });

  it('로마자로 끝나는 club(한강 FC)은 받침 없음으로 취급해 "는"을 고른다', () => {
    expect(renderNarrative('{club:은/는} 강하다', TOKENS)).toBe('한강 FC는 강하다');
  });

  it('접미 없는 토큰은 값만 치환한다', () => {
    expect(renderNarrative('{manager} 감독', TOKENS)).toBe('정우성 감독');
  });

  it('을/를, 과/와, 으로/로, 아/야 조사 쌍을 모두 지원한다', () => {
    expect(renderNarrative('{name:을/를} 불렀다', TOKENS)).toBe('김서준을 불렀다');
    expect(renderNarrative('{rival:과/와} 붙었다', TOKENS)).toBe('이도현과 붙었다');
    expect(renderNarrative('{team:으로/로} 이동', TOKENS)).toBe('한강 FC U18로 이동');
    expect(renderNarrative('{captain:아/야}!', TOKENS)).toBe('박준서야!');
  });

  it('{delta:formatted}는 양수에 +를 붙이고 음수·0은 그대로 둔다', () => {
    expect(renderNarrative('전술 적합도 {delta:formatted}', { ...TOKENS, delta: 6 })).toBe('전술 적합도 +6');
    expect(renderNarrative('전술 적합도 {delta:formatted}', { ...TOKENS, delta: -3 })).toBe('전술 적합도 -3');
    expect(renderNarrative('전술 적합도 {delta:formatted}', { ...TOKENS, delta: 0 })).toBe('전술 적합도 0');
  });

  it('delta 값이 없으면 원문 토큰을 그대로 남긴다', () => {
    expect(renderNarrative('전술 적합도 {delta:formatted}', TOKENS)).toBe('전술 적합도 {delta:formatted}');
  });

  it('사전에 없는 token은 원문을 그대로 남긴다', () => {
    expect(renderNarrative('{unknown} 문구', TOKENS)).toBe('{unknown} 문구');
  });
});

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
    state: { form: 50, fitness: 100, morale: 50 },
    context: { tacticalFit: 0, squadStatus: 0, positionProficiency: 0 },
    relationships: { managerTrust: 0, captain: 0, rival: 0, fans: 0, agent: 0 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    resolvedChapterIds: [],
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

describe('buildNarrativeTokens', () => {
  it('계약이 없으면 team·club은 배경 시작 팀(한강 FC U18) 이름이다', () => {
    const tokens = buildNarrativeTokens(baseState({}), activeContentPack, activeRuleset);
    expect(tokens.team).toBe('한강 FC U18');
    expect(tokens.club).toBe('한강 FC U18');
    expect(tokens.name).toBe('김서준');
  });

  it('계약이 있으면 team·club은 계약 팀 이름이다', () => {
    const state = baseState({
      contract: {
        id: 'CTR-1',
        offerId: 'OFR-1-0',
        teamId: 'seorabeol-united',
        teamName: '서라벌 유나이티드',
        leagueTier: 1,
        lengthSeasons: 2,
        wageMinorPerWeek: 1000,
        signingBonusMinor: 100,
        rolePromise: 'BENCH',
        shirtNumber: 10,
        signatureType: 'AUTO',
        signedAtRevision: 5,
      },
    });
    const tokens = buildNarrativeTokens(state, activeContentPack, activeRuleset);
    expect(tokens.team).toBe('서라벌 유나이티드');
    expect(tokens.club).toBe('서라벌 유나이티드');
  });

  it('manager·rival·captain은 팩 narrativeTokens의 첫 값이다', () => {
    const tokens = buildNarrativeTokens(baseState({}), activeContentPack, activeRuleset);
    expect(tokens.manager).toBe(activeContentPack.narrativeTokens.manager[0]);
    expect(tokens.rival).toBe(activeContentPack.narrativeTokens.rival[0]);
    expect(tokens.captain).toBe(activeContentPack.narrativeTokens.captain[0]);
  });
});

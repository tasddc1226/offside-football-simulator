import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_KEYS } from '../schema/ruleset.ts';
import { CONDITION_FIELDS, SEASON_STATS, resolveConditionField } from '../schema/condition.ts';
import { buildConditionContext } from './condition-context.ts';
import { buildTestState, TEST_DRAFT, TEST_PROFILE } from './build-test-state.ts';

describe('buildConditionContext: DSL 필드 전수 존재', () => {
  const context = buildConditionContext(buildTestState());

  it.each(CONDITION_FIELDS.map((field) => field.path))('정적 필드 %s가 컨텍스트에 있다', (path) => {
    expect(resolveConditionField(path)).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(context, path)).toBe(true);
  });

  it.each(ATTRIBUTE_KEYS.map((key) => `player.attributes.${key}`))('동적 필드 %s가 컨텍스트에 있다', (path) => {
    expect(resolveConditionField(path)).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(context, path)).toBe(true);
  });

  it.each(SEASON_STATS.map((stat) => `season.stats.${stat}`))('동적 필드 %s가 컨텍스트에 있다', (path) => {
    expect(resolveConditionField(path)).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(context, path)).toBe(true);
  });
});

describe('buildConditionContext: 매핑', () => {
  it('career.currentRole은 contract가 없으면 RESERVE다', () => {
    const context = buildConditionContext(buildTestState({ contract: null }));
    expect(context['career.currentRole']).toBe('RESERVE');
  });

  it('career.currentRole은 contract.rolePromise를 따른다', () => {
    const context = buildConditionContext(
      buildTestState({
        contract: {
          id: 'CTR-1',
          offerId: 'OFR-1-0',
          teamId: 'hangang-u18',
          teamName: '한강 FC U18',
          leagueTier: 'YOUTH',
          lengthSeasons: 1,
          wageMinorPerWeek: 0,
          signingBonusMinor: 0,
          rolePromise: 'STARTER',
          shirtNumber: 9,
          signatureType: 'AUTO',
          signedAtRevision: 1,
        },
      }),
    );
    expect(context['career.currentRole']).toBe('STARTER');
  });

  it('player 필드는 profile이 null(DRAFT)이면 빈 문자열·0이다', () => {
    const context = buildConditionContext(buildTestState({ player: { draft: TEST_DRAFT, profile: null } }));
    expect(context['player.primaryPosition']).toBe('');
    expect(context['player.positionGroup']).toBe('');
    expect(context['player.archetypeId']).toBe('');
    expect(context['player.baseOvr']).toBe(0);
  });

  it('player.positionGroup은 포지션을 그룹으로 매핑한다', () => {
    const context = buildConditionContext(buildTestState({ player: { draft: TEST_DRAFT, profile: TEST_PROFILE } }));
    expect(context['player.positionGroup']).toBe('FWD');
  });

  it('season.tags는 Phase 1에서 항상 빈 배열이다', () => {
    const context = buildConditionContext(buildTestState());
    expect(context['season.tags']).toEqual([]);
  });
});

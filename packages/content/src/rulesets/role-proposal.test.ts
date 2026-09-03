// T-2-002 오케스트레이터 리뷰 1차 #1: computeRoleProposal의 POSITION_CHANGE 후보 필터가
// `style.preferredArchetypeIds[position].includes(archetypeId)`였다. archetypeId는 포지션 고유값이라
// 다른 포지션의 preferredArchetypeIds에는 애초에 들어갈 수 없어, 실제 룰셋에서는 이 필터가 항상
// false였다(POSITION_CHANGE가 영원히 안 나옴). 필터를 지우고 `positionAdjacency`만 남긴 뒤, 실제
// 1.0.0 룰셋(`loadRuleset`)으로 세 시나리오를 확인한다.
import { describe, expect, it } from 'vitest';
import {
  ATTRIBUTE_KEYS,
  computeRoleProposal,
  computeTacticalFit,
  findTacticalStyle,
  rankPositionForPlayer,
  type AttributeKey,
  type Competitor,
} from '@offside/domain';
import { loadRuleset } from './load-ruleset.ts';

const ruleset = loadRuleset('1.0.0');
const rules = ruleset.selectionRules;
const style = findTacticalStyle(ruleset, 'possession');

function uniformAttributes(value: number): Record<AttributeKey, number> {
  return Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, value])) as Record<AttributeKey, number>;
}

describe('computeRoleProposal — 실제 1.0.0 룰셋: POSITION_CHANGE 후보는 positionAdjacency 전부(아키타입 필터 없음)', () => {
  it('POSITION_CHANGE가 실제로 나온다: 비선호 아키타입 + 인접 포지션(ST) 스타일 점수 우위 + 그 포지션에 경쟁자가 없는 구성', () => {
    const attributes = uniformAttributes(50);
    // W 전용 능력치는 낮게, 공유·ST 전용 능력치는 높게 둬 W fit은 낮고 ST fit은 style 점수만으로도
    // W보다 15 이상 높다(아키타입 보너스는 둘 다 0 — 'w-touchline-winger'는 W에서도 ST에서도
    // preferred가 아니다).
    for (const key of ['pace', 'dribbling', 'crossing', 'agility'] as const) attributes[key] = 20;
    for (const key of ['acceleration', 'firstTouch', 'shooting', 'decisions'] as const) attributes[key] = 95;
    for (const key of ['positioning', 'composure', 'strength', 'concentration'] as const) attributes[key] = 95;
    attributes.passing = 20;
    attributes.stamina = 20;
    attributes.tackling = 20;

    const archetypeId = 'w-touchline-winger';
    const wFit = computeTacticalFit(attributes, archetypeId, 'W', style, rules);
    expect(wFit).toBe(32);
    // W의 인접 포지션은 ruleset.positions 순서로 FB·AM·ST다. FB·AM은 15 미만이라 건너뛰고 ST에서
    // 멈춘다 — 후보 순회 순서(결정론)도 함께 확인한다.
    expect(computeTacticalFit(attributes, archetypeId, 'FB', style, rules)).toBe(31);
    expect(computeTacticalFit(attributes, archetypeId, 'AM', style, rules)).toBe(40);
    expect(computeTacticalFit(attributes, archetypeId, 'ST', style, rules)).toBe(57);

    const strongCompetitor = (id: string): Competitor => ({
      id,
      name: id,
      position: 'W',
      archetypeId: 'w-inverted-winger',
      attributes,
      baseOvr: 80,
      form: 70,
      fitness: 90,
      morale: 70,
      tacticalFit: 90,
      managerTrust: 80,
      squadStatus: 90,
      rolePromise: 'STARTER',
    });
    const competitors = [strongCompetitor('C1'), strongCompetitor('C2'), strongCompetitor('C3')];

    const currentSelection = rankPositionForPlayer({
      ruleset,
      styleId: 'possession',
      position: 'W',
      playerName: '테스트선수',
      baseOvr: 55,
      tacticalFit: wFit,
      managerTrust: 40,
      form: 50,
      fitness: 80,
      morale: 60,
      familiarity: 1,
      squadStatus: 40,
      competitors,
    });
    // 3명의 강한 W 경쟁자에 밀려 PLAYER는 W에서 4위(OUT → RESERVE)다 — POSITION_CHANGE가 "더 나은
    // 역할"을 찾을 여지를 만든다.
    const currentPlayer = currentSelection.candidates.find((c) => c.id === 'PLAYER')!;
    expect(currentPlayer.rank).toBe(4);
    expect(currentPlayer.appearance).toBe('OUT');

    const proposal = computeRoleProposal({
      ruleset,
      styleId: 'possession',
      playerName: '테스트선수',
      primaryPosition: 'W',
      archetypeId,
      attributes,
      baseOvr: 55,
      rolePromise: 'STARTER',
      managerTrust: 40,
      form: 50,
      fitness: 80,
      morale: 60,
      squadStatus: 40,
      currentSelection,
      competitors,
    });

    expect(proposal).toEqual({
      type: 'POSITION_CHANGE',
      from: 'W',
      to: 'ST',
      squadRoleAfter: 'STARTER',
      tacticalFitAfter: 57,
      proficiencyAfter: rules.proficiencyOnChange.adjacent,
    });
  });

  it('GK(positionAdjacency가 빈 배열)는 절대 POSITION_CHANGE가 아니다', () => {
    expect(rules.positionAdjacency.GK).toEqual([]);

    const attributes = uniformAttributes(50);
    const gkStyle = findTacticalStyle(ruleset, 'possession');
    const gkSelection = rankPositionForPlayer({
      ruleset,
      styleId: 'possession',
      position: 'GK',
      playerName: 'GK선수',
      baseOvr: 55,
      tacticalFit: computeTacticalFit(attributes, 'gk-shot-stopper', 'GK', gkStyle, rules),
      managerTrust: 50,
      form: 50,
      fitness: 80,
      morale: 60,
      familiarity: 1,
      squadStatus: 40,
      competitors: [],
    });

    // GK는 rolePromise를 낮게(BENCH) 둬 KEEP이 아니라 뭔가는 제안되도록 하되, 후보 포지션이 아예
    // 없으니 POSITION_CHANGE는 나올 수 없고 ROLE_CHANGE로 떨어진다.
    const proposal = computeRoleProposal({
      ruleset,
      styleId: 'possession',
      playerName: 'GK선수',
      primaryPosition: 'GK',
      archetypeId: 'gk-shot-stopper',
      attributes,
      baseOvr: 55,
      rolePromise: 'BENCH',
      managerTrust: 50,
      form: 50,
      fitness: 80,
      morale: 60,
      squadStatus: 40,
      currentSelection: gkSelection,
      competitors: [],
    });

    expect(proposal.type).not.toBe('POSITION_CHANGE');
    expect(proposal).toEqual({ type: 'ROLE_CHANGE', position: 'GK', from: 'BENCH', to: 'STARTER' });
  });

  it('선호 아키타입인 평범한(균일 50 능력치) 선수는 POSITION_CHANGE를 받지 않는다', () => {
    const attributes = uniformAttributes(50);
    const archetypeId = 'w-inverted-winger'; // possession 스타일의 W 선호 아키타입
    const wFit = computeTacticalFit(attributes, archetypeId, 'W', style, rules);
    // 균일 능력치라 style 점수는 어느 포지션에서나 50이고, W는 선호 아키타입 보너스(+100×0.4=40)까지
    // 받는다. 다른 포지션은 그 보너스가 없어 style 점수(0.6×50=30)뿐이다 — 70과의 차가 15는커녕
    // 음수라 POSITION_CHANGE 조건(≥15)에 절대 못 미친다.
    expect(wFit).toBe(70);
    for (const position of ['FB', 'AM', 'ST'] as const) {
      expect(computeTacticalFit(attributes, archetypeId, position, style, rules)).toBe(30);
    }

    const currentSelection = rankPositionForPlayer({
      ruleset,
      styleId: 'possession',
      position: 'W',
      playerName: '평범선수',
      baseOvr: 55,
      tacticalFit: wFit,
      managerTrust: 50,
      form: 50,
      fitness: 80,
      morale: 60,
      familiarity: 1,
      squadStatus: 60,
      competitors: [],
    });

    const proposal = computeRoleProposal({
      ruleset,
      styleId: 'possession',
      playerName: '평범선수',
      primaryPosition: 'W',
      archetypeId,
      attributes,
      baseOvr: 55,
      rolePromise: 'STARTER',
      managerTrust: 50,
      form: 50,
      fitness: 80,
      morale: 60,
      squadStatus: 60,
      currentSelection,
      competitors: [],
    });

    expect(proposal).toEqual({ type: 'KEEP', position: 'W', squadRole: 'STARTER' });
  });
});

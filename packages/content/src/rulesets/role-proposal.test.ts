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
  squadRoleFromSelection,
  type AttributeKey,
  type Competitor,
  type Position,
  type Ruleset,
} from '@offside/domain';
import { loadRuleset } from './load-ruleset.ts';

const ruleset = loadRuleset('1.0.0');
const rules = ruleset.selectionRules;
const style = findTacticalStyle(ruleset, 'possession');

function uniformAttributes(value: number): Record<AttributeKey, number> {
  return Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, value])) as Record<AttributeKey, number>;
}

function strongCompetitor(position: Position, id: string): Competitor {
  return {
    id,
    name: id,
    position,
    archetypeId: `${position.toLowerCase()}-test`,
    attributes: uniformAttributes(90),
    baseOvr: 90,
    form: 90,
    fitness: 90,
    morale: 90,
    tacticalFit: 90,
    managerTrust: 90,
    squadStatus: 90,
    rolePromise: 'STARTER',
  };
}

function proposalFor(
  ruleset: Ruleset,
  styleId: string,
  primaryPosition: Position,
  archetypeId: string,
  competitors: readonly Competitor[],
  attributes = uniformAttributes(50),
) {
  const style = findTacticalStyle(ruleset, styleId);
  const tacticalFit = computeTacticalFit(attributes, archetypeId, primaryPosition, style, ruleset.selectionRules);
  const currentSelection = rankPositionForPlayer({
    ruleset,
    styleId,
    position: primaryPosition,
    playerName: '김민준',
    baseOvr: 55,
    tacticalFit,
    managerTrust: 50,
    form: 50,
    fitness: 80,
    morale: 60,
    familiarity: 1,
    squadStatus: 50,
    competitors,
  });
  return computeRoleProposal({
    ruleset,
    styleId,
    playerName: '김민준',
    primaryPosition,
    archetypeId,
    attributes,
    baseOvr: 55,
    rolePromise: squadRoleFromSelection(currentSelection),
    managerTrust: 50,
    form: 50,
    fitness: 80,
    morale: 60,
    squadStatus: 50,
    currentSelection,
    competitors,
  });
}

function cmProposal(ruleset: Ruleset, styleId: string, competitors: readonly Competitor[], attributes?: Record<AttributeKey, number>) {
  return proposalFor(ruleset, styleId, 'CM', 'cm-playmaker', competitors, attributes);
}

describe('issue #242 — 1.7.3 zero-slot adjacent fallback', () => {
  const previous = loadRuleset('1.7.2');
  const balanced = loadRuleset('1.7.3');

  it('counter 4-2-3-1의 CM 선발 자리가 0이면 실제 순위가 나아지는 인접 DM을 제안한다', () => {
    const oldProposal = cmProposal(previous, 'counter', []);
    const proposal = cmProposal(balanced, 'counter', []);

    expect(oldProposal).toEqual({ type: 'KEEP', position: 'CM', squadRole: 'ROTATION' });
    expect(proposal).toMatchObject({
      type: 'POSITION_CHANGE',
      from: 'CM',
      to: 'DM',
      squadRoleAfter: 'STARTER',
    });
    if (proposal.type !== 'POSITION_CHANGE') throw new Error('POSITION_CHANGE expected');
    // 이 케이스는 적합도 이득이 없다. 신규 게이트는 수치 예측이 아니라 자리+실제 ranking으로만 연다.
    expect(proposal.tacticalFitAfter).toBe(30);
  });

  it.each(['possession', 'press'] as const)('%s formation의 AM 선발 자리가 0이면 인접 CM 기회를 제안한다', (styleId) => {
    const proposal = proposalFor(balanced, styleId, 'AM', 'am-playmaker', []);
    expect(findTacticalStyle(balanced, styleId).slots.AM).toBe(0);
    expect(proposal).toMatchObject({
      type: 'POSITION_CHANGE',
      from: 'AM',
      to: 'CM',
      squadRoleAfter: 'STARTER',
    });
  });

  it('더 뒤 후보의 projectedRole이 더 좋으면 positions 순서보다 먼저 선택한다', () => {
    const competitors = [strongCompetitor('CM', 'CM-1'), strongCompetitor('DM', 'DM-1'), strongCompetitor('DM', 'DM-2')];
    // CM은 RESERVE, 먼저 검토하는 DM은 ROTATION, 나중 AM은 STARTER다.
    expect(cmProposal(balanced, 'counter', competitors)).toMatchObject({
      type: 'POSITION_CHANGE',
      to: 'AM',
      squadRoleAfter: 'STARTER',
    });
  });

  it('projectedRole이 같으면 fit이 높은 후보, fit도 같으면 기존 positions 순서를 고른다', () => {
    const currentBlocked = [strongCompetitor('CM', 'CM-1')];
    const equalFit = cmProposal(balanced, 'counter', currentBlocked);
    expect(equalFit).toMatchObject({
      type: 'POSITION_CHANGE',
      to: 'DM',
      squadRoleAfter: 'STARTER',
    });

    const amFitAttributes = uniformAttributes(50);
    for (const key of ['dribbling', 'shooting', 'agility', 'firstTouch'] as const) {
      amFitAttributes[key] = 90;
    }
    for (const key of ['tackling', 'strength', 'concentration'] as const) {
      amFitAttributes[key] = 10;
    }
    const style = findTacticalStyle(balanced, 'counter');
    const dmFit = computeTacticalFit(amFitAttributes, 'cm-playmaker', 'DM', style, balanced.selectionRules);
    const amFit = computeTacticalFit(amFitAttributes, 'cm-playmaker', 'AM', style, balanced.selectionRules);
    expect(amFit).toBeGreaterThan(dmFit);
    expect(cmProposal(balanced, 'counter', currentBlocked, amFitAttributes)).toMatchObject({
      type: 'POSITION_CHANGE',
      to: 'AM',
      squadRoleAfter: 'STARTER',
      tacticalFitAfter: amFit,
    });
  });

  it('인접 포지션이 모두 동률이거나 더 나쁘면 제안하지 않는다', () => {
    const tiedAtRotation = [strongCompetitor('DM', 'DM-1'), strongCompetitor('DM', 'DM-2'), strongCompetitor('AM', 'AM-1')];
    expect(cmProposal(balanced, 'counter', tiedAtRotation)).toEqual({
      type: 'KEEP',
      position: 'CM',
      squadRole: 'ROTATION',
    });

    const noImprovement = [...tiedAtRotation, strongCompetitor('DM', 'DM-3'), strongCompetitor('AM', 'AM-2')];
    expect(cmProposal(balanced, 'counter', noImprovement)).toEqual({
      type: 'KEEP',
      position: 'CM',
      squadRole: 'ROTATION',
    });
  });

  it('비인접 W에 자리가 있어도 DM·AM 중 개선 후보가 없으면 제안하지 않는다', () => {
    const adjacentBlocked = [
      strongCompetitor('DM', 'DM-1'),
      strongCompetitor('DM', 'DM-2'),
      strongCompetitor('DM', 'DM-3'),
      strongCompetitor('AM', 'AM-1'),
      strongCompetitor('AM', 'AM-2'),
    ];
    expect(balanced.selectionRules.positionAdjacency.CM).not.toContain('W');
    expect(findTacticalStyle(balanced, 'counter').slots.W).toBeGreaterThan(0);
    expect(cmProposal(balanced, 'counter', adjacentBlocked)).toEqual({
      type: 'KEEP',
      position: 'CM',
      squadRole: 'ROTATION',
    });
  });

  it('현재 CM 선발 자리가 있는 formation에서는 신규 fallback을 적용하지 않는다', () => {
    const cmBlocked = [
      strongCompetitor('CM', 'CM-1'),
      strongCompetitor('CM', 'CM-2'),
      strongCompetitor('CM', 'CM-3'),
      strongCompetitor('CM', 'CM-4'),
    ];
    expect(findTacticalStyle(balanced, 'possession').slots.CM).toBeGreaterThan(0);
    expect(cmProposal(balanced, 'possession', cmBlocked)).toEqual({
      type: 'KEEP',
      position: 'CM',
      squadRole: 'RESERVE',
    });
  });
});

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

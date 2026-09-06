import { loadRuleset } from '@offside/content';
import { describe, expect, it } from 'vitest';
import {
  archetypesForPosition,
  attributeLabelList,
  backgroundEffectLines,
  backgroundOpening,
  creationAgeWord,
  backgroundRiskLevel,
  positionsByGroup,
  relativeWeaknessAttributeKeys,
  shouldResetArchetype,
  topAttributeKeys,
  validateDraftName,
  weakestAttributeKeys,
} from './player-draft.js';

const ruleset = loadRuleset('1.0.0');

describe('positionsByGroup', () => {
  it('GK·DEF·MID·FWD 순으로 묶고, 없는 그룹은 뺀다', () => {
    const groups = positionsByGroup(ruleset.positions);
    expect(groups.map((group) => group.group)).toEqual(['GK', 'DEF', 'MID', 'FWD']);
    expect(groups.every((group) => group.positions.length > 0)).toBe(true);
  });
});

describe('archetypesForPosition', () => {
  it('해당 포지션의 아키타입만 돌려준다(inside-forward는 W)', () => {
    const archetypes = archetypesForPosition(ruleset, 'W');
    expect(archetypes.length).toBeGreaterThan(0);
    expect(archetypes.every((archetype) => archetype.position === 'W')).toBe(true);
    expect(archetypes.some((archetype) => archetype.id === 'inside-forward')).toBe(true);
  });
});

describe('shouldResetArchetype', () => {
  it('archetypeId가 없으면 초기화하지 않는다', () => {
    expect(shouldResetArchetype(ruleset, 'W', null)).toBe(false);
  });

  it('기존 archetype이 새 포지션과 일치하면 초기화하지 않는다', () => {
    expect(shouldResetArchetype(ruleset, 'W', 'inside-forward')).toBe(false);
  });

  it('기존 archetype이 새 포지션과 다르면 초기화한다', () => {
    expect(shouldResetArchetype(ruleset, 'ST', 'inside-forward')).toBe(true);
  });

  it('존재하지 않는 archetypeId도 초기화 대상이다', () => {
    expect(shouldResetArchetype(ruleset, 'W', 'no-such-archetype')).toBe(true);
  });
});

describe('topAttributeKeys · weakestAttributeKeys', () => {
  it('roleWeights 상위 N개를 내림차순으로 돌려준다', () => {
    const archetype = ruleset.archetypes.find((candidate) => candidate.id === 'inside-forward');
    if (archetype === undefined) throw new Error('fixture archetype missing');
    const top = topAttributeKeys(archetype, 3);
    expect(top).toHaveLength(3);
    const weights = top.map((key) => archetype.roleWeights[key] ?? 0);
    expect([...weights]).toEqual([...weights].sort((a, b) => b - a));
  });

  it('template 하위 N개를 오름차순으로 돌려준다', () => {
    const archetype = ruleset.archetypes.find((candidate) => candidate.id === 'inside-forward');
    if (archetype === undefined) throw new Error('fixture archetype missing');
    const weak = weakestAttributeKeys(archetype, 2);
    expect(weak).toHaveLength(2);
    const values = weak.map((key) => archetype.template[key] ?? 0);
    expect([...values]).toEqual([...values].sort((a, b) => a - b));
  });
});

describe('relativeWeaknessAttributeKeys', () => {
  it('같은 포지션의 역할 능력만 비교해 필드 선수에게 골키핑을 약점으로 제시하지 않는다', () => {
    const archetype = ruleset.archetypes.find((candidate) => candidate.id === 'inside-forward');
    if (archetype === undefined) throw new Error('fixture archetype missing');

    const weak = relativeWeaknessAttributeKeys(ruleset, archetype, 2);

    expect(weak).not.toContain('goalkeeping');
    expect(weak).not.toContain('tackling');
    expect(weak.length).toBeGreaterThan(0);
    expect(
      weak.every((key) =>
        ruleset.archetypes
          .filter((candidate) => candidate.position === archetype.position)
          .some((candidate) => (candidate.roleWeights[key] ?? 0) > 0),
      ),
    ).toBe(true);
  });
});

describe('attributeLabelList', () => {
  it('한국어 라벨을 콤마로 이어붙인다', () => {
    expect(attributeLabelList(['shooting', 'passing'])).toBe('슈팅, 패스');
  });
});

describe('validateDraftName', () => {
  const rules = ruleset.draftRules;

  it('규칙 범위 안이면 trim된 값을 돌려준다', () => {
    const result = validateDraftName('  김서준  ', rules);
    expect(result).toEqual({ ok: true, value: '김서준' });
  });

  it('trim 후 너무 짧으면 실패한다', () => {
    const result = validateDraftName(' 김 ', rules);
    expect(result.ok).toBe(false);
  });

  it('너무 길면 실패한다', () => {
    const result = validateDraftName('가'.repeat(rules.nameMax + 1), rules);
    expect(result.ok).toBe(false);
  });

  it('제어문자가 있으면 실패한다', () => {
    const result = validateDraftName('김서\n준', rules);
    expect(result.ok).toBe(false);
  });
});

describe('backgroundRiskLevel', () => {
  it.each([
    ['club-academy', 'LOW'],
    ['school', 'MEDIUM'],
    ['street', 'HIGH'],
  ] as const)('%s → %s', (backgroundId, expected) => {
    expect(backgroundRiskLevel(backgroundId)).toBe(expected);
  });
});

describe('backgroundOpening', () => {
  it('배경마다 계약을 보장하지 않는 서로 다른 현재 상황을 돌려준다', () => {
    expect(backgroundOpening('club-academy', '클럽 아카데미')).toMatchObject({
      title: '아카데미의 추가 평가',
    });
    expect(backgroundOpening('school', '학교 축구')).toMatchObject({
      title: '학교팀에서 만든 기록',
    });
    expect(backgroundOpening('street', '동네 클럽')).toMatchObject({
      title: '지역 무대에서 온 훈련 초대',
    });
    for (const id of ['club-academy', 'school', 'street']) {
      expect(backgroundOpening(id, id).situation).not.toMatch(/계약 확정|입단 확정|주전 보장/);
    }
  });
});

describe('backgroundEffectLines', () => {
  it('변화가 없으면 안정적이라는 한 줄을 돌려준다', () => {
    expect(backgroundEffectLines({})).toEqual(['능력치 변화 없음. 안정적인 훈련 환경.']);
  });

  it('증가·감소를 부호와 함께 표시한다', () => {
    expect(backgroundEffectLines({ pace: 3, decisions: -2 })).toEqual(['스피드 +3', '판단력 −2']);
  });
});

describe('creationAgeWord', () => {
  it('저장된 17세와 신규 19세를 각각 그대로 도입 문구에 쓴다', () => {
    expect(creationAgeWord(17)).toBe('열일곱');
    expect(creationAgeWord(19)).toBe('열아홉');
  });
});

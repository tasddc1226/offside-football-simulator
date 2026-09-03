// SCR-033 능력치 상세: `ATTRIBUTE_KEYS`를 기술·신체·정신 3묶음으로 나누고, 역할 가중치 표시·역할별
// OVR 미리보기에 쓰는 순수 함수(단위 테스트). 도메인 계산(computeBaseOvr)은 그대로 재사용하고
// 표시 전용 파생만 여기서 한다.
import { ATTRIBUTE_KEYS, computeBaseOvr, type Archetype, type AttributeKey, type Position, type Ruleset } from '@offside/domain';

export type AttributeGroupId = 'TECHNICAL' | 'PHYSICAL' | 'MENTAL';

export const ATTRIBUTE_GROUP_LABEL_KO: Record<AttributeGroupId, string> = {
  TECHNICAL: '기술',
  PHYSICAL: '신체',
  MENTAL: '정신',
};

// types.ts ATTRIBUTE_KEYS 주석: 기술 7·신체 7·정신 6, 이 순서 그대로.
const GROUP_SIZES: ReadonlyArray<{ id: AttributeGroupId; count: number }> = [
  { id: 'TECHNICAL', count: 7 },
  { id: 'PHYSICAL', count: 7 },
  { id: 'MENTAL', count: 6 },
];

export function attributeGroups(): Array<{ id: AttributeGroupId; keys: AttributeKey[] }> {
  let offset = 0;
  return GROUP_SIZES.map(({ id, count }) => {
    const keys = ATTRIBUTE_KEYS.slice(offset, offset + count) as AttributeKey[];
    offset += count;
    return { id, keys };
  });
}

/** 아키타입 roleWeights 중 가중치가 있는 키만 %로, ATTRIBUTE_KEYS 순서로. */
export function roleWeightPercentEntries(
  roleWeights: Partial<Record<AttributeKey, number>>,
): Array<{ key: AttributeKey; percent: number }> {
  const entries: Array<{ key: AttributeKey; percent: number }> = [];
  for (const key of ATTRIBUTE_KEYS) {
    const weight = roleWeights[key];
    if (weight !== undefined) entries.push({ key, percent: Math.round(weight * 100) });
  }
  return entries;
}

/** 역할별 OVR 미리보기 Tabs 후보: 같은 primaryPosition의 아키타입 전부. */
export function archetypesSharingPosition(ruleset: Ruleset, position: Position): Archetype[] {
  return ruleset.archetypes.filter((archetype) => archetype.position === position);
}

/** 표시 전용: 다른 아키타입의 roleWeights로 계산한 OVR(도메인 상태를 바꾸지 않는다). */
export function previewBaseOvr(attributes: Record<AttributeKey, number>, archetype: Archetype): number {
  return computeBaseOvr(attributes, archetype.roleWeights);
}

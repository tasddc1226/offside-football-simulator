// RULE-PLY-001: gender는 캐릭터 프로필 정보일 뿐 이벤트 조건 DSL이나 Effect target, content pack
// 분기 입력이 아니다. 이 파일은 그 불변식만 검사한다(T-1-016은 content의 조건 DSL·Effect
// 화이트리스트 로직 자체를 바꾸지 않는다).
import { describe, expect, it } from 'vitest';
import { CONDITION_FIELDS, resolveConditionField } from './schema/condition.ts';
import { CONTEXT_TARGETS, CURRENT_TARGETS, PERMANENT_TARGETS, RELATION_TARGETS } from './schema/effect.ts';

describe('RULE-PLY-001: gender는 조건 DSL 화이트리스트에 없다', () => {
  it('CONDITION_FIELDS 경로 목록에 gender가 없다', () => {
    const paths = CONDITION_FIELDS.map((field) => field.path);
    expect(paths.some((path) => path.toLowerCase().includes('gender'))).toBe(false);
  });

  it("resolveConditionField('player.gender')는 undefined다", () => {
    expect(resolveConditionField('player.gender')).toBeUndefined();
  });
});

describe('RULE-PLY-001: gender는 Effect target이 아니다', () => {
  it('PERMANENT·CURRENT·CONTEXT·RELATION target 목록 어디에도 gender가 없다', () => {
    const allTargets: readonly string[] = [
      ...PERMANENT_TARGETS,
      ...CURRENT_TARGETS,
      ...CONTEXT_TARGETS,
      ...RELATION_TARGETS,
    ];
    expect(allTargets.some((target) => target.toLowerCase().includes('gender'))).toBe(false);
  });
});

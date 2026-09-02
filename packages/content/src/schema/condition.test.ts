import { describe, expect, it } from 'vitest';
import { ConditionSchema, evaluateCondition, resolveConditionField, type Condition } from './condition.ts';

describe('ConditionSchema', () => {
  it('parses the 04 whitelist example', () => {
    const raw = {
      all: [
        { gte: ['career.age', 20] },
        { eq: ['career.currentRole', 'BENCH'] },
        { gte: ['relationships.managerTrust', 40] },
      ],
    };
    expect(() => ConditionSchema.parse(raw)).not.toThrow();
  });

  it('parses in/notIn/hasTag/any/not examples from the brief', () => {
    expect(() => ConditionSchema.parse({ in: ['career.currentRole', ['BENCH', 'RESERVE']] })).not.toThrow();
    expect(() => ConditionSchema.parse({ notIn: ['career.currentRole', ['BENCH', 'RESERVE']] })).not.toThrow();
    expect(() => ConditionSchema.parse({ hasTag: ['career.tags', '고집'] })).not.toThrow();
    expect(() =>
      ConditionSchema.parse({ any: [{ eq: ['career.age', 17] }, { eq: ['career.age', 18] }] }),
    ).not.toThrow();
    expect(() => ConditionSchema.parse({ not: { hasTag: ['career.tags', 'x'] } })).not.toThrow();
  });

  it('rejects fields outside the whitelist', () => {
    expect(() => ConditionSchema.parse({ eq: ['career.notAField', 1] })).toThrow();
  });

  it('rejects career.pathDecision (D-11: 태그로 대체, 화이트리스트에서 제거)', () => {
    expect(resolveConditionField('career.pathDecision')).toBeUndefined();
    expect(() => ConditionSchema.parse({ eq: ['career.pathDecision', 'TRYOUT'] })).toThrow();
  });

  it('rejects hasTag on a non-tags field', () => {
    expect(() => ConditionSchema.parse({ hasTag: ['career.age', 'x'] })).toThrow();
  });

  it('rejects gte with a string value on an int field', () => {
    expect(() => ConditionSchema.parse({ gte: ['career.age', '20'] })).toThrow();
  });

  it('rejects gt/gte/lt/lte on non-int fields', () => {
    expect(() => ConditionSchema.parse({ gt: ['player.primaryPosition', 1] })).toThrow();
  });

  it('rejects eq with a number on a string/enum field', () => {
    expect(() => ConditionSchema.parse({ eq: ['career.stage', 1] })).toThrow();
  });

  it('rejects an enum value outside its declared set', () => {
    expect(() => ConditionSchema.parse({ eq: ['career.stage', 'RETIRED'] })).toThrow();
  });

  it('resolves parameterized whitelist paths', () => {
    expect(resolveConditionField('player.attributes.shooting')).toEqual({
      path: 'player.attributes.shooting',
      type: 'int',
    });
    expect(resolveConditionField('season.stats.goals')).toEqual({ path: 'season.stats.goals', type: 'int' });
    expect(resolveConditionField('player.attributes.notAKey')).toBeUndefined();
    expect(resolveConditionField('season.stats.notAStat')).toBeUndefined();
  });
});

describe('evaluateCondition', () => {
  const context = { 'state.form': 40, 'career.tags': ['고집'] };

  it('missing field evaluates to false, not a throw', () => {
    expect(evaluateCondition({ eq: ['career.age', 20] }, {})).toBe(false);
    expect(evaluateCondition({ gte: ['career.age', 20] }, {})).toBe(false);
    expect(evaluateCondition({ hasTag: ['career.tags', 'x'] }, {})).toBe(false);
  });

  it.each<[string, Condition, boolean]>([
    ['all true', { all: [{ lt: ['state.form', 45] }, { hasTag: ['career.tags', '고집'] }] }, true],
    ['all false (one branch false)', { all: [{ lt: ['state.form', 45] }, { hasTag: ['career.tags', '없음'] }] }, false],
    ['any true (one branch true)', { any: [{ gte: ['state.form', 45] }, { hasTag: ['career.tags', '고집'] }] }, true],
    ['any false (both branches false)', { any: [{ gte: ['state.form', 45] }, { hasTag: ['career.tags', '없음'] }] }, false],
  ])('%s', (_label, condition, expected) => {
    expect(evaluateCondition(condition, context)).toBe(expected);
  });

  it('not negates the inner condition, including missing-field false', () => {
    expect(evaluateCondition({ not: { hasTag: ['career.tags', '에이전트_계약'] } }, {})).toBe(true);
    expect(evaluateCondition({ not: { hasTag: ['career.tags', '고집'] } }, context)).toBe(false);
  });
});

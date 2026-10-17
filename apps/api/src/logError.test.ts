import { DrizzleQueryError } from 'drizzle-orm/errors';
import { describe, expect, it } from 'vitest';
import { logErrorText, safeStack } from './logError.js';

describe('로그용 오류 한 줄 (T-11-334)', () => {
  const d1 = new Error('D1_ERROR: Network connection lost.');
  const q = new DrizzleQueryError(
    'select "id" from "profiles"\n  where "id" = ?',
    ['p_secret_profile', '홍길동'],
    d1,
  );

  it('쿼리 오류는 SQL 앞부분과 D1 사유만 남기고 바인딩 값은 뺀다', () => {
    const text = logErrorText(q);
    expect(text).toBe(
      'Failed query: select "id" from "profiles" where "id" = ? | cause: D1_ERROR: Network connection lost.',
    );
    expect(text).not.toContain('p_secret_profile');
    expect(safeStack(q)).not.toContain('홍길동');
    expect(safeStack(q)).toMatch(/^Error\n {4}at /);
  });

  it('보통 오류 · 문자열 · 깊은 cause는 그대로 줄이고 길이를 자른다', () => {
    expect(logErrorText('boom')).toBe('boom');
    expect(logErrorText(new TypeError('x is undefined'))).toBe('TypeError: x is undefined');
    const deep = new Error('a', {
      cause: new Error('b', { cause: new Error('c', { cause: 'd' }) }),
    });
    expect(logErrorText(deep)).toBe('a | cause: b | cause: c');
    expect(logErrorText(new Error('x'.repeat(900)), 50)).toHaveLength(50);
    const plain = new Error('plain');
    expect(safeStack(plain)).toBe(plain.stack);
  });
});

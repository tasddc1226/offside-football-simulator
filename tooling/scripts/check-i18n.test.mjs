import { describe, expect, it } from 'vitest';
import { compare, hangulRuns } from './check-i18n.mjs';

describe('check-i18n', () => {
  it('주석·i18n-ignore 줄의 한글은 세지 않고, 문자열·마크업 문구는 센다', () => {
    const src = [
      '// 주석 한글',
      "const a = '안녕하세요'; // 꼬리 주석",
      '/* 블록',
      '   주석 */',
      "const url = 'https://example.com'; const b = `골 ${n}개`;",
      "if (role === '주전') x(); // i18n-ignore 저장값",
      '// i18n-ignore 다음 줄은 저장값',
      "const foot = '양발';",
      '<!-- 마크업 주석 -->',
      '<p>아직 기록이 없어요.</p>',
      '<b>',
      '  여러 줄에 걸친',
      '  문구</b>',
    ].join('\n');
    expect(hangulRuns(src)).toEqual([
      [2, '안녕하세요'],
      [5, '골'],
      [5, '개'],
      [10, '아직 기록이 없어요'],
      [12, '여러 줄에 걸친 문구'],
    ]);
  });

  it('기준선보다 늘면 grew, 줄면 shrank', () => {
    const found = {
      'a.ts': [[1, '가']],
      'b.ts': [
        [1, '나'],
        [2, '다'],
      ],
    };
    const { grew, shrank } = compare(found, { 'b.ts': 1, 'c.ts': 3 });
    expect(grew.map((g) => g.file)).toEqual(['a.ts', 'b.ts']);
    expect(shrank).toEqual([{ file: 'c.ts', now: 0, was: 3 }]);
  });
});

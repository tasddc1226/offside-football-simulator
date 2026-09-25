import { describe, expect, it } from 'vitest';
import { parseBody } from './boardText.js';

describe('parseBody', () => {
  it('소제목·목록·문단을 나누고 HTML은 글자 그대로 둔다', () => {
    expect(parseBody('## 새 기능\n- 클럽 동기화\n* 게시판\n\n첫 줄\n둘째 줄\n\n\n<b>굵게</b>')).toEqual([
      { kind: 'h', text: '새 기능' },
      { kind: 'ul', items: ['클럽 동기화', '게시판'] },
      { kind: 'p', lines: ['첫 줄', '둘째 줄'] },
      { kind: 'p', lines: ['<b>굵게</b>'] },
    ]);
  });
  it('빈 본문은 블록이 없다', () => {
    expect(parseBody('\n\n')).toEqual([]);
  });
});

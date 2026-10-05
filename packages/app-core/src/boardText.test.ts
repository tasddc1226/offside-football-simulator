import { describe, expect, it } from 'vitest';
import { hideLines, parseBody } from './boardText.js';

describe('parseBody', () => {
  it('소제목·목록·문단을 나누고 HTML은 글자 그대로 둔다', () => {
    expect(
      parseBody('## 새 기능\n- 클럽 동기화\n* 게시판\n\n첫 줄\n둘째 줄\n\n\n<b>굵게</b>'),
    ).toEqual([
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

describe('hideLines', () => {
  const re = /안드로이드|android/i;
  it('걸리는 줄을 빼고, 걸리는 소제목은 다음 소제목 전까지 뺀다', () => {
    const body = [
      '## 출시',
      '- iOS 출시',
      '- Android 준비 중',
      '## 안드로이드 테스터 모집',
      '- 신청해 주세요',
      '',
      '긴 안내',
      '## 그 밖에',
      '- 고쳤어요',
    ].join('\n');
    expect(hideLines(body, re)).toBe(
      ['## 출시', '- iOS 출시', '## 그 밖에', '- 고쳤어요'].join('\n'),
    );
  });
  it('걸리는 게 없으면 줄바꿈만 맞춘 원문 그대로다', () => {
    expect(hideLines('a\r\nb', re)).toBe('a\nb');
  });
});

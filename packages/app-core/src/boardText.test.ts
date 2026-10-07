import { describe, expect, it } from 'vitest';
import { hideLines, parseBody } from './boardText.js';
import { draftOf, inputOf } from './boardEditor.js';

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

describe('T-11-146 글 편집기 번역 칸', () => {
  const post = {
    id: 'pst_1',
    board: 'notice',
    title: 'Maintenance',
    body: 'Tonight',
    version: null,
    pinned: true,
    commentCount: 0,
    viewCount: 0,
    likeCount: 0,
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:00:00.000Z',
  } as const;
  it('고칠 때는 화면 언어가 아니라 원문과 저장된 번역으로 채운다', () => {
    const d = draftOf(post, {
      title: '점검',
      body: '오늘 밤',
      i18n: { en: { title: 'Maintenance', body: 'Tonight' } },
    });
    expect(d).toMatchObject({ title: '점검', body: '오늘 밤', pinned: true });
    expect(d.en).toEqual({ title: 'Maintenance', body: 'Tonight' });
    expect(d.ja).toEqual({ title: '', body: '' });
  });
  it('빈 언어는 빼고, 반쯤 쓴 언어는 저장하지 않는다', () => {
    const d = draftOf();
    Object.assign(d, { title: '점검', body: '본문' });
    expect(inputOf(d)).toEqual({ input: { title: '점검', body: '본문', pinned: false, i18n: {} } });
    d.ja.title = '点検';
    expect(inputOf(d)).toEqual({ incomplete: 'ja' });
    d.ja.body = ' 今夜 ';
    expect(inputOf(d)).toMatchObject({ input: { i18n: { ja: { title: '点検', body: '今夜' } } } });
  });
});

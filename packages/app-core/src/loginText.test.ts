import { describe, expect, it } from 'vitest';
import { googleFailText, loginDoneText } from './loginText.js';

describe('loginText', () => {
  it('알려진 reason은 안내 문구, 모르는 reason은 코드를 붙인다', () => {
    expect(googleFailText('rate_limited')).toBe(
      '로그인 시도가 너무 많아요. 잠시 뒤 다시 시도해 주세요.',
    );
    expect(googleFailText('state')).toBe('구글 로그인에 실패했어요 (state).');
    expect(googleFailText(null)).toBe('구글 로그인에 실패했어요.');
  });
  it('연결·전환 안내', () => {
    expect(loginDoneText('linked', '구글')).toBe('구글 계정을 연결했어요.');
    expect(loginDoneText('switched', 'Apple')).toBe('다른 Apple 계정으로 바꿨어요.');
  });
});

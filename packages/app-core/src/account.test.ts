import { describe, expect, it } from 'vitest';
import { accountLabel, isMember } from './account.js';

const linked = (google: boolean, apple: boolean) => ({ google, apple, toss: false });

describe('isMember', () => {
  it('구글이나 애플 중 하나라도 연결돼 있으면 회원이다', () => {
    expect(isMember({ linked: linked(true, false) })).toBe(true);
    expect(isMember({ linked: linked(false, true) })).toBe(true);
    expect(isMember({ linked: linked(false, false) })).toBe(false);
  });
});

describe('accountLabel', () => {
  it('구글 계정은 가린 이메일, 없으면 구글 계정', () => {
    expect(
      accountLabel({ linked: linked(true, true), googleEmailMasked: 'a***@gmail.com' }),
    ).toEqual({
      title: 'a***@gmail.com',
      via: 'Google 계정으로 로그인했어요.',
    });
    expect(accountLabel({ linked: linked(true, false), googleEmailMasked: null }).title).toBe(
      '구글 계정',
    );
  });
  it('애플 전용 계정', () => {
    expect(accountLabel({ linked: linked(false, true), googleEmailMasked: null })).toEqual({
      title: 'Apple 계정',
      via: 'Apple 계정으로 로그인했어요.',
    });
  });
});

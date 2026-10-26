import { describe, expect, it } from 'vitest';
import { accountLabel, isMember, runProfileDeletion } from './account.js';

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
      via: '구글 계정으로 로그인했어요.',
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

describe('runProfileDeletion (T-11-441)', () => {
  const err = {
    ok: false as const,
    error: { code: 'INTERNAL' as const, message: 'x', retryable: true },
  };
  it('시작 토큰으로 확정하고 성공을 돌려준다', async () => {
    const tokens: string[] = [];
    const ok = await runProfileDeletion({
      start: async () => ({ ok: true, data: { confirmToken: 't1' } }),
      confirm: async (t) => {
        tokens.push(t);
        return { ok: true, data: undefined };
      },
    });
    expect(ok).toBe(true);
    expect(tokens).toEqual(['t1']);
  });
  it('시작이 실패하면 확정을 부르지 않고 실패', async () => {
    let confirms = 0;
    const ok = await runProfileDeletion({
      start: async () => err,
      confirm: async () => {
        confirms++;
        return { ok: true, data: undefined };
      },
    });
    expect(ok).toBe(false);
    expect(confirms).toBe(0);
  });
  it('확정이 실패하면 실패', async () => {
    const ok = await runProfileDeletion({
      start: async () => ({ ok: true, data: { confirmToken: 't1' } }),
      confirm: async () => err,
    });
    expect(ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { canJumpToMyRank, myRankJump } from './myRank.js';

describe('canJumpToMyRank (T-11-441)', () => {
  it('로그인한 구단주만', () => {
    expect(canJumpToMyRank(true, 'rating')).toBe(true);
    expect(canJumpToMyRank(true, 'ovr')).toBe(true);
    expect(canJumpToMyRank(true, 'value')).toBe(true);
    expect(canJumpToMyRank(true)).toBe(true);
    expect(canJumpToMyRank(false, 'rating')).toBe(false);
  });
});

describe('myRankJump (T-11-441)', () => {
  it('me가 있으면 그 페이지와 순위', () => {
    const data = { page: 3, me: { rank: 45 } };
    expect(myRankJump({ ok: true, data }, 'team')).toEqual({ ok: true, data, rank: 45 });
  });
  it('랭킹에 없으면 팀 · 업적에 맞는 안내', () => {
    expect(myRankJump({ ok: true, data: { me: null } }, 'team')).toEqual({
      ok: false,
      message: '이 시즌 랭킹에 내 팀이 없어요.',
    });
    expect(myRankJump({ ok: true, data: { me: null } }, 'ach')).toEqual({
      ok: false,
      message: '이 시즌 업적 랭킹에 내 기록이 없어요.',
    });
  });
  it('실패하면 실패 안내', () => {
    const r = myRankJump(
      { ok: false, error: { code: 'NETWORK_ERROR', message: 'x', retryable: true } },
      'ach',
    );
    expect(r).toEqual({
      ok: false,
      message: '내 순위를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
    });
  });
});

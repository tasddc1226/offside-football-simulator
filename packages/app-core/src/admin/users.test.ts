import { describe, expect, it } from 'vitest';
import { teamLine } from './users.js';

describe('운영 도구 유저 조회 팀 줄', () => {
  it('T-11-800 시즌 1까지 팀은 레이팅, 시즌 2부터는 RP로 적는다', () => {
    const team = {
      name: '수영 FC',
      ovr: 88,
      filled: 11,
      rating: 1234,
      wins: 10,
      draws: 2,
      losses: 3,
    };
    expect(teamLine({ ...team, season: 1 })).toBe(
      '시즌 1 · 수영 FC · OVR 88 · 선발 11/11 · 레이팅 1234 · 10승 2무 3패',
    );
    expect(teamLine({ ...team, season: 2 })).toBe(
      '시즌 2 · 수영 FC · OVR 88 · 선발 11/11 · 1234 RP · 10승 2무 3패',
    );
  });
});

import { planLeague } from '@offside/contracts/league';
import { describe, expect, it } from 'vitest';
import type { LeagueResponse } from './api/league.js';
import { leagueLine, leagueReadiness, leagueSchedule } from './leagueView.js';

const plan = planLeague(2, '2026-10-30T15:00:00.000Z');
const league = { ...plan, rounds: [...plan.rounds] };
const data = (phase: LeagueResponse['phase']): LeagueResponse => ({ league, phase, entries: 12 });

describe('leagueView (T-11-418)', () => {
  it('일정은 한국 시간으로 신청 · 배치 · 라운드를 보인다', () => {
    expect(leagueSchedule(league).map((r) => r.text)).toEqual([
      '10월 24일 00:00 ~ 11월 4일 23:59',
      '10월 31일 00:00',
      '11월 5일 09:00',
      '11월 5일 ~ 11월 18일, 매일 13:00',
    ]);
  });
  it('단계마다 배너 한 줄', () => {
    expect(leagueLine(data('soon'))).toBe('10월 24일 00:00부터 신청받아요.');
    expect(leagueLine(data('open'))).toBe('12팀 신청 · 11월 4일 23:59까지');
    expect(leagueLine(data('closed'))).toBe('11월 5일 09:00에 부와 리그 배치를 발표해요.');
  });
  it('준비 상태: 개막 전엔 없음, 팀 없음 · 모자람 · 준비 완료', () => {
    const me = (team: { filled: number } | null) => ({
      entry: null,
      canEnter: true,
      team: team && { teamId: 'tem_1', filled: team.filled, ovr: 80 },
    });
    const before = Date.parse('2026-10-28T00:00:00.000Z');
    const after = Date.parse('2026-11-01T00:00:00.000Z');
    expect(leagueReadiness(data('open'), me(null), before)).toBeNull();
    expect(leagueReadiness(data('open'), me(null), after)?.text).toBe(
      '아직 시즌 2 팀이 없어요. 배치 전까지 팀을 만들고 선발에 내 은퇴 선수 8명을 채워야 리그에 들어가요.',
    );
    expect(leagueReadiness(data('open'), me({ filled: 6 }), after)).toEqual({
      ok: false,
      text: '선발에 내 은퇴 선수가 6/8명이에요. 배치 전까지 8명을 채워야 리그에 들어가요.',
    });
    expect(leagueReadiness(data('open'), me({ filled: 9 }), after)?.ok).toBe(true);
  });
});

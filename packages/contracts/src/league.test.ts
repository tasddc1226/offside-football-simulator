import { describe, expect, it } from 'vitest';
import { leagueSeasonAt, planLeague } from './league.js';
import type { ServiceSeason } from './service-seasons.js';

const s1: ServiceSeason = {
  id: 1,
  name: 'S1',
  startsAt: '2026-10-05T15:00:00.000Z',
  endsAt: null,
  retireAt: 45,
};

describe('leagueSeasonAt (T-11-418c)', () => {
  it('다음 시즌이 일정에 없으면 지금 시즌 최대 기간 끝을 잠정 개막으로 쓴다', () => {
    const s = leagueSeasonAt('2026-10-20T00:00:00.000Z', [s1]);
    // T-11-528 최대 기간 60일: 10-06 00:00 KST + 60일 = 12-05 00:00 KST, 사전 신청은 7일 전 11-28 00:00 KST.
    expect(s).toMatchObject({ id: 2, startsAt: '2026-12-04T15:00:00.000Z' });
    expect(planLeague(s!.id, s!.startsAt).opensAt).toBe('2026-11-27T15:00:00.000Z');
  });

  it('마감이 확정되면 그 마감을 개막으로', () => {
    const closed = { ...s1, endsAt: '2026-10-28T15:00:00.000Z' };
    expect(leagueSeasonAt('2026-10-20T00:00:00.000Z', [closed])?.startsAt).toBe(
      '2026-10-28T15:00:00.000Z',
    );
  });

  it('개막한 시즌의 리그가 끝나기 전에는 그 시즌, 끝나면 다음 시즌', () => {
    const s2: ServiceSeason = { ...s1, id: 2, startsAt: '2026-10-30T15:00:00.000Z' };
    const seasons = [{ ...s1, endsAt: s2.startsAt }, s2];
    expect(leagueSeasonAt('2026-11-10T00:00:00.000Z', seasons)?.id).toBe(2);
    // 마지막 라운드(11/18 13:00 KST) 뒤 하루가 지나면 다음 시즌(잠정).
    expect(leagueSeasonAt('2026-11-19T05:00:00.000Z', seasons)?.id).toBe(3);
  });
});

import { describe, expect, it } from 'vitest';
import {
  LEAGUE_CYCLE,
  leagueFixtures,
  leagueLateSlotAt,
  leagueLateSlots,
  leagueNextLate,
  leagueRoundPairs,
  leagueSeasonAt,
  planLeague,
} from './league.js';
import { gaugeRules } from './season-gauge.js';
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
    expect(s).toMatchObject({ id: 2, startsAt: '2026-10-30T15:00:00.000Z' });
    expect(planLeague(s!.id, s!.startsAt).opensAt).toBe('2026-10-23T15:00:00.000Z');
  });

  it('마감이 확정되면 그 마감을 개막으로', () => {
    const closed = { ...s1, endsAt: '2026-10-28T15:00:00.000Z' };
    expect(leagueSeasonAt('2026-10-20T00:00:00.000Z', [closed])?.startsAt).toBe(
      '2026-10-28T15:00:00.000Z',
    );
  });

  it('개막한 시즌의 리그가 끝나기 전에는 그 시즌, 끝나면 다음 시즌', () => {
    // 시즌 2: 10/31 00:00 KST 개막, 12/5 00:00 KST 마감.
    const s2: ServiceSeason = {
      ...s1,
      id: 2,
      startsAt: '2026-10-30T15:00:00.000Z',
      endsAt: '2026-12-04T15:00:00.000Z',
    };
    const seasons = [{ ...s1, endsAt: s2.startsAt }, s2];
    expect(leagueSeasonAt('2026-11-19T05:00:00.000Z', seasons)?.id).toBe(2);
    // T-11-540 마지막 라운드(마감 전날 12/4 13:00 KST) 뒤 하루가 지나면 다음 시즌.
    expect(leagueSeasonAt('2026-12-05T03:00:00.000Z', seasons)?.id).toBe(2);
    expect(leagueSeasonAt('2026-12-05T05:00:00.000Z', seasons)?.id).toBe(3);
  });
});

describe('planLeague 시즌 내내 (T-11-540)', () => {
  const S2 = '2026-10-30T15:00:00.000Z';
  it('배치 날부터 시즌 마감 전날까지 매일 13:00 KST 한 라운드', () => {
    const l = planLeague(2, S2, '2026-12-04T15:00:00.000Z');
    expect(l.drawAt).toBe('2026-11-05T00:00:00.000Z');
    expect(l.rounds[0]).toBe('2026-11-05T04:00:00.000Z');
    expect(l.rounds.at(-1)).toBe('2026-12-04T04:00:00.000Z');
    expect(l.rounds).toHaveLength(30);
  });

  it('마감이 없으면 최대 기간 끝을 마감으로 보고, 마감이 당겨지면 라운드가 준다', () => {
    const open = planLeague(2, S2);
    const end = Date.parse(S2) + gaugeRules(2).maxDays * 86_400_000;
    expect(Date.parse(open.rounds.at(-1)!)).toBe(end - 11 * 3_600_000);
    expect(planLeague(2, S2, '2026-12-01T15:00:00.000Z').rounds).toHaveLength(27);
  });

  it('한 바퀴(14라운드) 일정을 되풀이한다', () => {
    const cycle = leagueFixtures(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(cycle).toHaveLength(LEAGUE_CYCLE);
    expect(leagueRoundPairs(cycle, LEAGUE_CYCLE + 3)).toEqual(cycle[3]);
  });
});

describe('늦은 참가 배치 (T-11-564)', () => {
  const S2 = '2026-10-30T15:00:00.000Z';
  const day = 86_400_000;
  const at = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();

  it('첫 배치 뒤 7일마다 같은 시각, 남은 라운드가 7개 이상인 배치만 열고 마지막을 표시한다', () => {
    // 11/5 ~ 12/4 30라운드: 11/12(8라운드) · 11/19(15) · 11/26(22)까지, 12/3은 2라운드만 남아 빠진다.
    const l = planLeague(2, S2, '2026-12-04T15:00:00.000Z');
    expect(leagueLateSlots(l)).toEqual([
      { at: '2026-11-12T00:00:00.000Z', firstRound: 8, last: false },
      { at: '2026-11-19T00:00:00.000Z', firstRound: 15, last: false },
      { at: '2026-11-26T00:00:00.000Z', firstRound: 22, last: true },
    ]);
    // 14라운드 시즌: 11/12에 7라운드가 남아 한 번만.
    const short = planLeague(2, S2, '2026-11-18T15:00:00.000Z');
    expect(leagueLateSlots(short)).toEqual([
      { at: '2026-11-12T00:00:00.000Z', firstRound: 8, last: true },
    ]);
    expect(leagueLateSlots(planLeague(2, S2, '2026-11-17T15:00:00.000Z'))).toEqual([]);
  });

  it('배치 시간(09:00 ~ 첫 라운드 13:00) 안에서만 배치하고, 신청은 그 배치가 끝날 때까지 다음 배치로 받는다', () => {
    const l = planLeague(2, S2, '2026-12-04T15:00:00.000Z');
    const [a, b] = leagueLateSlots(l);
    expect(leagueNextLate(l, at(l.drawAt, -1))).toBeNull();
    expect(leagueNextLate(l, l.drawAt)).toEqual(a);
    expect(leagueLateSlotAt(l, at(a!.at, -1))).toBeNull();
    expect(leagueLateSlotAt(l, a!.at)).toEqual(a);
    expect(leagueLateSlotAt(l, at(a!.at, 4 * 3_600_000 - 1))).toEqual(a);
    expect(leagueLateSlotAt(l, at(a!.at, 4 * 3_600_000))).toBeNull();
    expect(leagueNextLate(l, at(a!.at, 4 * 3_600_000))).toEqual(b);
    expect(leagueNextLate(l, at(l.drawAt, 30 * day))).toBeNull();
  });
});

import { RN_LEAGUE_TIER } from '@offside/contracts/retired-numbers';
import { describe, expect, it } from 'vitest';
import { LEAGUES } from './data.js';
import { clubsOf, nearRetiredNumber } from './retired-number.js';

describe('영구결번 심사 (T-10-076)', () => {
  it('판정 규칙의 리그 등급이 게임 리그 표와 같다', () => {
    expect(RN_LEAGUE_TIER).toEqual(Object.fromEntries(LEAGUES.map((l) => [l.name, l.tier])));
  });

  it('clubId 없는 옛 시즌도 구단 이름으로 찾아 묶는다', () => {
    const rec = (year: number, clubId?: string) => ({
      year,
      club: '맨체스터 스카이블루',
      clubId,
      league: '프리미어리그',
      apps: 38,
      goals: 30,
      assists: 10,
      cs: 0,
      honors: ['프리미어리그 우승', 'UEFA 챔피언스리그 우승', '발롱도르'],
    });
    const clubs = clubsOf({ pos: 'FW', career: [rec(2030), rec(2031, 'pl-0')] as never });
    expect(clubs).toHaveLength(1);
    expect(clubs[0]).toMatchObject({ clubId: 'pl-0', seasons: 2 });
    expect(nearRetiredNumber(clubs[0])).toBe(false);
  });
});

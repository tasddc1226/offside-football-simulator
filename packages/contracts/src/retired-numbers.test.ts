import { describe, expect, it } from 'vitest';
import { defaultClubIds } from './club-names.js';
import {
  clubContributions,
  honorPoints,
  RN_CUT,
  rnCandidates,
  rnQualifies,
  type RnSeason,
} from './retired-numbers.js';

const season = (over: Partial<RnSeason> = {}): RnSeason => ({
  year: 2030,
  club: '맨체스터 스카이블루',
  clubId: 'pl-0',
  league: '프리미어리그',
  apps: 38,
  goals: 20,
  assists: 10,
  cs: 0,
  honors: [],
  ...over,
});

describe('영구결번 구단 기여 점수 (T-10-076)', () => {
  it('구단 우승·개인상은 점수, 대표팀 대회·협회 상은 0점', () => {
    expect(honorPoints('발롱도르')).toBe(60);
    expect(honorPoints('UEFA 챔피언스리그 우승')).toBe(40);
    expect(honorPoints('AFC 챔피언스리그 엘리트 우승')).toBe(20);
    expect(honorPoints('프리미어리그 우승')).toBe(25);
    expect(honorPoints('FA컵 우승')).toBe(8);
    expect(honorPoints('커뮤니티 실드 우승')).toBe(3);
    expect(honorPoints('프리미어리그 득점왕')).toBe(10);
    expect(honorPoints('월드컵 우승')).toBe(0);
    expect(honorPoints('대한축구협회 올해의 선수')).toBe(0);
  });

  it('병역·고교·대학 시즌은 빼고, clubId 없는 옛 시즌은 이름으로 같은 구단에 묶는다', () => {
    const ids = defaultClubIds();
    const clubs = clubContributions(
      'FW',
      [
        season({ league: '고교 리그', club: '한빛고', clubId: undefined }),
        season({ mil: true, club: '김천 상무 (국군체육부대)', clubId: 'sangmu' }),
        season({ year: 2031, clubId: undefined }),
        season({ year: 2032 }),
      ],
      (n) => ids.get(n),
    );
    expect(clubs).toHaveLength(1);
    expect(clubs[0]).toMatchObject({ clubId: 'pl-0', seasons: 2, from: 2031, to: 2032 });
    // (6 + 20×0.42 + 10×0.35 + 38×0.05) × (0.4 + 0.075×8) = 19.8점씩
    expect(clubs[0]!.play).toBeCloseTo(39.6, 5);
  });

  it('구단을 모르면 자격이 없고, 시즌·점수 기준을 모두 채워야 한다', () => {
    const legend = (n: number, over: Partial<RnSeason> = {}) =>
      Array.from({ length: n }, (_, i) =>
        season({
          year: 2030 + i,
          honors: ['프리미어리그 우승', 'UEFA 챔피언스리그 우승', '발롱도르'],
          ...over,
        }),
      );
    const [ok] = clubContributions('FW', legend(6));
    expect(ok!.score).toBeGreaterThanOrEqual(RN_CUT);
    expect(rnQualifies(ok!)).toBe(true);
    expect(rnQualifies(clubContributions('FW', legend(5))[0]!)).toBe(false);
    expect(
      rnQualifies(clubContributions('FW', legend(8, { clubId: undefined, club: '우리 시티' }))[0]!),
    ).toBe(false);
    // 자격 있는 구단만 최대 두 곳.
    const two = clubContributions('FW', [
      ...legend(8),
      ...legend(8).map((s) => ({
        ...s,
        year: s.year + 10,
        club: '리버풀 더 레즈',
        clubId: 'pl-1',
      })),
      ...legend(3).map((s) => ({ ...s, year: s.year + 20, club: '런던 거너스', clubId: 'pl-2' })),
    ]);
    expect(rnCandidates(two).map((c) => c.clubId)).toEqual(['pl-0', 'pl-1']);
  });
});

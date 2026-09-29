import { describe, expect, it } from 'vitest';
import { defaultClubIds, defaultClubName, isDefaultClubId } from './club-names.js';
import {
  clubContributions,
  honorPoints,
  RN_BOND,
  RN_CUT,
  RN_SEASON_HONOR_CAP,
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
    expect(clubs[0]).toMatchObject({ clubId: 'pl-0', seasons: 2 });
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

  it('게임에 없는 클럽 id는 인정하지 않고, 리그는 클럽의 리그로 정하며, 한 시즌 영예 점수엔 상한이 있다', () => {
    expect(isDefaultClubId('pl-0')).toBe(true);
    expect(isDefaultClubId('pl-99')).toBe(false);
    expect(isDefaultClubId('zz-0')).toBe(false);
    // 기록실·알림은 유저가 바꿔 부른 이름 대신 게임 기본 이름을 쓴다.
    expect(defaultClubName('pl-0')).toBe('맨체스터 스카이블루');
    expect(defaultClubName('pl-99')).toBeNull();
    expect(defaultClubName('맨체스터')).toBeNull();
    const [fake] = clubContributions('FW', [season({ clubId: 'pl-99', club: '가짜 구단' })]);
    expect(fake!.clubId).toBeNull();
    // K리그2 클럽이 프리미어리그라고 적어 보내도 K리그2 배수(0.475)로 센다.
    const [k2] = clubContributions('FW', [season({ clubId: 'k2-0', league: '프리미어리그' })]);
    expect(k2!.play).toBeCloseTo((6 + 20 * 0.42 + 10 * 0.35 + 38 * 0.05) * 0.475, 5);
    // 같은 영예를 여러 번 적거나 수십 개를 붙여도 한 시즌 상한까지만.
    const spam = Array.from({ length: 30 }, (_, i) => `발롱도르 ${i}`);
    const [capped] = clubContributions('FW', [season({ honors: [...spam, ...spam] })]);
    expect(capped!.honors).toBe(RN_SEASON_HONOR_CAP);
  });

  it('구단 애착: 원클럽맨 20%, 아니면 은퇴 구단·친정 복귀·10시즌 연속을 5%씩(병역은 연속을 끊지 않는다)', () => {
    const at = (year: number, club: string, clubId: string, over: Partial<RnSeason> = {}) =>
      season({ year, club, clubId, ...over });
    const years = (from: number, n: number, club: string, clubId: string) =>
      Array.from({ length: n }, (_, i) => at(from + i, club, clubId));
    const base = (c: ReturnType<typeof clubContributions>[number]) => c.play + c.honors;

    // 원클럽맨(8시즌) — 원클럽 몫만.
    const [one] = clubContributions('FW', years(2030, 8, '맨체스터 스카이블루', 'pl-0'));
    expect(one!.bond).toBeCloseTo(base(one!) * RN_BOND.oneClub);
    expect(one!.score).toBeCloseTo(base(one!) * 1.2);

    // 스카이블루 10시즌 연속(중간 병역 1시즌) → 리버풀 2시즌 → 스카이블루로 돌아와 은퇴: 은퇴·복귀·연속 = 15%.
    const home = clubContributions('FW', [
      ...years(2030, 5, '맨체스터 스카이블루', 'pl-0'),
      at(2035, '김천 상무 (국군체육부대)', 'k1-9', { mil: true }),
      ...years(2036, 5, '맨체스터 스카이블루', 'pl-0'),
      ...years(2041, 2, '리버풀 더 레즈', 'pl-1'),
      ...years(2043, 2, '맨체스터 스카이블루', 'pl-0'),
    ]);
    const sky = home.find((c) => c.clubId === 'pl-0')!;
    expect(sky.bond / base(sky)).toBeCloseTo(0.15);
    // 거쳐 간 구단은 애착이 없다.
    expect(home.find((c) => c.clubId === 'pl-1')!.bond).toBe(0);
  });
});

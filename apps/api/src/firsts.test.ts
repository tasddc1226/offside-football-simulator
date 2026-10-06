import { describe, expect, it } from 'vitest';
import {
  evaluateCareer,
  evaluateRecords,
  firstsCatalog,
  RETIRE_CAP_FIRST,
  type FirstCareer,
  RECORDS,
  type FirstSeason,
} from './firsts.js';
import { firstLabelEn, recordTextEn } from './firstsText.js';

let t = 0;
const season = (over: Partial<FirstSeason> = {}): FirstSeason => ({
  year: 2030 + t,
  age: 22,
  club: 'A FC',
  league: 'K리그1',
  apps: 30,
  goals: 10,
  assists: 5,
  cs: 0,
  caps: 0,
  rating: 7,
  ovr: 70,
  honors: [],
  mil: false,
  createdAt: `2026-09-26T00:00:${String(t++).padStart(2, '0')}.000Z`,
  ...over,
});
const career = (seasons: FirstSeason[], over: Partial<FirstCareer> = {}): FirstCareer => ({
  id: 'c1',
  legendScore: null,
  retiredAt: null,
  seasons,
  ...over,
});
const ids = (c: FirstCareer) => evaluateCareer(c).map((g) => g.id);

describe('서버 최초 기록 규칙 (T-10-027)', () => {
  it('id는 겹치지 않고 짧은 소문자 키, 문장은 계약 길이 안이다', () => {
    const list = firstsCatalog([]).map((d) => d.id);
    expect(new Set(list).size).toBe(list.length);
    for (const d of firstsCatalog(['goals900', 'ballon7'])) {
      expect(d.id).toMatch(/^[a-z0-9_]{1,32}$/);
      expect(d.label.length).toBeLessThanOrEqual(80);
    }
  });

  it('통산 기록은 누적이 처음 목표를 넘은 시즌의 업로드 시각으로 잡는다', () => {
    const s = [season({ goals: 60 }), season({ goals: 30 }), season({ goals: 20 })];
    const got = evaluateCareer(career(s)).find((g) => g.id === 'goals100');
    expect(got).toEqual({ id: 'goals100', at: s[2]!.createdAt, year: s[2]!.year });
    expect(ids(career(s))).not.toContain('goals150');
  });

  it('시즌·나이·한 클럽·리그 수 조건', () => {
    expect(ids(career([season({ goals: 41, age: 20 })]))).toEqual(
      expect.arrayContaining(['sgoals30', 'sgoals40', 'teen20']),
    );
    expect(ids(career([season({ rating: 8.6, apps: 10 })]))).not.toContain('srating80'); // 15경기 미만은 평점 기록 제외
    expect(ids(career([season({ rating: 8.6, apps: 15 })]))).toEqual(
      expect.arrayContaining(['srating80', 'srating85']),
    );
    const loyal = Array.from({ length: 10 }, (_, i) => season({ mil: i === 4 }));
    expect(ids(career(loyal))).not.toContain('oneclub10'); // 군 복무 시즌은 세지 않는다
    expect(ids(career([...loyal, season()]))).toContain('oneclub10');
    const leagues = ['K리그1', '프리미어리그', '라리가', '세리에 A', '분데스리가'].map((league) =>
      season({ league }),
    );
    expect(ids(career(leagues))).toContain('leagues5');
  });

  it('수상·우승: 횟수, 트레블(리그 + 국내 컵 + 대륙 최상위 대회)', () => {
    const treble = season({
      honors: ['발롱도르', 'UEFA 챔피언스리그 우승', '프리미어리그 우승', 'FA컵 우승'],
    });
    expect(ids(career([treble]))).toEqual(
      expect.arrayContaining(['ballon1', 'ucl', 'win_pl', 'treble']),
    );
    expect(
      ids(career([season({ honors: ['UEFA 챔피언스리그 우승', 'K리그1 우승', '코리아컵 우승'] })])),
    ).toContain('treble'); // web 칭호와 같은 정의
    expect(
      ids(
        career([
          season({
            honors: ['UEFA 챔피언스리그 우승', '프리미어리그 우승', 'FA 커뮤니티 실드 우승'],
          }),
        ]),
      ),
    ).not.toContain('treble'); // 슈퍼컵은 컵이 아니다
    const b = Array.from({ length: 3 }, () => season({ honors: ['발롱도르'] }));
    expect(ids(career(b))).toEqual(expect.arrayContaining(['ballon1', 'ballon3']));
  });

  it('레전드 점수 기록은 은퇴 시각으로 잡는다', () => {
    const c = career([season()], { legendScore: 900, retiredAt: '2026-09-26T01:00:00.000Z' });
    expect(evaluateCareer(c).find((g) => g.id === 'legend840')).toEqual({
      id: 'legend840',
      at: c.retiredAt,
      year: null,
    });
    expect(ids({ ...c, retiredAt: null })).not.toContain('legend840');
  });

  it('끝없는 단계: 기본 단계를 넘으면 step씩 이어지고, 상한이 있는 값은 기본 단계에서 끝난다 (T-10-056)', () => {
    const s = Array.from({ length: 11 }, () => season({ goals: 60, ovr: 99 }));
    const got = ids(career(s)); // 통산 660골
    expect(got).toEqual(expect.arrayContaining(['goals500', 'goals550', 'goals600', 'goals650']));
    expect(got).not.toContain('goals700');
    expect(got).toContain('ovr99');
    const b = Array.from({ length: 6 }, () => season({ honors: ['발롱도르'] }));
    expect(ids(career(b))).toEqual(expect.arrayContaining(['ballon1', 'ballon5', 'ballon6']));
    const old = Array.from({ length: 4 }, (_, i) => season({ age: 39 + i }));
    expect(ids(career(old))).toEqual(expect.arrayContaining(['age38', 'age40', 'age41', 'age42']));
  });

  it('목록은 기본 단계 + 달성된 단계 + 그 위 다음 목표 하나까지 보인다 (T-10-056)', () => {
    const goals = (achieved: string[]) =>
      firstsCatalog(achieved)
        .map((d) => d.id)
        .filter((id) => /^goals\d+$/.test(id));
    expect(goals([])).toEqual([
      'goals100',
      'goals150',
      'goals200',
      'goals250',
      'goals300',
      'goals350',
      'goals400',
      'goals450',
      'goals500',
    ]);
    expect(goals(['goals500']).slice(-2)).toEqual(['goals500', 'goals550']);
    expect(goals(['goals500', 'goals550', 'goals600']).slice(-2)).toEqual(['goals600', 'goals650']);
    const ovr = firstsCatalog(['ovr99'])
      .map((d) => d.id)
      .filter((id) => id.startsWith('ovr'));
    expect(ovr).toEqual(['ovr85', 'ovr90', 'ovr95', 'ovr99']);
    const ballon = firstsCatalog(['ballon1', 'ballon3', 'ballon5']).filter((d) =>
      d.id.startsWith('ballon'),
    );
    expect(ballon.map((d) => d.id)).toEqual(['ballon1', 'ballon3', 'ballon5', 'ballon6']);
    expect(ballon[3]!.label).toBe('발롱도르 6회 최초 수상!');
  });

  it('서버 기록: 통산은 합계와 마지막으로 늘어난 시즌, 한 시즌은 최고값을 처음 낸 시즌 (T-10-056)', () => {
    const s = [
      season({ goals: 30 }),
      season({ goals: 45 }),
      season({ goals: 45 }),
      season({ goals: 0 }),
    ];
    const r = new Map(evaluateRecords(career(s)).map((x) => [x.id, x]));
    expect(r.get('goals')).toEqual({
      id: 'goals',
      value: 120,
      at: s[2]!.createdAt,
      year: s[2]!.year,
    });
    expect(r.get('sgoals')).toEqual({
      id: 'sgoals',
      value: 45,
      at: s[1]!.createdAt,
      year: s[1]!.year,
    });
    expect(r.has('legend')).toBe(false);
    expect(r.has('ballon')).toBe(false); // 0이면 후보가 아니다
  });

  it('지어낸 큰 값이어도 한 사다리에서 채우는 단계 수엔 상한이 있다', () => {
    const got = evaluateCareer(
      career([season()], { legendScore: 100_000, retiredAt: '2026-09-26T01:00:00.000Z' }),
    );
    expect(got.filter((g) => g.id.startsWith('legend')).length).toBe(40);
  });

  it('은퇴 나이 해금(T-11-045): 시즌 선수가 그 시즌 은퇴 나이로 은퇴하면 은퇴 시각으로 잡는다', () => {
    const at = '2026-11-01T00:00:00.000Z';
    const played = [season({ age: 44 })];
    const retired = (svc: number, retireAge: number) =>
      evaluateCareer(career(played, { retiredAt: at, retireAge, season: svc })).find(
        (g) => g.id === RETIRE_CAP_FIRST,
      );
    expect(retired(1, 45)).toEqual({ id: RETIRE_CAP_FIRST, at, year: null });
    expect(retired(1, 44)).toBeUndefined();
    expect(retired(0, 41)).toBeUndefined(); // 프리시즌은 해금이 없다
    expect(ids(career(played, { retireAge: 45, season: 1 }))).not.toContain(RETIRE_CAP_FIRST); // 은퇴 전
  });

  it('은퇴 나이 해금 문장은 시즌의 은퇴 나이와 다음 시즌 나이를 쓰고, 프리시즌 목록엔 없다', () => {
    const label = (season?: number) =>
      firstsCatalog([], season).find((d) => d.id === RETIRE_CAP_FIRST)?.label;
    expect(label(1)).toBe('45세 은퇴 최초 달성! 다음 시즌 은퇴 나이 46세 해금');
    expect(label(0)).toBeUndefined();
    expect(label()).toBe('은퇴 나이까지 뛰고 은퇴 최초 달성!');
  });
});

describe('서버 최초 기록 영어 문구(T-11-106)', () => {
  const hangul = /[가-힣]/;
  it('모든 규칙·단계(이미 달성된 높은 단계 포함)가 영어 문장을 갖고, 한글이 없다', () => {
    for (const season of [undefined, 0, 1]) {
      for (const d of firstsCatalog(['goals2000', 'ballon9', 'apps1500', 'oneclub25'], season)) {
        const en = firstLabelEn(d.id, season);
        expect(en, d.id).not.toBeNull();
        expect(en!, d.id).not.toMatch(hangul);
        expect(en!, d.id).toMatch(/^First /);
      }
    }
    for (const r of RECORDS) {
      const t = recordTextEn(r.id);
      expect(t, r.id).not.toBeNull();
      expect(`${t!.label}${t!.unit}`).not.toMatch(hangul);
    }
  });

  it('대표 문장: 단계·한 번 달성·시즌별 은퇴 나이', () => {
    expect(firstLabelEn('goals100')).toBe('First to 100 career goals!');
    expect(firstLabelEn('goals1050')).toBe('First to 1,050 career goals!');
    expect(firstLabelEn('ballon1')).toBe("First Ballon d'Or winner!");
    expect(firstLabelEn('ballon3')).toBe("First to 3 Ballon d'Or awards!");
    expect(firstLabelEn('euro')).toBe('First to win the UEFA Euro!');
    expect(firstLabelEn('treble')).toBe('First treble!');
    expect(firstLabelEn('retirecap', 1)).toBe(
      "First to retire at 45! Next season's retirement age rises to 46",
    );
    expect(firstLabelEn('nope')).toBeNull();
    expect(recordTextEn('goals')).toEqual({ label: 'Most career goals', unit: ' goals' });
  });
});

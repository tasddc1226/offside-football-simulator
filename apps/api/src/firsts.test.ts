import { describe, expect, it } from 'vitest';
import { FIRSTS, evaluateCareer, type FirstCareer, type FirstSeason } from './firsts.js';

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
    const list = FIRSTS.map((d) => d.id);
    expect(new Set(list).size).toBe(list.length);
    for (const d of FIRSTS) {
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
      expect.arrayContaining(['ballon', 'ucl', 'win_pl', 'treble']),
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
    expect(ids(career(b))).toEqual(expect.arrayContaining(['ballon', 'ballon3']));
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
});

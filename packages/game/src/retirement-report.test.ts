import { describe, expect, it } from 'vitest';
import {
  careerChapters,
  honoursRoll,
  isKeyMilestone,
  nationalEvents,
} from './retirement-report.js';
import { newGame } from './engine.js';
import { createRng, setActiveRng } from './rng.js';
import { legendScore, legendScoreBreakdown } from './season.js';
import type { CareerRecord, LegendSource } from './types.js';

const row = (year: number, age: number, club: string, league: string, apps = 30, goals = 10) =>
  ({
    year,
    age,
    club,
    league,
    apps,
    goals,
    assists: 3,
    cs: 0,
    rating: 7,
    ovr: 70,
    honors: [],
  }) as unknown as LegendSource['career'][number];

const src = {
  pos: 'FW',
  peak: 85,
  career: [
    row(2026, 18, '해오름고', '고교 리그'),
    row(2027, 19, '강원', 'K리그1'),
    row(2028, 20, '강원', 'K리그1'),
    row(2029, 21, '리버풀', '프리미어리그'),
  ],
  trophies: [
    { year: 2027, t: 'K리그1 우승', club: '강원' },
    { year: 2028, t: 'K리그1 우승', club: '강원' },
    { year: 2029, t: '아시안컵 우승', club: '대한민국' },
  ],
  awards: [
    { year: 2028, t: '득점왕' },
    { year: 2027, t: '영플레이어상' },
    { year: 2029, t: '득점왕' },
  ],
  miles: [
    { year: 2027, t: '프로 데뷔' },
    { year: 2027, t: '프로 데뷔골' },
    { year: 2028, t: 'A매치 데뷔' },
    { year: 2029, t: '프로 통산 150골' },
  ],
  storyLog: [{ year: 2029, key: 'rival', name: '평생의 라이벌', ending: '영원한 2인자' }],
  nat: { caps: 12 },
} as unknown as LegendSource;

describe('은퇴 리포트 타임라인 (T-10-062)', () => {
  it('연달아 뛴 같은 클럽 시즌을 한 챕터로 묶고, 같은 우승은 한 줄에 연도를 모은다', () => {
    const ch = careerChapters(src);
    expect(ch.map((c) => [c.club, c.from, c.to, c.seasons, c.apps])).toEqual([
      ['해오름고', 2026, 2026, 1, 30],
      ['강원', 2027, 2028, 2, 60],
      ['리버풀', 2029, 2029, 1, 30],
    ]);
    expect(ch[1]!.events).toEqual([
      { year: 2027, kind: 'mile', text: '프로 데뷔', years: [2027] },
      { year: 2027, kind: 'trophy', text: 'K리그1 우승', years: [2027, 2028] },
    ]);
    // 100골 단위가 아닌 통산 골은 빼고, 이야기는 결말과 함께 남긴다.
    expect(ch[2]!.events.map((e) => e.text)).toEqual(['「평생의 라이벌」 영원한 2인자']);
  });

  it('T-10-066: 구단명이 바뀌어도 클럽 id가 같으면 한 챕터 · 우승도 그 챕터에, id 없는 옛 시즌은 이름으로 잇는다', () => {
    const withId = (r: ReturnType<typeof row>, clubId: string) => ({ ...r, clubId });
    const ch = careerChapters({
      ...src,
      career: [
        row(2026, 18, '강원', 'K리그1'),
        withId(row(2027, 19, '강원', 'K리그1'), 'k1-5'),
        withId(row(2028, 20, '강원 FC 2028', 'K리그1'), 'k1-5'),
        withId(row(2029, 21, '서울', 'K리그1'), 'k1-1'),
      ],
      trophies: [{ year: 2028, t: 'K리그1 우승', club: '강원 FC 2028', clubId: 'k1-5' }],
    });
    expect(ch.map((c) => [c.club, c.clubId, c.from, c.to])).toEqual([
      ['강원', 'k1-5', 2026, 2028],
      ['서울', 'k1-1', 2029, 2029],
    ]);
    expect(ch[0]!.events.filter((e) => e.kind === 'trophy').map((e) => e.years)).toEqual([[2028]]);
  });

  it('대표팀 이정표와 클럽 밖 우승은 대표팀 장면으로 모은다', () => {
    expect(nationalEvents(src).map((e) => [e.year, e.kind, e.text])).toEqual([
      [2028, 'mile', 'A매치 데뷔'],
      [2029, 'trophy', '아시안컵 우승'],
    ]);
  });

  it('우승·수상 롤은 많이 든 순, 같으면 먼저 든 순', () => {
    expect(honoursRoll(src.awards)).toEqual([
      { name: '득점왕', years: [2028, 2029] },
      { name: '영플레이어상', years: [2027] },
    ]);
  });

  it('자잘한 이정표는 챕터에서 뺀다', () => {
    expect(isKeyMilestone('프로 데뷔골')).toBe(false);
    expect(isKeyMilestone('프로 통산 200골')).toBe(true);
    expect(isKeyMilestone('프로 통산 150골')).toBe(false);
    expect(isKeyMilestone('프로 데뷔')).toBe(true);
  });
});

describe('legendScoreBreakdown', () => {
  it('항목 합계는 legendScore()의 값과 정확히 같다', () => {
    setActiveRng(createRng(3));
    const s = newGame(
      { name: 'a', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      3,
    );
    const rec: CareerRecord = {
      year: 2026,
      age: 19,
      club: 'x',
      league: 'K리그1',
      apps: 30,
      goals: 18,
      assists: 6,
      cs: 0,
      rating: 7.2,
      rank: 1,
      ovr: 70,
      honors: ['우승'],
      pro: true,
    };
    s.career.push(rec);
    s.trophies.push({ year: 2026, t: '우승', club: 'x' });
    s.peak = 70;
    const { total } = legendScoreBreakdown(s);
    expect(total).toBe(legendScore(s));
  });
});

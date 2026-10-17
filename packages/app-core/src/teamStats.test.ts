import { afterEach, describe, expect, it } from 'vitest';
import type { TeamStatsResponse } from './api/team.js';
import { en } from './i18n/en/index.js';
import { ja } from './i18n/ja/index.js';
import { setLocale } from './i18n/core.js';
import { bigMatchLine, formAria, formLetter, statsKindRows, streakText } from './teamStats.js';

const zero = { w: 0, d: 0, l: 0, gf: 0, ga: 0 };
const base: TeamStatsResponse = {
  season: 1,
  matches: 3,
  capped: false,
  total: { w: 2, d: 0, l: 1, gf: 6, ga: 2 },
  players: [],
  days: [],
  opponents: [],
};

describe('T-11-358 팀 통계 표기', () => {
  afterEach(() => setLocale('ko'));

  it('최근 흐름 글자와 읽어 주는 말', () => {
    expect(['w', 'd', 'l'].map((r) => formLetter(r as 'w'))).toEqual(['승', '무', '패']);
    expect(formAria(['w', 'w', 'l'])).toBe('최근 경기 결과(최신부터) 승 승 패');
    setLocale('en', en);
    expect(formAria(['w', 'd'])).toBe('Recent results, newest first: W D');
    setLocale('ja', ja);
    expect(formLetter('d')).toBe('分');
  });

  it('지금 이어지는 결과', () => {
    expect(streakText(null)).toBeNull();
    expect(streakText({ kind: 'w', n: 3 })).toBe('3연승 중');
    expect(streakText({ kind: 'd', n: 2 })).toBe('2경기째 무승부');
    expect(streakText({ kind: 'l', n: 1 })).toBe('1연패 중');
    setLocale('en', en);
    expect(streakText({ kind: 'w', n: 4 })).toBe('Won 4 in a row');
  });

  it('가장 큰 승패 한 줄은 한국 시각 날짜로 적는다', () => {
    // UTC 10/14 16:00 = 한국 시각 10/15 01:00.
    expect(
      bigMatchLine({ opponent: '상대 FC', gf: 5, ga: 0, at: '2026-10-14T16:00:00.000Z' }),
    ).toBe('5 : 0 · 상대 FC · 10/15');
  });

  it('경기 종류별 줄: 옛 응답이면 비우고, 치르지 않은 종류는 기록 없음(null)', () => {
    expect(statsKindRows(base)).toEqual([]);
    const rows = statsKindRows({
      ...base,
      summary: {
        form: ['w', 'l', 'w'],
        streak: { kind: 'w', n: 1 },
        bestWinStreak: 1,
        home: zero,
        away: zero,
        biggestWin: null,
        biggestLoss: null,
        friendly: { w: 0, d: 1, l: 0, gf: 1, ga: 1 },
        cup: zero,
      },
    });
    expect(rows.map((r) => [r.key, r.label, r.record?.d ?? null])).toEqual([
      ['rank', '랭크', 0],
      ['friendly', '친선전', 1],
      ['cup', '컵', null],
    ]);
  });
});

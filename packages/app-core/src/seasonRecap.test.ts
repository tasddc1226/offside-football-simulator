import type { OwnerHonor, SeasonRecap } from '@offside/contracts';
import { describe, expect, it } from 'vitest';
import {
  honorViews,
  PHOTO_MAX,
  photoRows,
  rankLine,
  rankText,
  recapRanks,
  recapShareCells,
  recapCardView,
  recapCutoffText,
  recapHeadline,
  recapHighlights,
  recapNumbers,
  recapTeamSummary,
  recapTierBars,
  signed,
  topPercent,
} from './seasonRecap.js';

const honor = (o: Partial<OwnerHonor> & Pick<OwnerHonor, 'kind'>): OwnerHonor => ({
  season: 0,
  band: null,
  rank: null,
  value: null,
  grantedAt: '2026-10-07T00:00:00.000Z',
  ...o,
});

describe('T-11-128 시즌 결산 문구', () => {
  it('휘장은 최신 시즌 · 금은동 · 종류 순, 단계로 메달 색을 정한다', () => {
    const views = honorViews([
      honor({ kind: 'pioneer', value: 3 }),
      honor({ kind: 'hof', band: 100, rank: 42 }),
      honor({ kind: 'achievements', band: 1, rank: 1 }),
      honor({ kind: 'team', band: 10, rank: 4, season: 1 }),
      honor({ kind: 'wall-of-honor', value: 2 }),
    ]);
    expect(views.map((v) => [v.season, v.kind, v.detail, v.medal])).toEqual([
      [1, 'team', '4위로 마감', 'silver'],
      [0, 'achievements', '1위로 마감', 'gold'],
      [0, 'hof', '42위로 마감', 'bronze'],
      [0, 'wall-of-honor', '2명', 'bronze'],
      [0, 'pioneer', '은퇴 선수 3명', 'bronze'],
    ]);
    expect(views.at(-1)?.title).toBe('프리시즌 개척자');
  });

  it('순위가 없으면 순위 밖, 기준 날짜는 마감 전날(한국 시각)', () => {
    expect(rankText(null, 10)).toBe('순위 밖');
    expect(rankText(3, 1818)).toBe('3위 / 1,818');
    expect(recapCutoffText({ cutoff: '2026-10-05T15:00:00.000Z' })).toBe(
      '2026년 10월 5일까지의 기록이에요',
    );
  });

  it('결산 카드: 상태 한 줄과 기록 배지 수, 알약은 3개까지', () => {
    const honors = ['pioneer', 'hof', 'team', 'first'].map((kind) =>
      honor({ kind: kind as OwnerHonor['kind'], value: 1 }),
    );
    const ready = recapCardView({ season: 0, status: 'ready', recap: null, honors });
    expect(ready.line).toBe('프리시즌 결산이 나왔어요 · 기록 배지 4개를 받았어요');
    expect(ready.chips).toHaveLength(3);
    const pending = recapCardView({ season: 0, status: 'pending', recap: null, honors: [] });
    expect(pending.isNew).toBe(false);
    expect(pending.line).not.toContain('·');
  });

  describe('결산 화면 · 공유 카드', () => {
    const team = {
      name: '수영 유나이티드',
      rating: 1088,
      rank: 5,
      ranked: 233,
      wins: 31,
      draws: 6,
      losses: 9,
      goalsFor: 68,
      goalsAgainst: 34,
      bestMargin: 5,
      bestStreak: 7,
    };
    const recap = (o: Partial<SeasonRecap> = {}): SeasonRecap => ({
      season: 0,
      cutoff: '2026-10-05T15:00:00.000Z',
      closedAt: '2026-10-06T00:00:00.000Z',
      players: 10,
      retired: 7,
      best: null,
      hofRank: 1,
      hofRanked: 43,
      retiredNumbers: 2,
      wallOfHonor: 1,
      firsts: 0,
      team,
      achievements: { score: 820, done: 20, rank: 3, ranked: 15 },
      stats: {
        apps: 2685,
        goals: 457,
        assists: 589,
        trophies: 32,
        caps: 202,
        ballon: 2,
        tiers: { icon: 1, legend: 1, elite: 0, gold: 5, silver: 0, bronze: 0 },
        scorer: null,
      },
      ...o,
    });

    it('상위 %는 올림, 1% 아래는 1%, 순위가 없으면 null', () => {
      expect(topPercent(5, 233)).toBe(3);
      expect(topPercent(1, 5000)).toBe(1);
      expect(topPercent(233, 233)).toBe(100);
      expect(topPercent(null, 233)).toBeNull();
      expect(topPercent(1, 0)).toBeNull();
    });

    it('숫자 칸 · 한 줄 요약 · 자랑거리는 기록 묶음에서', () => {
      expect(recapNumbers(recap()).map((n) => [n.key, n.value])).toEqual([
        ['players', 10],
        ['retired', 7],
        ['goals', 457],
        ['assists', 589],
        ['apps', 2685],
        ['trophies', 32],
        ['caps', 202],
        ['ballon', 2],
      ]);
      expect(recapHeadline(recap())).toBe('선수 7명이 은퇴하며 457골을 남겼어요');
      expect(recapHighlights(recap())).toEqual([
        '명예의 전당 1위',
        '발롱도르 2회',
        '아이콘 카드 1장',
        '팀 레이팅 5위',
        '영구결번 2개',
        '7연승',
      ]);
    });

    it('기록 묶음이 없는 옛 결산은 선수 수만, 은퇴 선수가 없으면 팀으로 요약', () => {
      const old = recap({ stats: null, retired: 0, hofRank: null });
      expect(recapNumbers(old).map((n) => n.key)).toEqual(['players', 'retired']);
      expect(recapTierBars(old)).toEqual([]);
      expect(recapHeadline(old)).toBe('수영 유나이티드 팀으로 경쟁한 시즌이에요');
      expect(recapHighlights(old)).toEqual(['팀 레이팅 5위', '영구결번 2개', '7연승']);
    });

    it('카드 등급 막대는 높은 등급부터 비율로, 팀 요약은 승률 · 득실차', () => {
      const bars = recapTierBars(recap());
      expect(bars.map((b) => [b.tier, b.n])).toEqual([
        ['icon', 1],
        ['legend', 1],
        ['elite', 0],
        ['gold', 5],
        ['silver', 0],
        ['bronze', 0],
      ]);
      expect(recapRanks(recap()).map((r) => [r.key, r.pct, r.hot, r.meter])).toEqual([
        ['team', 3, true, 98],
        ['ach', 20, false, 81],
        ['hof', 3, true, 98],
      ]);
      expect(recapRanks(recap({ team: null, achievements: null, retired: 0 }))).toEqual([]);
      expect(rankLine(5, 233)).toBe('5위 / 233 · 상위 3%');
      expect(rankLine(null, 233)).toBe('순위 밖');
      expect(recapShareCells(recap()).map((c) => c.key)).toEqual([
        'players',
        'goals',
        'assists',
        'apps',
        'trophies',
        'ballon',
      ]);
      expect(recapTeamSummary(team)).toEqual({ played: 46, winRate: 67, goalDiff: 34 });
      expect(recapTeamSummary({ ...team, goalsAgainst: null }).goalDiff).toBeNull();
      expect([signed(34), signed(-3), signed(0)]).toEqual(['+34', '-3', '0']);
    });
  });
});

describe('photoRows', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => i);

  it('한 줄 8명까지는 한 줄, 1등이 가운데', () => {
    expect(photoRows(ids(5))).toEqual([[3, 1, 0, 2, 4]]);
    expect(photoRows([])).toEqual([]);
  });

  it('줄을 고르게 나누고 남는 자리는 앞줄부터', () => {
    expect(photoRows(ids(20)).map((r) => r.length)).toEqual([7, 7, 6]);
    expect(photoRows(ids(9)).map((r) => r.length)).toEqual([5, 4]);
  });

  it('많아도 PHOTO_MAX명(한 줄 8명 × 3줄)까지만 세운다', () => {
    const rows = photoRows(ids(30));
    expect(PHOTO_MAX).toBe(24);
    expect(rows.map((r) => r.length)).toEqual([8, 8, 8]);
    expect(rows.flat().sort((a, b) => a - b)).toEqual(ids(24));
  });
});

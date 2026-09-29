import { describe, expect, it } from 'vitest';
import { teamBadges, type BadgeTeam } from './badges.js';

const team = (over: Partial<BadgeTeam> = {}): BadgeTeam => ({
  filled: 1,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  bestStreak: 0,
  bestMargin: 0,
  likes: 0,
  ...over,
});
const ids = (t: BadgeTeam, rank: number | null = null) =>
  teamBadges(t, rank, '시즌 1').map((b) => b.id);

describe('팀 히스토리 배지', () => {
  it('경기 전에는 배지가 없다', () => {
    expect(ids(team())).toEqual([]);
  });
  it('전적·연승·골 차·좋아요로 쌓인다', () => {
    expect(ids(team({ losses: 1 }))).toEqual(['debut']);
    expect(
      ids(team({ filled: 11, wins: 12, bestStreak: 5, bestMargin: 4, goalsFor: 40, likes: 10 })),
    ).toEqual([
      'debut',
      'first-win',
      'full',
      'streak-3',
      'rout',
      'wins-10',
      'streak-5',
      'likes-10',
    ]);
  });
  it('끝난 시즌의 최종 순위 배지는 가장 높은 것 하나만 맨 앞에', () => {
    expect(teamBadges(team({ wins: 1 }), 2, '시즌 1')[0]).toEqual({
      id: 'final-3',
      label: '시즌 TOP 3',
      desc: '시즌 1 최종 2위',
    });
    expect(ids(team(), 1)).toEqual(['final-1']);
    expect(ids(team(), 11)).toEqual([]);
  });
});

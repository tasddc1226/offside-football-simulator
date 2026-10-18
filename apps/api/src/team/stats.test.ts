import { describe, expect, it } from 'vitest';
import { tallyTeamStats } from './stats.js';

const side = (
  teamId: string,
  xg?: number,
  lines?: { atk: number; mid: number; def: number; gk: number },
) => ({
  teamId,
  name: teamId,
  owner: '감독',
  formation: '4-3-3' as const,
  ovr: 80,
  ...(xg === undefined ? {} : { xg, lines }),
});
const row = (
  home: ReturnType<typeof side>,
  away: ReturnType<typeof side>,
  hg: number,
  ag: number,
  at: string,
) => ({
  homeTeamId: home.teamId,
  homeGoals: hg,
  awayGoals: ag,
  detailJson: JSON.stringify({ home, away, events: [] }),
  createdAt: at,
});

describe('T-11-379 시즌 경기 리포트', () => {
  it('기대 득점이 남은 경기만 세고, 줄 비교는 내 쪽에서 본다', () => {
    const strong = { atk: 80, mid: 70, def: 75, gk: 80 };
    const weak = { atk: 70, mid: 74, def: 70, gk: 70 };
    const r = tallyTeamStats(
      [
        // 내가 건 경기: 공격 80 vs 벽 70 → +10, 중원 70 vs 74 → −4, 벽 76.5 vs 공격 70 → +6.5
        row(side('me', 1.84, strong), side('opp', 0.71, weak), 2, 0, '2026-10-01T00:00:00.000Z'),
        // 받은 경기(내가 away): 같은 줄 힘
        row(side('opp', 0.8, weak), side('me', 1.6, strong), 1, 1, '2026-10-01T01:00:00.000Z'),
        // 옛 경기(기대 득점 없음): 리포트에 들지 않는다
        row(side('me'), side('opp'), 0, 3, '2026-10-01T02:00:00.000Z'),
      ],
      'me',
    );
    expect(r.report).toEqual({
      matches: 2,
      xgFor: 3.4,
      xgAgainst: 1.5,
      gf: 3,
      ga: 1,
      edges: { atk: 10, mid: -4, def: 6.5 },
      behind: { atk: 0, mid: 2, def: 0 },
      formations: [
        { formation: '4-3-3', w: 1, d: 1, l: 0, gf: 3, ga: 1, xgFor: 3.4, xgAgainst: 1.5 },
      ],
    });
    expect(r.total).toEqual({ w: 1, d: 1, l: 1, gf: 3, ga: 4 });
  });
});

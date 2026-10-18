import { DEFAULT_ENHANCE_RULES } from '@offside/contracts/card-enhance';
import { FORMATIONS, type PosGroup } from '@offside/contracts/owner-team';
import { describe, expect, it } from 'vitest';
import { buildLineup, lineupLines, lineupOvr, simulateMatch, type LineupCareer } from './sim.js';

// T-11-373 카드 강화 경기 효과 상한(docs/tracking/card-enhance-plan.md). 같은 전력에서 선발 전원 +10 대 강화 없음의
// 승률 차가 감독 칸 상한(+5%p) 안쪽이어야 한다(배율 1이면 +5.0%p라 기본값을 0.8로 뒀다). 홈 · 원정을 번갈아 같은 시드 묶음으로 잰다.

const GROUP: Record<string, PosGroup> = {
  GK: 'GK',
  CB: 'DF',
  FB: 'DF',
  DM: 'MF',
  CM: 'MF',
  AM: 'MF',
  W: 'FW',
  ST: 'FW',
};

function team(
  prefix: string,
  peak: number,
  enhance: number,
  scale = DEFAULT_ENHANCE_RULES.effectScale,
) {
  const careers = FORMATIONS['4-3-3'].map((slot, i): LineupCareer => ({
    id: `${prefix}-${i}`,
    pos: GROUP[slot]!,
    dpos: null,
    peak,
    roles: null,
    number: i + 1,
    publicName: null,
    enhance,
  }));
  return buildLineup(
    '4-3-3',
    careers.map((c) => c.id),
    new Map(careers.map((c) => [c.id, c])),
    null,
    scale,
  );
}

const GAMES = 20_000;

/** a가 이긴 비율 − b가 이긴 비율이 아니라, a의 승률 − 같은 전력끼리 승률. */
function winRate(a: ReturnType<typeof team>, b: ReturnType<typeof team>) {
  let wins = 0;
  for (let g = 0; g < GAMES; g++) {
    const home = g % 2 === 0;
    const r = home ? simulateMatch(`enh-${g}`, a, b, 1) : simulateMatch(`enh-${g}`, b, a, 1);
    const [mine, theirs] = home ? [r.homeGoals, r.awayGoals] : [r.awayGoals, r.homeGoals];
    if (mine > theirs) wins++;
  }
  return wins / GAMES;
}

describe('카드 강화 경기 효과 (T-11-373)', () => {
  it('강화 보정은 줄 힘에만 더하고 팀 OVR 표시는 그대로다', () => {
    const plain = team('a', 85, 0);
    const maxed = team('a', 85, 10);
    expect(lineupOvr(maxed)).toBe(lineupOvr(plain));
    expect(lineupLines(maxed).atk).toBeGreaterThan(lineupLines(plain).atk);
    // 배율 0이면 강화 전과 같은 줄 힘이다.
    expect(lineupLines(team('a', 85, 10, 0))).toEqual(lineupLines(plain));
  });

  it('선발 전원 +10이어도 같은 전력 승률은 +5%p 안쪽이다', () => {
    const base = winRate(team('a', 85, 0), team('b', 85, 0));
    const maxed = winRate(team('a', 85, 10), team('b', 85, 0));
    const mid = winRate(team('a', 85, 5), team('b', 85, 0));
    console.info(
      `[T-11-373] 같은 전력 승률 ${(base * 100).toFixed(1)}% · 전원 +5 ${(mid * 100).toFixed(1)}% · 전원 +10 ${(maxed * 100).toFixed(1)}%`,
    );
    expect(maxed - base).toBeGreaterThan(0);
    expect(maxed - base).toBeLessThanOrEqual(0.05);
    expect(mid - base).toBeLessThan(maxed - base);
  });
});

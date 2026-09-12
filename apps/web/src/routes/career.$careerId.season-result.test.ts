// 이슈 171: 임대 시즌의 클럽명 표기 규칙(상단 배너·요약 공통).
import { describe, expect, it } from 'vitest';
import { loadRuleset } from '@offside/content';
import type { ClubStint, Contract } from '@offside/domain';
import { seasonClubDisplay } from './career.$careerId.season-result.js';

const ruleset = loadRuleset('1.0.0');
const PARENT = 'seorabeol-united';
const LOAN = 'cheongyeon-fc';

function stint(overrides: Partial<ClubStint> & Pick<ClubStint, 'teamId' | 'kind'>): ClubStint {
  return {
    teamName: overrides.teamId,
    leagueTier: 1,
    fromSeasonIndex: 1,
    toSeasonIndex: null,
    endReason: null,
    contractId: `contract-${overrides.teamId}`,
    ...overrides,
  };
}

describe('seasonClubDisplay', () => {
  it('임대 시즌이면 "임대 · 임대팀 (원소속 원소속팀)"으로, 배지는 임대팀 id로 표기한다', () => {
    const clubHistory = [
      stint({ teamId: PARENT, kind: 'PERMANENT', fromSeasonIndex: 1, toSeasonIndex: 1, endReason: 'LOANED' }),
      stint({ teamId: LOAN, kind: 'LOAN', fromSeasonIndex: 2, toSeasonIndex: null }),
    ];
    const display = seasonClubDisplay({ clubHistory, parentContract: null }, ruleset, 2, LOAN, {});
    expect(display.loan).toBe(true);
    expect(display.teamId).toBe(LOAN);
    expect(display.label).toMatch(/^임대 · .+ \(원소속 .+\)$/);
    // 구단 이름 오버라이드는 team-names.ts 리졸버를 거친다.
    const custom = seasonClubDisplay({ clubHistory, parentContract: null }, ruleset, 2, LOAN, { [LOAN]: '내 임대팀' });
    expect(custom.label.startsWith('임대 · 내 임대팀 (원소속 ')).toBe(true);
  });

  it('임대 stint 범위 밖 시즌·비임대 시즌은 팀 이름만 돌려준다', () => {
    const clubHistory = [
      stint({ teamId: PARENT, kind: 'PERMANENT', fromSeasonIndex: 1, toSeasonIndex: 1, endReason: 'LOANED' }),
      stint({ teamId: LOAN, kind: 'LOAN', fromSeasonIndex: 2, toSeasonIndex: 2, endReason: 'RETURNED' }),
      stint({ teamId: PARENT, kind: 'PERMANENT', fromSeasonIndex: 3, toSeasonIndex: null }),
    ];
    const seasonOne = seasonClubDisplay({ clubHistory, parentContract: null }, ruleset, 1, PARENT, {});
    expect(seasonOne.loan).toBe(false);
    expect(seasonOne.label).not.toContain('임대');
    const seasonThree = seasonClubDisplay({ clubHistory, parentContract: null }, ruleset, 3, PARENT, {});
    expect(seasonThree.loan).toBe(false);
  });

  it('직전 stint가 없으면 parentContract에서 원소속을 읽는다', () => {
    const parentContract = { teamId: PARENT } as Contract;
    const clubHistory = [stint({ teamId: LOAN, kind: 'LOAN', fromSeasonIndex: 2 })];
    const display = seasonClubDisplay({ clubHistory, parentContract }, ruleset, 2, LOAN, {});
    expect(display.label).toMatch(/\(원소속 .+\)$/);
  });
});

import { describe, expect, it } from 'vitest';
import { loadRuleset, RULESET_VERSIONS } from './load-ruleset.ts';

describe('loadRuleset', () => {
  it('exports RULESET_VERSIONS including 1.0.0', () => {
    expect(RULESET_VERSIONS).toContain('1.0.0');
  });

  it('loads and validates ruleset 1.0.0 synchronously', () => {
    const ruleset = loadRuleset('1.0.0');
    expect(ruleset.version).toBe('1.0.0');
    expect(ruleset.archetypes).toHaveLength(24);
  });

  it('throws for an unknown ruleset version', () => {
    expect(() => loadRuleset('9.9.9')).toThrowError(/알 수 없는 rulesetVersion/);
  });
});

// T-7-001 D-67: 룰셋 1.4.0은 1.3.0을 복사해 회복·신뢰 관련 5개 값만 바꾼다. 1.3.0은 재생 결과가
// 바뀌면 안 되므로 기존 값을 그대로 유지하는지, 1.4.0은 새 값·새 선택 키를 갖는지 함께 고정한다.
describe('loadRuleset: 1.4.0 회복 규칙 데이터(D-67)', () => {
  it('1.3.0은 기존 값을 그대로 유지한다(재생 불변)', () => {
    const ruleset = loadRuleset('1.3.0');
    expect(ruleset.transferRules.recovery?.zeroMinutesConsecutiveSeasons).toBe(2);
    expect(ruleset.transferRules.relationshipCarry.managerTrustPromiseBreach).toBe(-8);
    expect(ruleset.selectionRules.roleProposal.acceptedRoleUpdatesPromise).toBeUndefined();
    expect(ruleset.selectionRules.roleProposal.declineDowngradeTrustDelta).toBeUndefined();
    // 2차 웨이브(이슈 #147·#148) 선택 키도 1.3.0에는 없다.
    expect(ruleset.contractRules.renewalWindow).toBeUndefined();
    expect(ruleset.transferRules.loanReturn).toBeUndefined();
  });

  it('1.4.0은 회복 제안을 0분 1시즌 뒤 열고, 약속 미이행이 신뢰를 깎지 않으며, 새 선택 키를 갖는다', () => {
    const ruleset = loadRuleset('1.4.0');
    expect(ruleset.version).toBe('1.4.0');
    expect(ruleset.transferRules.recovery?.zeroMinutesConsecutiveSeasons).toBe(1);
    expect(ruleset.transferRules.relationshipCarry.managerTrustPromiseBreach).toBe(0);
    expect(ruleset.selectionRules.roleProposal.acceptedRoleUpdatesPromise).toBe(true);
    expect(ruleset.selectionRules.roleProposal.declineDowngradeTrustDelta).toBe(0);
    // 2차 웨이브: #147 사전 협상 창(이번 계약 3경기 소화), #148 임대 복귀 역할 재평가.
    expect(ruleset.contractRules.renewalWindow).toEqual({ minMatchesPlayed: 3 });
    expect(ruleset.transferRules.loanReturn).toEqual({ reevaluate: true });
  });
});

// T-3-006 U-013: 팀 풀 8→12(YOUTH 1·1부 3·2부 4·3부 4). 시장 다양성 확보 목적.
describe('loadRuleset: 팀 풀 12개(U-013)', () => {
  const ruleset = loadRuleset('1.0.0');

  it('팀이 12개다', () => {
    expect(ruleset.teams).toHaveLength(12);
  });

  it('팀 id·이름이 유일하다', () => {
    expect(new Set(ruleset.teams.map((team) => team.id)).size).toBe(12);
    expect(new Set(ruleset.teams.map((team) => team.name)).size).toBe(12);
  });

  it('tier 분포가 YOUTH 1·1부 3·2부 4·3부 4다', () => {
    const byTier = { YOUTH: 0, 1: 0, 2: 0, 3: 0 } as Record<'YOUTH' | 1 | 2 | 3, number>;
    for (const team of ruleset.teams) byTier[team.leagueTier] += 1;
    expect(byTier).toEqual({ YOUTH: 1, 1: 3, 2: 4, 3: 4 });
  });

  it('모든 팀의 leagueId·tacticalStyleId가 룰셋에 실재한다', () => {
    const leagueIds = new Set(ruleset.leagues.map((league) => league.id));
    const styleIds = new Set(ruleset.tacticalStyles.map((style) => style.id));
    for (const team of ruleset.teams) {
      expect(leagueIds.has(team.leagueId), team.id).toBe(true);
      expect(styleIds.has(team.tacticalStyleId), team.id).toBe(true);
    }
  });

  it('리그별 이름 있는 팀 수가 teamCount − 1 이하다(D-9 랜덤 대전 상대용 여유)', () => {
    const teamsByLeague = new Map<string, number>();
    for (const team of ruleset.teams) {
      teamsByLeague.set(team.leagueId, (teamsByLeague.get(team.leagueId) ?? 0) + 1);
    }
    for (const league of ruleset.leagues) {
      const named = teamsByLeague.get(league.id) ?? 0;
      expect(named, league.id).toBeLessThanOrEqual(league.teamCount - 1);
    }
  });

  it('새 4팀은 K리그 실제 연고지 목록과 겹치지 않는다', () => {
    const forbidden = [
      '서울', '수원', '전북', '울산', '포항', '인천', '대구', '광주', '대전', '강원', '제주',
      '부산', '성남', '경남', '부천', '안양', '김천', '천안', '전남', '아산', '화성', '용인',
      '충북', '김포', '안산',
    ];
    const newTeamIds = ['geumbit-fc', 'eunha-rovers', 'gangnaru-united', 'dalbit-town-fc'];
    for (const id of newTeamIds) {
      const team = ruleset.teams.find((candidate) => candidate.id === id);
      expect(team, id).toBeDefined();
      for (const place of forbidden) {
        expect(team?.name.includes(place), `${id}: ${team?.name}`).toBe(false);
      }
    }
  });

  // offers.ts buildTeamPool은 offerRules.branches[].tiers에 속한 team만 후보로 삼는다(팀 풀 확장의
  // 실제 효과 — 첫 계약 분기별 후보 풀 크기).
  it('offerRules 분기별 후보 풀 크기가 팀 풀 확장을 반영한다', () => {
    const countByTier = new Map<'YOUTH' | 1 | 2 | 3, number>();
    for (const team of ruleset.teams) {
      countByTier.set(team.leagueTier, (countByTier.get(team.leagueTier) ?? 0) + 1);
    }
    const poolSizeForTiers = (tiers: readonly (1 | 2 | 3 | 'YOUTH')[]): number =>
      tiers.reduce((sum, tier) => sum + (countByTier.get(tier) ?? 0), 0);

    for (const branch of ruleset.offerRules.branches) {
      if (branch.fixedTeamId !== undefined) continue;
      const expected = poolSizeForTiers(branch.tiers);
      const actual = ruleset.teams.filter((team) => branch.tiers.includes(team.leagueTier)).length;
      expect(actual, branch.id).toBe(expected);
    }

    expect(poolSizeForTiers([2, 3])).toBe(8);
    expect(poolSizeForTiers([1, 2, 3])).toBe(11);
  });
});

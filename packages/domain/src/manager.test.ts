import { describe, expect, it } from 'vitest';
import { buildDefaultManager, managerTenureSeasons } from './manager.js';
import { rulesetProto } from './__fixtures__/career-01.js';
import type { SeasonSummary } from './types.js';

function stubSeasonSummary(teamId: string): SeasonSummary {
  return {
    index: 1,
    simulationMode: 'FAST',
    teamId,
    competitions: [],
    settledAtRevision: 10,
    result: {} as SeasonSummary['result'],
  };
}

describe('managerTenureSeasons', () => {
  it('seasonHistory가 비어있으면(첫 시즌) 1이다', () => {
    expect(managerTenureSeasons([], 'team-1')).toBe(1);
  });

  it('직전 시즌이 다른 팀이면(이적 직후) 1이다', () => {
    expect(managerTenureSeasons([stubSeasonSummary('team-0')], 'team-1')).toBe(1);
  });

  it('직전 시즌 1개가 같은 팀이면(2번째 시즌) 2다', () => {
    expect(managerTenureSeasons([stubSeasonSummary('team-1')], 'team-1')).toBe(2);
  });

  it('직전 시즌 2개가 연속으로 같은 팀이면(3번째 시즌) 3이다', () => {
    expect(managerTenureSeasons([stubSeasonSummary('team-1'), stubSeasonSummary('team-1')], 'team-1')).toBe(3);
  });

  it('연속이 팀 이적으로 끊기면 끊긴 지점까지만 센다', () => {
    const history = [stubSeasonSummary('team-0'), stubSeasonSummary('team-1'), stubSeasonSummary('team-1')];
    expect(managerTenureSeasons(history, 'team-1')).toBe(3);
    expect(managerTenureSeasons([stubSeasonSummary('team-1'), stubSeasonSummary('team-0')], 'team-1')).toBe(1);
  });
});

describe('buildDefaultManager', () => {
  it('결정론적이다(같은 입력이면 항상 같은 감독을 만든다)', () => {
    const input = {
      teamId: 'hangang-u18',
      tacticalStyleId: 'possession',
      primaryPosition: 'W' as const,
      seasonHistory: [],
      ruleset: rulesetProto,
    };
    const a = buildDefaultManager(input);
    const b = buildDefaultManager(input);
    expect(a).toEqual(b);
  });

  it('id는 `${teamId}-mgr-1` 형식이고 trustBase는 룰셋 managerRules.trustBase를 그대로 낸다', () => {
    const manager = buildDefaultManager({
      teamId: 'hangang-u18',
      tacticalStyleId: 'possession',
      primaryPosition: 'W',
      seasonHistory: [],
      ruleset: rulesetProto,
    });
    expect(manager.id).toBe('hangang-u18-mgr-1');
    expect(manager.trustBase).toBe(rulesetProto.managerRules.trustBase);
  });

  it('name은 항상 managerRules.names 안의 값이다', () => {
    const manager = buildDefaultManager({
      teamId: 'seoul-tier1',
      tacticalStyleId: 'counter',
      primaryPosition: 'ST',
      seasonHistory: [],
      ruleset: rulesetProto,
    });
    expect(rulesetProto.managerRules.names).toContain(manager.name);
  });

  it('preferredArchetypeIds는 전술 스타일의 primaryPosition 값을 그대로 낸다', () => {
    const manager = buildDefaultManager({
      teamId: 'seoul-tier1',
      tacticalStyleId: 'possession',
      primaryPosition: 'W',
      seasonHistory: [],
      ruleset: rulesetProto,
    });
    expect(manager.preferredArchetypeIds).toEqual(['w-inverted-winger']);
  });

  it('tenureSeasons는 managerTenureSeasons(seasonHistory, teamId)를 그대로 쓴다', () => {
    const manager = buildDefaultManager({
      teamId: 'team-1',
      tacticalStyleId: 'press',
      primaryPosition: 'CB',
      seasonHistory: [stubSeasonSummary('team-1')],
      ruleset: rulesetProto,
    });
    expect(manager.tenureSeasons).toBe(2);
  });

  it('teamId가 다르면 다른 name을 낼 수 있다(둘 다 names 안의 값)', () => {
    const a = buildDefaultManager({
      teamId: 'hangang-u18',
      tacticalStyleId: 'possession',
      primaryPosition: 'W',
      seasonHistory: [],
      ruleset: rulesetProto,
    });
    const b = buildDefaultManager({
      teamId: 'seoul-tier1',
      tacticalStyleId: 'possession',
      primaryPosition: 'W',
      seasonHistory: [],
      ruleset: rulesetProto,
    });
    expect(rulesetProto.managerRules.names).toContain(a.name);
    expect(rulesetProto.managerRules.names).toContain(b.name);
  });
});

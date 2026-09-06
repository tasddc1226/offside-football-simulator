import { describe, expect, it } from 'vitest';
import { loadRuleset } from '@offside/content';
import type { CareerState } from '@offside/domain';
import { currentTeamId, currentTeamName } from './current-team.js';

function state(rulesetVersion: string, overrides: { age?: number; seasonHistory?: unknown[] } = {}): CareerState {
  return {
    age: overrides.age ?? 19,
    contract: null,
    rulesetVersion,
    seasonHistory: overrides.seasonHistory ?? [],
    player: { draft: { backgroundId: 'club-academy' }, profile: null },
  } as unknown as CareerState;
}

describe('currentTeamName', () => {
  it('1.3의 19세 계약 전 선수에게 배경 U18을 현재 소속으로 표시하지 않는다', () => {
    expect(currentTeamName(state('1.3.0'), loadRuleset('1.3.0'))).toBe('계약 전 · 다음 팀 준비');
  });

  it('이전 규칙 선수는 배경의 출발 팀 표시를 유지한다', () => {
    const ruleset = loadRuleset('1.2.0');
    const background = ruleset.backgrounds.find((candidate) => candidate.id === 'club-academy');
    const startTeam = ruleset.teams.find((candidate) => candidate.id === background?.startTeamId);
    expect(currentTeamName(state('1.2.0'), ruleset)).toBe(startTeam?.name);
  });

  it('UX-001: 계약 전 배경 팀은 오버라이드된 이름을 보여준다', () => {
    const ruleset = loadRuleset('1.2.0');
    const background = ruleset.backgrounds.find((candidate) => candidate.id === 'club-academy');
    expect(
      currentTeamName(state('1.2.0'), ruleset, { [background!.startTeamId]: '내 팀' }),
    ).toBe('내 팀');
  });

  it('1.3의 성인 무계약 선수에게도 U18을 현재 소속으로 되살리지 않는다', () => {
    const adult = state('1.3.0', { age: 20, seasonHistory: [{}] });
    expect(currentTeamName(adult, loadRuleset('1.3.0'))).toBe('무소속 · 다음 팀 준비');
  });
});

describe('currentTeamId (UX-010 P5: PlayerBanner TeamBadge)', () => {
  it('계약 전 배경 선수는 배경의 출발 팀 id를 돌려준다', () => {
    const ruleset = loadRuleset('1.2.0');
    const background = ruleset.backgrounds.find((candidate) => candidate.id === 'club-academy');
    expect(currentTeamId(state('1.2.0'), ruleset)).toBe(background?.startTeamId);
  });

  it('배경 배지가 되살아나면 안 되는 경우(1.3 계약 전 U18 초과)는 null이다', () => {
    expect(currentTeamId(state('1.3.0'), loadRuleset('1.3.0'))).toBeNull();
  });
});

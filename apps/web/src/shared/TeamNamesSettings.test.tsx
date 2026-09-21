import { describe, expect, it } from 'vitest';
import { activeRuleset } from '../engine/content.js';
import { TEAM_FLAVOR_TEXT } from './team-flavor.js';
import { groupTeamsByLeague } from './TeamNamesSettings.js';

describe('TeamNamesSettings search', () => {
  const overrides = { [activeRuleset.teams[0]!.id]: '내 구단 이름' };

  it('matches league name and league id as well as team and custom names', () => {
    const league = activeRuleset.leagues[0]!;
    const team = activeRuleset.teams.find((candidate) => candidate.leagueId === league.id)!;
    expect(groupTeamsByLeague(activeRuleset.teams, league.name, overrides, activeRuleset.leagues).flatMap((group) => group.teams)).toContainEqual(team);
    expect(groupTeamsByLeague(activeRuleset.teams, league.id, overrides, activeRuleset.leagues).flatMap((group) => group.teams)).toContainEqual(team);
    expect(groupTeamsByLeague(activeRuleset.teams, '내 구단 이름', overrides, activeRuleset.leagues).flatMap((group) => group.teams)).toContainEqual(activeRuleset.teams[0]);
    expect(groupTeamsByLeague(activeRuleset.teams, '검색할 수 없는 이름', overrides, activeRuleset.leagues)).toEqual([]);
    expect(TEAM_FLAVOR_TEXT).toBeDefined();
  });
});

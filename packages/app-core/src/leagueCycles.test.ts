import { describe, expect, it } from 'vitest';
import { planLeagueCycle } from '@offside/contracts/league';
import type { LeagueMeResponse, LeagueResponse } from './api/league.js';
import { leagueReadiness, leagueEntryRules, leagueTeamAction, leagueRules } from './leagueView.js';
import { requestTeamSeason, takeTeamSeason } from './teamOwner.js';

const plan = planLeagueCycle(5, '2027-02-01T00:00:00.000Z', 3);
const data: LeagueResponse = {
  league: { ...plan, rounds: [...plan.rounds] },
  phase: 'open',
  entries: 8,
};
const me: LeagueMeResponse = { entry: { createdAt: plan.opensAt }, canEnter: false, team: null };

describe('league edition and card season remain separate', () => {
  it('uses the card season for eligibility and the 28-round rules for the league', () => {
    expect(leagueReadiness(data, me, Date.parse(plan.startsAt) + 1)?.text).toContain('시즌 3 팀');
    expect(leagueEntryRules(data)[0]).toContain('시즌 3 팀');
    expect(leagueRules(data.league).join(' ')).toContain('14일 뒤 한 번');
  });
  it('offers lineup editing during a running independent league', () => {
    const placed: LeagueMeResponse = {
      ...me,
      placement: { status: 'placed', tier: 1, league: 1, teamId: 'tem_1', rank: 1 },
    };
    expect(leagueTeamAction({ ...data, phase: 'running' }, placed)).toBe('팀 선발 고치기');
    requestTeamSeason(data.league.teamSeason!);
    expect(takeTeamSeason()).toBe(3);
    expect(takeTeamSeason()).toBeUndefined();
  });
});

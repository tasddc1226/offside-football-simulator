import { describe, expect, it } from 'vitest';
import { rulesetProto } from './__fixtures__/career-01.js';
import { buildSchedule, findLeague, resolveOpponent } from './schedule.js';
import type { Ruleset } from './ruleset.js';

const team = rulesetProto.teams.find((candidate) => candidate.id === 'seoul-tier1')!;
const league = findLeague(rulesetProto, team.leagueId);

describe('buildSchedule', () => {
  const schedule = buildSchedule(rulesetProto, team);
  const leagueEntries = schedule.filter((entry) => entry.kind === 'LEAGUE');
  const cupEntries = schedule.filter((entry) => entry.kind === 'CUP');

  it('teamCount 12 → 리그 22경기(원형 라운드로빈 2회전)를 만든다', () => {
    expect(league.teamCount).toBe(12);
    expect(leagueEntries).toHaveLength(22);
  });

  it('리그 경기는 step 3~11에 2~3경기씩 배치된다', () => {
    const byStep = new Map<number, number>();
    for (const entry of leagueEntries) byStep.set(entry.step, (byStep.get(entry.step) ?? 0) + 1);
    expect([...byStep.keys()].sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const count of byStep.values()) {
      expect(count).toBeGreaterThanOrEqual(2);
      expect(count).toBeLessThanOrEqual(3);
    }
  });

  it('홈·원정이 11:11이고, 같은 상대와 홈·원정을 한 번씩 치른다', () => {
    expect(leagueEntries.filter((entry) => entry.home)).toHaveLength(11);
    expect(leagueEntries.filter((entry) => !entry.home)).toHaveLength(11);

    const byOpponent = new Map<string, { home: number; away: number }>();
    for (const entry of leagueEntries) {
      const current = byOpponent.get(entry.opponentId) ?? { home: 0, away: 0 };
      if (entry.home) current.home += 1;
      else current.away += 1;
      byOpponent.set(entry.opponentId, current);
    }
    expect(byOpponent.size).toBe(league.teamCount - 1);
    for (const counts of byOpponent.values()) {
      expect(counts).toEqual({ home: 1, away: 1 });
    }
  });

  it('컵 4라운드(R1·R2·SEMI·FINAL)가 step 5·7·9·11에 있다', () => {
    expect(cupEntries.map((entry) => ({ step: entry.step, round: entry.round }))).toEqual([
      { step: 5, round: 'R1' },
      { step: 7, round: 'R2' },
      { step: 9, round: 'SEMI' },
      { step: 11, round: 'FINAL' },
    ]);
  });

  it('같은 step에서는 리그 경기가 먼저, 컵이 뒤(order로 표현)다', () => {
    const step5 = schedule.filter((entry) => entry.step === 5).sort((a, b) => a.order - b.order);
    expect(step5.slice(0, -1).every((entry) => entry.kind === 'LEAGUE')).toBe(true);
    expect(step5[step5.length - 1]!.kind).toBe('CUP');
    step5.forEach((entry, index) => expect(entry.order).toBe(index));
  });

  it('컵 tiers에 없는 팀은 컵 일정을 만들지 않는다', () => {
    const youthTeam = rulesetProto.teams.find((candidate) => candidate.leagueTier === 'YOUTH')!;
    const youthSchedule = buildSchedule(rulesetProto, youthTeam);
    expect(youthSchedule.some((entry) => entry.kind === 'CUP')).toBe(false);
  });

  it('일정 생성은 결정론적이다(같은 입력 → 같은 출력, roll을 소비하지 않는다)', () => {
    expect(buildSchedule(rulesetProto, team)).toEqual(schedule);
  });
});

describe('resolveOpponent', () => {
  it('이름 있는 팀은 룰셋의 이름·squadStrength를 그대로 쓴다', () => {
    const namedTeam = rulesetProto.teams.find((candidate) => candidate.id !== team.id)!;
    const resolved = resolveOpponent(rulesetProto, league, namedTeam.id);
    expect(resolved).toEqual({ id: namedTeam.id, name: namedTeam.name, strength: namedTeam.squadStrength });
  });

  it('이름 없는 상대는 opponentNameTemplate로 이름을 만들고 strength가 0~100 범위다', () => {
    const resolved = resolveOpponent(rulesetProto, league, 'league-tier1-opp-1');
    expect(resolved.id).toBe('league-tier1-opp-1');
    expect(resolved.strength).toBeGreaterThanOrEqual(0);
    expect(resolved.strength).toBeLessThanOrEqual(100);
    expect(Number.isInteger(resolved.strength)).toBe(true);
    expect(resolved.name).not.toContain('{league}');
    expect(resolved.name).not.toContain('{n}');
  });

  it('컵 라운드 상대는 cupStrengthByRound 기준값을 그대로 쓴다', () => {
    const resolved = resolveOpponent(rulesetProto, league, 'fa-cup-SEMI');
    expect(resolved.strength).toBe(rulesetProto.matchRules.cupStrengthByRound.SEMI);
  });

  it('해석할 수 없는 opponentId는 예외를 던진다', () => {
    expect(() => resolveOpponent(rulesetProto, league, 'not-a-real-opponent')).toThrow(RangeError);
  });
});

describe('findLeague', () => {
  it('룰셋에 없는 leagueId는 예외를 던진다', () => {
    expect(() => findLeague(rulesetProto as Ruleset, 'no-such-league')).toThrow(RangeError);
  });
});

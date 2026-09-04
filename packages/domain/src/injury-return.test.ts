import { describe, expect, it } from 'vitest';
import { findInjuryReturnMatchId } from './injury-return.js';
import { runCareerFixture } from './__fixtures__/career-01.js';
import type { FootballSeason, InjuryEpisode, MatchRecord } from './types.js';

function match(id: string, minutes: number, outReason: MatchRecord['outReason']): MatchRecord {
  return { id, minutes, outReason } as MatchRecord;
}

function season(index: number, currentStep: number, matches: MatchRecord[]): FootballSeason {
  return { index, currentStep, matches } as unknown as FootballSeason;
}

function episode(overrides: Partial<InjuryEpisode> = {}): InjuryEpisode {
  return {
    id: 'INJ-1-3-1',
    severity: 'MODERATE',
    bodyPart: 'HAMSTRING',
    occurredAt: { seasonIndex: 1, step: 3, matchId: 'old-match' },
    diagnosisRange: { minMatches: 3, maxMatches: 6 },
    rehab: 'STANDARD',
    recurrenceRiskBp: 3000,
    recurrenceChecksRemaining: 5,
    status: 'RECOVERED',
    permanentDelta: null,
    ...overrides,
  };
}

function stateWith(episodes: InjuryEpisode[], step: number) {
  const base = runCareerFixture();
  return {
    ...base.state,
    health: { episodes },
    timeline: [{ revision: 20, kind: 'REHAB_CHOSEN' as const, refId: episodes.at(-1)!.id, age: 18, step }],
  };
}

describe('findInjuryReturnMatchId', () => {
  it.each(['RECOVERED', 'RECURRED'] as const)('same-season first return survives a forced injury (%s prior episode)', (priorStatus) => {
    const prior = episode({ status: priorStatus, occurredAt: { seasonIndex: 1, step: 2, matchId: 'old-match' } });
    const pending = episode({
      id: 'INJ-1-3-2',
      status: 'REHAB',
      occurredAt: { seasonIndex: 1, step: 3, matchId: 'return-match' },
      remainingMatches: 4,
    });
    const currentSeason = season(1, 3, [
      match('old-match', 45, null),
      match('absence-1', 0, 'INJURY'),
      match('return-match', 45, null),
    ]);

    expect(findInjuryReturnMatchId(stateWith([prior, pending], 3), currentSeason, 3)).toBe('return-match');
  });

  it('cross-season carry recognizes leading injury absences before the first return', () => {
    const prior = episode({ occurredAt: { seasonIndex: 1, step: 11, matchId: 'season-1-match' } });
    const pending = episode({
      id: 'INJ-2-2-1',
      status: 'REHAB',
      occurredAt: { seasonIndex: 2, step: 2, matchId: 'season-2-return' },
      remainingMatches: 4,
    });
    const currentSeason = season(2, 2, [
      match('season-2-1-0', 0, 'INJURY'),
      match('season-2-1-1', 0, 'INJURY'),
      match('season-2-return', 45, null),
    ]);

    expect(findInjuryReturnMatchId(stateWith([prior, pending], 2), currentSeason, 2)).toBe('season-2-return');
  });

  it('cross-season 과거 회복 episode는 선두 injury 결장이 없으면 새 시즌 재부상을 return으로 오인하지 않는다', () => {
    const prior = episode({ occurredAt: { seasonIndex: 1, step: 11, matchId: 'season-1-match' } });
    const pending = episode({
      id: 'INJ-2-1-1',
      status: 'REHAB',
      occurredAt: { seasonIndex: 2, step: 1, matchId: 'season-2-first' },
      remainingMatches: 4,
    });
    const currentSeason = season(2, 1, [match('season-2-first', 45, null)]);

    expect(findInjuryReturnMatchId(stateWith([prior, pending], 1), currentSeason, 1)).toBeNull();
  });
});

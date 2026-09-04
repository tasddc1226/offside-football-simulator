import { describe, expect, it } from 'vitest';
import { applyRehabPlan, onMatchInjury } from './injury.js';
import { rulesetProto } from './__fixtures__/career-01.js';
import { seedRng } from './rng.js';
import type { CareerState, InjuryEpisode, MatchRecord } from './types.js';

function baseEpisode(overrides: Partial<InjuryEpisode> = {}): InjuryEpisode {
  return {
    id: 'INJ-1-3-1',
    severity: 'MODERATE',
    bodyPart: 'HAMSTRING',
    occurredAt: { seasonIndex: 1, step: 3, matchId: 'm1' },
    diagnosisRange: { minMatches: 3, maxMatches: 6 },
    rehab: null,
    recurrenceRiskBp: 3000,
    status: 'ACTIVE',
    permanentDelta: null,
    ...overrides,
  };
}

// T-4-001 D-49: 재활 계획 적용은 이번 작업 몫이지만, 실제 부상 발생 roll(심각도·부위 판정, episodes
// 추가, availability 설정)은 T-4-002가 채운다 — onMatchInjury는 그때까지 항등(입력 그대로 반환)이다.
describe('onMatchInjury', () => {
  it('T-4-002 전까지는 항등이다(health·availability·injuryCount·rng를 그대로 돌려주고 timeline은 빈 배열)', () => {
    const rng = seedRng('injury-test');
    const health: CareerState['health'] = { episodes: [baseEpisode()] };
    const match: MatchRecord = {
      id: 'm1',
      step: 3,
      order: 1,
      competitionId: 'LEAGUE',
      kind: 'LEAGUE',
      round: null,
      opponent: { id: 'opp-1', name: 'Opp', strength: 50 },
      home: true,
      result: { goalsFor: 1, goalsAgainst: 0, outcome: 'WIN' },
      appearance: 'START',
      outReason: null,
      minutes: 45,
      involvement: 50,
      stats: { group: 'FW', goals: 0, assists: 0, xgCenti: 0, shots: 1, offsides: 0 },
      ratingTenths: 60,
      cards: { yellow: 0, red: false },
      injuredOff: true,
      chapterId: null,
    };

    const result = onMatchInjury({
      state: { health } as CareerState,
      seasonIndex: 1,
      step: 3,
      match,
      availability: null,
      injuryCount: 0,
      ruleset: rulesetProto,
      rng,
    });

    expect(result.health).toBe(health);
    expect(result.availability).toBeNull();
    expect(result.injuryCount).toBe(0);
    expect(result.timeline).toEqual([]);
    expect(result.rng).toBe(rng);
  });
});

describe('applyRehabPlan', () => {
  it('EARLY: returnShiftMatches만큼 진단 범위를 당기고(최소 1로 clamp) recurrenceAddBp를 더한다', () => {
    const episode = baseEpisode({ diagnosisRange: { minMatches: 3, maxMatches: 6 }, recurrenceRiskBp: 3000 });
    const updated = applyRehabPlan(episode, 'EARLY', rulesetProto.injuryRules);
    // EARLY: returnShiftMatches -2, recurrenceAddBp +1500(룰셋 injuryRules.rehab.EARLY).
    expect(updated.diagnosisRange).toEqual({ minMatches: 1, maxMatches: 4 });
    expect(updated.recurrenceRiskBp).toBe(4500);
    expect(updated.status).toBe('REHAB');
    expect(updated.rehab).toBe('EARLY');
  });

  it('STANDARD: 진단 범위·recurrenceRiskBp를 그대로 두고 status만 REHAB으로 바꾼다', () => {
    const episode = baseEpisode({ diagnosisRange: { minMatches: 3, maxMatches: 6 }, recurrenceRiskBp: 3000 });
    const updated = applyRehabPlan(episode, 'STANDARD', rulesetProto.injuryRules);
    expect(updated.diagnosisRange).toEqual({ minMatches: 3, maxMatches: 6 });
    expect(updated.recurrenceRiskBp).toBe(3000);
    expect(updated.status).toBe('REHAB');
    expect(updated.rehab).toBe('STANDARD');
  });

  it('CONSERVATIVE: returnShiftMatches만큼 진단 범위를 늘리고 recurrenceAddBp(음수)만큼 뺀다', () => {
    const episode = baseEpisode({ diagnosisRange: { minMatches: 3, maxMatches: 6 }, recurrenceRiskBp: 3000 });
    const updated = applyRehabPlan(episode, 'CONSERVATIVE', rulesetProto.injuryRules);
    // CONSERVATIVE: returnShiftMatches +2, recurrenceAddBp -1000.
    expect(updated.diagnosisRange).toEqual({ minMatches: 5, maxMatches: 8 });
    expect(updated.recurrenceRiskBp).toBe(2000);
  });

  it('diagnosisRange 경계는 최소 1로 clamp된다(EARLY가 -2 이동시켜도 0 아래로 내려가지 않는다)', () => {
    const episode = baseEpisode({ diagnosisRange: { minMatches: 1, maxMatches: 2 } });
    const updated = applyRehabPlan(episode, 'EARLY', rulesetProto.injuryRules);
    expect(updated.diagnosisRange).toEqual({ minMatches: 1, maxMatches: 1 });
  });

  it('recurrenceRiskBp는 0~10000으로 clamp된다', () => {
    const high = applyRehabPlan(baseEpisode({ recurrenceRiskBp: 9500 }), 'EARLY', rulesetProto.injuryRules);
    expect(high.recurrenceRiskBp).toBe(10000);

    const low = applyRehabPlan(baseEpisode({ recurrenceRiskBp: 200 }), 'CONSERVATIVE', rulesetProto.injuryRules);
    expect(low.recurrenceRiskBp).toBe(0);
  });

  it('id·severity·bodyPart·occurredAt·permanentDelta는 건드리지 않는다', () => {
    const episode = baseEpisode({ permanentDelta: [{ key: 'durability', delta: -1 }] });
    const updated = applyRehabPlan(episode, 'STANDARD', rulesetProto.injuryRules);
    expect(updated.id).toBe(episode.id);
    expect(updated.severity).toBe(episode.severity);
    expect(updated.bodyPart).toBe(episode.bodyPart);
    expect(updated.occurredAt).toEqual(episode.occurredAt);
    expect(updated.permanentDelta).toEqual(episode.permanentDelta);
  });
});

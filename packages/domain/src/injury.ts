import { clamp } from './clamp.js';
import type { RngState } from './rng.js';
import type { InjuryRules, Ruleset } from './ruleset.js';
import type { Availability, CareerState, InjuryEpisode, MatchRecord, RehabPlan, TimelineEntry } from './types.js';

/**
 * T-4-001 D-49: 부상 이탈 경기마다 `simulate.ts` `stepMatchWiring`의 `playStepMatches`가 부르는 훅
 * 골격. 지금은 입력을 그대로 돌려준다(rng 소비 0) — 실제 심각도·부위 roll, `health.episodes` 추가,
 * `availability`(INJURY) 설정, `INJURED` 타임라인 기록은 T-4-002가 이 함수 본문만 채운다.
 */
export function onMatchInjury(input: {
  state: CareerState;
  seasonIndex: number;
  step: number;
  match: MatchRecord;
  availability: Availability;
  injuryCount: number;
  ruleset: Ruleset;
  rng: RngState;
}): {
  health: CareerState['health'];
  availability: Availability;
  injuryCount: number;
  timeline: TimelineEntry[];
  rng: RngState;
} {
  return {
    health: input.state.health,
    availability: input.availability,
    injuryCount: input.injuryCount,
    timeline: [],
    rng: input.rng,
  };
}

/**
 * T-4-001 D-52: `RESOLVE_EVENT`가 INJURY pending을 닫을 때 고른 재활 계획을 에피소드에 적용한다.
 * 진단 범위(`diagnosisRange`)를 `injuryRules.rehab[plan].returnShiftMatches`만큼 이동하되 각 경계는
 * 최소 1로 clamp하고, `recurrenceRiskBp`에 `recurrenceAddBp`를 더해 0~10000으로 clamp한다.
 */
export function applyRehabPlan(episode: InjuryEpisode, plan: RehabPlan, injuryRules: InjuryRules): InjuryEpisode {
  const rehabRule = injuryRules.rehab[plan];
  const minMatches = Math.max(1, episode.diagnosisRange.minMatches + rehabRule.returnShiftMatches);
  const maxMatches = Math.max(1, episode.diagnosisRange.maxMatches + rehabRule.returnShiftMatches);
  return {
    ...episode,
    status: 'REHAB',
    rehab: plan,
    diagnosisRange: { minMatches, maxMatches },
    recurrenceRiskBp: clamp(episode.recurrenceRiskBp + rehabRule.recurrenceAddBp, 0, 10000),
  };
}

import { clamp } from './clamp.js';
import type { ConditionRules } from './ruleset.js';
import type { MatchRecord } from './types.js';

export type ConditionState = { form: number; fitness: number; morale: number };

function moveToward(value: number, target: number, step: number): number {
  if (value === target) return value;
  return value < target ? Math.min(value + step, target) : Math.max(value - step, target);
}

/**
 * D-39: step 하나의 경기 뒤 폼·체력·사기를 갱신한다(roll 없음, step당 1회 — 경기 0건인 step도
 * 호출된다). `records`는 이 step에 실제로 벌어진 경기(`MatchRecord[]`)만 담는다. `formDriftTarget`은
 * 경기가 없거나 전부 0분일 때 폼이 되돌아가는 값(`ruleset.seasonBoundaryReset.form`).
 */
export function applyCondition(
  state: ConditionState,
  records: readonly MatchRecord[],
  rules: ConditionRules,
  formDriftTarget: number,
): ConditionState {
  const ratedRecords = records.filter((record) => record.ratingTenths !== null);

  let form: number;
  if (ratedRecords.length > 0) {
    const avgRatingTenths =
      ratedRecords.reduce((sum, record) => sum + record.ratingTenths!, 0) / ratedRecords.length;
    const delta = clamp(
      Math.trunc((avgRatingTenths - rules.formPivotTenths) / rules.formDivisorTenths),
      -rules.formStepMax,
      rules.formStepMax,
    );
    form = clamp(state.form + delta, 0, 100);
  } else {
    form = moveToward(state.form, formDriftTarget, rules.formDriftPerStep);
  }

  const minutesCost = records.reduce((sum, record) => sum + Math.trunc(record.minutes / rules.fitnessCostMinutes), 0);
  const anyInjury = records.some((record) => record.injuredOff);
  const fitness = clamp(
    state.fitness + rules.fitnessRecoveryPerStep - minutesCost - (anyInjury ? rules.injuryFitnessCost : 0),
    0,
    100,
  );

  let moraleStepDelta = 0;
  for (const record of records) {
    if (record.result.outcome === 'WIN') moraleStepDelta += rules.moraleWin;
    else if (record.result.outcome === 'LOSS') moraleStepDelta -= rules.moraleLoss;

    if (record.appearance === 'START') moraleStepDelta += rules.moraleStart;
    else if (record.outReason === 'NOT_SELECTED') moraleStepDelta -= rules.moraleNotSelected;
    else if (record.outReason === 'UNUSED_SUB') moraleStepDelta -= rules.moraleUnusedSub;
  }
  moraleStepDelta = clamp(moraleStepDelta, -rules.moraleStepMax, rules.moraleStepMax);
  const morale = clamp(state.morale + moraleStepDelta, 0, 100);

  return { form, fitness, morale };
}

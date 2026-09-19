// SCR-005 프리시즌 계획: 훈련 계획 선택지(순수 함수, 단위 테스트). `trainingFocus`는 domain
// Command에도 실려 나간다(T-2-005 접점, PR #40 머지 후 career-actions.ts의 toStartSeasonPayload가
// 전송) — 여기서는 화면 선택지·라벨만 소유한다.
//
// 시뮬레이션 모드: 사용자 결정(2026-09-13, D-77) — 원작(SLB)에는 시뮬레이션 모드가 없어 클라이언트는
// 더 이상 모드를 선택지로 노출하지 않는다. 모든 새 시즌은 FIXED_SIMULATION_MODE(FAST)로 시작한다.
// domain의 `SimulationMode`·`CareerState.season.simulationMode` 필드 자체는 과거(CHAPTER로 시작한)
// 커리어의 명령 로그 리플레이·state hash 검증을 위해 그대로 남아 있다 — 화면이 그 값을 읽어 연출을
// 분기하는 코드(fast reveal 등)는 계속 동작해야 하므로 건드리지 않는다.
import { retirementDecisionRequired, RETIREMENT_POLICY, type CareerState, type SimulationMode, type TrainingFocus } from '@offside/domain';
import { rulesetForCareer } from '../engine/content.js';

/** 사용자 결정(2026-09-13, D-77): 클라이언트는 시뮬레이션 모드를 선택하지 않고 항상 FAST로 시즌을
 * 시작한다. CREATE_CAREER·START_SEASON payload를 만드는 모든 곳이 이 상수를 쓴다. */
export const FIXED_SIMULATION_MODE: SimulationMode = 'FAST';

export type { TrainingFocus };

/** 계약·임대 복귀 등의 결정을 마친 커리어만 새 시즌을 계획할 수 있다. */
export function canPlanNextSeason(state: CareerState): boolean {
  if (state.status !== 'ACTIVE' || state.contract === null || state.season !== null || state.pending !== null) return false;
  return !retirementDecisionRequired(state, rulesetForCareer(state).retirementRules ?? RETIREMENT_POLICY);
}

/** START_SEASON 경합에서 도메인이 반환하는 은퇴 결정 경계인지만 식별한다. */
export function isRetirementDecisionRequiredError(error: { code: string; details?: unknown }): boolean {
  const details = error.details;
  return error.code === 'VALIDATION_FAILED' &&
    typeof details === 'object' &&
    details !== null &&
    'reason' in details &&
    details.reason === 'RETIREMENT_DECISION_REQUIRED';
}

export const TRAINING_FOCUS_OPTIONS: readonly TrainingFocus[] = ['ROLE', 'TECHNICAL', 'PHYSICAL', 'MENTAL'];

export const TRAINING_FOCUS_LABEL_KO: Record<TrainingFocus, string> = {
  ROLE: '역할 집중',
  TECHNICAL: '기술',
  PHYSICAL: '신체',
  MENTAL: '정신',
};

export const TRAINING_FOCUS_SUMMARY_KO: Record<TrainingFocus, string> = {
  ROLE: '내 플레이 스타일의 강점을 키웁니다.',
  TECHNICAL: '슈팅·패스·드리블을 가다듬습니다.',
  PHYSICAL: '스피드와 지구력을 끌어올립니다.',
  MENTAL: '판단력과 집중력을 기릅니다.',
};

/** SCR-005 인수 조건: 계획이 Base OVR·Expected Performance 중 무엇에 영향을 주는지 구분한다. */
export const TRAINING_FOCUS_IMPACT_KO = '훈련의 성과는 시즌 결산 때 능력치에 반영됩니다.';

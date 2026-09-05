// SCR-005 프리시즌 계획: 시뮬레이션 모드·훈련 계획 선택지와 RULE-TIME-003 기본값 규칙(순수 함수,
// 단위 테스트). `trainingFocus`는 domain Command에도 실려 나간다(T-2-005 접점, PR #40 머지 후
// career-actions.ts의 toStartSeasonPayload가 전송) — 여기서는 화면 선택지·라벨만 소유한다.
import type { CareerState, SimulationMode, TrainingFocus } from '@offside/domain';

export type { TrainingFocus };

/** 계약·임대 복귀 등의 결정을 마친 커리어만 새 시즌을 계획할 수 있다. */
export function canPlanNextSeason(state: CareerState): boolean {
  return state.status === 'ACTIVE' && state.contract !== null && state.season === null && state.pending === null;
}

export const TRAINING_FOCUS_OPTIONS: readonly TrainingFocus[] = ['ROLE', 'TECHNICAL', 'PHYSICAL', 'MENTAL'];

export const TRAINING_FOCUS_LABEL_KO: Record<TrainingFocus, string> = {
  ROLE: '역할 집중',
  TECHNICAL: '기술',
  PHYSICAL: '신체',
  MENTAL: '정신',
};

export const TRAINING_FOCUS_SUMMARY_KO: Record<TrainingFocus, string> = {
  ROLE: '아키타입 가중 능력 위주로 성장합니다.',
  TECHNICAL: '슈팅·패스 등 기술 능력 위주로 성장합니다.',
  PHYSICAL: '스피드·스태미나 등 신체 능력 위주로 성장합니다.',
  MENTAL: '판단력·집중력 등 정신 능력 위주로 성장합니다.',
};

/** SCR-005 인수 조건: 계획이 Base OVR·Expected Performance 중 무엇에 영향을 주는지 구분한다. */
export const TRAINING_FOCUS_IMPACT_KO = '영향: Base OVR(시즌 결산 시 성장) · 경기 예상치에는 즉시 영향 없음';

export const SIMULATION_MODE_LABEL_KO: Record<SimulationMode, string> = {
  FAST: '빠른 시즌',
  CHAPTER: '챕터 시즌',
};

export const SIMULATION_MODE_SUMMARY_KO: Record<SimulationMode, string> = {
  FAST: '핵심 경기(MAJOR)만 열립니다. 시즌당 결정 최대 6.',
  CHAPTER: '모든 챕터·이벤트가 열립니다. 시즌당 결정 최대 10.',
};

/**
 * RULE-TIME-003: 첫 프로 시즌(seasonHistory가 비어 있음) 또는 새 팀 첫 시즌(직전 시즌 teamId와 계약
 * teamId가 다름)이면 CHAPTER가 기본이다. 그 외에는 프로필 설정 기본값을 쓰고, 그 값이 없으면
 * 직전 시즌 모드를 쓴다.
 */
export function defaultSimulationMode(state: CareerState, profileDefault: SimulationMode | null): SimulationMode {
  if (state.seasonHistory.length === 0) return 'CHAPTER';
  const lastSeason = state.seasonHistory[state.seasonHistory.length - 1]!;
  if (state.contract !== null && lastSeason.teamId !== state.contract.teamId) return 'CHAPTER';
  return profileDefault ?? lastSeason.simulationMode;
}

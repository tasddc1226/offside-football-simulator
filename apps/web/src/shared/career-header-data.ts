// UX-014 커리어 상단 헤더: 이름·역할·OVR 표시값을 CareerState에서 뽑는 순수 함수 모음. CareerHeader
// 컴포넌트(props만 받는다, ADR-005)와 분리해 React 렌더 없이 이 파일만으로 단위 테스트한다.
import type { CareerState } from '@offside/domain';
import { SQUAD_ROLE_LABELS } from './labels.js';

/** 홈 탭 헤더·PlayerBanner와 같은 이름 규칙: profile 확정 전에는 draft 이름, 둘 다 없으면 대체 문구. */
export function careerHeaderName(state: CareerState): string {
  return state.player.profile?.name ?? state.player.draft.name ?? '이름 없는 선수';
}

/** profile 확정 전(드래프트 단계 이벤트 등)이면 null — 헤더가 "OVR —"로 표시한다(PlayerBanner와 같은
 * 규칙, 대시보드 홈 탭 헤더가 쓰던 `profile?.baseOvr ?? '—'` 경로를 그대로 옮겼다). */
export function careerHeaderOvr(state: CareerState): number | null {
  return state.player.profile?.baseOvr ?? null;
}

/**
 * 사용자 결정(2026-09-14): 역할 라벨은 계약의 squad role(선발/로테이션/벤치/예비 — SQUAD_ROLE_LABELS)
 * 이고, 계약 전에는 "신인"(첫 계약 전) 또는 "무소속"(과거 계약이 있었다 — 임대 복귀·방출 등, 이전
 * 시즌을 이미 치렀다는 뜻이라 `seasonHistory.length > 0`으로 구분한다). 시즌이 진행 중이면
 * `season.squadRole`(선발 경쟁 결과가 반영된 값)을 우선하고, 없으면 계약의 rolePromise를 쓴다 —
 * market.ts의 `currentSquadRole`과 같은 우선순위지만 그 함수는 export되지 않아 여기서 다시 쓴다.
 */
export function careerHeaderRoleLabel(state: CareerState): string {
  if (state.contract !== null) {
    const role = state.season?.squadRole ?? state.contract.rolePromise;
    return SQUAD_ROLE_LABELS[role];
  }
  return state.seasonHistory.length > 0 ? '무소속' : '신인';
}

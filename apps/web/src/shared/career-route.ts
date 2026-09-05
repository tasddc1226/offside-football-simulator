// 06 "내비게이션": 깊은 링크·재진입이 커리어 단계와 맞지 않을 때 이 함수가 안전한 화면을 고른다.
import type { CareerState } from '@offside/domain';
import { SCREEN_ROUTES } from '../routes.js';

export type ScreenTarget = {
  screenId: keyof typeof SCREEN_ROUTES;
  params: { careerId: string };
};

/** EVT-CON-002 → SCR-007(진로 선택), EVT-CON-003 → SCR-008(입단 테스트). 그 외는 SCR-013. */
const EVENT_SCREEN_OVERRIDES: Partial<Record<string, keyof typeof SCREEN_ROUTES>> = {
  'EVT-CON-002': 'SCR-007',
  'EVT-CON-003': 'SCR-008',
};

const DRAFT_FIELDS_WITHOUT_ARCHETYPE = [
  'name',
  'gender',
  'nationalityCode',
  'preferredFoot',
  'position',
  'backgroundId',
] as const;

/**
 * DRAFT: archetypeId를 뺀 6개 필드 중 하나라도 null이면 SCR-002, archetypeId만 비었으면 SCR-003,
 * 그 외 SCR-004. ACTIVE: pending.kind === 'EVENT'면 이벤트별 화면(기본 SCR-013), 'INJURY'면 SCR-013, 'OFFERS'면
 * SCR-009/017, 'ROLE_PROPOSAL'이면 SCR-012, 'CHAPTER'면 SCR-031(자리표시), LOAN_RETURN은 대시보드의
 * 전용 SCR-020 CTA가 열고, 그 외(SETTLEMENT·CONTRACT·NATIONAL_TEAM)와 pending 없음은 SCR-029.
 * RETIRED·ARCHIVED는 SCR-029(phase-1-plan.md D-13 화면 해석 규칙).
 */
export function screenForCareer(state: CareerState): ScreenTarget {
  const params = { careerId: state.careerId };

  if (state.status === 'DRAFT') {
    const draft = state.player.draft;
    const missingCore = DRAFT_FIELDS_WITHOUT_ARCHETYPE.some((field) => draft[field] === null);
    if (missingCore) return { screenId: 'SCR-002', params };
    if (draft.archetypeId === null) return { screenId: 'SCR-003', params };
    return { screenId: 'SCR-004', params };
  }

  if (state.status === 'ACTIVE') {
    const pending = state.pending;
    if (pending !== null && (pending.kind === 'EVENT' || pending.kind === 'INJURY' || pending.kind === 'NATIONAL_TEAM')) {
      const screenId = pending.kind === 'EVENT' ? EVENT_SCREEN_OVERRIDES[pending.eventId] ?? 'SCR-013' : 'SCR-013';
      return { screenId, params };
    }
    if (pending !== null && pending.kind === 'OFFERS') {
      return { screenId: pending.market.reason === 'FIRST_CONTRACT' ? 'SCR-009' : 'SCR-017', params };
    }
    // T-3-003 §9: step 7 재계약 사전 협상(CONTRACT, 제안 있음)은 시장 비교 화면을 재사용한다.
    if (pending !== null && pending.kind === 'CONTRACT' && pending.offers.length > 0) {
      return { screenId: pending.market.reason === 'FIRST_CONTRACT' ? 'SCR-009' : 'SCR-017', params };
    }
    // T-2-002 D-34: 감독 역할 제안은 RESOLVE_ROLE로만 닫히는 실제 결정이라 전용 화면으로 보낸다.
    if (pending !== null && pending.kind === 'ROLE_PROPOSAL') {
      return { screenId: 'SCR-012', params };
    }
    // T-2-004(PR #41, origin/main 머지 확인)가 CHAPTER pending에 chapterId 등 실제 형태를 채웠다.
    // 실제 경기 화면은 T-2-008 몫이라 여기서는 자리표시(SCR-031)로만 보낸다.
    if (pending !== null && pending.kind === 'CHAPTER') {
      return { screenId: 'SCR-031', params };
    }
    return { screenId: 'SCR-029', params };
  }

  // RETIRED · ARCHIVED
  return { screenId: 'SCR-029', params };
}

export type PlayerCreationScreenId = 'SCR-002' | 'SCR-003' | 'SCR-004';

export type StepGuardResult = { allowed: true } | { allowed: false; target: ScreenTarget };

const PLAYER_CREATION_ORDER: PlayerCreationScreenId[] = ['SCR-002', 'SCR-003', 'SCR-004'];

/**
 * SCR-002·003·004 라우트 진입 가드. DRAFT 상태에서는 이 화면의 앞선 화면이 필요하면(예:
 * archetypeId 없이 /confirm 진입) 그 화면으로 보낸다. 06 "내비게이션"의 "브라우저 뒤로 가기는
 * DRAFT 이전 화면으로 이동할 수 있다"에 따라, draft가 이 화면보다 더 앞서 있어도(예: archetype을
 * 이미 골랐어도) 되돌아온 방문은 막지 않는다 — 그래서 target이 expected와 같거나 더 나중이면
 * allowed다. DRAFT를 벗어난 뒤(확정 이후)에는 SCR-004의 복구 코드 단계(URL에 남는 상태)만
 * 예외이고, 그 외에는 항상 screenForCareer의 실제 목적지로 보낸다.
 */
export function guardCareerStep(
  state: CareerState,
  expected: PlayerCreationScreenId,
  options?: { recoveryStepActive?: boolean },
): StepGuardResult {
  if (state.status === 'DRAFT') {
    const target = screenForCareer(state);
    const targetIndex = PLAYER_CREATION_ORDER.indexOf(target.screenId as PlayerCreationScreenId);
    const expectedIndex = PLAYER_CREATION_ORDER.indexOf(expected);
    if (targetIndex < 0 || targetIndex < expectedIndex) {
      return { allowed: false, target };
    }
    return { allowed: true };
  }

  if (expected === 'SCR-004' && options?.recoveryStepActive === true) {
    return { allowed: true };
  }
  return { allowed: false, target: screenForCareer(state) };
}

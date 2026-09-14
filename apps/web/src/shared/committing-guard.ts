// UX-014 후속(#231 리뷰): use-committing-exit-guard.ts가 지키는 화면들(confirm·chapter·offers·
// contract·transfer-result·event-screen — SCR-004 KICKOFF+복구 코드 구간 포함)이 지금 COMMITTING
// 중인지를 CareerHeaderBar와 공유하는 신호. 전역 useIsMutating()만으로는 부족하다 — 결산 연출
// (GameCompletionTransition, 최소 SCREEN_TRANSITION_MS)이 실제 뮤테이션보다 오래 지속되는 동안에도,
// 그리고 뮤테이션이 전부 끝난 뒤에도 화면 자신의 FSM이 COMMITTING을 유지하는 동안에는(예: 복구 코드
// 발급 대기) 헤더 홈 버튼이 이탈 방지를 우회해선 안 되기 때문이다.
//
// 영속화하지 않는다(ui-store.ts와 달리 LocalStore에 쓰지 않는다) — 탭을 새로고침하면 beforeunload
// 확인창이 먼저 뜨고, 새로고침 뒤에는 각 화면이 자기 screenState를 다시 계산해 필요하면 다시
// 등록한다.
import { create } from 'zustand';

interface CommittingGuardState {
  /** 라우트 단위로 최대 1개만 활성화될 것으로 예상하지만, StrictMode 이중 마운트나 빠른 라우트
   * 전환 중 effect cleanup 순서가 흔들려도 안전하도록 불리언 대신 카운트로 관리한다. */
  activeCount: number;
}

export const useCommittingGuardStore = create<CommittingGuardState>(() => ({ activeCount: 0 }));

/** use-committing-exit-guard.ts 전용: COMMITTING 진입 시 호출하고, 반환된 함수를 effect cleanup에서
 * 호출해 해제한다. 중복 해제는 안전하게 무시한다. */
export function registerCommittingGuard(): () => void {
  useCommittingGuardStore.setState((state) => ({ activeCount: state.activeCount + 1 }));
  let released = false;
  return () => {
    if (released) return;
    released = true;
    useCommittingGuardStore.setState((state) => ({
      activeCount: Math.max(0, state.activeCount - 1),
    }));
  };
}

/** CareerHeaderBar 등 소비자용: 지금 어떤 화면이든 COMMITTING 이탈 방지가 걸려 있으면 true. */
export function useIsCommittingGuardActive(): boolean {
  return useCommittingGuardStore((state) => state.activeCount > 0);
}

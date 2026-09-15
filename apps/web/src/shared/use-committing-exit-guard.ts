// 06 "공통 상태": COMMITTING 중 이탈 시 경고한다. `active`인 동안 탭 닫기·새로고침·주소창 이동을
// `beforeunload`로 막고, CareerHeaderBar가 구독하는 전역 committing-guard 신호도 함께 켠다(#231
// 리뷰 — 헤더 홈 버튼이 전역 useIsMutating()만 보면, 뮤테이션은 끝났지만 화면 자체 FSM은 아직
// COMMITTING인 구간(SCR-004 KICKOFF 연출·복구 코드 대기 등)에서 이탈 방지를 우회한다).
//
// 뒤로 가기(popstate)는 다루지 않는다 — 범위 밖 발견 사항 2가 요구하는 대화상자를 만들려면
// `platform.lifecycle.onBackPressed`(web 구현은 popstate)가 반응하기 전에 이미 바뀐 URL을 되돌릴
// "더미 히스토리 항목"을 COMMITTING 시작 시 `history.pushState`로 미리 쌓아 둬야 한다. 그런데
// TanStack Router의 `createBrowserHistory`(node_modules/@tanstack/history, `stateIndexKey =
// "__TSR_index"`)는 각 히스토리 항목의 `state.__TSR_index`로 popstate가 앞으로 갔는지 뒤로 갔는지
// 계산한다. 우리가 넣는 항목엔 이 내부 키가 없어(`history.pushState(null, ...)`) 그 다음 popstate의
// delta가 NaN이 되고, 라우터의 내부 인덱스 추적이 그 뒤로도 계속 깨진다(직접 확인). 내부 전용 키에
// 의존해 흉내 내는 대신, 이 이탈 경고는 beforeunload만 연결하는 최소 구현으로 남긴다(PR 본문 기록,
// 브리프가 허용한 대안).
import { useEffect } from 'react';
import { registerCommittingGuard } from './committing-guard.js';

export function useCommittingExitGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    const releaseCommittingGuard = registerCommittingGuard();

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      releaseCommittingGuard();
    };
  }, [active]);
}

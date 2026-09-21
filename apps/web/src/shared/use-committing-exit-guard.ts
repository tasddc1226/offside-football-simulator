// 06 "공통 상태": COMMITTING 중 이탈 시 경고한다. `active`인 동안 탭 닫기·새로고침·주소창 이동을
// `beforeunload`로 막고, CareerHeaderBar가 구독하는 전역 committing-guard 신호도 함께 켠다(#231
// 리뷰 — 헤더 홈 버튼이 전역 useIsMutating()만 보면, 뮤테이션은 끝났지만 화면 자체 FSM은 아직
// COMMITTING인 구간(SCR-004 KICKOFF 연출·복구 코드 대기 등)에서 이탈 방지를 우회한다).
//
// 뒤로 가기(popstate)는 다루지 않는다 — 범위 밖 발견 사항 2가 요구하는 대화상자를 만들려면
// `platform.lifecycle.onBackPressed`(web 구현은 popstate)가 반응하기 전에 COMMITTING 시작 시점의
// 화면으로 라우터를 도로 밀어 넣거나 확인 대화상자를 띄우는 로직이 필요하다. T-7-039로 라우터
// 히스토리는 실제 브라우저 히스토리가 아니라 메모리 히스토리로 바뀌었고, 실제 브라우저 뒤로가기는
// `packages/platform/src/web/index.ts`가 쌓아 두는 별도의 "가드 엔트리"(`pushState` +
// `offsideBackGuard` 마커)로만 가로챈다 — 그 가드는 "라우터 안에서 뒤로 갈 수 있으면 그리로,
// 아니면 `/`로" 판단만 하고 화면별 확인 대화상자는 모른다. COMMITTING 중 뒤로가기에 별도 확인을
// 넣으려면 이 가드 파이프라인에 COMMITTING 여부를 끼워 넣어야 하는데, 이는 새 기능이라 범위 밖이다
// (D-62: 새 테스트·새 기능 없이 기존 구조에 최소한만 더한다). 그래서 이 이탈 경고는 여전히
// beforeunload만 연결하는 최소 구현으로 남긴다(PR 본문 기록, 브리프가 허용한 대안).
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

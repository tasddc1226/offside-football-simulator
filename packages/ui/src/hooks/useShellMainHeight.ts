import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * UX-012 ScreenTransition에서 처음 만든 셸 높이 동기화 로직을 재사용 가능한 훅으로 추출한 것.
 *
 * 중간 조상들(`.os-route-motion`·`.os-swipe-surface`·`.os-swipe-content` 등)이 모두
 * `display:block` auto-height라 CSS 퍼센트로는 `.os-shell-main`(UX-006 앱 셸, flex:1로 실제
 * 높이가 정해짐)의 실제 높이를 물려받을 수 없다. 이 훅은 `ref`가 가리키는 요소가 `.os-shell-main`
 * 조상을 가지면 그 `clientHeight`에서 상하 padding을 뺀 값(콘텐츠 박스 높이)을 그 요소의 인라인
 * `min-height`로 설정하고, `ResizeObserver`로 셸 크기 변화를 계속 추종한다(border-box이므로 이
 * 값이 곧 요소가 셸 본문의 콘텐츠 영역을 정확히 채우는 높이다).
 *
 * `.os-shell-main` 조상이 없으면(스토리·단위 테스트·비셸 맥락) 아무 것도 하지 않는다 — 호출부의
 * CSS 폴백(예: `min-height: 100%`)에 맡긴다.
 *
 * 렌더마다 다시 확인한다(의존성 배열 없음) — 호출부가 조건부 렌더링 뒤 나중 렌더에서야 `ref`를
 * 붙이는 경우(예: 다른 상태값에 따라 완전히 다른 트리를 반환하는 화면)에도 `ref.current`가 그
 * 렌더의 커밋 이후에는 채워져 있으므로 그 다음 렌더에서 정상 추적을 시작한다. 같은 `.os-shell-main`
 * 을 계속 관찰 중이면 내부적으로 재구독을 건너뛰어 매 렌더 ResizeObserver를 새로 만들지 않는다.
 */
export function useShellMainHeight(ref: RefObject<HTMLElement | null>): void {
  const observedShellMainRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    function syncHeight() {
      const shellMain = node?.closest('.os-shell-main');
      if (!(shellMain instanceof HTMLElement) || !node) return;
      const computed = window.getComputedStyle(shellMain);
      const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(computed.paddingBottom) || 0;
      const contentHeight = shellMain.clientHeight - paddingTop - paddingBottom;
      if (contentHeight > 0) {
        node.style.minHeight = `${contentHeight}px`;
      }
    }

    const shellMain = node.closest('.os-shell-main');
    if (!(shellMain instanceof HTMLElement)) {
      // 셸 밖(스토리·단위 테스트)에서는 호출부의 CSS 폴백에 맡긴다.
      return;
    }

    syncHeight();

    if (observedShellMainRef.current === shellMain && observerRef.current) {
      // 이미 같은 .os-shell-main을 관찰 중 — 재구독할 필요가 없다.
      return;
    }

    observerRef.current?.disconnect();
    observerRef.current = null;
    observedShellMainRef.current = shellMain;

    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(syncHeight);
    observer.observe(shellMain);
    observerRef.current = observer;
  });

  // 컴포넌트 언마운트 시에만 최종적으로 구독을 정리한다.
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      observedShellMainRef.current = null;
    };
  }, []);
}

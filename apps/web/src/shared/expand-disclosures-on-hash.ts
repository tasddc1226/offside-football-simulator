// UX-003: 저사용 섹션 접이식(<details>) 전환. 상단 빠른 이동 앵커(`#id`)로 들어온 접힘 상태의
// <details>는 자동으로 펼쳐야 앵커가 가리키는 내용이 실제로 보인다. `<details>`는 열려 있어야만
// 스크롤·포커스 대상이 되므로, 해시가 가리키는 요소 내부의 details(하위 접이식)뿐 아니라 그 요소
// 자신을 담고 있는 조상 details(예: settings-play처럼 id가 Disclosure 안에 있는 경우)도 전부
// 열어야 한다. 조상이 닫혀 있었다면 브라우저의 자동 앵커 스크롤이 이미 실패했을 수 있으므로 연
// 뒤 다시 스크롤한다.
import { useEffect } from 'react';

function expandDisclosuresForCurrentHash() {
  const id = window.location.hash.slice(1);
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  target.querySelectorAll('details').forEach((details) => {
    details.open = true;
  });
  for (let ancestor = target.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor instanceof HTMLDetailsElement) {
      ancestor.open = true;
    }
  }
  // __root.tsx의 라우트 전환 스크롤 리셋(main#game-content.scrollTop = 0, onRendered 구독)이
  // 같은 커밋 주기에 뒤따라와 방금 연 스크롤을 되돌릴 수 있어, 다음 프레임으로 미뤄 그 리셋
  // 이후에 스크롤한다. jsdom(테스트 환경)은 scrollIntoView·rAF를 구현하지 않을 수 있다.
  const raf = window.requestAnimationFrame?.bind(window);
  if (raf) {
    raf(() => target.scrollIntoView?.());
  } else {
    target.scrollIntoView?.();
  }
}

/** 마운트 시 한 번, 이후 해시가 바뀔 때마다(앵커 클릭) 대상 안팎의 details를 열고 스크롤한다. */
export function useExpandDisclosuresOnHash(): void {
  useEffect(() => {
    expandDisclosuresForCurrentHash();
    window.addEventListener('hashchange', expandDisclosuresForCurrentHash);
    return () => window.removeEventListener('hashchange', expandDisclosuresForCurrentHash);
  }, []);
}

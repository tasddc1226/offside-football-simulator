// UX-003: 저사용 섹션 접이식(<details>) 전환. 상단 빠른 이동 앵커(`#id`)로 들어온 접힘 상태의
// <details>는 자동으로 펼쳐야 앵커가 가리키는 내용이 실제로 보인다. `<details>`는 열려 있어야만
// 스크롤·포커스 대상이 되므로, 해시가 가리키는 요소 내부의 details(하위 접이식)뿐 아니라 그 요소
// 자신을 담고 있는 조상 details(예: settings-play처럼 id가 Disclosure 안에 있는 경우)도 전부
// 열어야 한다. 조상이 닫혀 있었다면 브라우저의 자동 앵커 스크롤이 이미 실패했을 수 있으므로 연
// 뒤 다시 스크롤한다.
//
// T-7-039: 메모리 히스토리로 바뀌면서 실제 주소창의 hash(`window.location.hash`)는 더 이상 화면
// 상태를 반영하지 않는다(대부분 `/`로 고정) — 호출부(settings.tsx)가 라우터 위치의 hash
// (`useRouterState`)를 읽어 넘겨준다. 그래서 `hashchange` 구독도 없앴다: hash가 prop으로 바뀌면
// useEffect 의존성이 그 역할을 대신한다.
import { useEffect } from 'react';

function expandDisclosuresForHash(hash: string) {
  const id = hash.startsWith('#') ? hash.slice(1) : hash;
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
  // __root.tsx의 라우트 전환 스크롤 리셋(main#game-content.scrollTop = 0, onRendered 구독)은
  // 목적지 해시가 가리키는 요소가 실제로 존재하는 전환에서는 건너뛰도록 고쳤다(UX-013 후속) — 그
  // 전에는 같은 커밋 주기에 이 스크롤을 도로 0으로 되돌릴 수 있어 다음 프레임으로 미루는 우회가
  // 필요했다. 이제 경합 자체가 없어 즉시 스크롤한다. jsdom(테스트 환경)은 scrollIntoView를
  // 구현하지 않을 수 있다.
  target.scrollIntoView?.();
}

/** 마운트 시, 이후 라우터 위치의 hash가 바뀔 때마다(앵커 클릭) 대상 안팎의 details를 열고 스크롤한다. */
export function useExpandDisclosuresOnHash(hash: string): void {
  useEffect(() => {
    expandDisclosuresForHash(hash);
  }, [hash]);
}

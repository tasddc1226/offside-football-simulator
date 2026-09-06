// UX-003: 저사용 섹션 접이식(<details>) 전환. 상단 빠른 이동 앵커(`#id`)로 들어온 접힘 상태의
// <details>는 자동으로 펼쳐야 앵커가 가리키는 내용이 실제로 보인다. `<details>`는 열려 있어야만
// 스크롤·포커스 대상이 되므로, 해시가 가리키는 요소 내부의 모든 details를 미리 열어 둔다.
import { useEffect } from 'react';

function expandDisclosuresForCurrentHash() {
  const id = window.location.hash.slice(1);
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  target.querySelectorAll('details').forEach((details) => {
    details.open = true;
  });
}

/** 마운트 시 한 번, 이후 해시가 바뀔 때마다(앵커 클릭) 대상 안의 details를 연다. */
export function useExpandDisclosuresOnHash(): void {
  useEffect(() => {
    expandDisclosuresForCurrentHash();
    window.addEventListener('hashchange', expandDisclosuresForCurrentHash);
    return () => window.removeEventListener('hashchange', expandDisclosuresForCurrentHash);
  }, []);
}

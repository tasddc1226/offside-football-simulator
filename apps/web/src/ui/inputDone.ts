// T-10-118 한 줄 입력 칸: 엔터(모바일 키보드의 '완료')를 누르면 초점을 내려 키보드를 닫는다.
// iOS 숫자 키패드엔 완료 키가 없고 키보드가 아래 고정 버튼을 가리므로, 바깥을 눌러야만 닫히던 것을 막는다.
// 한글 조합 중 엔터(isComposing)는 글자 확정이라 건드리지 않는다. 폼 제출은 막지 않는다.
export function doneOnEnter(node: HTMLInputElement) {
  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.isComposing) node.blur();
  };
  node.addEventListener('keydown', onkeydown);
  return { destroy: () => node.removeEventListener('keydown', onkeydown) };
}

// 키보드가 떠도 실제로 보이는 영역(visualViewport)을 CSS 변수로 알린다. iOS Safari는 키보드가 올라와도 vh·dvh(레이아웃
// 뷰포트)를 줄이지 않고 페이지를 밀어 올린다(T-10-118, T-11-019). 높이는 --vvh, 밀려 올라간 만큼은 --vvtop.
// onResize는 높이가 바뀔 때(키보드가 오르내릴 때)만 부른다. 떼는 함수를 돌려준다(지원하지 않으면 변수 없이 끝).

export function trackViewport(el: HTMLElement, onResize?: () => void): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  let h = -1;
  let top = -1;
  const move = () => {
    if (vv.offsetTop === top) return;
    top = vv.offsetTop;
    el.style.setProperty('--vvtop', `${top}px`);
  };
  const resize = () => {
    move();
    if (vv.height === h) return;
    h = vv.height;
    el.style.setProperty('--vvh', `${h}px`);
    onResize?.();
  };
  resize();
  vv.addEventListener('resize', resize);
  vv.addEventListener('scroll', move);
  return () => {
    vv.removeEventListener('resize', resize);
    vv.removeEventListener('scroll', move);
    el.style.removeProperty('--vvh');
    el.style.removeProperty('--vvtop');
  };
}

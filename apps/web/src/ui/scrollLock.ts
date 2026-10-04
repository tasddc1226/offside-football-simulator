// T-10-117 모달(시트·팀 선수 고르기)이 열린 동안 뒤 페이지 스크롤을 잠근다(iOS는 overscroll-behavior만으로
// 뒤 페이지가 밀린다). position:fixed 방식이 아니라 <html>에 overflow:hidden(CSS .scroll-locked)만 걸어서
// 스크롤 위치가 그대로 남는다. 모달이 겹쳐 열려도 마지막 하나가 닫힐 때만 푼다(참조 횟수).
let locks = 0;

/** 스크롤을 잠그고, 잠금을 푸는 함수를 돌려준다(두 번 불러도 한 번만 푼다). */
export function lockScroll(): () => void {
  if (typeof document === 'undefined') return () => {};
  if (locks++ === 0) document.documentElement.classList.add('scroll-locked');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) document.documentElement.classList.remove('scroll-locked');
  };
}

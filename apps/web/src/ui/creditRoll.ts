// ───────── T-10-129 커리어 재생 ─────────
// 은퇴 선수 상세의 '커리어 재생' 버튼을 누르면 엔딩 크레딧처럼 일정한 속도로 천천히 내려간다. 장면은 화면 아래쪽에
// 들어올 때 올라오므로(LegendReport reveal) 끊어서 끌어오지 않고 계속 흘려야 글·그림이 스크롤과 함께 뜬다.
// 처음엔 서서히 빨라지고 마지막 휘슬(finale)이 가운데쯤 오면 서서히 멈춘다. 끝에서 다시 누르면 처음부터.
// 휠·터치·키·클릭(재생 버튼 말고)이 들어오면 그 자리에서 멈춘다.

import { ROLL_SPEED, rollEnd, rollSpeed } from '@offside/app-core/creditRoll';
export { ROLL_SPEED, rollEnd, rollSpeed };

/** 재생을 시작하고 멈추는 함수를 돌려준다. 끝까지 가거나 사용자가 손대거나 stop을 부르면 onStop이 한 번 불린다. */
export function rollCredits(root: HTMLElement, onStop: () => void): () => void {
  const endY = () => {
    const f = root.querySelector<HTMLElement>('[data-credit="finale"]')?.getBoundingClientRect();
    const vh = innerHeight;
    return rollEnd(
      f ? { top: f.top + scrollY, height: f.height } : null,
      vh,
      document.documentElement.scrollHeight - vh,
    );
  };
  let y = scrollY;
  if (endY() - y < 40) {
    y = 0;
    scrollTo(0, 0);
  }
  let raf = 0;
  let done = false;
  const t0 = performance.now();
  let last = t0;

  const stop = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    for (const e of INPUTS) removeEventListener(e, touched);
    onStop();
  };
  // 재생 버튼 자체를 누르는 건 버튼이 처리한다(멈춤).
  const touched = (e: Event) => {
    if (!(e.target instanceof Element && e.target.closest('[data-act="career-play"]'))) stop();
  };
  const INPUTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
  for (const e of INPUTS) addEventListener(e, touched, { passive: true });

  // 끝 위치는 장면이 늦게 붙어(LateCredits) 바뀔 수 있어 가끔만 다시 잰다 — 매 프레임 재면 레이아웃을 강제한다.
  let end = endY();
  let measuredAt = t0;
  const frame = (now: number) => {
    const dt = Math.min(64, now - last) / 1000;
    last = now;
    if (now - measuredAt > 250) {
      end = endY();
      measuredAt = now;
    }
    y = Math.min(end, y + rollSpeed(now - t0, end - y) * dt);
    scrollTo(0, y);
    if (y >= end - 0.5 || document.hidden) return stop();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return stop;
}

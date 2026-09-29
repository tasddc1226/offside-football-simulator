// ───────── T-10-129 커리어 재생 ─────────
// 은퇴 선수 상세의 '커리어 재생' 버튼을 누르면 엔딩 크레딧처럼 일정한 속도로 천천히 내려간다. 장면은 화면 아래쪽에
// 들어올 때 올라오므로(LegendReport reveal) 끊어서 끌어오지 않고 계속 흘려야 글·그림이 스크롤과 함께 뜬다.
// 처음엔 서서히 빨라지고 마지막 휘슬(finale)이 가운데쯤 오면 서서히 멈춘다. 끝에서 다시 누르면 처음부터.
// 휠·터치·키·클릭(재생 버튼 말고)이 들어오면 그 자리에서 멈춘다.

/** 흐르는 속도(px/초). */
export const ROLL_SPEED = 64;
const RAMP_MS = 700;
/** 끝나기 이만큼(px) 전부터 느려진다. */
const EASE_OUT = 160;

/** 재생을 멈출 스크롤 위치: 마지막 휘슬 가운데가 화면 45% 높이에 올 때. 문서 끝을 넘지 않는다. */
export function rollEnd(
  finale: { top: number; height: number } | null,
  vh: number,
  maxY: number,
): number {
  return finale ? Math.max(0, Math.min(maxY, finale.top + finale.height / 2 - vh * 0.45)) : maxY;
}

/** 이번 프레임의 속도(px/초): 출발할 때 서서히 오르고, 끝 가까이에서 서서히 줄되 아주 멈추지는 않는다. */
export function rollSpeed(sinceStart: number, left: number): number {
  return (
    ROLL_SPEED * Math.min(1, sinceStart / RAMP_MS) * Math.min(1, Math.max(0.15, left / EASE_OUT))
  );
}

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

  const frame = (now: number) => {
    const dt = Math.min(64, now - last) / 1000;
    last = now;
    const end = endY();
    y = Math.min(end, y + rollSpeed(now - t0, end - y) * dt);
    scrollTo(0, y);
    if (y >= end - 0.5 || document.hidden) return stop();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return stop;
}

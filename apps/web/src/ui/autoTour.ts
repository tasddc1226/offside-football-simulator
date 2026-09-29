// ───────── T-10-127 은퇴 선수 상세 자동 넘김 ─────────
// 3초 동안 아무 입력이 없으면 다음 장면(.film [data-credit])을 화면 가운데쯤으로 천천히 끌어온다. 도착하면 다시 3초를
// 기다려 그다음 장면으로 — 크레딧을 보듯 흘러간다. 스크롤·터치·휠·키·클릭이 들어오면 움직이던 것도 그 자리에서 멈추고
// 다시 3초를 센다. 마지막 휘슬(finale)에 닿으면 끝. 감속 모션이면 아무것도 안 한다. 시트·다이얼로그가 떠 있거나
// 탭이 숨겨져 있으면 넘기지 않는다.
import { motionOK } from './motion.js';

const IDLE_MS = 3000;
/** 장면 가운데를 이 높이(화면 비율)에 맞춘다 — 가운데보다 살짝 위라 아래 액션바에 가리지 않는다. 화면의 70%보다 큰 장면은 머리를 위쪽 12%에. */
const FOCUS = 0.4;
/** 한 번에 이보다 멀면(화면 비율) 이만큼만 내려간다 — 긴 장면도 건너뛰지 않고 읽히게. */
const MAX_STEP = 0.6;

/** 문서 기준 장면 위치(top·height)와 지금 스크롤로 다음에 갈 스크롤 위치. 더 갈 곳이 없으면 null. */
export function nextScroll(
  stops: { top: number; height: number }[],
  y: number,
  vh: number,
  maxY: number,
): number | null {
  const want = (s: { top: number; height: number }) =>
    s.height < vh * 0.7 ? s.top + s.height / 2 - vh * FOCUS : s.top - vh * 0.12;
  const target = stops.map(want).find((t) => t > y + 24);
  if (target === undefined) return null;
  const to = Math.min(target, maxY);
  if (to <= y + 24) return null;
  return Math.min(to, y + vh * MAX_STEP);
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function autoTour(node: HTMLElement) {
  if (!motionOK) return;
  let timer = 0;
  let raf = 0;
  let moving = false;

  const stop = () => {
    cancelAnimationFrame(raf);
    moving = false;
  };
  const arm = () => {
    clearTimeout(timer);
    timer = window.setTimeout(step, IDLE_MS);
  };
  const busy = () =>
    document.hidden || !!document.querySelector('dialog[open], [aria-modal="true"]');

  function step() {
    if (busy()) return arm();
    const stops = [...node.querySelectorAll<HTMLElement>('.film [data-credit]')].map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + scrollY, height: r.height };
    });
    const vh = innerHeight;
    const from = scrollY;
    const to = nextScroll(stops, from, vh, document.documentElement.scrollHeight - vh);
    if (to == null) return;
    // 멀수록 조금 더 길게, 그래도 천천히(0.9~2.4초).
    const ms = Math.min(2400, 900 + (to - from) * 1.6);
    const t0 = performance.now();
    moving = true;
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      scrollTo(0, from + (to - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(frame);
      else {
        moving = false;
        arm();
      }
    };
    raf = requestAnimationFrame(frame);
  }

  // 사용자가 손대면 멈추고 다시 센다. 자동으로 움직이는 동안의 scroll 이벤트는 사용자 입력이 아니다.
  const touched = () => {
    stop();
    arm();
  };
  const scrolled = () => {
    if (!moving) arm();
  };
  const INPUTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
  for (const e of INPUTS) addEventListener(e, touched, { passive: true });
  addEventListener('scroll', scrolled, { passive: true });
  arm();

  return {
    destroy() {
      clearTimeout(timer);
      stop();
      for (const e of INPUTS) removeEventListener(e, touched);
      removeEventListener('scroll', scrolled);
    },
  };
}

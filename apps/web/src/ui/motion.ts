// ───────── 모션 공통 유틸 (T-10-003) ─────────
import { cubicOut } from 'svelte/easing';
import { sheetOn } from './skin.svelte.js';
// prefers-reduced-motion 판정을 한 곳에 모은다. 화면·탭·시트 전환 애니메이션과 playJudge의 바늘
// 흔들기가 이 값을 공유해, "감속 모션" 설정이 앱 전체에서 일관되게 적용되게 한다(매체 쿼리를 매번 새로
// 만들지 않는다). 진행 템포(playSteps/playBlock 간격)는 움직임이 아니라 읽는 시간이라 유지한다(T-10-007).
export const motionOK = (() => {
  try {
    return !matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
})();

/** 감속 모션이면 0, 아니면 주어진 지속시간(ms)을 그대로 돌려준다. Svelte transition duration 등에 쓴다.
 * T-11-022 업무 모드(스프레드시트 화면)에서도 0 — 화면이 미끄러지지 않는다. */
export const dur = (ms: number): number => (motionOK && !sheetOn() ? ms : 0);

/** 화면 전환(T-10-119). dir 1이면 다음 화면이 오른쪽에서, -1이면 이전 화면이 왼쪽에서 밀려 들어온다 — 모바일에서
 * 가장자리를 밀어 뒤로 갈 수 있다는 걸 보여 준다. 0이면 효과 없이 바로 바꾼다(브라우저가 이미 넘김 효과를 보인 경우).
 * transform이 아니라 left를 움직인다: transform은 안의 position:fixed(탭바·액션바)의 기준을 화면 래퍼로
 * 바꿔 전환 중에 바가 사라진다. opacity는 그대로 둬 axe 명도 대비 검사가 중간 프레임에 흔들리지 않는다. */
export function screenIn(_node: Element, { dir = 1 }: { dir?: -1 | 0 | 1 } = {}) {
  if (!dir) return { duration: 0 };
  const dx = Math.min(innerWidth, 560) * 0.36 * dir;
  return {
    duration: dur(260),
    easing: cubicOut,
    css: (t: number) => `position:relative;left:${(1 - t) * dx}px`,
  };
}

// ───────── 햅틱 (T-10-003 goal 5) ─────────
// 지원 브라우저 + 감속 모션이 아닐 때만 아주 짧게(10ms) 진동한다. 실패해도(미지원 등) 게임 흐름에는
// 영향이 없다 — try/catch로 완전히 무해화한다.
export function buzz(ms = 10): void {
  if (!motionOK) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no-op */
  }
}

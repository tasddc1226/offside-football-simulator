// ───────── 모션 공통 유틸 (T-10-003) ─────────
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

/** 감속 모션이면 0, 아니면 주어진 지속시간(ms)을 그대로 돌려준다. Svelte transition duration 등에 쓴다. */
export const dur = (ms: number): number => (motionOK ? ms : 0);

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

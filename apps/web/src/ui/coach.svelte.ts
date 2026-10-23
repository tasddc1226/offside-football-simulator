// T-11-473 첫 커리어 따라가기 안내의 지금 단계(app-core tutorial). 홈 첫 화면 번들에는 이 상태만 싣고, 말풍선(Coachmark.svelte)은
// 단계가 남았을 때만 따로 불러온다.
import { coachReplay, coachResume } from '@offside/app-core/tutorial';

export const coach = $state<{ i: number | null }>({ i: coachResume() });

/** 설정의 다시 보기 — 첫 단계(홈의 새 커리어 버튼)부터. */
export function replayCoach(): void {
  coach.i = coachReplay();
}

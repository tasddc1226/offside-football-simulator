// ───────── 앱 로그인 (T-11-003) ─────────
// 구글: 시스템 브라우저 인증 세션으로 웹과 같은 구글 로그인을 거쳐 offside://auth로 돌아오고, 받은 표를 앱 세션
// 토큰으로 바꾼다. 애플: Sign in with Apple(iOS) 신원 토큰을 서버가 검증해 앱 세션을 준다. 로그인을 마치면
// back이 가리키는 곳(소식 글·은퇴 선수)으로, 없으면 구단주 화면으로 간다(웹 login.ts와 같다).
// T-11-005 화면 작업 중에는 이 파일의 이름·모양만 쓴다 — 구현은 T-11-003이 채운다.
import type { BoardKey } from '@offside/contracts/board-limits';
import { toast } from '../game/host';

/** 로그인을 마치고 돌아가 다시 열 곳. 소식 글(댓글) · 내 은퇴 선수(공유). */
export type LoginReturn = { board: BoardKey; postId: string | null } | { career: string };

export async function startGoogleLogin(_back: LoginReturn | null): Promise<void> {
  toast('앱 로그인은 준비 중이에요.');
}

/** 이 기기에서 Sign in with Apple을 쓸 수 있는가(iOS 13+). */
export async function appleLoginAvailable(): Promise<boolean> {
  return false;
}

export async function startAppleLogin(_back: LoginReturn | null): Promise<void> {
  toast('앱 로그인은 준비 중이에요.');
}

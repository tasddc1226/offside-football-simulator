// 로그인 안내 문구(웹 ui/login.ts, 앱 platform/auth.ts가 같이 쓴다). 서버가 돌려보낸 reason 코드별 실패 안내.
const FAIL_MSG: Record<string, string> = {
  session: '로그인 준비가 끝나지 않았어요. 다시 눌러 주세요.',
  rate_limited: '로그인 시도가 너무 많아요. 잠시 뒤 다시 시도해 주세요.',
  unavailable: '지금은 구글 로그인을 사용할 수 없어요. 잠시 뒤 다시 시도해 주세요.',
  cancelled: '로그인을 취소했어요.',
};

export const LOGIN_OFFLINE_TEXT = '서버에 연결하지 못했어요. 잠시 후 다시 로그인해 주세요.';

/** 구글 로그인 실패 안내. 모르는 reason은 코드를 괄호로 붙여 문의 때 알아볼 수 있게 한다. */
export const googleFailText = (reason: string | null | undefined): string =>
  (reason && FAIL_MSG[reason]) ?? `구글 로그인에 실패했어요${reason ? ` (${reason})` : ''}.`;

/** 로그인 성공 안내. via: '구글' | 'Apple'. */
export const loginDoneText = (result: 'linked' | 'switched', via: string): string =>
  result === 'linked' ? `${via} 계정을 연결했어요.` : `다른 ${via} 계정으로 바꿨어요.`;

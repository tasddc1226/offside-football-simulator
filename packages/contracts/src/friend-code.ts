// T-11-098 친구 코드 · 초대 링크 규칙. 웹 첫 화면(초대 링크 처리)이 import하므로 다른 모듈을 import하지 않는다.

/** 친구 코드: 헷갈리는 글자(0·O·1·I·L)를 뺀 대문자·숫자 8자. */
export const FRIEND_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const FRIEND_CODE_LENGTH = 8;
export const FRIEND_CODE_RE = new RegExp(`^[${FRIEND_CODE_CHARS}]{${FRIEND_CODE_LENGTH}}$`);

/** 사람이 입력한 친구 코드를 정리한다(공백·하이픈 제거, 대문자). 형식이 틀리면 null. */
export function normalizeFriendCode(raw: string): string | null {
  const code = raw.replace(/[\s-]/g, '').toUpperCase();
  return FRIEND_CODE_RE.test(code) ? code : null;
}

/** 친구 초대 링크의 쿼리 이름(`/?friend=코드`). */
export const FRIEND_INVITE_PARAM = 'friend';

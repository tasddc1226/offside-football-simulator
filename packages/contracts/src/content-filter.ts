// 유저가 쓴 공개 문자열(명예의 전당 이름·게시판 닉네임·댓글) 최소 필터. 완벽한 검열이 목적이 아니다.
// 서버 검증과 웹의 사전 확인(명예의 전당 이름 공개)이 같은 규칙을 쓴다.
const LINK = /https?:|www\.|\.(com|net|kr|io|gg)\b/i;
const PROFANITY = /(시발|씨발|ㅅㅂ|병신|ㅂㅅ|개새|좆|지랄|fuck|shit|bitch)/i;
export function isAcceptablePublicName(name: string): boolean {
  const compact = name.replace(/\s+/g, '');
  return !LINK.test(compact) && !PROFANITY.test(compact);
}
/** 공개 이름 형식(careers.ts PublicNameSchema와 같은 규칙) — zod 없이 웹 메인 번들에서도 쓴다. */
export const PUBLIC_NAME_MAX = 16;
export const PUBLIC_NAME_CHARS = /^[^\p{Cc}<>]+$/u;
/** 서버가 받는 공개 이름으로 다듬는다. 형식이 틀리거나 링크·욕설이 있으면 null(익명). */
export function toPublicName(name: string): string | null {
  const n = name.trim();
  return n && n.length <= PUBLIC_NAME_MAX && PUBLIC_NAME_CHARS.test(n) && isAcceptablePublicName(n)
    ? n
    : null;
}
/** T-10-028 운영자를 사칭하는 닉네임(공백·대소문자 무시, 포함 여부로 본다). 관리자 계정만 '운영자'로 쓴다. */
const RESERVED_NICKNAME = /(운영자|관리자|운영진)/i;
export const isReservedNickname = (name: string): boolean =>
  RESERVED_NICKNAME.test(name.replace(/\s+/g, ''));
/** 긴 글(게시판 댓글)용 — 링크는 허용하고 흔한 욕설만 막는다. */
export const hasProfanity = (text: string): boolean => PROFANITY.test(text.replace(/\s+/g, ''));

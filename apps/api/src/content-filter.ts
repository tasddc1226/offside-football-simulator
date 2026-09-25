// 유저가 쓴 공개 문자열(명예의 전당 이름·게시판 닉네임·댓글) 최소 필터. 완벽한 검열이 목적이 아니다.
const LINK = /https?:|www\.|\.(com|net|kr|io|gg)\b/i;
const PROFANITY = /(시발|씨발|ㅅㅂ|병신|ㅂㅅ|개새|좆|지랄|fuck|shit|bitch)/i;
export function isAcceptablePublicName(name: string): boolean {
  const compact = name.replace(/\s+/g, '');
  return !LINK.test(compact) && !PROFANITY.test(compact);
}
/** 긴 글(게시판 댓글)용 — 링크는 허용하고 흔한 욕설만 막는다. */
export const hasProfanity = (text: string): boolean => PROFANITY.test(text.replace(/\s+/g, ''));

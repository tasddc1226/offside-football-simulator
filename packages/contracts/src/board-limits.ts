/**
 * T-10-011. 게시판 키·길이 한도. zod가 없는 서브패스(`@offside/contracts/board-limits`)라 웹이 값으로
 * 가져와도 번들에 zod가 들어가지 않는다 — 웹 입력 제한과 서버 검증이 같은 숫자를 쓴다.
 */
export const BOARD_KEYS = ['notice', 'release'] as const;
export type BoardKey = (typeof BOARD_KEYS)[number];

export const POST_TITLE_MAX = 80;
export const POST_BODY_MAX = 5000;
export const POST_VERSION_MAX = 20;
export const COMMENT_BODY_MAX = 500;
export const COMMENT_NICKNAME_MAX = 12;

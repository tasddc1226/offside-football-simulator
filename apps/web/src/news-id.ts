/** 공개 소식 글 ID(T-11-198). 관리자 글은 UUID, 자동 릴리즈 글은 날짜. API 라우트와 같은 규칙. */
export const NEWS_ID = /^pst_(?:release_\d{8}|[0-9a-f-]{36})$/;

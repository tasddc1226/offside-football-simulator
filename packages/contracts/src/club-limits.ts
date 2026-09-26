/**
 * T-10-036. 클럽 엠블럼 이미지 한도. zod가 없는 서브패스(`@offside/contracts/club-limits`)라 웹 업로드·동기화
 * 확인과 서버 계약(clubs.ts)이 같은 숫자와 계산을 쓴다.
 */
export const CLUB_CUSTOM_IMG_MAX = 16_000;
/** 업로드 이미지 합계 한도 — 요청 본문 한도(REQUEST_BODY_MAX_BYTES, 1MiB) 안에 이름·색까지 들어가게 둔다. */
export const CLUB_CUSTOM_IMG_TOTAL_MAX = 800_000;

/** 클럽 커스텀 맵에 담긴 업로드 이미지(data URL) 길이의 합. */
export const clubImgTotal = (clubs: Record<string, { logo?: { img?: string | undefined } | undefined }>): number =>
  Object.values(clubs).reduce((n, c) => n + (c.logo?.img?.length ?? 0), 0);

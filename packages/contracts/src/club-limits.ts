/**
 * T-10-036. 클럽 엠블럼 이미지 한도. zod가 없는 서브패스(`@offside/contracts/club-limits`)라 웹 업로드·동기화
 * 확인과 서버 계약(clubs.ts)이 같은 숫자와 계산을 쓴다.
 */
export const CLUB_CUSTOM_IMG_MAX = 16_000;
/**
 * 업로드 이미지 합계 한도. T-11-599 리그가 늘어 클럽이 302개가 되면서 800KB(64px 엠블럼 약 200장)로는 새 리그 클럽에
 * 이미지를 넣지 못해 1.4MB(약 340장)로 올렸다. 동기화 요청은 이 경로만 CLUB_CUSTOM_BODY_MAX_BYTES까지 받는다.
 */
export const CLUB_CUSTOM_IMG_TOTAL_MAX = 1_400_000;

/** 클럽 커스텀 맵에 담긴 업로드 이미지(data URL) 길이의 합. */
export const clubImgTotal = (
  clubs: Record<string, { logo?: { img?: string | undefined } | undefined }>,
): number => Object.values(clubs).reduce((n, c) => n + (c.logo?.img?.length ?? 0), 0);

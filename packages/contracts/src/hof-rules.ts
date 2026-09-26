/**
 * T-10-032. 공개 명예의 전당에 오르는 조건. zod가 없는 서브패스(`@offside/contracts/hof-rules`)라 웹이 값으로
 * 가져와도 번들에 zod가 들어가지 않는다 — 서버 목록·상세·공유 링크와 웹 안내가 같은 숫자를 쓴다.
 * 은퇴는 언제든 고를 수 있어서(T-10-029) 이 나이 전에 은퇴한 짧은 커리어는 내 선수에만 남는다.
 */
export const HOF_MIN_RETIRE_AGE = 30;

/** 짧은 커리어 안내(은퇴 확인·은퇴 화면 공용). */
export const SHORT_CAREER_NOTE = `만 ${HOF_MIN_RETIRE_AGE}세 전에 은퇴한 짧은 커리어는 전체 명예의 전당과 공유 링크에 오르지 않고 '내 선수'에만 남습니다.`;

export const isHofEligible = (retireAge: number): boolean => retireAge >= HOF_MIN_RETIRE_AGE;

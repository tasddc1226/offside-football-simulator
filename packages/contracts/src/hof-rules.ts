/**
 * T-10-032. 공개 명예의 전당에 오르는 조건. zod가 없는 서브패스(`@offside/contracts/hof-rules`)라 웹이 값으로
 * 가져와도 번들에 zod가 들어가지 않는다 — 서버 목록·상세·공유 링크와 웹 안내가 같은 숫자를 쓴다.
 * 은퇴는 언제든 고를 수 있어서(T-10-029) 이 나이 전에 은퇴한 짧은 커리어는 내 선수에만 남는다.
 */
export const HOF_MIN_RETIRE_AGE = 30;

/** 짧은 커리어 안내(은퇴 확인·은퇴 화면 공용). */
export const SHORT_CAREER_NOTE = `만 ${HOF_MIN_RETIRE_AGE}세 전에 은퇴한 짧은 커리어는 전체 명예의 전당과 공유 링크에 오르지 않고 '내 선수'에만 남습니다.`;

export const isHofEligible = (retireAge: number): boolean => retireAge >= HOF_MIN_RETIRE_AGE;

/** 포지션별 골·도움·무실점 가중(레전드 점수). */
export const LEGEND_W = {
  FW: { g: 0.42, a: 0.35, cs: 0 },
  MF: { g: 0.65, a: 0.75, cs: 0 },
  DF: { g: 0.9, a: 0.5, cs: 0.9 },
  GK: { g: 1, a: 0.6, cs: 0.95 },
};

/** 레전드 점수에 들어가는 통산 값. ballonRankPoints = 발롱도르 순위마다 max(0, 31 − 순위)의 합. */
export interface LegendTotals {
  goals: number;
  assists: number;
  cs: number;
  apps: number;
  trophies: number;
  awards: number;
  caps: number;
  peak: number;
  ballon: number;
  ballonRankPoints: number;
  worldCups: number;
}

/**
 * 레전드 점수의 각 항(반올림 전 — 합을 한 번 반올림한 것이 점수). 웹 은퇴 리포트(legendScoreBreakdown)와 서버의
 * 은퇴 요약 보정(apps/api plausibility.ts)이 같은 식을 쓴다.
 */
export function legendTerms(pos: string, t: LegendTotals) {
  const w = LEGEND_W[pos as keyof typeof LEGEND_W] ?? LEGEND_W.MF;
  return {
    goals: t.goals * w.g,
    assists: t.assists * w.a,
    cs: t.cs * w.cs,
    apps: t.apps * 0.05,
    trophies: t.trophies * 10,
    awards: t.awards * 12,
    caps: t.caps * 0.4,
    peak: t.peak * 2,
    ballonWin: t.ballon * 60,
    ballonRank: t.ballonRankPoints * 0.6,
    wc: t.worldCups * 60,
    century: t.caps >= 100 ? 25 : 0,
  };
}

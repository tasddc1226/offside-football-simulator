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

/**
 * T-10-091 세부 포지션별 가중 보정. 윙어·수비형 미드필더는 같은 포지션 안에서 골 대신 도움(또는 수비)을 맡아
 * 골에 붙는 수상이 적다 — 시뮬레이션(fulltime-sim DPOS=1, 12,000명)에서 같은 큰 포지션 평균에 맞춘 값이다.
 * 여기 없는 세부 포지션은 큰 포지션 가중을 그대로 쓴다. c는 경기 장악(T-11-021) 가중이다.
 */
interface LegendWeight {
  g: number;
  a: number;
  cs: number;
  c?: number;
}
export const LEGEND_W_DETAIL: Partial<Record<string, LegendWeight>> = {
  W: { g: 0.42, a: 0.55, cs: 0 },
  DM: { g: 0.8, a: 0.85, cs: 0, c: 0.55 },
  CM: { ...LEGEND_W.MF, c: 0.7 },
  AM: { ...LEGEND_W.MF, c: 0.5 },
};

/**
 * T-11-021 경기 장악: 골·도움이 적은 중앙 미드필더(LEGEND_W_DETAIL의 c)가 쌓는 몫. 시즌마다 출전 × (평균 평점 −
 * CONTROL_BASE)를 더한다 — 평점이 기준 아래면 0, CONTROL_CAP 위는 세지 않는다(평균을 올리는 항이지 꼬리를 만드는
 * 항이 아니다). 세부 포지션별 가중이라 프리시즌 선수(세부 포지션 없음)는 0이다.
 */
export const CONTROL_BASE = 6.5;
export const CONTROL_CAP = 0.6;
export const controlPoints = (seasons: readonly { apps: number; rating: number }[]): number =>
  seasons.reduce(
    (t, r) => t + r.apps * Math.min(CONTROL_CAP, Math.max(0, r.rating - CONTROL_BASE)),
    0,
  );

/**
 * T-11-021 한 시즌에 레전드 점수로 치는 개인상 수. 득점상(리그 득점왕·게르트 뮐러·골든슈)이 한 시즌에 겹쳐
 * 공격수 꼬리를 만들었다(시즌 1 딥다이브 결론 3). 상은 그대로 받고 점수만 시즌당 이만큼 센다. 세부 포지션이
 * 있는 선수(시즌 1부터)에게만 적용한다.
 */
export const AWARDS_PER_SEASON = 3;
export function legendAwardCount(
  awards: readonly { year: number }[],
  dpos?: string | null,
): number {
  const cap = dpos ? AWARDS_PER_SEASON : Infinity;
  const per = new Map<number, number>();
  for (const a of awards) per.set(a.year, (per.get(a.year) ?? 0) + 1);
  return [...per.values()].reduce((t, n) => t + Math.min(n, cap), 0);
}

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
  /** controlPoints(). */
  control: number;
}

/**
 * 레전드 점수의 각 항(반올림 전 — 합을 한 번 반올림한 것이 점수). 웹 은퇴 리포트(legendScoreBreakdown)와 서버의
 * 은퇴 요약 보정(apps/api plausibility.ts)이 같은 식을 쓴다.
 */
export function legendTerms(pos: string, t: LegendTotals, dpos?: string | null) {
  const w: LegendWeight =
    (dpos && LEGEND_W_DETAIL[dpos]) || (LEGEND_W[pos as keyof typeof LEGEND_W] ?? LEGEND_W.MF);
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
    control: t.control * (w.c ?? 0),
  };
}

/**
 * T-11-379 경기 리포트 — 팀 경기 엔진(api team/sim.ts expectedGoals)이 기대 득점을 정할 때 쓰는 세 비교를 같은 식으로
 * 다시 센다. 결과를 바꾸지 않고 설명만 한다. 서버(시즌 리포트)와 웹 · 앱(한 판 리포트)이 같은 값을 쓴다.
 */

/** 줄 힘 네 가지(반올림해 저장한 값도 받는다). */
export type ReportLines = { atk: number; mid: number; def: number; gk: number };
/** 줄 비교 세 가지 — 내 공격 대 상대 수비벽, 내 중원 대 상대 중원, 내 수비벽 대 상대 공격. */
export type ReportLine = 'atk' | 'mid' | 'def';
export const REPORT_LINES: readonly ReportLine[] = ['atk', 'mid', 'def'];

/** 수비벽 = 수비 70% + 골키퍼 30%(expectedGoals와 같다). */
export const wallOf = (l: ReportLines): number => 0.7 * l.def + 0.3 * l.gk;

/** 줄 비교(내 쪽 − 상대 쪽). 양수면 우세. */
export function lineEdges(mine: ReportLines, opp: ReportLines): Record<ReportLine, number> {
  return {
    atk: mine.atk - wallOf(opp),
    mid: mine.mid - opp.mid,
    def: wallOf(mine) - opp.atk,
  };
}

/**
 * 비교 1점이 두 팀 기대 득점 차에 주는 무게(로그 배율, 10점당). 공격 · 수비벽은 한쪽 기대 득점에 SIM.atkK(0.3),
 * 중원은 양쪽에 SIM.midK(0.1)씩 들어가 0.2다. api sim.test.ts가 SIM 값과 맞는지 확인한다.
 */
export const REPORT_LINE_WEIGHT: Record<ReportLine, number> = { atk: 0.3, mid: 0.2, def: 0.3 };

/** 결과에 가장 크게 작용한 비교(무게 × 차이의 절댓값이 가장 큰 줄). 같으면 공격 → 중원 → 수비 순. */
export function decisiveLine(edges: Record<ReportLine, number>): ReportLine {
  let best: ReportLine = 'atk';
  for (const l of REPORT_LINES)
    if (
      Math.abs(edges[l]) * REPORT_LINE_WEIGHT[l] >
      Math.abs(edges[best]) * REPORT_LINE_WEIGHT[best]
    )
      best = l;
  return best;
}

/** 가장 약한 비교(무게 × 차이가 가장 작은 줄). 모두 우세면 null. */
export function weakestLine(edges: Record<ReportLine, number>): ReportLine | null {
  let worst: ReportLine | null = null;
  for (const l of REPORT_LINES)
    if (
      edges[l] < 0 &&
      (!worst || edges[l] * REPORT_LINE_WEIGHT[l] < edges[worst] * REPORT_LINE_WEIGHT[worst])
    )
      worst = l;
  return worst;
}

// T-11-379 경기 리포트 — 팀 경기 결과의 기대 득점 · 줄 비교 · 진단 한 줄 · 고칠 곳, 시즌 리포트 줄. 웹 · 앱이 같이
// 쓴다(표시만, 결과를 바꾸지 않는다). 선수 쪽 평점 구성 · 성장 방향은 ratingReport.ts.
import type { TeamMatch, TeamStatsReport } from './api/team.js';
import {
  DETAIL_LABEL,
  REPORT_LINES,
  SLOT_LINES,
  decisiveLine,
  lineEdges,
  wallOf,
  weakestLine,
  type DetailPos,
  type ReportLine,
} from '@offside/contracts/owner-team';
import { tn } from '@offside/game/i18n/names';
import { matchReportText as L } from './i18n/ko/matchReport.js';

const one = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
/** 줄 비교 차이 표기(소수 없이, 1 미만은 1). */
const gapText = (x: number) => String(Math.max(1, Math.round(Math.abs(x))));

export const LINE_LABEL: Record<ReportLine, () => string> = {
  atk: () => L.lineAtk,
  mid: () => L.lineMid,
  def: () => L.lineDef,
};

export type ReportRow = {
  line: ReportLine;
  label: string;
  mine: number;
  opp: number;
  edge: number;
};
export type TeamMatchReport = {
  xgFor: number;
  xgAgainst: number;
  xgText: string;
  rows: ReportRow[];
  diagnosis: string;
  /** 고칠 곳 — 진(밀린) 비교 중 가장 크게 밀린 줄. 모두 앞서면 null. */
  weak: ReportLine | null;
};

/** 기대 득점 차가 이만큼 넘게 벌어졌는데 결과가 반대면 운 이야기를 한다. */
const LUCK_XG_GAP = 0.5;
/** 결정적 비교가 이 점수보다 작으면 '비슷했다'. */
const EVEN_EDGE = 1;

/** 한 판 리포트. 기대 득점 · 줄 힘이 없는 옛 경기면 null. */
export function teamMatchReport(m: TeamMatch): TeamMatchReport | null {
  const me = m[m.mine];
  const opp = m[m.mine === 'home' ? 'away' : 'home'];
  if (me.xg === undefined || opp.xg === undefined || !me.lines || !opp.lines) return null;
  const edges = lineEdges(me.lines, opp.lines);
  const rows: ReportRow[] = [
    { line: 'atk', mine: me.lines.atk, opp: Math.round(wallOf(opp.lines)), edge: edges.atk },
    { line: 'mid', mine: me.lines.mid, opp: opp.lines.mid, edge: edges.mid },
    { line: 'def', mine: Math.round(wallOf(me.lines)), opp: opp.lines.atk, edge: edges.def },
  ].map((r) => ({ ...r, line: r.line as ReportLine, label: LINE_LABEL[r.line as ReportLine]() }));
  const gf = me.goals,
    ga = opp.goals;
  let diagnosis: string;
  if (gf > ga && me.xg + LUCK_XG_GAP < opp.xg) diagnosis = L.dLuckWin;
  else if (gf < ga && me.xg > opp.xg + LUCK_XG_GAP) diagnosis = L.dLuckLoss;
  else {
    const l = decisiveLine(edges);
    const e = edges[l];
    const n = gapText(e);
    diagnosis =
      Math.abs(e) < EVEN_EDGE
        ? L.dEven
        : l === 'atk'
          ? e > 0
            ? L.dAtkUp({ n })
            : L.dAtkDown({ n })
          : l === 'mid'
            ? e > 0
              ? L.dMidUp({ n })
              : L.dMidDown({ n })
            : e > 0
              ? L.dDefUp({ n })
              : L.dDefDown({ n });
  }
  return {
    xgFor: me.xg,
    xgAgainst: opp.xg,
    xgText: L.xgLine({ mine: one(me.xg), opp: one(opp.xg) }),
    rows,
    diagnosis,
    weak: weakestLine(edges),
  };
}

/**
 * 고칠 곳 — 약한 줄에서 실력을 올리면 그 줄이 가장 많이 오르는 자리. 자리 몫(줄 안 비중) × 남은 여지(99 − 지금 실력)가
 * 가장 큰 자리를 고른다. 수비벽은 골키퍼(30%)도 후보다. 빈 자리는 유스 실력으로 본다.
 */
export function fixSlot(
  slotCodes: readonly DetailPos[],
  ratings: readonly (number | null)[],
  line: ReportLine,
  youth: number,
): number | null {
  let total = 0;
  for (const s of slotCodes) if (s !== 'GK') total += SLOT_LINES[s][line];
  let best: number | null = null,
    bestScore = 0;
  slotCodes.forEach((s, i) => {
    const w =
      s === 'GK'
        ? line === 'def'
          ? 0.3
          : 0
        : (SLOT_LINES[s][line] / (total || 1)) * (line === 'def' ? 0.7 : 1);
    const score = w * (99 - (ratings[i] ?? youth));
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** 자리 이름(지금 언어). */
export const slotName = (slot: DetailPos): string => tn(DETAIL_LABEL[slot]);

export type SeasonReportView = {
  xg: string;
  finish: string;
  behind: string;
  edges: { label: string; edge: number }[];
  formations: { formation: string; text: string }[];
};

/** 시즌 리포트 줄. 기대 득점이 남은 경기가 없으면 null(빈 상태 문구를 쓴다). */
export function seasonReportView(r: TeamStatsReport | undefined): SeasonReportView | null {
  if (!r || !r.matches) return null;
  const diff = r.gf - r.xgFor;
  const finish =
    Math.abs(diff) < 0.5
      ? L.seasonFinishEven
      : diff > 0
        ? L.seasonFinishUp({ n: one(diff) })
        : L.seasonFinishDown({ n: one(-diff) });
  const worst = REPORT_LINES.reduce((a, b) => (r.behind[b] > r.behind[a] ? b : a));
  return {
    xg: L.seasonXg({
      n: r.matches,
      xgFor: one(r.xgFor),
      gf: r.gf,
      xgAgainst: one(r.xgAgainst),
      ga: r.ga,
    }),
    finish,
    behind: r.behind[worst]
      ? L.seasonBehind({ line: LINE_LABEL[worst](), k: r.behind[worst], n: r.matches })
      : L.seasonNoBehind,
    edges: REPORT_LINES.map((l) => ({ label: LINE_LABEL[l](), edge: r.edges[l] })),
    formations: r.formations.map((f) => ({
      formation: f.formation,
      text: L.seasonFormationRow({
        w: f.w,
        d: f.d,
        l: f.l,
        xgFor: one(f.xgFor),
        xgAgainst: one(f.xgAgainst),
      }),
    })),
  };
}

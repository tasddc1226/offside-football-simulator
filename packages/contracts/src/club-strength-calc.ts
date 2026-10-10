// ───────── T-11-135 현실 순위표 → 구단 전력 계산 (T-11-132 기획 4절) ─────────
// tooling/fulltime-sim/club-strength.ts가 쓰는 순수 계산. 게임 화면은 이 파일을 쓰지 않는다(결과 표만 읽는다).
// 순위 번호 대신 경기당 승점·득실차를 쓰고, 경기 수가 적을수록 기본 전력 쪽에 두며, 한 번 갱신할 때 움직이는 폭을 막는다.

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export interface StandingRow {
  /** 순위표의 팀 이름(대응표 키). */
  team: string;
  p: number;
  w: number;
  d: number;
  l: number;
  pts: number;
  gf: number;
  ga: number;
}

export const CALC = {
  /** 경기당 승점이 리그 평균보다 1 높으면 +6. */
  ppg: 6,
  /** 경기당 득실차가 리그 평균보다 1 높으면 +2(±2에서 자른다). */
  gdpg: 2,
  gdpgClip: 2,
  /** 경기 수 가중 w = P / (P + 10). */
  damp: 10,
  /** 이 경기 수보다 적게 치렀으면 이전 값을 유지한다. */
  minGames: 3,
  /** 갱신 한 번에 이전 값에서 움직이는 폭, 기본 전력에서 벗어나는 폭. */
  stepMax: 3,
  baseMax: 6,
} as const;

/** 순위표 검사에서 걸린 것. 문구는 운영 스크립트가 만든다(엔진 파일엔 화면 문구를 두지 않는다). */
export type StandingIssue =
  | { kind: 'dup' | 'nan'; team: string }
  | { kind: 'games' | 'points'; team: string; got: number; want: number }
  | { kind: 'gd'; got: number };

/** 순위표가 맞는지 본다. 걸린 것 목록(비어 있으면 통과). */
export function checkStandings(rows: StandingRow[]): StandingIssue[] {
  const out: StandingIssue[] = [];
  const names = new Set<string>();
  for (const r of rows) {
    if (names.has(r.team)) out.push({ kind: 'dup', team: r.team });
    names.add(r.team);
    if (![r.p, r.w, r.d, r.l, r.pts, r.gf, r.ga].every((x) => Number.isInteger(x) && x >= 0))
      out.push({ kind: 'nan', team: r.team });
    if (r.w + r.d + r.l !== r.p)
      out.push({ kind: 'games', team: r.team, got: r.w + r.d + r.l, want: r.p });
    if (3 * r.w + r.d !== r.pts)
      out.push({ kind: 'points', team: r.team, got: 3 * r.w + r.d, want: r.pts });
  }
  const gd = rows.reduce((t, r) => t + r.gf - r.ga, 0);
  if (gd !== 0) out.push({ kind: 'gd', got: gd });
  return out;
}

export interface StrengthRow {
  id: string;
  team: string;
  base: number;
  prev: number;
  target: number;
  next: number;
  /** 경기 수가 모자라 이전 값을 그대로 뒀다. */
  held?: boolean;
}

/**
 * 목표 전력의 중심 center(그 리그 구단 기본 전력 평균)와 순위표로 새 전력을 구한다. 리그 평균 경기당 승점·득실차는 대응하지 않는 팀(상무 등)까지
 * 포함한 전체 순위표로 계산한다. map: 팀 이름 → 게임 구단 id(대응하는 팀만), base/prev: 구단 id → 기본·이전 전력.
 */
export function computeStrength(
  center: number,
  rows: StandingRow[],
  map: Record<string, string>,
  base: Record<string, number>,
  prev: Record<string, number>,
): StrengthRow[] {
  const P = rows.reduce((t, r) => t + r.p, 0);
  const avgPpg = P ? rows.reduce((t, r) => t + r.pts, 0) / P : 0;
  const avgGdpg = P ? rows.reduce((t, r) => t + r.gf - r.ga, 0) / P : 0;
  const clip = (x: number, m: number) => clamp(x, -m, m);
  return rows.flatMap((r) => {
    const id = map[r.team];
    if (!id) return [];
    const b = base[id]!;
    const pv = prev[id] ?? b;
    if (r.p < CALC.minGames)
      return [{ id, team: r.team, base: b, prev: pv, target: pv, next: pv, held: true }];
    const target =
      center +
      CALC.ppg * (r.pts / r.p - avgPpg) +
      CALC.gdpg * clip((r.gf - r.ga) / r.p - avgGdpg, CALC.gdpgClip);
    const w = r.p / (r.p + CALC.damp);
    const raw = Math.round((1 - w) * b + w * target);
    const stepped = pv + clip(raw - pv, CALC.stepMax);
    return [
      {
        id,
        team: r.team,
        base: b,
        prev: pv,
        target: +target.toFixed(2),
        next: b + clip(stepped - b, CALC.baseMax),
      },
    ];
  });
}

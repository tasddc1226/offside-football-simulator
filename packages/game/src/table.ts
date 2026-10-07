import { CLUBS, type Club, type League } from './data.js';
import { clamp, chance, gauss, hashStr } from './rng.js';
import type { GameState } from './types.js';
import { leagueOf, clubsIn } from './player.js';
import { gTurnText as M } from './i18n/ko/gTurn.js';
import { tn } from './i18n/names.js';

// ───────── 순위 ─────────
// 시즌마다 상대 전력 19개(S.rivals)를 뽑지만, 리그의 실제 팀 수는 12~20개다(T-10-009). T-10-024부터
// 순위는 실제 팀 수에 맞춰 가장 강한 (팀 수 - 1)개 상대하고만 매긴다 — 약한 쪽을 버리므로 우승·상위권
// 확률은 그대로이고, 순위표의 팀 이름과 순위 범위가 맞는다(30팀인 MLS는 상대가 19개뿐이라 20팀까지).
// RNG 소비(finalRank의 난수)는 19개 모두에 대해 그대로 일어난다.
const basePpg = (L: League, str: number) => 1.35 + (str - L.avg) * 0.06;

/** 지금 보이는 시즌 기록이 뛴 리그. 승격 직후 이적 시장이 떠 있는 동안은 s.leagueId(새 리그)와 다르다(T-10-110). */
export const seasonLeagueId = (s: GameState): string => s.season.leagueId ?? s.leagueId;

/** 시즌 상대 전력 수(리그 팀 수와 상관없이 늘 19개를 뽑는다 — RNG 소비 수를 지킨다). */
export const RIVALS = 19;

/**
 * T-11-134 이번 시즌 리그 상대 구단 — 내 구단을 뺀 리그 클럽을 전력 순으로 최대 19개(30팀인 MLS는 강한 19팀).
 * 시즌을 시작할 때 S.opp로 고정한다.
 */
export function rivalClubs(s: GameState): Club[] {
  return clubsIn(s.leagueId, s)
    .filter((c) => c.id !== s.club.id)
    .sort((a, b) => b.str - a.str)
    .slice(0, RIVALS);
}

/**
 * 19개 표준정규 난수에서 강한 n개(n = 1..19)를 고른 값들의 평균·표준편차. 예전에는 상대 전력 19개를 뽑아 강한 (팀 수 - 1)개만
 * 순위에 넣었다 — 팀이 적은 리그(K1·고교)일수록 순위 상대가 리그 평균보다 강했다. 상대 구단이 n개인 리그도 이 분포에 맞춘다.
 */
const TOP_MEAN = [
  1.85, 1.61, 1.44, 1.3, 1.18, 1.08, 0.98, 0.89, 0.81, 0.73, 0.65, 0.57, 0.5, 0.42, 0.35, 0.27,
  0.19, 0.1, 0,
];
const TOP_SD = [
  0.53, 0.52, 0.53, 0.55, 0.56, 0.58, 0.59, 0.61, 0.63, 0.65, 0.68, 0.7, 0.72, 0.75, 0.78, 0.82,
  0.86, 0.92, 1,
];
/** 상대 구단이 n개일 때 순위용 전력이 리그 평균보다 높게 잡히는 몫 — 경기 상대 전력에서는 다시 뺀다. */
const rivalLift = (L: League, n: number) => (n ? L.spread * TOP_MEAN[n - 1]! : 0);

/**
 * 시즌 상대 전력. 앞쪽 n개는 상대 구단 전력(리그 안 상대적 위치)에 시즌 폼 편차를 더하고, 구단이 모자라 남는 자리는 예전처럼
 * 리그 평균 ± 분산이다. 평균·분산은 예전 순위 상대(19개 중 강한 n개)와 같게 맞춰 우승·순위 분포를 유지한다 —
 * 구단 전력 차이가 분산에서 차지하는 만큼만 폼 편차를 줄인다. 난수는 예전과 같이 19번 쓴다.
 */
export function seasonRivals(L: League, opps: Club[]): number[] {
  const n = opps.length;
  const mean = n ? opps.reduce((t, c) => t + c.str, 0) / n : L.avg;
  const v = n ? opps.reduce((t, c) => t + (c.str - mean) ** 2, 0) / n : 0;
  const form = Math.sqrt(Math.max(0, L.spread ** 2 - v));
  const sd = n ? TOP_SD[n - 1]! : 1;
  const rivals: number[] = [];
  for (let i = 0; i < RIVALS; i++)
    rivals.push(
      i < n
        ? L.avg + rivalLift(L, n) + sd * (opps[i]!.str - mean + gauss() * form)
        : L.avg + gauss() * L.spread,
    );
  return rivals;
}

/**
 * 리그 rd라운드(1부터) 상대 — S.opp를 차례로 돈다. str은 경기용 전력으로, 순위용 몫(rivalLift)을 빼 리그 평균 팀을 상대하던
 * 예전 경기와 평균 난도가 같다. 옛 시즌(S.opp 없음)은 null.
 */
export function matchOpp(s: GameState, rd: number): { id: string; str: number } | null {
  const opp = s.season.opp;
  if (!opp?.length) return null;
  const i = (rd - 1) % opp.length;
  return { id: opp[i]!, str: s.season.rivals[i]! - rivalLift(leagueOf(s.leagueId), opp.length) };
}

/** 순위에 들어가는 상대 인덱스(S.rivals 기준, 강한 순). */
function rankedRivals(s: GameState): number[] {
  const R = s.season.rivals;
  // T-11-134 상대 구단이 정해진 시즌은 그 구단들만 순위에 든다(나머지 자리는 구단이 모자라 채운 숫자).
  if (s.season.opp) return s.season.opp.map((_, i) => i);
  const n = Math.max(1, Math.min(R.length, clubsIn(seasonLeagueId(s), s).length - 1));
  return R.map((_, i) => i)
    .sort((a, b) => R[b]! - R[a]!)
    .slice(0, n);
}

export interface TableRow {
  /** 클럽 id(엠블럼용, T-10-064). 리그 클럽이 모자라 번호로 채운 줄은 없다. */
  id?: string | undefined;
  name: string;
  me: boolean;
  p: number;
  w: number;
  d: number;
  l: number;
  pts: number;
}

/** 현재까지의 리그 순위표. 상대 팀 승점은 전력으로 매긴 기대 승점에 팀별 고정 편차를 더한 값이고(난수 없음), 승점이 같으면
 * 내 팀이 위다. */
export function leagueTable(s: GameState): TableRow[] {
  const L = leagueOf(seasonLeagueId(s)),
    S = s.season,
    P = S.played;
  // T-11-134 S.opp가 있으면 상대 전력과 구단이 짝이다. 옛 시즌은 리그 클럽을 전력 순으로 짝지어 이름만 붙인다.
  const clubs = S.opp
    ? S.opp.map((id) => CLUBS.find((c) => c.id === id))
    : clubsIn(seasonLeagueId(s), s)
        .filter((c) => c.id !== s.club.id)
        .sort((a, b) => b.str - a.str);
  const rows: TableRow[] = rankedRivals(s).map((ri, k) => {
    const club = clubs[S.opp ? ri : k];
    const koName = club?.name ?? `${L.name} ${k + 1}`;
    const name = club ? club.name : M.placeholderTeam({ league: tn(L.name), n: k + 1 });
    // 팀·시즌·경기 수로 정해지는 고정 편차(난수 아님) — 같은 전력대 팀들이 똑같은 전적으로 겹치지 않게.
    // 언어와 상관없이 같은 순위표가 되도록 한국어 이름으로 해시한다.
    const h = hashStr(`${koName}|${s.year}`);
    const jitter = P ? ((h + P * 7) % 5) - 2 : 0;
    const pts = clamp(
      Math.round(clamp(basePpg(L, S.rivals[ri]!), 0.4, 2.6) * P) + jitter,
      0,
      3 * P,
    );
    // 무승부는 경기의 18~32%(팀마다 다름). 승점이 정확히 맞도록 승·무를 나눈다.
    let w = Math.max(0, Math.floor((pts - Math.round(P * (0.18 + (h % 15) / 100))) / 3));
    let d = pts - 3 * w;
    while (w + d > P && d >= 3) {
      w++;
      d -= 3;
    }
    return { id: club?.id, name, me: false, p: P, w, d, l: P - w - d, pts };
  });
  rows.push({
    id: s.club.id,
    name: s.club.name,
    me: true,
    p: P,
    w: S.w,
    d: S.d,
    l: S.l,
    pts: S.pts,
  });
  return rows.sort((a, b) => b.pts - a.pts || Number(b.me) - Number(a.me));
}

export function teamRank(s: GameState): number | null {
  if (!s.season.played) return null;
  return leagueTable(s).findIndex((r) => r.me) + 1;
}
export function finalRank(s: GameState): number {
  const L = leagueOf(s.leagueId),
    S = s.season;
  const ranked = new Set(rankedRivals(s));
  let rank = 1;
  S.rivals.forEach((str, i) => {
    const pts = Math.round(L.matches * clamp(basePpg(L, str) + gauss() * 0.12, 0.4, 2.6));
    const above = pts > S.pts || (pts === S.pts && chance(0.5));
    if (above && ranked.has(i)) rank++;
  });
  return rank;
}

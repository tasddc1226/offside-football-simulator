import type { League } from './data.js';
import { clamp, chance, gauss, hashStr } from './rng.js';
import type { GameState } from './types.js';
import { leagueOf, clubsIn } from './player.js';

// ───────── 순위 ─────────
// 시즌마다 상대 전력 19개(S.rivals)를 뽑지만, 리그의 실제 팀 수는 12~20개다(T-10-009). T-10-024부터
// 순위는 실제 팀 수에 맞춰 가장 강한 (팀 수 - 1)개 상대하고만 매긴다 — 약한 쪽을 버리므로 우승·상위권
// 확률은 그대로이고, 순위표의 팀 이름과 순위 범위가 맞는다(30팀인 MLS는 상대가 19개뿐이라 20팀까지).
// RNG 소비(finalRank의 난수)는 19개 모두에 대해 그대로 일어난다.
const basePpg = (L: League, str: number) => 1.35 + (str - L.avg) * 0.06;

/** 순위에 들어가는 상대 인덱스(S.rivals 기준, 강한 순). */
function rankedRivals(s: GameState): number[] {
  const R = s.season.rivals;
  const n = Math.max(1, Math.min(R.length, clubsIn(s.leagueId).length - 1));
  return R.map((_, i) => i).sort((a, b) => R[b]! - R[a]!).slice(0, n);
}

export interface TableRow {
  name: string;
  me: boolean;
  p: number;
  w: number;
  d: number;
  l: number;
  pts: number;
}

/** 현재까지의 리그 순위표. 상대 팀 승점은 전력으로 매긴 기대 승점에 팀별 고정 편차를 더한 값이고(난수 없음), 승점이 같으면
 * 내 팀이 위다. 상대 팀 이름은 리그 클럽을 전력 순으로 짝지어 붙인다. */
export function leagueTable(s: GameState): TableRow[] {
  const L = leagueOf(s.leagueId), S = s.season, P = S.played;
  const names = clubsIn(s.leagueId).filter((c) => c.id !== s.club.id).sort((a, b) => b.str - a.str).map((c) => c.name);
  const rows: TableRow[] = rankedRivals(s).map((ri, k) => {
    const name = names[k] ?? `${L.name} ${k + 1}`;
    // 팀·시즌·경기 수로 정해지는 고정 편차(난수 아님) — 같은 전력대 팀들이 똑같은 전적으로 겹치지 않게.
    const h = hashStr(`${name}|${s.year}`);
    const jitter = P ? ((h + P * 7) % 5) - 2 : 0;
    const pts = clamp(Math.round(clamp(basePpg(L, S.rivals[ri]!), 0.4, 2.6) * P) + jitter, 0, 3 * P);
    // 무승부는 경기의 18~32%(팀마다 다름). 승점이 정확히 맞도록 승·무를 나눈다.
    let w = Math.max(0, Math.floor((pts - Math.round(P * (0.18 + (h % 15) / 100))) / 3));
    let d = pts - 3 * w;
    while (w + d > P && d >= 3) {
      w++;
      d -= 3;
    }
    return { name, me: false, p: P, w, d, l: P - w - d, pts };
  });
  rows.push({ name: s.club.name, me: true, p: P, w: S.w, d: S.d, l: S.l, pts: S.pts });
  return rows.sort((a, b) => b.pts - a.pts || Number(b.me) - Number(a.me));
}

export function teamRank(s: GameState): number | null {
  if (!s.season.played) return null;
  return leagueTable(s).findIndex((r) => r.me) + 1;
}
export function finalRank(s: GameState): number {
  const L = leagueOf(s.leagueId), S = s.season;
  const ranked = new Set(rankedRivals(s));
  let rank = 1;
  S.rivals.forEach((str, i) => {
    const pts = Math.round(L.matches * clamp(basePpg(L, str) + gauss() * 0.12, 0.4, 2.6));
    const above = pts > S.pts || (pts === S.pts && chance(0.5));
    if (above && ranked.has(i)) rank++;
  });
  return rank;
}


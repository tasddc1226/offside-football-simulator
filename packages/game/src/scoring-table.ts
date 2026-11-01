import { hashStr } from './hash.js';
import { clubsIn, leagueOf } from './player.js';
import { seasonLeagueId } from './table.js';
import type { GameState } from './types.js';

export type ScoringRow = {
  id: string;
  clubId: string;
  slot: number;
  me: boolean;
  goals: number;
  assists: number;
};

/** Stable simulated league players. Reading never draws from the career RNG.
 * Each goal/assist has a fixed round, so records only grow as the season advances. */
export function scoringTable(s: GameState): ScoringRow[] | null {
  if (!s.season.scoringVersion) return null;
  const leagueId = seasonLeagueId(s);
  const matches = leagueOf(leagueId).matches;
  const year = s.pending?.type === 'market' ? s.year - 1 : s.year;
  const played = Math.min(matches, s.season.played);
  const rows: ScoringRow[] = [];
  const mineId = s.season.finalTable?.find((r) => r.me)?.id ?? s.club.id;
  const clubIds = s.season.opp ? [mineId, ...s.season.opp] : clubsIn(leagueId, s).map((c) => c.id);
  for (const clubId of clubIds) {
    for (let slot = 0; slot < 2; slot++) {
      const id = `${year}|${leagueId}|${clubId}|${slot}|${s.season.rivals.join(',')}`;
      const seed = hashStr(id);
      const unit = (key: string) => {
        let x = hashStr(`${key}|${seed}`);
        x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
        x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
        return ((x ^ (x >>> 16)) >>> 0) / 0x100000000;
      };
      const totalG = Math.max(
        0,
        Math.round(matches * (slot === 0 ? 0.26 + unit('g') * 0.39 : 0.08 + unit('g') * 0.2)),
      );
      const totalA = Math.max(
        0,
        Math.round(matches * (slot === 1 ? 0.12 + unit('a') * 0.27 : 0.05 + unit('a') * 0.15)),
      );
      const count = (n: number, kind: string) =>
        Array.from({ length: n }, (_, i) => 1 + Math.floor(unit(`${kind}${i}`) * matches)).filter(
          (round) => round <= played,
        ).length;
      rows.push({
        id,
        clubId,
        slot,
        me: false,
        goals: count(totalG, 'goal'),
        assists: count(totalA, 'assist'),
      });
    }
  }
  rows.push({
    id: 'me',
    clubId: mineId,
    slot: 0,
    me: true,
    goals: s.season.goals,
    assists: s.season.assists,
  });
  return rows;
}

/** Joint places: equal records share the award, independent of display ordering. */
export function scoringRank(
  rows: ScoringRow[],
  mine: ScoringRow,
  key: 'goals' | 'assists',
): number {
  return 1 + rows.filter((row) => row[key] > mine[key]).length;
}

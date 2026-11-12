import { usesRankLadder } from '@offside/contracts/owner-team';
import { clampDivision, nextDivision, type DivisionRules } from '@offside/contracts/team-division';
import type { OwnerTeamRow } from '../db/repos/ownerTeams.js';

/** Response projection only. Instant and live matches retain their own atomic commit lifecycle. */
export function rankedMatchProgress(
  season: number,
  team: Pick<OwnerTeamRow, 'wins' | 'draws' | 'losses' | 'rating' | 'division'>,
  score: number,
  delta: number,
  divisions: DivisionRules,
) {
  const rating = team.rating + delta;
  return {
    record: {
      w: team.wins + (score === 1 ? 1 : 0),
      d: team.draws + (score === 0.5 ? 1 : 0),
      l: team.losses + (score === 0 ? 1 : 0),
    },
    rating,
    // A concurrently received match can move stored rating; the next team read reconciles it.
    ...(usesRankLadder(season)
      ? {
          division: {
            from: clampDivision(team.division),
            to: nextDivision(rating, team.division, divisions),
          },
        }
      : {}),
  };
}

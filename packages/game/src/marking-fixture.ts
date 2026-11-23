import { CLUBS } from './data.js';
import { markingAbsence, markingOpener, markingReturn } from './i18n/ko/gTurn.js';
import type { MatchGame } from './match.js';
import { scoringTable } from './scoring-table.js';
import { schedule } from './story.js';
import type { GameState } from './types.js';

export const MARKING_RETURN = 'df-marking-rematch';

/** At the end of a block, use the actual league scoring table and the games just played. */
export function firstMarkingGame(s: GameState, games: readonly MatchGame[]) {
  if (s.markingFixture || !games.length) return;
  const rows = scoringTable(s);
  if (!rows?.length) return;
  const goals = Math.max(...rows.map((r) => r.goals));
  if (!goals) return;
  const leaders = new Set(
    rows.filter((r) => r.goals === goals && r.clubId !== s.club.id).map((r) => r.clubId),
  );
  // Choose the latest encounter so that a later match in this block cannot be mistaken for the opener.
  for (let i = games.length - 1; i >= 0; i--) {
    const game = games[i]!;
    if (!game.opp || !leaders.delete(game.opp) || !game.mins) continue;
    return {
      opponent: game.opp,
      club: s.club.id,
      league: s.leagueId,
      year: s.year,
      round: game.rd,
    };
  }
}

function savedClubName(opponent: string) {
  const club = CLUBS.find((c) => c.id === opponent);
  return club?.baseName ?? club?.name ?? opponent;
}

export function recordFirstMarking(s: GameState, approach: 'man' | 'zone') {
  const f = s.markingFixture;
  if (f)
    s.miles = [
      ...(s.miles ?? []),
      { year: f.year, t: markingOpener(savedClubName(f.opponent), f.round, approach) },
    ];
}

export function finishMarking(s: GameState, choice: 'follow' | 'hand') {
  const f = s.markingFixture;
  if (f?.returnRound !== undefined) {
    s.miles = [
      ...(s.miles ?? []),
      {
        year: f.returnYear ?? s.year,
        t: markingReturn(
          savedClubName(f.opponent),
          f.returnRound,
          choice,
          f.returnResult,
          f.returnScore,
        ),
      },
    ];
  }
  delete s.markingFixture;
}

/** Deal with the FIRST later meeting, using its own minutes and injury flag, not end-of-block condition. */
export function checkMarkingFixture(s: GameState, games: readonly MatchGame[]) {
  const f = s.markingFixture;
  if (!f) return;
  if (s.club.id !== f.club || s.leagueId !== f.league || s.pos !== 'DF') {
    delete s.markingFixture;
    s.chains = s.chains?.filter((c) => c.id !== MARKING_RETURN) ?? [];
    return;
  }
  if (f.returnRound !== undefined) return;
  const game = games.find(
    (g) => g.opp === f.opponent && (s.year > f.year || (s.year === f.year && g.rd > f.round)),
  );
  if (!game) return;
  if (game.mins === 0) {
    s.miles = [
      ...(s.miles ?? []),
      {
        year: s.year,
        t: markingAbsence(savedClubName(f.opponent), game.rd, !!game.inj),
      },
    ];
    delete s.markingFixture;
    return;
  }
  f.returnRound = game.rd;
  f.returnYear = s.year;
  f.returnResult = game.res;
  schedule(s, MARKING_RETURN, 0);
}
